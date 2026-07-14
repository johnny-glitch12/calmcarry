import Svg, { Circle, Path } from 'react-native-svg';

/**
 * CalmCarry's own tab iconography - hand-drawn geometric vectors on the brand's
 * language (the orb's circle, a 24pt grid, 1.8 stroke, rounded caps), replacing
 * the stock Feather set where identity matters most. Each glyph says what the
 * tab IS in this app, not a generic metaphor:
 *   home      - the orb at rest on a horizon (your room, tonight)
 *   library   - three shelf rows, longest first (the collection)
 *   listen    - three fader stems with knobs (the sound machine itself)
 *   community - two circles sharing space (together, anonymous)
 *   profile   - a person drawn from the orb's own circle
 */
type IconProps = { size?: number; color: string; strokeWidth?: number };

const base = { fill: 'none' as const, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

export function HomeIcon({ size = 22, color, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={10} r={5.4} stroke={color} strokeWidth={strokeWidth} {...base} />
      <Path d="M3.5 19h17" stroke={color} strokeWidth={strokeWidth} {...base} />
    </Svg>
  );
}

export function LibraryIcon({ size = 22, color, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M4 6.5h16" stroke={color} strokeWidth={strokeWidth} {...base} />
      <Path d="M4 12h11.5" stroke={color} strokeWidth={strokeWidth} {...base} />
      <Path d="M4 17.5h7" stroke={color} strokeWidth={strokeWidth} {...base} />
    </Svg>
  );
}

export function ListenIcon({ size = 22, color, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M6 4.5v15" stroke={color} strokeWidth={strokeWidth} {...base} />
      <Path d="M12 4.5v15" stroke={color} strokeWidth={strokeWidth} {...base} />
      <Path d="M18 4.5v15" stroke={color} strokeWidth={strokeWidth} {...base} />
      <Circle cx={6} cy={14.5} r={2.1} fill={color} stroke="none" />
      <Circle cx={12} cy={8.5} r={2.1} fill={color} stroke="none" />
      <Circle cx={18} cy={12} r={2.1} fill={color} stroke="none" />
    </Svg>
  );
}

export function CommunityIcon({ size = 22, color, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={9} cy={12} r={5.2} stroke={color} strokeWidth={strokeWidth} {...base} />
      <Circle cx={15.6} cy={12} r={5.2} stroke={color} strokeWidth={strokeWidth} {...base} />
    </Svg>
  );
}

export function ProfileIcon({ size = 22, color, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={8.2} r={3.4} stroke={color} strokeWidth={strokeWidth} {...base} />
      <Path d="M5.4 19.5c0-3.5 3-5.7 6.6-5.7s6.6 2.2 6.6 5.7" stroke={color} strokeWidth={strokeWidth} {...base} />
    </Svg>
  );
}

export const TAB_ICONS = {
  index: HomeIcon,
  sounds: LibraryIcon,
  listen: ListenIcon,
  community: CommunityIcon,
  you: ProfileIcon,
} as const;
