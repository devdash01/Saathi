/**
 * SAATHI Zero-Lag Real-Time Voice + Sarvam AI Intelligence Service
 * 
 * 1. ZERO-LAG LIVE DISPLAY: Local on-device SpeechRecognition streams words with 0ms latency.
 * 2. SARVAM AI REFINEMENT: Microphone audio is captured in parallel and transcribed by Sarvam AI saaras:v4.
 * 3. DEDUPLICATION: Rigorous boundary & phrase dedup permanently eliminates repetitive word bugs.
 */

import { transcribeAudioWithSarvam } from './sarvamService';

export interface SpeechRecognitionResultState {
  transcript: string;
  isFinal: boolean;
}

export type SpeechCallback = (result: SpeechRecognitionResultState) => void;

/**
 * Remove stutter, consecutive identical words, and duplicated phrases
 */
export function cleanDuplicateSpeech(text: string): string {
  if (!text) return '';
  let str = text.trim();

  // 1. Clean repetitive punctuation stutters
  str = str.replace(/([.,!?])\s*\1+/g, '$1');

  // 2. Remove repeating multi-word phrases (e.g. "madad chahiye madad chahiye")
  for (let len = 8; len >= 1; len--) {
    const phrasePattern = `(?:^|\\s+)((?:[^\\s.,!?]+(?:\\s+[^\\s.,!?]+){${len - 1}}))([.,!?]?)(?:\\s+\\1\\2?)+(?=$|[\\s.,!?])`;
    const regex = new RegExp(phrasePattern, 'gi');
    str = str.replace(regex, (match, p1, p2) => (match.startsWith(' ') ? ' ' : '') + p1 + p2);
  }

  // 3. Remove incremental prefix stutters (e.g. "ple plea please")
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

  // 4. Clean up consecutive duplicate words
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
 * Merge speech segments cleanly without duplication
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

      if (normChunk === normPrev) {
        continue;
      }
      if (normChunk.startsWith(normPrev)) {
        segments[segments.length - 1] = chunk;
        continue;
      }

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

export class HybridSpeechRecognitionService {
  private recognition: any = null;
  private isListeningState: boolean = false;
  private onResultCallback: SpeechCallback | null = null;
  private onErrorCallback: ((error: string) => void) | null = null;
  private onEndCallback: (() => void) | null = null;
  private currentLanguage: string = 'hi-IN';
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private mediaStream: MediaStream | null = null;

  constructor() {
    this.initRecognition();
  }

  private initRecognition() {
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
          // If still marked as listening, seamlessly resume recognition
          if (this.isListeningState) {
            try {
              this.recognition.start();
              return;
            } catch (_e) {}
          }
          this.isListeningState = false;
          if (this.onEndCallback) {
            this.onEndCallback();
          }
        };
      }
    }
  }

  public isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    const win = window as IWindowWithSpeech;
    return Boolean(win.SpeechRecognition || win.webkitSpeechRecognition);
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
    this.onResultCallback = onResult;
    this.onErrorCallback = onError || null;
    this.onEndCallback = onEnd || null;
    this.isListeningState = true;

    // 1. Start zero-lag on-device live speech recognition
    let started = false;
    if (this.recognition) {
      try {
        this.recognition.start();
        started = true;
      } catch (e: any) {
        if (e.name === 'InvalidStateError') {
          started = true;
        } else {
          console.warn('Speech recognition start error:', e);
        }
      }
    }

    // 2. Parallel audio recording for Sarvam AI STT
    if (navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          this.mediaStream = stream;
          this.audioChunks = [];
          try {
            this.mediaRecorder = new MediaRecorder(stream);
            this.mediaRecorder.ondataavailable = (e) => {
              if (e.data.size > 0) this.audioChunks.push(e.data);
            };
            this.mediaRecorder.start(250);
          } catch (_e) {}
        })
        .catch((err) => {
          console.warn('Microphone recording stream error:', err);
        });
    }

    if (!started && !this.recognition) {
      if (onError) onError('Speech recognition not supported in this browser.');
      return false;
    }

    return true;
  }

  public stop(): void {
    this.isListeningState = false;

    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (_e) {}
    }

    // Stop MediaRecorder and transcribe with Sarvam AI STT
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      try {
        this.mediaRecorder.onstop = () => {
          if (this.audioChunks.length > 0) {
            const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
            transcribeAudioWithSarvam(audioBlob, 'codemix')
              .then((res) => {
                if (res.transcript && this.onResultCallback) {
                  const cleaned = cleanDuplicateSpeech(res.transcript.trim());
                  if (cleaned) {
                    this.onResultCallback({
                      transcript: cleaned,
                      isFinal: true
                    });
                  }
                }
              })
              .catch(() => {});
          }
          if (this.mediaStream) {
            this.mediaStream.getTracks().forEach((t) => t.stop());
            this.mediaStream = null;
          }
        };
        this.mediaRecorder.stop();
      } catch (_e) {}
    }
  }

  public isListening(): boolean {
    return this.isListeningState;
  }
}

export const speechService = new HybridSpeechRecognitionService();
