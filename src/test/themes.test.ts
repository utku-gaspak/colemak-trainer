import { describe, expect, it } from 'vitest';
import css from '../styles/global.css?raw';
import { THEME_IDS, THEMES, themeTokens } from '../themes/themes';

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};

// Colour tokens declared in the CSS :root fallback (fonts and radius aren't themed).
const rootBlock = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')));
const COLOR_TOKENS = [...rootBlock.matchAll(/(--[\w-]+):\s*#/g)].map((m) => m[1]!);

describe.each(THEME_IDS)('theme %s', (id) => {
  const p = THEMES[id];
  it('has readable primary text', () => expect(contrast(p.text, p.surface)).toBeGreaterThanOrEqual(4.5));
  // Untyped words use `muted`: the most-read text in the app.
  it('has readable pending (muted) text', () => expect(contrast(p.muted, p.surface)).toBeGreaterThanOrEqual(3.5));
  it('has visible correct / error colours', () => {
    expect(contrast(p.ok, p.surface)).toBeGreaterThanOrEqual(2.5);
    expect(contrast(p.bad, p.surface)).toBeGreaterThanOrEqual(2.5);
  });
  it('sets every colour token the stylesheet declares', () => {
    const emitted = Object.keys(themeTokens(p));
    for (const token of COLOR_TOKENS) expect(emitted).toContain(token);
  });
});
