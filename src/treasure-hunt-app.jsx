import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  secret:   { color: COLORS.tertiary, label: 'Secret Spot', shape: 'triangle' },
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

// Station config — Scheunenviertel, Berlin Mitte.
// Structural data only: editable title / description / clue text lives in
// `public/stations/<folder>/*.txt` and is loaded at runtime.
//
// `folder` is the subfolder under `public/stations/`. It's intentionally
// generic (`station-1`, `station-2`, …) so the slot stays stable even if you
// swap the place it points to.
//
// `unlockToken` is the secret that must arrive via the QR-code URL
// (?unlock=<token>) before the audio is revealed. Tokens are random,
// hard-to-guess strings; do not change them once your QR codes are printed.
const STATIONS = [
  {
    id: 1,
    folder: 'station-1',
    category: 'historic',
    coords: [52.52666850476375, 13.394591768148524],
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    unlockToken: 'ns-jt9k4m2zwq',
  },
  {
    id: 2,
    folder: 'station-2',
    category: 'historic',
    coords: [52.5249, 13.4017],
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    unlockToken: 'hh-r8p3v7nxbf',
  },
  {
    id: 3,
    folder: 'station-3',
    category: 'secret',
    coords: [52.5239, 13.3974],
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    unlockToken: 'mb-cwm2x5h7tq',
  },
  {
    id: 4,
    folder: 'station-4',
    category: 'modern',
    coords: [52.5276, 13.3974],
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
    unlockToken: 'kw-y4n6kbsd9p',
  },
  {
    id: 5,
    folder: 'station-5',
    category: 'modern',
    coords: [52.5267, 13.4116],
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
    unlockToken: 'vb-z3q8rhwm5c',
  },
  {
    // Placeholder 6th station — replace coords / category / unlockToken once
    // the real place is chosen. Text lives in public/stations/station-6/*.txt.
    id: 6,
    folder: 'station-6',
    category: 'secret',
    coords: [52.5260, 13.4000],
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3',
    unlockToken: 's6-a7k2m9wpqx4b',
  }
];

// Fallback title used before the .txt files finish loading, so the stations
// panel never renders blank rows.
const fallbackTitle = (station) =>
  `Station ${String(station.id).padStart(2, '0')}`;

