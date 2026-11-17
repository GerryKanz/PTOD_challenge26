import { useQuery } from '@tanstack/react-query';

export const STATIONS = {
  tokyo: {
    name: 'Tokyo', apiName: 'Tokyo', coords: [35.6812, 139.7671],
    bbox: '35.679,139.765,35.683,139.769',
    defaultFloors: ['1', '0', '-1', '-2', '-3', '-4', '-5']
  },
  shinjuku: {
    name: 'Shinjuku', apiName: 'Shinjuku', coords: [35.6896, 139.7006],
    bbox: '35.688,139.699,35.691,139.702',
    defaultFloors: ['2', '1', '0', '-1', '-2', '-3', '-4', '-5']
  },
  shibuya: {
    name: 'Shibuya', apiName: 'Shibuya', coords: [35.6580, 139.7016],
    bbox: '35.656,139.699,35.660,139.704',
    defaultFloors: ['2', '1', '0', '-1', '-2', '-3', '-4', '-5']
  },
  ikebukuro: {
    name: 'Ikebukuro', apiName: 'Ikebukuro', coords: [35.7295, 139.7109],
    bbox: '35.728,139.709,35.731,139.712',
    defaultFloors: ['1', '0', '-1', '-2', '-3']
  },
  ueno: {
    name: 'Ueno', apiName: 'Ueno', coords: [35.7141, 139.7774],
    bbox: '35.712,139.775,35.716,139.779',
    defaultFloors: ['2', '1', '0', '-1', '-2', '-3']
  },
};

export const translateOdptStatus = (jpStatus, railway) => {
  const safeStatus = jpStatus || '';
  const safeRailway = railway || '';
  const lineName = safeRailway.replace('JR-East.', '').replace(/([A-Z])/g, ' $1').trim();
  if (!safeStatus || safeStatus.includes('平常')) return `🟢 ${lineName || 'All Lines'}: Normal Service`;
  if (safeStatus.includes('遅延')) return `⚠️ ${lineName || 'Line'} Delayed — Crowds Building`;
  if (safeStatus.includes('見合わせ')) return `🛑 ${lineName || 'Line'} Suspended — Use Surface Exits`;
  return `ℹ️ ${lineName}: ${safeStatus}`;
};

// Helper to create a simple rectangle polygon
const makeRect = (lon1, lat1, lon2, lat2) => [[
  [lon1, lat1], [lon2, lat1], [lon2, lat2], [lon1, lat2], [lon1, lat1]
]];

