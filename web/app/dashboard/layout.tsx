import Link from 'next/link';
import { Suspense, type ReactNode } from 'react';
import { Logo } from './logo';

const shell = [
  'min-h-screen bg-surface font-sans text-foreground selection:bg-action/25 dark:bg-background',
  '[&_h1]:font-heading [&_h2]:font-heading [&_h3]:font-heading [&_h4]:font-heading [&_h1]:tracking-[-.025em] [&_h2]:tracking-[-.02em] [&_h3]:tracking-[-.02em] [&_h4]:tracking-[-.02em]',
  '[&_:focus-visible]:outline-3 [&_:focus-visible]:outline-action [&_:focus-visible]:outline-offset-3',
  '[&_input]:accent-action',
  '[&_button]:transition-[color,background-color,scale] [&_a]:transition-colors [&_button]:duration-150 [&_a]:duration-150 [&_button]:ease-out-soft motion-reduce:[&_button]:transition-none motion-reduce:[&_a]:transition-none',
  '[&_button:active:not(:disabled)]:scale-[.98] motion-reduce:[&_button:active:not(:disabled)]:scale-100',
  '[&_h1]:[overflow-wrap:anywhere] [&_h2]:[overflow-wrap:anywhere] [&_h3]:[overflow-wrap:anywhere] [&_dd]:[overflow-wrap:anywhere]',
  '[&_article_strong]:max-w-full [&_article_strong]:[overflow-wrap:anywhere]',
  '[&_form_button]:min-w-[min(7rem,100%)] [&_form_button]:max-w-full',
].join(' ');
const navLink = 'inline-flex min-h-11 items-center rounded-full px-3.5 font-medium text-muted hover:bg-card hover:text-foreground';

/** The signed-in family member, from the Auth0 session. Nothing in the local preview, which has no session. */
async function Approver() {
  try {
    const { auth0 } = await import('@/lib/auth0/web');
    const user = (await auth0.getSession())?.user;
    const name = user?.name ?? user?.nickname ?? user?.email;
    if (!name) return null;
    return <span title={`Signed in as ${name}`} className="inline-grid size-10 shrink-0 place-items-center rounded-full bg-action font-bold text-white">
      <span aria-hidden="true">{name.trim().charAt(0).toUpperCase()}</span><span className="sr-only">Signed in as {name}</span></span>;
  } catch {
    return null;
  }
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <div className={shell}>
    <a className="absolute left-2 top-2 z-50 -translate-y-[180%] rounded-xl bg-card p-3 focus:translate-y-0" href="#family-content">Skip to dashboard</a>
    <header className="mx-auto flex min-h-14 max-w-[1280px] flex-wrap items-center gap-x-10 gap-y-2 px-4 py-2 sm:min-h-[76px] sm:px-10">
      <Link href="/dashboard" className="flex min-h-11 items-center gap-2.5 font-heading text-lg font-extrabold tracking-[-.02em] sm:text-xl">
        <Logo className="size-[26px] sm:size-[30px]" />checkwith.us</Link>
      <nav aria-label="Dashboard" className="hidden gap-1 md:flex">
        <Link className={`${navLink} bg-card font-semibold text-foreground`} aria-current="page" href="/dashboard">Overview</Link>
        <Link className={navLink} href="/dashboard#activity">Activity</Link>
        <Link className={navLink} href="/dashboard#payees">Payees</Link>
        <Link className={navLink} href="/dashboard#setup">Family</Link>
      </nav>
      <div className="ml-auto flex items-center gap-2">
        <a href="/auth/logout" className={navLink}>Sign out</a>
        <Suspense fallback={null}><Approver /></Suspense>
      </div>
    </header>
    <div id="family-content" tabIndex={-1} className="min-w-0">{children}</div>
  </div>;
}