// Fetch a .txt file from public/stations/<folder>/; return '' if missing
// or unreadable rather than crashing the UI.
const fetchStationText = async (folder, filename) => {
  try {
    const base = process.env.PUBLIC_URL || '';
    const res = await fetch(`${base}/stations/${folder}/${filename}`);
    if (!res.ok) return '';
    const raw = await res.text();
    return raw.trim();
  } catch {
    return '';
  }
};

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
        Scan the QR code at this station to unlock the audio story.
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
        Talk to me! · {treasureName}
      </p>
      <audio
        controls
        preload="none"
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
  if (style.shape === 'triangle') {
    // SVG so the white passe-partout border can follow the sloped edges
    // (a clip-path triangle would clip its own border off). The label sits
    // in the visual centroid (~⅔ down) rather than the geometric center,
    // so it doesn't crowd the apex.
    return `<div style="position:relative;width:32px;height:32px;filter:drop-shadow(0 2px 0 rgba(26,28,28,0.15));">
              <svg width="32" height="32" viewBox="0 0 32 32" style="display:block;overflow:visible;">
                <polygon points="16,3 29,29 3,29" fill="${bg}" stroke="#ffffff" stroke-width="4" stroke-linejoin="miter" />
              </svg>
              <span style="position:absolute;left:0;right:0;bottom:4px;text-align:center;line-height:1;">${label}</span>
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
          {/* Top two lines reserve ~28px on the right so the × close button
              (pinned on the 20px frame) never overlaps the eyebrow / title. */}
          <span style={{
            display: 'block',
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 700,
            fontSize: '10px',
            textTransform: 'uppercase',
            letterSpacing: '0.22em',
            color: style.color,
            marginBottom: '6px',
            paddingRight: '28px',
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
            paddingRight: '28px',
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
              // Zero padding + a fixed 24px box keeps the glyph's visual right
              // edge flush with the panel header's 22px content frame.
              background: 'transparent',
              border: 'none',
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '24px',
              fontWeight: 400,
              lineHeight: 1,
              color: COLORS.onSurface,
              cursor: 'pointer',
              padding: 0,
              width: '24px',
              height: '24px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: '2px',
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
                {style.shape === 'triangle' ? (
                  <svg
                    aria-hidden="true"
                    width="32"
                    height="32"
                    viewBox="0 0 32 32"
                    style={{ flexShrink: 0, display: 'block', overflow: 'visible' }}
                  >
                    <polygon
                      points="16,3 29,29 3,29"
                      fill={badgeBg}
                      stroke={COLORS.surfaceLowest}
                      strokeWidth="3"
                      strokeLinejoin="miter"
                    />
                  </svg>
                ) : (
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
                    }}
                  />
                )}
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

// --- Boot splash ---
// Three category shapes (yellow triangle, blue square, red circle) burst out
// from a dot in unison, hold briefly, then shrink toward the top-left header
// position and fade out. Total runtime: 2.5s.
//
// Pure CSS keyframes — no GIF, vector-sharp on every pixel ratio.
//
// Implementation notes:
// - Three explicit @keyframes (one per shape) instead of shared keyframe with
//   CSS variables — variables in keyframes can silently fail in some build
//   pipelines, and we want this to be impossible to misfire.
// - Timer captured in a ref so React re-renders or StrictMode double-mounts
//   never reset the 2.5s countdown.
const BootSplash = ({ onDone }) => {
  const onDoneRef = React.useRef(onDone);
  React.useEffect(() => { onDoneRef.current = onDone; });
  React.useEffect(() => {
    // eslint-disable-next-line no-console
    console.log('[BootSplash] mounted');
    const t = setTimeout(() => onDoneRef.current && onDoneRef.current(), 2500);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      role="presentation"
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: COLORS.surface,
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'bootSplashFade 0.4s ease-in 2.1s both',
        pointerEvents: 'none',
      }}
    >
      <style>{`
        @keyframes bootSplashFade {
          to { opacity: 0; }
        }
        @keyframes bootShapeYellow {
          0%   { transform: translate(0,0) scale(0);    opacity: 0; }
          10%  { transform: translate(0,0) scale(0.08); opacity: 1; }
          56%  { transform: translate(0,0) scale(1);    opacity: 1; }
          76%  { transform: translate(0,0) scale(1);    opacity: 1; }
          100% { transform: translate(calc(-50vw + 128px), calc(-50vh + 28px)) scale(0.14); opacity: 0; }
        }
        @keyframes bootShapeBlue {
          0%   { transform: translate(0,0) scale(0);    opacity: 0; }
          10%  { transform: translate(0,0) scale(0.08); opacity: 1; }
          56%  { transform: translate(0,0) scale(1);    opacity: 1; }
          76%  { transform: translate(0,0) scale(1);    opacity: 1; }
          100% { transform: translate(calc(-50vw + 28px), calc(-50vh + 28px)) scale(0.14); opacity: 0; }
        }
        @keyframes bootShapeRed {
          0%   { transform: translate(0,0) scale(0);    opacity: 0; }
          10%  { transform: translate(0,0) scale(0.08); opacity: 1; }
          56%  { transform: translate(0,0) scale(1);    opacity: 1; }
          76%  { transform: translate(0,0) scale(1);    opacity: 1; }
          100% { transform: translate(calc(-50vw - 72px), calc(-50vh + 28px)) scale(0.14); opacity: 0; }
        }
        .boot-shape {
          width: 72px;
          height: 72px;
          transform-origin: 50% 50%;
          will-change: transform, opacity;
        }
        .boot-shape--yellow { animation: bootShapeYellow 2.5s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .boot-shape--blue   { animation: bootShapeBlue   2.5s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .boot-shape--red    { animation: bootShapeRed    2.5s cubic-bezier(0.22, 1, 0.36, 1) both; }
      `}</style>
      <div style={{ display: 'flex', gap: '28px', alignItems: 'center' }}>
        <div
          className="boot-shape boot-shape--yellow"
          style={{
            backgroundColor: COLORS.tertiary,
            clipPath: 'polygon(50% 0%, 100% 100%, 0% 100%)',
          }}
        />
        <div
          className="boot-shape boot-shape--blue"
          style={{ backgroundColor: COLORS.secondary }}
        />
        <div
          className="boot-shape boot-shape--red"
          style={{ backgroundColor: COLORS.primary, borderRadius: '50%' }}
        />
      </div>
    </div>
  );
};

// --- Main App Component ---
export default function TreasureHuntApp() {
  const [foundTreasures, setFoundTreasures] = useState(loadInitialProgress);
  const [unlockedStations, setUnlockedStations] = useState(loadInitialUnlocks);
  const [panelOpen, setPanelOpen] = useState(false);
  const [justUnlockedId, setJustUnlockedId] = useState(null); // for the toast
  const [bootDone, setBootDone] = useState(false); // splash overlay until 2.5s

  // Content loaded from public/stations/<folder>/*.txt — keyed by station id.
  // { [id]: { title, description, clue } }
  const [stationContent, setStationContent] = useState({});

  // Load each station's .txt files once on mount. Kept in parallel so the six
  // stations' eighteen tiny fetches don't stack up.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const entries = await Promise.all(
        STATIONS.map(async (s) => {
          const [title, description, clue] = await Promise.all([
            fetchStationText(s.folder, 'title.txt'),
            fetchStationText(s.folder, 'description.txt'),
            fetchStationText(s.folder, 'clue.txt'),
          ]);
          return [s.id, { title, description, clue }];
        })
      );
      if (!cancelled) {
        setStationContent(Object.fromEntries(entries));
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Enriched station objects with `name`, `description`, `clue` merged in
  // from the loaded .txt content. Falls back to "Station 0N" for the title
  // so the UI never flashes blank rows.
  const treasures = useMemo(
    () =>
      STATIONS.map((s) => {
        const c = stationContent[s.id] || {};
        return {
          ...s,
          name: c.title || fallbackTitle(s),
          description: c.description || '',
          clue: c.clue || '',
        };
      }),
    [stationContent]
  );

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
    const matched = STATIONS.find((t) => t.unlockToken === token);
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

  const allFound = foundTreasures.length === STATIONS.length;

  return (
    <div style={{
      width: '100%',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: COLORS.surface,
    }}>
      {/* --- Boot splash (first paint only) --- */}
      {!bootDone && <BootSplash onDone={() => setBootDone(true)} />}

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
          aria-label={`Open stations list — ${foundTreasures.length} of ${STATIONS.length} found`}
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
            {foundTreasures.length}/{STATIONS.length}
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
        treasures={treasures}
        foundIds={foundTreasures}
        unlockedIds={unlockedStations}
      />

      {/* --- "Just unlocked" Toast --- */}
      {justUnlockedId != null && (() => {
        const t = treasures.find((x) => x.id === justUnlockedId);
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
        /* Align the Leaflet popup close button to the same 20px frame the
           popup content uses, and restyle it to match the Bauhaus glyph set
           (Space Grotesk, sharp, no default underline / pink color). */
        .leaflet-popup-content-wrapper .leaflet-popup-close-button,
        .leaflet-popup .leaflet-popup-close-button {
          top: 16px !important;
          right: 20px !important;
          width: 20px;
          height: 20px;
          padding: 0 !important;
          font: 700 22px/1 'Space Grotesk', sans-serif !important;
          color: ${COLORS.onSurface} !important;
          text-decoration: none !important;
          background: transparent !important;
        }
        .leaflet-popup-content-wrapper .leaflet-popup-close-button:hover {
          color: ${COLORS.primary} !important;
          background: transparent !important;
        }
        /* Make room for the × so it never overlaps the category eyebrow
           text, which also starts on the 20px frame. */
        .leaflet-popup-content {
          margin-right: 0 !important;
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
        {treasures.map((treasure) => (
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
