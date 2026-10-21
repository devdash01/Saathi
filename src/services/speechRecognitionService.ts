/**
 * SAATHI Zero-Lag Real-Time Voice Intelligence Engine
 * 
 * Flawless Live Speech Architecture:
 * - Direct Chromium Web Speech API (webkitSpeechRecognition) on Desktop Chrome and Android Capacitor WebView.
 * - Single-pass event.results traversal: zero repetition, zero stutter.
 * - Base-Transcript prefix accumulation: pauses and silence restarts NEVER remove previously spoken text.
 * - Natural Indian Speech Recognition via 'hi-IN' + automatic Devanagari to Roman Hinglish transliteration.
 */

import { devanagariToHinglish } from './transliterationService';

export interface SpeechRecognitionResultState {
  transcript: string;
  isFinal: boolean;
}

export type SpeechCallback = (result: SpeechRecognitionResultState) => void;

interface IWindowWithSpeech extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
  SaathiNative?: {
    hasAudioPermission?: () => boolean;
    requestAudioPermission?: () => void;
  };
}

/**
 * Eliminates immediate adjacent duplicate words (e.g. "police police" -> "police")
 */
export function cleanDuplicateSpeech(text: string): string {
  if (!text) return '';
  const words = text.trim().split(/\s+/);
  if (words.length <= 1) return text.trim();

  const deduped: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const current = words[i];
    const prev = deduped[deduped.length - 1];
    if (
      prev &&
      prev.toLowerCase().replace(/[^a-z0-9]/gi, '') ===
        current.toLowerCase().replace(/[^a-z0-9]/gi, '')
    ) {
      continue;
    }
    deduped.push(current);
  }
  return deduped.join(' ');
}

export class UniversalSpeechRecognitionService {
  private recognition: any = null;
  private isListeningState: boolean = false;
  private onResultCallback: SpeechCallback | null = null;
  private onErrorCallback: ((error: string) => void) | null = null;
  private onEndCallback: (() => void) | null = null;

  // Default to hi-IN for accurate Indian speech recognition, transliterated to clean Roman Hinglish
  private currentLanguage: string = 'hi-IN';

  // Base transcript committed from previous pauses or input
  private baseTranscript: string = '';
  // Current active utterance from the ongoing recognition session
  private currentSessionTranscript: string = '';

  constructor() {
    this.currentLanguage = 'hi-IN';
    this.initRecognition();
  }

  private initRecognition() {
    if (typeof window === 'undefined') return;
    const win = window as IWindowWithSpeech;
    const SpeechClass = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechClass) return;

    try {
      this.recognition = new SpeechClass();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 1;
      this.recognition.lang = this.currentLanguage;

      this.recognition.onresult = (event: any) => {
        let accumulatedFinal = '';
        let interim = '';

        for (let i = 0; i < event.results.length; ++i) {
          const res = event.results[i];
          if (!res || !res[0]) continue;
          const text = (res[0].transcript || '').trim();
          if (!text) continue;

          if (res.isFinal) {
            accumulatedFinal += (accumulatedFinal ? ' ' : '') + text;
          } else {
            interim += (interim ? ' ' : '') + text;
          }
        }

        const raw = [accumulatedFinal, interim].filter(Boolean).join(' ').trim();
        if (!raw) return;

        // Clean immediate adjacent stutters
        const cleaned = cleanDuplicateSpeech(raw);
        // Transliterate Devanagari to readable Roman Hinglish
        const formatted = devanagariToHinglish(cleaned);

        this.currentSessionTranscript = formatted;

        // Combine any pre-existing text with the current session text cleanly
        const fullTranscript = this.baseTranscript
          ? `${this.baseTranscript} ${formatted}`.trim()
          : formatted;

        if (this.onResultCallback) {
          this.onResultCallback({
            transcript: fullTranscript,
            isFinal: Boolean(accumulatedFinal && !interim)
          });
        }
      };

      this.recognition.onerror = (event: any) => {
        if (event.error === 'no-speech' || event.error === 'aborted') return;
        console.warn('SpeechRecognition error:', event.error);
        if (this.onErrorCallback) {
          this.onErrorCallback(event.error);
        }
      };

      this.recognition.onend = () => {
        // When silence causes the recognition session to end:
        // Commit the session's words into baseTranscript so they are NEVER lost when the user speaks again!
        if (this.currentSessionTranscript) {
          this.baseTranscript = this.baseTranscript
            ? `${this.baseTranscript} ${this.currentSessionTranscript}`.trim()
            : this.currentSessionTranscript;
          this.currentSessionTranscript = '';
        }

        if (this.isListeningState) {
          try {
            this.recognition.start();
            return;
          } catch (_e) {
            setTimeout(() => {
              if (this.isListeningState && this.recognition) {
                try {
                  this.recognition.start();
                } catch (_err) {}
              }
            }, 60);
            return;
          }
        }

        if (this.onEndCallback) {
          this.onEndCallback();
        }
      };
    } catch (e) {
      console.warn('SpeechRecognition initialization error:', e);
      this.recognition = null;
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
    onEnd?: () => void,
    initialText?: string
  ): boolean {
    this.onResultCallback = onResult;
    this.onErrorCallback = onError || null;
    this.onEndCallback = onEnd || null;
    this.isListeningState = true;

    // Preserve any existing text as the starting base so new speech appends naturally
    this.baseTranscript = (initialText || '').trim();
    this.currentSessionTranscript = '';

    const win = (typeof window !== 'undefined' ? window : {}) as IWindowWithSpeech;

    // Ensure Android microphone permission is granted in APK
    if (win.SaathiNative && typeof win.SaathiNative.requestAudioPermission === 'function') {
      try {
        if (win.SaathiNative.hasAudioPermission && !win.SaathiNative.hasAudioPermission()) {
          win.SaathiNative.requestAudioPermission();
        }
      } catch (_e) {}
    }

    if (!this.recognition) {
      this.initRecognition();
    }

    if (this.recognition) {
      try {
        this.recognition.lang = this.currentLanguage;
        this.recognition.start();
        return true;
      } catch (e: any) {
        if (e.name === 'InvalidStateError') return true;
        console.warn('Speech start error:', e);
      }
    }

    this.isListeningState = false;
    if (this.onErrorCallback) {
      this.onErrorCallback('Speech recognition is not supported in this browser. Please use Google Chrome.');
    }
    return false;
  }

  public stop(): void {
    this.isListeningState = false;

    // Commit any active speech into base transcript
    if (this.currentSessionTranscript) {
      this.baseTranscript = this.baseTranscript
        ? `${this.baseTranscript} ${this.currentSessionTranscript}`.trim()
        : this.currentSessionTranscript;
      this.currentSessionTranscript = '';
    }

    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (_e) {}
    }

    if (this.onEndCallback) {
      this.onEndCallback();
    }
  }

  public reset(): void {
    this.baseTranscript = '';
    this.currentSessionTranscript = '';
  }

  public isListening(): boolean {
    return this.isListeningState;
  }
}

export const speechService = new UniversalSpeechRecognitionService();
