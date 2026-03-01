'use client';

/**
 * Global error boundary — catches errors in the root layout (including providers).
 * Must render its own <html> and <body> because the root layout may have crashed.
 * Uses ZERO external imports (no Tailwind, no components) for maximum resilience.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          backgroundColor: '#0b1120',
          color: '#f1f5f9',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          padding: '2rem',
        }}
      >
        <div
          style={{
            maxWidth: '28rem',
            width: '100%',
            background: '#1e293b',
            borderRadius: '12px',
            border: '1px solid #334155',
            padding: '2.5rem',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: '4rem',
              height: '4rem',
              margin: '0 auto 1.5rem',
              background: 'rgba(239,68,68,0.15)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2rem',
            }}
          >
            ⚠️
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.75rem' }}>
            Application Error
          </h2>
          <p style={{ color: '#94a3b8', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
            {error?.message || 'A critical error occurred. Please reload the page.'}
          </p>
          {error?.digest && (
            <p
              style={{
                fontSize: '0.75rem',
                color: '#64748b',
                marginBottom: '1.5rem',
                wordBreak: 'break-all',
              }}
            >
              Error ID: {error.digest}
            </p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button
              onClick={() => reset()}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: '#22c55e',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '0.95rem',
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
            <button
              onClick={() => (window.location.href = '/')}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: '#334155',
                color: 'white',
                border: '1px solid #475569',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '0.95rem',
                cursor: 'pointer',
              }}
            >
              Reload
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
