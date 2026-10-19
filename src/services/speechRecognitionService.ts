/**
 * SAATHI Web Speech API Service
 * Real-time Speech-to-Text streaming for live voice input in Hindi & Hinglish
 */

export interface SpeechRecognitionResultState {
  transcript: string;
  isFinal: boolean;
}

export type SpeechCallback = (result: SpeechRecognitionResultState) => void;

/**
 * Remove stutter, consecutive identical words, and duplicated phrases
/**
 * Remove stutter, consecutive identical words, and duplicated phrases
 * caused by Android Chrome/WebView Web Speech API bugs.
 */
export function cleanDuplicateSpeech(text: string): string {
  if (!text) return '';
  let str = text.trim();

  // 1. Clean repetitive punctuation stutters like "..", ",,", "??", etc.
  str = str.replace(/([.,!?])\s*\1+/g, '$1');

  // 2. Remove repeating multi-word phrases (e.g. "mujhe madad chahiye mujhe madad chahiye")
  for (let len = 8; len >= 1; len--) {
    const phrasePattern = `(?:^|\\s+)((?:[^\\s.,!?]+(?:\\s+[^\\s.,!?]+){${len - 1}}))([.,!?]?)(?:\\s+\\1\\2?)+(?=$|[\\s.,!?])`;
    const regex = new RegExp(phrasePattern, 'gi');
    str = str.replace(regex, (match, p1, p2) => (match.startsWith(' ') ? ' ' : '') + p1 + p2);
  }

  // 3. Remove incremental prefix stutters (e.g. "ple plea please" or "ple. plea. please")
  const tokens = str.split(/\s+/);
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const cur = tokens[i];
    const next = tokens[i + 1];
    if (next) {
      const cClean = cur.replace(/[^\w\u0900-\u097F]/g, '').toLowerCase();
      const nClean = next.replace(/[^\w\u0900-\u097F]/g, '').toLowerCase();
      if (cClean.length >= 2 && nClean.startsWith(cClean) && nClean.length > cClean.length) {
        continue;
      }
    }
    out.push(cur);
  }
  str = out.join(' ');

  // 4. Clean up any lingering consecutive duplicate words
  const words = str.split(/\s+/);
  const finalWords: string[] = [];
  const strip = (s: string) => s.toLowerCase().replace(/^[^\w\u0900-\u097F]+|[^\w\u0900-\u097F]+$/g, '');
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const prev = finalWords[finalWords.length - 1];
    if (!prev || strip(w) !== strip(prev)) {
      finalWords.push(w);
    }
  }

  return finalWords.join(' ').replace(/\s+([.,!?])/g, '$1').trim();
}

/**
 * Intelligent Speech Segment Assembler:
 * Merges streaming recognition chunks and handles Android Chrome bugs:
 * - Duplicate results
 * - Cumulative superset strings
 * - Overlapping boundaries
 * - Distinct phrases
 */
export function assembleSpeechResults(resultsList: string[]): string {
  const norm = (s: string) => (s || '').toLowerCase().replace(/[^\w\u0900-\u097F\s]/g, '').replace(/\s+/g, ' ').trim();
  const stripWord = (w: string) => (w || '').toLowerCase().replace(/^[^\w\u0900-\u097F]+|[^\w\u0900-\u097F]+$/g, '');

  const segments: string[] = [];
  for (let i = 0; i < resultsList.length; i++) {
    const chunk = (resultsList[i] || '').trim();
    if (!chunk) continue;
    const normChunk = norm(chunk);
    if (!normChunk) continue;

    if (segments.length === 0) {
      segments.push(chunk);
    } else {
      const prev = segments[segments.length - 1];
      const normPrev = norm(prev);

      // Case 1: Exact duplicate (ignoring punctuation & case)
      if (normChunk === normPrev) {
        continue;
      }

      // Case 2: chunk starts with prev (chunk is cumulative superset of prev!)
      if (normChunk.startsWith(normPrev)) {
        segments[segments.length - 1] = chunk;
        continue;
      }

      // Case 3: prev already includes or ends with chunk
      if (normPrev.endsWith(normChunk) || normPrev.includes(normChunk)) {
        continue;
      }

      // Case 4: Overlap at boundary (comparing normalized words)
      const prevWords = prev.split(/\s+/);
      const chunkWords = chunk.split(/\s+/);
      let overlap = 0;
      for (let k = Math.min(prevWords.length, chunkWords.length); k > 0; k--) {
        const pEnd = prevWords.slice(-k).map(stripWord).join(' ');
        const cStart = chunkWords.slice(0, k).map(stripWord).join(' ');
        if (pEnd === cStart) {
          overlap = k;
          break;
        }
      }
      if (overlap > 0) {
        segments[segments.length - 1] = prev + ' ' + chunkWords.slice(overlap).join(' ');
      } else {
        segments.push(chunk);
      }
    }
  }
  return segments.join(' ').trim();
}

