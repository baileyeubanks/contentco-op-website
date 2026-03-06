import { useCallback } from 'react';
import { C, ELEMENT_COLORS } from '../../theme/colors';
import { Icons } from '../../theme/icons';
import { MEDIA_BIN_HEIGHT } from '../../theme/tokens';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/Button';
import { useMediaStore } from '../../store/mediaStore';
import { useElementStore } from '../../store/elementStore';
import { usePlaybackStore } from '../../store/playbackStore';
import { useTimelineStore } from '../../store/timelineStore';
import { uid } from '../../utils/uid';
import { createVideoElement, createImageElement, createAudioElement } from '../../utils/elementFactory';
import { formatTimeShort } from '../../utils/formatTime';
import type { MediaAsset } from '../../types';

async function getMediaMetadata(file: File): Promise<Partial<MediaAsset>> {
  return new Promise((resolve) => {
    if (file.type.startsWith('video/')) {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        // Generate thumbnail
        video.currentTime = video.duration * 0.25;
        video.onseeked = () => {
          const canvas = document.createElement('canvas');
          canvas.width = 120;
          canvas.height = 68;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(video, 0, 0, 120, 68);
          const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.7);
          URL.revokeObjectURL(video.src);
          resolve({
            type: 'video',
            duration: video.duration,
            width: video.videoWidth,
            height: video.videoHeight,
            thumbnailUrl,
          });
        };
      };
      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        resolve({ type: 'video' });
      };
      video.src = URL.createObjectURL(file);
    } else if (file.type.startsWith('image/')) {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 120;
        canvas.height = 68;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, 120, 68);
        const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.7);
        URL.revokeObjectURL(img.src);
        resolve({
          type: 'image',
          width: img.naturalWidth,
          height: img.naturalHeight,
          thumbnailUrl,
        });
      };
      img.onerror = () => {
        URL.revokeObjectURL(img.src);
        resolve({ type: 'image' });
      };
      img.src = URL.createObjectURL(file);
    } else if (file.type.startsWith('audio/')) {
      const audioCtx = new AudioContext();
      file.arrayBuffer().then((buf) => {
        audioCtx.decodeAudioData(buf).then((audioBuf) => {
          audioCtx.close();
          resolve({
            type: 'audio',
            duration: audioBuf.duration,
          });
        }).catch(() => {
          audioCtx.close();
          resolve({ type: 'audio' });
        });
      });
    } else {
      resolve({});
    }
  });
}

