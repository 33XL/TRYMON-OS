/**
 * System Components for Trymon OS
 * Clock, Notifications, and other system-level UI elements
 */

import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { Bell, X, CheckCircle, AlertTriangle, AlertCircle, Info, Volume2, Volume1, Volume, VolumeX } from 'lucide-react';

// ============================================================
// Clock Component - Memoized to avoid global re-renders
// ============================================================

export const SystemClock = memo(function SystemClock() {
  const [time, setTime] = useState(new Date());
  const [isOpen, setIsOpen] = useState(false);
  const [uptime, setUptime] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const timer = setInterval(() => {
      setTime(new Date());
      setUptime(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const timeStr = useMemo(() => {
    return time.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }, [time]);

  const dateStr = useMemo(() => {
    return time.toLocaleDateString('pt-BR', {
      weekday: 'short',
      day: '2-digit',
      month: 'short'
    });
  }, [time]);

  return (
    <div className="system-clock-wrapper">
      <div 
        className={`system-clock clock ${isOpen ? 'active' : ''}`} 
        title={dateStr}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="clock-time">{timeStr}</span>
      </div>
      
      {isOpen && (
        <ClockDashboard 
          time={time} 
          uptime={uptime} 
          onClose={() => setIsOpen(false)} 
        />
      )}
    </div>
  );
});

// ============================================================
// Clock Dashboard - Detailed view with Analog Clock
// ============================================================

function ClockDashboard({ time, uptime, onClose }: { time: Date; uptime: number; onClose: () => void }) {
  const hours = time.getHours();
  const minutes = time.getMinutes();
  const seconds = time.getSeconds();

  // Analog clock rotations
  const secondDeg = seconds * 6;
  const minuteDeg = minutes * 6 + seconds * 0.1;
  const hourDeg = (hours % 12) * 30 + minutes * 0.5;

  const fullDateStr = time.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const formatUptime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h}h ${m}m ${sec}s`;
  };

  return (
    <div className="clock-panel">
      <div className="clock-panel-header">
        <h3>Calendário e Hora</h3>
        <button className="close-panel-btn" onClick={onClose}>
          <X size={14} />
        </button>
      </div>
      
      <div className="clock-panel-body">
        <div className="analog-clock-container">
          <svg className="analog-clock" viewBox="0 0 100 100">
            {/* Clock Face */}
            <circle className="clock-face" cx="50" cy="50" r="48" />
            
            {/* Hour Markers */}
            {[...Array(12)].map((_, i) => (
              <line
                key={i}
                className="hour-marker"
                x1="50" y1="10" x2="50" y2="15"
                transform={`rotate(${i * 30} 50 50)`}
              />
            ))}
            
            {/* Hands */}
            <line 
              className="hand hour-hand" 
              x1="50" y1="50" x2="50" y2="28" 
              transform={`rotate(${hourDeg} 50 50)`} 
            />
            <line 
              className="hand minute-hand" 
              x1="50" y1="50" x2="50" y2="18" 
              transform={`rotate(${minuteDeg} 50 50)`} 
            />
            <line 
              className="hand second-hand" 
              x1="50" y1="50" x2="50" y2="12" 
              transform={`rotate(${secondDeg} 50 50)`} 
            />
            <circle className="center-dot" cx="50" cy="50" r="2" />
          </svg>
        </div>

        <div className="clock-details">
          <div className="digital-time">
            {time.toLocaleTimeString('pt-BR')}
          </div>
          <div className="full-date">
            {fullDateStr}
          </div>
          
          <div className="system-info">
            <div className="info-item">
              <span className="info-label">Uptime do Sistema</span>
              <span className="info-value">{formatUptime(uptime)}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Fuso Horário</span>
              <span className="info-value">{Intl.DateTimeFormat().resolvedOptions().timeZone}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Volume Control Component
// ============================================================

export const VolumeControl = memo(function VolumeControl() {
  const [volume, setVolume] = useState(70);
  const [isOpen, setIsOpen] = useState(false);

  // Close panel on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.volume-control-wrapper')) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const getVolumeIcon = () => {
    if (volume === 0) return <VolumeX size={16} />;
    if (volume < 33) return <Volume size={16} />;
    if (volume < 66) return <Volume1 size={16} />;
    return <Volume2 size={16} />;
  };

  return (
    <div className="volume-control-wrapper">
      <button 
        className={`tray-item volume-button ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title={`Volume: ${volume}%`}
      >
        {getVolumeIcon()}
      </button>

      {isOpen && (
        <div className="volume-panel">
          <div className="volume-panel-header">
            <span>Volume</span>
            <span className="volume-value">{volume}%</span>
          </div>
          <div className="volume-slider-container">
            <input 
              type="range" 
              className="volume-slider"
              min="0" 
              max="100" 
              value={volume}
              style={{ '--volume-percent': `${volume}%` } as any}
              onChange={(e) => setVolume(parseInt(e.target.value))}
            />
          </div>
          <div className="volume-icons">
            <VolumeX size={14} className="muted-icon" onClick={() => setVolume(0)} />
            <Volume2 size={14} className="max-icon" onClick={() => setVolume(100)} />
          </div>
        </div>
      )}
    </div>
  );
});


// ============================================================
// Notification System
// ============================================================

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: number;
  duration?: number; // ms, 0 = persistent
}

