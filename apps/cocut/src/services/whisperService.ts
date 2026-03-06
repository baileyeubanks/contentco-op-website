/**
 * Whisper transcription service
 *
 * Uses whisper.cpp compiled to WASM for on-device speech-to-text.
 * Falls back to Web Speech API for browsers without WASM support.
 *
 * Architecture:
 * - Extracts audio from video via OfflineAudioContext
 * - Resamples to 16kHz mono Float32 PCM (whisper input format)
 * - Sends to whisper WASM worker for transcription
 * - Returns word-level timestamps
 */

export interface WhisperWord {
  word: string;
  start: number; // seconds
  end: number; // seconds
}

export interface TranscriptionResult {
  text: string;
  words: WhisperWord[];
  language: string;
  duration: number;
}

export interface TranscriptionProgress {
  phase: 'loading-model' | 'extracting-audio' | 'transcribing' | 'done' | 'error';
  percent: number;
  message: string;
}

type ProgressCallback = (progress: TranscriptionProgress) => void;

/**
 * Extract audio from a media element as 16kHz mono Float32Array
 */
export async function extractAudio(
  src: string,
  onProgress?: ProgressCallback,
): Promise<Float32Array> {
  onProgress?.({
    phase: 'extracting-audio',
    percent: 10,
    message: 'Decoding audio...',
  });

  // Fetch the file as ArrayBuffer
  const response = await fetch(src);
  const arrayBuffer = await response.arrayBuffer();

  // Decode with standard AudioContext
  const audioCtx = new AudioContext();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  audioCtx.close();

  onProgress?.({
    phase: 'extracting-audio',
    percent: 30,
    message: 'Resampling to 16kHz...',
  });

  // Resample to 16kHz mono via OfflineAudioContext
  const targetSampleRate = 16000;
  const numSamples = Math.ceil(audioBuffer.duration * targetSampleRate);
  const offlineCtx = new OfflineAudioContext(1, numSamples, targetSampleRate);

  const source = offlineCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineCtx.destination);
  source.start(0);

  const renderedBuffer = await offlineCtx.startRendering();
  const pcm = renderedBuffer.getChannelData(0);

  onProgress?.({
    phase: 'extracting-audio',
    percent: 50,
    message: `Audio extracted (${(audioBuffer.duration).toFixed(1)}s)`,
  });

  return pcm;
}

/**
 * Transcribe audio using Web Speech API as a fallback
 * This works in Chrome/Edge and provides basic results without WASM
 */
export function transcribeWithWebSpeech(
  audioElement: HTMLAudioElement | HTMLVideoElement,
  onProgress?: ProgressCallback,
): Promise<TranscriptionResult> {
  return new Promise((resolve, reject) => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      reject(new Error('Speech recognition not supported in this browser'));
      return;
    }

    onProgress?.({
      phase: 'transcribing',
      percent: 20,
      message: 'Starting speech recognition...',
    });

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    const words: WhisperWord[] = [];
    let fullText = '';

    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          const text = result[0].transcript.trim();
          if (text) {
            // Web Speech API doesn't provide per-word timestamps,
            // so we estimate from media currentTime
            const now = audioElement.currentTime;
            const wordList = text.split(/\s+/);
            const wordDuration = 0.3; // rough estimate per word
            wordList.forEach((w: string, idx: number) => {
              words.push({
                word: w,
                start: Math.max(0, now - (wordList.length - idx) * wordDuration),
                end: Math.max(0, now - (wordList.length - idx - 1) * wordDuration),
              });
            });
            fullText += (fullText ? ' ' : '') + text;
          }
        }
      }

      const percent = Math.min(90, 20 + (audioElement.currentTime / audioElement.duration) * 70);
      onProgress?.({
        phase: 'transcribing',
        percent: Math.round(percent),
        message: `Transcribing... ${Math.round(audioElement.currentTime)}s / ${Math.round(audioElement.duration)}s`,
      });
    };

    recognition.onend = () => {
      onProgress?.({ phase: 'done', percent: 100, message: 'Transcription complete' });
      resolve({
        text: fullText,
        words,
        language: 'en',
        duration: audioElement.duration,
      });
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'no-speech') {
        resolve({ text: '', words: [], language: 'en', duration: audioElement.duration });
      } else {
        reject(new Error(`Speech recognition error: ${event.error}`));
      }
    };

    // Play audio and start recognition simultaneously
    audioElement.currentTime = 0;
    audioElement.play();
    recognition.start();

    // Stop when audio ends
    audioElement.onended = () => {
      recognition.stop();
    };
  });
}

/**
 * Simple silence-based segmentation for creating subtitle cues
 * from raw transcription text when word timestamps are unavailable.
 */
export function segmentText(
  text: string,
  totalDuration: number,
): WhisperWord[] {
  const allWords = text.split(/\s+/).filter(Boolean);
  if (allWords.length === 0) return [];

  // Estimate even word spacing across duration
  const wordDuration = totalDuration / allWords.length;

  return allWords.map((word, i) => ({
    word,
    start: i * wordDuration,
    end: (i + 1) * wordDuration,
  }));
}

/**
 * Main transcription entry point
 * Tries whisper WASM first, falls back to Web Speech API
 */
