/**
 * Voice Activity Detection (VAD) Analyzer
 *
 * Uses RMS energy analysis to detect speech vs silence regions.
 * Phase 2 will integrate @ricky0123/vad-web (Silero VAD model)
 * for ML-based speech probability detection.
 */

export interface SpeechRegion {
  start: number; // seconds
  end: number;   // seconds
  type: 'speech' | 'silence';
  rms: number;   // average RMS energy
}

export interface WaveformData {
  /** RMS values per window */
  rms: Float32Array;
  /** Peak values per window */
  peaks: Float32Array;
  /** Window size in seconds */
  windowDuration: number;
  /** Total duration in seconds */
  duration: number;
  /** Sample rate */
  sampleRate: number;
}

export interface AutoCutSettings {
  /** Minimum silence duration to qualify for removal (ms) */
  minSilenceDuration: number;
  /** Padding before speech starts (ms) */
  paddingBefore: number;
  /** Padding after speech ends (ms) */
  paddingAfter: number;
  /** RMS threshold in dB (below = silence) */
  thresholdDb: number;
  /** Whether to keep short breaths between words */
  keepBreaths: boolean;
}

export const DEFAULT_AUTOCUT_SETTINGS: AutoCutSettings = {
  minSilenceDuration: 500,
  paddingBefore: 100,
  paddingAfter: 150,
  thresholdDb: -35,
  keepBreaths: true,
};

/**
 * Extract audio waveform data from a blob URL.
 * Returns RMS + peak arrays at 50ms windows with 10ms hop.
 */
export async function analyzeWaveform(
  src: string,
  onProgress?: (percent: number) => void,
): Promise<WaveformData> {
  onProgress?.(5);

  // Fetch and decode audio
  const response = await fetch(src);
  const arrayBuffer = await response.arrayBuffer();

  onProgress?.(15);

  const audioCtx = new AudioContext();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  audioCtx.close();

  onProgress?.(30);

  const sampleRate = audioBuffer.sampleRate;
  const channelData = audioBuffer.getChannelData(0); // mono or first channel

  // 50ms windows, 10ms hop
  const windowMs = 50;
  const hopMs = 10;
  const windowSamples = Math.floor((windowMs / 1000) * sampleRate);
  const hopSamples = Math.floor((hopMs / 1000) * sampleRate);
  const numWindows = Math.floor((channelData.length - windowSamples) / hopSamples) + 1;

  const rms = new Float32Array(numWindows);
  const peaks = new Float32Array(numWindows);

  for (let w = 0; w < numWindows; w++) {
    const start = w * hopSamples;
    const end = Math.min(start + windowSamples, channelData.length);

    let sumSq = 0;
    let peak = 0;
    for (let i = start; i < end; i++) {
      const val = channelData[i];
      sumSq += val * val;
      const abs = Math.abs(val);
      if (abs > peak) peak = abs;
    }

    rms[w] = Math.sqrt(sumSq / (end - start));
    peaks[w] = peak;

    if (w % 1000 === 0) {
      onProgress?.(30 + Math.round((w / numWindows) * 60));
    }
  }

  onProgress?.(100);

  return {
    rms,
    peaks,
    windowDuration: hopMs / 1000,
    duration: audioBuffer.duration,
    sampleRate,
  };
}

/**
 * Detect speech and silence regions from waveform data.
 */
