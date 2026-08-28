import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, Lock, Mail, User, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function LoginPage({ onEnterDashboard }) {
  const { login, register, loginWithProfile } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' or 'register'
  
  // Form fields
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('CITIZEN');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successNotice, setSuccessNotice] = useState(null);
  const [pendingNotice, setPendingNotice] = useState(false);

  const handleQuickDemoLogin = async (u, p) => {
    setLoading(true);
    setError(null);
    try {
      const emailVal = u.includes('@') ? u : `${u}@watershed.tn.gov.in`;
      const profile = await login(emailVal, p);
      if (profile) {
        loginWithProfile(profile);
      }
      setLoading(false);
      onEnterDashboard(profile?.role);
    } catch (err) {
      // Fallback backend login
      fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, password: p })
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.user) {
            loginWithProfile(data.user, data.access_token);
          }
          setLoading(false);
          onEnterDashboard(data.user?.role);
        })
        .catch(() => {
          setLoading(false);
          onEnterDashboard();
        });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setPendingNotice(false);

    if (mode === 'login') {
      try {
        const emailVal = username.includes('@') ? username : `${username}@watershed.tn.gov.in`;
        const profile = await login(emailVal, password);
        if (profile) {
          loginWithProfile(profile);
        }
        setLoading(false);
        onEnterDashboard(profile?.role);
      } catch (err) {
        console.warn('Firebase sign-in note:', err.message, '. Attempting API backend verification...');
        fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        })
          .then(async (res) => {
            if (!res.ok) {
              const errData = await res.json().catch(() => ({}));
              throw new Error(errData.detail || 'Account not found. Please register an account first before signing in.');
            }
            return res.json();
          })
          .then((data) => {
            if (data.user) {
              loginWithProfile(data.user, data.access_token);
            }
            setLoading(false);
            onEnterDashboard(data.user?.role);
          })
          .catch((fallbackErr) => {
            setError(fallbackErr.message || 'Account not found. Please register an account first before signing in.');
            setLoading(false);
          });
      }
    } else {
      // Registration mode: Register via Firebase Auth & Sync to SQLite users table
      try {
        const emailVal = username.includes('@') ? username : `${username}@watershed.tn.gov.in`;
        let profile = null;
        try {
          profile = await register(emailVal, password, name || username, role, phone);
        } catch (fbErr) {
          console.warn('Firebase registration note:', fbErr.message, '. Falling back to backend database synchronization...');
          const res = await fetch('/api/auth/sync-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              firebase_uid: `reg_uid_${Date.now()}`,
              email: emailVal,
              name: name || username,
              phone: phone,
              role: role
            })
          });
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.detail || 'Registration failed');
          }
          const data = await res.json();
          profile = data.user;
        }

        setLoading(false);
        if (role === 'OFFICER' && profile?.approval_status === 'pending') {
          setPendingNotice(true);
          setMode('login');
          setSuccessNotice('Officer registration request submitted! Account logged for admin approval. Please sign in once approved.');
        } else {
          setMode('login');
          setUsername(emailVal);
          setPassword('');
          setSuccessNotice(`Registration successful for ${emailVal}! Please sign in with your credentials.`);
        }
      } catch (err) {
        setError(err.message || 'Registration failed');
        setLoading(false);
      }
    }
  };

  return (
    <div style={{
      width: '100vw',
      minHeight: '100vh',
      background: "linear-gradient(90deg, rgba(9, 13, 22, 0.95) 0%, rgba(9, 13, 22, 0.78) 55%, rgba(9, 13, 22, 0.45) 100%), url('/watershed-bg.jpg') no-repeat center center / cover",
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#f8fafc',
      fontFamily: 'var(--font-sans)',
      overflowY: 'auto'
    }}>
      
      {/* Main Content Grid */}
      <div style={{
        maxWidth: '1240px',
        width: '100%',
        margin: '0 auto',
        padding: '60px 32px',
        display: 'grid',
        gridTemplateColumns: '1.15fr 0.85fr',
        gap: '56px',
        alignItems: 'center'
      }}>
        
        {/* Left Side: Bold Coimbatore Title & Research Overview */}
        <div>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(56, 189, 248, 0.12)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            padding: '6px 14px',
            borderRadius: '999px',
            color: '#38bdf8',
            fontSize: '0.78rem',
            fontWeight: 600,
            letterSpacing: '0.04em',
            marginBottom: '24px'
          }}>
            <ShieldCheck size={14} /> GOVERNMENT OF TAMIL NADU • REMOTE SENSING PORTAL
          </div>

          <h1 style={{
            fontSize: '2.8rem',
            fontWeight: 800,
            lineHeight: '1.15',
            color: '#ffffff',
            letterSpacing: '-0.02em',
            marginBottom: '20px'
          }}>
            Coimbatore District Watershed Monitoring & Water Body Analytics
          </h1>

          <p style={{
            fontSize: '1.05rem',
            color: '#94a3b8',
            lineHeight: '1.6',
            fontWeight: 400,
            marginBottom: '36px',
            maxWidth: '580px'
          }}>
            AI-powered geo-spatial interpretation, temporal surface area tracking across <strong style={{ color: '#38bdf8' }}>929 water bodies</strong>, multi-temporal Sentinel-2 satellite analysis, and role-isolated administrative task dispatch workflows.
          </p>

          {/* Quick Access Demo Credentials Grid */}
          <div style={{
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '24px',
            borderRadius: '16px'
          }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.08em', display: 'block', marginBottom: '14px' }}>
              ONE-CLICK DEMO AUTHENTICATION WORKSPACES
            </span>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              <button
                type="button"
                onClick={() => handleQuickDemoLogin('admin_cbe', 'admin123')}
                style={{
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  padding: '12px 10px',
                  borderRadius: '12px',
                  textAlign: 'left',
                  cursor: 'pointer'
                }}
              >
                <div style={{ color: '#f87171', fontWeight: 700, fontSize: '0.82rem' }}>🏛️ District Admin</div>
                <div style={{ color: '#94a3b8', fontSize: '0.7rem', marginTop: '2px' }}>Full System Oversight</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemoLogin('Officer Ramesh', 'officer123')}
                style={{
                  background: 'rgba(56, 189, 248, 0.12)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  padding: '12px 10px',
                  borderRadius: '12px',
                  textAlign: 'left',
                  cursor: 'pointer'
                }}
              >
                <div style={{ color: '#38bdf8', fontWeight: 700, fontSize: '0.82rem' }}>🛡️ Field Officer</div>
                <div style={{ color: '#94a3b8', fontSize: '0.7rem', marginTop: '2px' }}>Verification Workspace</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemoLogin('muthu_farmer', 'farmer123')}
                style={{
                  background: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  padding: '12px 10px',
                  borderRadius: '12px',
                  textAlign: 'left',
                  cursor: 'pointer'
                }}
              >
                <div style={{ color: '#34d399', fontWeight: 700, fontSize: '0.82rem' }}>👨‍🌾 Citizen / Farmer</div>
                <div style={{ color: '#94a3b8', fontSize: '0.7rem', marginTop: '2px' }}>Public GIS & Feedback</div>
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Clean Dark Authentication Form */}
        <div style={{
          background: 'rgba(11, 19, 34, 0.85)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          padding: '40px',
          borderRadius: '24px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)'
        }}>
          {/* Mode Switcher */}
          <div style={{
            display: 'flex',
            background: '#090d16',
            padding: '4px',
            borderRadius: '12px',
            border: '1px solid #334155',
            marginBottom: '28px'
          }}>
            <button
              type="button"
              onClick={() => { setMode('login'); setError(null); }}
              style={{
                flex: 1,
                background: mode === 'login' ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                color: mode === 'login' ? '#38bdf8' : '#94a3b8',
                border: mode === 'login' ? '1px solid #38bdf8' : 'none',
                padding: '10px',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Portal Sign In
            </button>
            <button
              type="button"
              onClick={() => { setMode('register'); setError(null); }}
              style={{
                flex: 1,
                background: mode === 'register' ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                color: mode === 'register' ? '#38bdf8' : '#94a3b8',
                border: mode === 'register' ? '1px solid #38bdf8' : 'none',
                padding: '10px',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Register Account
            </button>
          </div>

          {successNotice && (
            <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#34d399', padding: '14px', borderRadius: '10px', fontSize: '0.84rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={18} color="#34d399" />
              <div>{successNotice}</div>
            </div>
          )}

          {error && (
            <div style={{ background: 'rgba(244, 63, 94, 0.15)', border: '1px solid rgba(244, 63, 94, 0.3)', color: '#f87171', padding: '12px', borderRadius: '10px', fontSize: '0.82rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={16} /> {error}
            </div>
          )}

          {pendingNotice && (
            <div style={{ background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#fbbf24', padding: '16px', borderRadius: '10px', fontSize: '0.84rem', marginBottom: '20px' }}>
              <strong style={{ display: 'block', marginBottom: '4px' }}>Registration Submitted!</strong>
              Field Officer accounts require Administrator approval. Your application has been logged for district verification.
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {mode === 'register' && (
              <>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: '#cbd5e1', fontWeight: 600, marginBottom: '6px' }}>Full Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Officer S. Anitha"
                    style={{ width: '100%', background: '#090d16', border: '1px solid #334155', borderRadius: '10px', padding: '12px 14px', color: '#ffffff', fontSize: '0.88rem' }}
                  />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: '#cbd5e1', fontWeight: 600, marginBottom: '6px' }}>Select Account Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    style={{ width: '100%', background: '#090d16', border: '1px solid #334155', borderRadius: '10px', padding: '12px 14px', color: '#ffffff', fontSize: '0.88rem' }}
                  >
                    <option value="CITIZEN">Citizen / Public User</option>
                    <option value="OFFICER">Field Verification Officer (Requires Admin Approval)</option>
                    <option value="ADMIN">District Administrator</option>
                  </select>
                </div>
              </>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', color: '#cbd5e1', fontWeight: 600, marginBottom: '6px' }}>Email Address or Username</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="officer_ramesh@watershed.tn.gov.in"
                style={{ width: '100%', background: '#090d16', border: '1px solid #334155', borderRadius: '10px', padding: '12px 14px', color: '#ffffff', fontSize: '0.88rem' }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', color: '#cbd5e1', fontWeight: 600, marginBottom: '6px' }}>Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                style={{ width: '100%', background: '#090d16', border: '1px solid #334155', borderRadius: '10px', padding: '12px 14px', color: '#ffffff', fontSize: '0.88rem' }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #38bdf8, #2563eb)',
                color: '#ffffff',
                border: 'none',
                padding: '14px',
                borderRadius: '12px',
                fontSize: '0.92rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(56, 189, 248, 0.3)'
              }}
            >
              {loading ? 'Authenticating...' : mode === 'login' ? 'Sign In to Workspace' : 'Submit Registration'} <ArrowRight size={16} />
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