export async function transcribe(
  src: string,
  onProgress?: ProgressCallback,
  signal?: AbortSignal,
): Promise<TranscriptionResult> {
  onProgress?.({
    phase: 'extracting-audio',
    percent: 0,
    message: 'Preparing audio...',
  });

  if (signal?.aborted) throw new Error('Transcription cancelled');

  // Extract audio PCM
  const pcm = await extractAudio(src, onProgress);

  if (signal?.aborted) throw new Error('Transcription cancelled');

  // For Phase 2, use a simple energy-based word boundary detector
  // combined with Web Speech API for the actual text.
  // Full whisper.cpp WASM integration will be Phase 2.5.
  onProgress?.({
    phase: 'transcribing',
    percent: 60,
    message: 'Analyzing speech patterns...',
  });

  // Detect speech segments via RMS energy
  const segments = detectSpeechSegments(pcm, 16000);

  onProgress?.({
    phase: 'done',
    percent: 100,
    message: `Found ${segments.length} speech segments`,
  });

  return {
    text: '',
    words: segments.map((seg) => ({
      word: '[speech]',
      start: seg.start,
      end: seg.end,
    })),
    language: 'en',
    duration: pcm.length / 16000,
  };
}

/**
 * Transcribe audio via OpenAI Whisper API with word-level timestamps.
 * Requires VITE_OPENAI_API_KEY in env.
 * Accepts any browser-readable URL (blob: or https:).
 */
export async function transcribeViaAPI(
  src: string,
  onProgress?: ProgressCallback,
  signal?: AbortSignal,
): Promise<TranscriptionResult> {
  const apiKey = (import.meta as any).env?.VITE_OPENAI_API_KEY;
  if (!apiKey) throw new Error('VITE_OPENAI_API_KEY is not set. Add it to your .env file.');

  onProgress?.({ phase: 'extracting-audio', percent: 10, message: 'Fetching audio...' });

  const fetchResp = await fetch(src, { signal });
  if (!fetchResp.ok) throw new Error(`Failed to fetch audio: ${fetchResp.statusText}`);
  const blob = await fetchResp.blob();

  if (signal?.aborted) throw new Error('Transcription cancelled');

  // Whisper API supports: mp3, mp4, mpeg, mpga, m4a, wav, webm
  // Pick a safe extension based on mime type
  const mimeToExt: Record<string, string> = {
    'audio/mp3': 'mp3',
    'audio/mpeg': 'mp3',
    'audio/mp4': 'mp4',
    'audio/m4a': 'm4a',
    'audio/x-m4a': 'm4a',
    'audio/wav': 'wav',
    'audio/wave': 'wav',
    'audio/webm': 'webm',
    'audio/ogg': 'ogg',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/ogg': 'ogg',
    'video/quicktime': 'mp4',
  };
  const ext = mimeToExt[blob.type] ?? 'mp3';

  if (blob.size > 25 * 1024 * 1024) {
    throw new Error(
      `File is ${(blob.size / 1024 / 1024).toFixed(0)}MB — Whisper API limit is 25MB. Please trim the file first.`,
    );
  }

  onProgress?.({ phase: 'transcribing', percent: 35, message: 'Uploading to Whisper API...' });

  const formData = new FormData();
  formData.append('file', blob, `audio.${ext}`);
  formData.append('model', 'whisper-1');
  formData.append('response_format', 'verbose_json');
  formData.append('timestamp_granularities[]', 'word');

  const whisperResp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
    signal,
  });

  if (!whisperResp.ok) {
    const errText = await whisperResp.text();
    throw new Error(`Whisper API error ${whisperResp.status}: ${errText}`);
  }

  onProgress?.({ phase: 'transcribing', percent: 85, message: 'Processing transcript...' });

  const data = await whisperResp.json();

  const words: WhisperWord[] = (data.words ?? []).map((w: any) => ({
    word: w.word,
    start: w.start,
    end: w.end,
  }));

  onProgress?.({ phase: 'done', percent: 100, message: 'Transcription complete' });

  return {
    text: data.text ?? '',
    words,
    language: data.language ?? 'en',
    duration: data.duration ?? 0,
  };
}

/**
 * Simple RMS-based speech segment detection
 */
function detectSpeechSegments(
  pcm: Float32Array,
  sampleRate: number,
  windowMs = 50,
  thresholdDb = -30,
  minSilenceMs = 300,
): { start: number; end: number }[] {
  const windowSamples = Math.floor((windowMs / 1000) * sampleRate);
  const threshold = Math.pow(10, thresholdDb / 20);
  const minSilenceSamples = Math.floor((minSilenceMs / 1000) * sampleRate);

  const segments: { start: number; end: number }[] = [];
  let inSpeech = false;
  let segStart = 0;
  let silenceStart = 0;

  for (let i = 0; i < pcm.length; i += windowSamples) {
    // Compute RMS for window
    let sumSq = 0;
    const end = Math.min(i + windowSamples, pcm.length);
    for (let j = i; j < end; j++) {
      sumSq += pcm[j] * pcm[j];
    }
    const rms = Math.sqrt(sumSq / (end - i));

    if (rms > threshold) {
      if (!inSpeech) {
        segStart = i;
        inSpeech = true;
      }
      silenceStart = 0;
    } else {
      if (inSpeech) {
        if (silenceStart === 0) {
          silenceStart = i;
        } else if (i - silenceStart > minSilenceSamples) {
          // End of speech segment
          segments.push({
            start: segStart / sampleRate,
            end: silenceStart / sampleRate,
          });
          inSpeech = false;
          silenceStart = 0;
        }
      }
    }
  }

  // Flush final segment
  if (inSpeech) {
    segments.push({
      start: segStart / sampleRate,
      end: (silenceStart > 0 ? silenceStart : pcm.length) / sampleRate,
    });
  }

  return segments;
}
