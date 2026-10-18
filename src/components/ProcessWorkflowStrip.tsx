import React from 'react';
import {
  User,
  BrainCircuit,
  Headphones,
  Car,
  MapPin,
  CheckCircle2,
  ChevronRight
} from 'lucide-react';

export const ProcessWorkflowStrip: React.FC = () => {
  const steps = [
    {
      step: '1',
      title: 'User Inputs',
      desc: 'Voice or text message, shares location (optional).',
      icon: <User size={16} color="#ffffff" />,
      color: '#8b5cf6'
    },
    {
      step: '2',
      title: 'SAATHI Analyses',
      desc: 'Transcription, information extraction and risk indicators.',
      icon: <BrainCircuit size={16} color="#ffffff" />,
      color: '#ec4899'
    },
    {
      step: '3',
      title: 'Operator Reviews',
      desc: 'Checks evidence, confirms details and uses SafeSignal.',
      icon: <Headphones size={16} color="#ffffff" />,
      color: '#06b6d4'
    },
    {
      step: '4',
      title: 'Dispatches Help',
      desc: 'Sends location to nearest response unit / authority.',
      icon: <Car size={16} color="#ffffff" />,
      color: '#3b82f6'
    },
    {
      step: '5',
      title: 'Live Tracking',
      desc: 'Operator monitors unit on the map.',
      icon: <MapPin size={16} color="#ffffff" />,
      color: '#10b981'
    },
    {
      step: '6',
      title: 'Status Updates',
      desc: 'Caller and operator see progress and next steps.',
      icon: <CheckCircle2 size={16} color="#ffffff" />,
      color: '#14b8a6'
    }
  ];

  return (
    <div className="process-workflow-strip">
      <div className="workflow-steps-container">
        {steps.map((st, idx) => (
          <React.Fragment key={st.step}>
            <div className="workflow-step-card">
              <div className="step-icon-badge" style={{ backgroundColor: st.color }}>
                {st.icon}
              </div>
              <div className="step-text-wrap">
                <div className="step-title-line">
                  <span className="step-number">{st.step}.</span>
                  <span className="step-heading">{st.title}</span>
                </div>
                <div className="step-desc-line">{st.desc}</div>
              </div>
            </div>

            {idx < steps.length - 1 && (
              <div className="workflow-arrow-divider">
                <ChevronRight size={16} color="#475569" />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};
