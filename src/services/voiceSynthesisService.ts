/**
 * SAATHI Zero-Lag Natural Voice Synthesis Service
 * Provides crisp, reliable Indian Voice Text-to-Speech using native SpeechSynthesis
 * with Android OS TextToSpeech bridge integration. Zero cloud costs, zero latency.
 */

interface IWindowWithNativeVoice extends Window {
  SaathiNative?: {
    speak?: (text: string) => void;
  };
}

class NaturalVoiceSynthesisService {
  private isSpeakingState: boolean = false;

  /**
   * Speak emergency text with natural cadence and Indian voice profile
   */
  public speak(text: string, lang: 'Hinglish' | 'Hindi' | 'English' = 'Hinglish'): void {
    if (!text || text.trim().length === 0) return;

    const win = (typeof window !== 'undefined' ? window : {}) as IWindowWithNativeVoice;

    // 1. Android APK native TextToSpeech engine
    if (win.SaathiNative && typeof win.SaathiNative.speak === 'function') {
      try {
        win.SaathiNative.speak(text);
        return;
      } catch (err) {
        console.warn('Native Android TTS error:', err);
      }
    }

    // 2. Desktop Chrome / Mobile Web SpeechSynthesis engine
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel(); // Cancel any lingering utterances

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.95; // Clear natural emergency operator pace
        utterance.pitch = 1.05; // Slightly clearer higher pitch for intelligibility
        utterance.lang = lang === 'Hindi' ? 'hi-IN' : 'en-IN';

        // Select best available Indian voice
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(
          (v) =>
            v.lang.includes('hi') ||
            v.lang.includes('IN') ||
            v.name.includes('India') ||
            v.name.includes('Heera') ||
            v.name.includes('Google हिन्दी')
        );

        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }

        utterance.onstart = () => {
          this.isSpeakingState = true;
        };

        utterance.onend = () => {
          this.isSpeakingState = false;
        };

        utterance.onerror = () => {
          this.isSpeakingState = false;
        };

        window.speechSynthesis.speak(utterance);
      } catch (e) {
        console.warn('SpeechSynthesis error:', e);
      }
    }
  }

  /**
   * Stop any active speech output immediately
   */
  public stop(): void {
    this.isSpeakingState = false;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (_e) {}
    }
  }

  public isSpeaking(): boolean {
    return this.isSpeakingState;
  }
}

export const voiceSynthesisService = new NaturalVoiceSynthesisService();
