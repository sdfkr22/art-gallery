'use client';

import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import type { ArtistWithContext } from '@/lib/types';

export default function Placard({ artist }: { artist: ArtistWithContext }) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (ref.current) {
      gsap.fromTo(
        ref.current,
        { opacity: 0, x: -24 },
        { opacity: 1, x: 0, duration: 0.9, delay: 0.5, ease: 'power3.out' },
      );
    }
  }, []);

  const lifespan = `${artist.birthYear ?? '?'} – ${artist.deathYear ?? '?'}`;

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        top: 84,
        left: 26,
        width: open ? 340 : 'auto',
        maxWidth: '42vw',
        padding: open ? '22px 24px' : '12px 16px',
        background: 'rgba(18,15,12,0.82)',
        border: '1px solid var(--line)',
        borderRadius: 4,
        backdropFilter: 'blur(10px)',
        boxShadow: '0 18px 50px rgba(0,0,0,0.5)',
        zIndex: 20,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 12,
        }}
      >
        <div
          style={{
            fontSize: 10,
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
            color: artist.period.color,
          }}
        >
          {artist.period.name}
        </div>
        <button
          onClick={() => setOpen((o) => !o)}
          style={{
            fontSize: 16,
            color: 'var(--ink-dim)',
            lineHeight: 1,
            padding: 2,
          }}
          aria-label={open ? 'Collapse' : 'Expand'}
        >
          {open ? '–' : '+'}
        </button>
      </div>

      {open && (
        <>
          <h2
            className="font-display"
            style={{
              marginTop: 8,
              fontSize: 32,
              fontWeight: 600,
              lineHeight: 1.05,
              color: 'var(--ink)',
            }}
          >
            {artist.name}
          </h2>
          <div
            style={{
              marginTop: 6,
              fontSize: 12,
              letterSpacing: '0.06em',
              color: 'var(--ink-dim)',
            }}
          >
            {lifespan}
            {artist.nationality ? ` · ${artist.nationality}` : ''}
          </div>

          <div
            style={{
              height: 1,
              background: 'var(--line)',
              margin: '16px 0',
            }}
          />

          <p
            style={{
              fontSize: 13.5,
              lineHeight: 1.62,
              color: '#cfc7b8',
              fontWeight: 300,
              maxHeight: 220,
              overflowY: 'auto',
              paddingRight: 6,
            }}
          >
            {artist.bio}
          </p>

          <div
            style={{
              marginTop: 16,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 11,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
            }}
          >
            <span style={{ color: artist.period.color }}>
              {artist.artworkCount} works on view
            </span>
            {artist.wikipediaUrl && (
              <a
                href={artist.wikipediaUrl}
                target="_blank"
                rel="noreferrer"
                style={{ color: 'var(--gold-bright)' }}
              >
                Wikipedia ↗
              </a>
            )}
          </div>
        </>
      )}
    </div>
  );
}
