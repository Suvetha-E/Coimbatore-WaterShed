import React, { useState } from 'react';
import { X, CheckCircle, ShieldCheck } from 'lucide-react';

export default function OfficerVerifyModal({ task, onClose, onSuccess }) {
  const [findings, setFindings] = useState('Physical ground inspection completed. Shoreline bund condition verified. Inlet channel obstruction cleared.');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!task?.task_id) return;
    setSubmitting(true);
    setError(null);

    const token = localStorage.getItem('auth_token');

    fetch('/api/officer/verify-task', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      },
      body: JSON.stringify({
        task_id: task.task_id,
        verification_findings: findings
      })
    })
      .then((res) => {
        if (res.status === 401 || res.status === 403) throw new Error('Authorization required: Please sign in as Officer or Admin.');
        if (!res.ok) throw new Error('Failed to record field verification');
        return res.json();
      })
      .then((data) => {
        setSubmitting(false);
        onSuccess(`Field verification recorded for Task #${task.task_id}!`);
        onClose();
      })
      .catch((err) => {
        setError(err.message);
        setSubmitting(false);
      });
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      zIndex: 2000,
      background: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div className="glass-modal" style={{
        width: '100%',
        maxWidth: '480px',
        borderRadius: '16px',
        padding: '24px',
        boxShadow: '0 20px 50px rgba(0,0,0,0.6)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck color="#10b981" size={20} /> Complete Field Verification
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

        {task && (
          <div style={{ background: '#0b1322', padding: '12px', borderRadius: '8px', marginBottom: '16px', border: '1px solid #1e293b' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Task #{task.task_id} • Assigned to {task.officer_name}</span>
            <p style={{ fontSize: '0.85rem', color: '#cbd5e1', marginTop: '4px' }}>{task.task_description}</p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>Ground Verification Findings</label>
            <textarea
              rows={4}
              value={findings}
              onChange={(e) => setFindings(e.target.value)}
              required
              style={{
                width: '100%',
                background: '#0b1322',
                border: '1px solid #1e293b',
                padding: '10px',
                borderRadius: '8px',
                color: '#f8fafc',
                fontSize: '0.9rem',
                resize: 'none'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: '1px solid #1e293b',
                color: '#94a3b8',
                padding: '10px 16px',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                background: 'linear-gradient(135deg, #10b981, #059669)',
                color: '#ffffff',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '8px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <CheckCircle size={16} /> {submitting ? 'Resolving...' : 'Submit Verification'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
