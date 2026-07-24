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
  const [deviceLinked, setDeviceLinked] = useState<boolean>(false);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<string | null>(null);
  const [photos, setPhotos] = useState<any[]>([]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // Start polling for data securely from the Next.js API
        const pollData = async () => {
          try {
            const token = await currentUser.getIdToken();
            const res = await fetch('/api/data', {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
              const { data, photos } = await res.json();
              if (data) {
                setDeviceLinked(!!data.fcmToken);
                if (data.latestCommandResult) setLastResult(data.latestCommandResult);
                if (data.latestCommandTime) setLastUpdateTime(new Date(data.latestCommandTime).toLocaleString());
              }
              if (photos) {
                setPhotos(photos);
              }
            }
          } catch (e) {
            console.error('Polling error:', e);
          }
        };
        pollData(); // initial fetch
        intervalId = setInterval(pollData, 5000); // poll every 5 seconds
      } else {
        setUser(null);
        router.push('/login');
      }
      setLoading(false);
    });
    
    return () => {
      unsubscribeAuth();
      if (intervalId) clearInterval(intervalId);
    };
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

  const renderTelemetryContent = (text: string) => {
    // 1. Detect GPS Telemetry
    const latMatch = text.match(/Lat:\s*([-\d.]+)/);
    const lonMatch = text.match(/Lon:\s*([-\d.]+)/);
    
    if (latMatch && lonMatch) {
      const lat = parseFloat(latMatch[1]);
      const lon = parseFloat(lonMatch[1]);
      const bbox = `${lon - 0.01},${lat - 0.01},${lon + 0.01},${lat + 0.01}`;
      const osmEmbedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lon}`;
      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
      
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>{text}</div>
          <div style={{ width: '100%', height: '300px', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.2)' }}>
            <iframe 
              width="100%" 
              height="100%" 
              frameBorder="0" 
              scrolling="no" 
              marginHeight={0} 
              marginWidth={0} 
              src={osmEmbedUrl} 
              style={{ border: 'none' }}
            ></iframe>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
             <a href={mapsUrl} target="_blank" rel="noreferrer" style={{ color: '#2f81f7', fontSize: '0.8rem', textDecoration: 'none' }}>View in Google Maps</a>
          </div>
        </div>
      );
    }
    
    // 2. Detect Stats Telemetry
    if (text.includes('Model:') && text.includes('Battery:')) {
      const parseValue = (key: string) => {
        const regex = new RegExp(`${key}\\s*(.+)`);
        const match = text.match(regex);
        return match ? match[1].trim() : 'N/A';
      };

      return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Device Model</div>
            <div style={{ fontSize: '1.1rem', fontWeight: '500', color: '#fff', marginTop: '4px' }}>{parseValue('Model:')}</div>
          </div>
          <div style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>OS Version</div>
            <div style={{ fontSize: '1.1rem', fontWeight: '500', color: '#fff', marginTop: '4px' }}>{parseValue('OS:')}</div>
          </div>
          <div style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Battery</div>
            <div style={{ fontSize: '1.1rem', fontWeight: '500', color: '#3fb950', marginTop: '4px' }}>{parseValue('Battery:')}</div>
          </div>
          <div style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>SIM Network</div>
            <div style={{ fontSize: '1.1rem', fontWeight: '500', color: '#fff', marginTop: '4px' }}>{parseValue('SIM Network:')}</div>
          </div>
          <div style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', gridColumn: '1 / -1' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Advanced Details</div>
            <div style={{ fontSize: '0.85rem', color: '#a5d6ff', marginTop: '8px', fontFamily: 'monospace' }}>
              IMEI: {parseValue('IMEI:')}<br/>
              Phone: {parseValue('Phone Number:')}<br/>
              IPs: {parseValue('IPs:')}<br/>
              WiFi: {parseValue('WiFi:')}
            </div>
          </div>
        </div>
      );
    }
    
    return text;
  };

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
                backgroundColor: deviceLinked ? '#2ea043' : '#f85149', 
                boxShadow: deviceLinked ? '0 0 10px #2ea043' : '0 0 10px #f85149' 
              }}></div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {deviceLinked ? 'App Connected (FCM Linked)' : 'App Not Connected'}
              </span>
            </div>
          </div>

          <button onClick={handleLogout} className="btn btn-danger" style={{ padding: '8px 16px', fontSize: '0.9rem' }}>Logout</button>
        </div>
      </header>

      {/* Captured Photos Gallery */}
      {photos.length > 0 && (
        <div className="glass-panel" style={{ marginBottom: '1.5rem', padding: '1.5rem', border: '1px solid rgba(235, 163, 54, 0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.3rem', color: '#eba336', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#eba336', animation: 'pulseGlow 2s infinite' }}></div>
              Captured Photos
            </h2>
          </div>
          <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
            {photos.map((photo, i) => (
              <div key={i} style={{ flexShrink: 0, position: 'relative', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt="Captured" style={{ height: '250px', width: 'auto', objectFit: 'cover' }} />
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.7)', padding: '4px 8px', fontSize: '0.75rem', color: '#fff' }}>
                  {new Date(photo.timestamp).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Latest Command Result Box */}
      {lastResult && (
        <div className="glass-panel" style={{ marginBottom: '3rem', padding: '1.5rem', border: '1px solid rgba(47, 129, 247, 0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.3rem', color: '#2f81f7', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#2f81f7', animation: 'pulseGlow 2s infinite' }}></div>
              Latest Device Telemetry
            </h2>
            {lastUpdateTime && <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Received: {lastUpdateTime}</span>}
          </div>
          <div style={{ 
            backgroundColor: 'rgba(0,0,0,0.4)', 
            padding: '1rem', 
            borderRadius: '8px', 
            fontFamily: 'monospace', 
            whiteSpace: 'pre-wrap',
            color: '#e6edf3',
            fontSize: '0.95rem',
            border: '1px solid rgba(255,255,255,0.05)'
          }}>
            {renderTelemetryContent(lastResult)}
          </div>
        </div>
      )}

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
          <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Camera Capture</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Capture a photo silently and upload it to the dashboard.</p>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button disabled={activeCmd === 'camera front'} onClick={() => sendCommand('camera front')} className="btn btn-primary" style={{ flex: 1, ...getBtnStyle('camera front') }}>
              {activeCmd === 'camera front' ? '...' : 'Front'}
            </button>
            <button disabled={activeCmd === 'camera back'} onClick={() => sendCommand('camera back')} className="btn" style={{ flex: 1, ...getBtnStyle('camera back') }}>
              {activeCmd === 'camera back' ? '...' : 'Back'}
            </button>
          </div>
        </div>
        
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🚨</div>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Theft Mode</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Instantly lock device, ring siren, capture photo and send GPS.</p>
          <button disabled={activeCmd === 'theft'} onClick={() => sendCommand('theft')} className="btn" style={{ width: '100%', borderColor: '#eba336', color: '#eba336', ...getBtnStyle('theft') }}>
            {activeCmd === 'theft' ? 'Activating...' : 'Activate Theft Mode'}
          </button>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏱️</div>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Background Upload</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Toggle periodic background location tracking.</p>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button disabled={activeCmd === 'autoloc on'} onClick={() => sendCommand('autoloc on')} className="btn btn-primary" style={{ flex: 1, ...getBtnStyle('autoloc on') }}>
              {activeCmd === 'autoloc on' ? '...' : 'Enable'}
            </button>
            <button disabled={activeCmd === 'autoloc off'} onClick={() => sendCommand('autoloc off')} className="btn" style={{ flex: 1, ...getBtnStyle('autoloc off') }}>
              {activeCmd === 'autoloc off' ? '...' : 'Disable'}
            </button>
          </div>
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
