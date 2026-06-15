import { NextResponse } from 'next/server';
import { getArtist } from '@/lib/queries';

export const revalidate = 3600;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const artist = await getArtist(slug);
  if (!artist) {
    return NextResponse.json({ error: 'Artist not found' }, { status: 404 });
  }
  return NextResponse.json(artist);
}
