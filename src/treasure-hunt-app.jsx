import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// --- Bauhaus design tokens (mirrored from Stitch design system) ---
const COLORS = {
  surface: '#f9f9f9',
  surfaceLow: '#f3f3f3',
  surfaceHigh: '#e8e8e8',
  surfaceHighest: '#e2e2e2',
  surfaceLowest: '#ffffff',
  onSurface: '#1a1c1c',
  onSurfaceVariant: '#5d3f3d',
  primary: '#bc001f',        // Bauhaus Red — historic / heritage
  primaryDeep: '#930016',
  secondary: '#175ead',      // Bauhaus Blue — modern architecture / utility
  tertiary: '#d0a600',       // Bauhaus Yellow — secret spots / guidance
  found: '#1a1c1c',          // Use stark black for "found" — keep palette tight
};

const CATEGORY_STYLE = {
  historic: { color: COLORS.primary, label: 'Historic Site', shape: 'circle' },
  modern:   { color: COLORS.secondary, label: 'Modern Architecture', shape: 'square' },
  secret:   { color: COLORS.tertiary, label: 'Secret Spot', shape: 'diamond' },
};

// Fix default marker icon issue with Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const STORAGE_KEY = 'treasureHuntProgress';
const UNLOCK_STORAGE_KEY = 'treasureHuntUnlocks';

// Treasure stations — Scheunenviertel, Berlin Mitte
// Each has a unique `unlockToken` that must arrive via the QR-code URL
// (?unlock=<token>) before the audio is revealed. Tokens are random,
// hard-to-guess strings; do not change them once your QR codes are printed.
const TREASURES = [
  {
    id: 1,
    name: 'Neue Synagoge',
    category: 'historic',
    coords: [52.5249, 13.3938],
    clue: 'A Moorish-revival dome that was nearly lost twice. Find the eight-pointed star pattern set into the brickwork above the main entrance.',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    description: 'Built 1859–1866 on Oranienburger Straße. Its gilded dome was a beacon of Berlin\'s Jewish community and survived Kristallnacht thanks to a single police officer.',
    unlockToken: 'ns-jt9k4m2zwq',
  },
  {
    id: 2,
    name: 'Hackesche Höfe',
    category: 'historic',
    coords: [52.5249, 13.4017],
    clue: 'Eight courtyards, one network. Step into the first court and look up — the Jugendstil facade hides a strict geometric rhythm.',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    description: 'Berlin\'s largest enclosed courtyard complex. Restored Art Nouveau tilework by August Endell — a study in pattern and proportion.',
    unlockToken: 'hh-r8p3v7nxbf',
  },
  {
    id: 3,
    name: 'Monbijoupark',
    category: 'secret',
    coords: [52.5239, 13.3974],
    clue: 'Where a baroque palace once stood, only its outline remains. Find the stone fragment marking the river-facing corner.',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    description: 'A small park on the Spree that holds the negative space of the demolished Monbijou Palace — a quiet pocket between the bustle of Hackescher Markt and the Museum Island bridge.',
    unlockToken: 'mb-cwm2x5h7tq',
  },
  {
    id: 4,
    name: 'KW Institute for Contemporary Art',
    category: 'modern',
    coords: [52.5276, 13.3974],
    clue: 'A margarine factory turned art temple. The geometry hides in the staircase — count the angles before you climb.',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
    description: 'Auguststraße 69. The reactor of Berlin\'s post-Wende contemporary art scene — and the original home of the Berlin Biennale.',
    unlockToken: 'kw-y4n6kbsd9p',
  },
  {
    id: 5,
    name: 'Volksbühne',
    category: 'modern',
    coords: [52.5267, 13.4116],
    clue: 'A people\'s stage cast in stone. Find the giant rolling boulder out front and read what it once stood against.',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
    description: 'Built 1913–1914 by Oskar Kaufmann on Rosa-Luxemburg-Platz. A monumental, near-windowless theatre block — the architectural anchor of the eastern Scheunenviertel.',
    unlockToken: 'vb-z3q8rhwm5c',
  }
];

// Read saved progress once on startup.
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

