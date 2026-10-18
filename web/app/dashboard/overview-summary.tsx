export type Stat = { label: string; value: string; unit?: string; note: string; href?: string; tone?: 'pause' };

/** The summary numbers. Sized to the tile (cqi) so a total like $12,345.67 never breaks mid-number, at any width or text size. */
export function OverviewSummary({ stats, className = '' }: { stats: Stat[]; className?: string }) {
  return <dl className={`grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(9rem,100%),1fr))] gap-3 sm:grid-cols-2 ${className}`}>
    {stats.map((stat) => {
      const pause = stat.tone === 'pause';
      return <div key={stat.label} className={`@container flex min-w-0 flex-col rounded-[20px] px-5 py-4 ${pause ? 'bg-pause-field text-pause' : 'bg-card'}`}>
        <dt className={`font-medium ${pause ? '' : 'text-muted'}`}>{stat.label}</dt>
        <dd className={`mt-1 font-heading text-[length:min(2.5rem,20cqi)] font-semibold leading-tight tracking-[-.03em] tabular-nums ${pause ? 'text-foreground' : ''}`}>
          {stat.value}{stat.unit && <span className="ml-2 font-sans text-base font-medium tracking-normal text-pause">{stat.unit}</span>}</dd>
        <dd className="mt-auto pt-1">{stat.href
          ? <a href={stat.href} className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">{stat.note}</a>
          : <span className="text-muted">{stat.note}</span>}</dd>
      </div>;
    })}
  </dl>;
}
