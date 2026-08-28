import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, LayersControl, ScaleControl } from 'react-leaflet';

const STATUS_COLORS = {
  EXPANDED: '#3b82f6',
  NO_SIGNIFICANT_CHANGE: '#10b981',
  STABLE: '#10b981',
  MODERATE_REDUCTION: '#f59e0b',
  REDUCED: '#f59e0b',
  SIGNIFICANT_REDUCTION: '#ef4444',
  CRITICAL: '#ef4444',
  INSUFFICIENT_DATA: '#94a3b8'
};

export default function MapViewer({ onSelectWaterBody, selectedWbId, selectedWatershedId }) {
  const [geoJsonData, setGeoJsonData] = useState(null);
  const [watershedsData, setWatershedsData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load Watershed Catchment Boundaries
  useEffect(() => {
    fetch('/api/watersheds')
      .then((res) => {
        if (!res.ok) throw new Error(`Watersheds endpoint returned ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (data && data.type === 'FeatureCollection') setWatershedsData(data);
      })
      .catch((err) => console.error('Failed to load watersheds GeoJSON:', err));
  }, []);

  // Load Water Bodies (filtered by selectedWatershedId if specified)
  useEffect(() => {
    setLoading(true);
    const url = selectedWatershedId
      ? `/api/water-bodies?watershed_id=${selectedWatershedId}`
      : '/api/water-bodies';

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`Water bodies endpoint returned ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (data && data.type === 'FeatureCollection') {
          setGeoJsonData(data);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load water bodies GeoJSON:', err);
        setLoading(false);
      });
  }, [selectedWatershedId]);

  const styleFeature = (feature) => {
    const status = feature.properties?.status || 'STABLE';
    const isSelected = selectedWbId === feature.properties?.wb_id;
    const color = STATUS_COLORS[status] || STATUS_COLORS.STABLE;

    return {
      fillColor: color,
      weight: isSelected ? 3 : 1.5,
      opacity: 0.9,
      color: isSelected ? '#ffffff' : color,
      dashArray: isSelected ? '4' : '',
      fillOpacity: isSelected ? 0.75 : 0.45
    };
  };

  const styleWatershed = () => {
    return {
      fillColor: '#38bdf8',
      fillOpacity: 0.05,
      weight: 2,
      color: '#38bdf8',
      dashArray: '6, 6'
    };
  };

  const onEachFeature = (feature, layer) => {
    const props = feature.properties || {};
    const name = props.name || 'Unnamed Water Body';
    const status = props.status || 'STABLE';
    const pct = props.area_change_pct || 0;
    const area = props.current_area_ha || 0;

    layer.bindTooltip(`
      <div style="font-family: sans-serif; font-size: 12px; padding: 4px;">
        <strong style="color: #0284c7;">${name}</strong><br/>
        Category: ${props.category || 'Water Body'}<br/>
        Watershed: ${props.watershed_id || 'Noyyal Basin'}<br/>
        Area: ${area.toFixed(2)} ha<br/>
        Change: <span style="font-weight: bold; color: ${pct < -10 ? '#f87171' : pct > 10 ? '#60a5fa' : '#34d399'}">${pct >= 0 ? '+' : ''}${pct}%</span>
      </div>
    `, { sticky: true });

    layer.on({
      click: () => {
        if (props.wb_id) {
          onSelectWaterBody(props.wb_id);
        }
      },
      mouseover: (e) => {
        const l = e.target;
        l.setStyle({ fillOpacity: 0.8, weight: 2.5 });
      },
      mouseout: (e) => {
        const l = e.target;
        if (props.wb_id !== selectedWbId) {
          l.setStyle(styleFeature(feature));
        }
      }
    });
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {loading && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 1000,
          background: 'rgba(19, 28, 46, 0.9)',
          padding: '16px 24px',
          borderRadius: '12px',
          color: '#38bdf8',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          border: '1px solid #1e293b'
        }}>
          <div>Loading Coimbatore Water Bodies...</div>
        </div>
      )}

      <MapContainer
        center={[11.0168, 76.9558]}
        zoom={11}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
      >
        <LayersControl position="topright">
          {/* Default Free OpenStreetMap Layer */}
          <LayersControl.BaseLayer checked name="OpenStreetMap Standard">
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
          </LayersControl.BaseLayer>

          {/* CartoDB Dark Matter */}
          <LayersControl.BaseLayer name="CartoDB Dark Matter">
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://carto.com/">CartoDB</a>'
            />
          </LayersControl.BaseLayer>

          {/* Esri Satellite Imagery */}
          <LayersControl.BaseLayer name="Esri World Imagery">
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution="Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community"
            />
          </LayersControl.BaseLayer>
        </LayersControl>

        <ScaleControl position="bottomleft" imperial={false} />

        {/* Watershed Catchment Boundaries Overlay */}
        {watershedsData && watershedsData.type === 'FeatureCollection' && watershedsData.features && watershedsData.features.length > 0 && (
          <GeoJSON
            key="watersheds_overlay"
            data={watershedsData}
            style={styleWatershed}
            onEachFeature={(feat, layer) => {
              layer.bindTooltip(`<strong>${feat.properties?.name || 'Watershed'}</strong> (${feat.properties?.watershed_id || ''})`, { sticky: true });
            }}
          />
        )}

        {/* Water Bodies Layer */}
        {geoJsonData && geoJsonData.type === 'FeatureCollection' && geoJsonData.features && geoJsonData.features.length > 0 && (
          <GeoJSON
            key={JSON.stringify(selectedWbId) + '_' + selectedWatershedId + '_' + geoJsonData.features.length}
            data={geoJsonData}
            style={styleFeature}
            onEachFeature={onEachFeature}
          />
        )}
      </MapContainer>
    </div>
  );
}