// Read previously-unlocked stations (by token) from localStorage.
const loadInitialUnlocks = () => {
  try {
    const saved = localStorage.getItem(UNLOCK_STORAGE_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

// --- Locked Audio Placeholder (shown until QR is scanned) ---
const LockedAudio = () => (
  <div style={{
    marginTop: '16px',
    padding: '14px',
    backgroundColor: COLORS.surfaceLow,
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  }}>
    {/* Padlock glyph built from primitives — sharp 0px corners */}
    <span aria-hidden="true" style={{
      flexShrink: 0,
      display: 'inline-flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>
      <span style={{
        width: '14px',
        height: '8px',
        border: `2px solid ${COLORS.onSurface}`,
        borderBottom: 'none',
      }} />
      <span style={{
        width: '20px',
        height: '14px',
        background: COLORS.onSurface,
      }} />
    </span>
    <div>
      <div style={{
        fontFamily: "'Space Grotesk', sans-serif",
        fontWeight: 700,
        fontSize: '10px',
        textTransform: 'uppercase',
        letterSpacing: '0.18em',
        color: COLORS.onSurface,
        marginBottom: '2px',
      }}>
        Audio Locked
      </div>
      <div style={{
        fontFamily: "'Manrope', sans-serif",
        fontSize: '12px',
        color: COLORS.onSurfaceVariant,
        lineHeight: 1.4,
      }}>
        Scan the QR code at this station to unlock the audio clue.
      </div>
    </div>
  </div>
);

// --- Audio Player Component (Bauhaus-styled) ---
const AudioPlayer = ({ audioUrl, treasureName }) => {
  return (
    <div style={{
      marginTop: '16px',
      padding: '12px',
      backgroundColor: COLORS.surfaceLow,
    }}>
      <p style={{
        margin: '0 0 8px 0',
        fontSize: '10px',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.18em',
        fontFamily: "'Space Grotesk', sans-serif",
        color: COLORS.onSurface,
      }}>
        Audio Clue · {treasureName}
      </p>
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

// --- Marker shape builder ---
// Returns the inner HTML for a Bauhaus-style geometric pin.
// Shapes use thick white border (the "passe-partout") for poster-like weight.
const buildMarkerHtml = (treasure, isFound) => {
  const style = CATEGORY_STYLE[treasure.category] || CATEGORY_STYLE.historic;
  const bg = isFound ? COLORS.found : style.color;
  const label = isFound
    ? '<span style="color:#fff;font-weight:900;font-size:14px;line-height:1;">✓</span>'
    : `<span style="color:#fff;font-weight:700;font-size:11px;line-height:1;font-family:'Space Grotesk',sans-serif;">${treasure.id}</span>`;

  // Common geometric base
  const base = `width:32px;height:32px;display:flex;align-items:center;justify-content:center;border:4px solid #ffffff;background:${bg};box-shadow:0 2px 0 rgba(26,28,28,0.15);`;

  if (style.shape === 'circle') {
    return `<div style="${base}border-radius:50%;">${label}</div>`;
  }
  if (style.shape === 'diamond') {
    // Rotated square (Bauhaus yellow "guidance" primitive)
    return `<div style="${base}transform:rotate(45deg);">
              <span style="display:inline-block;transform:rotate(-45deg);">${label}</span>
            </div>`;
  }
  // 'square' — sharp 0px corners
  return `<div style="${base}">${label}</div>`;
};

// --- Treasure Marker Component ---
const TreasureMarker = ({ treasure, isFound, isUnlocked, onToggleFound }) => {
  const style = CATEGORY_STYLE[treasure.category] || CATEGORY_STYLE.historic;
  const markerIcon = L.divIcon({
    html: buildMarkerHtml(treasure, isFound),
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    className: 'bauhaus-marker',
  });

  return (
    <Marker position={treasure.coords} icon={markerIcon}>
      <Popup
        minWidth={300}
        autoPan={true}
        autoPanPaddingTopLeft={[20, 90]}
        autoPanPaddingBottomRight={[20, 40]}
      >
        <div style={{ padding: '20px 20px 18px 20px' }}>
          <span style={{
            display: 'block',
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 700,
            fontSize: '10px',
            textTransform: 'uppercase',
            letterSpacing: '0.22em',
            color: style.color,
            marginBottom: '6px',
          }}>
            {`Station ${String(treasure.id).padStart(2, '0')} // ${style.label}`}
          </span>
          <h3 style={{
            margin: '0 0 10px 0',
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 700,
            fontSize: '22px',
            lineHeight: 1.05,
            textTransform: 'uppercase',
            letterSpacing: '-0.01em',
            color: COLORS.onSurface,
          }}>
            {treasure.name}
          </h3>
          <p style={{
            margin: '0 0 10px 0',
            fontSize: '13px',
            lineHeight: 1.55,
            color: COLORS.onSurface,
            fontFamily: "'Manrope', sans-serif",
          }}>
            {treasure.description}
          </p>
          <p style={{
            margin: '0',
            fontSize: '12px',
            lineHeight: 1.5,
            color: COLORS.onSurfaceVariant,
            fontFamily: "'Manrope', sans-serif",
          }}>
            <span style={{
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.16em',
              fontSize: '10px',
              fontFamily: "'Space Grotesk', sans-serif",
              marginRight: '6px',
              color: COLORS.onSurface,
            }}>
              Clue
            </span>
            {treasure.clue}
          </p>

          {isUnlocked ? (
            <AudioPlayer audioUrl={treasure.audioUrl} treasureName={treasure.name} />
          ) : (
            <LockedAudio />
          )}

          {/* Bauhaus accent row + CTA */}
          <div style={{
            marginTop: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', gap: '6px' }} aria-hidden="true">
              <span style={{ width: '12px', height: '12px', background: COLORS.primary, display: 'inline-block' }} />
              <span style={{ width: '12px', height: '12px', background: COLORS.secondary, display: 'inline-block' }} />
              <span style={{ width: '12px', height: '12px', background: COLORS.tertiary, display: 'inline-block' }} />
            </div>
            <button
              onClick={() => onToggleFound(treasure.id)}
              style={{
                backgroundColor: isFound ? COLORS.found : COLORS.secondary,
                color: '#ffffff',
                border: 'none',
                borderRadius: 0,
                padding: '10px 18px',
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 700,
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '0.18em',
                cursor: 'pointer',
              }}
              aria-pressed={isFound}
              title={isFound ? 'Click to unmark this station' : 'Check in at this station'}
            >
              {isFound ? '✓ Checked In' : 'Check In'}
            </button>
          </div>
        </div>
      </Popup>
    </Marker>
  );
};

// --- Slide-in Stations Panel ---
const StationsPanel = ({ open, onClose, treasures, foundIds, unlockedIds = [] }) => {
  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden={!open}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(26,28,28,0.45)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 220ms ease',
          zIndex: 1500,
        }}
      />
      {/* Panel */}
      <aside
        role="dialog"
        aria-label="Stations"
        aria-hidden={!open}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          height: '100vh',
          width: 'min(380px, 88vw)',
          backgroundColor: COLORS.surfaceLowest,
          borderLeft: `12px solid ${COLORS.primary}`,
          transform: open ? 'translateX(0)' : 'translateX(110%)',
          transition: 'transform 280ms cubic-bezier(0.2, 0.8, 0.2, 1)',
          zIndex: 1600,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 0 0 1px rgba(26,28,28,0.04)',
        }}
      >
        {/* Panel Header */}
        <div style={{
          padding: '20px 22px 16px 22px',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '12px',
          borderBottom: `1px solid ${COLORS.surfaceLow}`,
        }}>
          <div>
            <div style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700,
              fontSize: '10px',
              textTransform: 'uppercase',
              letterSpacing: '0.22em',
              color: COLORS.primary,
              marginBottom: '4px',
            }}>
              Index · {foundIds.length}/{treasures.length}
            </div>
            <h2 style={{
              margin: 0,
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700,
              fontSize: '24px',
              lineHeight: 1.1,
              textTransform: 'uppercase',
              letterSpacing: '-0.02em',
              color: COLORS.onSurface,
            }}>
              Scavenger<br />Stations
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close stations panel"
            style={{
              background: 'transparent',
              border: 'none',
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '24px',
              fontWeight: 400,
              lineHeight: 1,
              color: COLORS.onSurface,
              cursor: 'pointer',
              padding: '4px 8px',
            }}
          >
            ×
          </button>
        </div>

        {/* Station List (scrollable) */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {treasures.map((t) => {
            const isFound = foundIds.includes(t.id);
            const isUnlocked = unlockedIds.includes(t.id);
            const style = CATEGORY_STYLE[t.category] || CATEGORY_STYLE.historic;

            // Three states: Locked (no QR scanned) → Unlocked (QR scanned) → Found (checked in)
            let statusLabel, statusBg, statusColor, statusBorder;
            if (isFound) {
              statusLabel = '✓ Found';
              statusBg = COLORS.onSurface;
              statusColor = COLORS.surfaceLowest;
              statusBorder = 'none';
            } else if (isUnlocked) {
              statusLabel = 'Unlocked';
              statusBg = style.color;
              statusColor = COLORS.surfaceLowest;
              statusBorder = 'none';
            } else {
              statusLabel = 'Locked';
              statusBg = 'transparent';
              statusColor = COLORS.onSurfaceVariant;
              statusBorder = `1px solid ${COLORS.surfaceHighest}`;
            }

            const rowOpacity = isFound || isUnlocked ? 1 : 0.55;
            const badgeBg = isFound || isUnlocked ? style.color : COLORS.surfaceHighest;

            return (
              <div
                key={t.id}
                style={{
                  padding: '16px 22px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  backgroundColor: isFound ? COLORS.surfaceLowest : COLORS.surfaceLow,
                  opacity: rowOpacity,
                  borderBottom: `1px solid ${COLORS.surfaceLow}`,
                }}
              >
                {/* Geometric category badge */}
                <span
                  aria-hidden="true"
                  style={{
                    flexShrink: 0,
                    width: '32px',
                    height: '32px',
                    background: badgeBg,
                    border: `3px solid ${COLORS.surfaceLowest}`,
                    boxShadow: `0 0 0 1px ${badgeBg}`,
                    borderRadius: style.shape === 'circle' ? '50%' : 0,
                    transform: style.shape === 'diamond' ? 'rotate(45deg)' : 'none',
                  }}
                />
                {/* Text block */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontWeight: 700,
                    fontSize: '9px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.2em',
                    color: style.color,
                    marginBottom: '2px',
                  }}>
                    {`Station ${String(t.id).padStart(2, '0')} · ${style.label}`}
                  </div>
                  <div style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontWeight: 700,
                    fontSize: '15px',
                    textTransform: 'uppercase',
                    letterSpacing: '-0.01em',
                    color: COLORS.onSurface,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {t.name}
                  </div>
                </div>
                {/* Status pill */}
                <span style={{
                  flexShrink: 0,
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 700,
                  fontSize: '9px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.18em',
                  padding: '5px 8px',
                  backgroundColor: statusBg,
                  color: statusColor,
                  border: statusBorder,
                }}>
                  {statusLabel}
                </span>
              </div>
            );
          })}
        </div>

        {/* Panel Footer accent */}
        <div style={{
          padding: '14px 22px',
          display: 'flex',
          gap: '6px',
          borderTop: `1px solid ${COLORS.surfaceLow}`,
        }} aria-hidden="true">
          <span style={{ width: '14px', height: '14px', background: COLORS.primary }} />
          <span style={{ width: '14px', height: '14px', background: COLORS.secondary }} />
          <span style={{ width: '14px', height: '14px', background: COLORS.tertiary }} />
        </div>
      </aside>
    </>
  );
};

// --- Map bounds ---
// Scheunenviertel (Berlin Mitte) — auto-fit to this on load.
// SW corner (Hackescher Markt area) → NE corner (Rosenthaler Platz / Volksbühne area).
const SCHEUNENVIERTEL_BOUNDS = [
  [52.521, 13.388], // South-West
  [52.532, 13.412], // North-East
];
// Outer pan limits: roomier N/S so Leaflet has space to auto-pan when a popup
// opens near the top edge (the popup is ~400px tall at this zoom level, so we
// need at least ~0.015° of latitude headroom). E/W kept tighter so the map
// still feels anchored in Scheunenviertel.
const PAN_BOUNDS = [
  [52.513, 13.383],
  [52.540, 13.418],
];

// --- Main App Component ---
export default function TreasureHuntApp() {
  const [foundTreasures, setFoundTreasures] = useState(loadInitialProgress);
  const [unlockedStations, setUnlockedStations] = useState(loadInitialUnlocks);
  const [panelOpen, setPanelOpen] = useState(false);
  const [justUnlockedId, setJustUnlockedId] = useState(null); // for the toast

  // Skip the first save so we never overwrite storage with the hydrated
  // value on mount.
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

  // Persist unlocked stations.
  const didHydrateUnlocks = useRef(false);
  useEffect(() => {
    if (!didHydrateUnlocks.current) {
      didHydrateUnlocks.current = true;
      return;
    }
    try {
      localStorage.setItem(UNLOCK_STORAGE_KEY, JSON.stringify(unlockedStations));
    } catch {
      // Fail silently.
    }
  }, [unlockedStations]);

  // Handle ?unlock=<token> from a scanned QR code. Runs once on mount.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('unlock');
    if (!token) return;
    const matched = TREASURES.find((t) => t.unlockToken === token);
    if (matched) {
      setUnlockedStations((prev) =>
        prev.includes(matched.id) ? prev : [...prev, matched.id]
      );
      setJustUnlockedId(matched.id);
    }
    // Strip the token from the URL so a refresh doesn't keep re-triggering it
    // and the URL stays clean. Keep any other params + the path/hash.
    params.delete('unlock');
    const qs = params.toString();
    const cleanUrl =
      window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash;
    window.history.replaceState({}, document.title, cleanUrl);
  }, []);

  // Auto-dismiss the "just unlocked" toast after a few seconds.
  useEffect(() => {
    if (justUnlockedId == null) return;
    const t = setTimeout(() => setJustUnlockedId(null), 4500);
    return () => clearTimeout(t);
  }, [justUnlockedId]);

  const handleToggleFound = (treasureId) => {
    setFoundTreasures((prev) =>
      prev.includes(treasureId)
        ? prev.filter((id) => id !== treasureId)
        : [...prev, treasureId]
    );
  };

  const allFound = foundTreasures.length === TREASURES.length;

  return (
    <div style={{
      width: '100%',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: COLORS.surface,
    }}>
      {/* --- Bauhaus Header --- */}
      <header style={{
        backgroundColor: COLORS.surface,
        color: COLORS.onSurface,
        padding: '14px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: `1px solid ${COLORS.surfaceLow}`,
        zIndex: 1000,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {/* grid_view glyph: 4 small squares */}
          <span aria-hidden="true" style={{
            display: 'inline-grid',
            gridTemplateColumns: '8px 8px',
            gridTemplateRows: '8px 8px',
            gap: '3px',
          }}>
            <span style={{ background: COLORS.primary }} />
            <span style={{ background: COLORS.primary }} />
            <span style={{ background: COLORS.primary }} />
            <span style={{ background: COLORS.primary }} />
          </span>
          <h1 style={{
            margin: 0,
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 700,
            letterSpacing: '-0.02em',
            fontSize: '18px',
            color: COLORS.primary,
            textTransform: 'uppercase',
          }}>
            Berlin Kartograph
          </h1>
        </div>

        {/* Progress badge — opens the slide-in stations panel */}
        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          aria-label={`Open stations list — ${foundTreasures.length} of ${TREASURES.length} found`}
          aria-expanded={panelOpen}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '6px 10px',
            backgroundColor: COLORS.surfaceHighest,
            border: 'none',
            borderRadius: 0,
            cursor: 'pointer',
            font: 'inherit',
            color: 'inherit',
          }}
        >
          <span style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 700,
            fontSize: '10px',
            textTransform: 'uppercase',
            letterSpacing: '0.18em',
            color: COLORS.onSurface,
          }}>
            Found
          </span>
          <span style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 700,
            fontSize: '14px',
            color: COLORS.primary,
            letterSpacing: '-0.02em',
          }}>
            {foundTreasures.length}/{TREASURES.length}
          </span>
          {/* Tiny right-pointing chevron to hint at the slide-in */}
          <span aria-hidden="true" style={{
            display: 'inline-block',
            width: 0,
            height: 0,
            borderTop: '5px solid transparent',
            borderBottom: '5px solid transparent',
            borderLeft: `6px solid ${COLORS.onSurface}`,
            marginLeft: '2px',
          }} />
        </button>
      </header>

      {/* --- Slide-in Stations Panel --- */}
      <StationsPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        treasures={TREASURES}
        foundIds={foundTreasures}
        unlockedIds={unlockedStations}
      />

      {/* --- "Just unlocked" Toast --- */}
      {justUnlockedId != null && (() => {
        const t = TREASURES.find((x) => x.id === justUnlockedId);
        if (!t) return null;
        const style = CATEGORY_STYLE[t.category] || CATEGORY_STYLE.historic;
        return (
          <div
            role="status"
            aria-live="polite"
            style={{
              position: 'fixed',
              bottom: '24px',
              left: '50%',
              transform: 'translateX(-50%)',
              backgroundColor: COLORS.onSurface,
              color: COLORS.surfaceLowest,
              borderLeft: `12px solid ${style.color}`,
              padding: '14px 20px',
              maxWidth: 'min(420px, calc(100vw - 32px))',
              zIndex: 2000,
              boxShadow: '0 6px 0 rgba(26,28,28,0.12)',
            }}
          >
            <div style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700,
              fontSize: '10px',
              textTransform: 'uppercase',
              letterSpacing: '0.22em',
              color: style.color,
              marginBottom: '4px',
            }}>
              ✓ Unlocked · {style.label}
            </div>
            <div style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700,
              fontSize: '16px',
              textTransform: 'uppercase',
              letterSpacing: '-0.01em',
            }}>
              {t.name}
            </div>
            <div style={{
              fontFamily: "'Manrope', sans-serif",
              fontSize: '12px',
              opacity: 0.75,
              marginTop: '4px',
            }}>
              Tap the pin on the map to listen.
            </div>
          </div>
        );
      })()}

      {/* --- Halftone dot mask on the road tiles --- */}
      {/* Each road-tile <img> gets a 4px-grid dot mask. The black pixels in the
          tile only show through the dot positions, turning solid streets into a
          stippled texture that's clearly distinct from the water fill. 4px grid
          ensures seamless tiling (256 / 4 = 64, no edge discontinuity). */}
      <style>{`
        .streets-dotted {
          -webkit-mask-image: radial-gradient(circle, #000 45%, transparent 55%);
                  mask-image: radial-gradient(circle, #000 45%, transparent 55%);
          -webkit-mask-size: 4px 4px;
                  mask-size: 4px 4px;
          -webkit-mask-repeat: repeat;
                  mask-repeat: repeat;
        }
      `}</style>

      {/* --- Map --- */}
      <MapContainer
        bounds={SCHEUNENVIERTEL_BOUNDS}
        boundsOptions={{ padding: [20, 20] }}
        maxBounds={PAN_BOUNDS}
        maxBoundsViscosity={1.0}
        minZoom={15}
        maxZoom={19}
        style={{ flex: 1, width: '100%', backgroundColor: COLORS.surfaceLow }}
        scrollWheelZoom={true}
      >
        {/* Two-layer Stamen Toner stack: background (white land, gray water — no lines, no labels) */}
        {/* + lines (black roads/rails, no labels) with a halftone dot mask on top. */}
        <TileLayer
          attribution='&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://stamen.com/">Stamen Design</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tiles.stadiamaps.com/tiles/stamen_toner_background/{z}/{x}/{y}{r}.png"
          maxZoom={20}
        />
        <TileLayer
          className="streets-dotted"
          url="https://tiles.stadiamaps.com/tiles/stamen_toner_lines/{z}/{x}/{y}{r}.png"
          maxZoom={20}
        />
        {TREASURES.map((treasure) => (
          <TreasureMarker
            key={treasure.id}
            treasure={treasure}
            isFound={foundTreasures.includes(treasure.id)}
            isUnlocked={unlockedStations.includes(treasure.id)}
            onToggleFound={handleToggleFound}
          />
        ))}
      </MapContainer>

      {/* --- Bauhaus completion banner --- */}
      {allFound && (
        <div style={{
          backgroundColor: COLORS.primary,
          color: '#ffffff',
          padding: '18px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <span aria-hidden="true" style={{
              width: '20px',
              height: '20px',
              background: COLORS.tertiary,
              display: 'inline-block',
              transform: 'rotate(45deg)',
            }} />
            <div>
              <div style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 700,
                fontSize: '10px',
                textTransform: 'uppercase',
                letterSpacing: '0.22em',
                opacity: 0.85,
              }}>
                Index Complete
              </div>
              <div style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 700,
                fontSize: '18px',
                textTransform: 'uppercase',
                letterSpacing: '-0.01em',
              }}>
                All Stations Unlocked
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '6px' }} aria-hidden="true">
            <span style={{ width: '14px', height: '14px', background: '#ffffff', display: 'inline-block' }} />
            <span style={{ width: '14px', height: '14px', background: COLORS.secondary, display: 'inline-block' }} />
            <span style={{ width: '14px', height: '14px', background: COLORS.tertiary, display: 'inline-block' }} />
          </div>
        </div>
      )}
    </div>
  );
}
