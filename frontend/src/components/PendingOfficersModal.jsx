import React, { useEffect, useState } from 'react';
import { X, ShieldCheck, Check, Ban, RefreshCw } from 'lucide-react';

export default function PendingOfficersModal({ onClose, onSuccess }) {
  const [pendingList, setPendingList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPending = () => {
    setLoading(true);
    const token = localStorage.getItem('auth_token');

    fetch('/api/auth/pending-officers', {
      headers: {
        'Authorization': token ? `Bearer ${token}` : ''
      }
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load pending officer requests');
        return res.json();
      })
      .then((data) => {
        setPendingList(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const handleApproveReject = (userId, status) => {
    const token = localStorage.getItem('auth_token');

    fetch('/api/auth/approve-officer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      },
      body: JSON.stringify({
        user_id: userId,
        approval_status: status
      })
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to update officer status');
        return res.json();
      })
      .then(() => {
        onSuccess(`Officer account #${userId} set to ${status.toUpperCase()}`);
        fetchPending();
      })
      .catch((err) => {
        alert(err.message);
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
        maxWidth: '560px',
        borderRadius: '16px',
        padding: '28px',
        boxShadow: '0 20px 50px rgba(0,0,0,0.6)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck color="#f59e0b" size={22} /> Review Pending Officer Registrations
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button onClick={fetchPending} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
              <RefreshCw size={18} />
            </button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
              <X size={20} />
            </button>
          </div>
        </div>

        {loading ? (
          <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Loading pending officer requests...</p>
        ) : pendingList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: '#64748b' }}>
            <p style={{ fontSize: '0.9rem' }}>No pending officer registration requests at this time.</p>
          </div>
        ) : (
          <div style={{ maxHeight: '340px', overflowY: 'auto', paddingRight: '4px' }}>
            {pendingList.map((off) => (
              <div
                key={off.id}
                style={{
                  background: '#0b1322',
                  border: '1px solid #1e293b',
                  padding: '14px',
                  borderRadius: '10px',
                  marginBottom: '10px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc' }}>{off.name || off.username}</h4>
                  <p style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{off.email} • {off.phone || 'No phone'}</p>
                  <span style={{ fontSize: '0.7rem', color: '#fbbf24', fontWeight: 600 }}>Status: PENDING ADMIN APPROVAL</span>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => handleApproveReject(off.id, 'approved')}
                    style={{
                      background: 'rgba(16, 185, 129, 0.2)',
                      color: '#34d399',
                      border: '1px solid rgba(16, 185, 129, 0.4)',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Check size={14} /> Approve
                  </button>
                  <button
                    onClick={() => handleApproveReject(off.id, 'rejected')}
                    style={{
                      background: 'rgba(244, 63, 94, 0.2)',
                      color: '#f87171',
                      border: '1px solid rgba(244, 63, 94, 0.4)',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Ban size={14} /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
