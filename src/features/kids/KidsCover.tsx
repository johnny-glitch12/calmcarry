import { type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

/**
 * KidsCover — soft, child-friendly vector cover art for Kids Mode. The adult library
 * uses moody watercolour photography (dark seas, storms) that reads as anything but
 * cuddly to a small child; kids get these instead: rounded, smiling, cozy little
 * bedtime scenes in the "cozy dusk" palette (sleepy moon, a little boat, a friendly
 * star, a cloud, a snoozing bear). Pure SVG so they scale crisply at any tile size,
 * and it's our own honest art (no fake photos). Adults never see these.
 */

export type KidsScene = 'moon' | 'boat' | 'star' | 'cloud' | 'bear';

// cozy-dusk sky + warm characters (kidsDusk palette)
const SKY_TOP = '#33544C';
const SKY_BOT = '#1B302C';
const CREAM = '#F3F6EE';
const PEACH = '#F1C7A3';
const SAGE = '#9AD6C4';
const DEEP = '#15302B';
const CHEEK = 'rgba(241,199,163,0.55)';

/** which cozy scene a kids-visible track shows (falls back to the sleepy moon). */
const SCENE_BY_TRACK: Record<string, KidsScene> = {
  penguin: 'boat', // "Ocean for Little Ones"
  'slow-tide': 'boat',
  shoreline: 'boat',
  gymnopedie: 'star',
  spa: 'star',
  'brown-noise': 'bear',
  'deep-brown': 'bear',
  forest: 'bear',
  rainfall: 'cloud',
  'rain-window': 'cloud',
  womb: 'moon',
  heartbeat: 'moon',
  shush: 'moon',
};
export function sceneForTrack(id: string): KidsScene {
  return SCENE_BY_TRACK[id] ?? 'moon';
}

// a gentle closed "sleepy" eye — a shallow downward arc, like the bear mascot's
const eye = (x: number, y: number) => `M${x - 2.4} ${y}q2.4 2.6 4.8 0`;
const smile = (x: number, y: number) => `M${x - 3} ${y}q3 3 6 0`;

function Sky() {
  return (
    <>
      <Defs>
        <LinearGradient id="kidsky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={SKY_TOP} />
          <Stop offset="1" stopColor={SKY_BOT} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100" height="100" fill="url(#kidsky)" />
    </>
  );
}

function Stars({ dense }: { dense?: boolean }) {
  const pts: [number, number, number][] = dense
    ? [[16, 18, 1.4], [82, 14, 1], [72, 26, 1.2], [30, 10, 0.9], [90, 38, 1.1], [10, 40, 1], [50, 8, 0.8], [64, 44, 0.9]]
    : [[18, 20, 1.4], [80, 16, 1], [30, 12, 0.9], [88, 42, 1.1]];
  return (
    <G fill={CREAM} opacity={0.85}>
      {pts.map(([x, y, r], i) => (
        <Circle key={i} cx={x} cy={y} r={r} />
      ))}
    </G>
  );
}

function Moon() {
  return (
    <G>
      <Circle cx="50" cy="46" r="24" fill={CREAM} />
      <Path d={eye(43, 46)} stroke={DEEP} strokeWidth={1.6} strokeLinecap="round" fill="none" />
      <Path d={eye(57, 46)} stroke={DEEP} strokeWidth={1.6} strokeLinecap="round" fill="none" />
      <Circle cx="40" cy="52" r="3.2" fill={CHEEK} />
      <Circle cx="60" cy="52" r="3.2" fill={CHEEK} />
      <Path d={smile(47, 54)} stroke={DEEP} strokeWidth={1.6} strokeLinecap="round" fill="none" />
      {/* little zzz */}
      <Path d="M74 24h6l-6 6h6" stroke={PEACH} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </G>
  );
}

function Star() {
  return (
    <G>
      <Path
        d="M50 24l6.6 13.4 14.8 2.1-10.7 10.4 2.5 14.7L50 57.8 36.8 64.7l2.5-14.7L28.6 39.6l14.8-2.1z"
        fill={PEACH}
      />
      <Path d={eye(45, 44)} stroke={DEEP} strokeWidth={1.6} strokeLinecap="round" fill="none" />
      <Path d={eye(56, 44)} stroke={DEEP} strokeWidth={1.6} strokeLinecap="round" fill="none" />
      <Path d={smile(47.5, 50)} stroke={DEEP} strokeWidth={1.6} strokeLinecap="round" fill="none" />
    </G>
  );
}

function Cloud() {
  return (
    <G>
      <Circle cx="60" cy="18" r="9" fill={CREAM} opacity={0.9} />
      {/* fluffy cloud */}
      <G fill={CREAM}>
        <Circle cx="38" cy="48" r="14" />
        <Circle cx="56" cy="46" r="16" />
        <Circle cx="68" cy="52" r="11" />
        <Rect x="34" y="50" width="38" height="14" rx="7" />
      </G>
      <Path d={eye(45, 50)} stroke={DEEP} strokeWidth={1.6} strokeLinecap="round" fill="none" />
      <Path d={eye(58, 50)} stroke={DEEP} strokeWidth={1.6} strokeLinecap="round" fill="none" />
      <Path d={smile(48, 56)} stroke={DEEP} strokeWidth={1.4} strokeLinecap="round" fill="none" />
      {/* soft rain */}
      <G stroke={SAGE} strokeWidth={2.2} strokeLinecap="round">
        <Path d="M42 70v6" />
        <Path d="M54 72v6" />
        <Path d="M66 70v6" />
      </G>
    </G>
  );
}

function Boat() {
  return (
    <G>
      <Circle cx="76" cy="22" r="10" fill={CREAM} />
      {/* sail + hull */}
      <Path d="M50 30l16 22H50z" fill={CREAM} />
      <Path d="M48 30l-14 22h14z" fill={SAGE} />
      <Path d="M48 26v28" stroke={DEEP} strokeWidth={1.6} strokeLinecap="round" />
      <Path d="M30 56h40l-6 10H36z" fill={PEACH} />
      {/* calm waves */}
      <G stroke={SAGE} strokeWidth={2.4} strokeLinecap="round" fill="none" opacity={0.9}>
        <Path d="M6 78q8-5 16 0t16 0 16 0 16 0 16 0" />
        <Path d="M6 88q8-5 16 0t16 0 16 0 16 0 16 0" opacity={0.6} />
      </G>
    </G>
  );
}

function Bear() {
  return (
    <G>
      {/* ears */}
      <Circle cx="34" cy="30" r="10" fill={SAGE} />
      <Circle cx="66" cy="30" r="10" fill={SAGE} />
      <Circle cx="34" cy="30" r="4.5" fill={CREAM} />
      <Circle cx="66" cy="30" r="4.5" fill={CREAM} />
      {/* head */}
      <Circle cx="50" cy="50" r="26" fill={SAGE} />
      <Ellipse cx="50" cy="56" rx="15" ry="12" fill={CREAM} />
      <Path d={eye(42, 48)} stroke={DEEP} strokeWidth={1.8} strokeLinecap="round" fill="none" />
      <Path d={eye(58, 48)} stroke={DEEP} strokeWidth={1.8} strokeLinecap="round" fill="none" />
      <Circle cx="38" cy="54" r="3.4" fill={CHEEK} />
      <Circle cx="62" cy="54" r="3.4" fill={CHEEK} />
      <Ellipse cx="50" cy="53" rx="2.6" ry="2" fill={DEEP} />
      <Path d="M50 55v2.5M50 57.5q-3 2-6 0M50 57.5q3 2 6 0" stroke={DEEP} strokeWidth={1.5} strokeLinecap="round" fill="none" />
    </G>
  );
}

const SCENES: Record<KidsScene, () => React.ReactElement> = {
  moon: () => (
    <>
      <Stars />
      <Moon />
    </>
  ),
  star: () => (
    <>
      <Stars dense />
      <Star />
    </>
  ),
  cloud: () => (
    <>
      <Stars />
      <Cloud />
    </>
  ),
  boat: () => (
    <>
      <Stars />
      <Boat />
    </>
  ),
  bear: () => (
    <>
      <Stars />
      <Bear />
    </>
  ),
};

export function KidsCover({ scene = 'moon', style }: { scene?: KidsScene; style?: ViewStyle }) {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" style={style}>
      <Sky />
      {SCENES[scene]()}
    </Svg>
  );
}
