'use client';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0b1120', color: '#f1f5f9', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
      <div style={{ maxWidth: '28rem', width: '100%', background: '#1e293b', borderRadius: '12px', border: '1px solid #334155', padding: '2.5rem', textAlign: 'center' }}>
        <div style={{ width: '4rem', height: '4rem', margin: '0 auto 1.5rem', background: 'rgba(239,68,68,0.15)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.75rem' }}>Something went wrong</h2>
        <p style={{ color: '#94a3b8', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
          {error?.message || 'An unexpected error occurred. Please try again.'}
        </p>
        {error?.digest && (
          <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '1.5rem', wordBreak: 'break-all' }}>Error ID: {error.digest}</p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <button
            onClick={() => reset()}
            style={{ width: '100%', padding: '0.75rem', background: '#22c55e', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer' }}
          >
            Try again
          </button>
          <button
            onClick={() => window.location.href = '/'}
            style={{ width: '100%', padding: '0.75rem', background: '#334155', color: 'white', border: '1px solid #475569', borderRadius: '8px', fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer' }}
          >
            Go to home
          </button>
        </div>
      </div>
    </div>
  );
}
