import Image from 'next/image';

/** The brand mark: the original app icon as a rounded tile. Decorative, since the wordmark sits next to it. */
export function Logo({ className = '' }: { className?: string }) {
  return <Image src="/app-icon.png" alt="" width={30} height={30} priority
    className={`block shrink-0 rounded-[22.5%] bg-white object-cover dark:shadow-[0_0_0_1px_rgb(255_255_255/.14)] ${className}`} />;
}
