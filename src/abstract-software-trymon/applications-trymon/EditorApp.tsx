import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Save, FileText, Cpu, Plus, Download, Trash2, X } from 'lucide-react';
import * as kernel from '../../interface/services/kernelService';

interface EditorTab {
  id: string;
  filePath: string;
  fileName: string;
  content: string;
  originalContent: string;
  isDirty: boolean;
  lastSaved: Date | null;
}

export default function EditorApp({ 
  filePath,
  onTitleChange,
  onCloseWindow
}: { 
  filePath?: string;
  onTitleChange?: (title: string) => void;
  onCloseWindow?: () => void;
}) {
  const createNewTab = useCallback((path = '', initialText = ''): EditorTab => {
    const name = path ? path.split('/').pop() || 'documento.txt' : 'novo_arquivo.txt';
    return {
      id: crypto.randomUUID(),
      filePath: path,
      fileName: name,
      content: initialText,
      originalContent: initialText,
      isDirty: false,
      lastSaved: null
    };
  }, []);

  const [tabs, setTabs] = useState<EditorTab[]>(() => [createNewTab(filePath || '')]);
  const [activeTabId, setActiveTabId] = useState<string>(() => tabs[0]?.id || '');
  const [isLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const tabCounterRef = useRef(1);

  // Load initial filePath if passed
  useEffect(() => {
    if (!filePath) return;

    const existingTab = tabs.find(t => t.filePath === filePath);
    if (existingTab) {
      setActiveTabId(existingTab.id);
      return;
    }

    try {
      const data = kernel.readFile(filePath);
      const text = data ? new TextDecoder().decode(data) : '';
      const newTab = createNewTab(filePath, text);
      setTabs(prev => [...prev.filter(t => t.filePath || t.content), newTab]);
      setActiveTabId(newTab.id);
    } catch (e) {
      console.error('Failed to load file in editor:', filePath, e);
    }
  }, [filePath, createNewTab]);

  const activeTab = useMemo(() => tabs.find(t => t.id === activeTabId) || tabs[0], [tabs, activeTabId]);

  // Update window title dynamically
  useEffect(() => {
    if (activeTab && onTitleChange) {
      const dirtyMark = activeTab.isDirty ? ' •' : '';
      onTitleChange(`Editor - ${activeTab.fileName}${dirtyMark}`);
    }
  }, [activeTab?.fileName, activeTab?.isDirty, onTitleChange]);

  const updateActiveTab = useCallback((updater: (tab: EditorTab) => EditorTab) => {
    setTabs(prev => prev.map(t => t.id === activeTab.id ? updater(t) : t));
  }, [activeTab?.id]);

  const handleContentChange = (newContent: string) => {
    updateActiveTab(tab => ({
      ...tab,
      content: newContent,
      isDirty: newContent !== tab.originalContent
    }));
  };

  const handleSave = useCallback(() => {
    if (!activeTab) return;
    if (!activeTab.filePath) {
      // Prompt for file path if creating a new file
      const userPath = prompt('Digite o caminho para salvar o arquivo (ex: /home/trymon/Desktop/arquivo.txt):', `/home/trymon/Desktop/${activeTab.fileName}`);
      if (!userPath) return;
      
      const newName = userPath.split('/').pop() || 'arquivo.txt';
      activeTab.filePath = userPath;
      activeTab.fileName = newName;
    }

    setIsSaving(true);
    try {
      kernel.writeFile(activeTab.filePath, activeTab.content);
      const now = new Date();
      updateActiveTab(tab => ({
        ...tab,
        filePath: activeTab.filePath,
        fileName: activeTab.fileName,
        originalContent: tab.content,
        isDirty: false,
        lastSaved: now
      }));
    } catch (e) {
      console.error('Failed to save file:', e);
    } finally {
      setTimeout(() => setIsSaving(false), 400);
    }
  }, [activeTab, updateActiveTab]);

  const handleNewTab = () => {
    tabCounterRef.current += 1;
    const name = `novo_arquivo_${tabCounterRef.current}.txt`;
    const newTab: EditorTab = {
      id: crypto.randomUUID(),
      filePath: '',
      fileName: name,
      content: '',
      originalContent: '',
      isDirty: false,
      lastSaved: null
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
  };

  const handleCloseTab = (tabId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    const targetTab = tabs.find(t => t.id === tabId);
    if (targetTab && targetTab.isDirty) {
      const confirmClose = window.confirm(`O arquivo "${targetTab.fileName}" possui alterações não salvas. Deseja fechar mesmo assim?`);
      if (!confirmClose) return;
    }

    if (tabs.length <= 1) {
      if (onCloseWindow) {
        onCloseWindow();
        return;
      }
      // Reset single tab
      const freshTab = createNewTab('');
      setTabs([freshTab]);
      setActiveTabId(freshTab.id);
      return;
    }

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

  const handleExport = () => {
    if (!activeTab) return;
    const blob = new Blob([activeTab.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeTab.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      handleSave();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'w') {
      e.preventDefault();
      if (activeTab) handleCloseTab(activeTab.id);
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
      e.preventDefault();
      handleNewTab();
    }
  };

  if (isLoading) {
    return (
      <div className="editor-loading">
        <div className="loading-grid">
          <Cpu className="animate-pulse neon-glow" size={48} />
          <span>Sincronizando VFS...</span>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="editor-container"
      style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0d1117' }}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Editor Tabs */}
      <div className="editor-tabs-bar" style={{
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
              className={`editor-tab ${isActive ? 'active' : ''}`}
              onClick={() => setActiveTabId(tab.id)}
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
              title={tab.filePath || 'Novo documento'}
            >
              <FileText size={13} style={{ color: isActive ? 'var(--accent-cyan)' : 'var(--text-muted)' }} />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {tab.fileName}
              </span>
              {tab.isDirty && (
                <span style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: 'var(--accent-cyan)',
                  display: 'inline-block'
                }} />
              )}
              <button
                className="tab-close"
                onClick={(e) => handleCloseTab(tab.id, e)}
                title="Fechar arquivo (Ctrl+W)"
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
            </div>
          );
        })}

        <button
          className="editor-tab-add"
          onClick={handleNewTab}
          title="Novo Arquivo (Ctrl+N)"
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

      <div className="editor-premium-toolbar" style={{ flexShrink: 0 }}>
        <div className="toolbar-section">
          <button className="premium-tool-btn" onClick={handleNewTab} title="Nova Aba (Ctrl+N)">
            <Plus size={16} />
            <span>Novo</span>
          </button>
          <button 
            className={`premium-tool-btn ${isSaving ? 'active' : ''}`} 
            onClick={handleSave}
            disabled={isSaving}
            title="Salvar Alterações (Ctrl+S)"
          >
            <Save size={16} />
            <span>{isSaving ? 'Salvando...' : 'Salvar'}</span>
          </button>
          <button className="premium-tool-btn" onClick={handleExport} title="Exportar para o Sistema">
            <Download size={16} />
            <span>Exportar</span>
          </button>
        </div>
        
        <div className="toolbar-section file-info">
          <FileText size={14} className="accent-cyan" />
          <span className="file-path-display">{activeTab?.filePath || 'Memória Temporária (Não salvo)'}</span>
          {activeTab?.lastSaved && !activeTab.isDirty && <span className="save-indicator">Sincronizado</span>}
          {activeTab?.isDirty && <span className="save-indicator" style={{ color: 'var(--accent-orange)' }}>Modificado</span>}
        </div>

        <div className="toolbar-section">
          <button className="premium-tool-btn danger" onClick={() => handleContentChange('')} title="Limpar Buffer">
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      
      <div className="editor-viewport" style={{ flexGrow: 1, minHeight: 0, position: 'relative' }}>
        <div className="line-numbers-column">
          {(activeTab?.content || '').split('\n').map((_, i) => (
            <div key={i} className="line-number-entry">{i + 1}</div>
          ))}
        </div>
        <textarea
          ref={textareaRef}
          className="editor-premium-textarea"
          value={activeTab?.content || ''}
          onChange={(e) => handleContentChange(e.target.value)}
          spellCheck={false}
          placeholder="Digite seu código ou texto aqui..."
        />
      </div>

      <div className="editor-premium-footer" style={{ flexShrink: 0 }}>
        <div className="footer-item">
          <span className="label">LINHAS</span>
          <span className="value">{(activeTab?.content || '').split('\n').length}</span>
        </div>
        <div className="footer-item">
          <span className="label">CARACTERES</span>
          <span className="value">{(activeTab?.content || '').length}</span>
        </div>
        <div className="footer-item">
          <span className="label">ESTADO</span>
          <span className="value" style={{ color: activeTab?.isDirty ? 'var(--accent-orange)' : 'var(--accent-green)' }}>
            {activeTab?.isDirty ? 'Não salvo' : 'Pronto'}
          </span>
        </div>
      </div>
    </div>
  );
}
