import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  RUNNER_JUMP_SECONDS, RUNNER_PLAYER_DEPTH,
  type RunnerItem, type RunnerState,
} from '../utils/relic-runner-core';

const CYAN = '#48F3D1';
const GOLD = '#FFDC82';

// A shared perspective projection keeps obstacle contact at the runner's feet.
export function projectRunnerPoint(lane: number, depth: number, width: number, height: number) {
  const progress = Math.pow(Math.max(0, depth), 1.55);
  const trackWidth = width * (0.18 + progress * 0.74);
  return {
    x: width / 2 + (lane - 1) * trackWidth / 3,
    y: height * (0.13 + progress * 0.83),
    scale: 0.24 + progress * 0.76,
    trackWidth,
  };
}

function Rail({ x1, y1, x2, y2, color, thickness = 2 }: {
  x1: number; y1: number; x2: number; y2: number; color: string; thickness?: number;
}) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return <View style={{
    position: 'absolute', left: (x1 + x2) / 2 - thickness / 2,
    top: (y1 + y2) / 2 - Math.hypot(dx, dy) / 2,
    width: thickness, height: Math.hypot(dx, dy), backgroundColor: color,
    transform: [{ rotate: String(-Math.atan2(dx, dy)) + 'rad' }],
  }} />;
}

function TrackItem({ item, width, height }: { item: RunnerItem; width: number; height: number }) {
  const point = projectRunnerPoint(item.lane, item.depth, width, height);
  const unit = Math.min(62, width * 0.165) * point.scale;
  const hazard = item.kind === 'crate' || item.kind === 'barrier' || item.kind === 'gap';
  const color = item.kind === 'shield' ? CYAN : item.kind === 'magnet' ? '#D89CFF' : GOLD;
  const itemWidth = hazard ? unit * 1.18 : unit * 0.62;
  const itemHeight = item.kind === 'gap' ? unit * 0.3 : item.kind === 'barrier' ? unit * 1.25 : unit * 0.85;
  return (
    <View style={{
      position: 'absolute', left: point.x - itemWidth / 2, top: point.y - itemHeight,
      width: itemWidth, height: itemHeight, zIndex: Math.floor(item.depth * 100),
      alignItems: 'center', justifyContent: 'center',
    }}>
      {item.kind === 'gap' ? (
        <View style={{ width: '100%', height: '100%', borderRadius: 50, backgroundColor: '#030811', borderWidth: 2, borderColor: '#B46CF0' }} />
      ) : item.kind === 'barrier' ? (
        <>
          <View style={[styles.post, { left: 0 }]} /><View style={[styles.post, { right: 0 }]} />
          <View style={styles.crossbar}><Text style={{ color: '#FFF0E8', fontSize: unit * 0.19, fontWeight: '900' }}>SLIDE</Text></View>
        </>
      ) : item.kind === 'crate' ? (
        <LinearGradient colors={['#FFC476', '#B75836']} style={styles.crate}>
          <View style={styles.crateInset}><Ionicons name="chevron-up" color="#FFEFCE" size={unit * 0.4} /></View>
        </LinearGradient>
      ) : (
        <View style={{
          width: itemWidth, height: itemWidth, borderRadius: item.kind === 'shard' ? 5 : itemWidth / 2,
          borderWidth: 2, borderColor: color, backgroundColor: item.kind === 'shard' ? '#B47720' : '#253654',
          alignItems: 'center', justifyContent: 'center',
          transform: [{ rotate: item.kind === 'shard' ? '45deg' : '0deg' }],
        }}>
          <Ionicons name={item.kind === 'shield' ? 'shield-checkmark' : item.kind === 'magnet' ? 'magnet' : 'diamond'}
            color={color} size={itemWidth * 0.66}
            style={{ transform: [{ rotate: item.kind === 'shard' ? '-45deg' : '0deg' }] }} />
        </View>
      )}
    </View>
  );
}

