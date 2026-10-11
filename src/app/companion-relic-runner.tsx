import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState, BackHandler, PanResponder, Platform, Pressable, StyleSheet, Text, View,
  type PanResponderGestureState,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RelicRunnerTrack } from '../components/relic-runner-track';
import {
  actRunner, createRunner, moveRunner, pauseRunner, runnerScore, startRunner, tickRunner,
  type RunnerState,
} from '../utils/relic-runner-core';

const BEST_KEY = 'mission-trails-relic-runner-best-v1';
const CYAN = '#48F3D1';
const STEP_SECONDS = 1 / 60;

export default function RelicRunnerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [game, setGame] = useState<RunnerState>(() => createRunner());
  const [trackSize, setTrackSize] = useState({ width: 0, height: 0 });
  const gameRef = useRef(game);
  const focusedRef = useRef(false);
  const lastFrameRef = useRef<number | null>(null);
  const accumulatorRef = useRef(0);
  const bestRef = useRef(0);
  const savedBestRef = useRef(0);
  const storageReadyRef = useRef(false);
  const writeQueueRef = useRef(Promise.resolve());

  const apply = useCallback((update: (old: RunnerState) => RunnerState) => {
    const old = gameRef.current;
    const next = update(old);
    if (old.status !== next.status) {
      lastFrameRef.current = null;
      accumulatorRef.current = 0;
    }
    gameRef.current = next;
    bestRef.current = Math.max(bestRef.current, next.bestScore, runnerScore(next));
    if (next !== old) setGame(next);
  }, []);

  const saveBest = useCallback(() => {
    if (!storageReadyRef.current) return;
    // Serialize saves and re-check inside the queue so a slow read/write cannot
    // replace a newer personal best. Failed saves remain eligible for retry.
    writeQueueRef.current = writeQueueRef.current.catch(() => {}).then(async () => {
      const score = bestRef.current;
      if (score <= savedBestRef.current) return;
      await AsyncStorage.setItem(BEST_KEY, String(score));
      savedBestRef.current = score;
    }).catch(() => {});
  }, []);

  const suspend = useCallback(() => {
    apply((old) => old.status === 'playing' ? pauseRunner(old) : old);
    lastFrameRef.current = null;
    accumulatorRef.current = 0;
    saveBest();
  }, [apply, saveBest]);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(BEST_KEY).then((saved) => {
      const parsed = Number(saved);
      const score = Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
      savedBestRef.current = score;
      bestRef.current = Math.max(bestRef.current, score);
      if (alive) apply((old) => ({ ...old, bestScore: Math.max(old.bestScore, score) }));
    }).catch(() => {}).finally(() => {
      storageReadyRef.current = true;
      saveBest();
    });
    return () => { alive = false; saveBest(); };
  }, [apply, saveBest]);

  useFocusEffect(useCallback(() => {
    focusedRef.current = true;
    lastFrameRef.current = null;
    // Fixed simulation steps keep 30/60/120 Hz displays consistent.
    let frameId = 0;
    const frame = (now: number) => {
      if (!focusedRef.current) return;
      if (gameRef.current.status === 'playing' && (AppState.currentState == null || AppState.currentState === 'active')) {
        const last = lastFrameRef.current;
        lastFrameRef.current = now;
        if (last !== null) {
          accumulatorRef.current += Math.max(0, Math.min(0.1, (now - last) / 1000));
          let next = gameRef.current;
          while (accumulatorRef.current >= STEP_SECONDS && next.status === 'playing') {
            next = tickRunner(next, STEP_SECONDS);
            accumulatorRef.current -= STEP_SECONDS;
          }
          apply(() => next);
        }
      } else {
        lastFrameRef.current = null;
        accumulatorRef.current = 0;
      }
      frameId = requestAnimationFrame(frame);
    };
    frameId = requestAnimationFrame(frame);
    const change = AppState.addEventListener('change', (state) => {
      if (state !== 'active') suspend();
    });
    // Android's notification shade can blur without changing AppState.
    const blur = Platform.OS === 'android' ? AppState.addEventListener('blur', suspend) : undefined;
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      if (gameRef.current.status !== 'playing') return false;
      suspend();
      return true;
    });
    return () => {
      focusedRef.current = false;
      cancelAnimationFrame(frameId);
      change.remove();
      blur?.remove();
      back.remove();
      suspend();
    };
  }, [apply, suspend]));

  useEffect(() => {
    if (game.status === 'over' || game.status === 'paused') saveBest();
  }, [game.status, saveBest]);

  const responder = useMemo(() => {
    let handled = false;
    const respond = (_: unknown, gesture: PanResponderGestureState) => {
      if (handled || gameRef.current.status !== 'playing') return;
      const { dx, dy } = gesture;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return;
      handled = true;
      if (Math.abs(dx) > Math.abs(dy)) apply((old) => moveRunner(old, dx > 0 ? 1 : -1));
      else apply((old) => actRunner(old, dy < 0 ? 'jump' : 'slide'));
    };
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        gameRef.current.status === 'playing' && Math.max(Math.abs(gesture.dx), Math.abs(gesture.dy)) > 10,
      onPanResponderGrant: (event, gesture) => { handled = false; respond(event, gesture); },
      onPanResponderMove: respond,
      onPanResponderRelease: (event, gesture) => { respond(event, gesture); handled = false; },
      onPanResponderTerminationRequest: () => false,
      onPanResponderTerminate: () => { handled = false; suspend(); },
    });
  }, [apply, suspend]);

  const exit = () => {
    suspend();
    if (router.canGoBack()) router.back();
    else router.replace('/companion');
  };
  const start = () => apply(() => startRunner(bestRef.current));
  const score = runnerScore(game);
  const playing = game.status === 'playing';
  const compact = trackSize.height > 0 && trackSize.height < 400;
  const crashHint = game.crashKind === 'barrier' ? 'Swipe down to slide under the pink gates.'
    : game.crashKind === 'gap' ? 'Swipe up to jump over gaps.'
      : 'Swipe up to jump over crates, or switch lanes.';

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 6, paddingBottom: Math.max(insets.bottom, 8),
      paddingLeft: Math.max(insets.left, 14), paddingRight: Math.max(insets.right, 14) }]}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Pressable onPress={exit} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Back to companion">
          <Ionicons name="arrow-back" size={22} color="#E3F2EF" />
        </Pressable>
        <View><Text style={styles.eyebrow}>MISSION TRAILS</Text><Text style={styles.title}>RELIC RUNNER</Text></View>
        <Pressable style={[styles.iconButton, (game.status === 'ready' || game.status === 'over') && styles.disabled]}
          onPress={() => { apply(pauseRunner); saveBest(); }}
          disabled={game.status === 'ready' || game.status === 'over'}
          accessibilityRole="button" accessibilityLabel={game.status === 'paused' ? 'Resume run' : 'Pause run'}>
          <Ionicons name={game.status === 'paused' ? 'play' : 'pause'} size={22} color={CYAN} />
        </Pressable>
      </View>
      <View style={styles.stats}>
        <View><Text style={styles.label}>SCORE</Text><Text style={styles.score}>{score.toLocaleString()}</Text></View>
        <View style={styles.shards}><Ionicons name="diamond" color="#FFDC82" size={17} /><Text style={styles.shardCount}>{game.shards}</Text></View>
        <View style={{ alignItems: 'flex-end' }}><Text style={styles.label}>PERSONAL BEST</Text><Text style={styles.best}>{game.bestScore.toLocaleString()}</Text></View>
      </View>
      <View style={styles.powerRow}>
        <Text style={styles.distance}>{Math.floor(game.distance)} m</Text>
        <Text style={styles.power}>{game.shieldTime > 0 ? 'SHIELD ' + Math.ceil(game.shieldTime) + 's' : ''}
          {game.magnetTime > 0 ? '  MAGNET ' + Math.ceil(game.magnetTime) + 's' : ''}</Text>
        <Text style={styles.distance}>3 LANES · ENDLESS</Text>
      </View>
      <View style={styles.stage} onLayout={({ nativeEvent }) => {
        const { width, height } = nativeEvent.layout;
        setTrackSize((old) => old.width === width && old.height === height ? old : { width, height });
      }}>
        <View style={StyleSheet.absoluteFill} {...responder.panHandlers}>
          {trackSize.width > 0 && trackSize.height > 0 &&
            <RelicRunnerTrack game={game} width={trackSize.width} height={trackSize.height} />}
        </View>
        {!playing && (
          <View style={styles.overlay}>
            <View style={[styles.modal, compact && styles.compactModal]}>
              {!compact && <View style={styles.modalIcon}><Ionicons name={game.status === 'over' ? 'flag' : game.status === 'paused' ? 'pause' : 'flash'} color={CYAN} size={28} /></View>}
              <Text style={styles.modalTitle}>{game.status === 'ready' ? 'CHASE THE RELICS' : game.status === 'paused' ? 'TAKE A BREATHER' : 'RUN COMPLETE'}</Text>
              {!compact && <Text style={styles.description}>{game.status === 'ready'
                ? 'Find your lane. Chase the glow.\nJump crates and gaps. Slide under gates.'
                : game.status === 'paused' ? 'Your run is paused. Ready when you are.'
                  : Math.floor(game.distance) + ' m  ·  ' + game.shards + ' shards\n' + crashHint}</Text>}
              {game.status === 'over' && !compact && <Text style={styles.finalScore}>{score.toLocaleString()}<Text style={styles.points}> PTS</Text></Text>}
              <Pressable style={styles.primary} accessibilityRole="button"
                onPress={() => gameRef.current.status === 'paused' ? apply(pauseRunner) : start()}>
                <Text style={styles.primaryText}>{game.status === 'paused' ? 'RESUME RUN' : game.status === 'over' ? 'RUN AGAIN' : 'START RUN'}</Text>
                <Ionicons name="arrow-forward" color="#09251F" size={19} />
              </Pressable>
            </View>
          </View>
        )}
      </View>
      <Text style={styles.instructions}>SWIPE TO MOVE · UP TO JUMP · DOWN TO SLIDE</Text>
      <View style={styles.controls}>
        <Pressable style={[styles.control, !playing && styles.disabled]} disabled={!playing}
          onPressIn={() => apply((old) => moveRunner(old, -1))} accessibilityRole="button" accessibilityLabel="Move left">
          <Ionicons name="arrow-back" color={CYAN} size={23} />
        </Pressable>
        <Pressable style={[styles.control, !playing && styles.disabled]} disabled={!playing}
          onPressIn={() => apply((old) => actRunner(old, 'jump'))} accessibilityRole="button" accessibilityLabel="Jump">
          <Ionicons name="arrow-up" color={CYAN} size={18} /><Text style={styles.controlText}>JUMP</Text>
        </Pressable>
        <Pressable style={[styles.control, !playing && styles.disabled]} disabled={!playing}
          onPressIn={() => apply((old) => actRunner(old, 'slide'))} accessibilityRole="button" accessibilityLabel="Slide">
          <Ionicons name="arrow-down" color={CYAN} size={18} /><Text style={styles.controlText}>SLIDE</Text>
        </Pressable>
        <Pressable style={[styles.control, !playing && styles.disabled]} disabled={!playing}
          onPressIn={() => apply((old) => moveRunner(old, 1))} accessibilityRole="button" accessibilityLabel="Move right">
          <Ionicons name="arrow-forward" color={CYAN} size={23} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#09131E' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  iconButton: { width: 42, height: 42, borderRadius: 15, backgroundColor: '#14232F', alignItems: 'center', justifyContent: 'center' },
  eyebrow: { color: '#88B0AD', textAlign: 'center', fontSize: 9, fontWeight: '800', letterSpacing: 2.5 },
  title: { color: '#F2F6F5', fontWeight: '900', fontSize: 20, letterSpacing: 0.5, marginTop: 3 },
  stats: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 8 },
  label: { color: '#88A5AC', fontWeight: '700', fontSize: 9, letterSpacing: 1.3 },
  score: { color: '#FFF', fontWeight: '900', fontSize: 27, marginTop: 2, fontVariant: ['tabular-nums'] },
  best: { color: '#FFDC82', fontWeight: '800', fontSize: 20, marginTop: 2, fontVariant: ['tabular-nums'] },
  shards: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  shardCount: { color: '#FFDC82', fontWeight: '800', fontSize: 19 },
  powerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, height: 29 },
  distance: { color: '#8AA9AE', fontWeight: '700', fontSize: 9, letterSpacing: 0.5 },
  power: { color: CYAN, fontWeight: '800', fontSize: 10 },
  stage: { flex: 1, minHeight: 0 },
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: 22, backgroundColor: '#04101F66', alignItems: 'center', justifyContent: 'center' },
  modal: { backgroundColor: '#0C1A27F5', borderColor: '#38756F', borderWidth: 1, borderRadius: 24, padding: 22, width: '88%', maxWidth: 380, alignItems: 'center' },
  compactModal: { padding: 10, borderRadius: 16 },
  modalIcon: { width: 58, height: 58, backgroundColor: '#153932', borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  modalTitle: { color: '#F0F7F3', fontSize: 19, fontWeight: '900', textAlign: 'center', letterSpacing: 0.7 },
  description: { color: '#AFC8CA', textAlign: 'center', marginTop: 12, lineHeight: 21, fontSize: 13 },
  finalScore: { color: '#FFDC82', fontWeight: '900', fontSize: 34, marginTop: 10 },
  points: { fontSize: 12, color: '#AFC8CA' },
  primary: { marginTop: 16, paddingVertical: 14, paddingHorizontal: 20, borderRadius: 14, backgroundColor: CYAN, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, width: '100%' },
  primaryText: { fontWeight: '900', color: '#09251F', fontSize: 13, letterSpacing: 1 },
  instructions: { color: '#8FAEB5', fontWeight: '700', fontSize: 9, textAlign: 'center', marginVertical: 9, letterSpacing: 0.3 },
  controls: { flexDirection: 'row', gap: 8 },
  control: { flex: 1, flexDirection: 'row', gap: 4, justifyContent: 'center', alignItems: 'center', height: 48, borderRadius: 15, borderWidth: 1, borderColor: '#284E57', backgroundColor: '#142632' },
  controlText: { color: CYAN, fontWeight: '800', fontSize: 10 },
  disabled: { opacity: 0.4 },
});

