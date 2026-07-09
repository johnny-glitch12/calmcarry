import { useWindowDimensions } from 'react-native';

/**
 * Form-factor helpers. CalmCarry is a calm, content-first, single-focus app, so
 * the tablet strategy is the category norm (Calm / Headspace): NOT master-detail,
 * but a CENTERED content column with generous margins so text never edge-stretches
 * on a wide screen, and grids that gain a column. Everything keys off the live
 * window width (via useWindowDimensions) so it reacts to rotation AND to iPad
 * Split-View / Slide-Over resizing, not just the physical device.
 *
 * Breakpoints (dp): phone < 600, tablet >= 600, wide >= 1000. 600 is the Android
 * sw600dp tablet convention; 1000 catches iPad landscape and large Android tabs.
 */
export const BP = { tablet: 600, wide: 1000 } as const;

// Content column caps. A reading/form column stays narrow enough to be comfortable
// even on a huge screen; grid-heavy screens get a wider frame for their columns.
export const CONTENT_MAX = { column: 560, wide: 940 } as const;

export type Responsive = {
  width: number;
  height: number;
  /** >= 600dp: iPad, Android tablets, and resized iPad multitasking panes */
  isTablet: boolean;
  /** >= 1000dp: iPad landscape / large tablets */
  isWide: boolean;
  landscape: boolean;
  /** columns for a tile grid at this width (2 phone, 3 tablet, 4 wide) */
  gridColumns: number;
  /** comfortable horizontal padding — a touch more air on tablets */
  gutter: number;
};

export function useResponsive(): Responsive {
  const { width, height } = useWindowDimensions();
  const isTablet = width >= BP.tablet;
  const isWide = width >= BP.wide;
  return {
    width,
    height,
    isTablet,
    isWide,
    landscape: width > height,
    gridColumns: isWide ? 4 : isTablet ? 3 : 2,
    gutter: isTablet ? 32 : 24,
  };
}
