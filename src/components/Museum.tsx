'use client';

import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { useMuseum } from '@/lib/store';
import type { PeriodDTO, ArtistWithContext } from '@/lib/types';
import Timeline from './timeline/Timeline';
import GalleryView from './gallery/GalleryView';
import Intro from './ui/Intro';

export default function Museum({
  periods,
  live,
}: {
  periods: PeriodDTO[];
  live: boolean;
}) {
  const { view, artistSlug, closeGallery, setTransitioning } = useMuseum();
  const [artist, setArtist] = useState<ArtistWithContext | null>(null);
  const [loading, setLoading] = useState(false);

  const timelineRef = useRef<HTMLDivElement>(null);
  const galleryRef = useRef<HTMLDivElement>(null);

  // Fetch the artist's full gallery (with artworks) when one is selected.
  useEffect(() => {
    if (view !== 'gallery' || !artistSlug) return;
    let cancelled = false;
    setLoading(true);
    setArtist(null);
    fetch(`/api/artists/${artistSlug}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data: ArtistWithContext) => {
        if (!cancelled) setArtist(data);
      })
      .catch(() => {
        if (!cancelled) closeGallery();
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [view, artistSlug, closeGallery]);

  // Crossfade timeline <-> gallery.
  useEffect(() => {
    const tl = timelineRef.current;
    const gl = galleryRef.current;
    if (!tl || !gl) return;
    setTransitioning(true);
    if (view === 'gallery') {
      gsap.to(tl, { opacity: 0, scale: 1.08, duration: 0.7, ease: 'power2.in' });
      gsap.fromTo(
        gl,
        { opacity: 0 },
        {
          opacity: 1,
          duration: 0.9,
          delay: 0.25,
          ease: 'power2.out',
          onComplete: () => setTransitioning(false),
        },
      );
      tl.style.pointerEvents = 'none';
      gl.style.pointerEvents = 'auto';
    } else {
      gsap.to(gl, { opacity: 0, duration: 0.5, ease: 'power2.in' });
      gsap.to(tl, {
        opacity: 1,
        scale: 1,
        duration: 0.8,
        delay: 0.15,
        ease: 'power2.out',
        onComplete: () => setTransitioning(false),
      });
      tl.style.pointerEvents = 'auto';
      gl.style.pointerEvents = 'none';
    }
  }, [view, setTransitioning]);

  return (
    <main className="vignette" style={{ position: 'relative' }}>
      <div
        ref={timelineRef}
        style={{ position: 'absolute', inset: 0, willChange: 'transform, opacity' }}
      >
        <Timeline periods={periods} />
      </div>

      <div
        ref={galleryRef}
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0,
          pointerEvents: 'none',
        }}
      >
        {view === 'gallery' && (
          <GalleryView
            artist={artist}
            loading={loading}
            onExit={closeGallery}
          />
        )}
      </div>

      <Intro live={live} />
    </main>
  );
}
