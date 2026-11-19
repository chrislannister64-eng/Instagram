import { useWindowDimensions } from 'react-native';

import { layout } from '../theme';

export interface Breakpoint {
  width: number;
  height: number;
  /** >= 1024: full sidebar */
  isDesktop: boolean;
  /** 768–1023: compact (icon-only) sidebar */
  isTablet: boolean;
  /** < 768: bottom tab bar */
  isMobile: boolean;
}

export function useBreakpoint(): Breakpoint {
  const { width, height } = useWindowDimensions();
  return {
    width,
    height,
    isDesktop: width >= layout.desktopBreakpoint,
    isTablet: width >= layout.tabletBreakpoint && width < layout.desktopBreakpoint,
    isMobile: width < layout.tabletBreakpoint,
  };
}
