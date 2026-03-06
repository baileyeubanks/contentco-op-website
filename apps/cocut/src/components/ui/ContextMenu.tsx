import { useEffect, useRef } from 'react';
import { C } from '../../theme/colors';
import { Icons } from '../../theme/icons';
import { Icon } from './Icon';
import { useUIStore } from '../../store/uiStore';
import { useElementStore } from '../../store/elementStore';
import { usePlaybackStore } from '../../store/playbackStore';
import { createElement } from '../../utils/elementFactory';

interface MenuItem {
  label: string;
  icon?: string;
  shortcut?: string;
  danger?: boolean;
  separator?: boolean;
  action: () => void;
}

export function ContextMenu() {
  const ref = useRef<HTMLDivElement>(null);
  const { visible, x, y, targetId, targetType } = useUIStore((s) => s.contextMenu);
  const closeContextMenu = useUIStore((s) => s.closeContextMenu);
  const elements = useElementStore((s) => s.elements);
  const deleteElements = useElementStore((s) => s.deleteElements);
  const duplicateElements = useElementStore((s) => s.duplicateElements);
  const moveLayer = useElementStore((s) => s.moveLayer);
  const addElement = useElementStore((s) => s.addElement);
  const updateElement = useElementStore((s) => s.updateElement);
  const currentTime = usePlaybackStore((s) => s.currentTime);

  useEffect(() => {
    if (!visible) return;
    const handler = () => closeContextMenu();
    window.addEventListener('click', handler);
    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('click', handler);
      window.removeEventListener('keydown', handler);
    };
  }, [visible, closeContextMenu]);

  if (!visible) return null;

  const target = targetId ? elements.find((e) => e.id === targetId) : null;

  const items: MenuItem[] = [];

  if (target && targetType === 'element') {
    items.push(
      { label: 'Duplicate', icon: Icons.copy, shortcut: '⌘D', action: () => duplicateElements([target.id]) },
      { label: 'Delete', icon: Icons.trash, shortcut: '⌫', danger: true, action: () => deleteElements([target.id]) },
      { label: '', separator: true, action: () => {} },
      {
        label: target.locked ? 'Unlock' : 'Lock',
        icon: target.locked ? Icons.unlock : Icons.lock,
        action: () => updateElement(target.id, { locked: !target.locked }),
      },
      {
        label: target.visible ? 'Hide' : 'Show',
        icon: target.visible ? Icons.eyeOff : Icons.eye,
        action: () => updateElement(target.id, { visible: !target.visible }),
      },
      { label: '', separator: true, action: () => {} },
      { label: 'Bring to Front', action: () => moveLayer(target.id, 'top') },
      { label: 'Send to Back', action: () => moveLayer(target.id, 'bottom') },
      { label: 'Move Up', action: () => moveLayer(target.id, 'up') },
      { label: 'Move Down', action: () => moveLayer(target.id, 'down') },
    );
  } else {
    // Canvas context menu
    items.push(
      {
        label: 'Add Text',
        icon: Icons.text,
        action: () => addElement(createElement('text', { startTime: currentTime })),
      },
      {
        label: 'Add Rectangle',
        icon: Icons.square,
        action: () => addElement(createElement('shape', { startTime: currentTime })),
      },
      {
        label: 'Add Circle',
        icon: Icons.circle,
        action: () => addElement(createElement('circle', { startTime: currentTime })),
      },
    );
  }

  // Clamp position to viewport
  const menuWidth = 200;
  const menuX = Math.min(x, window.innerWidth - menuWidth - 8);
  const menuY = Math.min(y, window.innerHeight - items.length * 32 - 8);

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        left: menuX,
        top: menuY,
        width: menuWidth,
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: '4px 0',
        zIndex: 10000,
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((item, i) => {
        if (item.separator) {
          return (
            <div
              key={`sep-${i}`}
              style={{ height: 1, background: C.border, margin: '4px 8px' }}
            />
          );
        }
        return (
          <div
            key={item.label}
            onClick={() => {
              item.action();
              closeContextMenu();
            }}
            style={{
              padding: '6px 12px',
              fontSize: 11,
              color: item.danger ? C.red : C.text,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              borderRadius: 4,
              margin: '0 4px',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.background = C.surface3;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.background = 'transparent';
            }}
          >
            {item.icon && (
              <Icon d={item.icon} size={13} color={item.danger ? C.red : C.textDim} />
            )}
            <span style={{ flex: 1 }}>{item.label}</span>
            {item.shortcut && (
              <span style={{ fontSize: 9, color: C.textDim }}>{item.shortcut}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
