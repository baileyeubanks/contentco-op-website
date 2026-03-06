import { useState, useEffect } from 'react';
import { C } from '../../theme/colors';
import { FONT_FAMILY } from '../../theme/tokens';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { Icons } from '../../theme/icons';
import {
  listCloudProjects,
  saveProjectToCloud,
  loadProjectFromCloud,
  deleteProjectFromCloud,
  type CloudProject,
} from '../../services/supabaseProjectService';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ProjectManager({ open, onClose }: Props) {
  const [projects, setProjects] = useState<CloudProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveName, setSaveName] = useState('');

  useEffect(() => {
    if (open) {
      setLoading(true);
      listCloudProjects().then((p) => {
        setProjects(p);
        setLoading(false);
      });
    }
  }, [open]);

  if (!open) return null;

  const handleSave = async () => {
    if (!saveName.trim()) return;
    setSaving(true);
    await saveProjectToCloud(saveName.trim());
    const updated = await listCloudProjects();
    setProjects(updated);
    setSaving(false);
    setSaveName('');
  };

  const handleLoad = async (id: string) => {
    setLoading(true);
    await loadProjectFromCloud(id);
    setLoading(false);
    onClose();
  };

  const handleDelete = async (id: string) => {
    await deleteProjectFromCloud(id);
    setProjects((prev) => prev.filter((p) => p.id !== id));
  };

  const overlay: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3000,
    fontFamily: FONT_FAMILY,
  };

  const modal: React.CSSProperties = {
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 12,
    width: 480,
    maxHeight: '70vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Cloud Projects</span>
          <Button small onClick={onClose}><Icon d={Icons.close} size={14} /></Button>
        </div>

        <div style={{ padding: '12px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', gap: 8 }}>
          <input
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder="Project name..."
            style={{
              flex: 1, background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 6,
              padding: '6px 10px', color: C.text, fontSize: 12, outline: 'none',
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
          <Button small onClick={handleSave}>
            {saving ? '...' : 'Save Current'}
          </Button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
          {loading ? (
            <div style={{ padding: 20, textAlign: 'center', color: C.textDim, fontSize: 12 }}>Loading...</div>
          ) : projects.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: C.textDim, fontSize: 12 }}>
              No cloud projects yet. Save your current project above.
            </div>
          ) : (
            projects.map((p) => (
              <div
                key={p.id}
                style={{
                  padding: '10px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  borderBottom: `1px solid ${C.border}`,
                  cursor: 'pointer',
                }}
                onDoubleClick={() => handleLoad(p.id)}
              >
                <Icon d={Icons.film} size={14} color={C.accent2} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: C.text }}>{p.name}</div>
                  <div style={{ fontSize: 10, color: C.textDim }}>
                    {new Date(p.updated_at).toLocaleDateString()} {new Date(p.updated_at).toLocaleTimeString()}
                  </div>
                </div>
                <Button small onClick={() => handleLoad(p.id)}>Open</Button>
                <Button small onClick={() => handleDelete(p.id)}>
                  <Icon d={Icons.trash} size={12} color={C.red} />
                </Button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
