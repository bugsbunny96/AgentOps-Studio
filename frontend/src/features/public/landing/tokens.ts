/**
 * Landing page design tokens.
 * Single source of truth for color, type, radius, and gradient values used
 * across every landing section — change a value here, it updates everywhere.
 */

export const color = {
  bg: '#030712',
  bgSoft: '#0d1524',
  surface: 'rgba(255,255,255,0.03)',
  surfaceHover: 'rgba(255,255,255,0.055)',
  border: 'rgba(255,255,255,0.07)',
  borderStrong: 'rgba(255,255,255,0.12)',

  blue: '#3b82f6',
  blueLight: '#60a5fa',
  violet: '#8b5cf6',
  violetLight: '#a78bfa',
  emerald: '#10b981',
  amber: '#f59e0b',
  orange: '#fb923c',
  red: '#f87171',

  text1: '#f8fafc',
  text2: '#94a3b8',
  // #475569 measured 2.66:1 against `bg` — below WCAG AA's 4.5:1 for normal text.
  // This value clears 4.64:1 while staying in the same slate family.
  text3: '#6b7a94',
} as const;

export const radius = {
  sm: 7,
  md: 9,
  lg: 14,
  xl: 18,
  pill: 999,
} as const;

export const font = {
  // Loaded via <link> in index.html (preconnect + display=swap).
  display: '"Space Grotesk", ui-sans-serif, system-ui, sans-serif',
  body: '"Inter", ui-sans-serif, system-ui, sans-serif',
  // Reserved for system/data readouts (timers, latency, call stats) — not
  // for headings or body copy, or it undercuts the display/body pairing.
  mono: '"JetBrains Mono", ui-monospace, "SF Mono", monospace',
} as const;

/** The one recurring brand gradient — used for headline accents and gradient text. */
export const brandGradient = `linear-gradient(135deg, ${color.text1} 0%, ${color.blueLight} 50%, ${color.violet} 100%)`;
export const brandGradientSolid = `linear-gradient(135deg, ${color.blue}, ${color.violet})`;

export const shadow = {
  card: '0 20px 40px rgba(2,6,20,0.35)',
  glow: `0 0 0 1px rgba(139,92,246,.3), 0 4px 20px rgba(59,130,246,.25)`,
  glowLg: `0 0 0 1px rgba(139,92,246,.3), 0 8px 28px rgba(59,130,246,.3)`,
} as const;

export const maxW = 1100;
