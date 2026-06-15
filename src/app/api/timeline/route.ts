import { NextResponse } from 'next/server';
import { getTimeline } from '@/lib/queries';

export const revalidate = 3600;

export async function GET() {
  const periods = await getTimeline();
  return NextResponse.json({ periods });
}