export function MediaBin() {
  const assets = useMediaStore((s) => s.assets);
  const addAsset = useMediaStore((s) => s.addAsset);
  const loading = useMediaStore((s) => s.loading);
  const setLoading = useMediaStore((s) => s.setLoading);
  const addElement = useElementStore((s) => s.addElement);
  const currentTime = usePlaybackStore((s) => s.currentTime);
  const duration = usePlaybackStore((s) => s.duration);
  const setDuration = usePlaybackStore((s) => s.setDuration);
  const addTrack = useTimelineStore((s) => s.addTrack);

  const handleFiles = useCallback(
    async (files: FileList) => {
      setLoading(true);
      for (const file of Array.from(files)) {
        const meta = await getMediaMetadata(file);
        const blobUrl = URL.createObjectURL(file);
        const assetId = uid();
        const asset: MediaAsset = {
          id: assetId,
          name: file.name,
          type: meta.type || 'video',
          mimeType: file.type,
          size: file.size,
          duration: meta.duration,
          width: meta.width,
          height: meta.height,
          thumbnailUrl: meta.thumbnailUrl,
          blobKey: blobUrl,
        };
        addAsset(asset);
      }
      setLoading(false);
    },
    [addAsset, setLoading],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles],
  );

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'video/*,image/*,audio/*';
    input.onchange = () => {
      if (input.files) handleFiles(input.files);
    };
    input.click();
  };

  const addToTimeline = (asset: MediaAsset) => {
    if (asset.type === 'video') {
      const trackId = addTrack('video');
      const mediaDuration = asset.duration || 10;
      const el = createVideoElement({
        name: asset.name,
        mediaAssetId: asset.id,
        src: asset.blobKey,
        startTime: currentTime,
        duration: mediaDuration,
        trimOut: mediaDuration,
        width: asset.width || 1920,
        height: asset.height || 1080,
        trackId,
      });
      addElement(el);
      if (currentTime + mediaDuration > duration) setDuration(currentTime + mediaDuration + 5);
    } else if (asset.type === 'image') {
      const trackId = addTrack('graphic');
      const el = createImageElement({
        name: asset.name,
        mediaAssetId: asset.id,
        src: asset.blobKey,
        startTime: currentTime,
        duration: 5,
        width: asset.width ? Math.min(asset.width, 800) : 400,
        height: asset.height ? Math.min(asset.height, 600) : 300,
        trackId,
      });
      addElement(el);
    } else if (asset.type === 'audio') {
      const trackId = addTrack('audio');
      const mediaDuration = asset.duration || 10;
      const el = createAudioElement({
        name: asset.name,
        mediaAssetId: asset.id,
        src: asset.blobKey,
        startTime: currentTime,
        duration: mediaDuration,
        trimOut: mediaDuration,
        trackId,
      });
      addElement(el);
      if (currentTime + mediaDuration > duration) setDuration(currentTime + mediaDuration + 5);
    }
  };

  return (
    <div
      style={{
        height: MEDIA_BIN_HEIGHT,
        background: C.surface,
        borderTop: `1px solid ${C.border}`,
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '6px 10px',
          borderBottom: `1px solid ${C.border}`,
          gap: 8,
        }}
      >
        <Icon d={Icons.folder} size={13} color={C.textDim} />
        <span style={{ fontSize: 9, color: C.textDim, textTransform: 'uppercase', letterSpacing: 1.5 }}>
          Media Bin
        </span>
        <div style={{ flex: 1 }} />
        <Button small onClick={handleImport}>
          <Icon d={Icons.upload} size={12} /> Import
        </Button>
      </div>

      <div
        style={{
          flex: 1,
          display: 'flex',
          gap: 8,
          padding: 8,
          overflowX: 'auto',
          overflowY: 'hidden',
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        {assets.length === 0 && (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: 8,
              color: C.textDim,
              fontSize: 11,
              border: `2px dashed ${C.border}`,
              borderRadius: 8,
              cursor: 'pointer',
            }}
            onClick={handleImport}
          >
            <Icon d={Icons.upload} size={24} color={C.border2} />
            {loading ? 'Loading...' : 'Drop files here or click to import'}
          </div>
        )}

        {assets.map((asset) => (
          <div
            key={asset.id}
            onClick={() => addToTimeline(asset)}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('application/coedit-asset', asset.id);
              e.dataTransfer.effectAllowed = 'copy';
            }}
            style={{
              width: 120,
              flexShrink: 0,
              cursor: 'grab',
              borderRadius: 6,
              overflow: 'hidden',
              border: `1px solid ${C.border}`,
              background: C.surface2,
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.borderColor = C.accent;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.borderColor = C.border;
            }}
          >
            <div
              style={{
                width: 120,
                height: 68,
                background: asset.thumbnailUrl
                  ? `url(${asset.thumbnailUrl}) center/cover`
                  : C.surface3,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {!asset.thumbnailUrl && (
                <Icon
                  d={asset.type === 'video' ? Icons.film : asset.type === 'audio' ? Icons.music : Icons.image}
                  size={20}
                  color={ELEMENT_COLORS[asset.type] || C.textDim}
                />
              )}
            </div>
            <div style={{ padding: '4px 6px' }}>
              <div
                style={{
                  fontSize: 9,
                  color: C.text,
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                }}
              >
                {asset.name}
              </div>
              {asset.duration && (
                <div style={{ fontSize: 8, color: C.textDim }}>
                  {formatTimeShort(asset.duration)}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
