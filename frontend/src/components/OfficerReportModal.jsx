import React, { useState } from 'react';
import { X, CheckCircle, Camera, AlertCircle, FileText, Droplet } from 'lucide-react';

export default function OfficerReportModal({ task, onClose, onSuccess }) {
  const [moistureStatus, setMoistureStatus] = useState('OPTIMAL');
  const [findings, setFindings] = useState('Physical ground inspection completed. Shoreline embankment condition verified. Inflow channel free from obstructions.');
  const [photoUrl, setPhotoUrl] = useState('https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=600&q=80');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!task?.task_id) return;
    setSubmitting(true);
    setError(null);

    const token = localStorage.getItem('auth_token');

    fetch(`/api/officer/submit-report/${task.task_id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      },
      body: JSON.stringify({
        verification_findings: findings,
        photo_url: photoUrl,
        moisture_status: moistureStatus
      })
    })
      .then((res) => {
        if (res.status === 401 || res.status === 403) throw new Error('Authorization required: Please sign in as Officer or Admin.');
        if (!res.ok) throw new Error('Failed to record field verification report');
        return res.json();
      })
      .then((data) => {
        setSubmitting(false);
        onSuccess(`Field verification report recorded for Task #${task.task_id}!`);
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
        maxWidth: '520px',
        borderRadius: '16px',
        padding: '28px',
        boxShadow: '0 20px 50px rgba(0,0,0,0.6)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle color="#10b981" size={22} /> On-Site Inspection & Verification Report
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
          <div style={{ background: '#0b1322', padding: '14px', borderRadius: '10px', marginBottom: '18px', border: '1px solid #1e293b' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f8fafc' }}>
                {task.water_body_name || task.wb_id} (ID: {task.wb_id})
              </span>
              <span className="badge badge-critical" style={{ fontSize: '0.68rem' }}>
                Priority: {task.priority}
              </span>
            </div>
            <p style={{ fontSize: '0.8rem', color: '#cbd5e1', lineHeight: '1.4' }}>{task.task_description}</p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          
          {/* Moisture Status Selection */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px', fontWeight: 600 }}>Ground Water / Soil Status</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {['OPTIMAL', 'DRY', 'WATERLOGGED'].map((st) => (
                <button
                  type="button"
                  key={st}
                  onClick={() => setMoistureStatus(st)}
                  style={{
                    background: moistureStatus === st ? 'rgba(56, 189, 248, 0.2)' : '#0b1322',
                    border: moistureStatus === st ? '1px solid #38bdf8' : '1px solid #1e293b',
                    color: moistureStatus === st ? '#38bdf8' : '#94a3b8',
                    padding: '8px',
                    borderRadius: '8px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {st === 'OPTIMAL' ? '💧 Optimal' : st === 'DRY' ? '🏜️ Dry / Reduced' : '🌊 Waterlogged'}
                </button>
              ))}
            </div>
          </div>

          {/* Verification Findings */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px', fontWeight: 600 }}>Field Verification Observations</label>
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
                fontSize: '0.85rem',
                resize: 'none'
              }}
            />
          </div>

          {/* Photo Evidence URL */}
          <div style={{ marginBottom: '22px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px', fontWeight: 600 }}>Geo-Coded Photo Evidence URL</label>
            <div style={{ position: 'relative' }}>
              <input
                type="url"
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                placeholder="https://..."
                style={{
                  width: '100%',
                  background: '#0b1322',
                  border: '1px solid #1e293b',
                  padding: '9px 12px 9px 36px',
                  borderRadius: '8px',
                  color: '#f8fafc',
                  fontSize: '0.85rem'
                }}
              />
              <Camera size={16} color="#64748b" style={{ position: 'absolute', left: '10px', top: '11px' }} />
            </div>
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
                padding: '10px 22px',
                borderRadius: '8px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <CheckCircle size={16} /> {submitting ? 'Submitting Report...' : 'Submit Verification Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
