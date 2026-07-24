'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { auth } from '@/lib/firebaseClient';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';

export default function LandingPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  useEffect(() => {
    if (!auth) {
      setLoadingAuth(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      console.log('Landing page auth state:', currentUser?.email);
      setUser(currentUser);
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
  };

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Navbar */}
      <nav style={{ padding: '1.5rem 3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(10,10,12,0.8)', backdropFilter: 'blur(10px)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ fontSize: '1.5rem', fontWeight: '800', background: 'linear-gradient(90deg, #fff, #888)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.5px' }}>
          VETO
        </div>
        <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
          <Link href="/privacy" className="nav-link">Privacy</Link>
          <Link href="/terms" className="nav-link">Terms</Link>
          {loadingAuth ? (
            <div style={{ padding: '0.6rem 1.5rem', width: '80px' }}></div>
          ) : user ? (
            <>
              <Link href="/dashboard" className="btn btn-primary" style={{ padding: '0.6rem 1.5rem', borderRadius: '30px' }}>Dashboard</Link>
              <button onClick={handleLogout} className="btn btn-danger" style={{ padding: '0.6rem 1.5rem', borderRadius: '30px' }}>Logout</button>
            </>
          ) : (
            <Link href="/login" className="btn btn-primary" style={{ padding: '0.6rem 1.5rem', borderRadius: '30px' }}>Login</Link>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '6rem 2rem', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div className="glow-blob" style={{ background: 'rgba(47, 129, 247, 0.15)', width: '600px', height: '600px', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: -1 }}></div>
        
        <h1 style={{ fontSize: 'clamp(3rem, 6vw, 5.5rem)', fontWeight: '800', lineHeight: 1.1, marginBottom: '1.5rem', letterSpacing: '-2px' }}>
          Absolute Control.<br/>
          <span style={{ background: 'linear-gradient(90deg, #2f81f7, #a482d8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Zero Compromise.</span>
        </h1>
        
        <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', maxWidth: '600px', marginBottom: '3rem', lineHeight: 1.6 }}>
          Veto is the ultimate Android security and remote management platform. 
          Track, lock, or wipe your device from anywhere in the world with military-grade precision.
        </p>

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          {loadingAuth ? (
            <div className="btn btn-primary" style={{ padding: '1rem 2.5rem', fontSize: '1.1rem', borderRadius: '40px', visibility: 'hidden' }}>
              Loading...
            </div>
          ) : user ? (
            <Link href="/dashboard" className="btn btn-primary" style={{ padding: '1rem 2.5rem', fontSize: '1.1rem', borderRadius: '40px', boxShadow: '0 8px 24px rgba(47, 129, 247, 0.3)' }}>
              Go to Dashboard
            </Link>
          ) : (
            <Link href="/login" className="btn btn-primary" style={{ padding: '1rem 2.5rem', fontSize: '1.1rem', borderRadius: '40px', boxShadow: '0 8px 24px rgba(47, 129, 247, 0.3)' }}>
              Access Dashboard
            </Link>
          )}
          <a href="https://github.com/pawanwashudev-official/Veto/releases" target="_blank" rel="noreferrer" className="btn" style={{ padding: '1rem 2.5rem', fontSize: '1.1rem', borderRadius: '40px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
            Download App
          </a>
        </div>
      </section>

      {/* Features Grid */}
      <section style={{ padding: '5rem 2rem', background: 'rgba(0,0,0,0.3)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
          
          <div className="glass-panel hover-lift" style={{ padding: '2.5rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '1.5rem' }}>📍</div>
            <h3 style={{ fontSize: '1.3rem', marginBottom: '1rem' }}>Global Tracking</h3>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>Ping your device securely and instantly receive precise GPS coordinates displayed right on your dashboard.</p>
          </div>

          <div className="glass-panel hover-lift" style={{ padding: '2.5rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '1.5rem' }}>🔒</div>
            <h3 style={{ fontSize: '1.3rem', marginBottom: '1rem' }}>Instant Lockdown</h3>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>Lock your device screen remotely, preventing unauthorized access the moment you realize it's missing.</p>
          </div>

          <div className="glass-panel hover-lift" style={{ padding: '2.5rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '1.5rem' }}>⚠️</div>
            <h3 style={{ fontSize: '1.3rem', marginBottom: '1rem' }}>Remote Wipe</h3>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>In extreme scenarios, trigger a factory reset to permanently delete all sensitive data and protect your identity.</p>
          </div>

        </div>
      </section>

      {/* Footer */}
      <footer style={{ padding: '3rem 2rem', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
        <p>&copy; {new Date().getFullYear()} Veto Security. All rights reserved.</p>
      </footer>
    </main>
  );
}