export const buildMultiFloorMap = (coords, floors, stationName) => {
  const [lat, lon] = coords;
  const features = [];

  floors.forEach((lvl) => {
    const n = parseFloat(lvl);
    const isUnderground = n < 0;
    const isUpper = n > 0;
    const floorLabel = n === 0 ? '1F' : n > 0 ? `${n + 1}F` : `B${Math.abs(n)}F`;
    const shift = (Math.abs(n) % 2 === 1 ? 1 : -1) * 0.00018;

    // Terminal Building Floorplate (Dark Architectural Blueprint Base)
    const fw = isUnderground ? 0.0015 : 0.0013;
    const fh = isUnderground ? 0.0011 : 0.0014;
    features.push({
      type: 'Feature',
      properties: {
        id: `slab-${lvl}`, isZone: true, roomType: 'slab',
        height: 1.5, base: 0, fillColor: '#1e293b', levels: [lvl],
        name: `${stationName} ${floorLabel} Terminal Floorplate`
      },
      geometry: { type: 'Polygon', coordinates: makeRect(lon - fw, lat - fh, lon + fw, lat + fh) }
    });

    if (!isUnderground) {
      // SURFACE & UPPER FLOORS (1F, 2F, 3F): North-South Parallel Train Platforms + Gate Wings
      features.push(
        {
          type: 'Feature',
          properties: {
            id: `plat1-${lvl}`, isZone: true, roomType: 'platform',
            height: 14, base: 1.5, fillColor: '#0284c7', levels: [lvl],
            name: `🛤️ ${floorLabel} Track 1•2 (${isUpper ? 'Elevated Express' : 'JR Main Line'})`
          },
          geometry: { type: 'Polygon', coordinates: makeRect(lon - 0.0011, lat - 0.0011, lon - 0.0006, lat + 0.0011) }
        },
        {
          type: 'Feature',
          properties: {
            id: `plat2-${lvl}`, isZone: true, roomType: 'platform',
            height: 14, base: 1.5, fillColor: '#0369a1', levels: [lvl],
            name: `🛤️ ${floorLabel} Track 3•4 (${isUpper ? 'Sky Deck Line' : 'Yamanote / Keihin'})`
          },
          geometry: { type: 'Polygon', coordinates: makeRect(lon + 0.0006, lat - 0.0011, lon + 0.0011, lat + 0.0011) }
        },
        {
          type: 'Feature',
          properties: {
            id: `gate-n-${lvl}`, isZone: true, roomType: 'gate',
            height: 9, base: 1.5, fillColor: '#d97706', levels: [lvl],
            name: `🎟️ ${floorLabel} North Barrier-Free Ticket Gate`
          },
          geometry: { type: 'Polygon', coordinates: makeRect(lon - 0.00045, lat + 0.00045, lon + 0.00045, lat + 0.00105) }
        },
        {
          type: 'Feature',
          properties: {
            id: `lounge-s-${lvl}`, isZone: true, roomType: 'lounge',
            height: 8, base: 1.5, fillColor: '#059669', levels: [lvl],
            name: `🌿 ${floorLabel} South Stroller & Seating Concourse`
          },
          geometry: { type: 'Polygon', coordinates: makeRect(lon - 0.00045, lat - 0.00105, lon + 0.00045, lat - 0.00045) }
        }
      );
    } else {
      // UNDERGROUND FLOORS (B1F to B5F): East-West Subway Halls & Transfer Concourses
      features.push(
        {
          type: 'Feature',
          properties: {
            id: `sub-plat-n-${lvl}`, isZone: true, roomType: 'platform',
            height: 14, base: 1.5, fillColor: '#4f46e5', levels: [lvl],
            name: `🚇 ${floorLabel} Underground Track A•B (Metro Concourse)`
          },
          geometry: { type: 'Polygon', coordinates: makeRect(lon - 0.0013, lat + 0.0004 + shift, lon + 0.0013, lat + 0.00085 + shift) }
        },
        {
          type: 'Feature',
          properties: {
            id: `sub-gate-c-${lvl}`, isZone: true, roomType: 'gate',
            height: 9, base: 1.5, fillColor: '#ea580c', levels: [lvl],
            name: `🎟️ ${floorLabel} Central Transfer Gate & Concourse`
          },
          geometry: { type: 'Polygon', coordinates: makeRect(lon - 0.0009, lat - 0.00025 + shift, lon + 0.0009, lat + 0.00025 + shift) }
        },
        {
          type: 'Feature',
          properties: {
            id: `sub-lounge-s-${lvl}`, isZone: true, roomType: 'lounge',
            height: 8, base: 1.5, fillColor: '#0d9488', levels: [lvl],
            name: `🛍️ ${floorLabel} Step-Free Underground Mall & Locker Hall`
          },
          geometry: { type: 'Polygon', coordinates: makeRect(lon - 0.0012, lat - 0.00085 + shift, lon + 0.0012, lat - 0.0004 + shift) }
        }
      );
    }

    // Step-Free Interior Walkway Corridor
    features.push({
      type: 'Feature',
      properties: {
        id: `path-${lvl}`, isPath: true, isFacility: true, hasStairs: false, levels: [lvl],
        kind: 'Step-Free Corridor', category: 'mobility', icon: '🛤️',
        name: `${floorLabel} Main Step-Free Terminal Walkway`
      },
      geometry: {
        type: 'LineString',
        coordinates: isUnderground
          ? [[lon - 0.0011, lat + shift], [lon, lat + shift], [lon + 0.0011, lat + shift]]
          : [[lon, lat - 0.0009], [lon, lat], [lon, lat + 0.0009]]
      }
    });

    // Four Corner Facilities (Slope, Escalator, Lockers, Baby Room)
    features.push(
      {
        type: 'Feature',
        properties: { id: `slope-${lvl}`, isFacility: true, kind: 'Slope', category: 'mobility', icon: '♿', name: `${floorLabel} Gentle Stroller & Wheelchair Ramp`, levels: [lvl] },
        geometry: { type: 'Point', coordinates: [lon - 0.0004, lat + 0.0004] }
      },
      {
        type: 'Feature',
        properties: { id: `esc-${lvl}`, isFacility: true, kind: 'Escalator', category: 'mobility', icon: '🪜', name: `${floorLabel} Wide Luggage-Friendly Escalator`, levels: [lvl] },
        geometry: { type: 'Point', coordinates: [lon + 0.0004, lat - 0.0004] }
      },
      {
        type: 'Feature',
        properties: { id: `locker-${lvl}`, isFacility: true, kind: 'Coin Lockers', category: 'locker', icon: '🛅', name: `${floorLabel} Extra-Large Suitcase Coin Lockers`, levels: [lvl] },
        geometry: { type: 'Point', coordinates: [lon + 0.0004, lat + 0.0004] }
      },
      {
        type: 'Feature',
        properties: { id: `baby-${lvl}`, isFacility: true, kind: 'Baby & Stroller Room', category: 'baby', icon: '🍼', name: `${floorLabel} Nursing & Diaper Changing Lounge`, levels: [lvl] },
        geometry: { type: 'Point', coordinates: [lon - 0.0004, lat - 0.0004] }
      }
    );
  });

  // Multi-Floor Elevators, Sonar Pulses & 1-Tap Escape Route
  features.push(
    {
      type: 'Feature',
      properties: { id: 'elev-north', isElevator: true, isFacility: true, kind: 'Elevator', category: 'mobility', icon: '🛗', name: 'North Stroller & Wheelchair Elevator', levels: floors },
      geometry: { type: 'Point', coordinates: [lon - 0.0002, lat + 0.0002] }
    },
    {
      type: 'Feature',
      properties: { id: 'elev-south', isElevator: true, isFacility: true, kind: 'Elevator', category: 'mobility', icon: '🛗', name: 'South Direct Concourse Elevator', levels: ['1', '0', '-1', '-2'] },
      geometry: { type: 'Point', coordinates: [lon + 0.0002, lat - 0.0002] }
    },
    {
      type: 'Feature',
      properties: { id: 'sonar-crowded', isSonar: true, sonarType: 'crowded', category: 'crowded', levels: ['-1'], name: `${stationName} B1F Central Transfer Bottleneck`, amenities: '⚠️ High Foot Traffic • Narrow Stroller Clearance' },
      geometry: { type: 'Point', coordinates: [lon, lat - 0.00018] }
    },
    {
      type: 'Feature',
      properties: { id: 'sonar-oasis-1f', isSonar: true, sonarType: 'oasis', isFacility: true, kind: 'Rest Oasis', category: 'bench', icon: '🌿', levels: ['0'], name: `${stationName} 1F South Plaza & Waiting Lounge`, amenities: '🪑 Seating Benches • 🛅 Large Coin Lockers • 🍼 Baby/Stroller Room' },
      geometry: { type: 'Point', coordinates: [lon, lat - 0.00075] }
    },
    {
      type: 'Feature',
      properties: { id: 'sonar-oasis-2f', isSonar: true, sonarType: 'oasis', isFacility: true, kind: 'Rest Oasis', category: 'bench', icon: '🌿', levels: ['1', '2'], name: `${stationName} Upper Terrace & Family Breather Zone`, amenities: '🪑 Shaded Benches • 🍼 Nursing & Stroller Room • 🛅 Suitcases Lockers' },
      geometry: { type: 'Point', coordinates: [lon, lat + 0.00075] }
    },
    {
      type: 'Feature',
      properties: { id: 'escape-route-1f', isEscapeRoute: true, hasStairs: false, levels: ['0'], name: '1-Tap Stroller Escape Route to 1F Oasis' },
      geometry: { type: 'LineString', coordinates: [[lon - 0.0002, lat + 0.0002], [lon - 0.0001, lat - 0.0003], [lon, lat - 0.00075]] }
    }
  );

  return features;
};

