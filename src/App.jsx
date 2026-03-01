import React, { useEffect, useState } from 'react';

const STRATEGIES = [
  { value: 'cache-first', label: 'Cache First' },
  { value: 'network-first', label: 'Network First' },
  { value: 'stale-while-revalidate', label: 'Stale While Revalidate' }
];

function App() {
  const [strategy, setStrategy] = useState('network-first');
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isControlled, setIsControlled] = useState(
    typeof navigator !== 'undefined' &&
      navigator.serviceWorker &&
      navigator.serviceWorker.controller
      ? true
      : false
  );

  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      console.warn('[App] Service workers are not supported in this browser');
      return;
    }

    let hasRefreshed = false;
    const hadControllerOnLoad =
      navigator.serviceWorker && navigator.serviceWorker.controller ? true : false;

    console.log('[App] Service worker support detected');
    console.log('[App] Initial SW controller present:', hadControllerOnLoad);

    const handleControllerChange = () => {
      const nowControlled =
        navigator.serviceWorker && navigator.serviceWorker.controller ? true : false;
      console.log('[App] Service worker controllerchange. Now controlling:', nowControlled);
      setIsControlled(nowControlled);

      // Handle first-load reload so that the page is controlled by the latest SW
      if (!hadControllerOnLoad && !hasRefreshed && nowControlled) {
        hasRefreshed = true;
        console.log('[App] First SW activation detected. Reloading page once.');
        window.location.reload();
      }
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    navigator.serviceWorker
      .register('/service-worker.js')
      .then((registration) => {
        console.log('[App] Service worker registered with scope:', registration.scope);
        const controlled =
          navigator.serviceWorker && navigator.serviceWorker.controller ? true : false;
        console.log('[App] After registration, SW controlling page:', controlled);
        setIsControlled(controlled);
      })
      .catch((err) => {
        console.error('[App] Service worker registration failed:', err);
      });

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  const fetchPosts = async () => {
    setLoading(true);
    setError('');
    setPosts([]);

    const url = `/posts?strategy=${encodeURIComponent(strategy)}`;
    console.log('[App] Fetching posts via:', url);

    try {
      const response = await fetch(url, { method: 'GET' });

      console.log('[App] Fetch response status:', response.status);

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const data = await response.json();
      console.log('[App] Received posts:', data);
      setPosts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('[App] Failed to fetch posts:', err);
      setError(err.message || 'Failed to fetch posts.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        minHeight: '100vh',
        margin: 0,
        padding: '2rem',
        backgroundColor: '#f5f5f7',
        color: '#111827',
        boxSizing: 'border-box'
      }}
    >
      <main
        style={{
          maxWidth: '720px',
          margin: '0 auto',
          backgroundColor: '#ffffff',
          borderRadius: '0.75rem',
          padding: '1.75rem 2rem',
          boxShadow:
            '0 10px 15px -3px rgba(15,23,42,0.12), 0 4px 6px -2px rgba(15,23,42,0.05)'
        }}
      >
        <h1
          style={{
            fontSize: '1.75rem',
            marginBottom: '0.75rem',
            fontWeight: 700,
            letterSpacing: '-0.03em'
          }}
        >
          API Caching Strategy Playground
        </h1>
        <p style={{ marginBottom: '1.25rem', color: '#4b5563', lineHeight: 1.5 }}>
          Explore how different Service Worker caching strategies affect API responses. Open your
          browser console and the Application &rarr; Cache Storage pane to follow along.
        </p>

        <section
          style={{
            marginBottom: '1.5rem',
            padding: '0.75rem 1rem',
            borderRadius: '0.5rem',
            backgroundColor: '#eff6ff',
            color: '#1d4ed8',
            fontSize: '0.9rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem'
          }}
        >
          <span style={{ fontWeight: 600 }}>Service Worker controlling this page:</span>
          <span
            style={{
              padding: '0.25rem 0.75rem',
              borderRadius: '999px',
              backgroundColor: isControlled ? '#dcfce7' : '#fee2e2',
              color: isControlled ? '#166534' : '#b91c1c',
              fontWeight: 600,
              fontVariantNumeric: 'tabular-nums'
            }}
          >
            {isControlled ? 'YES' : 'NO'}
          </span>
        </section>

        <section
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '1rem',
            alignItems: 'flex-end',
            marginBottom: '1.5rem'
          }}
        >
          <div style={{ flex: '1 1 220px', minWidth: '0' }}>
            <label
              htmlFor="strategy"
              style={{
                display: 'block',
                fontSize: '0.9rem',
                fontWeight: 600,
                marginBottom: '0.35rem',
                color: '#374151'
              }}
            >
              Caching strategy
            </label>
            <select
              id="strategy"
              value={strategy}
              onChange={(e) => setStrategy(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                borderRadius: '0.5rem',
                border: '1px solid #d1d5db',
                fontSize: '0.95rem',
                backgroundColor: '#f9fafb'
              }}
            >
              {STRATEGIES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={fetchPosts}
            disabled={loading}
            style={{
              padding: '0.6rem 1.2rem',
              borderRadius: '999px',
              border: 'none',
              backgroundColor: loading ? '#9ca3af' : '#2563eb',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '0.95rem',
              cursor: loading ? 'default' : 'pointer',
              boxShadow: '0 3px 6px rgba(37,99,235,0.3)',
              whiteSpace: 'nowrap'
            }}
          >
            {loading ? 'Loading…' : 'Fetch Posts'}
          </button>
        </section>

        {error && (
          <div
            style={{
              marginBottom: '1.25rem',
              padding: '0.75rem 1rem',
              borderRadius: '0.5rem',
              backgroundColor: '#fef2f2',
              color: '#b91c1c',
              fontSize: '0.9rem'
            }}
          >
            <strong style={{ display: 'block', marginBottom: '0.25rem' }}>Error</strong>
            <span>{error}</span>
          </div>
        )}

        <section>
          <h2
            style={{
              fontSize: '1.05rem',
              marginBottom: '0.5rem',
              fontWeight: 600,
              color: '#111827'
            }}
          >
            Posts
          </h2>
          {loading && posts.length === 0 && (
            <p style={{ color: '#6b7280', fontSize: '0.95rem' }}>Loading posts…</p>
          )}
          {!loading && posts.length === 0 && !error && (
            <p style={{ color: '#6b7280', fontSize: '0.95rem' }}>
              No posts loaded yet. Choose a strategy and click &quot;Fetch Posts&quot;.
            </p>
          )}
          {posts.length > 0 && (
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'grid',
                gap: '0.5rem'
              }}
            >
              {posts.map((post) => (
                <li
                  key={post.id}
                  style={{
                    padding: '0.6rem 0.75rem',
                    borderRadius: '0.5rem',
                    backgroundColor: '#f9fafb',
                    border: '1px solid #e5e7eb',
                    fontSize: '0.95rem'
                  }}
                >
                  <span style={{ fontWeight: 600, marginRight: '0.35rem' }}>#{post.id}</span>
                  <span>{post.title}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;

