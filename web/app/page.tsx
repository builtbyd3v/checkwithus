import Link from 'next/link';

export default function Home() {
  return <main className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8 sm:px-10">
    <header className="flex items-center justify-between border-b border-stone-200 pb-5">
      <span className="text-xl font-bold tracking-tight text-teal-950">checkwith<span className="text-teal-700">.us</span></span>
      <Link className="rounded-lg border border-teal-800 px-4 py-2 font-semibold text-teal-900 hover:bg-teal-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800" href="/auth/login?returnTo=/dashboard">Family sign in</Link>
    </header>
    <div className="grid flex-1 items-center gap-12 py-16 md:grid-cols-[1.2fr_0.8fr]">
      <div>
        <p className="mb-5 text-sm font-bold uppercase tracking-[0.18em] text-teal-800">A safer way to pay</p>
        <h1 className="max-w-2xl text-5xl font-semibold leading-tight tracking-tight text-stone-900 sm:text-6xl">When a payment feels wrong, family can check in.</h1>
        <p className="mt-7 max-w-xl text-lg leading-8 text-stone-600">checkwith.us helps older adults pause risky payments and lets their family respond quickly. The scam check stays on the phone. The final choice stays with people.</p>
        <Link className="mt-9 inline-flex min-h-12 items-center rounded-lg bg-teal-800 px-6 font-semibold text-white hover:bg-teal-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800" href="/auth/login?returnTo=/dashboard">Open family dashboard <span aria-hidden="true" className="ml-3">→</span></Link>
      </div>
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-widest text-stone-500">How it works</p>
        <ol className="mt-6 space-y-7">
          <li className="flex gap-4"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-100 font-bold text-teal-900">1</span><div><h2 className="font-semibold">A payment is checked</h2><p className="mt-1 text-sm leading-6 text-stone-600">Fixed rules and on-device signals flag unusual requests.</p></div></li>
          <li className="flex gap-4"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-100 font-bold text-teal-900">2</span><div><h2 className="font-semibold">Family gets a moment</h2><p className="mt-1 text-sm leading-6 text-stone-600">A risky payment waits while family reviews the reason.</p></div></li>
          <li className="flex gap-4"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-100 font-bold text-teal-900">3</span><div><h2 className="font-semibold">A person decides</h2><p className="mt-1 text-sm leading-6 text-stone-600">No answer in five minutes means the payment is blocked.</p></div></li>
        </ol>
      </div>
    </div>
    <footer className="border-t border-stone-200 py-5 text-sm text-stone-500">Built for families, with privacy at the center.</footer>
  </main>;
}
