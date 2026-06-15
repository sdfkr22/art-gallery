'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { gsap } from 'gsap';
import type { PeriodDTO } from '@/lib/types';
import { useMuseum } from '@/lib/store';
import ArtistCard from './ArtistCard';

interface ViewWindow {
  center: number; // year at horizontal centre
  span: number; // years visible across the width
}

const ARTIST_REVEAL_SPAN = 280; // span (yrs) at which artists begin to appear
const ARTIST_FULL_SPAN = 150; // span at which they're fully shown
const MIN_SPAN = 70;

function fmtYear(y: number) {
  return y < 0 ? `${-y} BCE` : `${y}`;
}

export default function Timeline({ periods }: { periods: PeriodDTO[] }) {
  const openGallery = useMuseum((s) => s.openGallery);

  const bounds = useMemo(() => {
    const min = Math.min(...periods.map((p) => p.startYear)) - 40;
    const max = Math.max(...periods.map((p) => p.endYear)) + 40;
    return { min, max };
  }, [periods]);

  const maxSpan = bounds.max - bounds.min;

  const [size, setSize] = useState({ w: 1280, h: 720 });
  const [view, setView] = useState<ViewWindow>({
    center: (bounds.min + bounds.max) / 2,
    span: maxSpan,
  });
  const viewRef = useRef(view);
  viewRef.current = view;
  const containerRef = useRef<HTMLDivElement>(null);

  // Track container size.
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      setSize({ w: e.contentRect.width, h: e.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const clampView = useCallback(
    (v: ViewWindow): ViewWindow => {
      const span = Math.min(Math.max(v.span, MIN_SPAN), maxSpan);
      const half = span / 2;
      const center = Math.min(
        Math.max(v.center, bounds.min + half),
        bounds.max - half,
      );
      return { center, span };
    },
    [bounds, maxSpan],
  );

  const yearToX = useCallback(
    (year: number) => {
      const start = view.center - view.span / 2;
      return ((year - start) / view.span) * size.w;
    },
    [view, size.w],
  );

  /* ----------------------------- interaction ---------------------------- */

  const tweenRef = useRef<gsap.core.Tween | null>(null);

  const animateTo = useCallback(
    (target: ViewWindow) => {
      tweenRef.current?.kill();
      const obj = { ...viewRef.current };
      const clamped = clampView(target);
      tweenRef.current = gsap.to(obj, {
        center: clamped.center,
        span: clamped.span,
        duration: 1.1,
        ease: 'power3.inOut',
        onUpdate: () => setView({ center: obj.center, span: obj.span }),
      });
    },
    [clampView],
  );

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      tweenRef.current?.kill();
      const rect = containerRef.current!.getBoundingClientRect();
      const cx = (e.clientX - rect.left) / rect.width; // 0..1
      const v = viewRef.current;
      const yearUnder = v.center - v.span / 2 + cx * v.span;
      const factor = Math.exp(e.deltaY * 0.0012);
      const newSpan = Math.min(Math.max(v.span * factor, MIN_SPAN), maxSpan);
      const newCenter = yearUnder - (cx - 0.5) * newSpan;
      setView(clampView({ center: newCenter, span: newSpan }));
    },
    [clampView, maxSpan],
  );

  const drag = useRef<{ x: number; center: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    tweenRef.current?.kill();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, center: viewRef.current.center };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    const v = viewRef.current;
    const dYear = -(dx / size.w) * v.span;
    setView(clampView({ center: drag.current.center + dYear, span: v.span }));
  };
  const endDrag = () => {
    drag.current = null;
  };

  const focusPeriod = useCallback(
    (p: PeriodDTO) => {
      const pad = (p.endYear - p.startYear) * 0.18 + 12;
      animateTo({
        center: (p.startYear + p.endYear) / 2,
        span: p.endYear - p.startYear + pad * 2,
      });
    },
    [animateTo],
  );

  const resetView = useCallback(() => {
    animateTo({ center: (bounds.min + bounds.max) / 2, span: maxSpan });
  }, [animateTo, bounds, maxSpan]);

  // Keyboard: Esc resets to overview.
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && resetView();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [resetView]);

  /* ------------------------------- layout ------------------------------- */

  const axisY = size.h * 0.56;
  const revealT = gsap.utils.clamp(
    0,
    1,
    (ARTIST_REVEAL_SPAN - view.span) / (ARTIST_REVEAL_SPAN - ARTIST_FULL_SPAN),
  );
  const overview = view.span > ARTIST_REVEAL_SPAN;

  // The period nearest the centre of the view gets the spotlight: only its
  // artists are shown, so temporally-overlapping movements don't collide.
  let centeredSlug = '';
  {
    let bestD = Infinity;
    for (const p of periods) {
      // Pure midpoint distance: focusPeriod() centres exactly on a period's
      // midpoint, so that period wins even when several overlap the centre.
      const d = Math.abs((p.startYear + p.endYear) / 2 - view.center);
      if (d < bestD) {
        bestD = d;
        centeredSlug = p.slug;
      }
    }
  }

  // Ruler ticks at a sensible decade/century interval for the current zoom.
  const tickStep =
    view.span > 500 ? 100 : view.span > 200 ? 50 : view.span > 100 ? 25 : 10;
  const ticks: number[] = [];
  const firstTick = Math.ceil((view.center - view.span / 2) / tickStep) * tickStep;
  for (let y = firstTick; y < view.center + view.span / 2; y += tickStep) {
    ticks.push(y);
  }

  // Overlap-aware lane packing for the overview labels. Lanes alternate
  // near/far on each side of the axis; each period is greedily dropped into the
  // first lane whose previous label has cleared, so nothing ever overlaps while
  // labels stay compact and close to the axis.
  const LANE_OFFSETS = [-82, 92, -156, 166, -230, 240];
  const laneOf = new Map<string, number>();
  {
    const laneRight: number[] = [];
    const ordered = [...periods].sort(
      (a, b) => a.startYear + a.endYear - (b.startYear + b.endYear),
    );
    for (const p of ordered) {
      const midX = yearToX((p.startYear + p.endYear) / 2);
      const halfW = Math.max(52, p.name.length * 4.7 + 14);
      const left = midX - halfW;
      let lane = LANE_OFFSETS.findIndex((_, i) => (laneRight[i] ?? -1e9) <= left);
      if (lane === -1) {
        lane = laneRight.indexOf(Math.min(...laneRight));
        if (lane < 0) lane = 0;
      }
      laneRight[lane] = midX + halfW + 18;
      laneOf.set(p.slug, LANE_OFFSETS[lane]);
    }
  }

  return (
    <div
      ref={containerRef}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        cursor: drag.current ? 'grabbing' : 'grab',
        background:
          'radial-gradient(140% 100% at 50% 0%, #181410 0%, #0c0b0a 60%)',
        touchAction: 'none',
        userSelect: 'none',
      }}
    >
      {/* faint horizon glow following the axis */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: axisY - 140,
          height: 280,
          background:
            'linear-gradient(180deg, transparent, rgba(201,162,90,0.05) 50%, transparent)',
          pointerEvents: 'none',
        }}
      />

      {/* central time axis */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: axisY,
          height: 1,
          background:
            'linear-gradient(90deg, transparent, rgba(201,162,90,0.5) 12%, rgba(201,162,90,0.5) 88%, transparent)',
        }}
      />

      {/* ruler ticks */}
      {ticks.map((y) => {
        const x = yearToX(y);
        if (x < -40 || x > size.w + 40) return null;
        return (
          <div
            key={y}
            style={{ position: 'absolute', left: x, top: axisY }}
            aria-hidden
          >
            <div
              style={{
                position: 'absolute',
                top: -5,
                width: 1,
                height: 10,
                background: 'rgba(201,162,90,0.4)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: 12,
                transform: 'translateX(-50%)',
                fontSize: 10,
                color: 'var(--ink-dim)',
                letterSpacing: '0.08em',
                whiteSpace: 'nowrap',
              }}
            >
              {fmtYear(y)}
            </div>
          </div>
        );
      })}

      {/* periods */}
      {periods.map((p, pi) => {
        const x1 = yearToX(p.startYear);
        const x2 = yearToX(p.endYear);
        const w = x2 - x1;
        if (x2 < -200 || x1 > size.w + 200) return null;
        const mid = (x1 + x2) / 2;
        const labelAbove = pi % 2 === 0;
        const isFocus = p.slug === centeredSlug;

        // Overview labels are horizontal, connected to the axis by a thin
        // leader line, and packed into non-overlapping lanes (see laneOf above).
        const laneOffset = laneOf.get(p.slug) ?? -82;
        const labelY = axisY + laneOffset;
        const above = laneOffset < 0;
        const leaderTop = above ? labelY + 26 : axisY;
        const leaderH = above ? axisY - (labelY + 26) : labelY - 26 - axisY;

        return (
          <div key={p.slug} aria-label={p.name}>
            {/* period span bar on the axis */}
            <div
              onClick={() => focusPeriod(p)}
              style={{
                position: 'absolute',
                left: x1,
                top: axisY - 2,
                width: Math.max(w, 2),
                height: 4,
                borderRadius: 2,
                background: p.color,
                boxShadow: `0 0 16px ${p.color}aa`,
                opacity: 0.9,
                cursor: 'pointer',
                zIndex: 4,
              }}
            />
            {/* tinted band behind artists when zoomed in */}
            {revealT > 0 && (
              <div
                style={{
                  position: 'absolute',
                  left: x1,
                  top: axisY + 6,
                  width: Math.max(w, 2),
                  height: size.h - axisY - 6,
                  background: `linear-gradient(180deg, ${p.color}22, transparent 70%)`,
                  opacity: revealT,
                  pointerEvents: 'none',
                  zIndex: 0,
                }}
              />
            )}

            {/* overview: a marker dot on the axis + a thin leader line up/down
                to the staggered horizontal label */}
            {overview && (
              <>
                <div
                  style={{
                    position: 'absolute',
                    left: mid - 3,
                    top: axisY - 3,
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: p.color,
                    boxShadow: `0 0 10px ${p.color}`,
                    zIndex: 4,
                    pointerEvents: 'none',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: mid,
                    top: leaderTop,
                    width: 1,
                    height: Math.max(leaderH, 0),
                    background: `linear-gradient(${above ? 0 : 180}deg, ${p.color}00, ${p.color}99)`,
                    zIndex: 2,
                    pointerEvents: 'none',
                  }}
                />
              </>
            )}

            {/* period title — staggered horizontal labels in overview;
                large + descriptive when a movement is focused */}
            <div
              onClick={() => focusPeriod(p)}
              style={
                overview
                  ? {
                      position: 'absolute',
                      left: mid,
                      top: labelY,
                      transform: 'translate(-50%, -50%)',
                      textAlign: 'center',
                      whiteSpace: 'nowrap',
                      cursor: 'pointer',
                      zIndex: 3,
                    }
                  : isFocus
                    ? {
                        // focused: pin the block's BOTTOM above the axis so the
                        // description grows upward and never reaches the artists
                        position: 'absolute',
                        left: mid,
                        bottom: size.h - axisY + 22,
                        transform: 'translateX(-50%)',
                        textAlign: 'center',
                        cursor: 'pointer',
                        opacity: 1,
                        width: Math.max(Math.min(w * 1.4, 360), 150),
                        zIndex: 5,
                      }
                    : {
                        position: 'absolute',
                        left: mid,
                        top: labelAbove ? axisY - 132 : axisY + 18,
                        transform: 'translateX(-50%)',
                        textAlign: 'center',
                        cursor: 'pointer',
                        opacity:
                          gsap.utils.clamp(0.25, 1, 1 - revealT * 0.15) *
                          (1 - revealT),
                        transition: 'top 0.2s',
                        width: Math.max(Math.min(w * 1.4, 360), 150),
                        zIndex: 3,
                      }
              }
            >
              <div
                className="font-display"
                style={{
                  fontSize: overview
                    ? 'clamp(15px, 1.4vw, 21px)'
                    : 'clamp(26px, 3vw, 44px)',
                  fontWeight: 600,
                  color: 'var(--ink)',
                  lineHeight: 1.05,
                  textShadow: '0 2px 18px rgba(0,0,0,0.6)',
                }}
              >
                {p.name}
              </div>
              <div
                style={{
                  marginTop: overview ? 3 : 4,
                  fontSize: overview ? 9.5 : 11,
                  letterSpacing: overview ? '0.14em' : '0.18em',
                  textTransform: 'uppercase',
                  color: p.color,
                }}
              >
                {fmtYear(p.startYear)} — {fmtYear(p.endYear)}
              </div>
              {!overview && isFocus && (
                <div
                  style={{
                    marginTop: 10,
                    fontSize: 12.5,
                    lineHeight: 1.5,
                    color: 'var(--ink-dim)',
                    opacity: revealT,
                    maxWidth: 340,
                    margin: '10px auto 0',
                    fontWeight: 300,
                  }}
                >
                  {p.description}
                </div>
              )}
            </div>

            {/* artists — only for the centred period */}
            {revealT > 0 &&
              isFocus &&
              p.artists.map((a, ai) => {
                const n = p.artists.length;
                const ax = x1 + ((ai + 0.5) / n) * w;
                if (ax < -120 || ax > size.w + 120) return null;
                const rowY = axisY + 78 + (ai % 2) * 150;
                return (
                  <ArtistCard
                    key={a.slug}
                    artist={a}
                    x={ax}
                    y={rowY}
                    color={p.color}
                    reveal={revealT}
                    interactive={revealT > 0.5}
                    onOpen={() => openGallery(a.slug)}
                  />
                );
              })}
          </div>
        );
      })}

      {/* HUD */}
      <div
        style={{
          position: 'absolute',
          top: 22,
          left: 26,
          fontSize: 12,
          letterSpacing: '0.34em',
          textTransform: 'uppercase',
          color: 'var(--gold)',
        }}
      >
        The Infinite Gallery
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 22,
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: 11,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'var(--ink-dim)',
          textAlign: 'center',
          pointerEvents: 'none',
        }}
      >
        {overview
          ? 'Scroll to zoom · Drag to pan · Click a movement'
          : 'Click an artist to enter their gallery · Esc for overview'}
      </div>

      {!overview && (
        <button
          onClick={resetView}
          style={{
            position: 'absolute',
            top: 20,
            right: 24,
            padding: '9px 18px',
            border: '1px solid var(--line)',
            borderRadius: 999,
            fontSize: 11,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--ink)',
            background: 'rgba(20,17,15,0.6)',
            backdropFilter: 'blur(6px)',
          }}
        >
          ← Overview
        </button>
      )}
    </div>
  );
}
