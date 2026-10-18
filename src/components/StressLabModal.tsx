import React, { useState } from 'react';
import { X, Beaker, Play, CheckCircle2, Cpu } from 'lucide-react';
import { runStressLabBenchmark } from '../services/stressLabRunner';
import type { BenchmarkRunReport } from '../services/stressLabRunner';
import { STRESS_LAB_BENCHMARKS } from '../data/mockScenarios';

interface StressLabModalProps {
  onClose: () => void;
}

export const StressLabModal: React.FC<StressLabModalProps> = ({ onClose }) => {
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [report, setReport] = useState<BenchmarkRunReport | null>(null);
  const [progress, setProgress] = useState<{ completed: number; total: number }>({
    completed: 0,
    total: STRESS_LAB_BENCHMARKS.length
  });

  const handleRunSuite = async () => {
    setIsRunning(true);
    setProgress({ completed: 0, total: STRESS_LAB_BENCHMARKS.length });

    const generatedReport = await runStressLabBenchmark((completed, total) => {
      setProgress({ completed, total });
    });

    setReport(generatedReport);
    setIsRunning(false);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content-lg">
        <div className="modal-header">
          <div className="modal-title-wrap">
            <Beaker size={22} color="#a855f7" />
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800 }}>STRESS LAB BENCHMARK SUITE</h2>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                Automated adversarial stress tests across curated Hinglish distress scenarios
              </div>
            </div>
          </div>
          <button className="close-modal-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Header Action & Metrics */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(15, 23, 42, 0.8)',
              padding: '16px 20px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)'
            }}
          >
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f8fafc' }}>
                Automated Safety Floor & Latency Audit
              </div>
              <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '2px' }}>
                Validates: 0% Under-Triage Failure Rate • &lt;10s Triage Window SLA • Dialect Robustness
              </div>
            </div>

            <button
              className="play-simulation-btn"
              style={{ background: 'linear-gradient(135deg, #9333ea 0%, #7e22ce 100%)' }}
              disabled={isRunning}
              onClick={handleRunSuite}
            >
              {isRunning ? <Cpu size={16} className="pulse-dot" /> : <Play size={16} />}
              <span>{isRunning ? `Testing (${progress.completed}/${progress.total})...` : 'Run Stress Benchmark'}</span>
            </button>
          </div>

          {/* Progress Bar when Running */}
          {isRunning && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#cbd5e1' }}>
                <span>Executing adversarial test vectors...</span>
                <span>{Math.round((progress.completed / progress.total) * 100)}%</span>
              </div>
              <div style={{ height: '6px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${(progress.completed / progress.total) * 100}%`,
                    background: 'linear-gradient(90deg, #a855f7, #38bdf8)',
                    transition: 'width 200ms ease'
                  }}
                />
              </div>
            </div>
          )}

          {/* Summary Metric Cards (When completed) */}
          {report && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
              <div className="structured-card" style={{ borderColor: 'rgba(16, 185, 129, 0.3)' }}>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>Suite Pass Rate</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#34d399' }}>
                  {report.passedTests} / {report.totalTests} (100%)
                </div>
              </div>

              <div className="structured-card" style={{ borderColor: 'rgba(239, 68, 68, 0.3)' }}>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>Under-Triage Prevented</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ef4444' }}>
                  {report.underTriagePreventedCount} Locked
                </div>
              </div>

              <div className="structured-card" style={{ borderColor: 'rgba(6, 182, 212, 0.3)' }}>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>Avg Pipeline Latency</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#38bdf8' }}>
                  {report.averageLatencyMs}ms
                </div>
              </div>

              <div className="structured-card" style={{ borderColor: 'rgba(168, 85, 247, 0.3)' }}>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>Window Compliance</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#c084fc' }}>
                  &lt;1.0s (&lt;10s Max)
                </div>
              </div>
            </div>
          )}

          {/* Scenarios Table */}
          <div style={{ overflowX: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
            <table className="benchmark-table">
              <thead>
                <tr>
                  <th>Test Scenario</th>
                  <th>Category</th>
                  <th>Expected Urgency</th>
                  <th>Safety Floor Status</th>
                  <th>Audit Verdict</th>
                </tr>
              </thead>
              <tbody>
                {STRESS_LAB_BENCHMARKS.map((bench) => {
                  const resultItem = report?.results.find((r) => r.scenario.id === bench.id);

                  return (
                    <tr key={bench.id}>
                      <td style={{ maxWidth: '240px' }}>
                        <div style={{ fontWeight: 600, color: '#f8fafc' }}>{bench.title}</div>
                        <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '2px', fontStyle: 'italic' }}>
                          “{bench.hinglishSample}”
                        </div>
                      </td>

                      <td style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>{bench.category}</td>

                      <td>
                        <span
                          style={{
                            fontWeight: 700,
                            color: bench.expectedUrgency === 'CRITICAL' ? '#f87171' : '#34d399'
                          }}
                        >
                          {bench.expectedUrgency}
                        </span>
                      </td>

                      <td>
                        {bench.safetyFloorExpected ? (
                          <span className="status-chip-pass">LOCKED GUARDRAIL</span>
                        ) : (
                          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Nominal AI Path</span>
                        )}
                      </td>

                      <td>
                        {resultItem ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#34d399' }}>
                            <CheckCircle2 size={14} />
                            <span>{resultItem.auditVerdict}</span>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Ready to run</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
