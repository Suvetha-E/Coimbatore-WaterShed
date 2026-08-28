import React, { useState, useEffect } from 'react';
import MapViewer from './MapViewer';
import LiveTelemetryTicker from './LiveTelemetryTicker';
import TelemetrySparkline from './TelemetrySparkline';
import { useAuth } from '../context/AuthContext';
import {
  ShieldCheck,
  LogOut,
  UserCheck,
  PlusSquare,
  RefreshCw,
  CheckCircle2,
  XCircle,
  LayoutDashboard,
  Map as MapIcon,
  FileText,
  AlertTriangle,
  Send,
  User,
  History,
  Activity,
  Database,
  Server,
  Table,
  Layers
} from 'lucide-react';

export default function AdminDashboard({ onOpenLogin }) {
  const { userProfile, currentUser, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'approvals', 'dispatch', 'reports', 'logs', 'sql-admin', 'map'
  
  // Data states
  const [pendingOfficers, setPendingOfficers] = useState([]);
  const [approvedOfficers, setApprovedOfficers] = useState([]);
  const [reports, setReports] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [logFilterCategory, setLogFilterCategory] = useState('ALL');

  // SQL Admin & Hybrid Architecture State
  const [sqlTablesSummary, setSqlTablesSummary] = useState([]);
  const [selectedSqlTable, setSelectedSqlTable] = useState('activity_logs');
  const [sqlTableData, setSqlTableData] = useState({ columns: [], rows: [] });
  const [hybridSyncing, setHybridSyncing] = useState(false);
  
  // Task dispatch form state
  const [targetWbId, setTargetWbId] = useState('38295');
  const [assignedOfficer, setAssignedOfficer] = useState('');
  const [priority, setPriority] = useState('HIGH');
  const [taskDescription, setTaskDescription] = useState('Conduct physical ground verification of shoreline boundary contraction and verify inflow channels.');
  
  const [selectedWbId, setSelectedWbId] = useState(null);
  const [selectedWatershedId, setSelectedWatershedId] = useState('');
  const [loading, setLoading] = useState(false);
  const [submittingTask, setSubmittingTask] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchAdminData = () => {
    setLoading(true);
    const token = localStorage.getItem('auth_token');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

    // Fetch Pending Officers
    fetch('/api/auth/pending-officers', { headers })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setPendingOfficers(Array.isArray(data) ? data : []))
      .catch((e) => console.error(e));

    // Fetch Approved Officers Dynamically from SQLite users table
    fetch('/api/admin/approved-officers', { headers })
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setApprovedOfficers(list);
        if (list.length > 0) {
          const firstOfficer = list[0].name || list[0].email || list[0].username;
          setAssignedOfficer(firstOfficer);
        } else {
          setAssignedOfficer('');
        }
      })
      .catch((e) => {
        console.error('Error fetching approved officers:', e);
        setApprovedOfficers([]);
      })
      .finally(() => setLoading(false));

    // Fetch Reports
    fetch('/api/admin/all-reports', { headers })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setReports(Array.isArray(data) ? data : []))
      .catch((e) => console.error(e));

    // Fetch Alerts
    fetch('/api/officer/alerts', { headers })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setAlerts(Array.isArray(data) ? data : []))
      .catch((e) => console.error(e));

    // Fetch Activity Audit Logs
    fetch(`/api/admin/activity-logs?category=${logFilterCategory}`, { headers })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setActivityLogs(Array.isArray(data) ? data : []))
      .catch((e) => console.error(e));
  };

  const fetchSqlAdminData = () => {
    const token = localStorage.getItem('auth_token');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

    fetch('/api/admin/sql/tables-summary', { headers })
      .then((res) => (res.ok ? res.json() : { tables: [] }))
      .then((data) => setSqlTablesSummary(data.tables || []))
      .catch((e) => console.error(e));

    fetch(`/api/admin/sql/table-data?table_name=${selectedSqlTable}&limit=50`, { headers })
      .then((res) => (res.ok ? res.json() : { columns: [], data: [] }))
      .then((data) => setSqlTableData({ columns: data.columns || [], rows: data.data || [] }))
      .catch((e) => console.error(e));
  };

  useEffect(() => {
    fetchAdminData();
    if (activeTab === 'sql-admin') {
      fetchSqlAdminData();
    }
  }, [activeTab, logFilterCategory, selectedSqlTable]);

  const handleTriggerHybridSync = () => {
    setHybridSyncing(true);
    const token = localStorage.getItem('auth_token');
    fetch('/api/admin/seed-neo4j', {
      method: 'POST',
      headers: { 'Authorization': token ? `Bearer ${token}` : '' }
    })
      .then((res) => res.json())
      .then((data) => {
        setHybridSyncing(false);
        showToast(`Hybrid Graph Sync Triggered Successfully (${data.status})!`);
        fetchAdminData();
        fetchSqlAdminData();
      })
      .catch((e) => {
        setHybridSyncing(false);
        showToast(`Sync Note: ${e.message}`);
      });
  };

  const handleApproveOfficer = (userId, statusVal) => {
    const token = localStorage.getItem('auth_token');
    fetch('/api/auth/approve-officer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      },
      body: JSON.stringify({
        user_id: userId,
        approval_status: statusVal
      })
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to update officer approval');
        return res.json();
      })
      .then(() => {
        showToast(`Officer registration ${statusVal.toUpperCase()}!`);
        fetchAdminData();
      })
      .catch((err) => showToast(err.message));
  };

  const handleDispatchTask = (e) => {
    if (e) e.preventDefault();
    const effectiveOfficer = assignedOfficer || (approvedOfficers[0] ? (approvedOfficers[0].name || approvedOfficers[0].email) : 'officer_ramesh');
    const effectiveWbId = targetWbId || '38295';
    
    if (!effectiveWbId) {
      showToast('Please enter a target Water Body ID');
      return;
    }

    setSubmittingTask(true);
    const token = localStorage.getItem('auth_token');

    fetch('/api/admin/assign-task', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      },
      body: JSON.stringify({
        water_body_id: effectiveWbId,
        officer_name: effectiveOfficer,
        priority: priority || 'HIGH',
        task_description: taskDescription || 'Conduct physical ground verification of shoreline boundary contraction.'
      })
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Server returned error status ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setSubmittingTask(false);
        showToast(`Task #${data.task_id} dispatched to ${effectiveOfficer}!`);
        fetchAdminData();
      })
      .catch((err) => {
        setSubmittingTask(false);
        showToast(`Dispatch note: ${err.message}`);
      });
  };

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#090d16', color: '#f8fafc', fontFamily: 'var(--font-sans)' }}>
      
      {/* Admin Top Header Navigation Navbar */}
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
          <div style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', padding: '9px', borderRadius: '10px', boxShadow: '0 4px 14px rgba(239, 68, 68, 0.3)' }}>
            <ShieldCheck color="#ffffff" size={20} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc' }}>
              Coimbatore District Administration Panel
            </h1>
            <p style={{ fontSize: '0.73rem', color: '#f87171', fontWeight: 500 }}>
              Water Resource Task Dispatcher, Officer Approvals & System Oversight
            </p>
          </div>
        </div>

        {/* Admin Identity Badge & Logout ONLY */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: '#0b1322', border: '1px solid #1e293b', padding: '6px 14px', borderRadius: '8px', fontSize: '0.8rem', color: '#f8fafc', fontWeight: 600 }}>
            🏛️ {userProfile?.name || currentUser?.email || 'Admin'} (ADMIN)
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

      {/* Main Admin Workspace Layout */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', overflow: 'hidden' }}>
        
        {/* Left Navigation Sidebar */}
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
            ADMINISTRATIVE MANAGEMENT
          </div>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <button
              onClick={() => setActiveTab('overview')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'overview' ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
                color: activeTab === 'overview' ? '#f87171' : '#94a3b8',
                fontSize: '0.84rem',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              <LayoutDashboard size={16} /> District Overview
            </button>

            <button
              onClick={() => setActiveTab('approvals')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'approvals' ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
                color: activeTab === 'approvals' ? '#f87171' : '#94a3b8',
                fontSize: '0.84rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <UserCheck size={16} /> Officer Approvals
              </div>
              {pendingOfficers.length > 0 && (
                <span style={{ background: '#fbbf24', color: '#0f172a', padding: '2px 7px', borderRadius: '10px', fontSize: '0.68rem', fontWeight: 700 }}>
                  {pendingOfficers.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('dispatch')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'dispatch' ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
                color: activeTab === 'dispatch' ? '#f87171' : '#94a3b8',
                fontSize: '0.84rem',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              <PlusSquare size={16} /> Task Dispatcher
            </button>

            <button
              onClick={() => setActiveTab('reports')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'reports' ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
                color: activeTab === 'reports' ? '#f87171' : '#94a3b8',
                fontSize: '0.84rem',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              <FileText size={16} /> Inspection Reports Review
            </button>

            <button
              onClick={() => setActiveTab('logs')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'logs' ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
                color: activeTab === 'logs' ? '#f87171' : '#94a3b8',
                fontSize: '0.84rem',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              <History size={16} /> Audit Logs & Activity
            </button>

            <button
              onClick={() => setActiveTab('sql-admin')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'sql-admin' ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
                color: activeTab === 'sql-admin' ? '#f87171' : '#94a3b8',
                fontSize: '0.84rem',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              <Database size={16} /> SQL DB & Hybrid Manager
            </button>

            <button
              onClick={() => setActiveTab('map')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'map' ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
                color: activeTab === 'map' ? '#f87171' : '#94a3b8',
                fontSize: '0.84rem',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              <MapIcon size={16} /> GIS Map Explorer
            </button>
          </nav>
        </aside>

        {/* Dynamic Category Workspace */}
        <div style={{ flex: 1, position: 'relative', height: '100%', overflowY: 'auto' }}>
          
          {/* 1. OVERVIEW / SUMMARY VIEW */}
          {activeTab === 'overview' && (
            <div style={{ padding: '32px 36px', maxWidth: '1200px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f8fafc' }}>
                    District Telemetry & System Health
                  </h2>
                  <p style={{ fontSize: '0.84rem', color: '#94a3b8', marginTop: '2px' }}>
                    Coimbatore Watershed Remote Sensing & Task Control Overview
                  </p>
                </div>
                <button onClick={fetchAdminData} style={{ background: '#0b1322', border: '1px solid #1e293b', color: '#f87171', padding: '8px 14px', borderRadius: '8px', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                  <RefreshCw size={14} /> Refresh Data
                </button>
              </div>

              {/* 4 Admin Metric Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '18px', marginBottom: '32px' }}>
                <div style={{ background: '#0b1322', padding: '20px', borderRadius: '14px', border: '1px solid #1e293b' }}>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>WATER BODIES TRACKED</span>
                  <h3 style={{ fontSize: '2rem', fontWeight: 700, color: '#38bdf8', marginTop: '6px' }}>929</h3>
                  <div style={{ marginTop: '8px' }}>
                    <TelemetrySparkline data={[910, 915, 920, 924, 928, 929]} color="#38bdf8" label="GIS Nodes" unit=" Entities" />
                  </div>
                </div>

                <div style={{ background: '#0b1322', padding: '20px', borderRadius: '14px', border: '1px solid #1e293b' }}>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>PENDING OFFICER REQUESTS</span>
                  <h3 style={{ fontSize: '2rem', fontWeight: 700, color: '#fbbf24', marginTop: '6px' }}>{pendingOfficers.length}</h3>
                  <div style={{ marginTop: '8px' }}>
                    <TelemetrySparkline data={[5, 4, 3, 2, 1, Math.max(pendingOfficers.length, 1)]} color="#fbbf24" label="Pending" unit=" Officers" />
                  </div>
                </div>

                <div style={{ background: '#0b1322', padding: '20px', borderRadius: '14px', border: '1px solid #1e293b' }}>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>ACTIVE CRITICAL ALERTS</span>
                  <h3 style={{ fontSize: '2rem', fontWeight: 700, color: '#f87171', marginTop: '6px' }}>{alerts.length}</h3>
                  <div style={{ marginTop: '8px' }}>
                    <TelemetrySparkline data={[12, 10, 8, 7, 5, Math.max(alerts.length, 1)]} color="#f87171" label="Contraction" unit=" Alerts" />
                  </div>
                </div>

                <div style={{ background: '#0b1322', padding: '20px', borderRadius: '14px', border: '1px solid #1e293b' }}>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>FIELD REPORTS COMPLETED</span>
                  <h3 style={{ fontSize: '2rem', fontWeight: 700, color: '#34d399', marginTop: '6px' }}>{reports.length}</h3>
                  <div style={{ marginTop: '8px' }}>
                    <TelemetrySparkline data={[1, 2, 4, 7, 10, Math.max(reports.length, 1)]} color="#34d399" label="Audits" unit=" Reports" />
                  </div>
                </div>
              </div>

              {/* Pending Officers Quick Action List */}
              <div style={{ background: '#0b1322', padding: '24px', borderRadius: '16px', border: '1px solid #1e293b' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc', marginBottom: '16px' }}>
                  Pending Field Officer Approval Queue
                </h3>
                {pendingOfficers.length === 0 ? (
                  <p style={{ fontSize: '0.84rem', color: '#64748b' }}>No pending officer registration requests.</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #1e293b', color: '#94a3b8', fontSize: '0.76rem' }}>
                        <th style={{ padding: '10px' }}>NAME</th>
                        <th style={{ padding: '10px' }}>EMAIL</th>
                        <th style={{ padding: '10px' }}>REQUESTED ROLE</th>
                        <th style={{ padding: '10px' }}>ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingOfficers.map((off) => (
                        <tr key={off.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '12px 10px', fontWeight: 700, color: '#f8fafc' }}>{off.name || off.username}</td>
                          <td style={{ padding: '12px 10px', color: '#cbd5e1' }}>{off.email}</td>
                          <td style={{ padding: '12px 10px' }}>
                            <span className="badge badge-expanded">{off.role}</span>
                          </td>
                          <td style={{ padding: '12px 10px', display: 'flex', gap: '8px' }}>
                            <button
                              onClick={() => handleApproveOfficer(off.id, 'approved')}
                              style={{ background: '#10b981', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleApproveOfficer(off.id, 'rejected')}
                              style={{ background: 'rgba(244, 63, 94, 0.2)', color: '#f87171', border: '1px solid rgba(244, 63, 94, 0.4)', padding: '6px 12px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                            >
                              Reject
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* 2. OFFICER APPROVALS VIEW */}
          {activeTab === 'approvals' && (
            <div style={{ padding: '32px 36px', maxWidth: '1200px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f8fafc' }}>
                    Officer Approval Management
                  </h2>
                  <p style={{ fontSize: '0.84rem', color: '#94a3b8', marginTop: '2px' }}>
                    Approve or reject pending Field Officer registration requests
                  </p>
                </div>
              </div>

              <div style={{ background: '#0b1322', padding: '24px', borderRadius: '16px', border: '1px solid #1e293b' }}>
                {pendingOfficers.length === 0 ? (
                  <div style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                    <CheckCircle2 size={36} color="#10b981" style={{ marginBottom: '12px', opacity: 0.8 }} />
                    <p style={{ fontSize: '0.9rem' }}>All Field Officer registration requests have been verified and processed.</p>
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #1e293b', color: '#94a3b8', fontSize: '0.76rem' }}>
                        <th style={{ padding: '12px' }}>USER ID</th>
                        <th style={{ padding: '12px' }}>FULL NAME</th>
                        <th style={{ padding: '12px' }}>EMAIL ADDRESS</th>
                        <th style={{ padding: '12px' }}>REQUESTED ROLE</th>
                        <th style={{ padding: '12px' }}>STATUS</th>
                        <th style={{ padding: '12px' }}>ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingOfficers.map((off) => (
                        <tr key={off.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '12px', color: '#38bdf8', fontWeight: 700 }}>#{off.id}</td>
                          <td style={{ padding: '12px', fontWeight: 700, color: '#f8fafc' }}>{off.name || off.username}</td>
                          <td style={{ padding: '12px', color: '#cbd5e1' }}>{off.email}</td>
                          <td style={{ padding: '12px' }}>
                            <span className="badge badge-expanded">{off.role}</span>
                          </td>
                          <td style={{ padding: '12px' }}>
                            <span style={{ color: '#fbbf24', fontWeight: 700, fontSize: '0.78rem' }}>PENDING</span>
                          </td>
                          <td style={{ padding: '12px', display: 'flex', gap: '8px' }}>
                            <button
                              onClick={() => handleApproveOfficer(off.id, 'approved')}
                              style={{ background: '#10b981', color: '#fff', border: 'none', padding: '7px 14px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              <CheckCircle2 size={14} /> Approve Officer
                            </button>
                            <button
                              onClick={() => handleApproveOfficer(off.id, 'rejected')}
                              style={{ background: 'rgba(244, 63, 94, 0.2)', color: '#f87171', border: '1px solid rgba(244, 63, 94, 0.4)', padding: '7px 14px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              <XCircle size={14} /> Reject Request
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* 3. TASK DISPATCHER VIEW */}
          {activeTab === 'dispatch' && (
            <div style={{ padding: '32px 36px', maxWidth: '1200px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f8fafc' }}>
                    Task Dispatcher & Field Assignment
                  </h2>
                  <p style={{ fontSize: '0.84rem', color: '#94a3b8', marginTop: '2px' }}>
                    Assign physical ground verification tasks for shrinking water bodies to approved field officers
                  </p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px' }}>
                <div style={{ background: '#0b1322', padding: '28px', borderRadius: '16px', border: '1px solid #1e293b' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <PlusSquare color="#f87171" size={20} /> Create New Field Verification Task
                  </h3>

                  <form onSubmit={handleDispatchTask}>
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '6px', fontWeight: 600 }}>Target Water Body ID</label>
                      <input
                        type="text"
                        value={targetWbId}
                        onChange={(e) => setTargetWbId(e.target.value)}
                        required
                        placeholder="e.g. 38295"
                        style={{ width: '100%', background: '#090d16', border: '1px solid #334155', padding: '10px 12px', borderRadius: '8px', color: '#f8fafc', fontSize: '0.85rem' }}
                      />
                    </div>

                    {/* Dynamic Officer List Dropdown */}
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '6px', fontWeight: 600 }}>Assign Approved Field Officer</label>
                      <select
                        value={assignedOfficer}
                        onChange={(e) => setAssignedOfficer(e.target.value)}
                        style={{ width: '100%', background: '#090d16', border: '1px solid #334155', padding: '10px 12px', borderRadius: '8px', color: '#f8fafc', fontSize: '0.85rem' }}
                      >
                        {approvedOfficers.length === 0 ? (
                          <option value="">No approved field officers registered</option>
                        ) : (
                          approvedOfficers.map((o) => (
                            <option key={o.id} value={o.name || o.email || o.username}>
                              🛡️ {o.name || o.username} ({o.email})
                            </option>
                          ))
                        )}
                      </select>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '6px', fontWeight: 600 }}>Verification Priority</label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                        {['HIGH', 'MEDIUM', 'LOW'].map((p) => (
                          <button
                            type="button"
                            key={p}
                            onClick={() => setPriority(p)}
                            style={{
                              background: priority === p ? 'rgba(239, 68, 68, 0.25)' : '#090d16',
                              border: priority === p ? '1px solid #f87171' : '1px solid #334155',
                              color: priority === p ? '#f87171' : '#94a3b8',
                              padding: '9px',
                              borderRadius: '8px',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div style={{ marginBottom: '22px' }}>
                      <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '6px', fontWeight: 600 }}>Task Verification Instructions</label>
                      <textarea
                        rows={4}
                        value={taskDescription}
                        onChange={(e) => setTaskDescription(e.target.value)}
                        required
                        style={{ width: '100%', background: '#090d16', border: '1px solid #334155', padding: '10px', borderRadius: '8px', color: '#f8fafc', fontSize: '0.85rem', resize: 'none' }}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={submittingTask}
                      style={{
                        width: '100%',
                        background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                        color: '#ffffff',
                        border: 'none',
                        padding: '12px',
                        borderRadius: '999px',
                        fontSize: '0.9rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 14px rgba(239, 68, 68, 0.3)'
                      }}
                    >
                      <Send size={16} /> {submittingTask ? 'Dispatching Task...' : 'Dispatch Field Task to Officer'}
                    </button>
                  </form>
                </div>

                {/* Active Alerts List */}
                <div style={{ background: '#0b1322', padding: '28px', borderRadius: '16px', border: '1px solid #1e293b' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertTriangle color="#f87171" size={20} /> Water Bodies Requiring Dispatch
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '420px', overflowY: 'auto' }}>
                    {alerts.map((alt) => (
                      <div
                        key={alt.alert_id}
                        onClick={() => setTargetWbId(alt.water_body_id)}
                        style={{
                          background: targetWbId === alt.water_body_id ? 'rgba(239, 68, 68, 0.15)' : '#090d16',
                          border: targetWbId === alt.water_body_id ? '1px solid #f87171' : '1px solid #334155',
                          padding: '14px',
                          borderRadius: '10px',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#f8fafc' }}>{alt.water_body_name || alt.water_body_id}</span>
                          <span className="badge badge-critical">{alt.area_change_pct}% Change</span>
                        </div>
                        <p style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{alt.alert_message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 4. FIELD VERIFICATION REPORTS REVIEW */}
          {activeTab === 'reports' && (
            <div style={{ padding: '32px 36px', maxWidth: '1200px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f8fafc' }}>
                    Officer Field Reports & Verification Audit
                  </h2>
                  <p style={{ fontSize: '0.84rem', color: '#94a3b8', marginTop: '2px' }}>
                    Review completed field inspection findings, soil moisture telemetry, and geo-coded photo evidence
                  </p>
                </div>
              </div>

              <div style={{ background: '#0b1322', padding: '24px', borderRadius: '16px', border: '1px solid #1e293b' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #1e293b', color: '#94a3b8', fontSize: '0.76rem' }}>
                      <th style={{ padding: '12px' }}>TASK ID</th>
                      <th style={{ padding: '12px' }}>WATER BODY</th>
                      <th style={{ padding: '12px' }}>VERIFIED BY</th>
                      <th style={{ padding: '12px' }}>MOISTURE STATUS</th>
                      <th style={{ padding: '12px' }}>INSPECTION FINDINGS</th>
                      <th style={{ padding: '12px' }}>EVIDENCE PHOTO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                          No officer field reports submitted yet.
                        </td>
                      </tr>
                    ) : (
                      reports.map((r) => (
                        <tr key={r.task_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '12px', color: '#f87171', fontWeight: 700 }}>#{r.task_id}</td>
                          <td style={{ padding: '12px', fontWeight: 600, color: '#f8fafc' }}>{r.water_body_name || r.wb_id} ({r.wb_id})</td>
                          <td style={{ padding: '12px', color: '#38bdf8', fontWeight: 600 }}>{r.officer_name}</td>
                          <td style={{ padding: '12px' }}>
                            <span className="badge badge-stable" style={{ fontSize: '0.66rem' }}>{r.moisture_status || 'OPTIMAL'}</span>
                          </td>
                          <td style={{ padding: '12px', color: '#cbd5e1' }}>{r.verification_findings || r.task_description}</td>
                          <td style={{ padding: '12px' }}>
                            {r.photo_url ? (
                              <a href={r.photo_url} target="_blank" rel="noreferrer" style={{ color: '#38bdf8', textDecoration: 'underline' }}>
                                View Photo
                              </a>
                            ) : (
                              <span style={{ color: '#64748b' }}>No photo</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 5. DEDICATED AUDIT LOGS & SYSTEM ACTIVITY VIEW */}
          {activeTab === 'logs' && (
            <div style={{ padding: '32px 36px', maxWidth: '1200px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Activity color="#f87171" size={24} /> System Activity Audit Log
                  </h2>
                  <p style={{ fontSize: '0.84rem', color: '#94a3b8', marginTop: '2px' }}>
                    Chronological audit trail of all admin dispatches, officer approvals, and user telemetry
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {['ALL', 'ADMIN', 'OFFICER', 'CITIZEN'].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setLogFilterCategory(cat)}
                      style={{
                        background: logFilterCategory === cat ? 'rgba(239, 68, 68, 0.25)' : '#0b1322',
                        border: logFilterCategory === cat ? '1px solid #f87171' : '1px solid #1e293b',
                        color: logFilterCategory === cat ? '#f87171' : '#94a3b8',
                        padding: '6px 14px',
                        borderRadius: '8px',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      {cat} LOGS
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ background: '#0b1322', padding: '24px', borderRadius: '16px', border: '1px solid #1e293b' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #1e293b', color: '#94a3b8', fontSize: '0.76rem' }}>
                      <th style={{ padding: '12px' }}>TIMESTAMP</th>
                      <th style={{ padding: '12px' }}>USER</th>
                      <th style={{ padding: '12px' }}>ROLE</th>
                      <th style={{ padding: '12px' }}>ACTION CATEGORY</th>
                      <th style={{ padding: '12px' }}>ACTION TYPE</th>
                      <th style={{ padding: '12px' }}>DESCRIPTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activityLogs.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                          No activity audit logs recorded yet.
                        </td>
                      </tr>
                    ) : (
                      activityLogs.map((log) => (
                        <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '12px', color: '#94a3b8', fontSize: '0.78rem' }}>{strToTime(log.created_at)}</td>
                          <td style={{ padding: '12px', fontWeight: 600, color: '#f8fafc' }}>{log.user_email}</td>
                          <td style={{ padding: '12px' }}>
                            <span className={`badge ${log.user_role === 'ADMIN' ? 'badge-critical' : log.user_role === 'OFFICER' ? 'badge-expanded' : 'badge-stable'}`} style={{ fontSize: '0.66rem' }}>
                              {log.user_role}
                            </span>
                          </td>
                          <td style={{ padding: '12px', color: '#38bdf8', fontWeight: 600 }}>{log.action_category}</td>
                          <td style={{ padding: '12px', color: '#fbbf24', fontWeight: 700, fontSize: '0.76rem' }}>{log.action_type}</td>
                          <td style={{ padding: '12px', color: '#cbd5e1' }}>{log.description}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 6. DEDICATED SQL DATABASE MANAGEMENT & HYBRID ALIGNMENT VIEW */}
          {activeTab === 'sql-admin' && (
            <div style={{ padding: '32px 36px', maxWidth: '1250px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Database color="#38bdf8" size={24} /> Relational SQL Database & Hybrid Graph Manager
                  </h2>
                  <p style={{ fontSize: '0.84rem', color: '#94a3b8', marginTop: '2px' }}>
                    Transactional SQL store management, audit logging schema & Neo4j hybrid graph synchronization
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={handleTriggerHybridSync}
                    disabled={hybridSyncing}
                    style={{
                      background: 'linear-gradient(135deg, #0284c7, #2563eb)',
                      color: '#ffffff',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)'
                    }}
                  >
                    <RefreshCw size={14} className={hybridSyncing ? 'spin' : ''} /> {hybridSyncing ? 'Syncing Hybrid Graph...' : 'Trigger Hybrid Sync / Seed Neo4j'}
                  </button>
                </div>
              </div>

              {/* Hybrid Architecture Alignment Status Banner */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '28px' }}>
                <div style={{ background: '#0b1322', padding: '20px 24px', borderRadius: '14px', border: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ background: 'rgba(56, 189, 248, 0.15)', padding: '12px', borderRadius: '12px' }}>
                    <Server color="#38bdf8" size={24} />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>PRIMARY TRANSACTIONAL STORE</span>
                    <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc', marginTop: '2px' }}>SQLite Spatial Relational DB</h4>
                    <span style={{ fontSize: '0.75rem', color: '#34d399', fontWeight: 600 }}>ONLINE • Transactional Logs & User Credentials</span>
                  </div>
                </div>

                <div style={{ background: '#0b1322', padding: '20px 24px', borderRadius: '14px', border: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ background: 'rgba(168, 85, 247, 0.15)', padding: '12px', borderRadius: '12px' }}>
                    <Layers color="#a855f7" size={24} />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>GEOSPATIAL & TELEMETRY GRAPH</span>
                    <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc', marginTop: '2px' }}>Neo4j Property Graph Engine</h4>
                    <span style={{ fontSize: '0.75rem', color: '#34d399', fontWeight: 600 }}>ONLINE • Multi-Hop Traversal & Telemetry Nodes</span>
                  </div>
                </div>
              </div>

              {/* Primary SQL Database Tables Summary Grid */}
              <div style={{ marginBottom: '28px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Table color="#38bdf8" size={18} /> Primary SQL Tables Metadata Summary
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
                  {sqlTablesSummary.map((t) => (
                    <div
                      key={t.name}
                      onClick={() => setSelectedSqlTable(t.name)}
                      style={{
                        background: selectedSqlTable === t.name ? 'rgba(56, 189, 248, 0.12)' : '#0b1322',
                        border: selectedSqlTable === t.name ? '1px solid #38bdf8' : '1px solid #1e293b',
                        padding: '16px',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '0.88rem', fontWeight: 700, color: selectedSqlTable === t.name ? '#38bdf8' : '#f8fafc' }}>{t.name}</span>
                        <span style={{ background: '#1e293b', color: '#38bdf8', padding: '2px 8px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 700 }}>
                          {t.row_count} rows
                        </span>
                      </div>
                      <p style={{ fontSize: '0.73rem', color: '#94a3b8', lineHeight: 1.4 }}>{t.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Interactive SQL Table Data Browser */}
              <div style={{ background: '#0b1322', padding: '24px', borderRadius: '16px', border: '1px solid #1e293b' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc' }}>
                    Live Table View: <span style={{ color: '#38bdf8' }}>{selectedSqlTable}</span> ({sqlTableData.rows.length} records shown)
                  </h3>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {['water_bodies', 'watersheds', 'users', 'officer_tasks', 'citizen_feedback', 'geo_coded_photos', 'activity_logs'].map((tbl) => (
                      <button
                        key={tbl}
                        onClick={() => setSelectedSqlTable(tbl)}
                        style={{
                          background: selectedSqlTable === tbl ? 'rgba(56, 189, 248, 0.2)' : '#090d16',
                          border: selectedSqlTable === tbl ? '1px solid #38bdf8' : '1px solid #334155',
                          color: selectedSqlTable === tbl ? '#38bdf8' : '#94a3b8',
                          padding: '5px 12px',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        {tbl}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ overflowX: 'auto', maxHeight: '420px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #1e293b', color: '#94a3b8', fontSize: '0.74rem' }}>
                        {sqlTableData.columns.map((col) => (
                          <th key={col} style={{ padding: '10px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sqlTableData.rows.length === 0 ? (
                        <tr>
                          <td colSpan={sqlTableData.columns.length || 1} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                            No rows found in table '{selectedSqlTable}'.
                          </td>
                        </tr>
                      ) : (
                        sqlTableData.rows.map((row, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            {sqlTableData.columns.map((col) => (
                              <td key={col} style={{ padding: '10px', color: col.includes('id') ? '#38bdf8' : '#cbd5e1', whiteSpace: 'nowrap', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {row[col] !== null && row[col] !== undefined ? String(row[col]) : <span style={{ color: '#64748b', fontStyle: 'italic' }}>NULL</span>}
                              </td>
                            ))}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 7. GIS MAP EXPLORER VIEW */}
          {activeTab === 'map' && (
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

        </div>
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

function strToTime(val) {
  if (!val) return 'Just now';
  try {
    return new Date(val).toLocaleString();
  } catch (e) {
    return String(val);
  }
}
