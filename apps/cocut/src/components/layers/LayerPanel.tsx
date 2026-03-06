import { C, ELEMENT_COLORS } from '../../theme/colors';
import { LAYER_PANEL_WIDTH } from '../../theme/tokens';
import { useElementStore } from '../../store/elementStore';
import type { Element } from '../../types';

export function LayerPanel() {
  const elements = useElementStore((s) => s.elements);
  const selectedIds = useElementStore((s) => s.selectedIds);
  const selectElement = useElementStore((s) => s.selectElement);

  const getLabel = (el: Element) => {
    if (el.type === 'text') return el.content.slice(0, 16);
    return el.name || el.type;
  };

  return (
    <div
      style={{
        width: LAYER_PANEL_WIDTH,
        background: C.surface,
        borderRight: `1px solid ${C.border}`,
        overflowY: 'auto',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          padding: '8px 10px',
          fontSize: 9,
          color: C.textDim,
          textTransform: 'uppercase',
          letterSpacing: 1.5,
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        Layers
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {[...elements].reverse().map((el) => (
          <div
            key={el.id}
            onClick={(e) => selectElement(el.id, e.shiftKey)}
            style={{
              padding: '6px 10px',
              background: selectedIds.has(el.id) ? C.surface3 : 'transparent',
              borderBottom: `1px solid ${C.border}`,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 10,
              opacity: el.visible ? 1 : 0.4,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: el.type === 'circle' ? 4 : 1,
                background: ELEMENT_COLORS[el.type] || C.accent,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                flex: 1,
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
                color: selectedIds.has(el.id) ? C.text : C.textDim,
              }}
            >
              {getLabel(el)}
            </span>
            {el.locked && <span style={{ fontSize: 8 }}>🔒</span>}
            {el.animation !== 'none' && (
              <span style={{ fontSize: 8, color: C.accent2 }}>◆</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
