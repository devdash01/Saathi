import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  Mic,
  MicOff,
  Phone,
  MapPin,
  Sparkles,
  Volume2
} from 'lucide-react';
import type { CallScenario, EvidenceItem } from '../types';
import {
  transcribeAudioWithSarvam,
  generateSpeechWithSarvam,
  MicrophoneRecorder
} from '../services/sarvamService';

interface LiveCallStreamProps {
  scenario: CallScenario;
  piiMasked: boolean;
  selectedEvidenceId: string | null;
  onSelectEvidence: (evidenceId: string | null) => void;
  isPlayingAudio: boolean;
  setIsPlayingAudio: (playing: boolean) => void;
  onNewLiveTranscript?: (transcript: string) => void;
  setSarvamStatus: (status: 'connected' | 'transcribing' | 'idle' | 'error') => void;
}

export const LiveCallStream: React.FC<LiveCallStreamProps> = ({
  scenario,
  piiMasked,
  selectedEvidenceId,
  onSelectEvidence,
  isPlayingAudio,
  setIsPlayingAudio,
  onNewLiveTranscript,
  setSarvamStatus
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [currentPlaybackSecond, setCurrentPlaybackSecond] = useState<number>(0);
  const [isRecordingMic, setIsRecordingMic] = useState<boolean>(false);
  const [isProcessingSarvam, setIsProcessingSarvam] = useState<boolean>(false);
  const [sarvamLiveText, setSarvamLiveText] = useState<string>('');
  const [sarvamLiveTranslation, setSarvamLiveTranslation] = useState<string>('');
  const [sarvamAudioUrl, setSarvamAudioUrl] = useState<string | null>(null);

  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const micRecorderRef = useRef<MicrophoneRecorder | null>(null);

  // Prefetch Sarvam TTS audio on scenario change
  useEffect(() => {
    let isCancelled = false;

    async function loadScenarioVoice() {
      try {
        setSarvamStatus('transcribing');
        const hindiText =
          scenario.id === 'call-rohini-01'
            ? 'दीदी, वह घर के बाहर आ गया है... मेरा बच्चा भी मेरे साथ है। मैं ज़्यादा देर बात नहीं कर सकती।'
            : scenario.id === 'call-lucknow-02'
            ? 'भैया बचाओ, सिर से खून निकल रहा है, उसने रूम बाहर से बंद कर दिया है... फोन छीन लेगा मेरा।'
            : 'ऑटो वाला गलत सुनसान रास्ते पे ले जा रहा है, रुका नहीं रहा... फोन की बैटरी सिर्फ 4 परसेंट बची है।';

        const tts = await generateSpeechWithSarvam(hindiText, 'kavya_hi_conversational');
        if (!isCancelled) {
          setSarvamAudioUrl(tts.audioUrl);
          setSarvamStatus('connected');
        }
      } catch (err) {
        console.warn('Sarvam TTS prefetch fallback:', err);
        if (!isCancelled) setSarvamStatus('connected');
      }
    }

    loadScenarioVoice();
    return () => {
      isCancelled = true;
    };
  }, [scenario.id, setSarvamStatus]);

  // Audio Playback Controller
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    if (isPlayingAudio) {
      if (sarvamAudioUrl) {
        if (!audioElementRef.current) {
          audioElementRef.current = new Audio(sarvamAudioUrl);
        } else {
          audioElementRef.current.src = sarvamAudioUrl;
        }

        audioElementRef.current.play().catch((e) => console.warn('Audio play error:', e));
        audioElementRef.current.onended = () => {
          setIsPlayingAudio(false);
          setCurrentPlaybackSecond(0);
        };
      }

      interval = setInterval(() => {
        setCurrentPlaybackSecond((prev) => (prev >= 10 ? 0 : prev + 1));
      }, 1000);
    } else {
      if (audioElementRef.current) {
        audioElementRef.current.pause();
      }
      setCurrentPlaybackSecond(0);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlayingAudio, sarvamAudioUrl, setIsPlayingAudio]);

  // Sleek Waveform Visualizer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let phase = 0;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const width = canvas.width;
      const height = canvas.height;
      const centerY = height / 2;

      const barCount = 44;
      const barWidth = width / barCount - 2;

      for (let i = 0; i < barCount; i++) {
        const x = i * (barWidth + 2);
        const isActive = isPlayingAudio || isRecordingMic;
        const dynamicFactor = isActive
          ? Math.sin(phase + i * 0.4) * 0.4 + 0.6
          : 0.15;
        const barHeight = Math.max(4, dynamicFactor * (height * 0.75) * (Math.sin((i / barCount) * Math.PI) + 0.2));

        if (isRecordingMic) {
          ctx.fillStyle = '#ef4444';
        } else if (isPlayingAudio) {
          ctx.fillStyle = '#38bdf8';
        } else {
          ctx.fillStyle = 'rgba(148, 163, 184, 0.2)';
        }

        ctx.fillRect(x, centerY - barHeight / 2, barWidth, barHeight);
      }

      phase += (isPlayingAudio || isRecordingMic) ? 0.08 : 0.02;
      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlayingAudio, isRecordingMic]);

  // Microphone recording
  const handleToggleMicrophone = async () => {
    if (isRecordingMic) {
      setIsRecordingMic(false);
      setIsProcessingSarvam(true);
      setSarvamStatus('transcribing');

      try {
        if (!micRecorderRef.current) return;
        const audioBlob = await micRecorderRef.current.stop();

        const sttResult = await transcribeAudioWithSarvam(audioBlob, 'codemix');
        setSarvamLiveText(sttResult.transcript);

        const translateResult = await transcribeAudioWithSarvam(audioBlob, 'translate');
        setSarvamLiveTranslation(translateResult.transcript);

        if (onNewLiveTranscript && sttResult.transcript) {
          onNewLiveTranscript(sttResult.transcript);
        }
        setSarvamStatus('connected');
      } catch (err) {
        console.error('Sarvam STT failed:', err);
        setSarvamStatus('error');
      } finally {
        setIsProcessingSarvam(false);
      }
    } else {
      try {
        micRecorderRef.current = new MicrophoneRecorder();
        await micRecorderRef.current.start();
        setIsRecordingMic(true);
        setIsPlayingAudio(false);
      } catch (err) {
        alert('Microphone error: ' + (err as Error).message);
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Telemetry Header */}
      <div className="section-header">
        <span className="section-title">
          <Volume2 size={14} color="#ef4444" />
          <span>Inbound Call Stream & STT</span>
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '0.74rem' }}>
          <span style={{ color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Phone size={12} />
            <span>{piiMasked ? scenario.callerPhoneMasked : '+91 98101 44412'}</span>
          </span>
          <span style={{ color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <MapPin size={12} color="#f87171" />
            <span>{piiMasked ? scenario.cityArea : 'Flat 402, Rohini Sec 16'}</span>
          </span>
        </div>
      </div>

      {/* Waveform Box */}
      <div className="waveform-box">
        <canvas ref={canvasRef} className="waveform-canvas-element" width={600} height={48} />
      </div>

      {/* Audio Playback & Live Recording Bar */}
      <div className="audio-telemetry-bar">
        <div className="audio-controls">
          <button
            className="primary-audio-btn"
            onClick={() => setIsPlayingAudio(!isPlayingAudio)}
          >
            {isPlayingAudio ? <Pause size={14} /> : <Play size={14} />}
            <span>{isPlayingAudio ? 'Pause Speech' : 'Play Sarvam Voice'}</span>
          </button>

          <button
            className={`secondary-mic-btn ${isRecordingMic ? 'recording' : ''}`}
            onClick={handleToggleMicrophone}
          >
            {isRecordingMic ? <MicOff size={14} /> : <Mic size={14} />}
            <span>{isRecordingMic ? 'Stop Recording' : 'Speak Live Mic'}</span>
          </button>
        </div>

        <div style={{ fontSize: '0.74rem', color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>
          DURATION: 00:0{currentPlaybackSecond}s / 00:10s
        </div>
      </div>

      {/* Transcript Area */}
      <div className="transcript-section">
        <div className="transcript-label">
          <span>Sarvam AI Speech-to-Text Output</span>
          {isProcessingSarvam && (
            <span style={{ color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Sparkles size={11} /> Transcribing...
            </span>
          )}
        </div>

        <div className="transcript-quote-box">
          <div className="indic-text">
            {sarvamLiveText ? (
              <span>“{sarvamLiveText}”</span>
            ) : scenario.id === 'call-rohini-01' ? (
              '“दीदी, वह घर के बाहर आ गया है... मेरा बच्चा भी मेरे साथ है। मैं ज़्यादा देर बात नहीं कर सकती।”'
            ) : scenario.id === 'call-lucknow-02' ? (
              '“भैया बचाओ, सिर से खून निकल रहा है, उसने रूम बाहर से बंद कर दिया है... फोन छीन लेगा मेरा।”'
            ) : (
              '“ऑटो वाला गलत सुनसान रास्ते पे ले जा रहा है, रुका नहीं रहा... फोन की बैटरी सिर्फ 4 परसेंट बची है।”'
            )}
          </div>

          <div className="english-text">
            {sarvamLiveTranslation
              ? `English Translation: “${sarvamLiveTranslation}”`
              : scenario.id === 'call-rohini-01'
              ? 'English Translation: “Sister, he has come outside the house... my child is also with me. I cannot talk for much longer.”'
              : scenario.id === 'call-lucknow-02'
              ? 'English Translation: “Brother help me, blood is bleeding from my head, he locked the room from outside... he will snatch my phone.”'
              : 'English Translation: “The auto driver is taking me down a deserted wrong route, not stopping... my phone battery only has 4 percent left.”'}
          </div>
        </div>

        {/* Evidence Chips */}
        <div>
          <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-dim)', marginBottom: '8px', textTransform: 'uppercase' }}>
            Warning Signs & Evidence Links
          </div>
          <div className="evidence-chips-row">
            {scenario.triage.evidenceLinks.map((ev: EvidenceItem) => {
              const isSelected = selectedEvidenceId === ev.id;
              return (
                <div
                  key={ev.id}
                  className={`evidence-chip ${ev.category.includes('threat') ? 'threat' : ev.category.includes('child') ? 'child' : 'safety'}`}
                  style={isSelected ? { borderColor: 'var(--accent-blue)', background: 'var(--bg-hover)' } : {}}
                  onClick={() => onSelectEvidence(isSelected ? null : ev.id)}
                >
                  <span style={{ fontWeight: 600 }}>{ev.label}:</span>
                  <span style={{ color: 'var(--text-muted)' }}>“{ev.quoteHinglish}”</span>
                  <span style={{ color: '#10b981', fontSize: '0.68rem', fontFamily: 'var(--font-mono)' }}>
                    {Math.round(ev.confidence * 100)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
