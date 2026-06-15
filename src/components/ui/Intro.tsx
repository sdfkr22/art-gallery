'use client';

import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';

export default function Intro({ live }: { live: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [gone, setGone] = useState(false);

  const dismiss = () => {
    if (!ref.current || gone) return;
    gsap.to(ref.current, {
      opacity: 0,
      duration: 1,
      ease: 'power2.inOut',
      onComplete: () => setGone(true),
    });
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const q = gsap.utils.selector(el);
    gsap
      .timeline()
      .from(q('.intro-kicker'), { opacity: 0, y: 16, duration: 1 })
      .from(q('.intro-title'), { opacity: 0, y: 24, duration: 1.2 }, '-=0.6')
      .from(q('.intro-sub'), { opacity: 0, y: 16, duration: 1 }, '-=0.7')
      .from(q('.intro-hint'), { opacity: 0, duration: 1 }, '-=0.4');
    const t = window.setTimeout(dismiss, 7000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (gone) return null;

  return (
    <div
      ref={ref}
      onClick={dismiss}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 40,
        display: 'grid',
        placeItems: 'center',
        textAlign: 'center',
        cursor: 'pointer',
        background:
          'radial-gradient(120% 120% at 50% 45%, #14110f 0%, #0c0b0a 70%)',
      }}
    >
      <div style={{ maxWidth: 720, padding: 24 }}>
        <div
          className="intro-kicker"
          style={{
            letterSpacing: '0.42em',
            textTransform: 'uppercase',
            fontSize: 12,
            color: 'var(--gold)',
            marginBottom: 24,
          }}
        >
          Wikimedia Commons · {live ? 'Live archive' : 'Curated preview'}
        </div>
        <h1
          className="intro-title font-display"
          style={{
            fontSize: 'clamp(48px, 8vw, 104px)',
            fontWeight: 600,
            lineHeight: 1,
            color: 'var(--ink)',
          }}
        >
          The Infinite Gallery
        </h1>
        <p
          className="intro-sub"
          style={{
            marginTop: 22,
            fontSize: 'clamp(15px, 2vw, 19px)',
            color: 'var(--ink-dim)',
            lineHeight: 1.6,
            fontWeight: 300,
          }}
        >
          Eight centuries of art on a single timeline. Zoom into a movement,
          choose a master, and walk through a gallery of their work.
        </p>
        <div
          className="intro-hint"
          style={{
            marginTop: 44,
            fontSize: 13,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: 'var(--gold)',
          }}
        >
          Click to enter
        </div>
      </div>
    </div>
  );
}
