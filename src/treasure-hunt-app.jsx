import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icon issue with Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const STORAGE_KEY = 'treasureHuntProgress';

// Sample treasure locations in Berlin
const TREASURES = [
  {
    id: 1,
    name: 'Checkpoint Charlie',
    coords: [52.5075, 13.4019],
    clue: 'Find the historic Cold War checkpoint.',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    description: 'This is one of the most famous crossing points between East and West Berlin during the Cold War.'
  },
  {
    id: 2,
    name: 'Brandenburg Gate',
    coords: [52.5163, 13.3777],
    clue: 'Look for the iconic gate that symbolizes unity.',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    description: 'An 18th-century neoclassical monument and one of Berlin\'s most recognizable landmarks.'
  },
  {
    id: 3,
    name: 'Berlin Wall Memorial',
    coords: [52.5375, 13.3895],
    clue: 'Discover where history was divided.',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    description: 'The East Side Gallery preserves a remaining section of the Berlin Wall covered in murals.'
  },
  {
    id: 4,
    name: 'Reichstag Building',
    coords: [52.5186, 13.3761],
    clue: 'Find the seat of German government.',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
    description: 'The historic seat of the German parliament with its iconic glass dome.'
  },
  {
    id: 5,
    name: 'Museum Island',
    coords: [52.5205, 13.3978],
    clue: 'Explore the cultural heart of Berlin.',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
    description: 'A UNESCO World Heritage site with five world-class museums.'
  }
];

// Read saved progress once on startup.
// Using a lazy initializer (not a useEffect) avoids the race where the
// save-on-change effect would fire with the initial [] and clobber storage
// before the load effect had a chance to populate state.
const loadInitialProgress = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

// Audio Player Component
const AudioPlayer = ({ audioUrl, treasureName }) => {
  return (
    <div style={{ marginTop: '12px', padding: '8px', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
      <p style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: 'bold' }}>Audio clue for {treasureName}:</p>
      <audio
        controls
        style={{ width: '100%', marginTop: '4px' }}
        controlsList="nodownload"
      >
        <source src={audioUrl} type="audio/mpeg" />
        Your browser does not support the audio element.
      </audio>
    </div>
  );
};

// Treasure Marker Component
const TreasureMarker = ({ treasure, isFound, onToggleFound }) => {
  const markerColor = isFound ? '#4CAF50' : '#2196F3';
  const markerIcon = L.divIcon({
    html: `<div style="background-color: ${markerColor}; width: 30px; height: 30px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">${isFound ? '✓' : treasure.id}</div>`,
    iconSize: [30, 30],
    className: 'custom-marker'
  });

  return (
    <Marker position={treasure.coords} icon={markerIcon}>
      <Popup minWidth={280}>
        <div style={{ padding: '8px' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>{treasure.name}</h3>
          <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#555' }}>{treasure.description}</p>
          <p style={{ margin: '0 0 12px 0', fontSize: '12px', fontStyle: 'italic', color: '#888' }}>
            <strong>Clue:</strong> {treasure.clue}
          </p>
          <AudioPlayer audioUrl={treasure.audioUrl} treasureName={treasure.name} />
          <button
            onClick={() => onToggleFound(treasure.id)}
            style={{
              marginTop: '12px',
              width: '100%',
              padding: '8px',
              backgroundColor: isFound ? '#4CAF50' : '#2196F3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 'bold'
            }}
            aria-pressed={isFound}
            title={isFound ? 'Click to unmark this treasure' : 'Mark this treasure as found'}
          >
            {isFound ? '✓ Found (tap to undo)' : 'Mark as Found'}
          </button>
        </div>
      </Popup>
    </Marker>
  );
};

// Main App Component
export default function TreasureHuntApp() {
  const [foundTreasures, setFoundTreasures] = useState(loadInitialProgress);
  const [mapCenter] = useState([52.52, 13.405]); // Berlin center

  // Skip the first save so we never overwrite storage with the hydrated
  // value on mount. After the first render, any genuine state change will
  // be persisted.
  const didHydrate = useRef(false);
  useEffect(() => {
    if (!didHydrate.current) {
      didHydrate.current = true;
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(foundTreasures));
    } catch {
      // Storage may be unavailable (private mode, quota). Fail silently.
    }
  }, [foundTreasures]);

  const handleToggleFound = (treasureId) => {
    setFoundTreasures((prev) =>
      prev.includes(treasureId)
        ? prev.filter((id) => id !== treasureId)
        : [...prev, treasureId]
    );
  };

  const progress = `${foundTreasures.length}/${TREASURES.length}`;

  return (
    <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        backgroundColor: '#1976D2',
        color: 'white',
        padding: '16px',
        textAlign: 'center',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        zIndex: 1000
      }}>
        <h1 style={{ margin: '0 0 8px 0', fontSize: '24px' }}>Berlin Treasure Hunt</h1>
        <p style={{ margin: '0', fontSize: '14px' }}>Progress: {progress} treasures found</p>
      </div>

      {/* Map */}
      <MapContainer
        center={mapCenter}
        zoom={13}
        style={{ flex: 1, width: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {TREASURES.map((treasure) => (
          <TreasureMarker
            key={treasure.id}
            treasure={treasure}
            isFound={foundTreasures.includes(treasure.id)}
            onToggleFound={handleToggleFound}
          />
        ))}
      </MapContainer>

      {/* Footer */}
      {foundTreasures.length === TREASURES.length && (
        <div style={{
          backgroundColor: '#4CAF50',
          color: 'white',
          padding: '16px',
          textAlign: 'center',
          fontWeight: 'bold'
        }}>
          🎉 Congratulations! You found all treasures!
        </div>
      )}
    </div>
  );
}
