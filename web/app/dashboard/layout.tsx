import Link from 'next/link';
import type { ReactNode } from 'react';
import { Logo } from './logo';

const shell = [
  'min-h-screen bg-background font-sans text-foreground selection:bg-action/25',
  '[&_h1]:font-heading [&_h2]:font-heading [&_h3]:font-heading [&_h1]:tracking-[-.03em] [&_h2]:tracking-[-.02em] [&_h3]:tracking-[-.015em]',
  '[&_:focus-visible]:outline-3 [&_:focus-visible]:outline-action [&_:focus-visible]:outline-offset-4',
  '[&_input]:accent-action',
  '[&_button]:transition-colors [&_a]:transition-colors [&_button]:duration-150 [&_a]:duration-150 motion-reduce:[&_button]:transition-none motion-reduce:[&_a]:transition-none',
  '[&_h1]:[overflow-wrap:anywhere] [&_h2]:[overflow-wrap:anywhere] [&_h3]:[overflow-wrap:anywhere] [&_dd]:[overflow-wrap:anywhere]',
  '[&_article_strong]:max-w-full [&_article_strong]:[overflow-wrap:anywhere]',
  '[&_form_button]:min-w-[min(7rem,100%)] [&_form_button]:max-w-full',
].join(' ');
const navLink = 'inline-flex min-h-11 items-center rounded-full px-4 font-semibold text-muted hover:bg-surface hover:text-foreground';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <div className={shell}>
    <a className="absolute left-2 top-2 z-50 -translate-y-[180%] rounded-xl bg-card p-3 focus:translate-y-0" href="#family-content">Skip to dashboard</a>
    <header className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-8 gap-y-2 px-4 py-4 sm:px-10">
      <Link href="/dashboard" className="flex min-h-11 items-center gap-2.5 font-heading text-xl font-bold tracking-[-.03em]">
        <Logo className="size-8" />checkwith.us</Link>
      <nav aria-label="Dashboard" className="hidden gap-1 md:flex">
        <Link className={navLink} href="/dashboard">Overview</Link>
        <Link className={navLink} href="/dashboard#activity">Activity</Link>
        <Link className={navLink} href="/dashboard#payees">Payees</Link>
        <Link className={navLink} href="/dashboard#setup">Family</Link>
      </nav>
      <a href="/auth/logout" className={`${navLink} ml-auto`}>Sign out</a>
    </header>
    <div id="family-content" tabIndex={-1} className="min-w-0">{children}</div>
  </div>;
}
