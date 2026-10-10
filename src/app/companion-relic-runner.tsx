import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, PanResponder, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  actRunner, createRunner, moveRunner, pauseRunner, runnerScore, startRunner, tickRunner,
  type RunnerItem, type RunnerState,
} from '@/utils/relic-runner-core';

const BEST_KEY = 'mission-trails-relic-runner-best-v1';
const INK = '#060819';
const CYAN = '#36F0ED';
const GOLD = '#FFD975';

function RunnerTrack({ game, width, height }: { game: RunnerState; width: number; height: number }) {
  const w = Math.min(width - 28, 420);
  const h = Math.min(Math.max(height * 0.53, 290), 560);
  const left = w * 0.12;
  const trackW = w * 0.76;
  const laneX = (lane: number) => left + trackW * (lane + 0.5) / 3;

  const drawItem = (item: RunnerItem) => {
    if (item.depth < 0 || item.depth > 1.12) return null;
    const p = Math.max(0, item.depth);
    const size = 13 + p * 31;
    const colors: Record<string, string> = {
      crate: '#F26C3A', barrier: '#FF467D', gap: '#12121D',
      shard: GOLD, shield: CYAN, magnet: '#C978FF',
    };
    const symbols: Record<string, string> = {
      crate: '⬟', barrier: '━', gap: '●',
      shard: '◆', shield: '⬡', magnet: 'U',
    };
    return (
      <View key={item.id} pointerEvents="none" style={{
        position: 'absolute', left: laneX(item.lane) - size / 2,
        top: h * (0.10 + p * 0.78) - size / 2,
        width: size, height: size, borderRadius: item.kind === 'gap' ? size : 8,
        backgroundColor: item.kind === 'gap' ? '#080812' : colors[item.kind] + '33',
        borderWidth: 2, borderColor: colors[item.kind],
        justifyContent: 'center', alignItems: 'center',
      }}>
        <Text style={{ color: colors[item.kind], fontWeight: '900', fontSize: size * 0.56 }}>{symbols[item.kind]}</Text>
      </View>
    );
  };

  return (
    <View style={{ width: w, height: h, alignSelf: 'center', overflow: 'hidden', borderRadius: 22,
      backgroundColor: '#101530', borderWidth: 2, borderColor: '#26335B' }}>
      <View style={{ position: 'absolute', width: trackW, left, height: h,
        backgroundColor: '#19254B', borderLeftWidth: 3, borderRightWidth: 3, borderColor: CYAN }} />
      {[1, 2].map((line) => (
        <View key={line} style={{
          position: 'absolute', top: 0, bottom: 0, width: 2,
          left: left + trackW * line / 3,
          borderColor: '#6975BA', borderLeftWidth: 2, opacity: 0.8,
        }} />
      ))}
      <Text style={{ position: 'absolute', alignSelf: 'center', top: 9, color: '#80ABEF', fontSize: 13, fontWeight: '800' }}>
        MISSION TRAILS • RELIC RUNNER
      </Text>
      {game.items.map(drawItem)}
      <View style={{
        position: 'absolute', left: laneX(game.lane) - 23, top: h * 0.81,
        height: game.action === 'slide' ? 28 : 54, width: 46, borderRadius: 15,
        backgroundColor: game.shieldTime > 0 ? '#3AF6FF' : '#9C6AFF',
        borderColor: '#E7DDFF', borderWidth: 3, justifyContent: 'center', alignItems: 'center',
        transform: [{ translateY: game.action === 'jump' ? -44 : 0 }],
      }}>
        <Ionicons name="walk" size={26} color="#08051A" />
      </View>
    </View>
  );
}

