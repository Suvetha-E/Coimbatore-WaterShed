import React, { useEffect, useState } from 'react';
import { ShieldAlert, RefreshCw, CheckSquare, Lock } from 'lucide-react';

export default function OfficerAlertPanel({ onSelectWaterBody, onOpenVerifyTask, onRequireLogin }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);

  const fetchAlerts = () => {
    setLoading(true);
    setUnauthorized(false);
    const token = localStorage.getItem('auth_token');

    fetch('/api/officer/alerts', {
      headers: {
        'Authorization': token ? `Bearer ${token}` : ''
      }
    })
      .then((res) => {
        if (res.status === 401 || res.status === 403) {
          setUnauthorized(true);
          setLoading(false);
          throw new Error('Unauthorized');
        }
        if (!res.ok) throw new Error('Failed to load alerts');
        return res.json();
      })
      .then((data) => {
        setAlerts(data);
        setLoading(false);
      })
      .catch((err) => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  return (
    <div style={{
      width: '340px',
      height: '100%',
      background: 'rgba(19, 28, 46, 0.95)',
      backdropFilter: 'blur(16px)',
      borderRight: '1px solid rgba(255, 255, 255, 0.1)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 1000
    }}>
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldAlert color="#ef4444" size={20} />
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>Active Critical Alerts</h3>
        </div>
        <button onClick={fetchAlerts} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
          <RefreshCw size={16} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {unauthorized ? (
          <div style={{ textAlign: 'center', padding: '24px 12px' }}>
            <Lock size={32} color="#f59e0b" style={{ marginBottom: '12px' }} />
            <h4 style={{ fontSize: '0.95rem', color: '#f8fafc', marginBottom: '8px' }}>Officer Login Required</h4>
            <p style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: '16px', lineHeight: '1.4' }}>
              Viewing active critical alerts requires an Officer or Admin account.
            </p>
            <button
              onClick={onRequireLogin}
              style={{
                background: 'linear-gradient(135deg, #38bdf8, #3b82f6)',
                color: '#ffffff',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Sign In to Officer Portal
            </button>
          </div>
        ) : loading ? (
          <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Loading active alerts...</p>
        ) : alerts.length === 0 ? (
          <p style={{ fontSize: '0.85rem', color: '#64748b' }}>No critical alerts active.</p>
        ) : (
          alerts.map((alert) => (
            <div
              key={alert.alert_id}
              style={{
                background: '#0b1322',
                border: '1px solid rgba(244, 63, 94, 0.3)',
                borderRadius: '12px',
                padding: '14px',
                marginBottom: '12px',
                transition: 'all 0.2s ease-in-out'
              }}
            >
              <div
                onClick={() => onSelectWaterBody(alert.water_body_id)}
                style={{ cursor: 'pointer', marginBottom: '8px' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f8fafc' }}>{alert.water_body_name}</span>
                  <span className="badge badge-critical" style={{ fontSize: '0.65rem' }}>
                    {alert.area_change_pct}%
                  </span>
                </div>
                
                <p style={{ fontSize: '0.78rem', color: '#cbd5e1', lineHeight: '1.3' }}>
                  {alert.alert_message}
                </p>
              </div>

              {alert.assigned_task ? (
                <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '8px 10px', borderRadius: '8px', fontSize: '0.74rem', color: '#60a5fa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    Officer: <strong>{alert.assigned_task.officer_name}</strong>
                  </div>
                  <button
                    onClick={() => onOpenVerifyTask(alert.assigned_task)}
                    style={{
                      background: '#3b82f6',
                      color: '#ffffff',
                      border: 'none',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <CheckSquare size={12} /> Verify
                  </button>
                </div>
              ) : (
                <span style={{ fontSize: '0.7rem', color: '#f59e0b' }}>⚠️ Pending Admin Task Assignment</span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
