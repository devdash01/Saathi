/**
 * SAATHI Pure Sarvam AI Speech-to-Text Service
 * 100% powered by Sarvam AI saaras:v4 model via real-time audio chunking.
 * Bypasses browser/Google SpeechRecognition entirely to eliminate all repetition bugs.
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

  // 2. Remove repeating multi-word phrases
  for (let len = 8; len >= 1; len--) {
    const phrasePattern = `(?:^|\\s+)((?:[^\\s.,!?]+(?:\\s+[^\\s.,!?]+){${len - 1}}))([.,!?]?)(?:\\s+\\1\\2?)+(?=$|[\\s.,!?])`;
    const regex = new RegExp(phrasePattern, 'gi');
    str = str.replace(regex, (match, p1, p2) => (match.startsWith(' ') ? ' ' : '') + p1 + p2);
  }

  // 3. Remove incremental prefix stutters
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
 * Merge speech segments cleanly
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

/**
 * Downsample arbitrary microphone audio to 16,000 Hz Mono for Sarvam AI
 */
function downsampleTo16k(input: Float32Array, inputSampleRate: number): Float32Array {
  if (inputSampleRate === 16000) return input;
  const ratio = inputSampleRate / 16000;
  const newLength = Math.round(input.length / ratio);
  const result = new Float32Array(newLength);
  let offsetResult = 0;
  let offsetInput = 0;
  while (offsetResult < result.length) {
    const nextOffsetInput = Math.round((offsetResult + 1) * ratio);
    let accum = 0, count = 0;
    for (let i = offsetInput; i < nextOffsetInput && i < input.length; i++) {
      accum += input[i];
      count++;
    }
    result[offsetResult] = count > 0 ? accum / count : 0;
    offsetResult++;
    offsetInput = nextOffsetInput;
  }
  return result;
}

/**
 * Encode 16kHz PCM audio samples into a genuine uncompressed 16-bit Mono WAV Blob
 */
