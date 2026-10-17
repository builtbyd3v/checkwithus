'use client';

// retry() re-fetches server data; reset() would only re-render the failed payload.
export default function DashboardError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <main className="mx-auto max-w-2xl px-6 py-16">
    <section className="rounded-[28px] border border-family-line bg-white p-8">
      <p className="text-sm font-semibold text-family-blue-deep">Family overview</p>
      <h1 className="mt-3 text-3xl font-semibold">We couldn’t load your dashboard.</h1>
      <p className="mt-4 leading-7 text-family-body">Your payment history isn’t available right now. Try loading it again to see the latest status before making a decision.</p>
      <button onClick={retry} className="mt-6 min-h-12 rounded-lg bg-family-blue px-6 font-semibold text-white hover:bg-family-blue-deep">Try again</button>
    </section>
  </main>;
}
