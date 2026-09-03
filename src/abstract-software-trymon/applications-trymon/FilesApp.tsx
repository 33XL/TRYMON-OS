import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  FolderOpen, FileCode, ChevronRight, Home, 
  ArrowLeft, RefreshCw, Folder, Search, 
  Grid, List as ListIcon, Menu as MenuIcon, 
  Monitor, FileText, Music, Video, Download, Upload, Image as ImageIcon,
  FolderPlus, FilePlus, Edit3, Trash2
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

export default function FilesApp({ userName, onContextMenu, onOpenFile }: { 
  userName: string,
  onContextMenu: (e: React.MouseEvent, items: ContextMenuItem[]) => void,
  onOpenFile?: (path: string) => void
}) {
  const userHome = `/home/${userName}`;
  const [currentPath, setCurrentPath] = useState(userHome);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [history, setHistory] = useState<string[]>([userHome]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [editingPath, setEditingPath] = useState<string | null>(null);

  const loadDirectory = useCallback((path: string) => {
    console.log('[FilesApp] Loading directory:', path);
    try {
      const result = kernel.listDir(path);
      console.log('[FilesApp] Got files:', result);
      setFiles(result);
    } catch (e) {
      console.error('[FilesApp] Failed to load directory:', path, e);
    }
  }, []);

  useEffect(() => {
    loadDirectory(currentPath);
  }, [currentPath, refreshKey, loadDirectory]);

  const refreshView = useCallback(() => {
    console.log('[FilesApp] refreshView called, currentPath:', currentPath);
    loadDirectory(currentPath);
    setRefreshKey(prev => prev + 1);
  }, [currentPath, loadDirectory]);

  const navigateTo = (path: string, pushHistory = true) => {
    let normalized = path;
    if (normalized === '') normalized = '/';
    
    setCurrentPath(normalized);
    setSearchTerm(''); // Reset search on navigation
    
    if (pushHistory) {
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(normalized);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    }
  };

  const goBack = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setCurrentPath(history[newIndex]);
    }
  };

  const goForward = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setCurrentPath(history[newIndex]);
    }
  };

  const handleEntryClick = (entry: FileEntry) => {
    if (entry.file_type === 'Directory') {
      navigateTo(entry.path);
    } else {
      console.log('[FilesApp] Opening file:', entry.path);
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
    const path = currentPath === '/' ? `/${defaultName}` : `${currentPath}/${defaultName}`;
    kernel.createDirectory(path);
    refreshView();
    // Use a small timeout to allow the view to refresh before entering edit mode
    setTimeout(() => setEditingPath(path), 100);
  };

  const handleCreateFile = () => {
    const defaultName = 'novo_arquivo.txt';
    const path = currentPath === '/' ? `/${defaultName}` : `${currentPath}/${defaultName}`;
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
          const path = currentPath === '/' ? `/${file.name}` : `${currentPath}/${file.name}`;
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
    const parts = currentPath.split('/').filter(p => p !== '');
    const crumbs = [{ name: 'Raiz', path: '/', isRoot: true }];
    let accumulated = '';
    parts.forEach((p: string) => {
      accumulated += `/${p}`;
      crumbs.push({ name: p, path: accumulated, isRoot: false });
    });
    return crumbs;
  }, [currentPath]);

  const filteredFiles = useMemo(() => {
    let result = files;
    if (searchTerm) {
      result = files.filter((f: FileEntry) => f.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    // Filter hidden files by default
    return result.filter(f => !f.name.startsWith('.'));
  }, [files, searchTerm]);

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
      onContextMenu={(e) => {
        if (e.target === e.currentTarget || (e.target as HTMLElement).className.includes('files-main-view')) {
          onContextMenu(e, [
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
      {/* Nautilus Header Bar */}
      <div className="files-header-bar">
        <div className="header-left">
          <div className="nav-group">
            <button className="nav-btn" disabled={historyIndex === 0} onClick={goBack} title="Voltar">
              <ArrowLeft size={16} />
            </button>
            <button className="nav-btn" disabled={historyIndex >= history.length - 1} onClick={goForward} title="Avançar">
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
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="view-group">
            <button className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')}>
              <Grid size={16} />
            </button>
            <button className={`view-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}>
              <ListIcon size={16} />
            </button>
          </div>
          <button className="menu-btn" onClick={refreshView} title="Atualizar"><RefreshCw size={16} /></button>
          <button className="menu-btn"><MenuIcon size={16} /></button>
        </div>
      </div>

      <div className="files-layout-body">
        <div className="files-sidebar-nautilus">
          <div className="sidebar-group">
            <div 
              className={`sidebar-item ${currentPath === userHome ? 'active' : ''}`} 
              onClick={() => navigateTo(userHome)}
              onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={(e) => onDrop(e, userHome)}
            >
              <Home size={16} /> <span>Pasta Pessoal</span>
            </div>
          </div>
          
          <div className="sidebar-group">
            <h4>Favoritos</h4>
            <div className={`sidebar-item ${currentPath === `${userHome}/Workspace` ? 'active' : ''}`} onClick={() => navigateTo(`${userHome}/Workspace`)} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={(e) => onDrop(e, `${userHome}/Workspace`)}>
              <Monitor size={16} /> <span>Workspace</span>
            </div>
            <div className={`sidebar-item ${currentPath === `${userHome}/Documents` ? 'active' : ''}`} onClick={() => navigateTo(`${userHome}/Documents`)} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={(e) => onDrop(e, `${userHome}/Documents`)}>
              <FileText size={16} /> <span>Documentos</span>
            </div>
            <div className={`sidebar-item ${currentPath === `${userHome}/Downloads` ? 'active' : ''}`} onClick={() => navigateTo(`${userHome}/Downloads`)} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={(e) => onDrop(e, `${userHome}/Downloads`)}>
              <Download size={16} /> <span>Downloads</span>
            </div>
            <div className={`sidebar-item ${currentPath === `${userHome}/Musics` ? 'active' : ''}`} onClick={() => navigateTo(`${userHome}/Musics`)} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={(e) => onDrop(e, `${userHome}/Musics`)}>
              <Music size={16} /> <span>Músicas</span>
            </div>
            <div className={`sidebar-item ${currentPath === `${userHome}/Videos` ? 'active' : ''}`} onClick={() => navigateTo(`${userHome}/Videos`)} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={(e) => onDrop(e, `${userHome}/Videos`)}>
              <Video size={16} /> <span>Vídeos</span>
            </div>
            <div className={`sidebar-item ${currentPath === `${userHome}/Pictures` ? 'active' : ''}`} onClick={() => navigateTo(`${userHome}/Pictures`)} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={(e) => onDrop(e, `${userHome}/Pictures`)}>
              <ImageIcon size={16} /> <span>Imagens</span>
            </div>
            <div className={`sidebar-item ${currentPath === `${userHome}/Desktop` ? 'active' : ''}`} onClick={() => navigateTo(`${userHome}/Desktop`)} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={(e) => onDrop(e, `${userHome}/Desktop`)}>
              <Monitor size={16} /> <span>Desktop</span>
            </div>
          </div>

          <div className="sidebar-group">
            <h4>Sistema</h4>
            <div className="sidebar-item" onClick={() => navigateTo('/')} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={(e) => onDrop(e, '/')}>
              <RefreshCw size={16} /> <span>Outros Locais</span>
            </div>
            <div className={`sidebar-item trash-target`} onClick={() => console.log('Open Trash App')} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDropTrash}>
              <Trash2 size={16} /> <span>Lixeira</span>
            </div>
          </div>
        </div>

        <div className="files-main-view">
          <div className={`files-view-${viewMode}`}>
            {filteredFiles.length === 0 ? (
              <div className="empty-message">
                <FolderOpen size={48} opacity={0.3} />
                <p>{searchTerm ? 'Nenhum resultado encontrado' : 'Pasta vazia'}</p>
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
                    onContextMenu(e, [
                      { label: 'Abrir', icon: f.file_type === 'Directory' ? <FolderOpen size={14} /> : <FileCode size={14} />, onClick: () => handleEntryClick(f) },
                      { label: 'Renomear', icon: <Edit3 size={14} />, onClick: () => handleRename(f) },
                      { label: 'Exportar', icon: <Download size={14} />, onClick: () => handleExport(f), disabled: f.file_type === 'Directory' },
                      { separator: true },
                      { label: 'Mover para Lixeira', icon: <Trash2 size={14} />, danger: true, onClick: () => handleMoveToTrash(f) }
                    ]);
                  }}
                >
                  <div className="item-icon">
                    {f.file_type === 'Directory' ? <Folder size={viewMode === 'grid' ? 56 : 24} /> : <FileCode size={viewMode === 'grid' ? 56 : 24} />}
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
                    {viewMode === 'list' && <span className="item-size">{f.file_type === 'Directory' ? '--' : formatSize(f.size)}</span>}
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
