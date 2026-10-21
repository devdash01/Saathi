/**
 * SAATHI Zero-Lag Real-Time Voice Intelligence Engine
 * 
 * Architecture:
 * 1. Web Speech API (Desktop & Chrome): Instant streaming with sub-50ms latency.
 *    Emits interim words the exact millisecond they are spoken with zero buffering.
 * 2. Native Android Bridge (SaathiNative): Uses Android's native SpeechRecognizer
 *    with partial streaming results directly inside the mobile APK.
 * 3. MediaRecorder / Sarvam AI Fallback: For environments without native speech recognition.
 */

import { SARVAM_API_KEY } from './sarvamService';

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
    startSpeechRecognition?: (lang: string) => void;
    stopSpeechRecognition?: () => void;
  };
}

/**
 * Clean up extra whitespace and minor duplicate artifacts without stripping caller phrases
 */
export function cleanDuplicateSpeech(text: string): string {
  if (!text) return '';
  let str = text.trim();

  // Clean repeated punctuation
  str = str.replace(/([.,!?])\s*\1+/g, '$1');

  // Collapse 3+ consecutive identical words (e.g. "haan haan haan haan" -> "haan haan")
  str = str.replace(/\b(\w+)(?:\s+\1){2,}\b/gi, '$1 $1');

  return str.replace(/\s+/g, ' ').trim();
}

/**
 * Merge speech segments cleanly without duplicate overlap
 */
export function assembleSpeechResults(resultsList: string[]): string {
  const valid = resultsList.map((r) => (r || '').trim()).filter(Boolean);
  if (valid.length === 0) return '';
  if (valid.length === 1) return valid[0];

  let combined = valid[0];
  for (let i = 1; i < valid.length; i++) {
    const next = valid[i];
    if (next.startsWith(combined)) {
      combined = next;
    } else if (!combined.includes(next)) {
      combined += ' ' + next;
    }
  }
  return cleanDuplicateSpeech(combined);
}

export class HybridSpeechRecognitionService {
  private recognition: any = null;
  private isListeningState: boolean = false;
  private onResultCallback: SpeechCallback | null = null;
  private onErrorCallback: ((error: string) => void) | null = null;
  private onEndCallback: (() => void) | null = null;
  private currentLanguage: string = 'hi-IN';
  private accumulatedFromPreviousSessions: string = '';

  // Native Android event listeners
  private nativeSpeechResultHandler: ((e: any) => void) | null = null;
  private nativeSpeechErrorHandler: ((e: any) => void) | null = null;

  constructor() {
    this.initWebSpeechRecognition();
  }

