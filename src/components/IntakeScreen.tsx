import React, { useState, useRef } from 'react';
import {
  Mic,
  MicOff,
  UploadCloud,
  FileText,
  Sparkles,
  ArrowRight,
  Radio,
  FileAudio
} from 'lucide-react';
import { transcribeAudioWithSarvam, MicrophoneRecorder, generateSpeechWithSarvam } from '../services/sarvamService';
import { MOCK_SCENARIOS } from '../data/mockScenarios';

interface IntakeScreenProps {
  onAnalyze: (text: string, audioUrl?: string, contextHint?: string) => void;
  sarvamStatus: 'connected' | 'transcribing' | 'idle' | 'error';
  setSarvamStatus: (status: 'connected' | 'transcribing' | 'idle' | 'error') => void;
}

export const IntakeScreen: React.FC<IntakeScreenProps> = ({
  onAnalyze,
  setSarvamStatus
}) => {
  const [inputMode, setInputMode] = useState<'text' | 'speech' | 'upload'>('speech');
  const [textInput, setTextInput] = useState<string>('Didi, woh ghar ke bahar aa gaya hai… mera bachcha bhi mere saath hai. Main zyada der baat nahi kar sakti.');
  const [selectedPresetHint, setSelectedPresetHint] = useState<string>('Rohini Sector 16, New Delhi');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [isPlayingPreview, setIsPlayingPreview] = useState<boolean>(false);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);

  const micRecorderRef = useRef<MicrophoneRecorder | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // Toggle Live Microphone Recording
  const handleToggleRecord = async () => {
    if (isRecording) {
      setIsRecording(false);
      setIsTranscribing(true);
      setSarvamStatus('transcribing');

      try {
        if (!micRecorderRef.current) return;
        const blob = await micRecorderRef.current.stop();
        const url = URL.createObjectURL(blob);
        setAudioPreviewUrl(url);

        // Transcribe via Sarvam AI
        const res = await transcribeAudioWithSarvam(blob, 'codemix');
        setTextInput(res.transcript);
        setSarvamStatus('connected');
      } catch (err) {
        console.error('Sarvam STT failed:', err);
        setSarvamStatus('error');
      } finally {
        setIsTranscribing(false);
      }
    } else {
      try {
        micRecorderRef.current = new MicrophoneRecorder();
        await micRecorderRef.current.start();
        setIsRecording(true);
        setAudioPreviewUrl(null);
      } catch (err) {
        alert('Microphone access denied: ' + (err as Error).message);
      }
    }
  };

  // Handle File Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    setIsTranscribing(true);
    setSarvamStatus('transcribing');

    try {
      const url = URL.createObjectURL(file);
      setAudioPreviewUrl(url);

      const res = await transcribeAudioWithSarvam(file, 'codemix');
      setTextInput(res.transcript);
      setSarvamStatus('connected');
    } catch (err) {
      console.error('File transcription failed:', err);
      setSarvamStatus('error');
    } finally {
      setIsTranscribing(false);
    }
  };

  // Play synthetic voice preview via Sarvam Bulbul TTS
  const handlePlaySampleVoice = async (sampleText: string) => {
    try {
      if (isPlayingPreview && previewAudioRef.current) {
        previewAudioRef.current.pause();
        setIsPlayingPreview(false);
        return;
      }

      setIsPlayingPreview(true);
      const tts = await generateSpeechWithSarvam(sampleText, 'kavya_hi_conversational');
      setAudioPreviewUrl(tts.audioUrl);

      if (!previewAudioRef.current) {
        previewAudioRef.current = new Audio(tts.audioUrl);
      } else {
        previewAudioRef.current.src = tts.audioUrl;
      }

      previewAudioRef.current.play();
      previewAudioRef.current.onended = () => setIsPlayingPreview(false);
    } catch (e) {
      console.warn('TTS preview fallback:', e);
      setIsPlayingPreview(false);
    }
  };

  // Load a quick scenario preset
  const handleSelectPreset = (idx: number) => {
    const sc = MOCK_SCENARIOS[idx];
    setTextInput(sc.initialTranscript);
    setSelectedPresetHint(sc.cityArea);
    if (idx === 0) {
      handlePlaySampleVoice('दीदी, वह घर के बाहर आ गया है... मेरा बच्चा भी मेरे साथ है। मैं ज़्यादा देर बात नहीं कर सकती।');
    }
  };

  const handleStartAnalysis = () => {
    if (!textInput.trim()) {
      alert('Please enter or speak distress speech to begin triage.');
      return;
    }
    onAnalyze(textInput, audioPreviewUrl || undefined, selectedPresetHint);
  };

  return (
    <div style={{ maxWidth: '920px', margin: '40px auto', padding: '0 20px', width: '100%' }}>
      {/* Screen Title */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'var(--accent-red-subtle)', border: '1px solid var(--accent-red-border)', padding: '6px 16px', borderRadius: '9999px', color: '#fca5a5', fontSize: '0.78rem', fontWeight: 600, marginBottom: '12px' }}>
          <Radio size={14} className="pulse-dot" />
          <span>INBOUND HELPLINE DISTRESS INTAKE (10s SLA)</span>
        </div>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#f8fafc', marginBottom: '8px' }}>
          Receive Distress Call Input
        </h1>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', maxWidth: '580px', margin: '0 auto' }}>
          Capture incoming Hinglish emergency voice, type live caller notes, or upload dispatch audio. Sarvam AI will transcribe and analyze threats instantly.
        </p>
      </div>

      {/* Main Intake Box */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: '12px', padding: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Mode Selector Tabs */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '16px' }}>
          <button
            onClick={() => setInputMode('speech')}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '10px 14px',
              borderRadius: '8px',
              background: inputMode === 'speech' ? 'var(--bg-elevated)' : 'transparent',
              border: inputMode === 'speech' ? '1px solid var(--border-active)' : '1px solid transparent',
              color: inputMode === 'speech' ? '#f8fafc' : 'var(--text-muted)',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <Mic size={15} color={inputMode === 'speech' ? '#ef4444' : 'currentColor'} />
            <span>1. Live Microphone Speech</span>
          </button>

          <button
            onClick={() => setInputMode('text')}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '10px 14px',
              borderRadius: '8px',
              background: inputMode === 'text' ? 'var(--bg-elevated)' : 'transparent',
              border: inputMode === 'text' ? '1px solid var(--border-active)' : '1px solid transparent',
              color: inputMode === 'text' ? '#f8fafc' : 'var(--text-muted)',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <FileText size={15} color={inputMode === 'text' ? '#38bdf8' : 'currentColor'} />
            <span>2. Direct Text / Notes</span>
          </button>

          <button
            onClick={() => setInputMode('upload')}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '10px 14px',
              borderRadius: '8px',
              background: inputMode === 'upload' ? 'var(--bg-elevated)' : 'transparent',
              border: inputMode === 'upload' ? '1px solid var(--border-active)' : '1px solid transparent',
              color: inputMode === 'upload' ? '#f8fafc' : 'var(--text-muted)',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <UploadCloud size={15} color={inputMode === 'upload' ? '#10b981' : 'currentColor'} />
            <span>3. Upload Audio File</span>
          </button>
        </div>

        {/* Input Mode 1: Live Speech */}
        {inputMode === 'speech' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '24px 0', border: '1px dashed var(--border-medium)', borderRadius: '8px', background: 'rgba(255,255,255,0.01)' }}>
            <button
              onClick={handleToggleRecord}
              style={{
                width: '72px',
                height: '72px',
                borderRadius: '50%',
                background: isRecording ? '#ef4444' : 'var(--bg-elevated)',
                border: isRecording ? '4px solid #fca5a5' : '2px solid var(--border-medium)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isRecording ? 'white' : '#f8fafc',
                cursor: 'pointer',
                boxShadow: isRecording ? '0 0 24px rgba(239, 68, 68, 0.6)' : 'none',
                transition: 'all 150ms ease'
              }}
            >
              {isRecording ? <MicOff size={28} /> : <Mic size={28} color="#ef4444" />}
            </button>

            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f8fafc', marginBottom: '4px' }}>
                {isRecording ? 'Listening via Live Microphone...' : 'Click to Speak Live Distress Utterance'}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {isRecording ? 'Speak in Hindi or Hinglish — click again to stop and transcribe' : 'Powered by Sarvam AI saaras:v4 Speech-to-Text'}
              </div>
            </div>

            {isTranscribing && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#38bdf8', fontSize: '0.78rem', fontWeight: 600 }}>
                <Sparkles size={14} className="pulse-dot" />
                <span>Sarvam AI is transcribing audio...</span>
              </div>
            )}
          </div>
        )}

        {/* Input Mode 3: Audio File Upload */}
        {inputMode === 'upload' && (
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '32px 0', border: '2px dashed var(--border-medium)', borderRadius: '8px', cursor: 'pointer', background: 'rgba(255,255,255,0.01)' }}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="audio/*"
              style={{ display: 'none' }}
            />
            <FileAudio size={36} color="#10b981" />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#f8fafc', marginBottom: '4px' }}>
                {uploadedFileName ? `Loaded: ${uploadedFileName}` : 'Select or Drop Audio Call File (WAV, MP3, M4A)'}
              </div>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                Will be transcribed directly through Sarvam AI Indic STT API
              </div>
            </div>

            {isTranscribing && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981', fontSize: '0.78rem' }}>
                <Sparkles size={14} /> Transcribing file...
              </div>
            )}
          </div>
        )}

        {/* Captured / Editable Transcript Box */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.74rem', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
            <span>Hinglish Distress Utterance / Transcript</span>
            <span>Edit or Review below</span>
          </div>

          <textarea
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            rows={3}
            placeholder="e.g. Didi, woh ghar ke bahar aa gaya hai… mera bachcha bhi mere saath hai. Main zyada der baat nahi kar sakti."
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: '8px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              color: '#f8fafc',
              fontSize: '0.92rem',
              fontFamily: 'var(--font-sans)',
              lineHeight: 1.6,
              resize: 'vertical'
            }}
          />
        </div>

        {/* Automated GIS Telemetry Notice */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '6px', background: 'rgba(56, 189, 248, 0.05)', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#38bdf8' }} className="pulse-dot" />
          <div style={{ fontSize: '0.78rem', color: '#93c5fd' }}>
            <strong>Automated Location & Proximity Dispatch:</strong> Incident location is parsed automatically from caller speech & telecom tower triangulation. Real-time nearby emergency units (Police 112, Hospital 108, Crisis Shelters) with live distance (km) and arrival ETAs will be mapped on the next screen.
          </div>
        </div>

        {/* Quick Sample Call Presets */}
        <div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>
            Or Load Emergency Call Preset:
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '8px' }}>
            {MOCK_SCENARIOS.map((sc, idx) => (
              <button
                key={sc.id}
                onClick={() => handleSelectPreset(idx)}
                style={{
                  padding: '10px 12px',
                  borderRadius: '6px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-muted)',
                  fontSize: '0.76rem',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '3px'
                }}
              >
                <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                  Case #{idx + 1}: {sc.title}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>
                  “{sc.initialTranscript.substring(0, 48)}...”
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Main Action Submit Button */}
        <button
          onClick={handleStartAnalysis}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            padding: '14px 24px',
            borderRadius: '8px',
            background: 'var(--accent-red)',
            color: 'white',
            border: 'none',
            fontSize: '0.95rem',
            fontWeight: 800,
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(239, 68, 68, 0.4)',
            marginTop: '8px'
          }}
        >
          <span>PROCESS & ANALYZE DISTRESS CALL [10s SLA]</span>
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
};
