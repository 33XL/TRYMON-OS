import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Globe, ChevronLeft, ChevronRight, RotateCw, ShieldCheck, 
  ExternalLink, RefreshCw, Search, Package, Cpu, MessageSquare, 
  FolderPlus, Info, FileCode, Trash2, Plus, Image as ImageIcon,
  Activity, FileText, X, Star, History, Layout, Sparkles
} from 'lucide-react';
import * as kernel from '../../interface/services/kernelService';
import TrymonLogo from '../../interface/components/TrymonLogo';
import TrymordWebsite from '../websites-trymon/TrymordWebsite';
import TrymonAI from '../websites-trymon/TrymonAI';
import TrymonDocs from '../websites-trymon/TrymonDocs';

interface Tab {
  id: string;
  url: string;
  inputUrl: string;
  title: string;
  isLoading: boolean;
  history: string[];
  historyIndex: number;
}

interface Bookmark {
  title: string;
  url: string;
  icon?: string;
}

interface HistoryItem {
  title: string;
  url: string;
  timestamp: number;
}

export default function BrowserApp({
  initialUrl,
  onTitleChange,
  onOpenNewWindow
}: {
  initialUrl?: string;
  onTitleChange?: (title: string) => void;
  onOpenNewWindow?: (appId: string, initialProps?: any) => void;
} = {}) {
  const startUrl = initialUrl || 'trymon://home';
  const [tabs, setTabs] = useState<Tab[]>([{
    id: crypto.randomUUID(),
    url: startUrl,
    inputUrl: startUrl,
    title: startUrl === 'trymon://home' ? 'Home' : startUrl,
    isLoading: false,
    history: [startUrl],
    historyIndex: 0
  }]);
  const [activeTabId, setActiveTabId] = useState<string>(tabs[0].id);
  const [showSidebar, setShowSidebar] = useState(false);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [fullHistory, setFullHistory] = useState<HistoryItem[]>([]);

  const activeTab = useMemo(() => tabs.find(t => t.id === activeTabId) || tabs[0], [tabs, activeTabId]);

  // Update window title when active tab changes
  useEffect(() => {
    if (activeTab && onTitleChange) {
      onTitleChange(`Navegador - ${activeTab.title || 'Trymon Browser'}`);
    }
  }, [activeTab?.title, onTitleChange]);

  // Recursion Depth Detection (Global to OS)
  const currentLayer = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return parseInt(params.get('layer') || '0', 10);
  }, []);

  // Load Persistence
  useEffect(() => {
    const loadPersistence = () => {
      const bContent = kernel.readFile('/home/trymon/.config/browser/bookmarks.json');
      if (bContent) {
        try {
          setBookmarks(JSON.parse(new TextDecoder().decode(bContent)));
        } catch (e) { console.error("Failed to load bookmarks", e); }
      }

      const hContent = kernel.readFile('/home/trymon/.config/browser/history.json');
      if (hContent) {
        try {
          setFullHistory(JSON.parse(new TextDecoder().decode(hContent)));
        } catch (e) { console.error("Failed to load history", e); }
      }
    };

    if (kernel.isReady()) {
      loadPersistence();
    } else {
      const unsub = kernel.onUpdate((state) => {
        if (state.initialized) {
          loadPersistence();
          unsub();
        }
      });
    }
  }, []);

  const saveBookmarks = (newBookmarks: Bookmark[]) => {
    setBookmarks(newBookmarks);
    kernel.writeFile('/home/trymon/.config/browser/bookmarks.json', JSON.stringify(newBookmarks));
  };

  const saveHistory = (newHistory: HistoryItem[]) => {
    setFullHistory(newHistory);
    kernel.writeFile('/home/trymon/.config/browser/history.json', JSON.stringify(newHistory));
  };

  const addTab = useCallback((url = 'trymon://home') => {
    const newTab: Tab = {
      id: crypto.randomUUID(),
      url: url,
      inputUrl: url,
      title: url === 'trymon://home' ? 'Home' : 'Loading...',
      isLoading: false,
      history: [url],
      historyIndex: 0
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
  }, []);

  const closeTab = useCallback((id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (tabs.length === 1) {
      updateTab(id, { url: 'trymon://home', inputUrl: 'trymon://home', history: ['trymon://home'], historyIndex: 0, title: 'Home' });
      return;
    }
    const filtered = tabs.filter(t => t.id !== id);
    setTabs(filtered);
    if (activeTabId === id) {
      const closingIdx = tabs.findIndex(t => t.id === id);
      const nextTab = filtered[closingIdx] || filtered[filtered.length - 1];
      setActiveTabId(nextTab.id);
    }
  }, [tabs, activeTabId]);

  const updateTab = (id: string, updates: Partial<Tab>) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const navigateTo = useCallback((newUrl: string, addToHistory = true, tabId?: string) => {
    let formattedUrl = newUrl.trim();
    if (!formattedUrl) return;

    const targetId = tabId || activeTabId;
    const looksLikeUrl = formattedUrl.includes('.') && !formattedUrl.includes(' ');
    const isInternal = formattedUrl.startsWith('trymon://');
    const hasProtocol = formattedUrl.startsWith('http://') || formattedUrl.startsWith('https://');

    if (!isInternal && !hasProtocol) {
      if (looksLikeUrl) {
        formattedUrl = `https://${formattedUrl}`;
      } else {
        formattedUrl = `trymon://search?q=${encodeURIComponent(formattedUrl)}`;
      }
    }

    const currentTab = tabs.find(t => t.id === targetId);
    if (!currentTab) return;

    let newHistory = currentTab.history;
    let newIndex = currentTab.historyIndex;

    if (addToHistory) {
      newHistory = currentTab.history.slice(0, currentTab.historyIndex + 1);
      newHistory.push(formattedUrl);
      newIndex = newHistory.length - 1;

      // Update global history
      const historyItem: HistoryItem = {
        title: formattedUrl.replace('trymon://', '').toUpperCase() || formattedUrl,
        url: formattedUrl,
        timestamp: Date.now()
      };
      saveHistory([historyItem, ...fullHistory].slice(0, 50));
    }

    updateTab(targetId, {
      url: formattedUrl,
      inputUrl: formattedUrl,
      history: newHistory,
      historyIndex: newIndex,
      isLoading: true,
      title: formattedUrl.startsWith('trymon://') ? formattedUrl.replace('trymon://', '').toUpperCase() : formattedUrl
    });

    setTimeout(() => {
      updateTab(targetId, { isLoading: false });
    }, 800);
  }, [tabs, activeTabId, fullHistory]);

  const goBack = () => {
    if (activeTab.historyIndex > 0) {
      const prevUrl = activeTab.history[activeTab.historyIndex - 1];
      updateTab(activeTabId, {
        historyIndex: activeTab.historyIndex - 1,
        url: prevUrl,
        inputUrl: prevUrl,
        title: prevUrl.startsWith('trymon://') ? prevUrl.replace('trymon://', '').toUpperCase() : prevUrl
      });
    }
  };

  const goForward = () => {
    if (activeTab.historyIndex < activeTab.history.length - 1) {
      const nextUrl = activeTab.history[activeTab.historyIndex + 1];
      updateTab(activeTabId, {
        historyIndex: activeTab.historyIndex + 1,
        url: nextUrl,
        inputUrl: nextUrl,
        title: nextUrl.startsWith('trymon://') ? nextUrl.replace('trymon://', '').toUpperCase() : nextUrl
      });
    }
  };

  const toggleBookmark = () => {
    const isBookmarked = bookmarks.find(b => b.url === activeTab.url);
    if (isBookmarked) {
      saveBookmarks(bookmarks.filter(b => b.url !== activeTab.url));
    } else {
      saveBookmarks([...bookmarks, { title: activeTab.title, url: activeTab.url }]);
    }
  };

  return (
    <div className="browser-window">
      <div className="browser-tabs">
        {tabs.map(tab => (
          <div 
            key={tab.id} 
            className={`browser-tab ${tab.id === activeTabId ? 'active' : ''}`}
            onClick={() => setActiveTabId(tab.id)}
            title={`${tab.title} (Clique com botão direito para opções)`}
            onContextMenu={(e) => {
              if (onOpenNewWindow) {
                e.preventDefault();
                e.stopPropagation();
                if (window.confirm(`Abrir aba "${tab.title}" em uma nova janela?`)) {
                  onOpenNewWindow('browser', { initialUrl: tab.url });
                }
              }
            }}
          >
            <Globe size={14} />
            <span className="browser-tab-title">{tab.title}</span>
            <button className="browser-tab-close" onClick={(e) => closeTab(tab.id, e)} title="Fechar aba">
              <X size={12} />
            </button>
          </div>
        ))}
        <button className="add-tab-btn" onClick={() => addTab()} title="Nova Aba">
          <Plus size={18} />
        </button>
      </div>

      <div className="browser-toolbar">
        <div className="browser-nav-group">
          <button className="browser-nav-btn" onClick={goBack} disabled={activeTab.historyIndex === 0} title="Voltar">
            <ChevronLeft size={18} />
          </button>
          <button className="browser-nav-btn" onClick={goForward} disabled={activeTab.historyIndex === activeTab.history.length - 1} title="Avançar">
            <ChevronRight size={18} />
          </button>
          <button className="browser-nav-btn" onClick={() => navigateTo(activeTab.url, false)} title="Recarregar">
            <RotateCw size={16} className={activeTab.isLoading ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="browser-address-container">
          <form onSubmit={(e) => { e.preventDefault(); navigateTo(activeTab.inputUrl); }} className="browser-address-bar">
            <div className="browser-security-icon">
              {activeTab.url.startsWith('trymon://') ? <ShieldCheck size={14} color="#00f2ff" /> : <ShieldCheck size={14} />}
            </div>
            <input
              type="text"
              value={activeTab.inputUrl}
              onChange={(e) => updateTab(activeTabId, { inputUrl: e.target.value })}
              onFocus={(e) => e.target.select()}
              placeholder="Pesquisar ou digite URL..."
            />
            <button type="button" className="browser-nav-btn" onClick={toggleBookmark} title="Favoritar">
              <Star size={16} fill={bookmarks.find(b => b.url === activeTab.url) ? "var(--accent-cyan)" : "none"} color={bookmarks.find(b => b.url === activeTab.url) ? "var(--accent-cyan)" : "currentColor"} />
            </button>
            {activeTab.isLoading && <RefreshCw size={12} className="animate-spin text-muted" />}
          </form>
        </div>

        <div className="browser-nav-group">
          {currentLayer > 0 && (
            <div className={`recursion-badge ${currentLayer >= 4 ? 'recursion-warning' : ''}`}>
              <RotateCw size={10} />
              Layer {currentLayer}/5
            </div>
          )}
          <button className="browser-nav-btn" onClick={() => navigateTo('trymon://ai')} title="Resumir com Trymon AI">
            <Sparkles size={18} color="var(--accent-cyan)" />
          </button>
          <button className="browser-nav-btn" onClick={() => setShowSidebar(!showSidebar)} title="Histórico e Favoritos">
            <Layout size={18} />
          </button>
          <button
            className="browser-nav-btn"
            onClick={() => window.open(activeTab.url.startsWith('trymon://') ? 'https://google.com' : activeTab.url, '_blank')}
            title="Abrir Externamente"
          >
            <ExternalLink size={16} />
          </button>
        </div>
      </div>

      <div className="browser-layout">
        <div className={`browser-sidebar ${showSidebar ? '' : 'collapsed'}`}>
          <div className="sidebar-header">
            <h3>Navegação</h3>
            <button className="browser-nav-btn" onClick={() => setShowSidebar(false)}><X size={14} /></button>
          </div>
          <div className="sidebar-content">
            <div style={{ padding: '8px', fontSize: '11px', color: 'var(--accent-cyan)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Star size={12} /> FAVORITOS
            </div>
            {bookmarks.map((b, i) => (
              <div key={i} className="sidebar-item" onClick={() => navigateTo(b.url)}>
                <Star size={14} />
                <div className="sidebar-item-info">
                  <div className="sidebar-item-title">{b.title}</div>
                  <div className="sidebar-item-url">{b.url}</div>
                </div>
              </div>
            ))}
            <div style={{ padding: '8px', fontSize: '11px', color: 'var(--accent-cyan)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px' }}>
              <History size={12} /> HISTÓRICO
            </div>
            {fullHistory.map((h, i) => (
              <div key={i} className="sidebar-item" onClick={() => navigateTo(h.url)}>
                <History size={14} />
                <div className="sidebar-item-info">
                  <div className="sidebar-item-title">{h.title}</div>
                  <div className="sidebar-item-url">{h.url}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="browser-content">
          {tabs.map(tab => (
            <div 
              key={tab.id} 
              className={`tab-viewport ${tab.id === activeTabId ? 'active' : ''}`}
            >
              {tab.isLoading && (
                <div className="loading-bar-container">
                  <div className={`loading-bar active`} style={{ width: '100%' }} />
                </div>
              )}
              <TabRenderer 
                tab={tab} 
                navigateTo={(url: string, hist?: boolean) => navigateTo(url, hist, tab.id)} 
                currentLayer={currentLayer}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TabRenderer({ tab, navigateTo, currentLayer }: { tab: Tab, navigateTo: any, currentLayer: number }) {
  const url = tab.url;

  if (url === 'trymon://home') {
    return <BrowserHomepage navigateTo={navigateTo} currentLayer={currentLayer} />;
  }
  
  if (url.startsWith('trymon://search')) {
    return <TrymonSERP url={url} navigateTo={navigateTo} />;
  }

  if (url === 'trymon://ai') return <TrymonAI />;
  if (url === 'trymon://docs') return <TrymonDocs />;
  if (url === 'trymon://trymord') return <TrymordWebsite />;

  if (url.startsWith('trymon://')) {
    const siteName = url.replace('trymon://', '').split('?')[0];
    const filePath = `/www/${siteName}/index.json`;
    const content = kernel.readFile(filePath);
    if (content) {
      try {
        const json = JSON.parse(new TextDecoder().decode(content));
        return <VirtualSiteRenderer navigateTo={navigateTo} data={json} />;
      } catch (e) { return <div>Error: Invalid Site JSON</div>; }
    }
  }

  return (
    <iframe
      src={url}
      className="browser-iframe"
      title={`Browser Tab ${tab.id}`}
      sandbox="allow-scripts allow-same-origin allow-forms"
    />
  );
}

function BrowserHomepage({ navigateTo, currentLayer }: { navigateTo: (url: string) => void, currentLayer: number }) {
  const [query, setQuery] = useState('');
  
  const handleRecursiveNav = (url: string) => {
    if (url.includes('trymon-os.vercel.app')) {
      if (currentLayer >= 5) {
        alert("CRITICAL ERROR: Maximum recursion depth reached (5/5). System stability at risk. Future layers blocked.");
        return;
      }
      const nextLayer = currentLayer + 1;
      const recursiveUrl = `${url}?layer=${nextLayer}`;
      navigateTo(recursiveUrl);
    } else {
      navigateTo(url);
    }
  };

  return (
    <div className="browser-homepage">
      <div className="hp-logo">
        <TrymonLogo size={64} glow={true} />
        <h1>TRYMON SEARCH</h1>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); navigateTo(query); }} className="hp-search">
        <div className="browser-address-bar" style={{ padding: '12px 24px', borderRadius: '30px' }}>
          <Search size={20} className="text-muted" />
          <input
            type="text"
            placeholder="Pesquisar websites trymon:// ou URLs externas..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ fontSize: '16px' }}
          />
        </div>
      </form>

      <div className="hp-shortcuts">
        {[
          { name: 'Trymon Store', url: 'trymon://store', icon: <Package size={24} color="#00f2ff" />, premium: true },
          { name: 'Trymon AI', url: 'trymon://ai', icon: <Cpu size={24} color="#00f2ff" />, premium: true },
          { name: 'Trymord', url: 'trymon://trymord', icon: <MessageSquare size={24} color="#5865f2" />, premium: true },
          { name: 'Trymon Cloud', url: 'trymon://cloud', icon: <FolderPlus size={24} color="#ffa657" />, premium: true },
          { name: 'Trymon News', url: 'trymon://social', icon: <Activity size={24} color="#7ee787" />, premium: true },
          { name: 'Trymon Docs', url: 'trymon://docs', icon: <Info size={24} />, premium: true },
          { name: 'Trymon OS', url: 'https://trymon-os.vercel.app/', icon: <RotateCw size={24} color="#00f2ff" />, premium: true },
        ].map((sc, i) => (
          <div key={i} className={`hp-shortcut ${sc.premium ? 'premium-border' : ''}`} onClick={() => handleRecursiveNav(sc.url)}>
            <div className="hp-shortcut-icon">{sc.icon}</div>
            <span>{sc.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function VirtualSiteRenderer({ data, navigateTo }: { data: any, navigateTo: any }) {
  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'FileCode': return <FileCode size={20} />;
      case 'Image': return <ImageIcon size={20} />;
      case 'Activity': return <Activity size={20} />;
      case 'Trash2': return <Trash2 size={20} />;
      case 'Cpu': return <Cpu size={20} />;
      case 'ShieldCheck': return <ShieldCheck size={20} />;
      case 'Package': return <Package size={20} />;
      case 'FileText': return <FileText size={20} />;
      default: return <Globe size={20} />;
    }
  };

  return (
    <div className="vsite-container">
      <header className="vsite-header" style={{ background: `linear-gradient(180deg, ${data.theme}1a 0%, transparent 100%)` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <Sparkles size={24} color={data.theme} />
          <h1 style={{ margin: 0 }}>{data.title}</h1>
        </div>
        <p>{data.hero}</p>
      </header>
      <div className="vsite-content">
        {data.sections.map((section: any, i: number) => (
          <div key={i} className="vsite-section">
            <h2 className="vsite-section-title">{section.title}</h2>
            <div className="vsite-grid">
              {section.items.map((item: any, j: number) => (
                <div key={j} className="vsite-card" onClick={() => item.action === 'Run' ? navigateTo('trymon://docs') : null}>
                  <div className="vsite-card-icon">{getIcon(item.icon)}</div>
                  <h3>{item.name}</h3>
                  <p>{item.desc}</p>
                  {item.action && (
                    <div className="vsite-card-action">
                      <Plus size={14} />
                      <span>{item.action} Now</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrymonSERP({ url, navigateTo }: { url: string; navigateTo: any }) {
  const query = new URLSearchParams(url.split('?')[1]).get('q') || '';

  const results = [
    {
      title: 'Trymon Platform (Recursive)',
      url: 'https://trymon-os.vercel.app/',
      desc: 'Acesse a instância web oficial do Trymon Engine. Perfeito para testes de recursividade e instâncias aninhadas.',
      internal: true
    },
    {
      title: 'Trymon Intelligence AI',
      url: 'trymon://ai',
      desc: 'O assistente oficial do Trymon OS. Potente, rápido e integrado diretamente ao kernel Rust.',
      internal: true
    },
    {
      title: 'Global Application Store',
      url: 'trymon://store',
      desc: 'Explore e instale pacotes binários verificados para o ambiente Trymon.',
      internal: true
    },
    {
      title: 'Documentação Técnica Trymon',
      url: 'trymon://docs',
      desc: 'Guia completo para desenvolvedores, binários e formatos de arquivos especializados do sistema.',
      internal: true
    },
    {
      title: `Web results for: ${query}`,
      url: `https://www.bing.com/search?q=${query}`,
      desc: `Visualizando resultados externos para "${query}" via Trymon Engine Bridge.`,
      external: true
    }
  ];

  return (
    <div className="serp-container">
      <div className="serp-header">
        <h2>Resultados para: {query}</h2>
      </div>
      <div className="serp-results">
        {results.map((res, i) => (
          <div key={i} className="serp-item" style={{ animationDelay: `${i * 0.1}s` }}>
            <span className="url">{res.url}</span>
            <div className="title" onClick={() => navigateTo(res.url)}>
              {res.internal && <span className="serp-badge">TRYMON NATIVE</span>}
              {res.title}
            </div>
            <p className="desc">{res.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
