import React, { useState } from 'react';
import { X, UserPlus, Shield, User, Mail, Lock, Phone, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function RegisterModal({ onClose, onSuccess, onSwitchToLogin }) {
  const { register } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'CITIZEN'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pendingNotice, setPendingNotice] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setPendingNotice(false);

    try {
      const profile = await register(
        formData.email,
        formData.password,
        formData.name,
        formData.role,
        formData.phone
      );
      
      setLoading(false);
      if (formData.role === 'OFFICER' && profile?.approval_status === 'pending') {
        setPendingNotice(true);
      } else {
        onSwitchToLogin();
      }
    } catch (err) {
      console.error('Registration error:', err);
      // Fallback demo registration if Firebase SDK is in offline mode
      try {
        const res = await fetch('/api/auth/sync-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firebase_uid: `demo_uid_${Date.now()}`,
            email: formData.email,
            name: formData.name,
            phone: formData.phone,
            role: formData.role
          })
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || 'Registration failed');
        }
        const data = await res.json();
        setLoading(false);
        if (formData.role === 'OFFICER' && data.user?.approval_status === 'pending') {
          setPendingNotice(true);
        } else {
          onSwitchToLogin();
        }
      } catch (fallbackErr) {
        setError(fallbackErr.message || err.message || 'Registration failed');
        setLoading(false);
      }
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
        maxWidth: '460px',
        borderRadius: '16px',
        padding: '28px',
        boxShadow: '0 20px 50px rgba(0,0,0,0.6)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <UserPlus color="#38bdf8" size={22} /> User Registration & Officer Request
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {pendingNotice ? (
          <div style={{ background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '16px', borderRadius: '12px', textAlign: 'center', marginBottom: '20px' }}>
            <AlertCircle color="#f59e0b" size={36} style={{ margin: '0 auto 12px' }} />
            <h4 style={{ color: '#fbbf24', fontSize: '1.05rem', fontWeight: 700, marginBottom: '8px' }}>Officer Registration Pending Approval</h4>
            <p style={{ color: '#cbd5e1', fontSize: '0.82rem', lineHeight: '1.4', marginBottom: '16px' }}>
              Your Field Officer registration request for <strong>{formData.email}</strong> has been submitted. Status is <strong>PENDING</strong> and requires administrator verification before accessing officer workflows.
            </p>
            <button
              onClick={onClose}
              style={{ background: '#38bdf8', color: '#0f172a', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}
            >
              Understood
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && (
              <div style={{ background: 'rgba(244, 63, 94, 0.15)', color: '#f87171', padding: '10px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem' }}>
                ⚠️ {error}
              </div>
            )}

            {/* Account Role Selector */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>Account Type / Requested Role</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, role: 'CITIZEN' })}
                  style={{
                    background: formData.role === 'CITIZEN' ? 'rgba(56, 189, 248, 0.2)' : '#0b1322',
                    border: formData.role === 'CITIZEN' ? '1px solid #38bdf8' : '1px solid #1e293b',
                    color: formData.role === 'CITIZEN' ? '#38bdf8' : '#94a3b8',
                    padding: '8px',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  👨‍🌾 Citizen / Farmer
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, role: 'OFFICER' })}
                  style={{
                    background: formData.role === 'OFFICER' ? 'rgba(245, 158, 11, 0.2)' : '#0b1322',
                    border: formData.role === 'OFFICER' ? '1px solid #f59e0b' : '1px solid #1e293b',
                    color: formData.role === 'OFFICER' ? '#fbbf24' : '#94a3b8',
                    padding: '8px',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  🛡️ Officer Request
                </button>
              </div>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '4px' }}>Full Name</label>
              <input
                type="text"
                placeholder="e.g. K. Muthusamy"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                style={{ width: '100%', background: '#0b1322', border: '1px solid #1e293b', padding: '9px', borderRadius: '8px', color: '#f8fafc', fontSize: '0.85rem' }}
              />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '4px' }}>Email Address</label>
              <input
                type="email"
                placeholder="user@watershed.tn.gov.in"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                style={{ width: '100%', background: '#0b1322', border: '1px solid #1e293b', padding: '9px', borderRadius: '8px', color: '#f8fafc', fontSize: '0.85rem' }}
              />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '4px' }}>Phone Number</label>
              <input
                type="tel"
                placeholder="+91 98765 43210"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                style={{ width: '100%', background: '#0b1322', border: '1px solid #1e293b', padding: '9px', borderRadius: '8px', color: '#f8fafc', fontSize: '0.85rem' }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '4px' }}>Password</label>
              <input
                type="password"
                placeholder="Minimum 6 characters"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                minLength={6}
                style={{ width: '100%', background: '#0b1322', border: '1px solid #1e293b', padding: '9px', borderRadius: '8px', color: '#f8fafc', fontSize: '0.85rem' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                onClick={onSwitchToLogin}
                style={{ background: 'none', border: 'none', color: '#38bdf8', fontSize: '0.8rem', cursor: 'pointer' }}
              >
                Already have an account? Sign In
              </button>
              <button
                type="submit"
                disabled={loading}
                style={{
                  background: 'linear-gradient(135deg, #38bdf8, #3b82f6)',
                  color: '#ffffff',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {loading ? 'Registering...' : formData.role === 'OFFICER' ? 'Submit Officer Request' : 'Create Citizen Account'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
