import React from 'react';
import StationMap from './StationMap';

// Sample GeoJSON data for testing related purposes showing path outside Tokyo Station
const sampleHokoNaviData = {
    "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": { "has_stairs": 0, "name": "Accessible Path A" },
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [139.7671, 35.6812],
          [139.7680, 35.6820]
        ]
      }
    }
  ]
};

function App() {
  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>HokoNavi Station Accessibility</h1>
      <p>Visualizing step-free paths using Leaflet and GeoJSON.</p>
      
      {/* Pass the data into the map! */}
      <StationMap geojsonData={sampleHokoNaviData} />
    </div>
  );
}

export default App;
