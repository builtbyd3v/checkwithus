export default function DashboardLoading() {
  return <main className="mx-auto max-w-[1280px] px-4 pb-16 sm:px-10" aria-busy="true" aria-label="Loading family dashboard">
    <p role="status" className="sr-only">Loading your family dashboard…</p>
    <div aria-hidden="true" className="space-y-6">
      <div className="h-72 rounded-[28px] bg-action/10" />
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="h-96 rounded-3xl bg-surface lg:col-span-7" />
        <div className="h-96 rounded-3xl bg-surface lg:col-span-5" />
      </div>
    </div>
  </main>;
}
