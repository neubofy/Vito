'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebaseClient';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';

type FeedbackType = 'info' | 'success' | 'error';
interface Feedback { type: FeedbackType; text: string; }

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [activeCmd, setActiveCmd] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        setUser(null);
        router.push('/login');
      }
      setLoading(false);
    });
    
    return () => unsubscribeAuth();
  }, [router]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  const sendCommand = async (command: string) => {
    if (!user) return;
    
    // Start animation and feedback state
    setActiveCmd(command.startsWith('delete') ? 'delete' : command);
    setFeedback({ type: 'info', text: 'Executing command...' });
    
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
      
      setFeedback({ type: 'success', text: 'Command executed successfully!' });
      setTimeout(() => {
        setFeedback(null);
        setActiveCmd(null);
      }, 4000);
    } catch (error: any) {
      setFeedback({ type: 'error', text: `Failed: ${error.message}` });
      setTimeout(() => {
        setFeedback(null);
        setActiveCmd(null);
      }, 5000);
    }
  };

  const getBtnStyle = (cmd: string) => {
    if (activeCmd === cmd) {
      return feedback?.type === 'error' ? { animation: 'errorGlow 2s infinite' } : { animation: 'pulseGlow 2s infinite' };
    }
    return {};
  };

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading Veto...</div>;
  if (!user) return null;

  return (
    <main style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
      {feedback && (
        <div className={`notification-banner notification-${feedback.type}`}>
          {feedback.text}
        </div>
      )}
      
      <header style={{ marginBottom: '3rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: '700', marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>Veto Dashboard</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>Device control & telemetry</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          
          <div className="glass-panel" style={{ padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: '4px', borderRadius: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: '600', color: '#fff' }}>
                {user.displayName ? `${user.displayName} (` : ''}
                {user.email}
                {user.displayName ? ')' : ''}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
              <div style={{ 
                width: '8px', 
                height: '8px', 
                borderRadius: '50%', 
                backgroundColor: '#2ea043', 
                boxShadow: '0 0 10px #2ea043' 
              }}></div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Session Active
              </span>
            </div>
          </div>

          <button onClick={handleLogout} className="btn btn-danger" style={{ padding: '8px 16px', fontSize: '0.9rem' }}>Logout</button>
        </div>
      </header>

      <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Core Commands</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📍</div>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Locate Device</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Ping the device to get its current GPS coordinates instantly.</p>
          <button disabled={activeCmd === 'locate'} onClick={() => sendCommand('locate')} className="btn btn-primary" style={{ width: '100%', ...getBtnStyle('locate') }}>
            {activeCmd === 'locate' ? 'Locating...' : 'Locate'}
          </button>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🔊</div>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Ring Alarm</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Play a loud siren even if the phone is on silent mode.</p>
          <button disabled={activeCmd === 'ring'} onClick={() => sendCommand('ring')} className="btn" style={{ width: '100%', ...getBtnStyle('ring') }}>
            {activeCmd === 'ring' ? 'Sending...' : 'Trigger Siren'}
          </button>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🔒</div>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Lock Device</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Instantly lock the device screen requiring PIN/Password.</p>
          <button disabled={activeCmd === 'lock'} onClick={() => sendCommand('lock')} className="btn" style={{ width: '100%', ...getBtnStyle('lock') }}>
            {activeCmd === 'lock' ? 'Locking...' : 'Lock Screen'}
          </button>
        </div>
        
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📊</div>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Device Stats</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Get battery level, network info, and storage state.</p>
          <button disabled={activeCmd === 'stats'} onClick={() => sendCommand('stats')} className="btn" style={{ width: '100%', ...getBtnStyle('stats') }}>
            {activeCmd === 'stats' ? 'Fetching...' : 'Get Stats'}
          </button>
        </div>
      </div>

      <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Device Toggles</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
        
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🔦</div>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Flashlight</h3>
          <div style={{ display: 'flex', gap: '10px', marginTop: '1.5rem' }}>
            <button disabled={activeCmd === 'flash on'} onClick={() => sendCommand('flash on')} className="btn btn-primary" style={{ flex: 1, ...getBtnStyle('flash on') }}>
              {activeCmd === 'flash on' ? '...' : 'On'}
            </button>
            <button disabled={activeCmd === 'flash off'} onClick={() => sendCommand('flash off')} className="btn" style={{ flex: 1, ...getBtnStyle('flash off') }}>
              {activeCmd === 'flash off' ? '...' : 'Off'}
            </button>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🔵</div>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Bluetooth</h3>
          <div style={{ display: 'flex', gap: '10px', marginTop: '1.5rem' }}>
            <button disabled={activeCmd === 'bluetooth on'} onClick={() => sendCommand('bluetooth on')} className="btn btn-primary" style={{ flex: 1, ...getBtnStyle('bluetooth on') }}>
              {activeCmd === 'bluetooth on' ? '...' : 'On'}
            </button>
            <button disabled={activeCmd === 'bluetooth off'} onClick={() => sendCommand('bluetooth off')} className="btn" style={{ flex: 1, ...getBtnStyle('bluetooth off') }}>
              {activeCmd === 'bluetooth off' ? '...' : 'Off'}
            </button>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🗺️</div>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>GPS Tracking</h3>
          <div style={{ display: 'flex', gap: '10px', marginTop: '1.5rem' }}>
            <button disabled={activeCmd === 'gps on'} onClick={() => sendCommand('gps on')} className="btn btn-primary" style={{ flex: 1, ...getBtnStyle('gps on') }}>
              {activeCmd === 'gps on' ? '...' : 'On'}
            </button>
            <button disabled={activeCmd === 'gps off'} onClick={() => sendCommand('gps off')} className="btn" style={{ flex: 1, ...getBtnStyle('gps off') }}>
              {activeCmd === 'gps off' ? '...' : 'Off'}
            </button>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🌙</div>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Do Not Disturb</h3>
          <div style={{ display: 'flex', gap: '10px', marginTop: '1.5rem' }}>
            <button disabled={activeCmd === 'nodisturb on'} onClick={() => sendCommand('nodisturb on')} className="btn btn-primary" style={{ flex: 1, ...getBtnStyle('nodisturb on') }}>
              {activeCmd === 'nodisturb on' ? '...' : 'On'}
            </button>
            <button disabled={activeCmd === 'nodisturb off'} onClick={() => sendCommand('nodisturb off')} className="btn" style={{ flex: 1, ...getBtnStyle('nodisturb off') }}>
              {activeCmd === 'nodisturb off' ? '...' : 'Off'}
            </button>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🔕</div>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Ringer Mode</h3>
          <div style={{ display: 'flex', gap: '10px', marginTop: '1.5rem' }}>
            <button disabled={activeCmd === 'ringer normal'} onClick={() => sendCommand('ringer normal')} className="btn btn-primary" style={{ flex: 1, padding: '10px 5px', fontSize: '0.8rem', ...getBtnStyle('ringer normal') }}>
              {activeCmd === 'ringer normal' ? '...' : 'Normal'}
            </button>
            <button disabled={activeCmd === 'ringer vibrate'} onClick={() => sendCommand('ringer vibrate')} className="btn" style={{ flex: 1, padding: '10px 5px', fontSize: '0.8rem', ...getBtnStyle('ringer vibrate') }}>
              {activeCmd === 'ringer vibrate' ? '...' : 'Vibrate'}
            </button>
            <button disabled={activeCmd === 'ringer silent'} onClick={() => sendCommand('ringer silent')} className="btn" style={{ flex: 1, padding: '10px 5px', fontSize: '0.8rem', ...getBtnStyle('ringer silent') }}>
              {activeCmd === 'ringer silent' ? '...' : 'Silent'}
            </button>
          </div>
        </div>
      </div>

      <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>Experimental</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📸</div>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Camera Capture (Coming Soon)</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Capture a photo silently and upload it to the dashboard.</p>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button disabled className="btn" style={{ flex: 1, opacity: 0.5, cursor: 'not-allowed' }}>Front</button>
            <button disabled className="btn" style={{ flex: 1, opacity: 0.5, cursor: 'not-allowed' }}>Back</button>
          </div>
        </div>
        
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🚨</div>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Theft Mode (Coming Soon)</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Instantly lock device, ring siren, capture photo and send GPS.</p>
          <button disabled className="btn" style={{ width: '100%', opacity: 0.5, cursor: 'not-allowed' }}>Activate Theft Mode</button>
        </div>
      </div>

      <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', color: 'var(--danger-color)' }}>Danger Zone</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="glass-panel" style={{ padding: '1.5rem', border: '1px solid rgba(248, 81, 73, 0.3)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⚠️</div>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', color: 'var(--danger-color)' }}>Factory Reset</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Permanently wipe all data from your device.</p>
          <button disabled={activeCmd === 'delete'} onClick={() => {
            const password = window.prompt('WARNING: This will PERMANENTLY WIPE all data from your phone!\n\nTo proceed, please enter your Veto app password:');
            if (password) {
              sendCommand(`delete ${password}`);
            } else if (password !== null) {
              alert('Wipe cancelled. Password cannot be empty.');
            }
          }} className="btn btn-danger" style={{ width: '100%', ...getBtnStyle('delete') }}>
            {activeCmd === 'delete' ? 'Wiping...' : 'Wipe Device'}
          </button>
        </div>
      </div>

    </main>
  );
}
