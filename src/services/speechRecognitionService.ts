/**
 * SAATHI Zero-Lag Real-Time Voice Intelligence Engine
 * 
 * Flawless Architecture:
 * - Single Source of Truth: TS Accumulator owns the entire transcript.
 * - Invariant: displayed text = committed sentences + current interim
 * - Native Android SpeechRecognizer Bridge streams segment partials & finals.
 * - On Native Speech error / silence: commits pending interim so words are NEVER lost.
 * - Chromium Web Speech API (webkitSpeechRecognition) on Desktop / Laptop Chrome.
 * - Transliterates Devanagari to Roman Hinglish + cleans duplicate speech stutters.
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
    isNativeSpeechAvailable?: () => boolean;
    hasAudioPermission?: () => boolean;
    requestAudioPermission?: () => void;
    startSpeechRecognition?: (lang: string, initialText?: string) => void;
    stopSpeechRecognition?: () => void;
    resetSpeechAccumulator?: () => void;
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
    const current = words[i].trim();
    if (!current) continue;
    const prev = deduped[deduped.length - 1];
    if (prev && prev.toLowerCase() === current.toLowerCase()) {
      continue;
    }
    deduped.push(current);
  }
  return deduped.join(' ');
}

export class Accumulator {
  committed = '';
  interim = '';

  setInterim(t: string) {
    this.interim = (t || '').trim();
  }

  commit(t?: string) {
    const s = ((t !== undefined ? t : this.interim) || '').trim();
    if (s) {
      this.committed = this.committed ? `${this.committed}. ${s}` : s;
    }
    this.interim = '';
  }

  get text() {
    if (!this.interim) return this.committed;
    return this.committed ? `${this.committed}. ${this.interim}` : this.interim;
  }

  reset() {
    this.committed = '';
    this.interim = '';
  }
}

export class UniversalSpeechRecognitionService {
  private recognition: any = null;
  private isListeningState: boolean = false;
  private onResultCallback: SpeechCallback | null = null;
  private onErrorCallback: ((error: string) => void) | null = null;
  private onEndCallback: (() => void) | null = null;

  private currentLanguage: string = 'hi-IN';
  public acc = new Accumulator();

  // Android Native Bridge Listeners
  private nativeSpeechResultHandler: ((e: any) => void) | null = null;
  private nativeSpeechErrorHandler: ((e: any) => void) | null = null;

  constructor() {
    this.currentLanguage = 'hi-IN';
    this.initWebRecognition();
  }

  private initWebRecognition() {
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

      this.recognition.onresult = (e: any) => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (!r || !r[0]) continue;
          const t = cleanDuplicateSpeech(devanagariToHinglish(r[0].transcript || ''));
          if (r.isFinal) {
            this.acc.commit(t);
          } else {
            interim = interim ? `${interim} ${t}` : t;
          }
        }
        if (interim) {
          this.acc.setInterim(interim);
        }
        this.emit(false);
      };

      this.recognition.onerror = (event: any) => {
        if (event.error === 'no-speech' || event.error === 'aborted') return;
        console.warn('SpeechRecognition error:', event.error);
        if (this.onErrorCallback) {
          this.onErrorCallback(event.error);
        }
      };

      this.recognition.onend = () => {
        this.acc.commit(); // keep anything pending
        this.emit(true);
        if (this.isListeningState) {
          setTimeout(() => {
            if (this.isListeningState && this.recognition) {
              try {
                this.recognition.start();
              } catch (_err) {}
            }
          }, 100);
        } else if (this.onEndCallback) {
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
    const hasNativeBridge = Boolean(
      win.SaathiNative && typeof win.SaathiNative.startSpeechRecognition === 'function'
    );
    const hasWebSpeech = Boolean(win.SpeechRecognition || win.webkitSpeechRecognition);
    return hasNativeBridge || hasWebSpeech;
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

  private emit(isFinal: boolean) {
    if (this.onResultCallback) {
      this.onResultCallback({
        transcript: this.acc.text,
        isFinal
      });
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

    const win = (typeof window !== 'undefined' ? window : {}) as IWindowWithSpeech;

    // 1. PRIMARY ENGINE FOR ANDROID APK: Native Android SpeechRecognizer Bridge
    const hasNativeBridge = Boolean(
      win.SaathiNative && typeof win.SaathiNative.startSpeechRecognition === 'function'
    );

    if (hasNativeBridge) {
      this.setupNativeAndroidListeners();
      try {
        if (win.SaathiNative?.requestAudioPermission && !win.SaathiNative.hasAudioPermission?.()) {
          win.SaathiNative.requestAudioPermission();
        }
        win.SaathiNative!.startSpeechRecognition!(this.currentLanguage);
        return true;
      } catch (err: any) {
        console.warn('Native Android Speech error, falling back to Web Speech:', err);
      }
    }

    // 2. PRIMARY ENGINE FOR LAPTOP / DESKTOP: Universal Web Speech API
    if (!this.recognition) {
      this.initWebRecognition();
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

  private setupNativeAndroidListeners() {
    this.cleanupNativeAndroidListeners();

    this.nativeSpeechResultHandler = (e: any) => {
      const d = e.detail;
      if (!d) return;

      const raw = (d.transcript || '').trim();
      const t = cleanDuplicateSpeech(devanagariToHinglish(raw));

      if (d.isFinal) {
        this.acc.commit(t || undefined); // empty final -> commit what we had
      } else {
        this.acc.setInterim(t);
      }
      this.emit(Boolean(d.isFinal));
    };

    this.nativeSpeechErrorHandler = (_e: any) => {
      // On silence/pause or recognizer recreation:
      // Commit pending interim so words never vanish!
      this.acc.commit();
      this.emit(true);
    };

    window.addEventListener('saathi:native-speech-result', this.nativeSpeechResultHandler);
    window.addEventListener('saathi:native-speech-error', this.nativeSpeechErrorHandler);
  }

  private cleanupNativeAndroidListeners() {
    if (this.nativeSpeechResultHandler) {
      window.removeEventListener('saathi:native-speech-result', this.nativeSpeechResultHandler);
      this.nativeSpeechResultHandler = null;
    }
    if (this.nativeSpeechErrorHandler) {
      window.removeEventListener('saathi:native-speech-error', this.nativeSpeechErrorHandler);
      this.nativeSpeechErrorHandler = null;
    }
  }

  public stop(): void {
    this.isListeningState = false;
    this.acc.commit();
    this.emit(true);

    const win = (typeof window !== 'undefined' ? window : {}) as IWindowWithSpeech;
    if (win.SaathiNative && typeof win.SaathiNative.stopSpeechRecognition === 'function') {
      try {
        win.SaathiNative.stopSpeechRecognition();
      } catch (_e) {}
    }
    this.cleanupNativeAndroidListeners();

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
    this.acc.reset();
    const win = (typeof window !== 'undefined' ? window : {}) as IWindowWithSpeech;
    if (win.SaathiNative && typeof win.SaathiNative.resetSpeechAccumulator === 'function') {
      try {
        win.SaathiNative.resetSpeechAccumulator();
      } catch (_e) {}
    }
  }

  public isListening(): boolean {
    return this.isListeningState;
  }
}

export const speechService = new UniversalSpeechRecognitionService();
