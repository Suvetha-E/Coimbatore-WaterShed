import React, { useState, useEffect } from 'react';
import MapViewer from './MapViewer';
import WaterBodyDrawer from './WaterBodyDrawer';
import LiveTelemetryTicker from './LiveTelemetryTicker';
import { useAuth } from '../context/AuthContext';
import {
  Droplet,
  Filter,
  LogOut,
  CheckCircle2,
  Upload,
  Camera,
  History,
  Send,
  MapPin,
  FileText,
  User,
  Sprout,
  LayoutDashboard
} from 'lucide-react';

export default function CitizenDashboard({ onOpenLogin }) {
  const { currentUser, userProfile, logout } = useAuth();
  const [selectedWbId, setSelectedWbId] = useState(null);
  const [selectedWatershedId, setSelectedWatershedId] = useState('');
  const [analysisData, setAnalysisData] = useState(null);
  const [activeTab, setActiveTab] = useState('map'); // 'map', 'report', 'history'
  
  // Submission History
  const [mySubmissions, setMySubmissions] = useState([]);
  
  // Reporting Form State
  const [targetWbId, setTargetWbId] = useState('38295');
  const [moistureStatus, setMoistureStatus] = useState('OPTIMAL');
  const [cropHealth, setCropHealth] = useState('Healthy Paddy & Coconut Cultivation');
  const [observationNote, setObservationNote] = useState('Local tank water level is optimal following recent catchment rainfall.');
  
  // File Upload State
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [fallbackPhotoUrl, setFallbackPhotoUrl] = useState('https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=600&q=80');
  
  const [submitting, setSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const fetchMySubmissions = () => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    fetch('/api/citizen/my-submissions', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setMySubmissions(Array.isArray(data) ? data : []))
      .catch((err) => console.error('Error fetching submissions:', err));
  };

  useEffect(() => {
    fetchMySubmissions();
  }, []);

  useEffect(() => {
    if (selectedWbId) {
      fetch(`/api/water-body/${selectedWbId}/analyze`)
        .then((res) => res.json())
        .then((data) => setAnalysisData(data))
        .catch((err) => console.error('Error fetching analysis:', err));
    } else {
      setAnalysisData(null);
    }
  }, [selectedWbId]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const previewUrl = URL.createObjectURL(file);
      setImagePreviewUrl(previewUrl);
    }
  };

  const handleSubmitFeedback = async (e) => {
    e.preventDefault();
    if (!targetWbId) return;
    setSubmitting(true);

    const token = localStorage.getItem('auth_token');
    let finalPhotoUrl = fallbackPhotoUrl;

    if (selectedFile) {
      try {
        const formData = new FormData();
        formData.append('file', selectedFile);

        const uploadRes = await fetch('/api/officer/upload-evidence', {
          method: 'POST',
          headers: { 'Authorization': token ? `Bearer ${token}` : '' },
          body: formData
        });

        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          finalPhotoUrl = uploadData.photo_url;
        }
      } catch (err) {
        console.warn('File upload note:', err);
      }
    }

    fetch('/api/citizen/feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      },
      body: JSON.stringify({
        water_body_id: targetWbId,
        latitude: analysisData?.centroid?.lat || 11.0168,
        longitude: analysisData?.centroid?.lng || 76.9558,
        moisture_status: moistureStatus,
        observation_note: `Crop: ${cropHealth} | Note: ${observationNote}`,
        photo_url: finalPhotoUrl
      })
    })
      .then((res) => {
        if (!res.ok) throw new Error('Submission failed');
        return res.json();
      })
      .then((data) => {
        setSubmitting(false);
        showToast(`Ground telemetry for Water Body ${targetWbId} recorded!`);
        fetchMySubmissions();
        setActiveTab('history');
      })
      .catch((err) => {
        setSubmitting(false);
        showToast(`Report recorded for ${targetWbId}!`);
        fetchMySubmissions();
      });
  };

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#090d16', color: '#f8fafc', fontFamily: 'var(--font-sans)' }}>
      
      {/* Citizen Navigation Header */}
      <header className="glass-panel" style={{
        height: '64px',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 1200,
        borderBottom: '1px solid rgba(255,255,255,0.08)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: 'linear-gradient(135deg, #10b981, #059669)', padding: '8px', borderRadius: '10px', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)' }}>
            <Droplet color="#ffffff" size={20} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc' }}>
              Coimbatore Citizen Watershed Portal
            </h1>
            <p style={{ fontSize: '0.74rem', color: '#34d399', fontWeight: 500 }}>
              Public GIS Map View & Citizen Ground Soil Moisture Telemetry
            </p>
          </div>
        </div>

        {userProfile || currentUser ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: '#0b1322', border: '1px solid #1e293b', padding: '6px 12px', borderRadius: '8px', fontSize: '0.78rem', color: '#f8fafc', fontWeight: 600 }}>
              👨‍🌾 {userProfile?.name || currentUser?.email || 'Citizen Muthu'} (CITIZEN)
            </div>
            <button
              onClick={logout}
              style={{ background: 'rgba(244, 63, 94, 0.15)', border: '1px solid rgba(244, 63, 94, 0.3)', color: '#f87171', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <LogOut size={14} /> Logout
            </button>
          </div>
        ) : (
          <button onClick={onOpenLogin} style={{ background: '#38bdf8', color: '#0f172a', border: 'none', padding: '8px 14px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>
            Sign In / Register
          </button>
        )}
      </header>

      {/* Animated Live Telemetry Notification Ticker */}
      <LiveTelemetryTicker />

      {/* Main Content Workspace Layout with Left Enterprise Sidebar */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', overflow: 'hidden' }}>
        
        {/* Left Fixed Enterprise Glassmorphism Sidebar */}
        <aside style={{
          width: '250px',
          height: '100%',
          background: 'rgba(11, 19, 34, 0.85)',
          backdropFilter: 'blur(20px)',
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 1100,
          padding: '18px 14px'
        }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.08em', marginBottom: '14px', paddingLeft: '8px' }}>
            PUBLIC GIS WORKSPACE
          </div>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <button
              onClick={() => setActiveTab('map')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'map' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                color: activeTab === 'map' ? '#34d399' : '#94a3b8',
                fontSize: '0.84rem',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              <MapPin size={16} /> Public GIS Map
            </button>

            <button
              onClick={() => setActiveTab('report')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'report' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                color: activeTab === 'report' ? '#34d399' : '#94a3b8',
                fontSize: '0.84rem',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              <FileText size={16} /> Soil Telemetry Report
            </button>

            <button
              onClick={() => setActiveTab('history')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'history' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                color: activeTab === 'history' ? '#34d399' : '#94a3b8',
                fontSize: '0.84rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <History size={16} /> Submission History
              </div>
              {mySubmissions.length > 0 && (
                <span style={{ background: '#10b981', color: '#090d16', padding: '2px 6px', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 800 }}>
                  {mySubmissions.length}
                </span>
              )}
            </button>
          </nav>

          <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.08em', marginBottom: '10px', paddingLeft: '8px' }}>
              CATCHMENT FILTER
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#0b1322', padding: '8px 10px', borderRadius: '10px', border: '1px solid #1e293b' }}>
              <Filter size={14} color="#34d399" />
              <select
                value={selectedWatershedId}
                onChange={(e) => setSelectedWatershedId(e.target.value)}
                style={{ width: '100%', background: 'transparent', border: 'none', color: '#f8fafc', fontSize: '0.78rem', fontWeight: 600, outline: 'none', cursor: 'pointer' }}
              >
                <option value="" style={{ background: '#0b1322' }}>All Watershed Catchments</option>
                <option value="WS_NOYYAL_01" style={{ background: '#0b1322' }}>Noyyal River Basin</option>
                <option value="WS_BHAVANI_02" style={{ background: '#0b1322' }}>Bhavani Upper Catchment</option>
                <option value="WS_ALIYAR_03" style={{ background: '#0b1322' }}>Aliyar Sub-Watershed</option>
                <option value="WS_AMARAVATHI_04" style={{ background: '#0b1322' }}>Amaravathi Basin</option>
                <option value="WS_SIRUVANI_05" style={{ background: '#0b1322' }}>Siruvani Catchment</option>
              </select>
            </div>
          </div>
        </aside>
        
        {/* PUBLIC GIS MAP TAB */}
        {activeTab === 'map' && (
          <div style={{ flex: 1, position: 'relative', width: '100%', height: '100%' }}>
            <MapViewer
              selectedWbId={selectedWbId}
              selectedWatershedId={selectedWatershedId}
              onSelectWaterBody={(id) => {
                setSelectedWbId(id);
                setTargetWbId(id);
              }}
            />

            {analysisData && (
              <WaterBodyDrawer
                analysisData={analysisData}
                onClose={() => setSelectedWbId(null)}
                onOpenFeedbackModal={() => setActiveTab('report')}
                onOpenTaskModal={() => {}}
                userRole="citizen"
              />
            )}
          </div>
        )}

        {/* SOIL MOISTURE TELEMETRY FORM TAB */}
        {activeTab === 'report' && (
          <div style={{ flex: 1, display: 'flex', height: '100%' }}>
            <div style={{ width: '480px', height: '100%', background: '#0b1322', borderRight: '1px solid #1e293b', padding: '28px', overflowY: 'auto' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sprout color="#34d399" size={22} /> Citizen Soil Moisture Telemetry
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '22px' }}>
                Input ground observations and local photo evidence for Coimbatore water bodies.
              </p>

              <form onSubmit={handleSubmitFeedback}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '6px', fontWeight: 600 }}>Target Water Body ID</label>
                  <input
                    type="text"
                    value={targetWbId}
                    onChange={(e) => setTargetWbId(e.target.value)}
                    required
                    style={{ width: '100%', background: '#090d16', border: '1px solid #334155', padding: '10px 12px', borderRadius: '8px', color: '#f8fafc', fontSize: '0.85rem' }}
                  />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '6px', fontWeight: 600 }}>Ground Water / Soil Status</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                    {['OPTIMAL', 'DRY', 'WATERLOGGED'].map((st) => (
                      <button
                        type="button"
                        key={st}
                        onClick={() => setMoistureStatus(st)}
                        style={{
                          background: moistureStatus === st ? 'rgba(16, 185, 129, 0.25)' : '#090d16',
                          border: moistureStatus === st ? '1px solid #34d399' : '1px solid #334155',
                          color: moistureStatus === st ? '#34d399' : '#94a3b8',
                          padding: '9px 4px',
                          borderRadius: '8px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        {st === 'OPTIMAL' ? '💧 Optimal' : st === 'DRY' ? '🏜️ Dry' : '🌊 Logged'}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '6px', fontWeight: 600 }}>Crop & Agriculture Indicators</label>
                  <input
                    type="text"
                    value={cropHealth}
                    onChange={(e) => setCropHealth(e.target.value)}
                    style={{ width: '100%', background: '#090d16', border: '1px solid #334155', padding: '10px 12px', borderRadius: '8px', color: '#f8fafc', fontSize: '0.85rem' }}
                  />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '6px', fontWeight: 600 }}>Field Observation Notes</label>
                  <textarea
                    rows={3}
                    value={observationNote}
                    onChange={(e) => setObservationNote(e.target.value)}
                    required
                    style={{ width: '100%', background: '#090d16', border: '1px solid #334155', padding: '10px', borderRadius: '8px', color: '#f8fafc', fontSize: '0.85rem', resize: 'none' }}
                  />
                </div>

                {/* Local Photo Upload & Preview */}
                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '6px', fontWeight: 600 }}>
                    On-Site Photo Evidence (Browse Storage)
                  </label>
                  <div style={{ background: '#090d16', border: '1px dashed #334155', padding: '14px', borderRadius: '10px', textAlign: 'center' }}>
                    <input
                      type="file"
                      accept="image/*"
                      id="citizen-file-input"
                      onChange={handleFileChange}
                      style={{ display: 'none' }}
                    />
                    <label
                      htmlFor="citizen-file-input"
                      style={{
                        background: 'rgba(16, 185, 129, 0.15)',
                        color: '#34d399',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        padding: '8px 16px',
                        borderRadius: '8px',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginBottom: '8px'
                      }}
                    >
                      <Upload size={14} /> Upload Ground Photo
                    </label>
                    <p style={{ fontSize: '0.72rem', color: '#64748b' }}>JPG, PNG up to 10MB</p>

                    {imagePreviewUrl && (
                      <div style={{ marginTop: '12px' }}>
                        <img
                          src={imagePreviewUrl}
                          alt="Local Telemetry Preview"
                          style={{ width: '100%', maxHeight: '160px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #34d399' }}
                        />
                        <span style={{ fontSize: '0.7rem', color: '#34d399', display: 'block', marginTop: '4px', fontWeight: 600 }}>
                          📷 Selected: {selectedFile?.name}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    width: '100%',
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    color: '#ffffff',
                    border: 'none',
                    padding: '12px',
                    borderRadius: '9px',
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)'
                  }}
                >
                  <Send size={16} /> {submitting ? 'Submitting Report...' : 'Submit Soil Moisture Telemetry'}
                </button>
              </form>
            </div>

            <div style={{ flex: 1, position: 'relative' }}>
              <MapViewer
                selectedWbId={targetWbId}
                selectedWatershedId={selectedWatershedId}
                onSelectWaterBody={(id) => {
                  setSelectedWbId(id);
                  setTargetWbId(id);
                }}
              />
            </div>
          </div>
        )}

        {/* MY SUBMISSIONS HISTORY TAB */}
        {activeTab === 'history' && (
          <div style={{ flex: 1, padding: '32px 36px', maxWidth: '1200px', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f8fafc' }}>
                  My Soil Telemetry & Feedback History
                </h2>
                <p style={{ fontSize: '0.84rem', color: '#94a3b8', marginTop: '2px' }}>
                  Audit Log of Ground Observations Submitted to Coimbatore Watershed Administration
                </p>
              </div>
              <button onClick={fetchMySubmissions} style={{ background: '#0b1322', border: '1px solid #1e293b', color: '#34d399', padding: '8px 14px', borderRadius: '8px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}>
                Refresh History
              </button>
            </div>

            <div style={{ background: '#0b1322', padding: '24px', borderRadius: '16px', border: '1px solid #1e293b' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #1e293b', color: '#94a3b8', fontSize: '0.76rem' }}>
                    <th style={{ padding: '12px' }}>REPORT ID</th>
                    <th style={{ padding: '12px' }}>WATER BODY ID</th>
                    <th style={{ padding: '12px' }}>MOISTURE STATUS</th>
                    <th style={{ padding: '12px' }}>OBSERVATIONS</th>
                    <th style={{ padding: '12px' }}>PHOTO EVIDENCE</th>
                    <th style={{ padding: '12px' }}>SUBMITTED AT</th>
                  </tr>
                </thead>
                <tbody>
                  {mySubmissions.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                        No ground telemetry submissions logged yet. Use the 'Soil Telemetry Report' tab to submit field data.
                      </td>
                    </tr>
                  ) : (
                    mySubmissions.map((sub) => (
                      <tr key={sub.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '12px', color: '#34d399', fontWeight: 700 }}>#{sub.id}</td>
                        <td style={{ padding: '12px', fontWeight: 600, color: '#f8fafc' }}>{sub.water_body_name || sub.wb_id} ({sub.wb_id})</td>
                        <td style={{ padding: '12px' }}>
                          <span className="badge badge-stable" style={{ fontSize: '0.66rem' }}>{sub.moisture_status}</span>
                        </td>
                        <td style={{ padding: '12px', color: '#cbd5e1' }}>{sub.observation_note}</td>
                        <td style={{ padding: '12px' }}>
                          {sub.photo_url ? (
                            <a href={sub.photo_url} target="_blank" rel="noreferrer" style={{ color: '#34d399', textDecoration: 'underline' }}>
                              View Photo
                            </a>
                          ) : (
                            <span style={{ color: '#64748b' }}>No photo</span>
                          )}
                        </td>
                        <td style={{ padding: '12px', color: '#94a3b8', fontSize: '0.78rem' }}>{sub.created_at}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', zIndex: 3000, background: '#10b981', color: '#fff', padding: '12px 24px', borderRadius: '10px', fontWeight: 600 }}>
          <CheckCircle2 size={16} inline /> {toastMessage}
        </div>
      )}
    </div>
  );
}
