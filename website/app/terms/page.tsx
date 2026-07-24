import Link from 'next/link';

export default function TermsPage() {
  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <nav style={{ padding: '1.5rem 3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(10,10,12,0.8)', backdropFilter: 'blur(10px)', position: 'sticky', top: 0 }}>
        <Link href="/" style={{ fontSize: '1.5rem', fontWeight: '800', background: 'linear-gradient(90deg, #fff, #888)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.5px' }}>
          VETO
        </Link>
        <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
          <Link href="/privacy" className="nav-link">Privacy</Link>
          <Link href="/login" className="btn btn-primary" style={{ padding: '0.6rem 1.5rem', borderRadius: '30px' }}>Login</Link>
        </div>
      </nav>

      <section style={{ maxWidth: '800px', margin: '4rem auto', padding: '2rem', lineHeight: 1.8, color: 'var(--text-secondary)' }}>
        <h1 style={{ fontSize: '3rem', fontWeight: '800', color: '#fff', marginBottom: '2rem', letterSpacing: '-1px' }}>Terms of Service</h1>
        
        <h2 style={{ fontSize: '1.5rem', color: '#fff', marginTop: '2rem', marginBottom: '1rem' }}>1. Acceptance of Terms</h2>
        <p>By downloading, installing, or using the Veto application, you agree to be bound by these terms. If you do not agree, do not use the application.</p>

        <h2 style={{ fontSize: '1.5rem', color: '#fff', marginTop: '2rem', marginBottom: '1rem' }}>2. Use of Service</h2>
        <p>Veto is a security tool intended for personal device management. You agree to only install this application on devices you own or have explicit legal authorization to manage.</p>

        <h2 style={{ fontSize: '1.5rem', color: '#fff', marginTop: '2rem', marginBottom: '1rem' }}>3. Limitation of Liability</h2>
        <p>Veto is provided "as is". We are not responsible for any data loss, including data lost due to the use of the Remote Wipe feature. You are solely responsible for managing your device backups.</p>
        
        <div style={{ marginTop: '4rem', paddingTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <Link href="/" className="btn" style={{ padding: '0.8rem 2rem' }}>&larr; Back to Home</Link>
        </div>
      </section>
    </main>
  );
}
