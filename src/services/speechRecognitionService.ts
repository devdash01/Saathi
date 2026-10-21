/**
 * SAATHI Zero-Lag Real-Time Voice Intelligence Engine
 * 
 * Flawless Live Speech Architecture:
 * - Native Android SpeechRecognizer Bridge when running inside Capacitor APK (direct hardware mic access).
 * - Direct Web Speech API (webkitSpeechRecognition) on Desktop Chrome / Laptop browsers.
 * - Persistent Speech Accumulation: Pauses and silence restarts NEVER remove previously spoken text.
 * - Multi-tier Deduplication: Eliminates both single-word stutters and multi-word repeated phrase loops.
 * - Automatic Roman Hinglish output via en-IN and Devanagari transliteration.
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
    startSpeechRecognition?: (lang: string) => void;
    stopSpeechRecognition?: () => void;
  };
}

/**
 * Eliminates immediate single-word duplicates and multi-word repeated phrase loops
 * e.g. "police police" -> "police"
 * e.g. "madad karo madad karo" -> "madad karo"
 */
export function cleanDuplicateSpeech(text: string): string {
  if (!text) return '';
  const words = text.trim().split(/\s+/);
  if (words.length <= 1) return text.trim();

  // 1. Clean immediate 1-word duplicates ("police police" -> "police")
  const singleDeduped: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const current = words[i];
    const prev = singleDeduped[singleDeduped.length - 1];
    if (
      prev &&
      prev.toLowerCase().replace(/[^a-z0-9]/gi, '') ===
        current.toLowerCase().replace(/[^a-z0-9]/gi, '')
    ) {
      continue;
    }
    singleDeduped.push(current);
  }

  // 2. Clean immediate multi-word repeated phrases (lengths 4, 3, 2)
  let result = [...singleDeduped];
  for (let phraseLen = 4; phraseLen >= 2; phraseLen--) {
    let i = 0;
    const cleaned: string[] = [];
    while (i < result.length) {
      if (i + 2 * phraseLen <= result.length) {
        let isRepeat = true;
        for (let j = 0; j < phraseLen; j++) {
          const w1 = result[i + j].toLowerCase().replace(/[^a-z0-9]/gi, '');
          const w2 = result[i + phraseLen + j].toLowerCase().replace(/[^a-z0-9]/gi, '');
          if (w1 !== w2) {
            isRepeat = false;
            break;
          }
        }
        if (isRepeat) {
          for (let j = 0; j < phraseLen; j++) {
            cleaned.push(result[i + j]);
          }
          i += 2 * phraseLen;
          continue;
        }
      }
      cleaned.push(result[i]);
      i++;
    }
    result = cleaned;
  }

  return result.join(' ');
}

/**
 * Merges previous committed transcript with incoming speech from a new pause or utterance
 * without deleting earlier words and without repeating overlapping boundary phrases.
 */
export function mergeSpeechTranscripts(committed: string, incoming: string): string {
  const comm = (committed || '').trim();
  const inc = (incoming || '').trim();

  if (!comm) return cleanDuplicateSpeech(inc);
  if (!inc) return cleanDuplicateSpeech(comm);

  // If incoming already starts with or equals committed
  if (inc.toLowerCase().startsWith(comm.toLowerCase())) {
    return cleanDuplicateSpeech(inc);
  }

  // If committed already ends with incoming
  if (comm.toLowerCase().endsWith(inc.toLowerCase())) {
    return cleanDuplicateSpeech(comm);
  }

  const commWords = comm.split(/\s+/);
  const incWords = inc.split(/\s+/);

  // Check overlap of up to 10 words between end of commWords and start of incWords
  const maxCheck = Math.min(commWords.length, incWords.length, 10);
  let bestOverlap = 0;

  for (let k = maxCheck; k >= 1; k--) {
    let match = true;
    for (let i = 0; i < k; i++) {
      const w1 = commWords[commWords.length - k + i].toLowerCase().replace(/[^a-z0-9]/gi, '');
      const w2 = incWords[i].toLowerCase().replace(/[^a-z0-9]/gi, '');
      if (w1 !== w2) {
        match = false;
        break;
      }
    }
    if (match) {
      bestOverlap = k;
      break;
    }
  }

  let merged: string;
  if (bestOverlap > 0) {
    const remainingInc = incWords.slice(bestOverlap).join(' ');
    merged = remainingInc ? `${comm} ${remainingInc}` : comm;
  } else {
    merged = `${comm} ${inc}`;
  }

  return cleanDuplicateSpeech(merged);
}

export class HybridSpeechRecognitionService {
  private recognition: any = null;
  private isListeningState: boolean = false;
  private onResultCallback: SpeechCallback | null = null;
  private onErrorCallback: ((error: string) => void) | null = null;
  private onEndCallback: (() => void) | null = null;

  // Language configuration (en-IN for Romanized Hinglish, hi-IN for Devanagari Hindi)
  private currentLanguage: string = 'en-IN';

  // Persistent speech memory across pauses and silence restarts
  private committedHistory: string = '';
  private lastSessionTranscript: string = '';

  // Native Android bridge tracking
  private nativeSpeechResultHandler: ((e: any) => void) | null = null;
  private nativeSpeechErrorHandler: ((e: any) => void) | null = null;

  constructor() {
    this.currentLanguage = 'en-IN';
    this.initWebSpeechRecognition();
  }

