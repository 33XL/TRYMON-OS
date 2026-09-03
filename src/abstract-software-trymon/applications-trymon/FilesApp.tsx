import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  FolderOpen, FileCode, ChevronRight, Home, 
  ArrowLeft, RefreshCw, Folder, Search, 
  Grid, List as ListIcon, 
  Monitor, FileText, Music, Video, Download, Upload, Image as ImageIcon,
  FolderPlus, FilePlus, Edit3, Trash2, Plus, X, ExternalLink
} from 'lucide-react';
import * as kernel from '../../interface/services/kernelService';
import { ContextMenuItem } from '../../interface/components/ContextMenu';

interface FileEntry {
  id: string;
  name: string;
  path: string;
  file_type: 'File' | 'Directory' | 'Symlink' | 'CharDevice' | 'BlockDevice';
  size: number;
}

interface FilesTab {
  id: string;
  name: string;
  currentPath: string;
  history: string[];
  historyIndex: number;
  viewMode: 'grid' | 'list';
  searchTerm: string;
}

export default function FilesApp({ 
  userName, 
  initialPath,
  onContextMenu, 
  onOpenFile,
  onTitleChange,
  onOpenNewWindow
}: { 
  userName: string;
  initialPath?: string;
  onContextMenu: (e: React.MouseEvent, items: ContextMenuItem[]) => void;
  onOpenFile?: (path: string) => void;
  onTitleChange?: (title: string) => void;
  onOpenNewWindow?: (appId: string, initialProps?: any) => void;
}) {
  const userHome = `/home/${userName}`;
  const startPath = initialPath || userHome;

  const createNewTab = useCallback((path = userHome): FilesTab => {
    const folderName = path === '/' ? 'Raiz' : (path.split('/').pop() || 'Arquivos');
    return {
      id: crypto.randomUUID(),
      name: folderName,
      currentPath: path,
      history: [path],
      historyIndex: 0,
      viewMode: 'grid',
      searchTerm: ''
    };
  }, [userHome]);

  const [tabs, setTabs] = useState<FilesTab[]>(() => [createNewTab(startPath)]);
  const [activeTabId, setActiveTabId] = useState<string>(() => tabs[0]?.id || '');
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editingPath, setEditingPath] = useState<string | null>(null);

  const activeTab = useMemo(() => tabs.find(t => t.id === activeTabId) || tabs[0], [tabs, activeTabId]);

  // Update window title when path or active tab changes
  useEffect(() => {
    if (activeTab && onTitleChange) {
      const displayPath = activeTab.currentPath === userHome ? '~' : activeTab.currentPath;
      onTitleChange(`Arquivos - ${displayPath}`);
    }
  }, [activeTab?.currentPath, userHome, onTitleChange]);

  const loadDirectory = useCallback((path: string) => {
    try {
      const result = kernel.listDir(path);
      setFiles(result);
    } catch (e) {
      console.error('[FilesApp] Failed to load directory:', path, e);
      setFiles([]);
    }
  }, []);

  useEffect(() => {
    if (activeTab) {
      loadDirectory(activeTab.currentPath);
    }
  }, [activeTab?.currentPath, refreshKey, loadDirectory]);

  const refreshView = useCallback(() => {
    if (activeTab) {
      loadDirectory(activeTab.currentPath);
    }
    setRefreshKey(prev => prev + 1);
  }, [activeTab, loadDirectory]);

  const updateActiveTab = useCallback((updater: (tab: FilesTab) => FilesTab) => {
    setTabs(prev => prev.map(t => t.id === activeTab.id ? updater(t) : t));
  }, [activeTab?.id]);

  const navigateTo = (path: string, pushHistory = true) => {
    let normalized = path;
    if (normalized === '') normalized = '/';
    const folderName = normalized === '/' ? 'Raiz' : (normalized.split('/').pop() || 'Pasta');
    
    updateActiveTab(tab => {
      let newHistory = tab.history;
      let newHistoryIndex = tab.historyIndex;
      
      if (pushHistory) {
        newHistory = tab.history.slice(0, tab.historyIndex + 1);
        newHistory.push(normalized);
        newHistoryIndex = newHistory.length - 1;
      }
      
      return {
        ...tab,
        name: folderName,
        currentPath: normalized,
        searchTerm: '',
        history: newHistory,
        historyIndex: newHistoryIndex
      };
    });
  };

  const goBack = () => {
    if (activeTab.historyIndex > 0) {
      const newIndex = activeTab.historyIndex - 1;
      const targetPath = activeTab.history[newIndex];
      const folderName = targetPath === '/' ? 'Raiz' : (targetPath.split('/').pop() || 'Pasta');
      updateActiveTab(tab => ({
        ...tab,
        name: folderName,
        currentPath: targetPath,
        historyIndex: newIndex
      }));
    }
  };

  const goForward = () => {
    if (activeTab.historyIndex < activeTab.history.length - 1) {
      const newIndex = activeTab.historyIndex + 1;
      const targetPath = activeTab.history[newIndex];
      const folderName = targetPath === '/' ? 'Raiz' : (targetPath.split('/').pop() || 'Pasta');
      updateActiveTab(tab => ({
        ...tab,
        name: folderName,
        currentPath: targetPath,
        historyIndex: newIndex
      }));
    }
  };

  const handleAddTab = (path?: string) => {
    const targetPath = path || activeTab?.currentPath || userHome;
    const newTab = createNewTab(targetPath);
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
  };

  const handleCloseTab = (tabId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (tabs.length <= 1) return; // Keep at least one tab

    setTabs(prev => {
      const filtered = prev.filter(t => t.id !== tabId);
      if (activeTabId === tabId) {
        const closedIndex = prev.findIndex(t => t.id === tabId);
        const nextActive = filtered[Math.max(0, closedIndex - 1)];
        if (nextActive) {
          setActiveTabId(nextActive.id);
        }
      }
      return filtered;
    });
  };

  const handleEntryClick = (entry: FileEntry) => {
    if (entry.file_type === 'Directory') {
      navigateTo(entry.path);
    } else {
      if (onOpenFile) {
        onOpenFile(entry.path);
      }
    }
  };

  // Drag & Drop Handlers
  const onDragStart = (e: React.DragEvent, entry: FileEntry) => {
    e.dataTransfer.setData('sourcePath', entry.path);
    e.dataTransfer.setData('sourceName', entry.name);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('drag-over');
  };

  const onDrop = (e: React.DragEvent, targetPath: string) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    const sourcePath = e.dataTransfer.getData('sourcePath');
    const sourceName = e.dataTransfer.getData('sourceName');
    
    if (sourcePath && sourcePath !== targetPath) {
      const finalDest = targetPath === '/' ? `/${sourceName}` : `${targetPath}/${sourceName}`;
      kernel.renamePath(sourcePath, finalDest);
      refreshView();
    }
  };

  const onDropTrash = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    const sourcePath = e.dataTransfer.getData('sourcePath');
    if (sourcePath) {
      kernel.moveToTrash(sourcePath);
      refreshView();
    }
  };

  const handleCreateFolder = () => {
    const defaultName = 'Nova Pasta';
    const path = activeTab.currentPath === '/' ? `/${defaultName}` : `${activeTab.currentPath}/${defaultName}`;
    kernel.createDirectory(path);
    refreshView();
    setTimeout(() => setEditingPath(path), 100);
  };

  const handleCreateFile = () => {
    const defaultName = 'novo_arquivo.txt';
    const path = activeTab.currentPath === '/' ? `/${defaultName}` : `${activeTab.currentPath}/${defaultName}`;
    kernel.createFile(path);
    refreshView();
    setTimeout(() => setEditingPath(path), 100);
  };

  const handleRename = (entry: FileEntry) => {
    setEditingPath(entry.path);
  };

  const commitRename = (oldPath: string, newName: string) => {
    if (!newName || newName === oldPath.split('/').pop()) {
      setEditingPath(null);
      return;
    }

    const parentDir = oldPath.split('/').slice(0, -1).join('/') || '/';
    const newPath = parentDir === '/' ? `/${newName}` : `${parentDir}/${newName}`;

    try {
      kernel.renamePath(oldPath, newPath);
      refreshView();
    } catch (e) {
      console.error('Rename failed:', e);
    } finally {
      setEditingPath(null);
    }
  };

  const handleMoveToTrash = (entry: FileEntry) => {
    kernel.moveToTrash(entry.path);
    refreshView();
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = async (e: any) => {
      const selectedFiles = e.target.files;
      if (!selectedFiles || selectedFiles.length === 0) return;

      let processed = 0;
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const reader = new FileReader();
        reader.onload = async (event) => {
          const buffer = event.target?.result as ArrayBuffer;
          const path = activeTab.currentPath === '/' ? `/${file.name}` : `${activeTab.currentPath}/${file.name}`;
          kernel.writeBinaryFile(path, new Uint8Array(buffer));
          
          processed++;
          if (processed === selectedFiles.length) {
            refreshView();
          }
        };
        reader.readAsArrayBuffer(file);
      }
    };
    input.click();
  };

  const handleExport = (entry: FileEntry) => {
    const data = kernel.readFile(entry.path);
    if (!data) {
      console.error('[FilesApp] Could not read file for export:', entry.path);
      return;
    }

    const blob = new Blob([data as any], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = entry.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const breadcrumbs = useMemo(() => {
    const parts = (activeTab?.currentPath || '/').split('/').filter(p => p !== '');
    const crumbs = [{ name: 'Raiz', path: '/', isRoot: true }];
    let accumulated = '';
    parts.forEach((p: string) => {
      accumulated += `/${p}`;
      crumbs.push({ name: p, path: accumulated, isRoot: false });
    });
    return crumbs;
  }, [activeTab?.currentPath]);

  const filteredFiles = useMemo(() => {
    let result = files;
    if (activeTab?.searchTerm) {
      result = files.filter((f: FileEntry) => f.name.toLowerCase().includes(activeTab.searchTerm.toLowerCase()));
    }
    return result.filter(f => !f.name.startsWith('.'));
  }, [files, activeTab?.searchTerm]);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div 
      className="files-window nautilus-style"
      style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
      onContextMenu={(e) => {
        if (e.target === e.currentTarget || (e.target as HTMLElement).className.includes('files-main-view')) {
          onContextMenu(e, [
            { label: 'Nova Aba', icon: <Plus size={14} />, onClick: () => handleAddTab() },
            { label: 'Nova Janela de Arquivos', icon: <ExternalLink size={14} />, onClick: () => onOpenNewWindow && onOpenNewWindow('files') },
            { separator: true },
            { label: 'Nova Pasta', icon: <FolderPlus size={14} />, onClick: handleCreateFolder },
            { label: 'Novo Arquivo', icon: <FilePlus size={14} />, onClick: handleCreateFile },
            { separator: true },
            { label: 'Importar Arquivos', icon: <Upload size={14} />, onClick: handleImport },
            { separator: true },
            { label: 'Atualizar', icon: <RefreshCw size={14} />, onClick: refreshView }
          ]);
        }
      }}
    >
      {/* Tab Bar for FilesApp */}
      <div className="files-tabs-bar" style={{
        display: 'flex',
        alignItems: 'center',
        background: 'rgba(22, 27, 34, 0.98)',
        borderBottom: '1px solid rgba(48, 54, 61, 0.6)',
        padding: '4px 8px 0',
        gap: '4px',
        overflowX: 'auto',
        flexShrink: 0
      }}>
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              className={`files-tab ${isActive ? 'active' : ''}`}
              onClick={() => setActiveTabId(tab.id)}
              onContextMenu={(e) => {
                e.stopPropagation();
                onContextMenu(e, [
                  { label: 'Nova Aba', icon: <Plus size={14} />, onClick: () => handleAddTab(tab.currentPath) },
                  { label: 'Abrir em Nova Janela', icon: <ExternalLink size={14} />, onClick: () => onOpenNewWindow && onOpenNewWindow('files', { initialPath: tab.currentPath }) },
                  { separator: true },
                  { label: 'Fechar Aba', icon: <X size={14} />, disabled: tabs.length <= 1, onClick: () => handleCloseTab(tab.id) }
                ]);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '6px 6px 0 0',
                background: isActive ? '#0d1117' : 'rgba(30, 35, 45, 0.4)',
                border: isActive ? '1px solid rgba(48, 54, 61, 0.8)' : '1px solid transparent',
                borderBottom: isActive ? '1px solid #0d1117' : 'none',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '12px',
                userSelect: 'none',
                transition: 'all 0.15s ease',
                minWidth: '110px',
                maxWidth: '200px'
              }}
              title={tab.currentPath}
            >
              <Folder size={13} style={{ color: isActive ? 'var(--accent-cyan)' : 'var(--text-muted)' }} />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {tab.name}
              </span>
              {tabs.length > 1 && (
                <button
                  className="tab-close"
                  onClick={(e) => handleCloseTab(tab.id, e)}
                  title="Fechar aba"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '2px',
                    borderRadius: '3px',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <X size={11} />
                </button>
              )}
            </div>
          );
        })}

        <button
          className="files-tab-add"
          onClick={() => handleAddTab()}
          title="Nova Aba (Pasta Atual)"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '5px 8px',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Nautilus Header Bar */}
      <div className="files-header-bar">
        <div className="header-left">
          <div className="nav-group">
            <button className="nav-btn" disabled={activeTab.historyIndex === 0} onClick={goBack} title="Voltar">
              <ArrowLeft size={16} />
            </button>
            <button className="nav-btn" disabled={activeTab.historyIndex >= activeTab.history.length - 1} onClick={goForward} title="Avançar">
              <ChevronRight size={16} />
            </button>
          </div>
          
          <div className="breadcrumb-pill">
            <button className="pill-segment root" onClick={() => navigateTo('/')} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={(e) => onDrop(e, '/')}>
              <Home size={14} />
            </button>
            {breadcrumbs.slice(1).map((crumb, idx) => (
              <React.Fragment key={crumb.path}>
                <div className="pill-sep"><ChevronRight size={12} /></div>
                <button 
                  className={`pill-segment ${idx === breadcrumbs.length - 2 ? 'active' : ''}`}
                  onClick={() => navigateTo(crumb.path)}
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onDrop={(e) => onDrop(e, crumb.path)}
                >
                  {crumb.name}
                </button>
              </React.Fragment>
            ))}
          </div>

          <div className="action-group" style={{ marginLeft: '12px', display: 'flex', gap: '4px' }}>
            <button className="nav-btn" onClick={handleCreateFolder} title="Nova Pasta">
              <FolderPlus size={16} />
            </button>
            <button className="nav-btn" onClick={handleCreateFile} title="Novo Arquivo">
              <FilePlus size={16} />
            </button>
            <div className="btn-sep" style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />
            <button className="nav-btn" onClick={handleImport} title="Importar do Computador">
              <Upload size={16} />
            </button>
          </div>
        </div>

        <div className="header-right">
          <div className="search-pill">
            <Search size={14} className="search-icon" />
            <input 
              type="text" 
              placeholder="Pesquisar..." 
              value={activeTab.searchTerm}
              onChange={(e) => updateActiveTab(tab => ({ ...tab, searchTerm: e.target.value }))}
            />
          </div>
          <div className="view-group">
            <button 
              className={`view-btn ${activeTab.viewMode === 'grid' ? 'active' : ''}`} 
              onClick={() => updateActiveTab(tab => ({ ...tab, viewMode: 'grid' }))}
            >
              <Grid size={16} />
            </button>
            <button 
              className={`view-btn ${activeTab.viewMode === 'list' ? 'active' : ''}`} 
              onClick={() => updateActiveTab(tab => ({ ...tab, viewMode: 'list' }))}
            >
              <ListIcon size={16} />
            </button>
          </div>
          <button className="menu-btn" onClick={refreshView} title="Atualizar"><RefreshCw size={16} /></button>
          <button className="menu-btn" onClick={() => handleAddTab()} title="Nova Aba"><Plus size={16} /></button>
        </div>
      </div>

      <div className="files-layout-body" style={{ flexGrow: 1, minHeight: 0 }}>
        <div className="files-sidebar-nautilus">
          <div className="sidebar-group">
            <div 
              className={`sidebar-item ${activeTab.currentPath === userHome ? 'active' : ''}`} 
              onClick={() => navigateTo(userHome)}
              onContextMenu={(e) => {
                e.stopPropagation();
                onContextMenu(e, [
                  { label: 'Abrir', icon: <FolderOpen size={14} />, onClick: () => navigateTo(userHome) },
                  { label: 'Abrir em Nova Aba', icon: <Plus size={14} />, onClick: () => handleAddTab(userHome) },
                  { label: 'Abrir em Nova Janela', icon: <ExternalLink size={14} />, onClick: () => onOpenNewWindow && onOpenNewWindow('files', { initialPath: userHome }) }
                ]);
              }}
              onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={(e) => onDrop(e, userHome)}
            >
              <Home size={16} /> <span>Pasta Pessoal</span>
            </div>
          </div>
          
          <div className="sidebar-group">
            <h4>Favoritos</h4>
            {[
              { name: 'Workspace', path: `${userHome}/Workspace`, icon: <Monitor size={16} /> },
              { name: 'Documentos', path: `${userHome}/Documents`, icon: <FileText size={16} /> },
              { name: 'Downloads', path: `${userHome}/Downloads`, icon: <Download size={16} /> },
              { name: 'Músicas', path: `${userHome}/Musics`, icon: <Music size={16} /> },
              { name: 'Vídeos', path: `${userHome}/Videos`, icon: <Video size={16} /> },
              { name: 'Imagens', path: `${userHome}/Pictures`, icon: <ImageIcon size={16} /> },
              { name: 'Desktop', path: `${userHome}/Desktop`, icon: <Monitor size={16} /> },
            ].map(fav => (
              <div 
                key={fav.path}
                className={`sidebar-item ${activeTab.currentPath === fav.path ? 'active' : ''}`} 
                onClick={() => navigateTo(fav.path)}
                onContextMenu={(e) => {
                  e.stopPropagation();
                  onContextMenu(e, [
                    { label: `Abrir ${fav.name}`, icon: <FolderOpen size={14} />, onClick: () => navigateTo(fav.path) },
                    { label: 'Abrir em Nova Aba', icon: <Plus size={14} />, onClick: () => handleAddTab(fav.path) },
                    { label: 'Abrir em Nova Janela', icon: <ExternalLink size={14} />, onClick: () => onOpenNewWindow && onOpenNewWindow('files', { initialPath: fav.path }) }
                  ]);
                }}
                onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={(e) => onDrop(e, fav.path)}
              >
                {fav.icon} <span>{fav.name}</span>
              </div>
            ))}
          </div>

          <div className="sidebar-group">
            <h4>Sistema</h4>
            <div 
              className="sidebar-item" 
              onClick={() => navigateTo('/')}
              onContextMenu={(e) => {
                e.stopPropagation();
                onContextMenu(e, [
                  { label: 'Abrir Raiz', icon: <FolderOpen size={14} />, onClick: () => navigateTo('/') },
                  { label: 'Abrir em Nova Aba', icon: <Plus size={14} />, onClick: () => handleAddTab('/') },
                  { label: 'Abrir em Nova Janela', icon: <ExternalLink size={14} />, onClick: () => onOpenNewWindow && onOpenNewWindow('files', { initialPath: '/' }) }
                ]);
              }}
              onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={(e) => onDrop(e, '/')}
            >
              <RefreshCw size={16} /> <span>Outros Locais (Raiz)</span>
            </div>
            <div className={`sidebar-item trash-target`} onClick={() => onOpenNewWindow && onOpenNewWindow('trash')} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDropTrash}>
              <Trash2 size={16} /> <span>Lixeira</span>
            </div>
          </div>
        </div>

        <div className="files-main-view">
          <div className={`files-view-${activeTab.viewMode}`}>
            {filteredFiles.length === 0 ? (
              <div className="empty-message">
                <FolderOpen size={48} opacity={0.3} />
                <p>{activeTab.searchTerm ? 'Nenhum resultado encontrado' : 'Pasta vazia'}</p>
              </div>
            ) : (
              filteredFiles.map(f => (
                <div
                  key={f.path}
                  draggable
                  onDragStart={(e) => onDragStart(e, f)}
                  onDragOver={f.file_type === 'Directory' ? onDragOver : undefined}
                  onDragLeave={f.file_type === 'Directory' ? onDragLeave : undefined}
                  onDrop={f.file_type === 'Directory' ? (e) => onDrop(e, f.path) : undefined}
                  className={`nautilus-item ${f.file_type === 'Directory' ? 'is-dir' : 'is-file'}`}
                  onDoubleClick={() => handleEntryClick(f)}
                  onContextMenu={(e) => {
                    e.stopPropagation();
                    if (f.file_type === 'Directory') {
                      onContextMenu(e, [
                        { label: 'Abrir', icon: <FolderOpen size={14} />, onClick: () => handleEntryClick(f) },
                        { label: 'Abrir em Nova Aba', icon: <Plus size={14} />, onClick: () => handleAddTab(f.path) },
                        { label: 'Abrir em Nova Janela', icon: <ExternalLink size={14} />, onClick: () => onOpenNewWindow && onOpenNewWindow('files', { initialPath: f.path }) },
                        { separator: true },
                        { label: 'Renomear', icon: <Edit3 size={14} />, onClick: () => handleRename(f) },
                        { separator: true },
                        { label: 'Mover para Lixeira', icon: <Trash2 size={14} />, danger: true, onClick: () => handleMoveToTrash(f) }
                      ]);
                    } else {
                      onContextMenu(e, [
                        { label: 'Abrir', icon: <FileCode size={14} />, onClick: () => handleEntryClick(f) },
                        { label: 'Abrir no Editor (Nova Janela)', icon: <ExternalLink size={14} />, onClick: () => onOpenNewWindow && onOpenNewWindow('editor', { filePath: f.path }) },
                        { separator: true },
                        { label: 'Renomear', icon: <Edit3 size={14} />, onClick: () => handleRename(f) },
                        { label: 'Exportar', icon: <Download size={14} />, onClick: () => handleExport(f) },
                        { separator: true },
                        { label: 'Mover para Lixeira', icon: <Trash2 size={14} />, danger: true, onClick: () => handleMoveToTrash(f) }
                      ]);
                    }
                  }}
                >
                  <div className="item-icon">
                    {f.file_type === 'Directory' ? <Folder size={activeTab.viewMode === 'grid' ? 56 : 24} /> : <FileCode size={activeTab.viewMode === 'grid' ? 56 : 24} />}
                  </div>
                  <div className="item-details">
                    {f.path === editingPath ? (
                      <input
                        type="text"
                        className="file-rename-input"
                        defaultValue={f.name}
                        autoFocus
                        onFocus={(e) => {
                          const lastDot = e.target.value.lastIndexOf('.');
                          if (lastDot > 0 && f.file_type !== 'Directory') {
                            e.target.setSelectionRange(0, lastDot);
                          } else {
                            e.target.select();
                          }
                        }}
                        onBlur={(e) => commitRename(f.path, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitRename(f.path, (e.target as HTMLInputElement).value);
                          if (e.key === 'Escape') setEditingPath(null);
                        }}
                      />
                    ) : (
                      <span className="item-name">{f.name}</span>
                    )}
                    {activeTab.viewMode === 'list' && <span className="item-size">{f.file_type === 'Directory' ? '--' : formatSize(f.size)}</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