function encodeWav(samples: Float32Array, sampleRate: number = 16000): Blob {
  const numSamples = samples.length;
  const dataSize = numSamples * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  function writeStr(offset: number, s: string) {
    for (let i = 0; i < s.length; i++) {
      view.setUint8(offset + i, s.charCodeAt(i));
    }
  }

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // Mono channel
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // Byte rate (16-bit mono)
  view.setUint16(32, 2, true); // Block align
  view.setUint16(34, 16, true); // Bits per sample
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Pure Sarvam AI Real-Time Streaming Speech Service
 * Slices microphone audio into short windows and sends each chunk directly to Sarvam AI saaras:v4.
 */
export class PureSarvamSpeechRecognitionService {
  private isListeningState: boolean = false;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private pcmChunks: Float32Array[] = [];
  private accumulatedSamples: number = 0;
  private chunkIntervalTimer: any = null;
  private accumulatedTranscript: string = '';
  private onResultCallback: SpeechCallback | null = null;
  private onErrorCallback: ((error: string) => void) | null = null;
  private onEndCallback: (() => void) | null = null;
  private mode: 'codemix' | 'transcribe' | 'translate' = 'codemix';
  private isProcessingChunk: boolean = false;

  public isSupported(): boolean {
    return typeof window !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
  }

  public setLanguage(lang: 'Hinglish' | 'Hindi' | 'English'): void {
    if (lang === 'Hinglish') {
      this.mode = 'codemix';
    } else {
      this.mode = 'transcribe';
    }
  }

  public start(
    onResult: SpeechCallback,
    onError?: (error: string) => void,
    onEnd?: () => void
  ): boolean {
    if (!this.isSupported()) {
      if (onError) onError('Microphone access is not supported on this browser.');
      return false;
    }

    this.onResultCallback = onResult;
    this.onErrorCallback = onError || null;
    this.onEndCallback = onEnd || null;
    this.accumulatedTranscript = '';
    this.pcmChunks = [];
    this.accumulatedSamples = 0;
    this.isListeningState = true;

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
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        this.audioContext = new AudioCtx();
        const source = this.audioContext.createMediaStreamSource(stream);

        // ScriptProcessorNode captures real PCM buffers
        this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);

        this.scriptProcessor.onaudioprocess = (e) => {
          if (!this.isListeningState) return;
          const channelData = e.inputBuffer.getChannelData(0);
          const copy = new Float32Array(channelData);
          this.pcmChunks.push(copy);
          this.accumulatedSamples += copy.length;
        };

        source.connect(this.scriptProcessor);
        // Connect to a muted gain node to satisfy Web Audio routing without feedback
        const silentGain = this.audioContext.createGain();
        silentGain.gain.value = 0;
        this.scriptProcessor.connect(silentGain);
        silentGain.connect(this.audioContext.destination);

        // Every 1.6 seconds, ship audio chunk to Sarvam AI STT
        this.chunkIntervalTimer = setInterval(() => {
          this.flushAndTranscribeChunk(false);
        }, 1600);
      })
      .catch((err) => {
        this.isListeningState = false;
        if (this.onErrorCallback) {
          this.onErrorCallback(err.message || 'Microphone permission denied');
        }
      });

    return true;
  }

  private async flushAndTranscribeChunk(isFinal: boolean = false) {
    if (this.pcmChunks.length === 0 || this.isProcessingChunk) return;
    this.isProcessingChunk = true;

    const sampleRate = this.audioContext ? this.audioContext.sampleRate : 48000;
    const totalSamples = this.accumulatedSamples;

    // Minimum 0.4s audio to transcribe
    if (totalSamples < sampleRate * 0.4) {
      this.isProcessingChunk = false;
      return;
    }

    // Combine accumulated PCM float chunks
    const merged = new Float32Array(totalSamples);
    let offset = 0;
    for (const chunk of this.pcmChunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    // Reset buffer for next slice
    this.pcmChunks = [];
    this.accumulatedSamples = 0;

    try {
      // 1. Downsample to 16kHz
      const samples16k = downsampleTo16k(merged, sampleRate);
      // 2. Encode to 16kHz PCM WAV
      const wavBlob = encodeWav(samples16k, 16000);

      // 3. Send directly to Sarvam AI Speech-to-Text
      const res = await transcribeAudioWithSarvam(wavBlob, this.mode);

      if (res && res.transcript) {
        const text = cleanDuplicateSpeech(res.transcript.trim());
        if (text) {
          if (!this.accumulatedTranscript) {
            this.accumulatedTranscript = text;
          } else {
            this.accumulatedTranscript = assembleSpeechResults([this.accumulatedTranscript, text]);
          }
          this.accumulatedTranscript = cleanDuplicateSpeech(this.accumulatedTranscript);

          if (this.onResultCallback) {
            this.onResultCallback({
              transcript: this.accumulatedTranscript,
              isFinal
            });
          }
        }
      }
    } catch (e) {
      console.warn('Sarvam AI STT chunk error:', e);
    } finally {
      this.isProcessingChunk = false;
    }
  }

  public stop(): void {
    if (!this.isListeningState) return;
    this.isListeningState = false;

    if (this.chunkIntervalTimer) {
      clearInterval(this.chunkIntervalTimer);
      this.chunkIntervalTimer = null;
    }

    // Flush final audio slice to Sarvam AI
    this.flushAndTranscribeChunk(true).finally(() => {
      if (this.scriptProcessor) {
        try {
          this.scriptProcessor.disconnect();
        } catch (_e) {}
        this.scriptProcessor = null;
      }
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach((track) => track.stop());
        this.mediaStream = null;
      }
      if (this.audioContext) {
        try {
          this.audioContext.close();
        } catch (_e) {}
        this.audioContext = null;
      }
      if (this.onEndCallback) {
        this.onEndCallback();
      }
    });
  }

  public isListening(): boolean {
    return this.isListeningState;
  }
}

export const speechService = new PureSarvamSpeechRecognitionService();
