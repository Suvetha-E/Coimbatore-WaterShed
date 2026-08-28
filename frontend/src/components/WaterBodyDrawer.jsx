import React from 'react';
import { X, AlertTriangle, CheckCircle, Info, Calendar, Camera, User, Layers, Share2, ArrowDownRight, ArrowUpRight } from 'lucide-react';

export default function WaterBodyDrawer({ analysisData, onClose, onOpenFeedbackModal, onOpenTaskModal, userRole }) {
  if (!analysisData) return null;

  const {
    water_body_id,
    name,
    category,
    watershed_id,
    baseline_area_ha,
    current_area_ha,
    area_change_pct,
    status,
    assessment,
    temporal_observations,
    recent_citizen_feedback,
    geo_coded_photos,
    relationship_graph
  } = analysisData;

  const getAssessmentBadge = (st) => {
    switch (st) {
      case 'SIGNIFICANT_CHANGE_WITH_SUPPORTING_EVIDENCE':
        return <span className="badge badge-critical">Significant Change (Photo Evidence)</span>;
      case 'SIGNIFICANT_CHANGE_WITH_CONTEXTUAL_INDICATORS':
        return <span className="badge badge-critical">Significant Change (Contextual)</span>;
      case 'SIGNIFICANT_CHANGE_WITHOUT_SUFFICIENT_CONTEXT':
        return <span className="badge badge-reduced">Significant Change (Low Context)</span>;
      case 'NO_SIGNIFICANT_CHANGE':
        return <span className="badge badge-stable">Stable (No Change)</span>;
      case 'EXPANDED':
        return <span className="badge badge-expanded">Expanded</span>;
      default:
        return <span className="badge badge-reduced">{st || 'Under Assessment'}</span>;
    }
  };

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      right: 0,
      width: '430px',
      height: '100%',
      zIndex: 1100,
      background: 'rgba(19, 28, 46, 0.95)',
      backdropFilter: 'blur(16px)',
      borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
      display: 'flex',
      flexDirection: 'column',
      boxShadow: '-8px 0 32px rgba(0,0,0,0.5)',
      overflow: 'hidden'
    }}>
      {/* Drawer Header */}
      <div style={{
        padding: '20px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc' }}>{name}</h2>
            {getAssessmentBadge(assessment?.status_classification)}
          </div>
          <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
            ID: {water_body_id} • Watershed: <strong style={{ color: '#38bdf8' }}>{watershed_id || 'Noyyal Basin'}</strong>
          </p>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
        >
          <X size={20} />
        </button>
      </div>

      {/* Drawer Body Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        
        {/* Seasonality Warning Alert (if any) */}
        {assessment?.seasonality?.warning && (
          <div style={{
            background: 'rgba(245, 158, 11, 0.12)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: '10px',
            padding: '12px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px'
          }}>
            <AlertTriangle color="#f59e0b" size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
            <p style={{ fontSize: '0.78rem', color: '#fbbf24', lineHeight: '1.4' }}>
              {assessment.seasonality.warning}
            </p>
          </div>
        )}

        {/* Metric Cards Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
          <div style={{ background: '#0b1322', padding: '12px', borderRadius: '10px', border: '1px solid #1e293b' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Baseline Area</span>
            <p style={{ fontSize: '1.1rem', fontWeight: 700, color: '#38bdf8' }}>{baseline_area_ha} <span style={{ fontSize: '0.75rem' }}>ha</span></p>
          </div>
          <div style={{ background: '#0b1322', padding: '12px', borderRadius: '10px', border: '1px solid #1e293b' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Current Spread</span>
            <p style={{ fontSize: '1.1rem', fontWeight: 700, color: area_change_pct < -10 ? '#f87171' : '#34d399' }}>
              {current_area_ha} <span style={{ fontSize: '0.75rem' }}>ha</span>
            </p>
          </div>
          <div style={{ gridColumn: 'span 2', background: '#0b1322', padding: '12px', borderRadius: '10px', border: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Net Surface Area Change</span>
              <p style={{ fontSize: '1.2rem', fontWeight: 700, color: area_change_pct < -10 ? '#f87171' : area_change_pct > 10 ? '#60a5fa' : '#34d399' }}>
                {area_change_pct >= 0 ? '+' : ''}{area_change_pct}%
              </p>
            </div>
            {area_change_pct < 0 ? <ArrowDownRight color="#f87171" size={28} /> : <ArrowUpRight color="#60a5fa" size={28} />}
          </div>
        </div>

        {/* Rule-Based Contextual Assessment Profile & Scientific Disclaimer */}
        <div style={{
          background: 'rgba(56, 189, 248, 0.05)',
          border: '1px solid rgba(56, 189, 248, 0.2)',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', color: '#38bdf8' }}>
            <Info size={18} />
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Scientific Assessment Profile</h3>
          </div>
          
          <ul style={{ listStyleType: 'none', padding: 0, marginBottom: '12px' }}>
            {assessment?.spatial_associations?.map((item, idx) => (
              <li key={idx} style={{ fontSize: '0.82rem', color: '#cbd5e1', marginBottom: '8px', lineHeight: '1.4' }}>
                • {item}
              </li>
            ))}
          </ul>

          <div style={{
            background: 'rgba(245, 158, 11, 0.1)',
            borderLeft: '3px solid #f59e0b',
            padding: '10px',
            borderRadius: '4px',
            fontSize: '0.74rem',
            color: '#fbbf24',
            lineHeight: '1.3'
          }}>
            <strong>Non-Causal Disclaimer:</strong> {assessment?.scientific_disclaimer}
          </div>
        </div>

        {/* Neo4j Relationship Graph Status */}
        {relationship_graph && (
          <div style={{ background: '#0b1322', padding: '12px', borderRadius: '10px', border: '1px solid #1e293b', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', color: '#a855f7' }}>
              <Share2 size={16} />
              <h3 style={{ fontSize: '0.85rem', fontWeight: 600 }}>Neo4j Spatial Relationship Graph</h3>
            </div>
            <p style={{ fontSize: '0.76rem', color: '#94a3b8' }}>
              Status: <span style={{ color: '#38bdf8', fontWeight: 600 }}>{relationship_graph.status}</span> • Connected to Watershed <strong style={{ color: '#cbd5e1' }}>{watershed_id}</strong> & Noyyal Drainage.
            </p>
          </div>
        )}

        {/* Multi-Temporal Satellite Observations Table */}
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f8fafc', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={16} color="#38bdf8" /> Satellite Observation History
          </h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1e293b', color: '#94a3b8', textAlign: 'left' }}>
                <th style={{ padding: '6px' }}>Date</th>
                <th style={{ padding: '6px' }}>Season</th>
                <th style={{ padding: '6px' }}>Area</th>
                <th style={{ padding: '6px' }}>Cloud %</th>
              </tr>
            </thead>
            <tbody>
              {temporal_observations?.map((obs, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#cbd5e1' }}>
                  <td style={{ padding: '6px' }}>{obs.observation_date}</td>
                  <td style={{ padding: '6px', color: '#94a3b8' }}>{obs.season}</td>
                  <td style={{ padding: '6px', fontWeight: 600 }}>{obs.area_ha} ha</td>
                  <td style={{ padding: '6px', color: '#34d399' }}>{obs.cloud_cover_pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Citizen Soil Moisture Reports */}
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f8fafc', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <User size={16} color="#10b981" /> Ground Soil Moisture Telemetry
          </h3>
          {recent_citizen_feedback?.length > 0 ? (
            recent_citizen_feedback.map((fb) => (
              <div key={fb.id} style={{ background: '#0b1322', padding: '10px', borderRadius: '8px', marginBottom: '8px', border: '1px solid #1e293b' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#f8fafc' }}>{fb.reporter_name}</span>
                  <span className={`badge ${fb.moisture_status === 'DRY' ? 'badge-critical' : 'badge-stable'}`} style={{ fontSize: '0.65rem' }}>
                    {fb.moisture_status}
                  </span>
                </div>
                <p style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{fb.observation_note || 'No additional note provided.'}</p>
              </div>
            ))
          ) : (
            <p style={{ fontSize: '0.78rem', color: '#64748b' }}>No citizen ground reports submitted yet.</p>
          )}
        </div>

        {/* Field Verification Photos */}
        {geo_coded_photos?.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f8fafc', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Camera size={16} color="#f59e0b" /> Geo-Coded Field Evidence
            </h3>
            {geo_coded_photos.map((photo) => (
              <div key={photo.id} style={{ background: '#0b1322', borderRadius: '8px', overflow: 'hidden', border: '1px solid #1e293b', marginBottom: '10px' }}>
                <img src={photo.photo_url} alt="Field Evidence" style={{ width: '100%', height: '140px', objectFit: 'cover' }} />
                <div style={{ padding: '8px' }}>
                  <p style={{ fontSize: '0.78rem', color: '#cbd5e1' }}>{photo.caption}</p>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>

      {/* Drawer Action Bar */}
      <div style={{
        padding: '16px 20px',
        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        background: '#0b1322',
        display: 'flex',
        gap: '10px'
      }}>
        <button
          onClick={() => onOpenFeedbackModal(water_body_id)}
          style={{
            flex: 1,
            background: 'linear-gradient(135deg, #10b981, #059669)',
            color: '#ffffff',
            border: 'none',
            padding: '10px',
            borderRadius: '8px',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          Submit Soil Feedback
        </button>

        {userRole === 'admin' && (
          <button
            onClick={() => onOpenTaskModal(water_body_id)}
            style={{
              flex: 1,
              background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
              color: '#ffffff',
              border: 'none',
              padding: '10px',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Assign Officer Task
          </button>
        )}
      </div>
    </div>
  );
}
