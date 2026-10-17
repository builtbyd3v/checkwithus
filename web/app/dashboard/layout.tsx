import Link from 'next/link';
import type { ReactNode } from 'react';

const shell = [
  'min-h-screen bg-family-canvas text-family-ink min-[1100px]:flex',
  '[&_h1]:tracking-[-.035em] [&_h2]:tracking-[-.035em] [&_h3]:tracking-[-.035em]',
  '[&_:focus-visible]:outline-3 [&_:focus-visible]:outline-family-blue [&_:focus-visible]:outline-offset-4',
  '[&_button]:rounded-[10px] [&_input]:rounded-[10px] [&_select]:rounded-[10px] [&_input]:accent-family-blue',
  '[&_button]:transition-colors [&_a]:transition-colors [&_button]:duration-150 [&_a]:duration-150 motion-reduce:[&_button]:transition-none motion-reduce:[&_a]:transition-none',
  '[&_main]:px-[clamp(16px,3vw,32px)] [&_main>section]:min-w-0 [&_article]:p-[clamp(16px,2vw,28px)]',
  '[&_h1]:[overflow-wrap:anywhere] [&_h2]:[overflow-wrap:anywhere] [&_h3]:[overflow-wrap:anywhere] [&_dd]:[overflow-wrap:anywhere]',
  '[&_article_strong]:max-w-full [&_article_strong]:[overflow-wrap:anywhere]',
  '[&_form_button]:min-w-[min(7rem,100%)] [&_form_button]:max-w-full',
  'max-sm:[&_main>section]:px-4 max-sm:[&_dl>div]:min-w-0 max-sm:[&_dl>div]:p-5',
].join(' ');
const navLink = 'flex min-h-12 items-center gap-3 rounded-[10px] px-4 text-[15px] font-semibold text-family-body hover:bg-family-blue-soft hover:text-family-blue-deep';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <div className={shell}>
    <a className="absolute left-2 top-2 z-50 -translate-y-[180%] bg-white p-3 focus:translate-y-0" href="#family-content">Skip to dashboard</a>
    <aside className="sticky top-0 hidden h-screen w-[216px] shrink-0 flex-col border-r border-family-line bg-white px-4 py-8 min-[1100px]:flex" aria-label="Family workspace">
      <Link href="/" className="px-4 text-2xl font-bold tracking-[-.06em]">checkwith<span className="text-family-blue">.us</span></Link>
      <p className="mb-4 mt-12 px-4 text-xs font-semibold uppercase tracking-[.16em] text-family-muted">Your family</p>
      <nav aria-label="Family workspace navigation" className="space-y-2">
        <Link className={`${navLink} bg-family-blue-soft`} href="/dashboard"><span aria-hidden="true">◈</span> Overview</Link>
        <Link className={navLink} href="/dashboard#activity"><span aria-hidden="true">▤</span> Activity</Link>
        <Link className={navLink} href="/dashboard#setup"><span aria-hidden="true">◎</span> Family circle</Link>
      </nav>
      <div className="mt-auto rounded-2xl bg-family-canvas p-4">
        <p className="text-sm font-semibold">A little peace of mind.</p>
        <p className="mt-2 text-sm leading-6 text-family-muted">Clear reasons. Family decisions. One payment at a time.</p>
      </div>
    </aside>
    <div id="family-content" tabIndex={-1} className="min-w-0 flex-1">{children}</div>
  </div>;
}
