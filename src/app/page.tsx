import { getTimeline } from '@/lib/queries';
import { hasDatabase } from '@/db';
import Museum from '@/components/Museum';

export default async function Home() {
  const periods = await getTimeline();
  return <Museum periods={periods} live={hasDatabase} />;
}