export default function RelicRunnerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [game, setGame] = useState<RunnerState>(() => createRunner());
  const gameRef = useRef(game);
  const bestRef = useRef(0);

  const apply = useCallback((fn: (old: RunnerState) => RunnerState) => {
    const next = fn(gameRef.current);
    gameRef.current = next;
    setGame(next);
  }, []);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(BEST_KEY).then((saved) => {
      const best = Number(saved);
      if (alive && Number.isFinite(best) && best >= 0) {
        bestRef.current = best;
        apply((old) => ({ ...old, bestScore: Math.max(old.bestScore, best) }));
      }
    }).catch(() => {});
    return () => { alive = false; };
  }, [apply]);

  useEffect(() => {
    let last = Date.now();
    const timer = setInterval(() => {
      const now = Date.now();
      const dt = (now - last) / 1000;
      last = now;
      if (gameRef.current.status !== 'playing') return;
      apply((old) => tickRunner(old, dt));
    }, 40);
    return () => clearInterval(timer);
  }, [apply]);

  useEffect(() => {
    if (game.status !== 'over' || game.bestScore <= bestRef.current) return;
    bestRef.current = game.bestScore;
    AsyncStorage.setItem(BEST_KEY, String(game.bestScore)).catch(() => {});
  }, [game.status, game.bestScore]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active') apply((old) => old.status === 'playing' ? pauseRunner(old) : old);
    });
    return () => subscription.remove();
  }, [apply]);

  const responder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) + Math.abs(gesture.dy) > 14,
    onPanResponderRelease: (_, gesture) => {
      const { dx, dy } = gesture;
      if (Math.abs(dx) > Math.abs(dy)) {
        if (Math.abs(dx) > 26) apply((old) => moveRunner(old, dx > 0 ? 1 : -1));
      } else if (Math.abs(dy) > 26) {
        apply((old) => actRunner(old, dy < 0 ? 'jump' : 'slide'));
      }
    },
  })).current;

  const score = runnerScore(game);
  const start = () => apply(() => startRunner(Math.max(bestRef.current, game.bestScore)));
  return (
    <View style={{ flex: 1, backgroundColor: INK, paddingTop: insets.top + 10, paddingBottom: insets.bottom + 12 }}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Back to companion">
          <Ionicons name="arrow-back-circle" size={34} color={CYAN} />
        </Pressable>
        <Text style={styles.title}>RELIC RUNNER</Text>
        <Pressable onPress={() => apply(pauseRunner)} disabled={game.status === 'ready' || game.status === 'over'}>
          <Ionicons name={game.status === 'paused' ? 'play-circle' : 'pause-circle'} size={34} color={CYAN} />
        </Pressable>
      </View>
      <View style={styles.stats}>
        <Text style={styles.stat}>SCORE {score}</Text>
        <Text style={styles.stat}>◆ {game.shards}</Text>
        <Text style={styles.stat}>BEST {Math.max(game.bestScore, score)}</Text>
      </View>
      <Text style={styles.power}>
        {game.shieldTime > 0 ? '⬡ SHIELD  ' : ''}
        {game.magnetTime > 0 ? 'U MAGNET  ' : ''}
        {Math.floor(game.distance)} m
      </Text>
      <View style={{ flex: 1, justifyContent: 'center' }} {...responder.panHandlers}>
        <RunnerTrack game={game} width={width} height={height} />
        {game.status !== 'playing' && (
          <View style={styles.overlay} pointerEvents="box-none">
            <View style={styles.modal}>
              <Text style={styles.modalTitle}>
                {game.status === 'ready' ? 'READY TO RUN?' : game.status === 'paused' ? 'PAUSED' : 'RUN COMPLETE'}
              </Text>
              <Text style={styles.description}>
                {game.status === 'ready'
                  ? 'Swipe left and right to dodge. Swipe up to jump, down to slide.'
                  : game.status === 'over'
                    ? 'Distance: ' + Math.floor(game.distance) + ' m  •  Shards: ' + game.shards
                    : 'Tap resume to keep running.'}
              </Text>
              <Pressable style={styles.primary} onPress={() => game.status === 'paused' ? apply(pauseRunner) : start()}>
                <Text style={styles.primaryText}>{game.status === 'paused' ? 'RESUME' : game.status === 'over' ? 'RUN AGAIN' : 'START RUN'}</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
      <Text style={styles.instructions}>SWIPE ← → CHANGE LANE    ↑ JUMP    ↓ SLIDE</Text>
      <View style={styles.controls}>
        <Pressable style={styles.control} onPress={() => apply((old) => moveRunner(old, -1))}><Ionicons name="arrow-back" color={CYAN} size={28} /></Pressable>
        <Pressable style={styles.control} onPress={() => apply((old) => actRunner(old, 'jump'))}><Text style={styles.controlText}>JUMP</Text></Pressable>
        <Pressable style={styles.control} onPress={() => apply((old) => actRunner(old, 'slide'))}><Text style={styles.controlText}>SLIDE</Text></Pressable>
        <Pressable style={styles.control} onPress={() => apply((old) => moveRunner(old, 1))}><Ionicons name="arrow-forward" color={CYAN} size={28} /></Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18 },
  title: { color: '#FFF', fontWeight: '900', fontSize: 21, letterSpacing: 1 },
  stats: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 22, marginTop: 12 },
  stat: { color: GOLD, fontWeight: '800', fontSize: 13 },
  power: { textAlign: 'center', color: '#A4C5F7', marginVertical: 8, fontWeight: '700' },
  overlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  modal: { backgroundColor: '#090D23F2', borderColor: CYAN, borderWidth: 2, borderRadius: 22, padding: 22, width: '83%', alignItems: 'center' },
  modalTitle: { color: '#FFF', fontSize: 22, fontWeight: '900', textAlign: 'center' },
  description: { color: '#C1C8E3', textAlign: 'center', marginVertical: 16, lineHeight: 22 },
  primary: { paddingVertical: 14, paddingHorizontal: 28, borderRadius: 14, backgroundColor: CYAN },
  primaryText: { fontWeight: '900', color: '#090D23' },
  instructions: { color: '#B5BBDC', fontWeight: '700', fontSize: 10, textAlign: 'center', marginVertical: 12 },
  controls: { flexDirection: 'row', justifyContent: 'space-evenly', paddingHorizontal: 8 },
  control: { borderColor: '#38658F', borderWidth: 1, backgroundColor: '#131D3A', minWidth: 68, padding: 13, alignItems: 'center', borderRadius: 14 },
  controlText: { color: CYAN, fontWeight: '900' },
});
