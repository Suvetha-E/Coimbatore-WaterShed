import React, { useState } from 'react';
import { X, LogIn, Lock, User, ShieldCheck, UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LoginModal({ onClose, onSuccess, onSwitchToRegister }) {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleQuickLogin = (u, p) => {
    setUsername(u);
    setPassword(p);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Try Firebase Web SDK login if email format, or API login endpoint
    try {
      const emailVal = username.includes('@') ? username : `${username}@watershed.tn.gov.in`;
      const profile = await login(emailVal, password);
      setLoading(false);
      onSuccess(profile || { username, role: 'ADMIN' });
      onClose();
    } catch (err) {
      console.warn('Firebase login attempt note:', err.message, '. Trying API fallback...');
      // Fallback backend login call
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
          localStorage.setItem('auth_token', data.access_token);
          localStorage.setItem('user_profile', JSON.stringify(data.user));
          setLoading(false);
          onSuccess(data.user);
          onClose();
        })
        .catch((fallbackErr) => {
          setError(fallbackErr.message || 'Account not found. Please register an account first before signing in.');
          setLoading(false);
        });
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      zIndex: 2500,
      background: 'rgba(0, 0, 0, 0.8)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div className="glass-modal" style={{
        width: '100%',
        maxWidth: '440px',
        borderRadius: '16px',
        padding: '28px',
        boxShadow: '0 20px 50px rgba(0,0,0,0.6)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck color="#38bdf8" size={22} /> User Sign In
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {error && (
          <div style={{ background: 'rgba(244, 63, 94, 0.15)', color: '#f87171', padding: '10px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem' }}>
            ⚠️ {error}
          </div>
        )}

        {/* Quick Test Accounts */}
        <div style={{ background: '#0b1322', padding: '12px', borderRadius: '10px', border: '1px solid #1e293b', marginBottom: '18px' }}>
          <span style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '8px', fontWeight: 600 }}>
            DEMO TEST ACCOUNTS (CLICK TO AUTO-FILL)
          </span>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => handleQuickLogin('admin_cbe', 'admin123')}
              style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '4px 8px', borderRadius: '6px', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600 }}
            >
              Admin
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('officer_ramesh', 'officer123')}
              style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '4px 8px', borderRadius: '6px', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600 }}
            >
              Officer Ramesh
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('citizen_muthu', 'citizen123')}
              style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '4px 8px', borderRadius: '6px', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600 }}
            >
              Citizen Muthu
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>Username or Email</label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Enter username or email..."
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                style={{
                  width: '100%',
                  background: '#0b1322',
                  border: '1px solid #1e293b',
                  padding: '10px 10px 10px 36px',
                  borderRadius: '8px',
                  color: '#f8fafc',
                  fontSize: '0.9rem'
                }}
              />
              <User size={16} color="#64748b" style={{ position: 'absolute', left: '10px', top: '12px' }} />
            </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type="password"
                placeholder="Enter password..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{
                  width: '100%',
                  background: '#0b1322',
                  border: '1px solid #1e293b',
                  padding: '10px 10px 10px 36px',
                  borderRadius: '8px',
                  color: '#f8fafc',
                  fontSize: '0.9rem'
                }}
              />
              <Lock size={16} color="#64748b" style={{ position: 'absolute', left: '10px', top: '12px' }} />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              type="button"
              onClick={onSwitchToRegister}
              style={{ background: 'none', border: 'none', color: '#38bdf8', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <UserPlus size={14} /> Create Account / Request Officer Role
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                background: 'linear-gradient(135deg, #38bdf8, #3b82f6)',
                color: '#ffffff',
                border: 'none',
                padding: '10px 24px',
                borderRadius: '8px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <LogIn size={16} /> {loading ? 'Signing In...' : 'Sign In'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
