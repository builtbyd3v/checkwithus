export default function DashboardLoading() {
  return <main className="mx-auto max-w-7xl px-6 py-12" aria-busy="true" aria-label="Loading family dashboard">
    <p role="status" className="text-family-muted">Loading your family dashboard…</p>
    <div aria-hidden="true" className="mt-8 space-y-8">
      <div className="h-12 w-3/4 rounded-lg bg-family-panel" />
      <div className="grid gap-4 sm:grid-cols-3">{[0, 1, 2].map((item) => <div key={item} className="h-44 rounded-[18px] border border-family-line bg-white" />)}</div>
      <div className="h-72 rounded-[28px] bg-family-blue-soft" />
    </div>
  </main>;
}
