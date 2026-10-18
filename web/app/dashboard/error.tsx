'use client';

// retry() re-fetches server data; reset() would only re-render the failed payload.
export default function DashboardError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <main className="mx-auto max-w-2xl px-4 pb-16 sm:px-6">
    <section className="rounded-3xl bg-surface p-6 sm:p-8">
      <h1 className="text-3xl font-semibold">We couldn’t load your dashboard.</h1>
      <p className="mt-4 leading-7">The payment history isn’t available right now. Try loading it again to see the latest status before making a decision.</p>
      <button onClick={retry} className="mt-6 inline-flex min-h-13 items-center rounded-full bg-action px-6 font-semibold text-white hover:bg-action/90">Try again</button>
    </section>
  </main>;
}
