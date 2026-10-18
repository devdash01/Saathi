/**
 * SAATHI Web Speech API Service
 * Real-time Speech-to-Text streaming for live voice input in Hindi & Hinglish
 */

export interface SpeechRecognitionResultState {
  transcript: string;
  isFinal: boolean;
}

export type SpeechCallback = (result: SpeechRecognitionResultState) => void;

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
          let accumulatedFinal = '';
          let interim = '';

          for (let i = 0; i < event.results.length; ++i) {
            const res = event.results[i];
            const text = res[0].transcript;
            if (res.isFinal) {
              accumulatedFinal += text + ' ';
            } else {
              interim += text;
            }
          }

          const currentText = (accumulatedFinal + interim).trim();
          if (currentText && this.onResultCallback) {
            this.onResultCallback({
              transcript: currentText,
              isFinal: Boolean(accumulatedFinal)
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
