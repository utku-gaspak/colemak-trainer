/**
 * Colour themes. Each theme is one palette; `themeTokens` turns it into the
 * CSS custom properties the stylesheet reads, so a theme can't forget a token.
 *
 * Mapping conventions (kept consistent across themes):
 * - `muted` is the colour of not-yet-typed text, so it must stay readable on
 *   `surface`. Where a theme's own "comment" colour is too faint for that,
 *   the next brighter step from the same theme is used.
 * - `fingers` = [pinky, ring, middle, index, thumb] = theme's
 *   blue, orange, green/teal, yellow, pink/purple, in that fixed order.
 */

export type ThemeKind = 'light' | 'dark';

export interface Palette {
  name: string;
  kind: ThemeKind;
  bg: string;
  surface: string;
  surface2: string;
  border: string;
  text: string;
  text2: string;
  muted: string;
  accent: string;
  ok: string;
  bad: string;
  fingers: readonly [pinky: string, ring: string, middle: string, index: string, thumb: string];
  /** Heatmap ramp ends; derived from `fingers[0]` (blue) when omitted. */
  heatLo?: string;
  heatHi?: string;
}

export const THEMES = {
  light: {
    name: 'Light',
    kind: 'light',
    bg: '#f6f5f2', surface: '#fcfcfb', surface2: '#efeee9', border: '#dddcd5',
    text: '#0b0b0b', text2: '#52514e', muted: '#7d7c76', accent: '#2a78d6',
    ok: '#1d8a4c', bad: '#d23a3a',
    fingers: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4'],
    heatLo: '#cde2fb', heatHi: '#0d366b',
  },
  dark: {
    name: 'Dark',
    kind: 'dark',
    bg: '#121211', surface: '#1a1a19', surface2: '#242422', border: '#33332f',
    text: '#ffffff', text2: '#c3c2b7', muted: '#8c8b83', accent: '#3987e5',
    ok: '#4cc27f', bad: '#ff6b6b',
    fingers: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181'],
    heatLo: '#1b2a3e', heatHi: '#9ec5f4',
  },
  'catppuccin-mocha': {
    name: 'Catppuccin Mocha',
    kind: 'dark',
    bg: '#181825', surface: '#1e1e2e', surface2: '#313244', border: '#45475a',
    text: '#cdd6f4', text2: '#bac2de', muted: '#7f849c', accent: '#cba6f7',
    ok: '#a6e3a1', bad: '#f38ba8',
    fingers: ['#89b4fa', '#fab387', '#94e2d5', '#f9e2af', '#f5c2e7'],
  },
  'catppuccin-macchiato': {
    name: 'Catppuccin Macchiato',
    kind: 'dark',
    bg: '#1e2030', surface: '#24273a', surface2: '#363a4f', border: '#494d64',
    text: '#cad3f5', text2: '#b8c0e0', muted: '#8087a2', accent: '#c6a0f6',
    ok: '#a6da95', bad: '#ed8796',
    fingers: ['#8aadf4', '#f5a97f', '#8bd5ca', '#eed49f', '#f5bde6'],
  },
  'catppuccin-frappe': {
    name: 'Catppuccin Frappé',
    kind: 'dark',
    bg: '#292c3c', surface: '#303446', surface2: '#414559', border: '#51576d',
    text: '#c6d0f5', text2: '#b5bfe2', muted: '#838ba7', accent: '#ca9ee6',
    ok: '#a6d189', bad: '#e78284',
    fingers: ['#8caaee', '#ef9f76', '#81c8be', '#e5c890', '#f4b8e4'],
  },
  'catppuccin-latte': {
    name: 'Catppuccin Latte',
    kind: 'light',
    bg: '#e6e9ef', surface: '#eff1f5', surface2: '#dce0e8', border: '#ccd0da',
    text: '#4c4f69', text2: '#5c5f77', muted: '#6c6f85', accent: '#8839ef',
    ok: '#40a02b', bad: '#d20f39',
    fingers: ['#1e66f5', '#fe640b', '#179299', '#df8e1d', '#ea76cb'],
  },
  dracula: {
    name: 'Dracula',
    kind: 'dark',
    bg: '#21222c', surface: '#282a36', surface2: '#343746', border: '#44475a',
    text: '#f8f8f2', text2: '#d6d6e0', muted: '#7c86b8', accent: '#bd93f9',
    ok: '#50fa7b', bad: '#ff5555',
    fingers: ['#8be9fd', '#ffb86c', '#50fa7b', '#f1fa8c', '#ff79c6'],
  },
  nord: {
    name: 'Nord',
    kind: 'dark',
    bg: '#242933', surface: '#2e3440', surface2: '#3b4252', border: '#434c5e',
    text: '#eceff4', text2: '#d8dee9', muted: '#8590a8', accent: '#88c0d0',
    ok: '#a3be8c', bad: '#bf616a',
    fingers: ['#81a1c1', '#d08770', '#8fbcbb', '#ebcb8b', '#b48ead'],
  },
  'gruvbox-dark': {
    name: 'Gruvbox Dark',
    kind: 'dark',
    bg: '#1d2021', surface: '#282828', surface2: '#3c3836', border: '#504945',
    text: '#ebdbb2', text2: '#d5c4a1', muted: '#928374', accent: '#fabd2f',
    ok: '#b8bb26', bad: '#fb4934',
    fingers: ['#83a598', '#fe8019', '#8ec07c', '#fabd2f', '#d3869b'],
  },
  'gruvbox-light': {
    name: 'Gruvbox Light',
    kind: 'light',
    bg: '#f2e5bc', surface: '#fbf1c7', surface2: '#ebdbb2', border: '#d5c4a1',
    text: '#3c3836', text2: '#504945', muted: '#7c6f64', accent: '#076678',
    ok: '#79740e', bad: '#9d0006',
    fingers: ['#076678', '#af3a03', '#427b58', '#b57614', '#8f3f71'],
  },
  'tokyo-night': {
    name: 'Tokyo Night',
    kind: 'dark',
    bg: '#16161e', surface: '#1a1b26', surface2: '#24283b', border: '#2f3549',
    text: '#c0caf5', text2: '#a9b1d6', muted: '#737aa2', accent: '#7aa2f7',
    ok: '#9ece6a', bad: '#f7768e',
    fingers: ['#7aa2f7', '#ff9e64', '#73daca', '#e0af68', '#bb9af7'],
  },
  'one-dark': {
    name: 'One Dark',
    kind: 'dark',
    bg: '#21252b', surface: '#282c34', surface2: '#2c313a', border: '#3e4451',
    text: '#dcdfe4', text2: '#abb2bf', muted: '#7f848e', accent: '#61afef',
    ok: '#98c379', bad: '#e06c75',
    fingers: ['#61afef', '#d19a66', '#56b6c2', '#e5c07b', '#c678dd'],
  },
  'solarized-dark': {
    name: 'Solarized Dark',
    kind: 'dark',
    bg: '#00212b', surface: '#002b36', surface2: '#073642', border: '#0e4552',
    text: '#eee8d5', text2: '#93a1a1', muted: '#6f878f', accent: '#268bd2',
    ok: '#859900', bad: '#dc322f',
    fingers: ['#268bd2', '#cb4b16', '#2aa198', '#b58900', '#d33682'],
  },
  'solarized-light': {
    name: 'Solarized Light',
    kind: 'light',
    bg: '#eee8d5', surface: '#fdf6e3', surface2: '#eee8d5', border: '#ddd6c1',
    text: '#073642', text2: '#586e75', muted: '#6c8088', accent: '#268bd2',
    ok: '#859900', bad: '#dc322f',
    fingers: ['#268bd2', '#cb4b16', '#2aa198', '#b58900', '#d33682'],
  },
  'rose-pine': {
    name: 'Rosé Pine',
    kind: 'dark',
    bg: '#191724', surface: '#1f1d2e', surface2: '#26233a', border: '#403d52',
    text: '#e0def4', text2: '#908caa', muted: '#7f7b98', accent: '#c4a7e7',
    ok: '#9ccfd8', bad: '#eb6f92',
    fingers: ['#9ccfd8', '#ebbcba', '#3e8fb0', '#f6c177', '#c4a7e7'],
  },
  monokai: {
    name: 'Monokai',
    kind: 'dark',
    bg: '#1e1f1c', surface: '#272822', surface2: '#3e3d32', border: '#49483e',
    text: '#f8f8f2', text2: '#cfcfc2', muted: '#8f908a', accent: '#66d9ef',
    ok: '#a6e22e', bad: '#f92672',
    fingers: ['#66d9ef', '#fd971f', '#a6e22e', '#e6db74', '#ae81ff'],
  },
} as const satisfies Record<string, Palette>;

