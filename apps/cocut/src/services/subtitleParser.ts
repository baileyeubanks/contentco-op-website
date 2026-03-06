import { uid } from '../utils/uid';
import type { SubtitleCue } from '../types';

/**
 * Parse SRT (SubRip) format into cues
 */
export function parseSRT(text: string): SubtitleCue[] {
  const blocks = text.trim().split(/\n\s*\n/);
  const cues: SubtitleCue[] = [];

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 3) continue;

    // Line 1: index (skip)
    // Line 2: timestamps
    const timeLine = lines[1];
    const match = timeLine.match(
      /(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/,
    );
    if (!match) continue;

    const startTime =
      parseInt(match[1]) * 3600 +
      parseInt(match[2]) * 60 +
      parseInt(match[3]) +
      parseInt(match[4]) / 1000;

    const endTime =
      parseInt(match[5]) * 3600 +
      parseInt(match[6]) * 60 +
      parseInt(match[7]) +
      parseInt(match[8]) / 1000;

    // Lines 3+: text (strip HTML tags)
    const cueText = lines
      .slice(2)
      .join('\n')
      .replace(/<[^>]+>/g, '');

    cues.push({ id: uid(), startTime, endTime, text: cueText });
  }

  return cues;
}

/**
 * Parse WebVTT format into cues
 */
export function parseVTT(text: string): SubtitleCue[] {
  // Remove WEBVTT header and any metadata
  const headerEnd = text.indexOf('\n\n');
  if (headerEnd < 0) return [];
  const body = text.slice(headerEnd + 2);

  const blocks = body.trim().split(/\n\s*\n/);
  const cues: SubtitleCue[] = [];

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    let timeLineIdx = 0;

    // Find the timestamp line (may have optional cue ID before it)
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('-->')) {
        timeLineIdx = i;
        break;
      }
    }

    const timeLine = lines[timeLineIdx];
    if (!timeLine?.includes('-->')) continue;

    // VTT timestamps can be HH:MM:SS.mmm or MM:SS.mmm
    const match = timeLine.match(
      /(?:(\d{2}):)?(\d{2}):(\d{2})[.](\d{3})\s*-->\s*(?:(\d{2}):)?(\d{2}):(\d{2})[.](\d{3})/,
    );
    if (!match) continue;

    const startTime =
      parseInt(match[1] || '0') * 3600 +
      parseInt(match[2]) * 60 +
      parseInt(match[3]) +
      parseInt(match[4]) / 1000;

    const endTime =
      parseInt(match[5] || '0') * 3600 +
      parseInt(match[6]) * 60 +
      parseInt(match[7]) +
      parseInt(match[8]) / 1000;

    const cueText = lines
      .slice(timeLineIdx + 1)
      .join('\n')
      .replace(/<[^>]+>/g, '');

    cues.push({ id: uid(), startTime, endTime, text: cueText });
  }

  return cues;
}

/**
 * Auto-detect format and parse
 */
export function parseSubtitles(text: string): SubtitleCue[] {
  const trimmed = text.trim();
  if (trimmed.startsWith('WEBVTT')) {
    return parseVTT(trimmed);
  }
  return parseSRT(trimmed);
}

/**
 * Generate SRT from cues
 */
export function generateSRT(cues: SubtitleCue[]): string {
  return cues
    .map((cue, i) => {
      const start = formatSRTTime(cue.startTime);
      const end = formatSRTTime(cue.endTime);
      return `${i + 1}\n${start} --> ${end}\n${cue.text}`;
    })
    .join('\n\n');
}

/**
 * Generate WebVTT from cues
 */
export function generateVTT(cues: SubtitleCue[]): string {
  const header = 'WEBVTT\n\n';
  const body = cues
    .map((cue, i) => {
      const start = formatVTTTime(cue.startTime);
      const end = formatVTTTime(cue.endTime);
      return `${i + 1}\n${start} --> ${end}\n${cue.text}`;
    })
    .join('\n\n');
  return header + body;
}

function formatSRTTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${pad2(h)}:${pad2(m)}:${pad2(s)},${pad3(ms)}`;
}

function formatVTTTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}.${pad3(ms)}`;
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

function pad3(n: number): string {
  return n.toString().padStart(3, '0');
}

/**
 * Convert Whisper word-level timestamps into subtitle cues
 */
export function whisperToCues(
  words: { word: string; start: number; end: number }[],
  options: { maxChars?: number; maxWords?: number } = {},
): SubtitleCue[] {
  const maxChars = options.maxChars ?? 42;
  const maxWords = options.maxWords ?? 8;
  const cues: SubtitleCue[] = [];
  let currentWords: typeof words = [];
  let currentLength = 0;

  for (const word of words) {
    const trimmedWord = word.word.trim();
    if (!trimmedWord) continue;

    const wouldBeLength = currentLength + (currentLength > 0 ? 1 : 0) + trimmedWord.length;

    if (currentWords.length >= maxWords || (wouldBeLength > maxChars && currentWords.length > 0)) {
      // Flush current group
      cues.push({
        id: uid(),
        startTime: currentWords[0].start,
        endTime: currentWords[currentWords.length - 1].end,
        text: currentWords.map((w) => w.word.trim()).join(' '),
      });
      currentWords = [];
      currentLength = 0;
    }

    currentWords.push(word);
    currentLength = currentLength + (currentLength > 0 ? 1 : 0) + trimmedWord.length;
  }

  // Flush remaining
  if (currentWords.length > 0) {
    cues.push({
      id: uid(),
      startTime: currentWords[0].start,
      endTime: currentWords[currentWords.length - 1].end,
      text: currentWords.map((w) => w.word.trim()).join(' '),
    });
  }

  return cues;
}
