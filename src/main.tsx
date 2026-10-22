import { StrictMode, Component, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class GlobalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('SAATHI Uncaught Application Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0f172a',
          color: '#ffffff',
          padding: '20px',
          fontFamily: 'Inter, system-ui, sans-serif',
          textAlign: 'center'
        }}>
          <div style={{
            maxWidth: '480px',
            width: '100%',
            background: '#1e293b',
            border: '1.5px solid #ef4444',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🛡️</div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 8px 0', color: '#f8fafc' }}>
              SAATHI Emergency Portal Recovery
            </h1>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0 0 16px 0', lineHeight: 1.5 }}>
              The application encountered an unexpected runtime state. Your safety connection is maintained.
            </p>

            {this.state.error && (
              <div style={{
                background: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '8px',
                padding: '10px',
                fontSize: '0.75rem',
                color: '#fca5a5',
                fontFamily: 'monospace',
                textAlign: 'left',
                overflowX: 'auto',
                marginBottom: '16px',
                maxHeight: '100px'
              }}>
                {this.state.error.message || String(this.state.error)}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                onClick={() => window.location.reload()}
                style={{
                  background: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 16px',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  cursor: 'pointer'
                }}
              >
                Reload SAATHI App
              </button>

              <a
                href="tel:112"
                style={{
                  background: '#dc2626',
                  color: '#ffffff',
                  textDecoration: 'none',
                  borderRadius: '8px',
                  padding: '10px 16px',
                  fontWeight: 800,
                  fontSize: '0.88rem',
                  display: 'block'
                }}
              >
                Immediate Distress? Call Police 112
              </a>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GlobalErrorBoundary>
      <App />
    </GlobalErrorBoundary>
  </StrictMode>,
)
