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
 * caused by Android Chrome/WebView Web Speech API bugs.
 */
export function cleanDuplicateSpeech(text: string): string {
  if (!text) return '';
  const words = text.trim().split(/\s+/);
  if (words.length <= 1) return text.trim();

  // 1. Remove consecutive identical words (e.g. "please please please" -> "please")
  const deduped: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const curr = words[i];
    const prev = deduped[deduped.length - 1];
    if (!prev || curr.toLowerCase() !== prev.toLowerCase()) {
      deduped.push(curr);
    }
  }

  let cleaned = deduped.join(' ');

  // 2. Remove repeating multi-word phrases (e.g. "help me help me" -> "help me")
  for (let len = 6; len >= 2; len--) {
    const phraseRegex = new RegExp(`(\\b(?:\\S+\\s+){${len - 1}}\\S+)(?:\\s+\\1)+`, 'gi');
    cleaned = cleaned.replace(phraseRegex, '$1');
  }
  return cleaned.trim();
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
  private sessionFinalTranscript: string = '';

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
          let interim = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const res = event.results[i];
            const text = res[0]?.transcript || '';
            if (res.isFinal) {
              this.sessionFinalTranscript += ' ' + text;
            } else {
              interim += ' ' + text;
            }
          }

          const rawCombined = (this.sessionFinalTranscript + ' ' + interim).trim();
          const cleaned = cleanDuplicateSpeech(rawCombined);

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

    this.sessionFinalTranscript = '';

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
