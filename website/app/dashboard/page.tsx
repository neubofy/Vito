'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebaseClient';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { db } from '@/lib/firebaseClient';
import { collection, doc, onSnapshot } from 'firebase/firestore';

type FeedbackType = 'info' | 'success' | 'error';
interface Feedback { type: FeedbackType; text: string; }

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [activeCmd, setActiveCmd] = useState<string | null>(null);
  const [isCommandPending, setIsCommandPending] = useState<boolean>(false);
  const [deviceLinked, setDeviceLinked] = useState<boolean>(false);
  
  const [results, setResults] = useState<Record<string, any>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('veto_results');
      if (saved) return JSON.parse(saved);
    }
    return {};
  });
  
  const [photos, setPhotos] = useState<Record<string, any>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('veto_photos');
      if (saved) return JSON.parse(saved);
    }
    return {};
  });
  
  const [commandStartTime, setCommandStartTime] = useState<number>(0);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOutput, setSelectedOutput] = useState<string | null>(null);


  // Real-time Firestore Listeners
  useEffect(() => {
    if (!user || !db) return;

    const unsubUser = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setDeviceLinked(!!data?.fcmToken);
      }
    }, (error) => {
      console.error('Snapshot error (Check Firestore Rules!):', error);
      if (error.code === 'permission-denied') {
        setFeedback({ type: 'error', text: 'Database Access Denied: Please update Firebase Firestore Rules to allow client reads.' });
      }
    });

    const unsubResults = onSnapshot(collection(db, 'users', user.uid, 'results'), (snapshot) => {
      const newResults: Record<string, any> = {};
      snapshot.forEach(d => { newResults[d.id] = d.data(); });
      setResults(newResults);
      localStorage.setItem('veto_results', JSON.stringify(newResults));
    });

    const unsubPhotos = onSnapshot(collection(db, 'users', user.uid, 'photos'), (snapshot) => {
      const newPhotos: Record<string, any> = {};
      snapshot.forEach(d => { newPhotos[d.id] = d.data(); });
      setPhotos(newPhotos);
      localStorage.setItem('veto_photos', JSON.stringify(newPhotos));
    });

    return () => {
      unsubUser();
      unsubResults();
      unsubPhotos();
    };
  }, [user]);

  // Watch for command completion
  useEffect(() => {
    if (!activeCmd || !isCommandPending) return;
    const baseCmd = activeCmd.split(' ')[0];
    const res = results[baseCmd];
    const phto = photos[baseCmd];
    
    // Check if result OR photo is newer than command start time
    const resIsNew = res && new Date(res.timestamp).getTime() > commandStartTime;
    const photoIsNew = phto && new Date(phto.timestamp).getTime() > commandStartTime;
    
    if (resIsNew || photoIsNew) {
      setIsCommandPending(false);
      setActiveCmd(null);
      setFeedback({ type: 'success', text: 'Data updated instantly! ✨' });
      setTimeout(() => setFeedback(null), 4000);
    }
  }, [results, photos, activeCmd, isCommandPending, commandStartTime]);

  // Initial fetch when auth state changes
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
    
    if (isCommandPending) {
      setFeedback({ type: 'error', text: 'Please wait! A previous command is still pending.' });
      setTimeout(() => setFeedback(null), 3000);
      return;
    }
    
    setActiveCmd(command.startsWith('delete') ? 'delete' : command);
    setIsCommandPending(true);
    setCommandStartTime(Date.now());
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
      
      setFeedback({ type: 'success', text: 'Command sent! Waiting for device...' });
      
      setTimeout(() => {
        setIsCommandPending((prev) => {
          if (prev) {
            setFeedback({ type: 'info', text: 'Command taking a while. You can manually refresh later.' });
            setActiveCmd(null);
            setTimeout(() => setFeedback(null), 4000);
            return false;
          }
          return prev;
        });
      }, 30000);
    } catch (error: any) {
      setFeedback({ type: 'error', text: `Failed: ${error.message}` });
      setIsCommandPending(false);
      setActiveCmd(null);
      setTimeout(() => setFeedback(null), 5000);
    }
  };

  const deleteData = async (commandName?: string, all?: boolean) => {
    if (!user || (!commandName && !all)) return;
    if (!confirm(`Are you sure you want to delete ${all ? 'ALL telemetry and photos' : `the ${commandName} data`}? This cannot be undone.`)) return;

    setFeedback({ type: 'info', text: 'Deleting data...' });
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/data/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ commandName, all })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setFeedback({ type: 'success', text: data.message });
      setTimeout(() => setFeedback(null), 3000);
      
      if (all) {
        setResults({});
        setPhotos({});
        localStorage.removeItem('veto_results');
        localStorage.removeItem('veto_photos');
      } else if (commandName) {
        setResults(prev => {
          const next = { ...prev };
          delete next[commandName];
          localStorage.setItem('veto_results', JSON.stringify(next));
          return next;
        });
        setPhotos(prev => {
          const next = { ...prev };
          delete next[commandName];
          localStorage.setItem('veto_photos', JSON.stringify(next));
          return next;
        });
        setSelectedOutput(null);
      }
    } catch (error: any) {
      setFeedback({ type: 'error', text: `Delete failed: ${error.message}` });
      setTimeout(() => setFeedback(null), 5000);
    }
  };

  const deleteAccount = async () => {
    if (!user) return;
    const confirmText = prompt('Type "DELETE" to permanently delete your account and all data. This cannot be undone.');
    if (confirmText !== 'DELETE') {
      alert('Account deletion cancelled.');
      return;
    }

    setFeedback({ type: 'info', text: 'Deleting account...' });
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/user/delete', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      localStorage.removeItem('veto_results');
      localStorage.removeItem('veto_photos');
      await signOut(auth);
      router.push('/login');
    } catch (error: any) {
      setFeedback({ type: 'error', text: `Account deletion failed: ${error.message}` });
      setTimeout(() => setFeedback(null), 5000);
    }
  };

  const getBtnStyle = (cmd: string) => {
    if (activeCmd === cmd) {
      return feedback?.type === 'error' ? { animation: 'errorGlow 2s infinite' } : { animation: 'pulseGlow 2s infinite' };
    }
    return {};
  };

  const renderTelemetryContent = (text: string) => {
    const latMatch = text.match(/Lat:\s*([-\d.]+)/);
    const lonMatch = text.match(/Lon:\s*([-\d.]+)/);
    
    if (latMatch && lonMatch) {
      const lat = parseFloat(latMatch[1]);
      const lon = parseFloat(lonMatch[1]);
      const googleEmbedUrl = `https://maps.google.com/maps?q=${lat},${lon}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
      
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ width: '100%', height: '200px', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.2)' }}>
            <iframe width="100%" height="100%" frameBorder="0" scrolling="no" src={googleEmbedUrl} style={{ border: 'none' }}></iframe>
          </div>
          <div style={{ fontSize: '0.8rem' }}>{text}</div>
        </div>
      );
    }
    
    if (text.includes('Model:') && text.includes('Battery:')) {
      return <div style={{ whiteSpace: 'pre-wrap' }}>{text}</div>;
    }
    
    return text;
  };

  const renderResult = (baseCmd: string) => {
    const res = results[baseCmd];
    const phto = photos[baseCmd];
    if (!res && !phto) return <div style={{ marginTop: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>No data yet</div>;
    const timestamp = Math.max(res?.timestamp || 0, phto?.timestamp || 0);
    return (
      <button onClick={() => setSelectedOutput(baseCmd)} className="btn" style={{ marginTop: '1rem', width: '100%', fontSize: '0.9rem', backgroundColor: 'rgba(255,255,255,0.1)' }}>
        View Output ({new Date(timestamp).toLocaleTimeString()})
      </button>
    );
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
                {user.email}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
              <div style={{ 
                width: '8px', height: '8px', borderRadius: '50%', 
                backgroundColor: deviceLinked ? '#2ea043' : '#f85149', 
                boxShadow: deviceLinked ? '0 0 10px #2ea043' : '0 0 10px #f85149' 
              }}></div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {deviceLinked ? 'App Connected' : 'App Not Connected'}
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
          <button disabled={activeCmd === 'locate'} onClick={() => sendCommand('locate')} className="btn btn-primary" style={{ width: '100%', marginBottom: '1rem', ...getBtnStyle('locate') }}>
            {activeCmd === 'locate' ? 'Locating...' : 'Locate'}
          </button>
          {renderResult('locate')}
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🔊</div>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Ring Alarm</h3>
          <button disabled={activeCmd === 'ring'} onClick={() => sendCommand('ring')} className="btn" style={{ width: '100%', marginBottom: '1rem', ...getBtnStyle('ring') }}>
            {activeCmd === 'ring' ? 'Sending...' : 'Trigger Siren'}
          </button>
          {renderResult('ring')}
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🔒</div>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Lock Device</h3>
          <button disabled={activeCmd === 'lock'} onClick={() => sendCommand('lock')} className="btn" style={{ width: '100%', marginBottom: '1rem', ...getBtnStyle('lock') }}>
            {activeCmd === 'lock' ? 'Locking...' : 'Lock Screen'}
          </button>
          {renderResult('lock')}
        </div>
        
        <div className="glass-panel" style={{ padding: '1.5rem', gridColumn: '1 / -1' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📊</div>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Device Stats</h3>
          <button disabled={activeCmd === 'stats'} onClick={() => sendCommand('stats')} className="btn" style={{ width: '100%', marginBottom: '1rem', ...getBtnStyle('stats') }}>
            {activeCmd === 'stats' ? 'Fetching...' : 'Get Stats'}
          </button>
          {renderResult('stats')}
        </div>
      </div>

      <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Device Toggles</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
        
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🔦</div>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Flashlight</h3>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '1rem' }}>
            <button disabled={activeCmd === 'flash on'} onClick={() => sendCommand('flash on')} className="btn btn-primary" style={{ flex: 1, ...getBtnStyle('flash on') }}>On</button>
            <button disabled={activeCmd === 'flash off'} onClick={() => sendCommand('flash off')} className="btn" style={{ flex: 1, ...getBtnStyle('flash off') }}>Off</button>
          </div>
          {renderResult('flash')}
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🔵</div>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Bluetooth</h3>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '1rem' }}>
            <button disabled={activeCmd === 'bluetooth on'} onClick={() => sendCommand('bluetooth on')} className="btn btn-primary" style={{ flex: 1, ...getBtnStyle('bluetooth on') }}>On</button>
            <button disabled={activeCmd === 'bluetooth off'} onClick={() => sendCommand('bluetooth off')} className="btn" style={{ flex: 1, ...getBtnStyle('bluetooth off') }}>Off</button>
          </div>
          {renderResult('bluetooth')}
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🗺️</div>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>GPS Tracking</h3>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '1rem' }}>
            <button disabled={activeCmd === 'gps on'} onClick={() => sendCommand('gps on')} className="btn btn-primary" style={{ flex: 1, ...getBtnStyle('gps on') }}>On</button>
            <button disabled={activeCmd === 'gps off'} onClick={() => sendCommand('gps off')} className="btn" style={{ flex: 1, ...getBtnStyle('gps off') }}>Off</button>
          </div>
          {renderResult('gps')}
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🌙</div>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Do Not Disturb</h3>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '1rem' }}>
            <button disabled={activeCmd === 'nodisturb on'} onClick={() => sendCommand('nodisturb on')} className="btn btn-primary" style={{ flex: 1, ...getBtnStyle('nodisturb on') }}>On</button>
            <button disabled={activeCmd === 'nodisturb off'} onClick={() => sendCommand('nodisturb off')} className="btn" style={{ flex: 1, ...getBtnStyle('nodisturb off') }}>Off</button>
          </div>
          {renderResult('nodisturb')}
        </div>
      </div>

      <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>Experimental</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📸</div>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Camera Capture</h3>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '1rem' }}>
            <button disabled={activeCmd === 'camera front'} onClick={() => sendCommand('camera front')} className="btn btn-primary" style={{ flex: 1, ...getBtnStyle('camera front') }}>Front</button>
            <button disabled={activeCmd === 'camera back'} onClick={() => sendCommand('camera back')} className="btn" style={{ flex: 1, ...getBtnStyle('camera back') }}>Back</button>
          </div>
          {renderResult('camera')}
        </div>
        
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🚨</div>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Theft Mode</h3>
          <button disabled={activeCmd === 'theft'} onClick={() => sendCommand('theft')} className="btn" style={{ width: '100%', borderColor: '#eba336', color: '#eba336', marginBottom: '1rem', ...getBtnStyle('theft') }}>
            {activeCmd === 'theft' ? 'Activating...' : 'Activate Theft Mode'}
          </button>
          {renderResult('theft')}
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

        <div className="glass-panel" style={{ padding: '1.5rem', border: '1px solid rgba(248, 81, 73, 0.3)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🧹</div>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', color: 'var(--danger-color)' }}>Delete Cloud Data</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Erase all stored telemetry and photos from the database.</p>
          <button onClick={() => deleteData(undefined, true)} className="btn btn-danger" style={{ width: '100%' }}>
            Delete All Data
          </button>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem', border: '1px solid rgba(248, 81, 73, 0.3)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>☠️</div>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', color: 'var(--danger-color)' }}>Delete Account</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Permanently delete your account and all associated data.</p>
          <button onClick={() => deleteAccount()} className="btn btn-danger" style={{ width: '100%' }}>
            Delete Account
          </button>
        </div>
      </div>
      {/* Reusable Output Modal */}
      {selectedOutput && (results[selectedOutput] || photos[selectedOutput]) && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1000,
          display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem'
        }} onClick={() => setSelectedOutput(null)}>
          <div className="glass-panel" style={{
            width: '100%', maxWidth: '600px', maxHeight: '80vh', overflowY: 'auto',
            padding: '2rem', position: 'relative', border: '1px solid rgba(255,255,255,0.2)'
          }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedOutput(null)} style={{
              position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none',
              color: '#fff', fontSize: '1.5rem', cursor: 'pointer'
            }}>×</button>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', textTransform: 'capitalize', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{selectedOutput} Output</span>
              <button onClick={() => deleteData(selectedOutput)} className="btn btn-danger" style={{ padding: '4px 12px', fontSize: '0.8rem', marginRight: '2rem' }}>
                Delete Data
              </button>
            </h2>
            <div style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              Received: {new Date(Math.max(results[selectedOutput]?.timestamp || 0, photos[selectedOutput]?.timestamp || 0)).toLocaleString()}
            </div>
            
            {photos[selectedOutput] && (
              <div style={{ marginBottom: '1.5rem', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photos[selectedOutput].url} alt="Captured" style={{ width: '100%', height: 'auto', objectFit: 'contain' }} />
              </div>
            )}

            {results[selectedOutput] && (
              <div style={{ 
                backgroundColor: 'rgba(0,0,0,0.4)', padding: '1rem', borderRadius: '8px', 
                fontFamily: 'monospace', whiteSpace: 'pre-wrap', color: '#e6edf3', fontSize: '0.95rem'
              }}>
                {renderTelemetryContent(results[selectedOutput].result)}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
