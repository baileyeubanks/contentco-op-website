import { useEffect } from 'react';
import { C } from './theme/colors';
import { FONT_FAMILY } from './theme/tokens';
import { Toolbar } from './components/toolbar/Toolbar';
import { CanvasViewport } from './components/canvas/CanvasViewport';
import { LayerPanel } from './components/layers/LayerPanel';
import { PropertiesPanel } from './components/properties/PropertiesPanel';
import { TimelinePanel } from './components/timeline/TimelinePanel';
import { MediaBin } from './components/media/MediaBin';
import { ContextMenu } from './components/ui/ContextMenu';
import { NewProjectDialog } from './components/ui/NewProjectDialog';
import { AIAssistant } from './components/ai/AIAssistant';
import { ExportDialog } from './components/export/ExportDialog';
import { SubtitleEditor } from './components/subtitles/SubtitleEditor';
import { AutoCutPanel } from './components/autocut/AutoCutPanel';
import { LoginPage } from './components/auth/LoginPage';
import { ProjectManager } from './components/projects/ProjectManager';
import { useAuth } from './hooks/useAuth';
import { usePlayback } from './hooks/usePlayback';
import { useKeyboard } from './hooks/useKeyboard';
import { loadProject, startAutosave, stopAutosave } from './services/projectService';
import { useUIStore } from './store/uiStore';
import { CutView } from './components/cut/CutView';
import { coopAI } from './services/aiEngine';

// Configure AI engine from environment variables
coopAI.configure({
  apiKeys: {
    google: import.meta.env.VITE_GOOGLE_API_KEY || '',
    anthropic: import.meta.env.VITE_ANTHROPIC_API_KEY || '',
    openai: import.meta.env.VITE_OPENAI_API_KEY || '',
  },
  proxyUrl: import.meta.env.VITE_AI_PROXY_URL || undefined,
});

export default function App() {
  const { user, loading: authLoading } = useAuth();
  usePlayback();
  useKeyboard();

  const appMode = useUIStore((s) => s.appMode);
  const showMediaBin = useUIStore((s) => s.showMediaBin);
  const showSubtitleEditor = useUIStore((s) => s.showSubtitleEditor);
  const showAutoCut = useUIStore((s) => s.showAutoCut);
  const showProjectManager = useUIStore((s) => s.showProjectManager);

  useEffect(() => {
    // Try to restore auto-saved project. If nothing saved, show blank canvas
    loadProject().then((loaded) => {
      if (!loaded) {
        // Show new project dialog on first visit
        const hasVisited = localStorage.getItem('coedit-visited');
        if (!hasVisited) {
          useUIStore.getState().setShowNewProjectDialog(true);
          localStorage.setItem('coedit-visited', '1');
        }
      }
    });
    startAutosave();
    return () => stopAutosave();
  }, []);

  // Auth loading spinner
  if (authLoading) {
    return (
      <div style={{
        width: '100%', height: '100vh', background: '#0c1322',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ color: '#6b9fd4', fontSize: 14, fontFamily: "Inter, -apple-system, sans-serif" }}>
          Loading...
        </div>
      </div>
    );
  }

  // Not authenticated — show login
  if (!user) {
    return <LoginPage />;
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100vh',
        background: C.bg,
        color: C.text,
        fontFamily: FONT_FAMILY,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontSize: 12,
      }}
    >
      <Toolbar />

      {/* ── Cut mode: full-screen soundbite engine ── */}
      {appMode === 'cut' ? (
        <CutView />
      ) : (
        <>
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            <LayerPanel />
            <CanvasViewport />
            <PropertiesPanel />
          </div>

          <TimelinePanel />
          {showMediaBin && <MediaBin />}
        </>
      )}

      {/* These float over both modes */}
      {appMode === 'edit' && showSubtitleEditor && (
        <div
          style={{
            position: 'fixed',
            right: 260,
            bottom: 200,
            width: 340,
            maxHeight: 500,
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
            overflow: 'hidden',
            zIndex: 2000,
          }}
        >
          <SubtitleEditor />
        </div>
      )}
      {appMode === 'edit' && showAutoCut && (
        <div
          style={{
            position: 'fixed',
            right: 260,
            bottom: 200,
            width: 320,
            maxHeight: 460,
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
            overflow: 'hidden',
            zIndex: 2000,
          }}
        >
          <AutoCutPanel />
        </div>
      )}
      <ContextMenu />
      <NewProjectDialog />
      <ExportDialog />
      <AIAssistant />
      <ProjectManager
        open={showProjectManager}
        onClose={() => useUIStore.setState({ showProjectManager: false })}
      />
    </div>
  );
}
