import { notFound } from 'next/navigation';
import { DashboardPreview } from './preview';

export const metadata = { title: 'Dashboard gallery | checkwith.us', robots: { index: false, follow: false } };

export default function PreviewPage() {
  // No account, session override or payment service: this is only a local UI fixture.
  if (process.env.NODE_ENV !== 'development') notFound();
  return <DashboardPreview />;
}
