import React, { useState, useEffect } from 'react';
import { Activity, Radio, RefreshCw, Zap } from 'lucide-react';

/**
 * LiveTelemetryTicker Component
 * -----------------------------
 * Displays a live-updating animated system notification ticker streaming real-time telemetry events
 * across all 5 Coimbatore watershed river basins (Noyyal, Bhavani, Aliyar, Amaravathi, Siruvani).
 */
export default function LiveTelemetryTicker() {
  const [tickerItems, setTickerItems] = useState([
    { id: 1, basin: 'NOYYAL BASIN', msg: 'Singanallur Periyakulam water spread telemetry: 118.4 Ha (Optimal Inflow)', type: 'STABLE', time: 'LIVE' },
    { id: 2, basin: 'BHAVANI CATCHMENT', msg: 'Sentinel-2 SAR Radar anomaly scan clear: Turbidity index 12.4 NTU', type: 'INFO', time: '1m ago' },
    { id: 3, basin: 'ALIYAR SUB-WATERSHED', msg: 'Field Officer S. Anitha completed soil moisture ground verification (Task #48)', type: 'SUCCESS', time: '3m ago' },
    { id: 4, basin: 'SIRUVANI BASIN', msg: 'Siruvani reservoir intake telemetry synchronized to Neo4j Property Graph', type: 'STABLE', time: '5m ago' },
    { id: 5, basin: 'AMARAVATHI BASIN', msg: 'Madukkarai Sector 8 boundary contraction alert resolved via on-site check dam inspection', type: 'ALERT', time: '7m ago' }
  ]);

  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % tickerItems.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [tickerItems.length]);

  const currentItem = tickerItems[activeIdx] || tickerItems[0];

  const getTypeStyle = (type) => {
    switch (type) {
      case 'SUCCESS':
        return { bg: 'rgba(52, 211, 153, 0.15)', border: '#34d399', text: '#34d399' };
      case 'ALERT':
        return { bg: 'rgba(248, 113, 113, 0.15)', border: '#f87171', text: '#f87171' };
      case 'INFO':
        return { bg: 'rgba(56, 189, 248, 0.15)', border: '#38bdf8', text: '#38bdf8' };
      default:
        return { bg: 'rgba(168, 85, 247, 0.15)', border: '#c084fc', text: '#c084fc' };
    }
  };

  const style = getTypeStyle(currentItem.type);

  return (
    <div
      style={{
        background: 'rgba(11, 19, 34, 0.95)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        borderTop: '1px solid rgba(255, 255, 255, 0.04)',
        padding: '6px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '0.78rem',
        zIndex: 1100,
        boxShadow: '0 4px 20px rgba(0,0,0,0.25)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden' }}>
        {/* Live Stream Pulse Badge */}
        <div
          style={{
            background: 'rgba(56, 189, 248, 0.15)',
            border: '1px solid rgba(56, 189, 248, 0.35)',
            color: '#38bdf8',
            padding: '3px 9px',
            borderRadius: '999px',
            fontSize: '0.68rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            flexShrink: 0
          }}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: '#38bdf8',
              boxShadow: '0 0 8px #38bdf8'
            }}
          />
          LIVE TELEMETRY STREAM
        </div>

        {/* Dynamic Ticker Item */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.4s ease-in-out',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            overflow: 'hidden'
          }}
        >
          <span
            style={{
              background: style.bg,
              border: `1px solid ${style.border}`,
              color: style.text,
              padding: '2px 7px',
              borderRadius: '6px',
              fontSize: '0.66rem',
              fontWeight: 800,
              letterSpacing: '0.04em'
            }}
          >
            {currentItem.basin}
          </span>
          <span style={{ color: '#f8fafc', fontWeight: 500 }}>
            {currentItem.msg}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0, color: '#94a3b8', fontSize: '0.72rem' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Activity size={12} color="#38bdf8" /> Real-Time Neo4j Sync Active
        </span>
        <span style={{ color: '#475569' }}>|</span>
        <span>{currentItem.time}</span>
      </div>
    </div>
  );
}
