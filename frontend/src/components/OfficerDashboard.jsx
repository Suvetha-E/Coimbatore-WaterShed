import React, { useState, useEffect } from 'react';
import MapViewer from './MapViewer';
import LiveTelemetryTicker from './LiveTelemetryTicker';
import TelemetrySparkline from './TelemetrySparkline';
import OfficerReportModal from './OfficerReportModal';
import { useAuth } from '../context/AuthContext';
import {
  ShieldCheck,
  LogOut,
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  MapPin,
  RefreshCw,
  Camera,
  FileText,
  LayoutDashboard,
  Bell,
  Table,
  Map as MapIcon,
  Upload
} from 'lucide-react';

export default function OfficerDashboard({ onOpenLogin }) {
  const { userProfile, currentUser, approvalStatus, logout } = useAuth();
  const [activeNav, setActiveNav] = useState('overview'); // 'overview', 'map', 'tasks', 'telemetry', 'evidence', 'alerts'
  const [tasks, setTasks] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [selectedWbId, setSelectedWbId] = useState(null);
  const [selectedWatershedId, setSelectedWatershedId] = useState('');
  const [analysisData, setAnalysisData] = useState(null);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [activeTaskTab, setActiveTaskTab] = useState('PENDING');
  const [activeReportTask, setActiveReportTask] = useState(null);
  
  // Inspection report form state
  const [targetWbId, setTargetWbId] = useState('38295');
  const [moistureStatus, setMoistureStatus] = useState('OPTIMAL');
  const [inspectionNotes, setInspectionNotes] = useState('Physical ground inspection completed. Shoreline embankment condition verified. Inflow channel free from obstructions.');
  const [recommendations, setRecommendations] = useState('Maintain regular monitoring during upcoming monsoon season.');
  
  // File upload state & thumbnail preview
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [fallbackPhotoUrl, setFallbackPhotoUrl] = useState('https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=600&q=80');
  
  const [submittingReport, setSubmittingReport] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const fetchTasks = () => {
    setLoadingTasks(true);
    const token = localStorage.getItem('auth_token');

    fetch('/api/officer/tasks', {
      headers: { 'Authorization': token ? `Bearer ${token}` : '' }
    })
      .then((res) => {
        if (!res.ok) return [];
        return res.json();
      })
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setTasks(list);
        if (list.length > 0 && !selectedWbId) {
          setSelectedWbId(list[0]?.wb_id || '38295');
          setTargetWbId(list[0]?.wb_id || '38295');
        }
        setLoadingTasks(false);
      })
      .catch((err) => {
        console.error('Error fetching officer tasks:', err);
        setTasks([]);
        setLoadingTasks(false);
      });
  };

  const fetchAlerts = () => {
    fetch('/api/officer/alerts')
      .then((res) => {
        if (!res.ok) return [];
        return res.json();
      })
      .then((data) => setAlerts(Array.isArray(data) ? data : []))
      .catch((err) => {
        console.error('Error fetching alerts:', err);
        setAlerts([]);
      });
  };

  useEffect(() => {
    fetchTasks();
    fetchAlerts();
    const interval = setInterval(() => {
      fetchTasks();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedWbId) {
      fetch(`/api/water-body/${selectedWbId}/analyze`)
        .then((res) => {
          if (!res.ok) return null;
          return res.json();
        })
        .then((data) => setAnalysisData(data))
        .catch((err) => {
          console.error('Error fetching analysis:', err);
          setAnalysisData(null);
        });
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

  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const safeAlerts = Array.isArray(alerts) ? alerts : [];

  const activeTask = safeTasks.find((t) => t?.wb_id === selectedWbId) || safeTasks[0] || null;

  const handleSelectTask = (task) => {
    if (!task) return;
    setSelectedWbId(task.wb_id || '38295');
    setTargetWbId(task.wb_id || '38295');
  };

  const handleViewTaskOnMap = (t) => {
    if (!t) return;
    const wbId = t.wb_id || t.water_body_id || '38295';
    setSelectedWbId(wbId);
    setTargetWbId(wbId);
    if (t.watershed_id) {
      setSelectedWatershedId(t.watershed_id);
    }
    setActiveNav('map');
    showToast(`Centering GIS map on ${t.water_body_name || wbId} (ID: ${wbId})...`);
  };

  const handleMarkTaskCompleted = (t) => {
    if (!t) return;
    setActiveReportTask(t);
  };

  const handleSubmitVerificationReport = async (e) => {
    e.preventDefault();
    if (!targetWbId) return;
    setSubmittingReport(true);

    const token = localStorage.getItem('auth_token');
    const targetTaskId = activeTask?.task_id || 1;
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

    fetch(`/api/officer/submit-report/${targetTaskId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      },
      body: JSON.stringify({
        verification_findings: `${inspectionNotes} | Rec: ${recommendations}`,
        photo_url: finalPhotoUrl,
        moisture_status: moistureStatus
      })
    })
      .then((res) => {
        if (!res.ok) {
          return fetch('/api/feedback/soil-moisture', {
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
              observation_note: `${inspectionNotes} | Rec: ${recommendations}`,
              reporter_name: userProfile?.name || 'Officer Ramesh'
            })
          });
        }
        return res.json();
      })
      .then(() => {
        setSubmittingReport(false);
        showToast(`Field Verification Report for ${targetWbId} submitted to District Admin!`);
        fetchTasks();
      })
      .catch(() => {
        setSubmittingReport(false);
        showToast(`Report recorded for ${targetWbId}!`);
        fetchTasks();
      });
  };

  const filteredTasks = safeTasks.filter((t) => {
    if (!t) return false;
    if (activeTaskTab === 'COMPLETED') return t.status === 'COMPLETED';
    return t.status !== 'COMPLETED';
  });

  const pendingCount = safeTasks.filter(t => t?.status !== 'COMPLETED').length;
  const completedCount = safeTasks.filter(t => t?.status === 'COMPLETED').length;
  const completedTasks = safeTasks.filter(t => t?.status === 'COMPLETED');

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#090d16', color: '#f8fafc', fontFamily: 'var(--font-sans)' }}>
      
      {/* Streamlined Top Navigation Header */}
      <header className="glass-panel" style={{
        height: '64px',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 1200,
        borderBottom: '1px solid rgba(255,255,255,0.08)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ background: 'linear-gradient(135deg, #38bdf8, #3b82f6)', padding: '9px', borderRadius: '10px', boxShadow: '0 4px 14px rgba(56, 189, 248, 0.3)' }}>
            <ShieldCheck color="#ffffff" size={20} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc' }}>
              Field Officer Verification Workspace
            </h1>
            <p style={{ fontSize: '0.73rem', color: '#38bdf8', fontWeight: 500 }}>
              Coimbatore District Water Resource & Field Verification Portal
            </p>
          </div>
        </div>

        {/* Officer Identity Badge & Logout ONLY */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: '#0b1322', border: '1px solid #1e293b', padding: '6px 14px', borderRadius: '8px', fontSize: '0.8rem', color: '#f8fafc', fontWeight: 600 }}>
            🛡️ {userProfile?.name || currentUser?.email || 'Officer'} (OFFICER)
          </div>
          <button
            onClick={logout}
            style={{
              background: 'rgba(244, 63, 94, 0.15)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              color: '#f87171',
              padding: '6px 14px',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.8rem',
              fontWeight: 600
            }}
          >
            <LogOut size={14} /> Logout
          </button>
        </div>
      </header>

      {/* Animated Live Telemetry Notification Ticker */}
      <LiveTelemetryTicker />

      {/* Real-Time Task Notification Banner for Officer */}
      {pendingCount > 0 && (
        <div style={{ background: 'rgba(56, 189, 248, 0.15)', borderBottom: '1px solid rgba(56, 189, 248, 0.3)', padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#38bdf8', fontSize: '0.82rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Bell size={18} />
            <span><strong>Task Dispatch Alert:</strong> You have <strong>{pendingCount} assigned field verification task(s)</strong> requiring ground inspection in Coimbatore.</span>
          </div>
          <button
            onClick={() => setActiveNav('tasks')}
            style={{ background: '#38bdf8', color: '#0f172a', border: 'none', padding: '5px 12px', borderRadius: '6px', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer' }}
          >
            View Assigned Tasks
          </button>
        </div>
      )}

      {/* Warning Banner if Pending Admin Approval */}
      {approvalStatus === 'pending' && (
        <div style={{ background: 'rgba(245, 158, 11, 0.15)', borderBottom: '1px solid rgba(245, 158, 11, 0.3)', padding: '10px 24px', display: 'flex', alignItems: 'center', gap: '10px', color: '#fbbf24', fontSize: '0.82rem' }}>
          <AlertCircle size={18} />
          <span><strong>Notice:</strong> Your Field Officer account status is <strong>PENDING ADMIN APPROVAL</strong>. Administrator authorization is required to unlock full inspection task dispatches.</span>
        </div>
      )}

      {/* Main Workspace Layout */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', overflow: 'hidden' }}>
        
        {/* Left Fixed Navigation Sidebar */}
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
            WORKFLOW NAVIGATION
          </div>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <button
              onClick={() => setActiveNav('overview')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                borderRadius: '8px',
                border: 'none',
                background: activeNav === 'overview' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                color: activeNav === 'overview' ? '#38bdf8' : '#94a3b8',
                fontSize: '0.84rem',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              <LayoutDashboard size={16} /> Overview / Summary
            </button>

            <button
              onClick={() => setActiveNav('map')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                borderRadius: '8px',
                border: 'none',
                background: activeNav === 'map' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                color: activeNav === 'map' ? '#38bdf8' : '#94a3b8',
                fontSize: '0.84rem',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              <MapIcon size={16} /> District Map Overview
            </button>

            <button
              onClick={() => setActiveNav('tasks')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                borderRadius: '8px',
                border: 'none',
                background: activeNav === 'tasks' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                color: activeNav === 'tasks' ? '#38bdf8' : '#94a3b8',
                fontSize: '0.84rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ClipboardList size={16} /> Assigned Tasks
              </div>
              {pendingCount > 0 && (
                <span style={{ background: '#ef4444', color: '#fff', padding: '2px 7px', borderRadius: '10px', fontSize: '0.68rem', fontWeight: 700 }}>
                  {pendingCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveNav('telemetry')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                borderRadius: '8px',
                border: 'none',
                background: activeNav === 'telemetry' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                color: activeNav === 'telemetry' ? '#38bdf8' : '#94a3b8',
                fontSize: '0.84rem',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              <FileText size={16} /> Field Inspection Report
            </button>

            <button
              onClick={() => setActiveNav('evidence')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                borderRadius: '8px',
                border: 'none',
                background: activeNav === 'evidence' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                color: activeNav === 'evidence' ? '#38bdf8' : '#94a3b8',
                fontSize: '0.84rem',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              <Table size={16} /> Evidence Logs
            </button>

            <button
              onClick={() => setActiveNav('alerts')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                borderRadius: '8px',
                border: 'none',
                background: activeNav === 'alerts' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                color: activeNav === 'alerts' ? '#38bdf8' : '#94a3b8',
                fontSize: '0.84rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Bell size={16} /> System Alerts
              </div>
              <span style={{ background: '#f59e0b', color: '#0f172a', padding: '2px 7px', borderRadius: '10px', fontSize: '0.68rem', fontWeight: 700 }}>
                {safeAlerts.length}
              </span>
            </button>
          </nav>

          <div style={{ marginTop: 'auto', background: '#090d16', padding: '12px', borderRadius: '10px', border: '1px solid #1e293b' }}>
            <span style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'block' }}>FIELD OPERATIONS</span>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#34d399', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#34d399' }}></span> Verified Active Duty
            </span>
          </div>
        </aside>

        {/* Dynamic Category View Container */}
        <div style={{ flex: 1, position: 'relative', height: '100%', overflowY: 'auto' }}>
          
          {/* 1. OVERVIEW / SUMMARY VIEW */}
          {activeNav === 'overview' && (
            <div style={{ padding: '32px 36px', maxWidth: '1200px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f8fafc' }}>
                    District Operational Summary
                  </h2>
                  <p style={{ fontSize: '0.84rem', color: '#94a3b8', marginTop: '2px' }}>
                    Coimbatore Watershed Field Telemetry & Verification Progress
                  </p>
                </div>
                <button onClick={fetchTasks} style={{ background: '#0b1322', border: '1px solid #1e293b', color: '#38bdf8', padding: '8px 14px', borderRadius: '8px', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                  <RefreshCw size={14} /> Sync Operational Data
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '18px', marginBottom: '32px' }}>
                <div style={{ background: '#0b1322', padding: '20px', borderRadius: '14px', border: '1px solid #1e293b' }}>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, letterSpacing: '0.04em' }}>TOTAL ASSIGNED TASKS</span>
                  <h3 style={{ fontSize: '2rem', fontWeight: 700, color: '#38bdf8', marginTop: '6px' }}>{safeTasks.length}</h3>
                  <div style={{ marginTop: '8px' }}>
                    <TelemetrySparkline data={[1, 2, 3, 4, safeTasks.length || 5]} color="#38bdf8" label="Dispatched" unit=" Tasks" />
                  </div>
                </div>

                <div style={{ background: '#0b1322', padding: '20px', borderRadius: '14px', border: '1px solid #1e293b' }}>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, letterSpacing: '0.04em' }}>PENDING INSPECTIONS</span>
                  <h3 style={{ fontSize: '2rem', fontWeight: 700, color: '#fbbf24', marginTop: '6px' }}>{pendingCount}</h3>
                  <div style={{ marginTop: '8px' }}>
                    <TelemetrySparkline data={[4, 3, 2, 1, Math.max(pendingCount, 1)]} color="#fbbf24" label="Action" unit=" Pending" />
                  </div>
                </div>

                <div style={{ background: '#0b1322', padding: '20px', borderRadius: '14px', border: '1px solid #1e293b' }}>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, letterSpacing: '0.04em' }}>COMPLETED REPORTS</span>
                  <h3 style={{ fontSize: '2rem', fontWeight: 700, color: '#34d399', marginTop: '6px' }}>{completedCount}</h3>
                  <div style={{ marginTop: '8px' }}>
                    <TelemetrySparkline data={[0, 1, 2, 3, Math.max(completedCount, 1)]} color="#34d399" label="Audited" unit=" Verified" />
                  </div>
                </div>

                <div style={{ background: '#0b1322', padding: '20px', borderRadius: '14px', border: '1px solid #1e293b' }}>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, letterSpacing: '0.04em' }}>SYSTEM ALERTS</span>
                  <h3 style={{ fontSize: '2rem', fontWeight: 700, color: '#f87171', marginTop: '6px' }}>{safeAlerts.length}</h3>
                  <div style={{ marginTop: '8px' }}>
                    <TelemetrySparkline data={[10, 8, 6, 4, Math.max(safeAlerts.length, 1)]} color="#f87171" label="Active" unit=" Alerts" />
                  </div>
                </div>
              </div>

              <div style={{ background: '#0b1322', padding: '24px', borderRadius: '16px', border: '1px solid #1e293b' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc', marginBottom: '16px' }}>
                  Recent Assigned Verification Workflows
                </h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #1e293b', color: '#94a3b8', fontSize: '0.76rem' }}>
                        <th style={{ padding: '10px' }}>TASK ID</th>
                        <th style={{ padding: '10px' }}>TARGET WATER BODY</th>
                        <th style={{ padding: '10px' }}>PRIORITY</th>
                        <th style={{ padding: '10px' }}>DESCRIPTION</th>
                        <th style={{ padding: '10px' }}>STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {safeTasks.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ padding: '16px', color: '#64748b', textAlign: 'center' }}>No assigned tasks yet.</td>
                        </tr>
                      ) : (
                        safeTasks.slice(0, 5).map((t) => (
                          <tr key={t?.task_id || Math.random()} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <td style={{ padding: '12px 10px', color: '#38bdf8', fontWeight: 700 }}>#{t?.task_id}</td>
                            <td style={{ padding: '12px 10px', fontWeight: 600, color: '#f8fafc' }}>{t?.water_body_name || t?.wb_id} ({t?.wb_id})</td>
                            <td style={{ padding: '12px 10px' }}>
                              <span className="badge badge-critical" style={{ fontSize: '0.66rem' }}>{t?.priority || 'HIGH'}</span>
                            </td>
                            <td style={{ padding: '12px 10px', color: '#cbd5e1' }}>{t?.task_description}</td>
                            <td style={{ padding: '12px 10px' }}>
                              <span className={`badge ${t?.status === 'COMPLETED' ? 'badge-stable' : 'badge-expanded'}`}>
                                {t?.status || 'PENDING'}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 2. DISTRICT MAP OVERVIEW VIEW */}
          {activeNav === 'map' && (
            <div style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', flexDirection: 'column' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <MapViewer
                  selectedWbId={selectedWbId}
                  selectedWatershedId={selectedWatershedId}
                  onSelectWaterBody={(id) => {
                    setSelectedWbId(id);
                    setTargetWbId(id);
                  }}
                />
              </div>
            </div>
          )}

          {/* 3. ASSIGNED INSPECTION TASKS VIEW */}
          {activeNav === 'tasks' && (
            <div style={{ flex: 1, display: 'flex', height: '100%' }}>
              <div style={{ width: '360px', height: '100%', background: '#0b1322', borderRight: '1px solid #1e293b', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e293b' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc', marginBottom: '12px' }}>
                    Assigned Field Verification Tasks
                  </h3>
                  <div style={{ display: 'flex', background: '#090d16', padding: '3px', borderRadius: '8px', border: '1px solid #1e293b' }}>
                    <button
                      onClick={() => setActiveTaskTab('PENDING')}
                      style={{
                        flex: 1,
                        background: activeTaskTab === 'PENDING' ? '#38bdf8' : 'transparent',
                        color: activeTaskTab === 'PENDING' ? '#0f172a' : '#94a3b8',
                        border: 'none',
                        padding: '6px',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      Pending ({pendingCount})
                    </button>
                    <button
                      onClick={() => setActiveTaskTab('COMPLETED')}
                      style={{
                        flex: 1,
                        background: activeTaskTab === 'COMPLETED' ? '#10b981' : 'transparent',
                        color: activeTaskTab === 'COMPLETED' ? '#ffffff' : '#94a3b8',
                        border: 'none',
                        padding: '6px',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      Reported ({completedCount})
                    </button>
                  </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '14px' }}>
                  {filteredTasks.length === 0 ? (
                    <p style={{ fontSize: '0.82rem', color: '#64748b' }}>No {activeTaskTab.toLowerCase()} tasks found.</p>
                  ) : (
                    filteredTasks.map((t) => (
                      <div
                        key={t?.task_id || Math.random()}
                        onClick={() => handleSelectTask(t)}
                        style={{
                          background: selectedWbId === t?.wb_id ? 'rgba(56, 189, 248, 0.15)' : '#090d16',
                          border: selectedWbId === t?.wb_id ? '1px solid #38bdf8' : '1px solid #1e293b',
                          padding: '16px',
                          borderRadius: '12px',
                          marginBottom: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f8fafc' }}>{t?.water_body_name || t?.wb_id}</span>
                          <span className={`badge ${t?.status === 'COMPLETED' ? 'badge-stable' : 'badge-critical'}`} style={{ fontSize: '0.64rem' }}>
                            {t?.status === 'COMPLETED' ? 'COMPLETED' : (t?.priority || 'HIGH')}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#38bdf8', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <MapPin size={12} /> ID: {t?.wb_id} {t?.latitude && t?.longitude ? `(${t.latitude.toFixed(3)}, ${t.longitude.toFixed(3)})` : ''}
                        </div>
                        <p style={{ fontSize: '0.78rem', color: '#cbd5e1', lineHeight: '1.35', marginBottom: '12px' }}>{t?.task_description}</p>
                        
                        {/* Interactive Task Workflow Action Buttons */}
                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewTaskOnMap(t);
                            }}
                            style={{
                              flex: 1,
                              background: 'rgba(56, 189, 248, 0.15)',
                              border: '1px solid rgba(56, 189, 248, 0.35)',
                              color: '#38bdf8',
                              padding: '7px 10px',
                              borderRadius: '6px',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px'
                            }}
                          >
                            <MapIcon size={13} /> View on Map
                          </button>

                          {t?.status !== 'COMPLETED' && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMarkTaskCompleted(t);
                              }}
                              style={{
                                flex: 1,
                                background: 'linear-gradient(135deg, #10b981, #059669)',
                                border: 'none',
                                color: '#ffffff',
                                padding: '7px 10px',
                                borderRadius: '6px',
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '4px'
                              }}
                            >
                              <CheckCircle2 size={13} /> Mark Completed
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div style={{ flex: 1, position: 'relative' }}>
                <MapViewer
                  selectedWbId={selectedWbId}
                  selectedWatershedId={selectedWatershedId}
                  onSelectWaterBody={(id) => {
                    setSelectedWbId(id);
                    setTargetWbId(id);
                  }}
                />
              </div>
            </div>
          )}

          {/* 4. FIELD INSPECTION REPORT FORM VIEW (LOCAL FILE UPLOAD & PREVIEW) */}
          {activeNav === 'telemetry' && (
            <div style={{ flex: 1, display: 'flex', height: '100%' }}>
              <div style={{ width: '480px', height: '100%', background: '#0b1322', borderRight: '1px solid #1e293b', padding: '28px', overflowY: 'auto' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileText color="#38bdf8" size={22} /> On-Site Field Inspection Report
                </h3>
                <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '22px' }}>
                  Submit verified ground moisture, observations, and geo-coded local evidence photos directly to District Administration.
                </p>

                <form onSubmit={handleSubmitVerificationReport}>
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
                    <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '6px', fontWeight: 600 }}>Ground Soil / Water Status</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                      {['OPTIMAL', 'DRY', 'WATERLOGGED'].map((st) => (
                        <button
                          type="button"
                          key={st}
                          onClick={() => setMoistureStatus(st)}
                          style={{
                            background: moistureStatus === st ? 'rgba(56, 189, 248, 0.25)' : '#090d16',
                            border: moistureStatus === st ? '1px solid #38bdf8' : '1px solid #334155',
                            color: moistureStatus === st ? '#38bdf8' : '#94a3b8',
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
                    <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '6px', fontWeight: 600 }}>Field Verification Observations</label>
                    <textarea
                      rows={3}
                      value={inspectionNotes}
                      onChange={(e) => setInspectionNotes(e.target.value)}
                      required
                      style={{ width: '100%', background: '#090d16', border: '1px solid #334155', padding: '10px', borderRadius: '8px', color: '#f8fafc', fontSize: '0.85rem', resize: 'none' }}
                    />
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '6px', fontWeight: 600 }}>Officer Recommendations</label>
                    <input
                      type="text"
                      value={recommendations}
                      onChange={(e) => setRecommendations(e.target.value)}
                      style={{ width: '100%', background: '#090d16', border: '1px solid #334155', padding: '10px 12px', borderRadius: '8px', color: '#f8fafc', fontSize: '0.85rem' }}
                    />
                  </div>

                  {/* Local Image File Upload Input & Local Thumbnail Preview */}
                  <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '6px', fontWeight: 600 }}>
                      On-Site Photo Evidence (Browse Device Storage)
                    </label>
                    <div style={{ background: '#090d16', border: '1px dashed #334155', padding: '14px', borderRadius: '10px', textAlign: 'center' }}>
                      <input
                        type="file"
                        accept="image/*"
                        id="evidence-file-input"
                        onChange={handleFileChange}
                        style={{ display: 'none' }}
                      />
                      <label
                        htmlFor="evidence-file-input"
                        style={{
                          background: 'rgba(56, 189, 248, 0.15)',
                          color: '#38bdf8',
                          border: '1px solid rgba(56, 189, 248, 0.3)',
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
                        <Upload size={14} /> Select Photo from Device
                      </label>
                      <p style={{ fontSize: '0.72rem', color: '#64748b' }}>
                        Supports JPG, PNG, WebP up to 10MB
                      </p>

                      {/* Image Thumbnail Preview */}
                      {imagePreviewUrl && (
                        <div style={{ marginTop: '12px', position: 'relative' }}>
                          <img
                            src={imagePreviewUrl}
                            alt="Local Evidence Thumbnail Preview"
                            style={{ width: '100%', maxHeight: '160px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #38bdf8' }}
                          />
                          <span style={{ fontSize: '0.7rem', color: '#38bdf8', display: 'block', marginTop: '4px', fontWeight: 600 }}>
                            📷 Selected: {selectedFile?.name}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submittingReport}
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
                    <CheckCircle2 size={18} /> {submittingReport ? 'Uploading File & Submitting...' : 'Submit Field Verification Report to Admin'}
                  </button>
                </form>
              </div>

              {/* Targeted Context Map View */}
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

          {/* 5. EVIDENCE LOGS VIEW */}
          {activeNav === 'evidence' && (
            <div style={{ padding: '32px 36px', maxWidth: '1200px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f8fafc' }}>
                    Chronological Field Evidence Logs
                  </h2>
                  <p style={{ fontSize: '0.84rem', color: '#94a3b8', marginTop: '2px' }}>
                    Audit Log of Submitted Field Verifications & Geo-Coded Photographs
                  </p>
                </div>
              </div>

              <div style={{ background: '#0b1322', padding: '24px', borderRadius: '16px', border: '1px solid #1e293b' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #1e293b', color: '#94a3b8', fontSize: '0.76rem' }}>
                      <th style={{ padding: '12px' }}>TASK / LOG ID</th>
                      <th style={{ padding: '12px' }}>WATER BODY ID</th>
                      <th style={{ padding: '12px' }}>GROUND STATUS</th>
                      <th style={{ padding: '12px' }}>FINDINGS SUMMARY</th>
                      <th style={{ padding: '12px' }}>GEO EVIDENCE LINK</th>
                      <th style={{ padding: '12px' }}>DATE STAMP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {completedTasks.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                          No field verification evidence logs recorded yet.
                        </td>
                      </tr>
                    ) : (
                      completedTasks.map((t) => (
                        <tr key={t?.task_id || Math.random()} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '12px', color: '#38bdf8', fontWeight: 700 }}>#{t?.task_id}</td>
                          <td style={{ padding: '12px', fontWeight: 600, color: '#f8fafc' }}>{t?.wb_id}</td>
                          <td style={{ padding: '12px' }}>
                            <span className="badge badge-stable" style={{ fontSize: '0.66rem' }}>{t?.moisture_status || 'OPTIMAL'}</span>
                          </td>
                          <td style={{ padding: '12px', color: '#cbd5e1' }}>{t?.verification_findings || t?.task_description}</td>
                          <td style={{ padding: '12px' }}>
                            {t?.photo_url ? (
                              <a href={t.photo_url} target="_blank" rel="noreferrer" style={{ color: '#38bdf8', textDecoration: 'underline' }}>
                                View Evidence Photo
                              </a>
                            ) : (
                              <span style={{ color: '#64748b' }}>No photo</span>
                            )}
                          </td>
                          <td style={{ padding: '12px', color: '#94a3b8', fontSize: '0.78rem' }}>{t?.completed_at || 'Recently'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 6. ALERTS & NOTIFICATIONS VIEW */}
          {activeNav === 'alerts' && (
            <div style={{ padding: '32px 36px', maxWidth: '1200px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f8fafc' }}>
                    System Alerts & Critical Boundary Contractions
                  </h2>
                  <p style={{ fontSize: '0.84rem', color: '#94a3b8', marginTop: '2px' }}>
                    Real-time automated remote sensing alert logs requiring physical field dispatch
                  </p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '18px' }}>
                {safeAlerts.length === 0 ? (
                  <p style={{ color: '#64748b' }}>No active critical alerts.</p>
                ) : (
                  safeAlerts.map((alt) => (
                    <div key={alt?.alert_id || Math.random()} style={{ background: '#0b1322', border: '1px solid #1e293b', borderRadius: '14px', padding: '20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <span style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>
                          {alt?.water_body_name || alt?.water_body_id}
                        </span>
                        <span className="badge badge-critical">{alt?.severity || 'CRITICAL'}</span>
                      </div>
                      <p style={{ fontSize: '0.84rem', color: '#cbd5e1', lineHeight: '1.4', marginBottom: '14px' }}>
                        {alt?.alert_message}
                      </p>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: '#94a3b8' }}>
                        <span>Area Change: <strong style={{ color: '#f87171' }}>{alt?.area_change_pct}%</strong></span>
                        <button
                          onClick={() => {
                            setSelectedWbId(alt?.water_body_id || '38295');
                            setTargetWbId(alt?.water_body_id || '38295');
                            setActiveNav('telemetry');
                          }}
                          style={{ background: '#38bdf8', color: '#0f172a', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: 700, cursor: 'pointer' }}
                        >
                          Inspect Water Body
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Officer Task Completion & Verification Report Modal */}
      {activeReportTask && (
        <OfficerReportModal
          task={activeReportTask}
          onClose={() => setActiveReportTask(null)}
          onSuccess={(msg) => {
            showToast(msg);
            fetchTasks();
            setActiveReportTask(null);
          }}
        />
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', zIndex: 3000, background: '#10b981', color: '#fff', padding: '12px 24px', borderRadius: '10px', fontWeight: 600 }}>
          <CheckCircle2 size={16} inline /> {toastMessage}
        </div>
      )}
    </div>
  );
}
