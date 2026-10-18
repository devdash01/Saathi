/**
 * Sarvam AI Service for Real Indian Speech-to-Text & Text-to-Speech
 */

export const SARVAM_API_KEY = 'sk_bafne65q_tmDmBcTLO5NV6z24j0dJq7Gh';

export interface SarvamSTTResponse {
  request_id?: string;
  transcript: string;
  language_code: string;
  language_probability: number;
  englishTranslation?: string;
  latencyMs?: number;
}

export interface SarvamTTSResponse {
  audioBase64: string;
  audioUrl: string;
  latencyMs?: number;
}

export interface SarvamTranslateResponse {
  translated_text: string;
  source_language_code: string;
  latencyMs?: number;
}

/**
 * Translate Hindi / Hinglish / Indic text to English using Sarvam AI Translate API
 */
export async function translateTextWithSarvam(
  text: string,
  targetLang: string = 'en-IN'
): Promise<SarvamTranslateResponse> {
  const startTime = performance.now();
  const payload = {
    input: text,
    source_language_code: 'auto',
    target_language_code: targetLang,
    speaker_gender: 'Female',
    mode: 'formal'
  };

  const endpoints = ['/api/sarvam/translate', 'https://api.sarvam.ai/translate'];

  for (const url of endpoints) {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (url.startsWith('https://')) {
        headers['api-subscription-key'] = SARVAM_API_KEY;
      }

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Sarvam Translate HTTP ${res.status}: ${errorText}`);
      }

      const json = await res.json();
      const latencyMs = Math.round(performance.now() - startTime);

      return {
        translated_text: json.translated_text || text,
        source_language_code: json.source_language_code || 'hi-IN',
        latencyMs
      };
    } catch (err: unknown) {
      console.warn(`Translation attempt with ${url} failed:`, err);
    }
  }

  // Graceful fallback if network is completely offline
  return {
    translated_text: text,
    source_language_code: 'unknown',
    latencyMs: Math.round(performance.now() - startTime)
  };
}

/**
 * Transcribe an audio Blob using Sarvam AI Speech-to-Text (saaras:v4)
 */
export async function transcribeAudioWithSarvam(
  audioBlob: Blob,
  mode: 'transcribe' | 'translate' | 'codemix' = 'transcribe'
): Promise<SarvamSTTResponse> {
  const startTime = performance.now();
  const formData = new FormData();
  formData.append('file', audioBlob, 'emergency_call.wav');
  formData.append('model', 'saaras:v4');
  formData.append('mode', mode);

  // Try via Vite proxy first, fallback to direct API
  const endpoints = ['/api/sarvam/speech-to-text', 'https://api.sarvam.ai/speech-to-text'];
  let lastError: Error | null = null;

  for (const url of endpoints) {
    try {
      const headers: Record<string, string> = {};
      if (url.startsWith('https://')) {
        headers['api-subscription-key'] = SARVAM_API_KEY;
      }

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: formData
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Sarvam STT HTTP ${res.status}: ${errorText}`);
      }

      const json = await res.json();
      const latencyMs = Math.round(performance.now() - startTime);

      return {
        request_id: json.request_id,
        transcript: json.transcript || '',
        language_code: json.language_code || 'hi-IN',
        language_probability: json.language_probability || 0.95,
        latencyMs
      };
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`Attempt with ${url} failed:`, err);
    }
  }

  throw lastError || new Error('Failed to transcribe audio via Sarvam AI');
}

/**
 * Generate real Hinglish/Hindi speech audio using Sarvam AI Text-to-Speech (bulbul:v4-flash)
 */
export async function generateSpeechWithSarvam(
  text: string,
  speaker: string = 'kavya_hi_conversational'
): Promise<SarvamTTSResponse> {
  const startTime = performance.now();
  const payload = {
    text,
    target_language_code: 'hi-IN',
    speaker,
    model: 'bulbul:v4-flash'
  };

  const endpoints = ['/api/sarvam/text-to-speech', 'https://api.sarvam.ai/text-to-speech'];
  let lastError: Error | null = null;

  for (const url of endpoints) {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (url.startsWith('https://')) {
        headers['api-subscription-key'] = SARVAM_API_KEY;
      }

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Sarvam TTS HTTP ${res.status}: ${errorText}`);
      }

      const json = await res.json();
      const latencyMs = Math.round(performance.now() - startTime);
      const audioBase64 = json.audios && json.audios[0] ? json.audios[0] : '';
      const audioUrl = `data:audio/wav;base64,${audioBase64}`;

      return {
        audioBase64,
        audioUrl,
        latencyMs
      };
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`Attempt with ${url} failed:`, err);
    }
  }

  throw lastError || new Error('Failed to synthesize speech via Sarvam AI');
}

/**
 * Microphone Recorder Controller for Live Inbound Calls
 */
export class MicrophoneRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;

  async start(): Promise<MediaStream> {
    this.audioChunks = [];
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.mediaRecorder = new MediaRecorder(this.stream);

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.audioChunks.push(event.data);
      }
    };

    this.mediaRecorder.start(250); // Emit chunk every 250ms
    return this.stream;
  }

  stop(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        return reject(new Error('Recorder not initialized'));
      }

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
        if (this.stream) {
          this.stream.getTracks().forEach((track) => track.stop());
        }
        resolve(audioBlob);
      };

      this.mediaRecorder.stop();
    });
  }

  isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording';
  }
}
