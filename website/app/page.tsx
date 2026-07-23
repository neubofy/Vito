'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebaseClient';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        router.push('/login');
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  const sendCommand = async (command: string) => {
    if (!user) return;
    
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/command', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ command })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      alert(`Command ${command} sent successfully!`);
    } catch (error: any) {
      alert(`Failed to send command: ${error.message}`);
    }
  };

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading Veto...</div>;
  if (!user) return null; // Prevent flash before redirect

  return (
    <main style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
      <header style={{ marginBottom: '3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: '700', marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>Veto Dashboard</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>Device control & telemetry</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className="glass-panel" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '12px', borderRadius: '30px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#2ea043', boxShadow: '0 0 10px #2ea043' }}></div>
            <span style={{ fontSize: '0.9rem', fontWeight: '600' }}>{user.email}</span>
          </div>
          <button onClick={handleLogout} className="btn" style={{ padding: '8px 16px', fontSize: '0.9rem' }}>Logout</button>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📍</div>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Locate Device</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Ping the device to get its current GPS coordinates instantly.</p>
          <button onClick={() => sendCommand('LOCATE')} className="btn btn-primary" style={{ width: '100%' }}>Locate</button>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🔊</div>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Ring Alarm</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Play a loud siren even if the phone is on silent mode.</p>
          <button onClick={() => sendCommand('RING')} className="btn" style={{ width: '100%' }}>Trigger Siren</button>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📸</div>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Theft Mode</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Capture a photo using the front camera and upload it silently.</p>
          <button onClick={() => sendCommand('THEFT_MODE')} className="btn" style={{ width: '100%' }}>Capture Photo</button>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem', border: '1px solid rgba(248, 81, 73, 0.3)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⚠️</div>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', color: 'var(--danger-color)' }}>Factory Reset</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Permanently wipe all data from your device.</p>
          <button onClick={() => {
            if (window.confirm('Are you absolutely sure you want to WIPE your entire device? This cannot be undone.')) {
              sendCommand('WIPE');
            }
          }} className="btn btn-danger" style={{ width: '100%' }}>Wipe Device</button>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '1.5rem', height: '400px', display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Live Map Feed & Telemetry</h3>
        <div style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--glass-border)' }}>
          <p style={{ color: 'var(--text-secondary)' }}>Awaiting telemetry data...</p>
        </div>
      </div>
    </main>
  );
}