export const RelicRunnerTrack = memo(function RelicRunnerTrack({ game, width, height }: {
  game: RunnerState; width: number; height: number;
}) {
  const feet = projectRunnerPoint(game.lane, RUNNER_PLAYER_DEPTH, width, height);
  const unit = Math.min(52, width * 0.135, height * 0.2);
  const jumpPhase = 1 - game.actionTime / RUNNER_JUMP_SECONDS;
  const jump = game.action === 'jump' ? Math.sin(Math.max(0, jumpPhase) * Math.PI) * Math.min(82, height * 0.24) : 0;
  const slide = game.action === 'slide';
  const stride = game.action === 'run' ? Math.sin(game.distance * 2.8) * 7 : 0;
  const phase = (game.distance / 16) % 1;
  const horizon = height * 0.13;
  const bottom = height * 0.96;
  return (
    <View pointerEvents="none" style={[styles.track, { width, height }]}>
      <LinearGradient colors={['#111C3A', '#193939', '#071A22']} style={StyleSheet.absoluteFill} />
      <View style={{ position: 'absolute', top: -width * 0.05, left: width * 0.33, width: width * 0.34, height: width * 0.34, borderRadius: width, backgroundColor: '#61DBC811', borderWidth: 1, borderColor: '#74F9D81A' }} />
      {Array.from({ length: 7 }, (_, i) => (
        <View key={i} style={{
          position: 'absolute', left: width * ((i * 0.167 + 0.04) % 1), top: horizon * (0.15 + (i % 3) * 0.2),
          width: 2, height: 2, borderRadius: 2, backgroundColor: '#D8FFF3', opacity: 0.3 + (i % 3) * 0.2,
        }} />
      ))}
      <View style={{
        position: 'absolute', top: horizon, left: width * 0.04, width: width * 0.92, height: 0,
        borderBottomWidth: bottom - horizon, borderBottomColor: '#162637',
        borderLeftWidth: width * 0.37, borderLeftColor: 'transparent',
        borderRightWidth: width * 0.37, borderRightColor: 'transparent',
      }} />
      {[-1.5, -0.5, 0.5, 1.5].map((edge) => (
        <Rail key={edge} x1={width / 2 + edge * width * 0.18 / 3} y1={horizon}
          x2={width / 2 + edge * width * 0.92 / 3} y2={bottom}
          color={Math.abs(edge) > 1 ? '#43B9AD' : '#427081'} thickness={Math.abs(edge) > 1 ? 3 : 1} />
      ))}
      {Array.from({ length: 12 }, (_, i) => {
        const depth = ((i + phase) / 12) * 1.1;
        const p = projectRunnerPoint(1, depth, width, height);
        return <View key={i} style={{
          position: 'absolute', left: width / 2 - p.trackWidth / 2, top: p.y,
          width: p.trackWidth, height: 1 + p.scale, backgroundColor: '#6BAEAA', opacity: 0.08 + depth * 0.12,
        }} />;
      })}
      {[-1, 1].flatMap((side) => Array.from({ length: 5 }, (_, i) => {
        const depth = ((i + phase) / 5) * 1.06;
        const p = projectRunnerPoint(1, depth, width, height);
        const size = (14 + depth * 54) * Math.min(1, height / 400);
        return <View key={String(side) + '-' + i} style={{
          position: 'absolute', top: p.y - size * 1.6,
          left: width / 2 + side * (p.trackWidth * 0.65) - size / 2,
          width: size, height: size * 1.6, borderRadius: size * 0.3,
          backgroundColor: side < 0 ? '#12433F' : '#173B48',
          borderTopWidth: 2, borderColor: side < 0 ? '#4BCCAC' : '#59A0CE',
          transform: [{ rotate: side < 0 ? '-15deg' : '15deg' }],
        }} />;
      }))}
      {game.items.filter((item) => item.depth >= 0 && item.depth <= 1.18).map((item) => (
        <TrackItem key={item.id} item={item} width={width} height={height} />
      ))}
      <View style={{
        position: 'absolute', left: feet.x - unit * 0.55, top: feet.y - 6,
        width: unit * 1.1, height: 12, borderRadius: 50, backgroundColor: '#0008',
        zIndex: 93, transform: [{ scale: jump > 0 ? 0.7 : 1 }],
      }} />
      <View style={{
        position: 'absolute', left: feet.x - unit / 2,
        top: feet.y - (slide ? unit * 0.62 : unit * 1.5) - jump,
        width: unit, height: slide ? unit * 0.62 : unit * 1.5, zIndex: 94,
        transform: [{ rotate: slide ? '-12deg' : '0deg' }],
      }}>
        {game.shieldTime > 0 && <View style={{
          position: 'absolute', top: -unit * 0.25, bottom: -unit * 0.2, left: -unit * 0.25, right: -unit * 0.25,
          borderWidth: 2, borderRadius: unit, borderColor: CYAN, backgroundColor: '#48F3D118',
        }} />}
        <View style={{ position: 'absolute', top: 0, left: unit * 0.17, width: unit * 0.66, height: unit * 0.53, borderRadius: unit * 0.24, backgroundColor: '#D5F9F1', borderWidth: 2, borderColor: '#91CDC9' }}>
          <View style={{ position: 'absolute', top: '30%', left: '9%', right: '9%', height: '34%', backgroundColor: '#122F47', borderRadius: 8 }} />
        </View>
        {!slide && <>
          <View style={{ position: 'absolute', top: unit * 0.49, left: unit * 0.17, width: unit * 0.66, height: unit * 0.58, borderRadius: 9, backgroundColor: '#8C77E5', borderWidth: 2, borderColor: '#CBB6FF' }}>
            <View style={{ width: 5, height: '60%', alignSelf: 'center', marginTop: '15%', backgroundColor: CYAN, borderRadius: 3 }} />
          </View>
          {[-1, 1].map((side) => <View key={side} style={{
            position: 'absolute', top: unit * 0.98, left: side < 0 ? unit * 0.18 : unit * 0.57,
            width: unit * 0.23, height: unit * 0.46, borderRadius: 5, backgroundColor: '#B4BFDE',
            borderBottomWidth: 5, borderBottomColor: CYAN, transform: [{ translateY: side * stride }],
          }} />)}
        </>}
      </View>
      <View style={styles.zone}><View style={styles.dot} /><Text style={styles.zoneText}>NEON WILDS</Text></View>
    </View>
  );
});

const styles = StyleSheet.create({
  track: { overflow: 'hidden', borderRadius: 22, borderWidth: 1, borderColor: '#3D666A' },
  zone: { position: 'absolute', top: 14, left: 14, flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: CYAN },
  zoneText: { color: '#B5DAD6', fontSize: 9, fontWeight: '800', letterSpacing: 2 },
  post: { position: 'absolute', top: 0, bottom: 0, width: '12%', backgroundColor: '#CB6266', borderRadius: 3 },
  crossbar: { position: 'absolute', top: 0, left: 0, right: 0, height: '35%', backgroundColor: '#B34467', borderWidth: 2, borderColor: '#FF93AB', alignItems: 'center', justifyContent: 'center' },
  crate: { width: '100%', height: '100%', borderWidth: 2, borderColor: '#FFCD89', borderRadius: 5, padding: 4 },
  crateInset: { flex: 1, borderWidth: 1, borderColor: '#733D27', justifyContent: 'center', alignItems: 'center' },
});
