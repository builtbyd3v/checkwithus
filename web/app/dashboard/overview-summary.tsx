export function OverviewSummary({ waiting, spending, categories }: { waiting: number; spending: string; categories: number }) {
  return <dl className="mb-8 grid gap-4 sm:grid-cols-3">
    <div className="rounded-[18px] bg-family-ink p-6 text-white">
      <dt className="text-sm text-white/80">Waiting for your family</dt>
      <dd className="mt-3 text-4xl font-semibold tracking-tight tabular-nums">{waiting}<span className="ml-2 text-base font-normal text-white/80">{waiting === 1 ? 'payment' : 'payments'}</span></dd>
      <dd className="mt-4 text-sm text-white/80">A moment to check in.</dd>
    </div>
    <div className="rounded-[18px] border border-family-line bg-white p-6">
      <dt className="text-sm text-family-muted">Spending · last 90 days</dt>
      <dd className="mt-3 text-4xl font-semibold tracking-tight tabular-nums">{spending}</dd>
      <dd className="mt-4 text-sm text-family-muted">From recorded spending history</dd>
    </div>
    <div className="rounded-[18px] border border-family-line bg-white p-6">
      <dt className="text-sm text-family-muted">Spending categories</dt>
      <dd className="mt-3 text-4xl font-semibold tracking-tight tabular-nums">{categories}</dd>
      <dd className="mt-4 text-sm text-family-muted">Everyday spending, in perspective</dd>
    </div>
  </dl>;
}