const fetchOverpass = async (stationKey) => {
  const { bbox, coords, defaultFloors, name } = STATIONS[stationKey];
  const baseFeatures = buildMultiFloorMap(coords, defaultFloors, name);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    const query = `[out:json][timeout:5];node["highway"="elevator"](${bbox});out body;`;
    const res = await fetch(`https://overpass.kumi.systems/api/interpreter?data=${encodeURIComponent(query)}`, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error('Overpass busy');
    const data = await res.json();

    const osmElevs = (data.elements || []).slice(0, 10).map((el) => ({
      type: 'Feature',
      properties: {
        id: `osm-elev-${el.id}`, isElevator: true, isFacility: true,
        kind: 'Live OSM Elevator', category: 'mobility', icon: '🛗',
        name: el.tags?.name || 'Verified OSM Station Elevator',
        levels: (el.tags?.level || '0;-1').split(';').map(l => l.trim())
      },
      geometry: { type: 'Point', coordinates: [el.lon, el.lat] }
    }));

    return { features: [...baseFeatures, ...osmElevs], floors: defaultFloors };
  } catch {
    return { features: baseFeatures, floors: defaultFloors };
  }
};

const fetchStationCongestion = async (stationKey) => {
  const { apiName } = STATIONS[stationKey] || STATIONS.tokyo;
  try {
    const res = await fetch(`http://localhost:8000/stations/JR-East/${apiName}`);
    if (!res.ok) throw new Error('Offline');
    return await res.json();
  } catch {
    const isBusyHub = ['tokyo', 'shinjuku', 'shibuya'].includes(stationKey);
    return {
      name: { en: apiName, ja: apiName },
      operator: { code: 'JR-East', name: 'JR East / Tokyo Metro' },
      congestion: {
        passengers_per_day: stationKey === 'shinjuku' ? 750000 : stationKey === 'shibuya' ? 680000 : 450000,
        survey_year: 2024,
        busy_level: isBusyHub ? 'busy' : 'normal',
        live_delay_minutes: stationKey === 'tokyo' ? 10 : stationKey === 'shibuya' ? 5 : null
      },
      service_status: stationKey === 'tokyo'
        ? [{ railway: 'JR-East.ChuoRapid', status: '遅延', text: 'Chuo Line Delayed (+10m)' }]
        : stationKey === 'shibuya'
        ? [{ railway: 'JR-East.Yamanote', status: '遅延', text: 'Hachiko Gate Crowded (+5m)' }]
        : [{ railway: 'JR-East.Yamanote', status: '平常運転', text: 'Normal Service' }],
      facilities: []
    };
  }
};

export const useStationCongestion = (stationKey) => useQuery({
  queryKey: ['congestion', stationKey],
  queryFn: () => fetchStationCongestion(stationKey),
  staleTime: 1000 * 60 * 2,
});

export const useOverpassStation = (stationKey) => {
  const { coords, defaultFloors, name } = STATIONS[stationKey];
  return useQuery({
    queryKey: ['overpass', stationKey],
    queryFn: () => fetchOverpass(stationKey),
    placeholderData: () => ({ features: buildMultiFloorMap(coords, defaultFloors, name), floors: defaultFloors }),
    staleTime: 1000 * 60 * 30,
  });
};