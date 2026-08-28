import React, { useState } from 'react';
import { X, Send, MapPin } from 'lucide-react';

export default function CitizenFeedbackModal({ waterBodyId, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    water_body_id: waterBodyId || '',
    latitude: 11.0168,
    longitude: 76.9558,
    moisture_status: 'DRY',
    observation_note: '',
    reporter_name: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    fetch('/api/feedback/soil-moisture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to submit feedback');
        return res.json();
      })
      .then((data) => {
        setSubmitting(false);
        onSuccess('Citizen ground feedback recorded successfully!');
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
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc' }}>Ground Soil Moisture Report</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {error && (
          <div style={{ background: 'rgba(244, 63, 94, 0.15)', color: '#f87171', padding: '10px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>Water Body ID</label>
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
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>Ground Soil Moisture Status</label>
            <select
              value={formData.moisture_status}
              onChange={(e) => setFormData({ ...formData, moisture_status: e.target.value })}
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
              <option value="DRY">DRY (Visible cracking / severe deficit)</option>
              <option value="OPTIMAL">OPTIMAL (Moist / good crop health)</option>
              <option value="WATERLOGGED">WATERLOGGED (Standing water pool)</option>
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>Latitude</label>
              <input
                type="number"
                step="any"
                value={formData.latitude}
                onChange={(e) => setFormData({ ...formData, latitude: parseFloat(e.target.value) })}
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
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>Longitude</label>
              <input
                type="number"
                step="any"
                value={formData.longitude}
                onChange={(e) => setFormData({ ...formData, longitude: parseFloat(e.target.value) })}
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
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>Reporter / Farmer Name</label>
            <input
              type="text"
              placeholder="e.g. K. Muthusamy (Farmer)"
              value={formData.reporter_name}
              onChange={(e) => setFormData({ ...formData, reporter_name: e.target.value })}
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

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>Observation Note</label>
            <textarea
              rows={3}
              placeholder="Describe ground condition, crop stress, or shoreline status..."
              value={formData.observation_note}
              onChange={(e) => setFormData({ ...formData, observation_note: e.target.value })}
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
              <Send size={16} /> {submitting ? 'Submitting...' : 'Submit Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