// Notification Toast Component
class NotificationBus {
  private listeners: Set<(n: Notification) => void> = new Set();

  subscribe(fn: (n: Notification) => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(n: Notification) {
    this.listeners.forEach(fn => fn(n));
  }
}

export const notificationBus = new NotificationBus();

// Notification Toast Component
function NotificationToast({ notification, onRemove }: { notification: Notification; onRemove: (id: string) => void }) {
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    if (notification.duration === 0) return; // Persistent

    const timer = setTimeout(() => {
      setIsLeaving(true);
      setTimeout(() => {
        onRemove(notification.id);
      }, 300);
    }, notification.duration || 5000);

    return () => clearTimeout(timer);
  }, [notification.id, notification.duration, onRemove]);

  const handleRemove = () => {
    setIsLeaving(true);
    setTimeout(() => onRemove(notification.id), 300);
  };

  const iconMap = {
    success: <CheckCircle size={18} className="notification-icon success" />,
    error: <AlertCircle size={18} className="notification-icon error" />,
    warning: <AlertTriangle size={18} className="notification-icon warning" />,
    info: <Info size={18} className="notification-icon info" />,
  };

  return (
    <div
      className={`notification-toast ${notification.type} ${isLeaving ? 'leaving' : 'entering'}`}
      role="alert"
      aria-live="polite"
    >
      <div className="notification-icon-wrapper">
        {iconMap[notification.type]}
      </div>
      <div className="notification-content">
        <div className="notification-title">{notification.title}</div>
        <div className="notification-message">{notification.message}</div>
      </div>
      <button className="notification-close" onClick={handleRemove} aria-label="Fechar notificação">
        <X size={14} />
      </button>
    </div>
  );
}

// Notification Bell/Panel Component
export const NotificationCenter = memo(function NotificationCenter({
  notifications,
  onRemove,
  onClearAll
}: {
  notifications: Notification[];
  onRemove: (id: string) => void;
  onClearAll: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="notification-center">
      <button
        className="notification-bell"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`Notificações: ${notifications.length} não lidas`}
      >
        <Bell size={16} />
        {notifications.length > 0 && (
          <span className="notification-badge">{notifications.length > 9 ? '9+' : notifications.length}</span>
        )}
      </button>

      {isOpen && (
        <div className="notification-panel">
          <div className="notification-panel-header">
            <h3>Notificações</h3>
            {notifications.length > 0 && (
              <button className="clear-all-btn" onClick={onClearAll}>
                Limpar todas
              </button>
            )}
          </div>
          <div className="notification-panel-body">
            {notifications.length === 0 ? (
              <div className="no-notifications">
                <Bell size={32} className="no-notif-icon" />
                <p>Nenhuma notificação</p>
              </div>
            ) : (
              notifications.map(n => (
                <div key={n.id} className={`notification-item ${n.type}`}>
                  <div className="notif-item-content">
                    <div className="notif-item-title">{n.title}</div>
                    <div className="notif-item-message">{n.message}</div>
                    <div className="notif-item-time">
                      {new Date(n.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <button className="notif-item-close" onClick={() => onRemove(n.id)} aria-label="Remover">
                    <X size={12} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
});

// Toast Container - renders all active toasts
export function ToastContainer({
  notifications,
  onRemove
}: {
  notifications: Notification[];
  onRemove: (id: string) => void;
}) {
  return (
    <div className="toast-container" aria-live="polite">
      {notifications.map(n => (
        <NotificationToast key={n.id} notification={n} onRemove={onRemove} />
      ))}
    </div>
  );
}

// Hook for using notifications
export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback((n: Omit<Notification, 'id' | 'timestamp'>) => {
    const newNotif: Notification = {
      ...n,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      duration: n.duration ?? 5000,
    };

    setNotifications(prev => [newNotif, ...prev]);
    notificationBus.emit(newNotif);
    return newNotif.id;
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  // Listen for external notifications
  useEffect(() => {
    const unsub = notificationBus.subscribe((n) => {
      setNotifications(prev => {
        if (prev.some(existing => existing.id === n.id)) return prev;
        return [n, ...prev];
      });
    });
    return () => { unsub(); };
  }, []);

  return useMemo(() => ({
    notifications,
    addNotification,
    removeNotification,
    clearAll,
    unreadCount: notifications.length,
  }), [notifications, addNotification, removeNotification, clearAll]);
}

// Convenience functions for common notifications
export const notify = {
  success: (title: string, message: string, duration?: number) => {
    notificationBus.emit({
      id: crypto.randomUUID(),
      type: 'success',
      title,
      message,
      timestamp: Date.now(),
      duration,
    });
  },
  error: (title: string, message: string, duration?: number) => {
    notificationBus.emit({
      id: crypto.randomUUID(),
      type: 'error',
      title,
      message,
      timestamp: Date.now(),
      duration,
    });
  },
  warning: (title: string, message: string, duration?: number) => {
    notificationBus.emit({
      id: crypto.randomUUID(),
      type: 'warning',
      title,
      message,
      timestamp: Date.now(),
      duration,
    });
  },
  info: (title: string, message: string, duration?: number) => {
    notificationBus.emit({
      id: crypto.randomUUID(),
      type: 'info',
      title,
      message,
      timestamp: Date.now(),
      duration,
    });
  },
};