export type NamedThemeId = keyof typeof THEMES;
/** `system` follows the OS light/dark setting using the Light / Dark themes. */
export type ThemeId = 'system' | NamedThemeId;

export const THEME_IDS = Object.keys(THEMES) as NamedThemeId[];

export function isThemeId(v: unknown): v is ThemeId {
  return v === 'system' || (typeof v === 'string' && v in THEMES);
}

export function themeTokens(p: Palette): Record<string, string> {
  const dark = p.kind === 'dark';
  const blue = p.fingers[0];
  return {
    '--bg': p.bg,
    '--surface': p.surface,
    '--surface-2': p.surface2,
    '--border': p.border,
    '--text': p.text,
    '--text-2': p.text2,
    '--muted': p.muted,
    '--accent': p.accent,
    // Text on an accent fill: dark themes have light accents, light themes dark ones.
    '--on-accent': dark ? p.bg : '#ffffff',
    '--cursor': p.accent,
    '--ok': p.ok,
    '--bad': p.bad,
    '--bad-bg': `color-mix(in oklab, ${p.bad} ${dark ? 22 : 16}%, ${p.surface})`,
    '--f-pinky': p.fingers[0],
    '--f-ring': p.fingers[1],
    '--f-middle': p.fingers[2],
    '--f-index': p.fingers[3],
    '--f-thumb': p.fingers[4],
    // Single-hue ramp: near-surface for "low", strong blue for "high".
    '--heat-lo': p.heatLo ?? `color-mix(in oklab, ${blue} 16%, ${p.surface})`,
    '--heat-hi': p.heatHi ?? (dark ? blue : `color-mix(in oklab, ${blue} 70%, black)`),
    '--heat-ink-strong': dark ? p.bg : '#ffffff',
  };
}

export function resolveTheme(id: ThemeId, prefersDark: boolean): Palette {
  if (id === 'system') return prefersDark ? THEMES.dark : THEMES.light;
  return THEMES[id];
}

/**
 * Apply a theme to <html>. For `system`, also follows OS changes live.
 * Returns a cleanup function that removes that listener.
 */
export function applyTheme(id: ThemeId): () => void {
  const root = document.documentElement;
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const paint = () => {
    const p = resolveTheme(id, media.matches);
    for (const [k, v] of Object.entries(themeTokens(p))) root.style.setProperty(k, v);
    root.style.colorScheme = p.kind;
    root.dataset.theme = id;
  };
  paint();
  if (id !== 'system') return () => {};
  media.addEventListener('change', paint);
  return () => media.removeEventListener('change', paint);
}
