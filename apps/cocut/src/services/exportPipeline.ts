/**
 * Export Pipeline — Renders project to MP4 via FFmpeg.wasm.
 *
 * Architecture:
 * 1. Create an offscreen <canvas> at the export resolution
 * 2. For each frame (at target FPS):
 *    a. Set currentTime = frame / fps
 *    b. Render all visible elements to the canvas
 *    c. Capture frame as raw RGBA data
 * 3. Feed frames to FFmpeg.wasm for H.264 encoding
 * 4. Mux audio tracks (if any) into final MP4
 * 5. Return downloadable blob
 */

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import { useElementStore } from '../store/elementStore';
import { usePlaybackStore } from '../store/playbackStore';
import type { Element, SubtitleElement } from '../types';

export interface ExportSettings {
  width: number;
  height: number;
  fps: number;
  videoBitrate: string; // e.g. '4M'
  audioBitrate: string; // e.g. '128k'
  format: 'mp4' | 'webm';
}

export const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
  width: 1920,
  height: 1080,
  fps: 30,
  videoBitrate: '5M',
  audioBitrate: '192k',
  format: 'mp4',
};

export type ExportProgress = {
  phase: 'loading' | 'rendering' | 'encoding' | 'muxing' | 'done' | 'error';
  percent: number;
  currentFrame: number;
  totalFrames: number;
  message: string;
};

type ProgressCallback = (progress: ExportProgress) => void;

let ffmpegInstance: FFmpeg | null = null;

async function getFFmpeg(onProgress?: ProgressCallback): Promise<FFmpeg> {
  if (ffmpegInstance && ffmpegInstance.loaded) return ffmpegInstance;

  const ffmpeg = new FFmpeg();

  ffmpeg.on('log', ({ message }) => {
    // Parse encoding progress from FFmpeg logs
    if (message.includes('frame=')) {
      const match = message.match(/frame=\s*(\d+)/);
      if (match && onProgress) {
        onProgress({
          phase: 'encoding',
          percent: 0,
          currentFrame: parseInt(match[1]),
          totalFrames: 0,
          message: message.trim(),
        });
      }
    }
  });

  onProgress?.({
    phase: 'loading',
    percent: 0,
    currentFrame: 0,
    totalFrames: 0,
    message: 'Loading FFmpeg.wasm...',
  });

  // Load FFmpeg WASM - use CDN for the core
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });

  ffmpegInstance = ffmpeg;
  return ffmpeg;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * Pre-load all images and video elements for rendering.
 * Returns maps of element ID → loaded resource.
 */
async function preloadAssets(elements: Element[]): Promise<{
  images: Map<string, HTMLImageElement>;
  videos: Map<string, HTMLVideoElement>;
}> {
  const images = new Map<string, HTMLImageElement>();
  const videos = new Map<string, HTMLVideoElement>();

  const promises: Promise<void>[] = [];

  for (const el of elements) {
    if (el.type === 'image' && el.src) {
      promises.push(
        new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            images.set(el.id, img);
            resolve();
          };
          img.onerror = () => resolve();
          img.src = el.src;
        }),
      );
    }
    if (el.type === 'video' && el.src) {
      promises.push(
        new Promise((resolve) => {
          const video = document.createElement('video');
          video.crossOrigin = 'anonymous';
          video.muted = true;
          video.preload = 'auto';
          video.playsInline = true;
          video.onloadeddata = () => {
            videos.set(el.id, video);
            resolve();
          };
          video.onerror = () => resolve();
          video.src = el.src;
        }),
      );
    }
  }

  await Promise.all(promises);
  return { images, videos };
}

/**
 * Render frame with pre-loaded assets (images + video frames).
 */