  private initWebSpeechRecognition() {
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
        let sessionFinal = '';
        let sessionInterim = '';

        for (let i = 0; i < event.results.length; ++i) {
          const res = event.results[i];
          if (!res || !res[0]) continue;
          const text = (res[0].transcript || '').trim();
          if (!text) continue;

          if (res.isFinal) {
            sessionFinal += (sessionFinal ? ' ' : '') + text;
          } else {
            sessionInterim += (sessionInterim ? ' ' : '') + text;
          }
        }

        const sessionRaw = [sessionFinal, sessionInterim].filter(Boolean).join(' ').trim();
        if (!sessionRaw) return;

        const sessionFormatted = this.currentLanguage === 'hi-IN' ? sessionRaw : devanagariToHinglish(sessionRaw);
        this.lastSessionTranscript = sessionFormatted;

        // Merge committed text from previous pauses with the current session text
        const fullTranscript = mergeSpeechTranscripts(this.committedHistory, sessionFormatted);

        if (fullTranscript && this.onResultCallback) {
          this.onResultCallback({
            transcript: fullTranscript,
            isFinal: Boolean(sessionFinal && !sessionInterim)
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
        // When silence causes session to end: commit the session transcript into committedHistory
        // so that the next speech utterance appends to it instead of wiping it out!
        if (this.lastSessionTranscript) {
          this.committedHistory = mergeSpeechTranscripts(this.committedHistory, this.lastSessionTranscript);
          this.lastSessionTranscript = '';
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
            }, 50);
            return;
          }
        }
        if (this.onEndCallback) {
          this.onEndCallback();
        }
      };
    } catch (e) {
      console.warn('Failed to init Web Speech API:', e);
      this.recognition = null;
    }
  }

  public isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    const win = window as IWindowWithSpeech;
    const hasWebSpeech = Boolean(win.SpeechRecognition || win.webkitSpeechRecognition);
    const hasNativeBridge = Boolean(
      win.SaathiNative && typeof win.SaathiNative.startSpeechRecognition === 'function'
    );
    return hasWebSpeech || hasNativeBridge;
  }

  public setLanguage(lang: 'Hinglish' | 'Hindi' | 'English'): void {
    if (lang === 'Hindi') {
      this.currentLanguage = 'hi-IN';
    } else {
      this.currentLanguage = 'en-IN';
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

    // Initialize committed history with any existing transcript so new speech appends naturally
    if (initialText && initialText.trim().length > 0) {
      this.committedHistory = cleanDuplicateSpeech(initialText.trim());
    }
    this.lastSessionTranscript = '';

    const win = (typeof window !== 'undefined' ? window : {}) as IWindowWithSpeech;

    // Check if running inside Android Capacitor APK with native bridge available
    const hasNativeBridge = Boolean(
      win.SaathiNative && typeof win.SaathiNative.startSpeechRecognition === 'function'
    );

    if (hasNativeBridge) {
      // 1. PRIMARY ENGINE FOR ANDROID APK: Native Android SpeechRecognizer Bridge
      this.setupNativeAndroidListeners();
      try {
        if (win.SaathiNative?.requestAudioPermission && !win.SaathiNative.hasAudioPermission?.()) {
          win.SaathiNative.requestAudioPermission();
        }
        if (win.SaathiNative && typeof win.SaathiNative.startSpeechRecognition === 'function') {
          win.SaathiNative.startSpeechRecognition(this.currentLanguage);
          return true;
        }
      } catch (err: any) {
        console.warn('Native Android Speech error, falling back to Web Speech:', err);
      }
    }

    // 2. PRIMARY ENGINE FOR LAPTOP / DESKTOP BROWSER: Universal Web Speech API
    if (!this.recognition) {
      this.initWebSpeechRecognition();
    }

    if (this.recognition) {
      try {
        this.recognition.lang = this.currentLanguage;
        this.recognition.start();
        return true;
      } catch (e: any) {
        if (e.name === 'InvalidStateError') return true;
        console.warn('Web Speech start error:', e);
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
      const data = e.detail;
      if (!data || !data.transcript || !this.onResultCallback) return;

      const raw = (data.transcript || '').trim();
      if (!raw) return;

      const text = this.currentLanguage === 'hi-IN' ? raw : devanagariToHinglish(raw);

      if (data.isFinal) {
        // Utterance finalized: append into committed history and notify
        this.committedHistory = mergeSpeechTranscripts(this.committedHistory, text);
        this.lastSessionTranscript = '';
        this.onResultCallback({
          transcript: this.committedHistory,
          isFinal: true
        });
      } else {
        // Interim result: stream live total without mutating committed history yet
        this.lastSessionTranscript = text;
        const liveTotal = mergeSpeechTranscripts(this.committedHistory, text);
        this.onResultCallback({
          transcript: liveTotal,
          isFinal: false
        });
      }
    };

    this.nativeSpeechErrorHandler = (e: any) => {
      console.warn('Native Android Speech error event:', e.detail);
      if (e.detail?.error && !e.detail.error.includes('timeout') && !e.detail.error.includes('7')) {
        if (this.onErrorCallback) {
          this.onErrorCallback(e.detail.error);
        }
      }
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

    // Commit any active pending utterance into history
    if (this.lastSessionTranscript) {
      this.committedHistory = mergeSpeechTranscripts(this.committedHistory, this.lastSessionTranscript);
      this.lastSessionTranscript = '';
    }

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
    this.committedHistory = '';
    this.lastSessionTranscript = '';
  }

  public isListening(): boolean {
    return this.isListeningState;
  }
}

export const speechService = new HybridSpeechRecognitionService();
