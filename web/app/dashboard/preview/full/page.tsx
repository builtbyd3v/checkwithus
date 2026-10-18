import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { FullPreview } from './full';

export const metadata = { title: 'Dashboard preview | checkwith.us', robots: { index: false, follow: false } };

export default function FullPreviewPage() {
  // No account, session override or payment service: this is only a local UI fixture.
  if (process.env.NODE_ENV !== 'development') notFound();
  return <Suspense><Fixture /></Suspense>;
}

async function Fixture() {
  await connection();
  // Times come from the server once, so the first render and hydration agree.
  const now = new Date();
  return <FullPreview nowIso={now.toISOString()} expiresAt={new Date(now.getTime() + 14.5 * 60_000).toISOString()} />;
}
