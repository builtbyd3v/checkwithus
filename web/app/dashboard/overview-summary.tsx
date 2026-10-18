export type Stat = { label: string; value: string; unit?: string; note: string; href?: string; tone?: 'pause' };

/** The summary numbers. Sized to the tile (cqi) so a total like $12,345.67 never breaks mid-number, at any width or text size. */
export function OverviewSummary({ stats, className = '' }: { stats: Stat[]; className?: string }) {
  return <dl className={`grid min-w-0 grid-cols-2 gap-2 sm:gap-3 ${className}`}>
    {stats.map((stat) => {
      const pause = stat.tone === 'pause';
      return <div key={stat.label} className={`@container flex min-w-0 flex-col rounded-[14px] px-3 py-2.5 sm:min-h-[11.5rem] sm:rounded-[20px] sm:px-[22px] sm:py-5 ${pause ? 'bg-pause-field' : 'bg-card'}`}>
        <dt className={`text-[0.8125rem] font-medium leading-tight sm:text-sm ${pause ? 'text-pause' : 'text-muted'}`}>{stat.label}</dt>
        <dd className="mt-1.5 text-[length:min(1.375rem,16cqi)] font-semibold leading-[1.15] tracking-[-.03em] tabular-nums sm:text-[length:min(2.5rem,20cqi)]">
          {stat.value}{stat.unit && <span className="ml-2 text-base font-medium tracking-normal text-pause">{stat.unit}</span>}</dd>
        <dd className="mt-auto pt-1 text-sm">{stat.href
          ? <a href={stat.href} className="-mx-2 inline-flex min-h-11 items-center rounded-full px-2 text-base font-semibold text-pause hover:bg-pause/10">{stat.note}</a>
          : <span className="text-muted">{stat.note}</span>}</dd>
      </div>;
    })}
  </dl>;
}