export function detectRegions(
  waveform: WaveformData,
  settings: AutoCutSettings,
): SpeechRegion[] {
  const threshold = Math.pow(10, settings.thresholdDb / 20);
  const minSilenceWindows = Math.ceil(
    settings.minSilenceDuration / 1000 / waveform.windowDuration,
  );

  const regions: SpeechRegion[] = [];
  let currentType: 'speech' | 'silence' = 'silence';
  let regionStart = 0;
  let silenceCounter = 0;
  let regionRmsSum = 0;
  let regionSamples = 0;

  for (let i = 0; i < waveform.rms.length; i++) {
    const isSpeech = waveform.rms[i] > threshold;
    const time = i * waveform.windowDuration;

    if (currentType === 'silence') {
      if (isSpeech) {
        // Transition: silence → speech
        if (regionSamples > 0 && silenceCounter >= minSilenceWindows) {
          regions.push({
            start: regionStart,
            end: time,
            type: 'silence',
            rms: regionRmsSum / regionSamples,
          });
        }
        currentType = 'speech';
        regionStart = time;
        regionRmsSum = 0;
        regionSamples = 0;
        silenceCounter = 0;
      } else {
        silenceCounter++;
        regionRmsSum += waveform.rms[i];
        regionSamples++;
      }
    } else {
      // Currently in speech
      if (!isSpeech) {
        silenceCounter++;
        if (silenceCounter >= minSilenceWindows) {
          // Transition: speech → silence
          const silenceStart = time - silenceCounter * waveform.windowDuration;
          regions.push({
            start: regionStart,
            end: silenceStart,
            type: 'speech',
            rms: regionRmsSum / (regionSamples || 1),
          });
          currentType = 'silence';
          regionStart = silenceStart;
          regionRmsSum = 0;
          regionSamples = 0;
        }
      } else {
        silenceCounter = 0;
      }
      regionRmsSum += waveform.rms[i];
      regionSamples++;
    }
  }

  // Flush final region
  const endTime = waveform.rms.length * waveform.windowDuration;
  if (regionSamples > 0) {
    regions.push({
      start: regionStart,
      end: endTime,
      type: currentType,
      rms: regionRmsSum / regionSamples,
    });
  }

  return regions;
}

/**
 * Apply padding to speech regions.
 * Extends speech regions by paddingBefore/After, merging overlaps.
 */
export function applyPadding(
  regions: SpeechRegion[],
  settings: AutoCutSettings,
  duration: number,
): SpeechRegion[] {
  const padBefore = settings.paddingBefore / 1000;
  const padAfter = settings.paddingAfter / 1000;

  // Get speech regions only, with padding applied
  const speechRegions = regions
    .filter((r) => r.type === 'speech')
    .map((r) => ({
      ...r,
      start: Math.max(0, r.start - padBefore),
      end: Math.min(duration, r.end + padAfter),
    }));

  // Merge overlapping speech regions
  const merged: SpeechRegion[] = [];
  for (const region of speechRegions) {
    const last = merged[merged.length - 1];
    if (last && region.start <= last.end) {
      last.end = Math.max(last.end, region.end);
      last.rms = (last.rms + region.rms) / 2;
    } else {
      merged.push({ ...region });
    }
  }

  // Rebuild full region list with silence gaps
  const result: SpeechRegion[] = [];
  let pos = 0;

  for (const speech of merged) {
    if (speech.start > pos) {
      result.push({
        start: pos,
        end: speech.start,
        type: 'silence',
        rms: 0,
      });
    }
    result.push(speech);
    pos = speech.end;
  }

  if (pos < duration) {
    result.push({
      start: pos,
      end: duration,
      type: 'silence',
      rms: 0,
    });
  }

  return result;
}

/**
 * Get statistics about detected regions.
 */
export function getRegionStats(regions: SpeechRegion[]): {
  speechDuration: number;
  silenceDuration: number;
  speechCount: number;
  silenceCount: number;
  removedPercent: number;
} {
  let speechDuration = 0;
  let silenceDuration = 0;
  let speechCount = 0;
  let silenceCount = 0;

  for (const r of regions) {
    const dur = r.end - r.start;
    if (r.type === 'speech') {
      speechDuration += dur;
      speechCount++;
    } else {
      silenceDuration += dur;
      silenceCount++;
    }
  }

  const total = speechDuration + silenceDuration;
  return {
    speechDuration,
    silenceDuration,
    speechCount,
    silenceCount,
    removedPercent: total > 0 ? Math.round((silenceDuration / total) * 100) : 0,
  };
}
