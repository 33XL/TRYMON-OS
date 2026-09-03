/**
 * Main Application Component
 * Trymon OS - Desktop Interface
 * 
 * KERNEL-FIRST ARCHITECTURE:
 * The kernel initializes BEFORE this component mounts (see main.tsx).
 * This component is purely a view layer on top of kernel state.
 * 
 * MULTI-INSTANCE & MULTI-TAB ARCHITECTURE:
 * Supports opening multiple window instances and multiple in-app tabs,
 * each with completely isolated state and dynamic title synchronization.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import BrowserApp from '../abstract-software-trymon/applications-trymon/BrowserApp';
import TerminalApp from '../abstract-software-trymon/applications-trymon/TerminalApp';
import FilesApp from '../abstract-software-trymon/applications-trymon/FilesApp';
import BinariesApp from '../abstract-software-trymon/applications-trymon/BinariesApp';
import SettingsApp from '../abstract-software-trymon/applications-trymon/SettingsApp';
import MonitorApp from '../abstract-software-trymon/applications-trymon/MonitorApp';
import TrashApp from '../abstract-software-trymon/applications-trymon/TrashApp';
import SyncApp from '../abstract-software-trymon/applications-trymon/SyncApp';
import EditorApp from '../abstract-software-trymon/applications-trymon/EditorApp';
import { TrymonAppRunner } from '../abstract-software-trymon/applications-trymon/TrymonAppRunner';
import { IdeApp } from '../abstract-software-trymon/applications-trymon/IdeApp';
import { useEmulator } from './hooks/useEmulator';
import { useKernelState, useKernelBinaries, useTrymonApps } from './hooks/useKernelState';
import { ContextMenu, ContextMenuItem } from './components/ContextMenu';
import { SystemClock, VolumeControl, NotificationCenter, ToastContainer, useNotifications } from './components/SystemComponents';
import TrymonLogo from './components/TrymonLogo';
import BootScreen from './components/BootScreen';
import { useSync } from './hooks/useSync';
import { RemoteCursor } from './components/RemoteCursor';

import { saveConfig, loadConfig } from './services/persistence';
import { getTrashCount } from './services/trashService';
import * as kernel from './services/kernelService';
import { Globe, Terminal, FolderOpen, Settings, Activity, FileCode, X, Minus, Square, Maximize2, Trash2, Plus, RefreshCw, Info, Image as ImageIcon, Search, Power, User, Package, FileText, FolderPlus, ChevronRight, Share2, Edit3, ExternalLink, Code } from 'lucide-react';

interface WindowPosition {
  x: number;
  y: number;
}

interface WindowSize {
  width: number;
  height: number;
}

interface Window {
  id: string;
  appId: string;
  title: string;
  icon: React.ReactNode;
  content: React.ReactNode;
  isMinimized: boolean;
  isMaximized: boolean;
  position: WindowPosition;
  size: WindowSize;
  zIndex: number;
  minSize: WindowSize;
  resizable: boolean;
}

interface DesktopIcon {
  id: string;
  label: string;
  icon: any;
  onClick: () => void;
  x: number;
  y: number;
  badge?: number;
  path?: string; // VFS path for files
  isEditing?: boolean;
}

export default function App() {
  const [windows, setWindows] = useState<Window[]>([]);
  const [activeWindowId, setActiveWindowId] = useState<string | null>(null);
  const [startMenuOpen, setStartMenuOpen] = useState(false);

  // Kernel state — single source of truth
  const kernelState = useKernelState();
  const binaries = useKernelBinaries();
  const trymonApps = useTrymonApps();

  // Sync state
  const { remoteCursors, broadcast, onEvent, sendTo } = useSync();

  // Notifications & UI
  const {
    notifications,
    removeNotification,
    clearAll: clearNotifications
  } = useNotifications();
  const [wallpaper, setWallpaper] = useState(
    loadConfig<string>('wallpaper') ||
    'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)'
  );
  const wallpaperInputRef = useRef<HTMLInputElement>(null);

  const handleWallpaperChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        const wallpaperValue = `url(${result}) center/cover no-repeat`;
        setWallpaper(wallpaperValue);
        saveConfig('wallpaper', wallpaperValue);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const [draggingWindow, setDraggingWindow] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizingWindow, setResizingWindow] = useState<{ id: string; direction: string } | null>(null);
  const [resizeStart, setResizeStart] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null);
  const [selection, setSelection] = useState<{ active: boolean; startX: number; startY: number; endX: number; endY: number } | null>(null);
  const [selectedIconIds, setSelectedIconIds] = useState<string[]>([]);
  const [draggingIconId, setDraggingIconId] = useState<string | null>(null);
  const [iconDragOffset, setIconDragOffset] = useState({ x: 0, y: 0 });
  const iconDraggedRef = useRef(false);

  const desktopRef = useRef<HTMLDivElement>(null);

  // Emulator state for UI indicators only (v86 terminal - optional)
  const emulatorHook = useEmulator({});
  const emulatorState = emulatorHook.state;

  const [userName, setUserName] = useState<string>(
    loadConfig<string>('username') || 'trymon'
  );

  const handleUserNameChange = useCallback((name: string) => {
    setUserName(name);
    saveConfig('username', name);
  }, []);

  // Cursor broadcasting
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      // Throttle broadcast to ~30fps
      if (Date.now() % 3 === 0) {
        broadcast('cursor', { x: e.clientX, y: e.clientY });
      }
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    return () => window.removeEventListener('mousemove', handleGlobalMouseMove);
  }, [broadcast]);

  const [searchQuery, setSearchQuery] = useState('');

  // Binary delete — delegates to kernel
  const handleDelete = useCallback((binaryId: string) => {
    binaries.removeBinary(binaryId);
    setTimeout(() => kernel.saveVFSState(), 100);
  }, [binaries]);

  // Desktop icons state
  const [icons, setIcons] = useState<DesktopIcon[]>([]);
  const [trashCount, setTrashCount] = useState(0);

  // Initialize Standard Filesystem for User
  useEffect(() => {
    if (kernelState.initialized) {
      kernel.ensureUserHome(userName);
    }
  }, [kernelState.initialized, userName]);

  // Refresh trash count periodically
  useEffect(() => {
    const refreshTrash = async () => {
      try {
        const count = await getTrashCount();
        setTrashCount(count);
      } catch { }
    };
    refreshTrash();
    const interval = setInterval(refreshTrash, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, items: ContextMenuItem[]) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, items });
  }, []);

  const bringToFront = useCallback((id: string, options: { broadcast?: boolean } = { broadcast: true }) => {
    setActiveWindowId(id);
    setWindows(prev => {
      const maxZ = Math.max(...prev.map(w => w.zIndex), 500);
      return prev.map(w => w.id === id ? { ...w, zIndex: maxZ + 1 } : w);
    });
    if (options.broadcast) {
      broadcast('window_action', { action: 'focus', id });
    }
  }, [broadcast]);

  const closeWindow = useCallback((id: string, options: { broadcast?: boolean } = { broadcast: true }) => {
    setWindows(prev => prev.filter(w => w.id !== id));
    if (activeWindowId === id) {
      const remaining = windows.filter(w => w.id !== id);
      if (remaining.length > 0) {
        setActiveWindowId(remaining[remaining.length - 1].id);
      } else {
        setActiveWindowId(null);
      }
    }
    if (options.broadcast) {
      broadcast('window_action', { action: 'close', id });
    }
  }, [activeWindowId, windows, broadcast]);

  const closeAllWindowsOfApp = useCallback((appId: string) => {
    setWindows(prev => prev.filter(w => w.appId !== appId));
    if (activeWindowId) {
      const remaining = windows.filter(w => w.appId !== appId);
      setActiveWindowId(remaining.length > 0 ? remaining[remaining.length - 1].id : null);
    }
  }, [windows, activeWindowId]);

  // Dynamic window title updater
  const updateWindowTitle = useCallback((instanceId: string, newTitle: string) => {
    setWindows(prev => prev.map(w => w.id === instanceId ? { ...w, title: newTitle } : w));
  }, []);

  const AppMetadata: Record<string, { title: string; icon: any }> = {
    'terminal': { title: 'Terminal', icon: <Terminal size={16} /> },
    'files': { title: 'Gerenciador de Arquivos', icon: <FolderOpen size={16} /> },
    'binaries': { title: 'Gerenciador de Binários', icon: <FileCode size={16} /> },
    'settings': { title: 'Configurações do Sistema', icon: <Settings size={16} /> },
    'monitor': { title: 'Monitor do Sistema', icon: <Activity size={16} /> },
    'browser': { title: 'Trymon Browser', icon: <Globe size={16} /> },
    'trash': { title: 'Lixeira', icon: <Trash2 size={16} /> },
    'sync': { title: 'Sessão Remota', icon: <Share2 size={16} /> },
    'editor': { title: 'Editor de Texto', icon: <FileText size={16} /> },
    'ide': { title: 'Trymon Studio', icon: <Code size={16} /> },
    'trymon-runner': { title: 'Trymon Engine', icon: <Package size={16} /> }
  };

  const openApp = useCallback((appId: string, options: { newInstance?: boolean; initialProps?: any; broadcast?: boolean } = {}) => {
    const { newInstance = false, initialProps = {}, broadcast: shouldBroadcast = true } = options;

    // If not requesting a new instance, focus existing instance of this app if available
    if (!newInstance) {
      const existing = windows.find(w => w.appId === appId);
      if (existing) {
        if (existing.isMinimized) {
          setWindows(prev => prev.map(w => w.id === existing.id ? { ...w, isMinimized: false } : w));
        }
        setActiveWindowId(existing.id);
        bringToFront(existing.id, { broadcast: shouldBroadcast });
        return;
      }
    }

    const meta = AppMetadata[appId] || { title: appId, icon: <Package size={16} /> };
    const instanceId = `${appId}-${crypto.randomUUID().slice(0, 8)}`;
    
    // Create unique content for this instance
    let content: React.ReactNode = null;
    if (appId === 'terminal') {
      content = (
        <TerminalApp 
          userName={userName} 
          onTitleChange={(title) => updateWindowTitle(instanceId, title)}
          onCloseWindow={() => closeWindow(instanceId)}
        />
      );
    } else if (appId === 'files') {
      content = (
        <FilesApp 
          userName={userName} 
          initialPath={initialProps?.initialPath}
          onContextMenu={handleContextMenu} 
          onOpenFile={openFileInApp} 
          onTitleChange={(title) => updateWindowTitle(instanceId, title)}
          onOpenNewWindow={(newAppId, props) => openApp(newAppId, { newInstance: true, initialProps: props })}
        />
      );
    } else if (appId === 'editor') {
      content = (
        <EditorApp 
          filePath={initialProps?.filePath || ''} 
          onTitleChange={(title) => updateWindowTitle(instanceId, title)}
          onCloseWindow={() => closeWindow(instanceId)}
        />
      );
    } else if (appId === 'browser') {
      content = (
        <BrowserApp 
          initialUrl={initialProps?.initialUrl}
          onTitleChange={(title) => updateWindowTitle(instanceId, title)}
          onOpenNewWindow={(newAppId, props) => openApp(newAppId, { newInstance: true, initialProps: props })}
        />
      );
    } else if (appId === 'binaries') {
      content = <BinariesApp onDelete={handleDelete} onContextMenu={handleContextMenu} />;
    } else if (appId === 'settings') {
      content = <SettingsApp userName={userName} onUserNameChange={handleUserNameChange} />;
    } else if (appId === 'monitor') {
      content = <MonitorApp emulatorState={emulatorState} />;
    } else if (appId === 'trash') {
      content = <TrashApp />;
    } else if (appId === 'sync') {
      content = <SyncApp />;
    } else if (appId === 'ide') {
      content = (
        <IdeApp 
          onTitleChange={(title) => updateWindowTitle(instanceId, title)}
          onCloseWindow={() => closeWindow(instanceId)}
        />
      );
    } else if (appId === 'trymon-runner') {
      content = (
        <TrymonAppRunner 
          filePath={initialProps?.filePath || ''}
          onTitleChange={(title) => updateWindowTitle(instanceId, title)}
          onCloseWindow={() => closeWindow(instanceId)}
        />
      );
    }

    const offset = (windows.length % 8) * 30;
    const newWindow: Window = {
      id: instanceId,
      appId,
      title: meta.title,
      icon: meta.icon,
      content,
      isMinimized: false,
      isMaximized: false,
      position: { x: 80 + offset, y: 60 + offset },
      size: { width: 900, height: 600 },
      zIndex: 500 + windows.length,
      minSize: { width: 420, height: 300 },
      resizable: true
    };

    setWindows(prev => [...prev, newWindow]);
    setActiveWindowId(instanceId);

    if (shouldBroadcast) {
      broadcast('window_action', { action: 'open', id: instanceId, appId });
    }
  }, [windows, userName, emulatorState, broadcast, bringToFront, handleDelete, handleContextMenu, updateWindowTitle, closeWindow, handleUserNameChange]);

  const openEditor = useCallback((path: string, options: { newInstance?: boolean } = {}) => {
    openApp('editor', {
      newInstance: options.newInstance ?? true,
      initialProps: { filePath: path }
    });
  }, [openApp]);

  const openFileInApp = useCallback((path: string) => {
    const fileName = path.split('/').pop() || '';
    const ext = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() : '';
    
    if (ext === 'trymon') {
      openApp('trymon-runner', { newInstance: true, initialProps: { filePath: path } });
    } else if (ext === 'txt' || ext === 'md' || ext === 'sh' || ext === 'json' || ext === 'js' || ext === 'ts' || ext === 'css' || ext === 'html') {
      openEditor(path);
    } else {
      console.log('Opening with default (FilesApp):', fileName);
      openApp('files');
    }
  }, [openApp, openEditor]);

  const handleCreateNewFile = useCallback(async (extension: string, targetX?: number, targetY?: number) => {
    const defaultName = `novo_arquivo${extension}`;
    const desktopPath = `/home/trymon/Desktop/${defaultName}`;

    console.log(`Creating file: ${desktopPath}`);
    kernel.createFile(desktopPath);
    
    const GRID_X = 100;
    const GRID_Y = 110;
    const MARGIN = 20;

    const startX = targetX !== undefined ? 
      Math.max(MARGIN, Math.round((targetX - MARGIN - 40) / GRID_X) * GRID_X + MARGIN) : MARGIN;
    const startY = targetY !== undefined ? 
      Math.max(MARGIN, Math.round((targetY - MARGIN - 40) / GRID_Y) * GRID_Y + MARGIN) : MARGIN;

    const newIcon: DesktopIcon = {
      id: `file-${crypto.randomUUID()}`,
      label: defaultName,
      icon: extension === '.txt' ? <FileText size={32} /> :
        extension === '.md' ? <FileText size={32} color="#0070f3" /> :
          extension === '.trymon' ? <Package size={32} color="#00f2ff" /> :
            <FileCode size={32} />,
      onClick: () => openFileInApp(desktopPath),
      x: startX,
      y: startY,
      path: desktopPath,
      isEditing: true
    };
    setIcons(prev => [...prev, newIcon]);
    kernel.saveVFSState();
  }, [openFileInApp]);

  const handleCreateNewFolder = useCallback(async (targetX?: number, targetY?: number) => {
    const defaultName = 'Nova Pasta';
    const folderPath = `/home/trymon/Desktop/${defaultName}`;
    console.log(`Creating folder: ${folderPath}`);
    kernel.createDirectory(folderPath);
    
    const GRID_X = 100;
    const GRID_Y = 110;
    const MARGIN = 20;

    const startX = targetX !== undefined ? 
      Math.max(MARGIN, Math.round((targetX - MARGIN - 40) / GRID_X) * GRID_X + MARGIN) : MARGIN;
    const startY = targetY !== undefined ? 
      Math.max(MARGIN, Math.round((targetY - MARGIN - 40) / GRID_Y) * GRID_Y + MARGIN) : MARGIN;

    const newIcon: DesktopIcon = {
      id: `folder-${crypto.randomUUID()}`,
      label: defaultName,
      icon: <FolderOpen size={32} />,
      onClick: () => openApp('files', { newInstance: true, initialProps: { initialPath: folderPath } }),
      x: startX,
      y: startY,
      path: folderPath,
      isEditing: true
    };
    setIcons(prev => [...prev, newIcon]);
    kernel.saveVFSState();
  }, [openApp]);

  const handleRenameIcon = useCallback((id: string, newName: string) => {
    setIcons(prev => {
      const icon = prev.find(i => i.id === id);
      if (!icon || !icon.path || !newName || newName === icon.label) {
        return prev.map(i => i.id === id ? { ...i, isEditing: false } : i);
      }

      const parentDir = icon.path.split('/').slice(0, -1).join('/') || '/';
      const newPath = parentDir === '/' ? `/${newName}` : `${parentDir}/${newName}`;

      try {
        kernel.renamePath(icon.path, newPath);
        return prev.map(i => i.id === id ? { ...i, label: newName, path: newPath, isEditing: false } : i);
      } catch (e) {
        console.error('Rename failed:', e);
        return prev.map(i => i.id === id ? { ...i, isEditing: false } : i);
      }
    });
  }, []);

  const minimizeWindow = useCallback((id: string) => {
    setWindows(prev => prev.map(w => w.id === id ? { ...w, isMinimized: true } : w));
    if (activeWindowId === id) {
      const visible = windows.filter(w => !w.isMinimized && w.id !== id);
      if (visible.length > 0) {
        setActiveWindowId(visible[visible.length - 1].id);
      } else {
        setActiveWindowId(null);
      }
    }
  }, [activeWindowId, windows]);

  // Desktop icons — derived from kernel state + base system tools
  const getBaseIcons = useCallback(() => {
    const GRID_X = 100;
    const GRID_Y = 110;
    const MARGIN = 20;
    const icons: DesktopIcon[] = [
      { id: 'terminal', label: 'Terminal', icon: <Terminal size={32} />, onClick: () => openApp('terminal'), x: MARGIN, y: MARGIN },
      { id: 'trash', label: 'Lixeira', icon: <Trash2 size={32} />, badge: trashCount > 0 ? trashCount : undefined, onClick: () => openApp('trash'), x: MARGIN + GRID_X, y: MARGIN },
      { id: 'binaries', label: 'Binários', icon: <FileCode size={32} />, onClick: () => openApp('binaries'), x: MARGIN + GRID_X * 2, y: MARGIN },
      { id: 'monitor', label: 'Monitor', icon: <Activity size={32} />, onClick: () => openApp('monitor'), x: MARGIN + GRID_X * 3, y: MARGIN },
      { id: 'files', label: 'Arquivos', icon: <FolderOpen size={32} />, onClick: () => openApp('files'), x: MARGIN, y: MARGIN + GRID_Y },
      { id: 'browser', label: 'Navegador', icon: <Globe size={32} />, onClick: () => openApp('browser'), x: MARGIN + GRID_X, y: MARGIN + GRID_Y },
      { id: 'sync', label: 'Sessão Remota', icon: <Share2 size={32} />, onClick: () => openApp('sync'), x: MARGIN + GRID_X * 2, y: MARGIN + GRID_Y },
      { id: 'settings', label: 'Configurações', icon: <Settings size={32} />, onClick: () => openApp('settings'), x: MARGIN + GRID_X * 3, y: MARGIN + GRID_Y },
      { id: 'editor', label: 'Editor', icon: <FileText size={32} />, onClick: () => openApp('editor'), x: MARGIN, y: MARGIN + GRID_Y * 2 },
      { id: 'ide', label: 'Trymon Studio IDE', icon: <Code size={32} />, onClick: () => openApp('ide'), x: MARGIN + GRID_X, y: MARGIN + GRID_Y * 2 }
    ];

    // Add installed Trymon apps as desktop icons
    const apps = trymonApps.apps;
    apps.forEach((app, index) => {
      icons.push({
        id: `app-${app.id}`,
        label: app.name || app.id.slice(0, 8),
        icon: app.icon ? <img src={app.icon} alt={app.name} style={{ width: 32, height: 32 }} /> : <Package size={32} />,
        onClick: () => trymonApps.runApp(app.id),
        x: MARGIN + (GRID_X * (index % 4)),
        y: MARGIN + (GRID_Y * (Math.floor(index / 4) + 2))
      });
    });

    return icons;
  }, [openApp, trymonApps, trashCount]);

  // Handle incoming sync events
  useEffect(() => {
    const unsubMove = onEvent('window_move', (payload: any) => {
      setWindows(prev => prev.map(w => w.id === payload.id ? { ...w, position: { x: payload.x, y: payload.y } } : w));
    });

    const unsubResize = onEvent('window_resize', (payload: any) => {
      setWindows(prev => prev.map(w => w.id === payload.id ? { ...w, size: payload.size, position: payload.position } : w));
    });

    const unsubIcon = onEvent('icon_move', (payload: any) => {
      setIcons(prev => prev.map(icon => icon.id === payload.id ? { ...icon, x: payload.x, y: payload.y } : icon));
    });

    const unsubAction = onEvent('window_action', (payload: any) => {
      if (payload.action === 'open') {
        openApp(payload.appId, { broadcast: false });
      } else if (payload.action === 'close') {
        closeWindow(payload.id, { broadcast: false });
      } else if (payload.action === 'focus') {
        bringToFront(payload.id, { broadcast: false });
      }
    });

    const unsubStateReq = onEvent('sys:request_state', (_payload: any, sender: string) => {
      sendTo(sender, 'sys:initial_state', { 
        windows: windows.map(w => ({ ...w, content: null })),
        icons: icons.map(i => ({ ...i, icon: null }))
      });
    });

    const unsubStateInit = onEvent('sys:initial_state', (payload: any) => {
      console.log('Hydrating state:', payload);
      const hydratedWindows = payload.windows.map((w: any) => {
        const appId = w.appId || w.id.split('-')[0] || w.id;
        const meta = AppMetadata[appId] || { title: w.title, icon: w.icon };
        
        let content: React.ReactNode = null;
        if (appId === 'terminal') {
          content = <TerminalApp userName={userName} onTitleChange={(title) => updateWindowTitle(w.id, title)} onCloseWindow={() => closeWindow(w.id)} />;
        } else if (appId === 'files') {
          content = <FilesApp userName={userName} onContextMenu={handleContextMenu} onOpenFile={openFileInApp} onTitleChange={(title) => updateWindowTitle(w.id, title)} onOpenNewWindow={(newAppId, props) => openApp(newAppId, { newInstance: true, initialProps: props })} />;
        } else if (appId === 'editor') {
          content = <EditorApp onTitleChange={(title) => updateWindowTitle(w.id, title)} onCloseWindow={() => closeWindow(w.id)} />;
        } else if (appId === 'browser') {
          content = <BrowserApp onTitleChange={(title) => updateWindowTitle(w.id, title)} onOpenNewWindow={(newAppId, props) => openApp(newAppId, { newInstance: true, initialProps: props })} />;
        }

        return {
          ...w,
          appId,
          title: w.title || meta.title,
          icon: meta.icon || w.icon,
          content
        };
      });
      setWindows(hydratedWindows);
      
      const baseIcons = getBaseIcons();
      const hydratedIcons = payload.icons.map((i: any) => {
        const base = baseIcons.find(b => b.id === i.id);
        return { ...i, icon: base?.icon || i.icon, onClick: base?.onClick || (() => {}) };
      });
      // Merge any base icons missing from the synced state
      const missingFromSync = baseIcons.filter(base => !hydratedIcons.find((h: any) => h.id === base.id));
      setIcons([...hydratedIcons, ...missingFromSync]);
    });

    return () => {
      unsubMove();
      unsubResize();
      unsubIcon();
      unsubAction();
      unsubStateReq();
      unsubStateInit();
    };
  }, [onEvent, closeWindow, bringToFront, openApp, windows, icons, sendTo, getBaseIcons, userName, handleContextMenu, openFileInApp, updateWindowTitle]);

  const toggleMinimize = useCallback((id: string) => {
    setWindows(prev => prev.map(w => {
      if (w.id === id) {
        if (w.isMinimized) {
          setActiveWindowId(id);
          return { ...w, isMinimized: false };
        } else {
          return { ...w, isMinimized: true };
        }
      }
      return w;
    }));
  }, []);

  const toggleMaximize = useCallback((id: string) => {
    setWindows(prev => prev.map(w => {
      if (w.id === id) {
        if (w.isMaximized) {
          return { ...w, isMaximized: false, position: w.position, size: w.size };
        } else {
          return { ...w, isMaximized: true };
        }
      }
      return w;
    }));
  }, []);

  // Drag handlers
  const handleDragStart = useCallback((e: React.MouseEvent, windowId: string) => {
    e.preventDefault();
    const win = windows.find(w => w.id === windowId);
    if (!win || win.isMaximized) return;

    setDraggingWindow(windowId);
    setDragOffset({
      x: e.clientX - win.position.x,
      y: e.clientY - win.position.y
    });
  }, [windows]);

  const handleDragMove = useCallback((e: MouseEvent) => {
    if (!draggingWindow) return;

    const newX = Math.max(0, e.clientX - dragOffset.x);
    const newY = Math.max(0, e.clientY - dragOffset.y);

    setWindows(prev => prev.map(w => {
      if (w.id === draggingWindow && !w.isMaximized) {
        broadcast('window_move', { id: draggingWindow, x: newX, y: newY });
        return { ...w, position: { x: newX, y: newY } };
      }
      return w;
    }));
  }, [draggingWindow, dragOffset, broadcast]);

  const handleDragEnd = useCallback(() => {
    setDraggingWindow(null);
  }, []);

  useEffect(() => {
    if (draggingWindow) {
      document.addEventListener('mousemove', handleDragMove);
      document.addEventListener('mouseup', handleDragEnd);
      return () => {
        document.removeEventListener('mousemove', handleDragMove);
        document.removeEventListener('mouseup', handleDragEnd);
      };
    }
  }, [draggingWindow, handleDragMove, handleDragEnd]);

  // Resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent, windowId: string, direction: string) => {
    e.preventDefault();
    e.stopPropagation();
    const win = windows.find(w => w.id === windowId);
    if (!win || win.isMaximized) return;

    setResizingWindow({ id: windowId, direction });
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: win.size.width,
      height: win.size.height
    });
  }, [windows]);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!resizingWindow || !resizeStart) return;

    const dx = e.clientX - resizeStart.x;
    const dy = e.clientY - resizeStart.y;
    const win = windows.find(w => w.id === resizingWindow.id);
    if (!win) return;

    let newWidth = resizeStart.width;
    let newHeight = resizeStart.height;
    let newX = win.position.x;
    let newY = win.position.y;

    if (resizingWindow.direction.includes('e')) {
      newWidth = Math.max(win.minSize.width, resizeStart.width + dx);
    }
    if (resizingWindow.direction.includes('w')) {
      const widthChange = Math.min(dx, resizeStart.width - win.minSize.width);
      newWidth = resizeStart.width - widthChange;
      newX = win.position.x + widthChange;
    }
    if (resizingWindow.direction.includes('s')) {
      newHeight = Math.max(win.minSize.height, resizeStart.height + dy);
    }
    if (resizingWindow.direction.includes('n')) {
      const heightChange = Math.min(dy, resizeStart.height - win.minSize.height);
      newHeight = resizeStart.height - heightChange;
      newY = win.position.y + heightChange;
    }

    setWindows(prev => prev.map(w => {
      if (w.id === resizingWindow.id) {
        broadcast('window_resize', { id: resizingWindow.id, size: { width: newWidth, height: newHeight }, position: { x: newX, y: newY } });
        return { ...w, size: { width: newWidth, height: newHeight }, position: { x: newX, y: newY } };
      }
      return w;
    }));
  }, [resizingWindow, resizeStart, windows, broadcast]);

  const handleResizeEnd = useCallback(() => {
    setResizingWindow(null);
    setResizeStart(null);
  }, []);

  useEffect(() => {
    if (resizingWindow) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      return () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [resizingWindow, handleResizeMove, handleResizeEnd]);

  // Desktop schema version — bump this whenever new system icons are added to getBaseIcons
  const DESKTOP_SCHEMA_VERSION = 2;

  useEffect(() => {
    const savedIcons = loadConfig<any[]>('desktop_icons');
    const savedVersion = loadConfig<number>('desktop_schema_version') || 0;
    const baseIcons = getBaseIcons();

    setIcons((prev: DesktopIcon[]) => {
      // Helper: merge missing base icons into an existing icon list
      const mergeMissing = (existing: DesktopIcon[]): DesktopIcon[] => {
        const missingIcons = baseIcons.filter(base => !existing.find(p => p.id === base.id));
        if (missingIcons.length === 0) return existing;
        const merged = [...existing, ...missingIcons];
        // Persist the updated list so this merge only happens once
        const positions = merged.map(icon => ({ id: icon.id, x: icon.x, y: icon.y }));
        saveConfig('desktop_icons', positions);
        saveConfig('desktop_schema_version', DESKTOP_SCHEMA_VERSION);
        return merged;
      };

      // If icons already loaded in memory, check for missing ones (e.g. HMR update)
      if (prev.length > 0) {
        return mergeMissing(prev);
      }

      // Restore from localStorage
      if (savedIcons && savedIcons.length > 0) {
        const restoredIcons: DesktopIcon[] = [];

        for (const saved of savedIcons) {
          const base = baseIcons.find((b: any) => b.id === saved.id);
          if (base) {
            restoredIcons.push({
              ...base,
              x: saved.x,
              y: saved.y
            });
          } else if (saved.id.startsWith('app-')) {
            const appId = saved.id.replace('app-', '');
            const app = trymonApps.apps.find((a: any) => a.id === appId);
            if (app) {
              restoredIcons.push({
                id: saved.id,
                label: app.name || app.id.slice(0, 8),
                icon: app.icon ? <img src={app.icon} alt={app.name} style={{ width: 32, height: 32 }} /> : <Package size={32} />,
                onClick: () => trymonApps.runApp(app.id),
                x: saved.x,
                y: saved.y
              });
            }
          }
        }

        // Schema changed or missing icons → merge and persist
        if (savedVersion < DESKTOP_SCHEMA_VERSION) {
          return mergeMissing(restoredIcons);
        }

        // Still check for missing icons even if version matches (safety net)
        const missingIcons = baseIcons.filter(base => !restoredIcons.find(ri => ri.id === base.id));
        if (missingIcons.length > 0) {
          return mergeMissing(restoredIcons);
        }

        return restoredIcons;
      }

      // No saved state — fresh install
      saveConfig('desktop_schema_version', DESKTOP_SCHEMA_VERSION);
      return baseIcons;
    });
  }, [kernelState.initialized, getBaseIcons, trymonApps]);

  // Icon Dragging Handlers
  const handleIconMouseDown = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (e.button !== 0) return;

    const icon = icons.find((i: DesktopIcon) => i.id === id);
    if (!icon) return;

    setDraggingIconId(id);
    iconDraggedRef.current = false;
    setSelectedIconIds((prev: string[]) => prev.includes(id) ? prev : [id]);

    setIconDragOffset({
      x: e.clientX - icon.x,
      y: e.clientY - icon.y
    });
  }, [icons]);

  const handleIconMouseMove = useCallback((e: MouseEvent) => {
    if (!draggingIconId) return;
    iconDraggedRef.current = true;

    const currentDragging = icons.find((i: DesktopIcon) => i.id === draggingIconId);
    if (!currentDragging) return;

    const dx = e.clientX - iconDragOffset.x - currentDragging.x;
    const dy = e.clientY - iconDragOffset.y - currentDragging.y;

    if (dx === 0 && dy === 0) return;

    setIcons((prev: DesktopIcon[]) => prev.map((icon: DesktopIcon) => {
      if (selectedIconIds.includes(icon.id)) {
        const nextX = icon.x + dx;
        const nextY = icon.y + dy;
        broadcast('icon_move', { id: icon.id, x: nextX, y: nextY });
        return { ...icon, x: nextX, y: nextY };
      }
      return icon;
    }));

    setIconDragOffset({
      x: e.clientX - (currentDragging.x + dx),
      y: e.clientY - (currentDragging.y + dy)
    });
  }, [draggingIconId, iconDragOffset, icons, selectedIconIds, broadcast]);

  const GRID_SIZE_X = 100;
  const GRID_SIZE_Y = 110;
  const ICON_MARGIN = 20;

  const handleIconMouseUp = useCallback(() => {
    if (!draggingIconId) return;

    iconDraggedRef.current = false;

    setIcons((prev: DesktopIcon[]) => {
      let currentIcons = [...prev];

      selectedIconIds.forEach((id: string) => {
        const icon = currentIcons.find((i: DesktopIcon) => i.id === id);
        if (!icon) return;

        const snappedX = Math.max(ICON_MARGIN, Math.round((icon.x - ICON_MARGIN) / GRID_SIZE_X) * GRID_SIZE_X + ICON_MARGIN);
        const snappedY = Math.max(ICON_MARGIN, Math.round((icon.y - ICON_MARGIN) / GRID_SIZE_Y) * GRID_SIZE_Y + ICON_MARGIN);

        let finalX = snappedX;
        let finalY = snappedY;
        let offset = 0;
        let direction = 0;

        const isOccupied = (x: number, y: number, iconId: string) =>
          currentIcons.some((inc: DesktopIcon) => inc.id !== iconId && inc.x === x && inc.y === y);

        while (isOccupied(finalX, finalY, id)) {
          if (offset % 10 === 0) direction = (direction + 1) % 4;
          if (direction === 0) finalX += GRID_SIZE_X;
          else if (direction === 1) finalY += GRID_SIZE_Y;
          else if (direction === 2) finalX -= GRID_SIZE_X;
          else if (direction === 3) finalY -= GRID_SIZE_Y;
          finalX = Math.max(ICON_MARGIN, finalX);
          finalY = Math.max(ICON_MARGIN, finalY);
          offset++;
          if (offset > 50) break;
        }

        currentIcons = currentIcons.map((inc: DesktopIcon) =>
          inc.id === id ? { ...inc, x: finalX, y: finalY } : inc
        );
      });

      return currentIcons;
    });

    setDraggingIconId(null);

    setIcons((prev: DesktopIcon[]) => {
      const positions = prev.map((icon: DesktopIcon) => ({ id: icon.id, x: icon.x, y: icon.y }));
      saveConfig('desktop_icons', positions);
      return prev;
    });
  }, [draggingIconId, selectedIconIds]);

  useEffect(() => {
    if (draggingIconId) {
      window.addEventListener('mousemove', handleIconMouseMove);
      window.addEventListener('mouseup', handleIconMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleIconMouseMove);
        window.removeEventListener('mouseup', handleIconMouseUp);
      };
    }
  }, [draggingIconId, handleIconMouseMove, handleIconMouseUp]);

  // Desktop Selection Handlers
  const handleDesktopMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if (e.target !== desktopRef.current) return;

    setSelectedIconIds([]);
    setSelection({
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      endX: e.clientX,
      endY: e.clientY
    });
  }, []);

  const handleDesktopMouseMove = useCallback((e: MouseEvent) => {
    if (!selection?.active) return;

    const endX = e.clientX;
    const endY = e.clientY;

    setSelection(prev => prev ? { ...prev, endX, endY } : null);

    const rect = {
      left: Math.min(selection.startX, endX),
      top: Math.min(selection.startY, endY),
      right: Math.max(selection.startX, endX),
      bottom: Math.max(selection.startY, endY)
    };

    const ICON_WIDTH = 100;
    const ICON_HEIGHT = 110;

    const newSelectedIds = icons.filter(icon => {
      const iconRect = {
        left: icon.x,
        top: icon.y,
        right: icon.x + ICON_WIDTH,
        bottom: icon.y + ICON_HEIGHT
      };

      return !(rect.left > iconRect.right ||
        rect.right < iconRect.left ||
        rect.top > iconRect.bottom ||
        rect.bottom < iconRect.top);
    }).map(icon => icon.id);

    setSelectedIconIds(newSelectedIds);
  }, [selection, icons]);

  const handleDesktopMouseUp = useCallback(() => {
    setSelection(null);
  }, []);

  useEffect(() => {
    if (selection?.active) {
      window.addEventListener('mousemove', handleDesktopMouseMove);
      window.addEventListener('mouseup', handleDesktopMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleDesktopMouseMove);
        window.removeEventListener('mouseup', handleDesktopMouseUp);
      };
    }
  }, [selection?.active, handleDesktopMouseMove, handleDesktopMouseUp]);

  const isRunning = kernelState.state.state === 'Running';

  return (
    <>
      {!isRunning && <BootScreen kernelState={kernelState.state} />}

      <div
        className="os-desktop"
        ref={desktopRef}
        style={{ background: wallpaper, display: isRunning ? 'block' : 'none' }}
        onContextMenu={(e) => {
          const x = e.clientX;
          const y = e.clientY;
          handleContextMenu(e, [
            { label: 'Novo Terminal', icon: <Terminal size={14} />, onClick: () => openApp('terminal', { newInstance: true }) },
            { label: 'Novo Navegador', icon: <Globe size={14} />, onClick: () => openApp('browser', { newInstance: true }) },
            { label: 'Novo Gerenciador de Arquivos', icon: <FolderOpen size={14} />, onClick: () => openApp('files', { newInstance: true }) },
            { label: 'Novo Editor de Texto', icon: <FileText size={14} />, onClick: () => openApp('editor', { newInstance: true }) },
            { separator: true },
            {
              label: 'Novo Arquivo',
              icon: <Plus size={14} />,
              items: [
                { label: 'Documento de Texto (.txt)', icon: <FileText size={14} />, onClick: () => handleCreateNewFile('.txt', x, y) },
                { label: 'Markdown (.md)', icon: <FileText size={14} color="#0070f3" />, onClick: () => handleCreateNewFile('.md', x, y) },
                { label: 'Pacote Trymon (.trymon)', icon: <Package size={14} color="#00f2ff" />, onClick: () => handleCreateNewFile('.trymon', x, y) },
                { label: 'Script Shell (.sh)', icon: <Terminal size={14} />, onClick: () => handleCreateNewFile('.sh', x, y) },
                { separator: true },
                { label: 'Nova Pasta', icon: <FolderPlus size={14} />, onClick: () => handleCreateNewFolder(x, y) },
              ]
            },
            { separator: true },
            { label: 'Atualizar Desktop', icon: <RefreshCw size={14} />, onClick: () => window.location.reload() },
            { label: 'Alterar Wallpaper', icon: <ImageIcon size={14} />, onClick: () => wallpaperInputRef.current?.click() },
            { separator: true },
            { label: 'Configurações', icon: <Settings size={14} />, onClick: () => openApp('settings') },
            { label: 'Sobre o Trymon OS', icon: <Info size={14} />, onClick: () => alert('Trymon OS v1.0.0\nMulti-Instance & Multi-Tab Enabled\nRunning on WASM/Rust Kernel') },
          ]);
        }}
        onMouseDown={handleDesktopMouseDown}
        onClick={() => setContextMenu(null)}
      >
        {/* Desktop Branding (Wallpaper Logo) */}
        <div className="desktop-branding">
          <TrymonLogo size={200} glow={true} animated={false} />
          <div className="branding-text">TRYMON OS</div>
        </div>

        <input
          type="file"
          ref={wallpaperInputRef}
          style={{ display: 'none' }}
          accept="image/*"
          onChange={handleWallpaperChange}
        />
        {/* Selection Box */}
        {selection && selection.active && (
          <div
            className="selection-box"
            style={{
              left: Math.min(selection.startX, selection.endX),
              top: Math.min(selection.startY, selection.endY),
              width: Math.abs(selection.startX - selection.endX),
              height: Math.abs(selection.startY - selection.endY)
            }}
          />
        )}

        {/* Desktop Icons */}
        <div className="desktop-icons">
          {icons.filter(i => !i.label.startsWith('.')).map(icon => (
            <div
              key={icon.id}
              className={`desktop-icon ${draggingIconId === icon.id ? 'dragging' : ''} ${selectedIconIds.includes(icon.id) ? 'selected' : ''}`}
              style={{
                left: `${icon.x}px`,
                top: `${icon.y}px`
              }}
              onClick={() => {
                if (iconDraggedRef.current) return;
                icon.onClick();
              }}
              onMouseDown={(e) => handleIconMouseDown(e, icon.id)}
              onContextMenu={(e) => handleContextMenu(e, [
                { label: `Abrir ${icon.label}`, icon: icon.icon, onClick: icon.onClick },
                { label: 'Abrir em Nova Janela', icon: <ExternalLink size={14} />, onClick: () => {
                  if (icon.path) {
                    openFileInApp(icon.path);
                  } else {
                    openApp(icon.id, { newInstance: true });
                  }
                }},
                { separator: true },
                { label: 'Renomear', icon: <Edit3 size={14} />, onClick: () => setIcons(prev => prev.map(i => i.id === icon.id ? { ...i, isEditing: true } : i)) },
                { separator: true },
                { label: icon.path ? 'Excluir' : 'Excluir Atalho', icon: <X size={14} />, danger: true, onClick: () => {
                  if (icon.path) {
                    kernel.moveToTrash(icon.path);
                    setIcons(prev => prev.filter(i => i.id !== icon.id));
                  } else {
                    setIcons(prev => prev.filter(i => i.id !== icon.id));
                  }
                }}
              ])}
            >
              <div className="icon-image">
                {icon.icon}
                {icon.badge && icon.badge > 0 && (
                  <span className="icon-badge">{icon.badge > 99 ? '99+' : icon.badge}</span>
                )}
              </div>
              {icon.isEditing ? (
                <input
                  type="text"
                  className="icon-label-input"
                  defaultValue={icon.label}
                  autoFocus
                  onFocus={(e) => {
                    const lastDot = e.target.value.lastIndexOf('.');
                    if (lastDot > 0) {
                      e.target.setSelectionRange(0, lastDot);
                    } else {
                      e.target.select();
                    }
                  }}
                  onBlur={(e) => handleRenameIcon(icon.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRenameIcon(icon.id, (e.target as HTMLInputElement).value);
                    if (e.key === 'Escape') setIcons(prev => prev.map(i => i.id === icon.id ? { ...i, isEditing: false } : i));
                  }}
                />
              ) : (
                <div className="icon-label">{icon.label}</div>
              )}
            </div>
          ))}
        </div>

        {/* Windows */}
        {windows.filter(w => !w.isMinimized).map(window => (
          <div
            key={window.id}
            className={`window ${window.isMaximized ? 'maximized' : ''} ${draggingWindow === window.id ? 'dragging' : ''}`}
            style={{
              left: window.isMaximized ? 0 : window.position.x,
              top: window.isMaximized ? 0 : window.position.y,
              width: window.isMaximized ? '100%' : window.size.width,
              height: window.isMaximized ? 'calc(100% - 48px)' : window.size.height,
              zIndex: window.zIndex
            }}
            onMouseDown={() => bringToFront(window.id)}
          >
            {/* Window Header - Draggable */}
            <div
              className="window-header"
              onMouseDown={(e) => handleDragStart(e, window.id)}
              onContextMenu={(e) => handleContextMenu(e, [
                { label: 'Nova Janela deste App', icon: <ExternalLink size={14} />, onClick: () => openApp(window.appId, { newInstance: true }) },
                { separator: true },
                { label: 'Minimizar', icon: <Minus size={14} />, onClick: () => minimizeWindow(window.id) },
                { label: window.isMaximized ? 'Restaurar' : 'Maximizar', icon: window.isMaximized ? <Square size={14} /> : <Maximize2 size={14} />, onClick: () => toggleMaximize(window.id) },
                { separator: true },
                { label: 'Fechar', icon: <X size={14} />, danger: true, onClick: () => closeWindow(window.id) }
              ])}
            >
              <div className="window-title">
                {window.icon}
                <span>{window.title}</span>
              </div>
              <div className="window-controls" onClick={(e) => e.stopPropagation()}>
                <button className="control minimize" onClick={() => minimizeWindow(window.id)} title="Minimizar">
                  <Minus size={12} />
                </button>
                <button className="control maximize" onClick={() => toggleMaximize(window.id)} title={window.isMaximized ? "Restaurar" : "Maximizar"}>
                  {window.isMaximized ? <Square size={10} /> : <Maximize2 size={10} />}
                </button>
                <button className="control close" onClick={() => closeWindow(window.id)} title="Fechar">
                  <X size={12} />
                </button>
              </div>
            </div>

            <div className="window-content">
              {window.content}
            </div>

            {/* Resize Handles */}
            {!window.isMaximized && window.resizable && (
              <>
                <div className="resize-handle resize-e" onMouseDown={(e) => handleResizeStart(e, window.id, 'e')} />
                <div className="resize-handle resize-w" onMouseDown={(e) => handleResizeStart(e, window.id, 'w')} />
                <div className="resize-handle resize-s" onMouseDown={(e) => handleResizeStart(e, window.id, 's')} />
                <div className="resize-handle resize-n" onMouseDown={(e) => handleResizeStart(e, window.id, 'n')} />
                <div className="resize-handle resize-se" onMouseDown={(e) => handleResizeStart(e, window.id, 'se')} />
                <div className="resize-handle resize-sw" onMouseDown={(e) => handleResizeStart(e, window.id, 'sw')} />
                <div className="resize-handle resize-ne" onMouseDown={(e) => handleResizeStart(e, window.id, 'ne')} />
                <div className="resize-handle resize-nw" onMouseDown={(e) => handleResizeStart(e, window.id, 'nw')} />
              </>
            )}
          </div>
        ))}

        {/* Taskbar */}
        <div className="taskbar">
          <button
            className={`start-button ${startMenuOpen ? 'active' : ''}`}
            onClick={() => setStartMenuOpen(!startMenuOpen)}
          >
            <div className="start-icon">
              <TrymonLogo size={24} glow={false} />
            </div>
            <span>Iniciar</span>
          </button>

          <div className="taskbar-apps">
            {windows.map(w => (
              <button
                key={w.id}
                className={`taskbar-app ${activeWindowId === w.id ? 'active' : ''} ${w.isMinimized ? 'minimized' : ''}`}
                onClick={() => toggleMinimize(w.id)}
                onContextMenu={(e) => handleContextMenu(e, [
                  { label: 'Nova Janela', icon: <Plus size={14} />, onClick: () => openApp(w.appId, { newInstance: true }) },
                  { separator: true },
                  { label: w.isMinimized ? 'Restaurar' : 'Minimizar', icon: w.isMinimized ? <Maximize2 size={14} /> : <Minus size={14} />, onClick: () => toggleMinimize(w.id) },
                  { label: w.isMaximized ? 'Restaurar Tamanho' : 'Maximizar', icon: <Square size={14} />, onClick: () => toggleMaximize(w.id) },
                  { separator: true },
                  { label: 'Fechar Janela', icon: <X size={14} />, danger: true, onClick: () => closeWindow(w.id) },
                  { label: 'Fechar Todas as Janelas deste App', icon: <X size={14} />, danger: true, onClick: () => closeAllWindowsOfApp(w.appId) }
                ])}
                title={w.title}
              >
                {w.icon}
                <span className="app-label">{w.title}</span>
              </button>
            ))}
          </div>

          <div className="system-tray">
            <div className="tray-item" title={emulatorState.isRunning ? "Emulador em execução" : "Emulador parado"}>
              {emulatorState.isRunning ? <Activity size={14} className="running" /> : <Activity size={14} />}
            </div>
            <VolumeControl />
            <SystemClock />
            <NotificationCenter
              notifications={notifications}
              onRemove={removeNotification}
              onClearAll={clearNotifications}
            />
          </div>
        </div>

        {/* Start Menu */}
        {startMenuOpen && (
          <div className="start-menu-premium">
            <div className="start-menu-side">
              <div className="user-profile">
                <div className="user-avatar">
                  <User size={20} />
                </div>
                <div className="user-info">
                  <span className="user-name">Root User</span>
                  <span className="user-status">Online</span>
                </div>
              </div>

              <div className="side-actions">
                <button className="side-btn" onClick={() => { openApp('settings'); setStartMenuOpen(false); }} title="Configurações">
                  <Settings size={18} />
                </button>
                <button className="side-btn" onClick={() => { openApp('files', { newInstance: true }); setStartMenuOpen(false); }} title="Arquivos">
                  <FolderOpen size={18} />
                </button>
                <div className="spacer" />
                <button className="side-btn power-btn" onClick={() => setStartMenuOpen(false)}>
                  <Power size={18} />
                </button>
              </div>
            </div>

            <div className="start-menu-main">
              <div className="search-container">
                <Search size={16} className="search-icon" />
                <input
                  type="text"
                  placeholder="Pesquisar aplicativos e documentos..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="start-sections">
                <div className="section">
                  <h3>Fixados</h3>
                  <div className="apps-grid">
                    {icons.filter((i: DesktopIcon) => i.label.toLowerCase().includes(searchQuery.toLowerCase())).map((icon: DesktopIcon) => (
                      <div 
                        key={icon.id} 
                        className="app-item" 
                        onClick={() => { openApp(icon.id); setStartMenuOpen(false); }}
                        onContextMenu={(e) => handleContextMenu(e, [
                          { label: `Abrir ${icon.label}`, icon: icon.icon, onClick: () => { openApp(icon.id); setStartMenuOpen(false); } },
                          { label: 'Abrir em Nova Janela', icon: <ExternalLink size={14} />, onClick: () => { openApp(icon.id, { newInstance: true }); setStartMenuOpen(false); } }
                        ])}
                      >
                        <div className="app-icon">{icon.icon}</div>
                        <span className="app-label">{icon.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {trymonApps.apps.length > 0 && (
                  <div className="section">
                    <h3>Aplicativos Trymon</h3>
                    <div className="apps-list">
                      {trymonApps.apps.filter((a: any) => a.name && a.name.toLowerCase().includes(searchQuery.toLowerCase())).map((app: any) => (
                        <div key={app.id} className="app-list-item" onClick={async () => { await trymonApps.runApp(app.id); setStartMenuOpen(false); }}>
                          <div className="app-list-icon">
                            <TrymonLogo size={20} glow={false} />
                          </div>
                          <div className="app-list-info">
                            <span className="name">{app.name}</span>
                            <span className="version">v{app.version || '1.0'}</span>
                          </div>
                          <ChevronRight size={14} className="arrow" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="start-footer">
                <div className="power-option">
                  <div className={`status-dot ${kernelState.tvm_error ? 'error' : (kernelState.tvm_ready ? 'running' : '')}`} />
                  <span>{kernelState.tvm_error ? `TVM Erro` : (kernelState.tvm_ready ? 'TVM Ativo' : 'TVM Carregando...')}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Click outside to close start menu */}
        {startMenuOpen && (
          <div className="start-menu-overlay" onClick={() => setStartMenuOpen(false)} />
        )}

        {/* Context Menu */}
        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            items={contextMenu.items}
            onClose={() => setContextMenu(null)}
          />
        )}

        {/* Toast Notifications */}
        <ToastContainer
          notifications={notifications}
          onRemove={removeNotification}
        />

        {/* Remote Cursors (Trymon Sync) */}
        {Object.entries(remoteCursors).map(([id, cursor]) => (
          <RemoteCursor key={id} x={cursor.x} y={cursor.y} name={cursor.name} />
        ))}
      </div>
    </>
  );
}
