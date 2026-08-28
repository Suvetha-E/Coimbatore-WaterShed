import React, { useState } from 'react';
import { X, ShieldAlert, CheckSquare } from 'lucide-react';

export default function AdminTaskModal({ waterBodyId, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    water_body_id: waterBodyId || '',
    officer_name: 'Officer V. Ramesh',
    priority: 'HIGH',
    task_description: 'Conduct physical verification of bund erosion, inspect inlet stream obstruction, and verify soil moisture reports.'
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const token = localStorage.getItem('auth_token');

    fetch('/api/admin/assign-task', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      },
      body: JSON.stringify(formData)
    })
      .then((res) => {
        if (res.status === 401) throw new Error('Authentication required. Please sign in as Admin.');
        if (res.status === 403) throw new Error('Forbidden: Only Admin users can assign physical verification tasks.');
        if (!res.ok) throw new Error('Failed to assign officer task');
        return res.json();
      })
      .then((data) => {
        setSubmitting(false);
        onSuccess(`Field verification task assigned to ${formData.officer_name}!`);
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
            <ShieldAlert color="#38bdf8" size={20} /> Assign Officer Field Task (Admin Only)
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

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>Target Water Body ID</label>
            <input
              type="text"
              value={formData.water_body_id}
              onChange={(e) => setFormData({ ...formData, water_body_id: e.target.value })}
              required
              style={{
                width: '100%',
                background: '#0b1322',
                border: '1px solid #1e293b',
                padding: '10px',
                borderRadius: '8px',
                color: '#f8fafc',
                fontSize: '0.9rem'
              }}
            />
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>Assigned Field Officer</label>
            <select
              value={formData.officer_name}
              onChange={(e) => setFormData({ ...formData, officer_name: e.target.value })}
              style={{
                width: '100%',
                background: '#0b1322',
                border: '1px solid #1e293b',
                padding: '10px',
                borderRadius: '8px',
                color: '#f8fafc',
                fontSize: '0.9rem'
              }}
            >
              <option value="Officer V. Ramesh">Officer V. Ramesh (Sulur Zone)</option>
              <option value="Officer S. Anitha">Officer S. Anitha (Pollachi Sector)</option>
              <option value="Officer R. Kumar">Officer R. Kumar (Coimbatore North)</option>
            </select>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>Priority Level</label>
            <select
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              style={{
                width: '100%',
                background: '#0b1322',
                border: '1px solid #1e293b',
                padding: '10px',
                borderRadius: '8px',
                color: '#f8fafc',
                fontSize: '0.9rem'
              }}
            >
              <option value="HIGH">HIGH (Immediate physical inspection required)</option>
              <option value="MEDIUM">MEDIUM (Schedule within 48 hours)</option>
              <option value="LOW">LOW (Routine check-in)</option>
            </select>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>Field Verification Instructions</label>
            <textarea
              rows={4}
              value={formData.task_description}
              onChange={(e) => setFormData({ ...formData, task_description: e.target.value })}
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
                background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
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
              <CheckSquare size={16} /> {submitting ? 'Assigning...' : 'Dispatch Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
