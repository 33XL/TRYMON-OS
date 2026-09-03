import React, { useEffect, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';

export interface ContextMenuItem {
  label?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  separator?: boolean;
  danger?: boolean;
  disabled?: boolean;
  items?: ContextMenuItem[];
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, items, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [activeSubmenu, setActiveSubmenu] = useState<number | null>(null);

  useEffect(() => {
    // Adjust position if menu goes off screen
    if (menuRef.current) {
      const menuRect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      if (x + menuRect.width > viewportWidth) {
        menuRef.current.style.left = `${viewportWidth - menuRect.width - 10}px`;
      } else {
        menuRef.current.style.left = `${x}px`;
      }

      if (y + menuRect.height > viewportHeight) {
        menuRef.current.style.top = `${viewportHeight - menuRect.height - 10}px`;
      } else {
        menuRef.current.style.top = `${y}px`;
      }
    }
  }, [x, y]);

  return (
    <>
      <div className="context-menu-overlay" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
      <div 
        ref={menuRef}
        className="context-menu"
        style={{ left: x, top: y }}
        onClick={(e) => e.stopPropagation()}
      >
        {items.map((item, index) => (
          item.separator ? (
            <div key={`sep-${index}`} className="context-menu-separator" />
          ) : (
            <div 
              key={`item-${index}`}
              className={`context-menu-item ${item.danger ? 'danger' : ''} ${item.disabled ? 'disabled' : ''} ${activeSubmenu === index ? 'active' : ''}`}
              onMouseEnter={() => !item.disabled && item.items && setActiveSubmenu(index)}
              onMouseLeave={() => !item.disabled && item.items && setActiveSubmenu(null)}
              onClick={() => {
                if (!item.disabled && !item.items) {
                  item.onClick?.();
                  onClose();
                }
              }}
            >
              <div className="item-content">
                {item.icon}
                <span>{item.label}</span>
              </div>
              {item.items && <ChevronRight size={14} className="submenu-icon" />}
              
              {item.items && activeSubmenu === index && (
                <div className="submenu">
                  <ContextMenu 
                    x={200} // This will be adjusted by CSS usually, but let's make it relative
                    y={0} 
                    items={item.items} 
                    onClose={onClose} 
                  />
                </div>
              )}
            </div>
          )
        ))}
      </div>
    </>
  );
};
