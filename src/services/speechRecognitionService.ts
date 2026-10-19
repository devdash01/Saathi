/**
 * SAATHI Real-Time Voice Intelligence Service Powered by Sarvam AI (saaras:v4)
 * 
 * 1. ZERO-LAG LIVE DISPLAY: Sarvam AI Realtime Streaming WebSocket receives live 16kHz PCM audio
 *    and streams back partial transcripts with ultra-low latency directly as words are spoken.
 * 2. 100% PURE SARVAM AI: Driven by Sarvam's state-of-the-art Indic 'saaras:v4' model with codemix support.
 * 3. FALLBACK RESILIENCE: Gracefully falls back to on-device SpeechRecognition if offline.
 * 4. DEDUPLICATION: Rigorous boundary & phrase dedup eliminates repetitive word/stutter bugs.
 */

import { SARVAM_API_KEY } from './sarvamService';

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

/**
 * Downsamples Float32 audio to 16-bit PCM Linear16 at target sample rate (default 16000Hz)
 */
function downsampleBuffer(
  buffer: Float32Array,
  inputSampleRate: number,
  outputSampleRate: number = 16000
): Int16Array {
  if (outputSampleRate === inputSampleRate) {
    const output = new Int16Array(buffer.length);
    for (let i = 0; i < buffer.length; i++) {
      const s = Math.max(-1, Math.min(1, buffer[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return output;
  }
  const sampleRateRatio = inputSampleRate / outputSampleRate;
  const newLength = Math.round(buffer.length / sampleRateRatio);
  const result = new Int16Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;
  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
      accum += buffer[i];
      count++;
    }
    const s = Math.max(-1, Math.min(1, count > 0 ? accum / count : 0));
    result[offsetResult] = s < 0 ? s * 0x8000 : s * 0x7fff;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }
  return result;
}

/**
 * Converts 16-bit PCM Int16Array to Base64 string efficiently
 */
function int16ToBase64(int16Array: Int16Array): string {
  const bytes = new Uint8Array(int16Array.buffer, int16Array.byteOffset, int16Array.byteLength);
  let binary = '';
  const len = bytes.byteLength;
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, Math.min(i + chunkSize, len))));
  }
  return window.btoa(binary);
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

  // Sarvam Realtime Streaming WebSocket & Web Audio components
  private ws: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private mediaStream: MediaStream | null = null;
  private isUsingSarvamWs: boolean = false;

  constructor() {
    this.initFallbackRecognition();
  }

  private initFallbackRecognition() {
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
          // If Sarvam WebSocket is currently streaming live results, don't overwrite
          if (this.isUsingSarvamWs) return;

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
          if (this.isUsingSarvamWs) return;
          console.warn('Fallback SpeechRecognition error:', event.error);
          if (event.error !== 'no-speech' && this.onErrorCallback) {
            this.onErrorCallback(event.error);
          }
        };

        this.recognition.onend = () => {
          if (this.isListeningState && !this.isUsingSarvamWs) {
            try {
              this.recognition.start();
              return;
            } catch (_e) {}
          }
          if (!this.isUsingSarvamWs) {
            this.isListeningState = false;
            if (this.onEndCallback) {
              this.onEndCallback();
            }
          }
        };
      }
    }
  }

  public isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    const win = window as IWindowWithSpeech;
    return Boolean(
      (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) ||
      win.SpeechRecognition ||
      win.webkitSpeechRecognition
    );
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
    this.isUsingSarvamWs = false;

    // Check if browser supports getUserMedia for Sarvam Realtime WebSocket streaming
    if (navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        })
        .then((stream) => {
          if (!this.isListeningState) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          this.mediaStream = stream;

          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          if (!AudioContextClass) {
            this.startFallbackRecognition();
            return;
          }

          const ctx = new AudioContextClass();
          this.audioContext = ctx;
          if (ctx.state === 'suspended') {
            ctx.resume().catch(() => {});
          }

          // Connect directly to Sarvam AI Realtime Streaming WebSocket
          const lang = this.currentLanguage || 'hi-IN';
          const wsUrl = `wss://api.sarvam.ai/speech-to-text-realtime/ws?language_code=${encodeURIComponent(lang)}&model=saaras:v4&mode=codemix`;
          
          try {
            const ws = new WebSocket(wsUrl, [`api-subscription-key.${SARVAM_API_KEY}`]);
            this.ws = ws;

            ws.onopen = () => {
              if (!this.isListeningState) {
                ws.close();
                return;
              }
              this.isUsingSarvamWs = true;

              const source = ctx.createMediaStreamSource(stream);
              const processor = ctx.createScriptProcessor(4096, 1, 1);
              this.scriptProcessor = processor;

              // Zero-gain mute node to keep processor active without echoing microphone sound through speakers
              const muteGain = ctx.createGain();
              muteGain.gain.value = 0;

              processor.onaudioprocess = (e) => {
                if (!this.isListeningState || ws.readyState !== WebSocket.OPEN) return;
                const inputData = e.inputBuffer.getChannelData(0);
                const downsampled = downsampleBuffer(inputData, ctx.sampleRate, 16000);
                const b64 = int16ToBase64(downsampled);

                ws.send(
                  JSON.stringify({
                    event: 'audio_input',
                    audio: b64
                  })
                );
              };

              source.connect(processor);
              processor.connect(muteGain);
              muteGain.connect(ctx.destination);
            };

            ws.onmessage = (event) => {
              try {
                const data = JSON.parse(event.data);
                if (data.event === 'transcript.partial' && data.text) {
                  const cleaned = cleanDuplicateSpeech(data.text);
                  if (cleaned && this.onResultCallback) {
                    this.onResultCallback({
                      transcript: cleaned,
                      isFinal: false
                    });
                  }
                } else if (data.event === 'transcript.final' && data.text) {
                  const cleaned = cleanDuplicateSpeech(data.text);
                  if (cleaned && this.onResultCallback) {
                    this.onResultCallback({
                      transcript: cleaned,
                      isFinal: true
                    });
                  }
                }
              } catch (_e) {}
            };

            ws.onerror = (err) => {
              console.warn('Sarvam Realtime WebSocket error:', err);
              if (!this.isUsingSarvamWs) {
                this.cleanupAudio();
                this.startFallbackRecognition();
              }
            };

            ws.onclose = () => {
              if (this.isListeningState && this.isUsingSarvamWs) {
                this.cleanupAudio();
                this.startFallbackRecognition();
              }
            };
          } catch (wsErr) {
            console.warn('WebSocket init error:', wsErr);
            this.cleanupAudio();
            this.startFallbackRecognition();
          }
        })
        .catch((err) => {
          console.warn('Microphone access error:', err);
          this.startFallbackRecognition();
        });
      return true;
    }

    // Direct fallback if getUserMedia is not supported
    return this.startFallbackRecognition();
  }

  private startFallbackRecognition(): boolean {
    if (this.recognition) {
      try {
        this.recognition.start();
        return true;
      } catch (e: any) {
        if (e.name === 'InvalidStateError') return true;
        console.warn('Fallback recognition start error:', e);
      }
    }
    if (this.onErrorCallback) {
      this.onErrorCallback('Speech recognition not supported in this browser.');
    }
    return false;
  }

  private cleanupAudio(): void {
    if (this.ws) {
      try {
        if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
          this.ws.close();
        }
      } catch (_e) {}
      this.ws = null;
    }
    if (this.scriptProcessor) {
      try {
        this.scriptProcessor.disconnect();
      } catch (_e) {}
      this.scriptProcessor = null;
    }
    if (this.audioContext) {
      try {
        this.audioContext.close().catch(() => {});
      } catch (_e) {}
      this.audioContext = null;
    }
    if (this.mediaStream) {
      try {
        this.mediaStream.getTracks().forEach((track) => track.stop());
      } catch (_e) {}
      this.mediaStream = null;
    }
  }

  public stop(): void {
    this.isListeningState = false;
    this.isUsingSarvamWs = false;
    this.cleanupAudio();

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
