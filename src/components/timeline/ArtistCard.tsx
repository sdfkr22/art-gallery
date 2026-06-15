'use client';

import { useRef } from 'react';
import { gsap } from 'gsap';
import type { ArtistDTO } from '@/lib/types';

export default function ArtistCard({
  artist,
  x,
  y,
  color,
  reveal,
  interactive,
  onOpen,
}: {
  artist: ArtistDTO;
  x: number;
  y: number;
  color: string;
  reveal: number;
  interactive: boolean;
  onOpen: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);

  const hover = (over: boolean) => {
    if (!ref.current) return;
    gsap.to(ref.current.querySelector('.portrait'), {
      scale: over ? 1.09 : 1,
      duration: 0.4,
      ease: 'power2.out',
    });
    gsap.to(ref.current.querySelector('.ring'), {
      opacity: over ? 1 : 0.55,
      duration: 0.4,
    });
  };

  const lifespan =
    artist.birthYear || artist.deathYear
      ? `${artist.birthYear ?? '?'}–${artist.deathYear ?? '?'}`
      : '';

  return (
    <button
      ref={ref}
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      onPointerEnter={() => hover(true)}
      onPointerLeave={() => hover(false)}
      disabled={!interactive}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: 'translate(-50%, 0)',
        width: 132,
        opacity: reveal,
        pointerEvents: interactive ? 'auto' : 'none',
        textAlign: 'center',
        transition: 'opacity 0.2s',
        zIndex: 12,
      }}
    >
      <div
        style={{
          position: 'relative',
          width: 88,
          height: 88,
          margin: '0 auto',
        }}
      >
        <div
          className="ring"
          style={{
            position: 'absolute',
            inset: -4,
            borderRadius: '50%',
            border: `1.5px solid ${color}`,
            opacity: 0.55,
            boxShadow: `0 0 22px ${color}66`,
          }}
        />
        <div
          className="portrait"
          style={{
            width: 88,
            height: 88,
            borderRadius: '50%',
            overflow: 'hidden',
            background: '#1c1814',
            boxShadow: '0 8px 22px rgba(0,0,0,0.5)',
          }}
        >
          {artist.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={artist.thumbnailUrl}
              alt={artist.name}
              draggable={false}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                filter: 'grayscale(0.15) contrast(1.02)',
              }}
            />
          ) : (
            <div
              className="font-display"
              style={{
                width: '100%',
                height: '100%',
                display: 'grid',
                placeItems: 'center',
                fontSize: 30,
                color: color,
              }}
            >
              {artist.name[0]}
            </div>
          )}
        </div>
      </div>
      <div
        className="font-display"
        style={{
          marginTop: 10,
          fontSize: 17,
          lineHeight: 1.1,
          color: 'var(--ink)',
          fontWeight: 600,
        }}
      >
        {artist.name}
      </div>
      {lifespan && (
        <div
          style={{
            marginTop: 2,
            fontSize: 10.5,
            letterSpacing: '0.06em',
            color: 'var(--ink-dim)',
          }}
        >
          {lifespan}
        </div>
      )}
      <div
        style={{
          marginTop: 3,
          fontSize: 9.5,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: color,
        }}
      >
        {artist.artworkCount} works
      </div>
    </button>
  );
}
