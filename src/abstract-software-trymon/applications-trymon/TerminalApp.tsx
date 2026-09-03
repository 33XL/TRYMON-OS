import { useState, useCallback, useEffect, useRef } from 'react';
import { Terminal as TerminalIcon, X, Plus } from 'lucide-react';
import { TerminalComponent } from '../../interface/components/TerminalComponent';
import { useKernelState } from '../../interface/hooks/useKernelState';
import * as kernel from '../../interface/services/kernelService';

interface TerminalTab {
  id: string;
  title: string;
  output: string;
  history: string[];
}

export default function TerminalApp({ 
  userName,
  onTitleChange,
  onCloseWindow
}: { 
  userName: string;
  onTitleChange?: (title: string) => void;
  onCloseWindow?: () => void;
}) {
  const { ready } = useKernelState();

  const createNewTab = useCallback((customTitle?: string): TerminalTab => {
    const prompt = kernel.getShellPrompt();
    return {
      id: crypto.randomUUID(),
      title: customTitle || 'bash',
      output: prompt,
      history: []
    };
  }, []);

  const [tabs, setTabs] = useState<TerminalTab[]>(() => [createNewTab('bash #1')]);
  const [activeTabId, setActiveTabId] = useState<string>(() => tabs[0]?.id || '');
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const tabCounterRef = useRef(1);

  // Set active tab ID initially if empty
  useEffect(() => {
    if (!activeTabId && tabs.length > 0) {
      setActiveTabId(tabs[0].id);
    }
  }, [tabs, activeTabId]);

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];

  // Update window title when active tab changes
  useEffect(() => {
    if (activeTab && onTitleChange) {
      onTitleChange(`Terminal - ${activeTab.title}`);
    }
  }, [activeTab?.title, onTitleChange]);

  const handleAddTab = useCallback(() => {
    tabCounterRef.current += 1;
    const newTab = createNewTab(`bash #${tabCounterRef.current}`);
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
  }, [createNewTab]);

  const handleCloseTab = useCallback((tabId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    
    setTabs(prev => {
      if (prev.length <= 1) {
        if (onCloseWindow) {
          onCloseWindow();
          return prev;
        }
        // Reset the single tab if cannot close window
        tabCounterRef.current = 1;
        const resetTab = createNewTab('bash #1');
        setActiveTabId(resetTab.id);
        return [resetTab];
      }

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
  }, [activeTabId, createNewTab, onCloseWindow]);

  const handleInput = useCallback((data: string) => {
    if (!activeTab) return;

    const trimmed = data.trim();

    // Command Interceptors
    if (trimmed === 'clear') {
      const prompt = kernel.getShellPrompt();
      setTabs(prev => prev.map(t => t.id === activeTab.id ? { ...t, output: prompt } : t));
      return;
    }

    if (trimmed === 'exit') {
      handleCloseTab(activeTab.id);
      return;
    }

    if (trimmed.startsWith('trym')) {
      const args = trimmed.split(' ').slice(1);
      const command = args[0];

      if (!command || command === 'help') {
        const help = `\r\n\x1b[1;33mTRYMON Package Manager (trym)\x1b[0m\r\n` +
          `Usage: trym <command> [arguments]\r\n\r\n` +
          `Commands:\r\n` +
          `  \x1b[1;32mlist\x1b[0m           List installed applications\r\n` +
          `  \x1b[1;32msearch <term>\x1b[0m  Search for packages in the repository\r\n` +
          `  \x1b[1;32minstall <id>\x1b[0m   Install a package by ID\r\n` +
          `  \x1b[1;32muninstall <id>\x1b[0m Remove an installed package\r\n` +
          `  \x1b[1;32mupdate\x1b[0m         Update the package database\r\n\r\n`;
        
        setTabs(prev => prev.map(t => 
          t.id === activeTab.id ? { ...t, output: t.output + help + kernel.getShellPrompt() } : t
        ));
        return;
      }

      if (command === 'list') {
        const apps = kernel.listTrymonApps();
        let listOut = `\r\n\x1b[1;33mInstalled Applications:\x1b[0m\r\n`;
        if (apps.length === 0) {
          listOut += `No applications installed via trym.\r\n`;
        } else {
          apps.forEach(app => {
            listOut += ` \x1b[1;32m●\x1b[0m \x1b[1m${app.name || app.id}\x1b[0m (v${app.version || '1.0.0'})\r\n`;
          });
        }
        setTabs(prev => prev.map(t => 
          t.id === activeTab.id ? { ...t, output: t.output + listOut + '\r\n' + kernel.getShellPrompt() } : t
        ));
        return;
      }

      if (command === 'search') {
        const term = args[1];
        if (!term) {
          setTabs(prev => prev.map(t => 
            t.id === activeTab.id ? { ...t, output: t.output + `\r\ntrym: missing search term\r\n` + kernel.getShellPrompt() } : t
          ));
          return;
        }
        const results = kernel.searchRepository(term);
        let searchOut = `\r\n\x1b[1;34mSearching for "${term}"...\x1b[0m\r\n`;
        if (results.length === 0) {
          searchOut += `No packages found matching "${term}".\r\n`;
        } else {
          results.forEach(item => {
            searchOut += ` \x1b[1;32m➜\x1b[0m \x1b[1m${item.id}\x1b[0m: ${item.name} - ${item.desc}\r\n`;
          });
        }
        setTabs(prev => prev.map(t => 
          t.id === activeTab.id ? { ...t, output: t.output + searchOut + '\r\n' + kernel.getShellPrompt() } : t
        ));
        return;
      }

      if (command === 'install') {
        const appId = args[1];
        if (!appId) {
          setTabs(prev => prev.map(t => 
            t.id === activeTab.id ? { ...t, output: t.output + `\r\ntrym: missing package ID\r\n` + kernel.getShellPrompt() } : t
          ));
          return;
        }
        
        const targetTabId = activeTab.id;
        setTabs(prev => prev.map(t => 
          t.id === targetTabId ? { ...t, output: t.output + `\r\n\x1b[1mInstalling ${appId}...\x1b[0m\r\nReading dependencies...\r\n` } : t
        ));
        
        setTimeout(() => {
          const result = kernel.installTrymonApp(appId);
          setTabs(prev => prev.map(t => {
            if (t.id !== targetTabId) return t;
            if (result) {
              return { ...t, output: t.output + `\x1b[1;34m[##########]\x1b[0m 100% - Unpacking\r\n\x1b[1;32mSUCCESS:\x1b[0m ${appId} installed successfully.\r\n\r\n` + kernel.getShellPrompt() };
            } else {
              return { ...t, output: t.output + `\x1b[1;31mERROR:\x1b[0m Package "${appId}" not found or installation failed.\r\n\r\n` + kernel.getShellPrompt() };
            }
          }));
        }, 1000);
        return;
      }
    }

    // Execute standard shell input via kernel
    const result = kernel.shellInput(data);
    setTabs(prev => prev.map(t => {
      if (t.id === activeTab.id) {
        return {
          ...t,
          output: t.output + (result || '')
        };
      }
      return t;
    }));
  }, [activeTab, handleCloseTab]);

  const handleStartRename = (tab: TerminalTab, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTabId(tab.id);
    setEditingTitle(tab.title);
  };

  const handleFinishRename = (tabId: string) => {
    if (editingTitle.trim()) {
      setTabs(prev => prev.map(t => t.id === tabId ? { ...t, title: editingTitle.trim() } : t));
    }
    setEditingTabId(null);
  };

  // Keyboard shortcut for new tab (Ctrl+Shift+T or Ctrl+T) and close tab (Ctrl+W)
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 't') {
      e.preventDefault();
      handleAddTab();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'w') {
      e.preventDefault();
      if (activeTab) handleCloseTab(activeTab.id);
    }
  }, [handleAddTab, handleCloseTab, activeTab]);

  return (
    <div 
      className="terminal-window" 
      style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0d1117' }}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div className="terminal-tabs" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', background: 'rgba(22, 27, 34, 0.95)', borderBottom: '1px solid rgba(48, 54, 61, 0.6)', padding: '4px 8px 0', gap: '4px' }}>
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const isEditing = tab.id === editingTabId;

          return (
            <div
              key={tab.id}
              className={`terminal-tab ${isActive ? 'active' : ''}`}
              onClick={() => setActiveTabId(tab.id)}
              onDoubleClick={(e) => handleStartRename(tab, e)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 10px',
                borderRadius: '6px 6px 0 0',
                background: isActive ? '#0d1117' : 'rgba(30, 35, 45, 0.4)',
                border: isActive ? '1px solid rgba(48, 54, 61, 0.8)' : '1px solid transparent',
                borderBottom: isActive ? '1px solid #0d1117' : 'none',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '12px',
                userSelect: 'none',
                transition: 'all 0.15s ease',
                position: 'relative',
                zIndex: isActive ? 2 : 1,
                minWidth: '100px',
                maxWidth: '180px'
              }}
              title="Clique para alternar. Duplo clique para renomear."
            >
              <TerminalIcon size={13} style={{ color: isActive ? 'var(--accent-cyan)' : 'var(--text-muted)' }} />
              
              {isEditing ? (
                <input
                  type="text"
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onBlur={() => handleFinishRename(tab.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleFinishRename(tab.id);
                    if (e.key === 'Escape') setEditingTabId(null);
                  }}
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    background: '#161b22',
                    border: '1px solid var(--accent-cyan)',
                    color: '#fff',
                    borderRadius: '3px',
                    padding: '1px 4px',
                    fontSize: '11px',
                    width: '70px',
                    outline: 'none'
                  }}
                />
              ) : (
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {tab.title}
                </span>
              )}

              <button
                className="tab-close"
                onClick={(e) => handleCloseTab(tab.id, e)}
                title="Fechar aba (Ctrl+W)"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '2px',
                  borderRadius: '3px',
                  display: 'flex',
                  alignItems: 'center',
                  opacity: 0.7,
                  transition: 'opacity 0.15s'
                }}
              >
                <X size={11} />
              </button>
            </div>
          );
        })}

        <button
          className="terminal-tab-add"
          onClick={handleAddTab}
          title="Nova Aba de Terminal (Ctrl+Shift+T)"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '5px 8px',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s'
          }}
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="terminal-content" style={{ flexGrow: 1, position: 'relative', overflow: 'hidden' }}>
        {activeTab && (
          <TerminalComponent 
            key={activeTab.id}
            onInput={handleInput} 
            output={activeTab.output} 
            isRunning={ready}
            userName={userName}
          />
        )}
      </div>
    </div>
  );
}
