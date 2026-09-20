'use client';

/**
 * The last resort: an error in the root layout itself.
 *
 * `app/error.tsx` handles a page that throws, but it renders inside the
 * layout, so it cannot help when the layout is what failed. This
 * replaces the whole document, which is why it carries its own html and
 * body and why it uses no component, no stylesheet and no font: every
 * one of those is a thing that could be the reason we are here.
 */
export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#12161c',
          color: '#e8eaed',
          fontFamily: 'system-ui, sans-serif',
          padding: '1rem',
        }}
      >
        <main style={{ maxWidth: '32rem' }}>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
            Something went wrong
          </h1>
          <p style={{ marginBottom: '1rem', lineHeight: 1.5 }}>
            The page could not be shown. Nothing you were reading has been changed, and no
            dates have been recalculated.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              minHeight: '2.75rem',
              padding: '0 1rem',
              borderRadius: '0.5rem',
              border: 0,
              background: '#7cc4ff',
              color: '#12161c',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
          <p style={{ marginTop: '1rem' }}>
            {/* A plain anchor on purpose: the router is one of the things
                that could have failed to get us here, so this asks the
                browser for a fresh document rather than a soft navigation. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/" style={{ color: '#7cc4ff' }}>
              Go to the home page
            </a>
          </p>
        </main>
      </body>
    </html>
  );
}