function renderFrameWithAssets(
  ctx: CanvasRenderingContext2D,
  elements: Element[],
  currentTime: number,
  width: number,
  height: number,
  images: Map<string, HTMLImageElement>,
  videos: Map<string, HTMLVideoElement>,
): void {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#111827';
  ctx.fillRect(0, 0, width, height);

  for (const el of elements) {
    if (!el.visible) continue;
    const isInTime = currentTime >= el.startTime && currentTime < el.startTime + el.duration;
    if (!isInTime) continue;

    ctx.save();
    ctx.translate(el.x + el.width / 2, el.y + el.height / 2);
    ctx.rotate((el.rotation * Math.PI) / 180);
    ctx.globalAlpha = el.opacity;

    if (el.blendMode !== 'normal') {
      ctx.globalCompositeOperation = el.blendMode as GlobalCompositeOperation;
    }

    const x = -el.width / 2;
    const y = -el.height / 2;

    if (el.type === 'text') {
      ctx.fillStyle = el.color;
      ctx.font = `${el.fontWeight} ${el.fontSize}px ${el.fontFamily}`;
      ctx.textAlign = el.textAlign as CanvasTextAlign;
      ctx.textBaseline = 'middle';
      const textX =
        el.textAlign === 'center' ? 0 : el.textAlign === 'right' ? el.width / 2 : -el.width / 2;
      const words = el.content.split(' ');
      const lines: string[] = [];
      let currentLine = '';
      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        if (ctx.measureText(testLine).width > el.width && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) lines.push(currentLine);
      const lineHeight = el.fontSize * 1.2;
      const startY = -(lines.length * lineHeight) / 2 + lineHeight / 2;
      lines.forEach((line, i) => ctx.fillText(line, textX, startY + i * lineHeight));
    } else if (el.type === 'shape') {
      ctx.fillStyle = el.fill;
      if (el.borderRadius > 0) {
        roundRect(ctx, x, y, el.width, el.height, el.borderRadius);
        ctx.fill();
      } else {
        ctx.fillRect(x, y, el.width, el.height);
      }
      if (el.stroke !== 'none') {
        ctx.strokeStyle = el.stroke;
        ctx.lineWidth = el.strokeWidth;
        ctx.strokeRect(x, y, el.width, el.height);
      }
    } else if (el.type === 'circle') {
      ctx.fillStyle = el.fill;
      ctx.beginPath();
      ctx.ellipse(0, 0, el.width / 2, el.height / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      if (el.stroke !== 'none') {
        ctx.strokeStyle = el.stroke;
        ctx.lineWidth = el.strokeWidth;
        ctx.stroke();
      }
    } else if (el.type === 'image') {
      const img = images.get(el.id);
      if (img) {
        ctx.drawImage(img, x, y, el.width, el.height);
      }
    } else if (el.type === 'video') {
      const video = videos.get(el.id);
      if (video) {
        ctx.drawImage(video, x, y, el.width, el.height);
      }
    } else if (el.type === 'subtitle') {
      // Subtitle burn-in: render active cues
      const subEl = el as SubtitleElement;
      for (const cue of subEl.cues) {
        const cueActive = currentTime >= cue.startTime && currentTime <= cue.endTime;
        if (!cueActive) continue;

        ctx.restore(); // Restore from element transform
        ctx.save();

        // Position subtitle text
        const subFontSize = subEl.fontSize;
        ctx.font = `600 ${subFontSize}px ${subEl.fontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const textWidth = ctx.measureText(cue.text).width;
        const padX = 20;
        const padY = 10;

        let textY: number;
        if (subEl.position === 'top') {
          textY = height * 0.08;
        } else if (subEl.position === 'center') {
          textY = height / 2;
        } else {
          textY = height * 0.9;
        }

        // Background box
        ctx.fillStyle = subEl.backgroundColor;
        ctx.fillRect(
          width / 2 - textWidth / 2 - padX,
          textY - subFontSize / 2 - padY,
          textWidth + padX * 2,
          subFontSize + padY * 2,
        );

        // Text with shadow
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetY = 2;
        ctx.fillStyle = subEl.color;
        ctx.fillText(cue.text, width / 2, textY);
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;

        ctx.restore();
        ctx.save();
        // Re-apply element transform for any remaining cues
        ctx.translate(el.x + el.width / 2, el.y + el.height / 2);
        ctx.rotate((el.rotation * Math.PI) / 180);
        ctx.globalAlpha = el.opacity;
      }
    }

    ctx.restore();
  }
}

/**
 * Seek a video element to a specific time and wait for it to be ready.
 */
function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    if (Math.abs(video.currentTime - time) < 0.02) {
      resolve();
      return;
    }
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      resolve();
    };
    video.addEventListener('seeked', onSeeked);
    video.currentTime = time;
  });
}

/**
 * Main export function.
 * Renders all frames and encodes to MP4 via FFmpeg.wasm.
 */
export async function exportProject(
  settings: ExportSettings,
  onProgress: ProgressCallback,
  abortSignal?: AbortSignal,
): Promise<Blob> {
  const elements = useElementStore.getState().elements;
  const duration = usePlaybackStore.getState().duration;
  const totalFrames = Math.ceil(duration * settings.fps);

  // Phase 1: Load FFmpeg
  const ffmpeg = await getFFmpeg(onProgress);

  onProgress({
    phase: 'rendering',
    percent: 0,
    currentFrame: 0,
    totalFrames,
    message: 'Pre-loading assets...',
  });

  // Phase 2: Pre-load assets
  const { images, videos } = await preloadAssets(elements);

  // Create offscreen canvas
  const canvas = document.createElement('canvas');
  canvas.width = settings.width;
  canvas.height = settings.height;
  const ctx = canvas.getContext('2d')!;

  onProgress({
    phase: 'rendering',
    percent: 0,
    currentFrame: 0,
    totalFrames,
    message: 'Rendering frames...',
  });

  // Phase 3: Render frames to raw RGBA
  const frameData: Uint8Array[] = [];

  for (let frame = 0; frame < totalFrames; frame++) {
    if (abortSignal?.aborted) throw new Error('Export cancelled');

    const currentTime = frame / settings.fps;

    // Seek all video elements to the correct time
    const seekPromises: Promise<void>[] = [];
    for (const el of elements) {
      if (el.type === 'video' && el.visible) {
        const video = videos.get(el.id);
        if (video) {
          const isInTime = currentTime >= el.startTime && currentTime < el.startTime + el.duration;
          if (isInTime) {
            const sourceTime = el.trimIn + (currentTime - el.startTime) * (el.playbackRate || 1);
            seekPromises.push(seekVideo(video, sourceTime));
          }
        }
      }
    }
    await Promise.all(seekPromises);

    // Render the frame
    renderFrameWithAssets(ctx, elements, currentTime, settings.width, settings.height, images, videos);

    // Capture frame data
    const imageData = ctx.getImageData(0, 0, settings.width, settings.height);
    frameData.push(new Uint8Array(imageData.data.buffer));

    onProgress({
      phase: 'rendering',
      percent: Math.round((frame / totalFrames) * 50),
      currentFrame: frame,
      totalFrames,
      message: `Rendering frame ${frame + 1} / ${totalFrames}`,
    });
  }

  // Phase 4: Write raw frames to FFmpeg virtual FS and encode
  onProgress({
    phase: 'encoding',
    percent: 50,
    currentFrame: 0,
    totalFrames,
    message: 'Writing frame data...',
  });

  // Write each frame as a raw RGBA file
  for (let i = 0; i < frameData.length; i++) {
    if (abortSignal?.aborted) throw new Error('Export cancelled');
    const paddedIndex = String(i).padStart(6, '0');
    await ffmpeg.writeFile(`frame_${paddedIndex}.rgba`, frameData[i]);

    if (i % 10 === 0) {
      onProgress({
        phase: 'encoding',
        percent: 50 + Math.round((i / frameData.length) * 20),
        currentFrame: i,
        totalFrames: frameData.length,
        message: `Writing frame ${i + 1} / ${frameData.length}`,
      });
    }
  }

  // Phase 5: Encode with FFmpeg
  onProgress({
    phase: 'encoding',
    percent: 70,
    currentFrame: 0,
    totalFrames,
    message: 'Encoding video...',
  });

  const outputFile = `output.${settings.format}`;

  // Build FFmpeg command
  const args = [
    '-f', 'rawvideo',
    '-pixel_format', 'rgba',
    '-video_size', `${settings.width}x${settings.height}`,
    '-framerate', String(settings.fps),
    '-i', 'frame_%06d.rgba',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-b:v', settings.videoBitrate,
    '-preset', 'fast',
    '-movflags', '+faststart',
    outputFile,
  ];

  await ffmpeg.exec(args);

  onProgress({
    phase: 'encoding',
    percent: 95,
    currentFrame: totalFrames,
    totalFrames,
    message: 'Reading output...',
  });

  // Phase 6: Read output file
  const data = await ffmpeg.readFile(outputFile);
  // Handle SharedArrayBuffer from FFmpeg.wasm — copy to regular ArrayBuffer for Blob
  const rawData = data instanceof Uint8Array
    ? (data.buffer instanceof SharedArrayBuffer ? new Uint8Array(data).buffer : data.buffer)
    : data;
  const blob = new Blob([rawData], { type: settings.format === 'mp4' ? 'video/mp4' : 'video/webm' });

  // Cleanup FFmpeg virtual FS
  for (let i = 0; i < frameData.length; i++) {
    const paddedIndex = String(i).padStart(6, '0');
    try {
      await ffmpeg.deleteFile(`frame_${paddedIndex}.rgba`);
    } catch {}
  }
  try {
    await ffmpeg.deleteFile(outputFile);
  } catch {}

  onProgress({
    phase: 'done',
    percent: 100,
    currentFrame: totalFrames,
    totalFrames,
    message: 'Export complete!',
  });

  return blob;
}

/**
 * Trigger a browser download of a blob.
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
