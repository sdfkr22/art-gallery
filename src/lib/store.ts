'use client';

import { create } from 'zustand';

export type View = 'timeline' | 'gallery';

interface MuseumState {
  view: View;
  /** Slug of the artist whose gallery is open (or being opened). */
  artistSlug: string | null;
  /** True while a GSAP transition between views is running. */
  transitioning: boolean;

  openGallery: (slug: string) => void;
  closeGallery: () => void;
  setTransitioning: (v: boolean) => void;
}

export const useMuseum = create<MuseumState>((set) => ({
  view: 'timeline',
  artistSlug: null,
  transitioning: false,

  openGallery: (slug) => set({ artistSlug: slug, view: 'gallery' }),
  closeGallery: () => set({ view: 'timeline' }),
  setTransitioning: (v) => set({ transitioning: v }),
}));
