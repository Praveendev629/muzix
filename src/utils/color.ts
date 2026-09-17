/**
 * Color helpers used by the custom theme / accent picker and the palette
 * derivation. All input hex colors are `#RRGGBB`.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface Hsl {
  h: number; // 0..360
  s: number; // 0..1
  l: number; // 0..1
}

/** '#RGB', '#RRGGBB' or 'RRGGBB' → 0-255 channels. */
export function hexToRgb(hex: string): Rgb {
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6) return { r: 0, g: 0, b: 0 };
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return { r: 0, g: 0, b: 0 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const to = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

export function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
    else if (max === gn) h = ((bn - rn) / d + 2) * 60;
    else h = ((rn - gn) / d + 4) * 60;
  }
  return { h, s, l };
}

function hue2rgb(p: number, q: number, t: number): number {
  let tt = t;
  if (tt < 0) tt += 1;
  if (tt > 1) tt -= 1;
  if (tt < 1 / 6) return p + (q - p) * 6 * tt;
  if (tt < 1 / 2) return q;
  if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
  return p;
}

export function hslToRgb({ h, s, l }: Hsl): Rgb {
  const hn = ((h % 360) + 360) % 360 / 360;
  let r: number;
  let g: number;
  let b: number;
  if (s <= 0) {
    r = l;
    g = l;
    b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, hn + 1 / 3);
    g = hue2rgb(p, q, hn);
    b = hue2rgb(p, q, hn - 1 / 3);
  }
  return { r: r * 255, g: g * 255, b: b * 255 };
}

export function hslToHex(hsl: Hsl): string {
  return rgbToHex(hslToRgb(hsl));
}

/** '#RRGGBB' → 'rgba(r, g, b, a)' with alpha 0..1. */
export function withAlpha(hex: string, a: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** Linear blend between two colors, t=0 → a, t=1 → b. */
export function mix(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const k = Math.max(0, Math.min(1, t));
  return rgbToHex({
    r: ca.r + (cb.r - ca.r) * k,
    g: ca.g + (cb.g - ca.g) * k,
    b: ca.b + (cb.b - ca.b) * k,
  });
}

export function lighten(hex: string, amount: number): string {
  return mix(hex, '#FFFFFF', amount);
}

export function darken(hex: string, amount: number): string {
  return mix(hex, '#000000', amount);
}

/** Rotate the hue by `deg` while keeping saturation/lightness. */
export function shiftHue(hex: string, deg: number): string {
  const { h, s, l } = rgbToHsl(hexToRgb(hex));
  return hslToHex({ h: ((h + deg) % 360 + 360) % 360, s, l });
}

/** Perceived luminance (0..1); 0.5+ reads as a light surface. */
export function isLight(hex: string): boolean {
  const { r, g, b } = hexToRgb(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.55;
}

/** Derive the app's four neon accent shades from a single base color. */
export function deriveAccent(base: string): { purple: string; purpleBright: string; pink: string; magenta: string } {
  const { h, s, l } = rgbToHsl(hexToRgb(base));
  return {
    purple: base,
    purpleBright: hslToHex({ h, s, l: Math.min(0.92, l + 0.22) }),
    pink: hslToHex({ h: ((h - 40) % 360 + 360) % 360, s: Math.min(1, s * 1.1 + 0.05), l }),
    magenta: hslToHex({ h: ((h + 22) % 360 + 360) % 360, s: Math.min(1, s + 0.08), l }),
  };
}