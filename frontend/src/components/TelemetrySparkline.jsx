import React from 'react';

/**
 * TelemetrySparkline Component
 * ----------------------------
 * Renders a lightweight, high-performance inline SVG sparkline graph with gradient area fills,
 * pulsating end-point marker, and real-time parameter trend indicator.
 */
export default function TelemetrySparkline({
  data = [12.4, 14.1, 13.8, 15.5, 18.2, 16.9, 19.4, 21.0],
  width = 120,
  height = 32,
  color = '#38bdf8',
  label = 'Telemetry Trend',
  showTrend = true,
  unit = ''
}) {
  if (!data || data.length < 2) {
    data = [10, 12, 11, 15, 14, 18, 17, 20];
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min === 0 ? 1 : max - min;
  
  const padding = 4;
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;

  // Compute SVG coordinates
  const points = data.map((val, idx) => {
    const x = padding + (idx / (data.length - 1)) * usableWidth;
    const y = height - padding - ((val - min) / range) * usableHeight;
    return { x, y, val };
  });

  const pathD = points.reduce((acc, pt, i) => {
    return i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
  }, '');

  const areaD = `${pathD} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

  const firstVal = data[0];
  const lastVal = data[data.length - 1];
  const pctChange = (((lastVal - firstVal) / (firstVal || 1)) * 100).toFixed(1);
  const isUp = lastVal >= firstVal;

  const gradientId = `sparkline-grad-${Math.random().toString(36).substring(2, 9)}`;

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
      <div style={{ position: 'relative', width: `${width}px`, height: `${height}px` }}>
        <svg width={width} height={height} style={{ overflow: 'visible' }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.4" />
              <stop offset="100%" stopColor={color} stopOpacity="0.0" />
            </linearGradient>
          </defs>
          <path d={areaD} fill={`url(#${gradientId})`} />
          <path
            d={pathD}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Pulsating Last Point Marker */}
          <circle
            cx={points[points.length - 1].x}
            cy={points[points.length - 1].y}
            r="3.5"
            fill={color}
          />
          <circle
            cx={points[points.length - 1].x}
            cy={points[points.length - 1].y}
            r="6"
            fill="none"
            stroke={color}
            strokeWidth="1.5"
            opacity="0.6"
          >
            <animate
              attributeName="r"
              values="3.5;8;3.5"
              dur="2s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.8;0;0.8"
              dur="2s"
              repeatCount="indefinite"
            />
          </circle>
        </svg>
      </div>

      {showTrend && (
        <span
          style={{
            fontSize: '0.7rem',
            fontWeight: 700,
            color: isUp ? '#34d399' : '#f87171',
            background: isUp ? 'rgba(52, 211, 153, 0.12)' : 'rgba(248, 113, 113, 0.12)',
            padding: '2px 6px',
            borderRadius: '6px',
            border: `1px solid ${isUp ? 'rgba(52, 211, 153, 0.3)' : 'rgba(248, 113, 113, 0.3)'}`,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '2px'
          }}
          title={`${label}: ${lastVal}${unit} (${isUp ? '+' : ''}${pctChange}%)`}
        >
          {isUp ? '↑' : '↓'} {Math.abs(pctChange)}%
        </span>
      )}
    </div>
  );
}
