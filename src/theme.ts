export const colors = {
  background: '#ffffff',
  surface: '#fafafa',
  border: '#dbdbdb',
  text: '#262626',
  textMuted: '#737373',
  link: '#00376b',
  primary: '#0095f6',
  like: '#ed4956',
  storySeen: '#c7c7c7',
  overlay: 'rgba(0,0,0,0.65)',
};

export const storyGradient = ['#feda75', '#fa7e1e', '#d62976', '#962fbf', '#4f5bd5'] as const;
export const seenGradient = ['#c7c7c7', '#c7c7c7'] as const;

export const layout = {
  feedMaxWidth: 470,
  profileMaxWidth: 935,
  sidebarWidth: 244,
  sidebarCompactWidth: 72,
  desktopBreakpoint: 1024,
  tabletBreakpoint: 768,
  /** Minimum window width at which the "suggestions" column is shown next to the feed. */
  suggestionsBreakpoint: 1160,
};
