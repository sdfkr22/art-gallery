'use client';

import { useState } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import type { ArtistWithContext, ArtworkDTO } from '@/lib/types';
import Scene from './Scene';
import Placard from './Placard';

export default function GalleryView({
  artist,
  loading,
  onExit,
}: {
  artist: ArtistWithContext | null;
  loading: boolean;
  onExit: () => void;
}) {
  const [focused, setFocused] = useState<ArtworkDTO | null>(null);
  const [locked, setLocked] = useState(false);

  const accent = artist?.period.color ?? '#c9a25a';

  return (
    <div style={{ position: 'absolute', inset: 0, background: '#0a0807' }}>
      {artist && artist.artworks.length > 0 && (
        <Canvas
          dpr={[1, 2]}
          gl={{
            antialias: false,
            toneMapping: THREE.NoToneMapping,
            powerPreference: 'high-performance',
          }}
          camera={{ fov: 58, near: 0.08, far: 140, position: [0, 1.66, 1.2] }}
        >
          <color attach="background" args={['#0a0807']} />
          <Scene
            artworks={artist.artworks}
            accent={accent}
            onFocus={setFocused}
            onLockChange={setLocked}
          />
        </Canvas>
      )}

      {/* reticle */}
      {artist && artist.artworks.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: 6,
            height: 6,
            marginLeft: -3,
            marginTop: -3,
            borderRadius: '50%',
            background: focused ? accent : 'rgba(255,255,255,0.5)',
            boxShadow: focused ? `0 0 10px ${accent}` : 'none',
            transition: 'background 0.2s',
            pointerEvents: 'none',
            zIndex: 15,
          }}
        />
      )}

      {/* artist placard */}
      {artist && <Placard artist={artist} />}

      {/* focused artwork caption */}
      {focused && (
        <div
          key={focused.key}
          style={{
            position: 'absolute',
            bottom: 34,
            left: '50%',
            transform: 'translateX(-50%)',
            minWidth: 320,
            maxWidth: '60vw',
            padding: '14px 22px',
            textAlign: 'center',
            background: 'rgba(18,15,12,0.86)',
            border: '1px solid var(--line)',
            borderRadius: 4,
            backdropFilter: 'blur(8px)',
            zIndex: 15,
            animation: 'capFade 0.35s ease',
          }}
        >
          <div
            className="font-display"
            style={{ fontSize: 22, color: 'var(--ink)', lineHeight: 1.15 }}
          >
            {focused.title}
          </div>
          <div
            style={{
              marginTop: 4,
              fontSize: 11.5,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--ink-dim)',
            }}
          >
            {[focused.year, focused.medium].filter(Boolean).join(' · ') || '—'}
          </div>
          {focused.commonsUrl && (
            <a
              href={focused.commonsUrl}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: 10.5, color: 'var(--gold)', letterSpacing: '0.1em' }}
            >
              View on Wikimedia Commons ↗
            </a>
          )}
        </div>
      )}

      {/* exit */}
      <button
        onClick={onExit}
        style={{
          position: 'absolute',
          top: 22,
          right: 24,
          padding: '10px 20px',
          border: '1px solid var(--line)',
          borderRadius: 999,
          fontSize: 11,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--ink)',
          background: 'rgba(20,17,15,0.6)',
          backdropFilter: 'blur(6px)',
          zIndex: 20,
        }}
      >
        ← Leave gallery
      </button>

      {/* click-to-look prompt */}
      {artist && artist.artworks.length > 0 && !locked && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            zIndex: 18,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              padding: '14px 26px',
              border: '1px solid var(--line)',
              borderRadius: 999,
              fontSize: 12,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: 'var(--ink)',
              background: 'rgba(12,11,10,0.6)',
              backdropFilter: 'blur(4px)',
            }}
          >
            Click to look around · WASD to walk
          </div>
        </div>
      )}

      {/* loading */}
      {loading && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            zIndex: 30,
            background: 'radial-gradient(circle at 50% 45%, #14110f, #0a0807)',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div className="spinner" />
            <div
              style={{
                marginTop: 22,
                fontSize: 12,
                letterSpacing: '0.26em',
                textTransform: 'uppercase',
                color: 'var(--gold)',
              }}
            >
              Hanging the paintings…
            </div>
          </div>
        </div>
      )}

      {/* empty state */}
      {artist && !loading && artist.artworks.length === 0 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            zIndex: 18,
            textAlign: 'center',
            padding: 24,
          }}
        >
          <div>
            <h2 className="font-display" style={{ fontSize: 40, color: 'var(--ink)' }}>
              {artist.name}
            </h2>
            <p style={{ marginTop: 14, color: 'var(--ink-dim)', maxWidth: 420 }}>
              No public-domain works for this artist are available on Wikimedia
              Commons yet — much of their œuvre is still under copyright.
            </p>
          </div>
        </div>
      )}

      <style jsx>{`
        .spinner {
          width: 46px;
          height: 46px;
          margin: 0 auto;
          border: 2px solid rgba(201, 162, 90, 0.18);
          border-top-color: var(--gold);
          border-radius: 50%;
          animation: spin 0.9s linear infinite;
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes capFade {
          from {
            opacity: 0;
            transform: translate(-50%, 8px);
          }
          to {
            opacity: 1;
            transform: translate(-50%, 0);
          }
        }
      `}</style>
    </div>
  );
}
