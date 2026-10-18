import React from 'react';
import { HelpCircle, Check, Send, AlertCircle, Smartphone } from 'lucide-react';
import type { SafeSignalQuestion, StructuredTriage } from '../types';

interface SafeSignalPanelProps {
  questions: SafeSignalQuestion[];
  triage: StructuredTriage;
  onApproveQuestion: (id: string) => void;
  onSendToCaller: (id: string) => void;
}

export const SafeSignalPanel: React.FC<SafeSignalPanelProps> = ({
  questions,
  triage,
  onApproveQuestion,
  onSendToCaller
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', padding: '14px 18px', gap: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="section-title">
          <HelpCircle size={14} color="#06b6d4" />
          <span>SafeSignal — Covert Question Prompter</span>
        </div>

        <span style={{ fontSize: '0.68rem', color: '#10b981', fontWeight: 600, background: 'var(--accent-green-subtle)', padding: '2px 8px', borderRadius: '4px' }}>
          Human Operator in the Loop
        </span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {triage.missingDetails.map((detail, idx) => (
          <span
            key={idx}
            style={{
              background: 'var(--accent-red-subtle)',
              border: '1px solid var(--accent-red-border)',
              color: '#fca5a5',
              fontSize: '0.7rem',
              padding: '2px 8px',
              borderRadius: '4px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <AlertCircle size={10} />
            <span>Missing: {detail}</span>
          </span>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {questions.map((q) => {
          const isApproved = q.status === 'approved' || q.status === 'sent_to_caller';
          const isSent = q.status === 'sent_to_caller';

          return (
            <div
              key={q.id}
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.68rem' }}>
                <span style={{ color: '#38bdf8', fontWeight: 600, textTransform: 'uppercase' }}>
                  {q.category.replace('_', ' ')} • {q.responseType.replace('_', ' ')}
                </span>
                <span style={{ color: 'var(--text-dim)' }}>
                  {q.riskRating}
                </span>
              </div>

              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)' }}>
                {q.questionText}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                {q.hinglishText}
              </div>

              {q.callerAnswer && (
                <div
                  style={{
                    background: 'var(--accent-green-subtle)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '0.74rem',
                    color: '#6ee7b7'
                  }}
                >
                  Caller Response: <strong>{q.callerAnswer}</strong>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', marginTop: '2px' }}>
                {!isApproved && (
                  <button
                    className="subtle-btn"
                    onClick={() => onApproveQuestion(q.id)}
                    style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                  >
                    <Check size={11} color="#10b981" />
                    <span>Approve</span>
                  </button>
                )}

                {isApproved && !isSent && (
                  <button
                    className="subtle-btn"
                    onClick={() => onSendToCaller(q.id)}
                    style={{ padding: '3px 8px', fontSize: '0.72rem', background: 'var(--accent-blue-subtle)', color: '#93c5fd' }}
                  >
                    <Send size={11} />
                    <span>Send to Caller</span>
                  </button>
                )}

                {isSent && (
                  <span style={{ fontSize: '0.7rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Smartphone size={11} />
                    <span>Sent to Caller</span>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
