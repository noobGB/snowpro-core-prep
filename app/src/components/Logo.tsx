/**
 * The app's mark -- two overlapping hairline-stroke diamonds (rotated squares), evolving the
 * original single-diamond placeholder (a bare div, no facets, no connection to the product) into
 * an actual faceted/crystalline glyph while keeping the same stroke weight and accent-only color
 * language tokens.css already uses everywhere else ("hairline borders, not shadows"). Shared
 * between Sidebar.tsx and MobileTopBar.tsx so the two can't drift apart.
 */

interface LogoProps {
  size?: number;
}

export function Logo({ size = 16 }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect x="9" y="9" width="14" height="14" rx="0.4" transform="rotate(45 16 16)" stroke="var(--accent)" strokeWidth="1.6" />
      <rect x="14" y="8" width="8" height="8" rx="0.4" transform="rotate(45 18 12)" stroke="var(--accent)" strokeWidth="1.6" />
    </svg>
  );
}
