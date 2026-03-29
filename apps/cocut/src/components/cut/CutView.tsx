import { useEffect } from 'react';
import { C } from '../../theme/colors';
import { useCutStore } from '../../store/cutStore';
import { UploadZone } from './UploadZone';
import { InterviewWaveform } from './InterviewWaveform';
import { TranscriptPanel } from './TranscriptPanel';
import { SoundbiteList } from './SoundbiteList';
import { SaveSoundbiteModal } from './SaveSoundbiteModal';
import { ExportModal } from './ExportModal';

export function CutView() {
  const audioUrl = useCutStore((s) => s.audioUrl);
  const showSaveModal = useCutStore((s) => s.showSaveModal);
  const showExportModal = useCutStore((s) => s.showExportModal);

  // Global keyboard shortcuts for Cut mode
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const tag = target.tagName;
      // Don't steal keys from inputs/textareas
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      const store = useCutStore.getState();

      // Export: Cmd/Ctrl + E
      if ((e.metaKey || e.ctrlKey) && e.code === 'KeyE') {
        e.preventDefault();
        e.stopPropagation();
        store.setShowExportModal(true);
        return;
      }

      switch (e.code) {
        case 'Space': {
          e.preventDefault();
          e.stopPropagation();
          store.setIsPlaying(!store.isPlaying);
          break;
        }
        case 'KeyI': {
          e.preventDefault();
          e.stopPropagation();
          store.setMarkerIn(store.currentTime);
          break;
        }
        case 'KeyO': {
          e.preventDefault();
          e.stopPropagation();
          store.setMarkerOut(store.currentTime);
          if (store.markers.in !== null) {
            // Auto-open save modal when both markers are set
            setTimeout(() => useCutStore.getState().setShowSaveModal(true), 50);
          }
          break;
        }
        case 'Enter': {
          // Only open save modal if not already showing and markers are set
          if (!store.showSaveModal && store.markers.in !== null && store.markers.out !== null) {
            e.preventDefault();
            e.stopPropagation();
            store.setShowSaveModal(true);
          }
          break;
        }
        case 'Escape': {
          if (store.showSaveModal) {
            e.preventDefault();
            store.setShowSaveModal(false);
          } else if (store.showExportModal) {
            e.preventDefault();
            store.setShowExportModal(false);
          }
          break;
        }
        case 'ArrowLeft': {
          e.preventDefault();
          store.seekToTime(Math.max(0, store.currentTime - (e.shiftKey ? 10 : 1)));
          break;
        }
        case 'ArrowRight': {
          e.preventDefault();
          store.seekToTime(Math.min(store.duration, store.currentTime + (e.shiftKey ? 10 : 1)));
          break;
        }
      }
    };

    // capture: true so Cut mode shortcuts fire before editor shortcuts
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, []);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: C.bg,
        overflow: 'hidden',
      }}
    >
      {!audioUrl ? (
        /* Empty state — show upload zone full height */
        <UploadZone />
      ) : (
        <>
          {/* Waveform + transport */}
          <InterviewWaveform />

          {/* Transcript + Soundbite list */}
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            <TranscriptPanel />
            <SoundbiteList />
          </div>
        </>
      )}

      {/* Modals */}
      {showSaveModal && <SaveSoundbiteModal />}
      {showExportModal && <ExportModal />}
    </div>
  );
}