  private initWebSpeechRecognition() {
    if (typeof window !== 'undefined') {
      const win = window as IWindowWithSpeech;
      const SpeechClass = win.SpeechRecognition || win.webkitSpeechRecognition;
      if (SpeechClass) {
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
              const text = res[0].transcript || '';
              if (res.isFinal) {
                sessionFinal += text + ' ';
              } else {
                sessionInterim += text;
              }
            }

            const currentSessionText = (sessionFinal + sessionInterim).trim();
            const totalText = this.accumulatedFromPreviousSessions
              ? `${this.accumulatedFromPreviousSessions} ${currentSessionText}`.trim()
              : currentSessionText;

            const isFinal = Boolean(sessionFinal && !sessionInterim);

            if (totalText && this.onResultCallback) {
              this.onResultCallback({
                transcript: totalText,
                isFinal
              });
            }
          };

          this.recognition.onerror = (event: any) => {
            console.warn('Web Speech recognition event error:', event.error);
            if (event.error === 'no-speech') return; // Normal pause in caller voice
            if (this.onErrorCallback) {
              this.onErrorCallback(event.error);
            }
          };

          this.recognition.onend = () => {
            // If user did not manually stop, automatically restart for continuous uninterrupted listening
            if (this.isListeningState) {
              try {
                this.recognition.start();
                return;
              } catch (_e) {
                // If start fails immediately, retry after brief delay
                setTimeout(() => {
                  if (this.isListeningState && this.recognition) {
                    try { this.recognition.start(); } catch (_err) {}
                  }
                }, 200);
                return;
              }
            }

            if (this.onEndCallback) {
              this.onEndCallback();
            }
          };
        } catch (e) {
          console.warn('Failed to initialize Web Speech API:', e);
          this.recognition = null;
        }
      }
    }
  }

  public isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    const win = window as IWindowWithSpeech;
    const hasNativeBridge = Boolean(win.SaathiNative && typeof win.SaathiNative.startSpeechRecognition === 'function');
    const hasWebSpeech = Boolean(win.SpeechRecognition || win.webkitSpeechRecognition);
    const hasMedia = Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    return hasNativeBridge || hasWebSpeech || hasMedia;
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
    this.accumulatedFromPreviousSessions = '';

    const win = (typeof window !== 'undefined' ? window : {}) as IWindowWithSpeech;

    // 1. FIRST PRIORITY ON MOBILE: Native Android SpeechRecognizer Bridge
    if (win.SaathiNative && typeof win.SaathiNative.startSpeechRecognition === 'function') {
      this.setupNativeAndroidListeners();
      try {
        win.SaathiNative.startSpeechRecognition(this.currentLanguage);
        return true;
      } catch (err: any) {
        console.warn('Native Android Speech bridge error:', err);
      }
    }

    // 2. FIRST PRIORITY ON DESKTOP & BROWSER: Instant Web Speech API (webkitSpeechRecognition)
    // Zero-lag, sub-50ms latency word-by-word streaming
    if (this.recognition) {
      try {
        this.recognition.lang = this.currentLanguage;
        this.recognition.start();
        return true;
      } catch (e: any) {
        if (e.name === 'InvalidStateError') {
          // Already active
          return true;
        }
        console.warn('Web Speech start error:', e);
      }
    }

    // 3. FALLBACK: Sarvam AI MediaRecorder Audio Recording
    return this.startSarvamMediaRecorderFallback();
  }

  private setupNativeAndroidListeners() {
    this.cleanupNativeAndroidListeners();

    this.nativeSpeechResultHandler = (e: any) => {
      const data = e.detail;
      if (data && data.transcript && this.onResultCallback) {
        this.onResultCallback({
          transcript: cleanDuplicateSpeech(data.transcript),
          isFinal: Boolean(data.isFinal)
        });
      }
    };

    this.nativeSpeechErrorHandler = (e: any) => {
      console.warn('Native Android Speech error event:', e.detail);
      if (this.onErrorCallback && e.detail?.error) {
        this.onErrorCallback(e.detail.error);
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

  private startSarvamMediaRecorderFallback(): boolean {
    if (!navigator.mediaDevices?.getUserMedia) {
      if (this.onErrorCallback) {
        this.onErrorCallback('Speech recognition not available on this device.');
      }
      return false;
    }

    // If browser lacks WebSpeech API, record and send to Sarvam REST API
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        if (!this.isListeningState) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        const mediaRecorder = new MediaRecorder(stream);
        const audioChunks: Blob[] = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) audioChunks.push(event.data);
        };

        mediaRecorder.onstop = async () => {
          stream.getTracks().forEach((t) => t.stop());
          const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
          if (audioBlob.size > 1000 && SARVAM_API_KEY) {
            try {
              const formData = new FormData();
              formData.append('file', audioBlob, 'speech.wav');
              formData.append('language_code', this.currentLanguage || 'hi-IN');
              formData.append('model', 'saaras:v4');

              const response = await fetch('https://api.sarvam.ai/speech-to-text', {
                method: 'POST',
                headers: {
                  'api-subscription-key': SARVAM_API_KEY
                },
                body: formData
              });

              if (response.ok) {
                const data = await response.json();
                if (data.transcript && this.onResultCallback) {
                  this.onResultCallback({
                    transcript: data.transcript.trim(),
                    isFinal: true
                  });
                }
              }
            } catch (err) {
              console.warn('Sarvam REST fallback error:', err);
            }
          }
        };

        mediaRecorder.start(1500);
      })
      .catch((err) => {
        console.warn('MediaRecorder fallback error:', err);
        if (this.onErrorCallback) {
          this.onErrorCallback('Microphone permission required for speech.');
        }
      });

    return true;
  }

  public stop(): void {
    this.isListeningState = false;

    // 1. Stop Native Android Recognizer if running
    const win = (typeof window !== 'undefined' ? window : {}) as IWindowWithSpeech;
    if (win.SaathiNative && typeof win.SaathiNative.stopSpeechRecognition === 'function') {
      try {
        win.SaathiNative.stopSpeechRecognition();
      } catch (_e) {}
    }
    this.cleanupNativeAndroidListeners();

    // 2. Stop Web Speech API
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (_e) {}
    }

    if (this.onEndCallback) {
      this.onEndCallback();
    }
  }

  public isListening(): boolean {
    return this.isListeningState;
  }
}

export const speechService = new HybridSpeechRecognitionService();
