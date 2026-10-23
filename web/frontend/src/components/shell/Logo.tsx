/* eslint-disable @next/next/no-img-element */
/** Brand mark from /branding plus the wordmark set in Poppins Bold, the brand typeface. */
export function Logo({ light = false, size = 44 }: { light?: boolean; size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        className={light ? "flex items-center justify-center rounded-lg bg-white" : "flex items-center justify-center"}
        style={{ width: size, height: size }}
      >
        <img src="/origo-mark.svg" alt="" width={size * 0.86} height={size * 0.86} />
      </span>
      <span className={`text-2xl font-bold tracking-wide ${light ? "text-white" : "text-[#1f5e3b]"}`}>origo</span>
    </span>
  );
}
