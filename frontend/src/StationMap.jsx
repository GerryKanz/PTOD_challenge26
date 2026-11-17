import React, { useState, useMemo, useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './MapStyles.css';
import StationDetail from './StationDetail';
import { STATIONS, useOverpassStation, useStationCongestion, translateOdptStatus } from './hooks/useOverpassStation';

const FILTER_CHIPS = [
  { id: 'mobility', label: '🛗♿🪜 Step-Free & Lifts' },
  { id: 'bench', label: '🌿 Rest Oases' },
  { id: 'locker', label: '🛅 Coin Lockers' },
  { id: 'baby', label: '🍼 Baby Rooms' },
];

const STATION_META = {
  tokyo: {
    westSide: '⬅ MARUNOUCHI SIDE',
    eastSide: 'YAESU SIDE ➡',
    lines1F: ['🛤️ Chuo Rapid (Tr 1•2)', '🛤️ Yamanote (Tr 3•6)', '🚄 Shinkansen (Tr 14•23)'],
    exits1F: ['🚪 Marunouchi Central Exit', '🚪 Marunouchi North Exit', '🚪 Yaesu Central Exit', '🚪 Yaesu North Exit'],
    exitsB1: ['🚪 Exit B1 (Marunouchi)', '🚪 Exit B2 (Otemachi)', '🚪 Yaesu Exit 1', '🚪 Gransta South Exit'],
    deepLines: ['🚇 B5F Sobu Rapid (N\'EX)', '🚇 B5F Keiyo Line (Disney)']
  },
  shinjuku: {
    westSide: '⬅ WEST GATE SIDE',
    eastSide: 'EAST GATE SIDE ➡',
    lines1F: ['🛤️ Saikyo Line (Tr 1•4)', '🛤️ Chuo Rapid (Tr 7•12)', '🛤️ Yamanote (Tr 13•16)'],
    exits1F: ['🚪 West Ground Exit', '🚪 South Step-Free Exit', '🚪 East Central Exit', '🚪 Miraina Tower Gate'],
    exitsB1: ['🚪 Exit B1 (Subnade)', '🚪 Exit B12 (East Metro)', '🚪 West Oedo Exit', '🚪 Marunouchi B1F Gate'],
    deepLines: ['🚇 B5F Toei Oedo Line', '🚇 B3F Keio New Line']
  },
  shibuya: {
    westSide: '⬅ HACHIKO / 109 SIDE',
    eastSide: 'HIKARIE EAST SIDE ➡',
    lines1F: ['🛤️ Yamanote Outer (Tr 1)', '🛤️ Yamanote Inner (Tr 2)', '🛤️ Saikyo / N\'EX (Tr 3•4)'],
    exits1F: ['🚪 Hachiko Square Exit', '🚪 West Bus Exit', '🚪 East Hikarie Exit', '🚪 South Stream Exit'],
    exitsB1: ['🚪 Exit A1 (109 Pass)', '🚪 Exit A8 (Hachiko B1F)', '🚪 Exit B1 (Metro)', '🚪 Exit C2 (Stream)'],
    deepLines: ['🚇 B5F Toyoko & Fukutoshin', '🚇 B3F Den-en-toshi & Hanzomon']
  },
  ikebukuro: {
    westSide: '⬅ WEST (TOBU) SIDE',
    eastSide: 'EAST (SEIBU) SIDE ➡',
    lines1F: ['🛤️ Saikyo Line (Tr 1•4)', '🛤️ Yamanote (Tr 5•8)', '🛤️ Seibu Surface Line'],
    exits1F: ['🚪 West Central Exit', '🚪 Metropolitan Gate', '🚪 East Seibu Exit', '🚪 North Exit 20a'],
    exitsB1: ['🚪 Exit C1 (West Echika)', '🚪 Exit 35 (Sunshine)', '🚪 Exit 39 (South)', '🚪 Marunouchi B1F Gate'],
    deepLines: ['🚇 B4F Fukutoshin Line', '🚇 B2F Yurakucho Line']
  },
  ueno: {
    westSide: '⬅ PARK / ZOO SIDE',
    eastSide: 'HIROKOJI EAST SIDE ➡',
    lines1F: ['🛤️ Yamanote (Tr 1•4)', '🛤️ Joban Line (Tr 5•9)', '🛤️ Tracks 13•17 Hall'],
    exits1F: ['🚪 Park Gate Exit', '🚪 Hirokoji Exit', '🚪 Asakusa Exit', '🚪 Central Ground Exit'],
    exitsB1: ['🚪 Exit 1 (Ginza Line)', '🚪 Exit 5a (Hibiya)', '🚪 Exit 7 (Keisei)', '🚪 Shinobazu B1F Exit'],
    deepLines: ['🚇 B4F Shinkansen Deep Hall', '🚇 B2F Metro Concourse']
  }
};

const formatFloor = (lvl) => {
  if (lvl === 'ALL') return 'All Floors';
  const n = parseFloat(lvl);
  if (n === 0) return '1F';
  return n > 0 ? `${n + 1}F` : `B${Math.abs(n)}F`;
};

const getFloorColor = (lvl) => {
  const n = parseFloat(lvl);
  if (n === 0) return '#10b981';
  if (n > 0) return '#38bdf8';
  if (n === -1) return '#f59e0b';
  if (n === -2) return '#ea580c';
  return '#8b5cf6';
};

const rect = (lon1, lat1, lon2, lat2) => [
  [lon1, lat1], [lon2, lat1], [lon2, lat2], [lon1, lat2]
];

const getCenter = (corners) => [
  (corners[0][0] + corners[2][0]) / 2,
  (corners[0][1] + corners[2][1]) / 2
];

// Show Paid Fare Zone (isPaid: true) vs. Free Concourse (isPaid: false) + Gate Turnstile Lines
const buildDetailedFloorLayout = (coords, lvl, stationKey) => {
  const [lat, lon] = coords;
  const meta = STATION_META[stationKey] || STATION_META.tokyo;
  const n = parseFloat(lvl === 'ALL' ? '0' : lvl);
  const floorName = formatFloor(lvl === 'ALL' ? '0' : lvl);

  const rooms = [
    {
      id: 'base-slab', fillColor: '#0f172a', wallColor: '#090d16', stroke: '#334155',
      heightPx: 5, isSlab: true, name: `${floorName} Footprint`,
      corners: rect(lon - 0.00155, lat - 0.0013, lon + 0.00155, lat + 0.0013)
    }
  ];

  const sideSigns = [
    { id: 'side-west', text: meta.westSide, coords: [lon - 0.00168, lat + 0.0001], bg: '#1e3a8a', border: '#60a5fa' },
    { id: 'side-east', text: meta.eastSide, coords: [lon + 0.00168, lat + 0.0001], bg: '#7c2d12', border: '#fb923c' }
  ];

  const exitBadges = [];
  // Show Neon Magenta Turnstile Gate Lines separating Paid vs. Free Zones
  const gateBarriers = [];

  if (n >= 0) {
    rooms.push(
      {
        id: 'corr-north-bridge', fillColor: '#334155', wallColor: '#1e293b', stroke: '#94a3b8',
        heightPx: 10, isCorridor: true, isPaid: false, hideLabel: true, name: `${floorName} North Free Passage`,
        corners: rect(lon - 0.00135, lat + 0.00055, lon + 0.00135, lat + 0.00085)
      },
      {
        id: 'corr-center-bridge', fillColor: '#475569', wallColor: '#1e293b', stroke: '#cbd5e1',
        heightPx: 11, isCorridor: true, isPaid: true, hideLabel: true, name: `${floorName} Central Paid Transfer Bridge`,
        corners: rect(lon - 0.0014, lat - 0.0002, lon + 0.0014, lat + 0.0002)
      },
      {
        id: 'corr-south-bridge', fillColor: '#065f46', wallColor: '#064e3b', stroke: '#6ee7b7',
        heightPx: 10, isCorridor: true, isPaid: false, hideLabel: true, name: `${floorName} South Free Lounge`,
        corners: rect(lon - 0.00135, lat - 0.00085, lon + 0.00135, lat - 0.00055)
      },
      {
        id: 'plat-w', fillColor: '#0284c7', wallColor: '#0369a1', stroke: '#7dd3fc',
        heightPx: 24, isTrack: 'NS', isPaid: true, name: meta.lines1F[0], labelLatOffset: -0.00085,
        corners: rect(lon - 0.00105, lat - 0.0011, lon - 0.00065, lat + 0.0011)
      },
      {
        id: 'plat-c', fillColor: '#2563eb', wallColor: '#1d4ed8', stroke: '#93c5fd',
        heightPx: 24, isTrack: 'NS', isPaid: true, name: meta.lines1F[1], labelLatOffset: 0.00085,
        corners: rect(lon - 0.0002, lat - 0.0011, lon + 0.0002, lat + 0.0011)
      },
      {
        id: 'plat-e', fillColor: '#0d9488', wallColor: '#0f766e', stroke: '#5eead4',
        heightPx: 26, isTrack: 'NS', isPaid: true, name: meta.lines1F[2], labelLatOffset: -0.00085,
        corners: rect(lon + 0.00065, lat - 0.0011, lon + 0.00105, lat + 0.0011)
      },
      {
        id: 'gate-west', fillColor: '#d97706', wallColor: '#b45309', stroke: '#fde68a',
        heightPx: 16, isPaid: false, hideLabel: true, name: 'West Free Gate Lobby',
        corners: rect(lon - 0.00145, lat - 0.00045, lon - 0.00112, lat + 0.00045)
      },
      {
        id: 'gate-east', fillColor: '#ea580c', wallColor: '#c2410c', stroke: '#fed7aa',
        heightPx: 16, isPaid: false, hideLabel: true, name: 'East Free Gate Lobby',
        corners: rect(lon + 0.00112, lat - 0.00045, lon + 0.00145, lat + 0.00045)
      }
    );

    gateBarriers.push(
      [[lon - 0.0011, lat - 0.00045], [lon - 0.0011, lat + 0.00045]],
      [[lon + 0.0011, lat - 0.00045], [lon + 0.0011, lat + 0.00045]]
    );

    exitBadges.push(
      { id: 'ex-1', text: meta.exits1F[0], isPaid: false, coords: [lon - 0.00155, lat - 0.00065] },
      { id: 'ex-2', text: meta.exits1F[1], isPaid: false, coords: [lon - 0.00155, lat + 0.00095] },
      { id: 'ex-3', text: meta.exits1F[2], isPaid: false, coords: [lon + 0.00155, lat - 0.00065] },
      { id: 'ex-4', text: meta.exits1F[3], isPaid: false, coords: [lon + 0.00155, lat + 0.00095] }
    );
  } else if (n === -1) {
    rooms.push(
      {
        id: 'b1-north-pass', fillColor: '#334155', wallColor: '#1e293b', stroke: '#cbd5e1',
        heightPx: 11, isCorridor: true, isPaid: false, hideLabel: true, name: 'B1F North Free Passage',
        corners: rect(lon - 0.0014, lat + 0.0006, lon + 0.0014, lat + 0.0009)
      },
      {
        id: 'b1-south-pass', fillColor: '#334155', wallColor: '#1e293b', stroke: '#cbd5e1',
        heightPx: 11, isCorridor: true, isPaid: false, hideLabel: true, name: 'B1F South Free Concourse',
        corners: rect(lon - 0.0014, lat - 0.0009, lon + 0.0014, lat - 0.0006)
      },
      {
        id: 'b1-west-subway', fillColor: '#dc2626', wallColor: '#991b1b', stroke: '#fca5a5',
        heightPx: 22, isTrack: 'NS', isPaid: true, name: `🚇 B1F Subway Platform`, labelLatOffset: -0.0007,
        corners: rect(lon - 0.00138, lat - 0.00105, lon - 0.00095, lat + 0.00105)
      },
      {
        id: 'b1-central-mall', fillColor: '#d97706', wallColor: '#92400e', stroke: '#fde68a',
        heightPx: 16, isPaid: true, name: `🛍️ Gransta B1F Gate Hall`, labelLatOffset: 0.00035,
        corners: rect(lon - 0.00075, lat - 0.0006, lon + 0.00025, lat + 0.0006)
      },
      {
        id: 'b1-silver-bell', fillColor: '#059669', wallColor: '#065f46', stroke: '#6ee7b7',
        heightPx: 16, isPaid: true, name: `🔔 Silver Bell Oasis`, labelLatOffset: -0.00035,
        corners: rect(lon + 0.0003, lat - 0.0006, lon + 0.00085, lat + 0.0006)
      },
      {
        id: 'b1-east-mall', fillColor: '#7c3aed', wallColor: '#5b21b6', stroke: '#ddd6fe',
        heightPx: 18, isPaid: false, name: `🏬 East Free Concourse`, labelLatOffset: 0.0007,
        corners: rect(lon + 0.00095, lat - 0.0010, lon + 0.00138, lat + 0.0010)
      }
    );

    gateBarriers.push(
      [[lon - 0.00075, lat + 0.0006], [lon + 0.00085, lat + 0.0006]],
      [[lon - 0.00075, lat - 0.0006], [lon + 0.00085, lat - 0.0006]]
    );

    exitBadges.push(
      { id: 'b1-ex1', text: meta.exitsB1[0], isPaid: false, coords: [lon - 0.0015, lat + 0.00105] },
      { id: 'b1-ex2', text: meta.exitsB1[1], isPaid: false, coords: [lon - 0.0015, lat - 0.00105] },
      { id: 'b1-ex3', text: meta.exitsB1[2], isPaid: false, coords: [lon + 0.0015, lat + 0.00105] },
      { id: 'b1-ex4', text: meta.exitsB1[3], isPaid: false, coords: [lon + 0.0015, lat - 0.00105] }
    );
  } else if (n === -2 || n === -3) {
    rooms.push(
      {
        id: 'b3-main-spine', fillColor: '#334155', wallColor: '#1e293b', stroke: '#38bdf8',
        heightPx: 12, isCorridor: true, isPaid: true, hideLabel: true, name: `${floorName} Paid Transfer Spine`,
        corners: rect(lon - 0.00135, lat - 0.00025, lon + 0.00135, lat + 0.00025)
      },
      {
        id: 'b3-west-hall', fillColor: '#0284c7', wallColor: '#0369a1', stroke: '#7dd3fc',
        heightPx: 18, isPaid: true, name: `🎟️ ${floorName} Deep Transfer Hall`, labelLatOffset: 0.0005,
        corners: rect(lon - 0.0013, lat - 0.00095, lon - 0.0005, lat + 0.00095)
      },
      {
        id: 'b3-south-walkway', fillColor: '#ea580c', wallColor: '#9a3412', stroke: '#fed7aa',
        heightPx: 15, isPaid: true, name: `🚶 ${floorName} Moving Walkway`, labelLatOffset: -0.0008,
        corners: rect(lon - 0.0005, lat - 0.00105, lon + 0.00135, lat - 0.00055)
      },
      {
        id: 'b3-north-lounge', fillColor: '#0d9488', wallColor: '#115e59', stroke: '#99f6e4',
        heightPx: 15, isPaid: false, name: `🌿 ${floorName} Free Locker Hall`, labelLatOffset: 0.0007,
        corners: rect(lon - 0.0003, lat + 0.00045, lon + 0.00125, lat + 0.00095)
      }
    );

    gateBarriers.push([[lon - 0.0003, lat + 0.00045], [lon + 0.00125, lat + 0.00045]]);

    exitBadges.push(
      { id: 'b3-ex1', text: `🚪 Exit B4 (Forum Pass)`, isPaid: false, coords: [lon - 0.0015, lat - 0.0010] },
      { id: 'b3-ex2', text: `🚪 Exit B6 (Direct Lift)`, isPaid: false, coords: [lon + 0.0015, lat + 0.00095] }
    );
  } else {
    rooms.push(
      {
        id: 'b5-cross-bridge', fillColor: '#475569', wallColor: '#1e293b', stroke: '#f8fafc',
        heightPx: 14, isCorridor: true, isPaid: true, hideLabel: true, name: `${floorName} Deep Platform Bridge`,
        corners: rect(lon - 0.0012, lat - 0.0003, lon + 0.0012, lat + 0.0003)
      },
      {
        id: 'b5-plat-1', fillColor: '#2563eb', wallColor: '#1e40af', stroke: '#93c5fd',
        heightPx: 26, isTrack: 'EW', isPaid: true, name: meta.deepLines[0], labelLatOffset: 0.00065,
        corners: rect(lon - 0.0014, lat + 0.00035, lon + 0.0014, lat + 0.00095)
      },
      {
        id: 'b5-plat-2', fillColor: '#db2777', wallColor: '#9d174d', stroke: '#fbcfe8',
        heightPx: 26, isTrack: 'EW', isPaid: true, name: meta.deepLines[1], labelLatOffset: -0.00065,
        corners: rect(lon - 0.0014, lat - 0.00095, lon + 0.0014, lat - 0.00035)
      }
    );

    exitBadges.push(
      { id: 'b5-ex1', text: `🚪 Car 1•2 Lift to Exit B1`, isPaid: true, coords: [lon - 0.0015, lat] },
      { id: 'b5-ex3', text: `🚪 Car 10 Lift to East Gate`, isPaid: true, coords: [lon + 0.0015, lat] }
    );
  }

  return { rooms, sideSigns, exitBadges, gateBarriers };
};

export default function StationMap() {
  const [station, setStation] = useState('tokyo');
  const [selectedFloor, setSelectedFloor] = useState('0');
  const [isZenMode, setIsZenMode] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showIntelDrawer, setShowIntelDrawer] = useState(false);
  const [activeFilters, setActiveFilters] = useState([]);
  const [escapeActive, setEscapeActive] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  // "Tap Where You Are" Start Point + Active/Current Destination
  const [startSpot, setStartSpot] = useState(null);
  const [targetDest, setTargetDest] = useState(null);
  const [cameraTick, setCameraTick] = useState(0);

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);

  const { data } = useOverpassStation(station);
  const { data: stationDetail } = useStationCongestion(station);
  const floorsToDisplay = data?.floors || STATIONS[station].defaultFloors;

  const { rooms, sideSigns, exitBadges, gateBarriers, pointFacilities, roomLabels, floorChecklist } = useMemo(() => {
    const stationInfo = STATIONS[station];
    const { rooms: builtRooms, sideSigns: builtSides, exitBadges: builtExits, gateBarriers: builtGates } = buildDetailedFloorLayout(
      stationInfo.coords,
      selectedFloor,
      station
    );

    const labels = builtRooms
      .filter(r => !r.isSlab && !r.hideLabel && r.name)
      .map(r => ({
        id: r.id,
        name: r.name,
        isPaid: r.isPaid,
        coords: [
          (r.corners[0][0] + r.corners[2][0]) / 2,
          r.labelLatOffset ? STATIONS[station].coords[0] + r.labelLatOffset : (r.corners[0][1] + r.corners[2][1]) / 2
        ],
        color: r.fillColor
      }));

    if (!data) {
      return {
        rooms: builtRooms, sideSigns: builtSides, exitBadges: builtExits, gateBarriers: builtGates,
        pointFacilities: [], roomLabels: labels, floorChecklist: []
      };
    }

    const matchFloor = (f) => selectedFloor === 'ALL' || f.properties.levels.includes(selectedFloor);
    const matchCategory = (f) =>
      activeFilters.length === 0 ||
      f.properties.sonarType === 'crowded' ||
      activeFilters.includes(f.properties.category);

    const pts = data.features.filter(f => f.geometry.type === 'Point' && matchFloor(f) && matchCategory(f));
    const checklist = data.features.filter(f => f.properties.isFacility && matchFloor(f) && matchCategory(f));

    return {
      rooms: builtRooms, sideSigns: builtSides, exitBadges: builtExits, gateBarriers: builtGates,
      pointFacilities: pts, roomLabels: labels, floorChecklist: checklist
    };
  }, [data, station, selectedFloor, activeFilters]);

  // Default Starting Point on floor load + auto-target when a filter chip (like Baby Rooms) is toggled
  useEffect(() => {
    const [lat, lon] = STATIONS[station].coords;
    setStartSpot({
      name: `${formatFloor(selectedFloor)} Main Gate Entrance`,
      coords: [lon - 0.0012, lat + 0.00065],
      isPaid: false
    });
  }, [station, selectedFloor]);

  useEffect(() => {
    if (activeFilters.length > 0) {
      const firstMatch = pointFacilities.find(f => f.properties.isFacility && activeFilters.includes(f.properties.category));
      if (firstMatch) {
        setTargetDest({
          name: firstMatch.properties.name,
          icon: firstMatch.properties.icon,
          coords: firstMatch.geometry.coordinates,
          isPaid: firstMatch.properties.category !== 'locker'
        });
      }
    } else if (!escapeActive) {
      setTargetDest(null);
    }
  }, [activeFilters, pointFacilities, escapeActive]);

  const toggleFilter = (id) => {
    setActiveFilters((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]);
  };

  const getBreathabilityDot = (lvl) => {
    const n = parseFloat(lvl);
    const isBusy = stationDetail?.congestion?.busy_level === 'busy';
    const hasDelay = (stationDetail?.congestion?.live_delay_minutes || 0) > 0;
    if (n === -1 && (isBusy || hasDelay)) return '🔴';
    if (n === 0 && isBusy) return '🟡';
    return '🟢';
  };

  // Initialize 3D Camera (dragPan locked so icons never slide out of place/stay locked in)
  useEffect(() => {
    const triggerRedraw = () => setCameraTick((t) => t + 1);

    if (!mapRef.current) {
      const [lat, lon] = STATIONS.tokyo.coords;
      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: { version: 8, sources: {}, layers: [] },
        center: [lon, lat],
        zoom: 17.35,
        pitch: 56,
        bearing: -12,
        dragPan: false,
        antialias: true
      });
      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
      mapRef.current = map;
    }

    const map = mapRef.current;
    map.on('move', triggerRedraw);
    map.on('rotate', triggerRedraw);
    map.on('zoom', triggerRedraw);
    map.on('load', triggerRedraw);
    triggerRedraw();

    return () => {
      map.off('move', triggerRedraw);
      map.off('rotate', triggerRedraw);
      map.off('zoom', triggerRedraw);
      map.off('load', triggerRedraw);
    };
  }, []);

  // Smoothly Rotate on Floor or Station Switch
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const [lat, lon] = STATIONS[station].coords;
    const floorBearing = selectedFloor === 'ALL' ? 0 : parseFloat(selectedFloor) * 16 - 12;
    map.easeTo({
      center: [lon, lat],
      zoom: 17.35,
      pitch: 56,
      bearing: floorBearing,
      duration: 750
    });
  }, [station, selectedFloor]);

  // Render Locked Markers, Paid/Free Badges, "YOU" Puck & Clickable Amenities
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    const fillColor = getFloorColor(selectedFloor === 'ALL' ? '0' : selectedFloor);

    // "📍 YOU" Location Puck at User's Tapped Starting Point
    if (startSpot) {
      const puckEl = document.createElement('div');
      puckEl.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; pointer-events:none;">
          <div style="background:#2563eb; color:#fff; font-size:9.5px; font-weight:900; padding:2px 7px; border-radius:999px; border:1.5px solid #fff; margin-bottom:3px; white-space:nowrap; box-shadow:0 4px 10px rgba(0,0,0,0.6);">
            📍 YOU (${startSpot.isPaid ? '🎟️ Paid Zone' : '🆓 Free Zone'})
          </div>
          <div class="you-are-here-puck"></div>
        </div>
      `;
      const m = new maplibregl.Marker({ element: puckEl, draggable: false }).setLngLat(startSpot.coords).addTo(map);
      markersRef.current.push(m);
    }

    if (showLabels) {
      sideSigns.forEach((side) => {
        const el = document.createElement('div');
        el.style.cssText = `background:${side.bg}; color:#ffffff; border:2px solid ${side.border}; padding:5px 12px; border-radius:999px; font-size:11px; font-weight:900; white-space:nowrap; pointer-events:none; box-shadow:0 6px 16px rgba(0,0,0,0.75);`;
        el.innerText = side.text;
        const m = new maplibregl.Marker({ element: el }).setLngLat(side.coords).addTo(map);
        markersRef.current.push(m);
      });

      // Clickable Exit Badges: Tap to set as your "📍 Start Here" spot
      exitBadges.forEach((ex) => {
        const isCurrentStart = startSpot?.name === ex.text;
        const el = document.createElement('div');
        el.style.cssText = `background:${isCurrentStart ? '#2563eb' : '#facc15'}; color:${isCurrentStart ? '#ffffff' : '#0f172a'}; border:2px solid #ffffff; padding:4px 10px; border-radius:8px; font-size:10.5px; font-weight:900; white-space:nowrap; cursor:pointer; box-shadow:0 4px 14px rgba(0,0,0,0.75);`;
        el.innerText = isCurrentStart ? `📍 Start: ${ex.text}` : `${ex.text} (🆓 Free)`;
        el.onclick = (e) => {
          e.stopPropagation();
          setStartSpot({ name: ex.text, coords: ex.coords, isPaid: ex.isPaid });
          if (!targetDest && pointFacilities.length > 0) {
            const elev = pointFacilities.find(f => f.properties.isElevator) || pointFacilities[0];
            setTargetDest({ name: elev.properties.name, icon: elev.properties.icon, coords: elev.geometry.coordinates, isPaid: true });
          }
        };
        const m = new maplibregl.Marker({ element: el }).setLngLat(ex.coords).addTo(map);
        markersRef.current.push(m);
      });

      // Room Labels with Paid vs. Free Zone Tag (Tap any label to set Start Spot)
      roomLabels.forEach((lbl) => {
        const el = document.createElement('div');
        const zoneTag = lbl.isPaid ? '🎟️ Paid' : '🆓 Free';
        el.style.cssText = `background:rgba(15,23,42,0.95); color:#ffffff; border:2px solid ${lbl.color}; padding:3px 9px; border-radius:8px; font-size:10.5px; font-weight:800; white-space:nowrap; cursor:pointer; box-shadow:0 4px 12px rgba(0,0,0,0.65);`;
        el.innerHTML = `${lbl.name} <span style="background:${lbl.isPaid ? '#be185d' : '#047857'}; padding:1px 5px; border-radius:4px; font-size:9px; margin-left:4px;">${zoneTag}</span>`;
        el.onclick = (e) => {
          e.stopPropagation();
          setStartSpot({ name: lbl.name, coords: lbl.coords, isPaid: lbl.isPaid });
        };
        const m = new maplibregl.Marker({ element: el }).setLngLat(lbl.coords).addTo(map);
        markersRef.current.push(m);
      });
    }

    // Facility Pins (Tap any pin to route directly to it from your Start Spot)
    pointFacilities.forEach((fac) => {
      const [lon, lat] = fac.geometry.coordinates;
      const isSonar = fac.properties.isSonar;
      const sonarClass = fac.properties.sonarType === 'crowded' ? 'sonar-crowded' : 'sonar-oasis';
      const isTarget = targetDest?.name === fac.properties.name;

      const el = document.createElement('div');
      el.innerHTML = isSonar
        ? `<div class="sonar-wrapper ${sonarClass}"><div class="sonar-ring"></div><div class="sonar-core">${fac.properties.sonarType === 'crowded' ? '⚠️' : '🌿'}</div></div>`
        : `<div class="depth-ring-pin" style="background:${isTarget ? '#2563eb' : fillColor}; border-color:#ffffff; transform:${isTarget ? 'scale(1.22)' : 'scale(1)'}; cursor:pointer;">${fac.properties.icon || '🛗'}</div>`;

      el.onclick = (e) => {
        if (fac.properties.sonarType === 'crowded') return;
        e.stopPropagation();
        setTargetDest({
          name: fac.properties.name,
          icon: fac.properties.icon || '🌿',
          coords: [lon, lat],
          isPaid: fac.properties.category !== 'locker'
        });
      };

      const marker = new maplibregl.Marker({ element: el, draggable: false }).setLngLat([lon, lat]).addTo(map);
      markersRef.current.push(marker);
    });
  }, [sideSigns, exitBadges, pointFacilities, roomLabels, selectedFloor, showLabels, startSpot, targetDest]);

  const projectPt = (lon, lat) => {
    if (!mapRef.current) return { x: -1000, y: -1000 };
    return mapRef.current.project([lon, lat]);
  };

  // Builds a smooth step-free corridor path between Starting Point and Target Amenity (steering around center bottleneck!)
  const activeRoutePoints = useMemo(() => {
    if (!startSpot || !targetDest) return null;
    const [sLon, sLat] = startSpot.coords;
    const [tLon, tLat] = targetDest.coords;
    const stLat = STATIONS[station].coords[0];
    // Route along the North or South interconnecting corridor to avoid center crowd
    const safeCorridorLat = (sLat + tLat) / 2 >= stLat ? stLat + 0.00068 : stLat - 0.00068;
    return [
      [sLon, sLat],
      [sLon, safeCorridorLat],
      [tLon, safeCorridorLat],
      [tLon, tLat]
    ];
  }, [startSpot, targetDest, station]);

  const firstStatus = stationDetail?.service_status?.[0];
  const translatedLineAlert = translateOdptStatus(firstStatus?.status, firstStatus?.railway);

  return (
    <div className="map-wrapper" style={{ background: '#070c18' }}>
      {/* Wayfinding HUD Banner */}
      <div style={{
        position: 'absolute', top: '14px', left: '50%', transform: 'translateX(-50%)', zIndex: 999,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px'
      }}>
        <div style={{
          background: 'rgba(15, 23, 42, 0.94)', color: 'white', border: `2px solid ${getFloorColor(selectedFloor === 'ALL' ? '0' : selectedFloor)}`,
          padding: '6px 16px', borderRadius: '999px', fontWeight: 800, fontSize: '0.78rem',
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)', whiteSpace: 'nowrap'
        }}>
          📍 Tap Any Platform, Room, or Exit to Set Your Start Spot • 🎟️ Paid vs 🆓 Free Zones
        </div>

        {startSpot && targetDest && (
          <div
            onClick={() => setTargetDest(null)}
            style={{
              background: 'linear-gradient(90deg, #0284c7, #10b981)', color: '#ffffff',
              padding: '6px 16px', borderRadius: '999px', border: '1.5px solid #ffffff',
              fontWeight: 900, fontSize: '0.8rem', cursor: 'pointer', boxShadow: '0 6px 20px rgba(16,185,129,0.5)'
            }}
          >
            🧭 {startSpot.name} ➔ {targetDest.icon} {targetDest.name} • {startSpot.isPaid !== targetDest.isPaid ? '🎟️ Crosses IC Gate' : targetDest.isPaid ? '🎟️ Inside Paid Zone' : '🆓 Free Zone'} (✕)
          </div>
        )}
      </div>

      {/* LAYER 1: 3D SVG Station Blueprint + Liquid-Light Navigation Ribbon */}
      <svg
        data-tick={cameraTick}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1, pointerEvents: 'none' }}
      >
        <defs>
          <pattern id="blueprint-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(56, 189, 248, 0.14)" strokeWidth="1" />
          </pattern>

          {/* Live View Neon Gradient & Glow Filter */}
          <linearGradient id="trail-2026-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="50%" stopColor="#00f2fe" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>

          <filter id="glow-2026" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect width="100%" height="100%" fill="url(#blueprint-grid)" />

        {/* 3D Rooms & Platforms (Clickable to set "📍 You Are Here") */}
        {mapRef.current && rooms.map((room) => {
          const basePts = room.corners.map(([lon, lat]) => projectPt(lon, lat));
          const roofPts = basePts.map((p) => ({ x: p.x, y: p.y - room.heightPx }));
          const roofPolygon = roofPts.map((p) => `${p.x},${p.y}`).join(' ');

          return (
            <g key={room.id}>
              {[0, 1, 2, 3].map((i) => {
                const next = (i + 1) % 4;
                const wallPts = `${basePts[i].x},${basePts[i].y} ${basePts[next].x},${basePts[next].y} ${roofPts[next].x},${roofPts[next].y} ${roofPts[i].x},${roofPts[i].y}`;
                return (
                  <polygon
                    key={`wall-${i}`}
                    points={wallPts}
                    fill={room.wallColor}
                    fillOpacity={room.isSlab ? 0.55 : 0.85}
                    stroke={room.stroke}
                    strokeWidth="1"
                  />
                );
              })}

              <polygon
                points={roofPolygon}
                fill={room.fillColor}
                fillOpacity={room.isSlab ? 0.8 : room.isCorridor ? 0.88 : 0.92}
                stroke={room.isPaid ? '#f472b6' : room.stroke}
                strokeWidth={room.isSlab ? '2.5' : '2'}
                strokeDasharray={room.isCorridor ? '6,4' : 'none'}
                style={{ pointerEvents: room.isSlab ? 'none' : 'auto', cursor: 'pointer' }}
                onClick={() => {
                  if (!room.isSlab) {
                    setStartSpot({ name: room.name, coords: getCenter(room.corners), isPaid: !!room.isPaid });
                  }
                }}
              />

              {room.isTrack === 'NS' && (
                <line
                  x1={(roofPts[0].x + roofPts[1].x) / 2}
                  y1={(roofPts[0].y + roofPts[1].y) / 2}
                  x2={(roofPts[2].x + roofPts[3].x) / 2}
                  y2={(roofPts[2].y + roofPts[3].y) / 2}
                  stroke="#e0f2fe"
                  strokeWidth="3"
                  strokeDasharray="8,6"
                />
              )}
              {room.isTrack === 'EW' && (
                <line
                  x1={(roofPts[0].x + roofPts[3].x) / 2}
                  y1={(roofPts[0].y + roofPts[3].y) / 2}
                  x2={(roofPts[1].x + roofPts[2].x) / 2}
                  y2={(roofPts[1].y + roofPts[2].y) / 2}
                  stroke="#e0e7ff"
                  strokeWidth="3"
                  strokeDasharray="8,6"
                />
              )}
            </g>
          );
        })}

        {/* Paid vs. Free Zone Ticket Gate Turnstile Barriers */}
        {mapRef.current && gateBarriers.map((seg, idx) => {
          const p1 = projectPt(seg[0][0], seg[0][1]);
          const p2 = projectPt(seg[1][0], seg[1][1]);
          return (
            <line
              key={`gate-line-${idx}`}
              x1={p1.x} y1={p1.y - 15}
              x2={p2.x} y2={p2.y - 15}
              stroke="#ec4899"
              strokeWidth="5"
              strokeDasharray="4,6"
            />
          );
        })}

        {/* LIQUID-LIGHT NAVIGATION RIBBON */}
        {mapRef.current && activeRoutePoints && (() => {
          const screenPts = activeRoutePoints.map(([lon, lat]) => {
            const p = projectPt(lon, lat);
            return { x: p.x, y: p.y - 18 };
          });
          const polyString = screenPts.map(p => `${p.x},${p.y}`).join(' ');
          const destPt = screenPts[screenPts.length - 1];

          return (
            <g>
              {/* Layer 1: Wide 3D Neon Bloom Aura */}
              <polyline
                points={polyString}
                fill="none"
                stroke="url(#trail-2026-grad)"
                strokeWidth="22"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.38"
                filter="url(#glow-2026)"
              />
              {/* Layer 2: Sleek Glass Gradient Ribbon */}
              <polyline
                points={polyString}
                fill="none"
                stroke="url(#trail-2026-grad)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Layer 3: Animated Flowing Light Stream (Moves toward Destination) */}
              <polyline
                points={polyString}
                fill="none"
                stroke="#ffffff"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="trail-flow-2026"
              />
              {/* Layer 4: Destination Portal Ring */}
              <circle cx={destPt.x} cy={destPt.y} r="16" fill="rgba(16, 185, 129, 0.25)" stroke="#00f2fe" strokeWidth="3" />
              <circle cx={destPt.x} cy={destPt.y} r="6" fill="#ffffff" />
            </g>
          );
        })()}
      </svg>

      {/* LAYER 2: Interactive 3D Camera & Marker Canvas */}
      <div ref={mapContainerRef} style={{ position: 'relative', zIndex: 2, height: '100vh', width: '100%', background: 'transparent' }} />

      {showIntelDrawer && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 2000,
          background: '#0f172a', color: 'white', padding: '20px',
          borderTopLeftRadius: '24px', borderTopRightRadius: '24px',
          boxShadow: '0 -10px 30px rgba(0,0,0,0.7)', maxHeight: '70vh', overflowY: 'auto'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <strong style={{ fontSize: '1.1rem', color: '#38bdf8' }}>📊 Live ODPT Station Intel</strong>
            <button
              onClick={() => setShowIntelDrawer(false)}
              style={{ background: '#ef4444', color: 'white', border: 'none', padding: '6px 14px', borderRadius: '999px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              ✕ Close Drawer
            </button>
          </div>
          <StationDetail operator="JR-East" name={STATIONS[station].apiName} />
        </div>
      )}

      <div className="smart-hub-card">
        {!isFlipped ? (
          <>
            {stationDetail && (
              <div
                className="congestion-banner"
                onClick={() => {
                  setSelectedFloor('0');
                  setEscapeActive(true);
                  setIsZenMode(true);
                  const [lat, lon] = STATIONS[station].coords;
                  setTargetDest({ name: '1F South Plaza & Waiting Lounge', icon: '🌿', coords: [lon, lat - 0.00075], isPaid: false });
                }}
                style={{
                  background: stationDetail.congestion.live_delay_minutes ? '#dc2626' : '#0f172a',
                  color: 'white', padding: '8px 12px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer'
                }}
              >
                <div>{translatedLineAlert}</div>
                <div style={{ opacity: 0.9, marginTop: '2px' }}>
                  {stationDetail.congestion.live_delay_minutes
                    ? `⚠️ +${stationDetail.congestion.live_delay_minutes}m Delay — Tap Here for 1F Oasis Escape Route!`
                    : `🟢 Smooth Flow (${stationDetail.congestion.busy_level.toUpperCase()}) — Step-Free Clear`}
                </div>
              </div>
            )}

            <div className="floor-strip">
              <button
                onClick={() => { setActiveFilters([]); setTargetDest(null); }}
                style={{
                  background: activeFilters.length === 0 ? '#10b981' : '#1e293b',
                  color: 'white', border: 'none', padding: '6px 12px', borderRadius: '999px', fontSize: '0.76rem', fontWeight: 'bold', cursor: 'pointer'
                }}
              >
                {activeFilters.length === 0 ? '✓ All Pins' : '↺ Reset'}
              </button>
              {FILTER_CHIPS.map((chip) => {
                const isSelected = activeFilters.includes(chip.id);
                return (
                  <button
                    key={chip.id}
                    onClick={() => toggleFilter(chip.id)}
                    style={{
                      background: isSelected ? '#3b82f6' : '#1e293b',
                      border: isSelected ? '2px solid #93c5fd' : '2px solid transparent',
                      color: 'white', padding: '6px 12px', borderRadius: '999px', fontSize: '0.76rem', fontWeight: 'bold', cursor: 'pointer'
                    }}
                  >
                    {isSelected ? `✓ ${chip.label}` : chip.label}
                  </button>
                );
              })}
            </div>

            <div className="station-strip">
              {Object.entries(STATIONS).map(([key, info]) => (
                <button
                  key={key}
                  className={`station-pill ${station === key ? 'active' : ''}`}
                  onClick={() => { setStation(key); setSelectedFloor('0'); setEscapeActive(false); setTargetDest(null); }}
                >
                  {info.name}
                </button>
              ))}
              <button
                onClick={() => setShowIntelDrawer(true)}
                className="station-pill"
                style={{ background: '#0ea5e9', marginLeft: 'auto' }}
              >
                📊 Info
              </button>
            </div>

            <div className="floor-strip">
              <button
                className={`floor-pill ${selectedFloor === 'ALL' ? 'active' : ''}`}
                style={{ background: selectedFloor === 'ALL' ? '#334155' : '#1e293b' }}
                onClick={() => setSelectedFloor('ALL')}
              >
                ALL
              </button>
              {floorsToDisplay.map((lvl) => (
                <button
                  key={lvl}
                  className={`floor-pill ${selectedFloor === lvl ? 'active' : ''}`}
                  style={{ background: selectedFloor === lvl ? getFloorColor(lvl) : '#1e293b', borderColor: getFloorColor(lvl) }}
                  onClick={() => setSelectedFloor(lvl)}
                >
                  {formatFloor(lvl)} {getBreathabilityDot(lvl)}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setIsZenMode(!isZenMode)} className={`zen-toggle-btn ${isZenMode ? 'active' : ''}`} style={{ flex: 1 }}>
                {isZenMode ? '🌐 Exit Zen' : '🧘 Zen'}
              </button>
              <button
                onClick={() => setShowLabels(!showLabels)}
                className="zen-toggle-btn"
                style={{ flex: 1, background: showLabels ? '#0d9488' : '#334155' }}
              >
                {showLabels ? '🏷️ Signs: ON' : '🏷️ Signs: OFF'}
              </button>
              <button onClick={() => setIsFlipped(true)} className="zen-toggle-btn" style={{ flex: 1.2, background: '#3b82f6' }}>
                📋 {formatFloor(selectedFloor)} List ({floorChecklist.length})
              </button>
            </div>
          </>
        ) : (
          <div className="facility-flip-side" style={{ color: 'white' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <strong style={{ fontSize: '1rem' }}>
                📍 {STATIONS[station].name} — {formatFloor(selectedFloor)} ({floorChecklist.length})
              </strong>
              <button
                onClick={() => setIsFlipped(false)}
                style={{ background: '#334155', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '999px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                ↩ Back to 3D Map
              </button>
            </div>

            <div style={{ maxHeight: '190px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {floorChecklist.map((item) => (
                <div
                  key={item.properties.id}
                  onClick={() => {
                    if (item.geometry.type === 'Point') {
                      setTargetDest({
                        name: item.properties.name,
                        icon: item.properties.icon || '🛗',
                        coords: item.geometry.coordinates,
                        isPaid: item.properties.category !== 'locker'
                      });
                    }
                    setIsFlipped(false);
                  }}
                  style={{
                    background: '#1e293b', padding: '8px 12px', borderRadius: '12px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer',
                    borderLeft: `4px solid ${getFloorColor(selectedFloor === 'ALL' ? '0' : selectedFloor)}`
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{item.properties.icon} {item.properties.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                      {item.properties.kind} • {item.properties.category === 'locker' ? '🆓 Free Zone' : '🎟️ Paid Zone'}
                    </div>
                  </div>
                  <span style={{ fontSize: '0.8rem', color: '#38bdf8', fontWeight: 'bold' }}>Route Here →</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}