interface IWindowWithSpeech extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

export class BrowserSpeechRecognitionService {
  private recognition: any = null;
  private isListeningState: boolean = false;
  private onResultCallback: SpeechCallback | null = null;
  private onErrorCallback: ((error: string) => void) | null = null;
  private onEndCallback: (() => void) | null = null;
  private currentLanguage: string = 'hi-IN';

  constructor() {
    if (typeof window !== 'undefined') {
      const win = window as IWindowWithSpeech;
      const SpeechClass = win.SpeechRecognition || win.webkitSpeechRecognition;
      if (SpeechClass) {
        this.recognition = new SpeechClass();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.maxAlternatives = 1;
        this.recognition.lang = this.currentLanguage;

        this.recognition.onresult = (event: any) => {
          const rawChunks: string[] = [];
          for (let i = 0; i < event.results.length; ++i) {
            const res = event.results[i];
            if (!res || !res[0]) continue;
            const t = (res[0].transcript || '').trim();
            if (t) rawChunks.push(t);
          }

          const assembled = assembleSpeechResults(rawChunks);
          const cleaned = cleanDuplicateSpeech(assembled);

          const lastResult = event.results[event.results.length - 1];
          const isFinal = Boolean(lastResult && lastResult.isFinal);

          if (cleaned && this.onResultCallback) {
            this.onResultCallback({
              transcript: cleaned,
              isFinal
            });
          }
        };

        this.recognition.onerror = (event: any) => {
          console.warn('SpeechRecognition error:', event.error);
          if (event.error !== 'no-speech' && this.onErrorCallback) {
            this.onErrorCallback(event.error);
          }
        };

        this.recognition.onend = () => {
          this.isListeningState = false;
          if (this.onEndCallback) {
            this.onEndCallback();
          }
        };
      }
    }
  }

  public isSupported(): boolean {
    return this.recognition !== null;
  }

  public setLanguage(lang: 'Hinglish' | 'Hindi' | 'English'): void {
    if (lang === 'English') {
      this.currentLanguage = 'en-IN';
    } else {
      this.currentLanguage = 'hi-IN';
    }
    if (this.recognition) {
      this.recognition.lang = this.currentLanguage;
    }
  }

  public start(
    onResult: SpeechCallback,
    onError?: (error: string) => void,
    onEnd?: () => void
  ): boolean {
    if (!this.recognition) {
      if (onError) onError('SpeechRecognition not supported in this browser. Please use Chrome or type input.');
      return false;
    }

    this.onResultCallback = onResult;
    this.onErrorCallback = onError || null;
    this.onEndCallback = onEnd || null;

    try {
      this.recognition.start();
      this.isListeningState = true;
      return true;
    } catch (e: any) {
      // If already started, ignore error
      if (e.name === 'InvalidStateError') {
        this.isListeningState = true;
        return true;
      }
      if (onError) onError(e.message || 'Failed to start microphone');
      return false;
    }
  }

  public stop(): void {
    if (this.recognition && this.isListeningState) {
      try {
        this.recognition.stop();
      } catch (e) {
        console.warn('Error stopping speech recognition:', e);
      }
      this.isListeningState = false;
    }
  }

  public isListening(): boolean {
    return this.isListeningState;
  }
}

export const speechService = new BrowserSpeechRecognitionService();
