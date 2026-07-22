import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Speech from 'expo-speech';
import { Pressable, StyleSheet, Switch, Text, Vibration, View } from 'react-native';
import { useEffect, useRef, useState } from 'react';

import type { ReturnTypeOfSecureRelicField } from '@/types/secure-relic-hook';

const HAPTICS_KEY = 'mission-trail:relic-haptics:v1';
const SOUNDS_KEY = 'mission-trail:relic-sounds:v1';

export function SecureRelicCard({ field }: { field: ReturnTypeOfSecureRelicField }) {
  const [hapticsEnabled, setHapticsEnabled] = useState(false);
  const [soundsEnabled, setSoundsEnabled] = useState(false);
  const [showClueOptions, setShowClueOptions] = useState(false);
  const previousClueStrength = useRef(field.clueStrength);
  const previousStatus = useRef(field.status);

  useEffect(() => {
    void Promise.all([AsyncStorage.getItem(HAPTICS_KEY), AsyncStorage.getItem(SOUNDS_KEY)])
      .then(([haptics, sounds]) => {
        setHapticsEnabled(haptics === 'true');
        setSoundsEnabled(sounds === 'true');
      });
  }, []);

  useEffect(() => {
    if (field.clueStrength === previousClueStrength.current) return;
    previousClueStrength.current = field.clueStrength;
    if (field.clueStrength < 1) return;
    if (hapticsEnabled) Vibration.vibrate(10 + field.clueStrength * 12);
    if (soundsEnabled) {
      Speech.speak(['Faint clue', 'Faint clue', 'Getting warmer', 'Very close'][field.clueStrength], {
        pitch: 1.12,
        rate: 1.05,
      });
    }
  }, [field.clueStrength, hapticsEnabled, soundsEnabled]);

  useEffect(() => {
    if (field.status === previousStatus.current) return;
    previousStatus.current = field.status;
    if (field.status !== 'revealed' && field.status !== 'collected') return;
    if (hapticsEnabled) Vibration.vibrate(field.status === 'collected' ? [0, 30, 45, 50] : 45);
    if (soundsEnabled) Speech.speak(field.status === 'collected' ? 'Added to your Vault!' : 'You found a relic!');
  }, [field.status, hapticsEnabled, soundsEnabled]);

  function setHaptics(value: boolean) {
    setHapticsEnabled(value);
    void AsyncStorage.setItem(HAPTICS_KEY, String(value));
  }

  function setSounds(value: boolean) {
    setSoundsEnabled(value);
    void AsyncStorage.setItem(SOUNDS_KEY, String(value));
  }

  const isRevealed = Boolean(field.revealed);
  const canCollect = isRevealed && field.freshFinalReadingCount >= 3 && !field.isBusy;
  const clueLabel = ['Faint clue', 'Faint clue', 'Getting warmer', 'Very close'][field.clueStrength];
  const showRetry = field.status === 'offline_retry' || field.status === 'expired';

  return (
    <View style={[styles.card, isRevealed && styles.revealedCard]}>
      <View style={styles.titleRow}>
        <Ionicons
          name={isRevealed ? 'sparkles' : field.status === 'ineligible' ? 'lock-closed' : 'help-circle'}
          size={17}
          color={isRevealed ? '#FFD76A' : '#B96BFF'}
        />
        <Text style={styles.title}>{field.revealed?.name ?? 'Hidden Relic Area'}</Text>
      </View>
      <Text accessibilityLiveRegion="polite" style={styles.message}>{field.message}</Text>
      {field.distanceFeet !== null ? (
        <Text
          accessibilityLabel={`Closest relic is about ${field.distanceFeet} feet away`}
          style={styles.distance}
        >
          {field.distanceFeet.toLocaleString()} ft away
        </Text>
      ) : null}
      {field.status === 'approaching' ? (
        <Text accessibilityLabel={`Clue strength: ${clueLabel}`} style={styles.clue}>
          {clueLabel}
        </Text>
      ) : null}
      {isRevealed ? (
        <Text style={styles.readings}>{field.freshFinalReadingCount} of 3 location checks ready</Text>
      ) : null}

      <View style={styles.actions}>
        {isRevealed ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Collect Relic"
            accessibilityHint={canCollect ? 'Adds this relic to your Vault' : 'Wait for three location checks'}
            accessibilityState={{ disabled: !canCollect, busy: field.isBusy }}
            disabled={!canCollect}
            onPress={() => void field.collect()}
            style={[styles.button, !canCollect && styles.disabled]}
          >
            <Text style={styles.buttonText}>{field.isBusy ? 'Adding…' : 'Collect Relic'}</Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Find Hidden Relic"
            accessibilityHint="Checks whether a hidden relic is nearby"
            accessibilityState={{ disabled: field.isBusy, busy: field.isBusy }}
            disabled={field.isBusy}
            onPress={() => void field.scan()}
            style={[styles.button, field.isBusy && styles.disabled]}
          >
            <Text style={styles.buttonText}>{field.isBusy ? 'Searching for relics…' : 'Find Hidden Relic'}</Text>
          </Pressable>
        )}
        {showRetry ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Try Again"
            accessibilityState={{ disabled: field.isBusy }}
            disabled={field.isBusy}
            onPress={() => void field.refreshField()}
            style={[styles.secondaryButton, field.isBusy && styles.disabled]}
          >
            <Text style={styles.secondaryText}>Try Again</Text>
          </Pressable>
        ) : null}
        {__DEV__ && !isRevealed ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Place Test Relic 5 Feet Away"
            accessibilityHint="Places a development-only relic near your current location"
            accessibilityState={{ disabled: field.isBusy }}
            disabled={field.isBusy}
            onPress={() => void field.placeTestRelic()}
            style={[styles.testButton, field.isBusy && styles.disabled]}
          >
            <Text style={styles.testButtonText}>Place Test Relic 5 ft Away</Text>
          </Pressable>
        ) : null}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={showClueOptions ? 'Hide clue options' : 'Show clue options'}
        accessibilityState={{ expanded: showClueOptions }}
        onPress={() => setShowClueOptions((current) => !current)}
        style={styles.optionsButton}
      >
        <Ionicons name={showClueOptions ? 'chevron-up' : 'chevron-down'} size={13} color="#BDA8CE" />
        <Text style={styles.optionsText}>Clue options</Text>
      </Pressable>

      {showClueOptions ? (
        <View style={styles.effectsGroup}>
          <View style={styles.effectsRow}>
            <Text style={styles.effectsText}>Sounds</Text>
            <Switch
              accessibilityLabel="Clue sounds"
              accessibilityHint="Turns spoken clue sounds on or off"
              value={soundsEnabled}
              onValueChange={setSounds}
              trackColor={{ false: '#51465A', true: '#7C3AED' }}
              style={styles.compactSwitch}
            />
          </View>
          <View style={styles.effectsRow}>
            <Text style={styles.effectsText}>Vibration</Text>
            <Switch
              accessibilityLabel="Clue vibration"
              accessibilityHint="Turns gentle clue vibrations on or off"
              value={hapticsEnabled}
              onValueChange={setHaptics}
              trackColor={{ false: '#51465A', true: '#7C3AED' }}
              style={styles.compactSwitch}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: '86%', maxWidth: 310, alignSelf: 'center', borderWidth: 1, borderColor: 'rgba(168,85,247,0.75)', borderRadius: 12, backgroundColor: 'rgba(6,4,26,0.94)', paddingHorizontal: 9, paddingVertical: 7, gap: 4 },
  revealedCard: { borderColor: '#FFD76A', backgroundColor: 'rgba(48,31,4,0.95)' },
  titleRow: { flexDirection: 'row', gap: 5, alignItems: 'center', justifyContent: 'center' },
  title: { color: '#FFF', fontSize: 12, fontWeight: '900' },
  message: { color: '#E8DCF1', textAlign: 'center', fontSize: 10, lineHeight: 14 },
  distance: { color: '#FFD76A', textAlign: 'center', fontSize: 15, fontWeight: '900', fontVariant: ['tabular-nums'] },
  clue: { color: '#DDA7FF', textAlign: 'center', fontSize: 11, fontWeight: '800' },
  readings: { color: '#FFD76A', textAlign: 'center', fontSize: 11, fontWeight: '800' },
  actions: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' },
  button: { minHeight: 40, justifyContent: 'center', backgroundColor: '#7C3AED', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  disabled: { opacity: 0.45 },
  buttonText: { color: '#FFF', fontWeight: '900', fontSize: 12 },
  secondaryButton: { minHeight: 40, justifyContent: 'center', borderColor: '#75578D', borderWidth: 1, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 8 },
  secondaryText: { color: '#D8C7E4', fontWeight: '800', fontSize: 11 },
  testButton: { minHeight: 40, justifyContent: 'center', borderColor: '#2DD4BF', borderWidth: 1, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 8 },
  testButtonText: { color: '#99F6E4', fontWeight: '900', fontSize: 11 },
  optionsButton: { minHeight: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 },
  optionsText: { color: '#BDA8CE', fontSize: 9, fontWeight: '800' },
  effectsGroup: { flexDirection: 'row', justifyContent: 'center', gap: 10, flexWrap: 'wrap' },
  effectsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 2 },
  effectsText: { color: '#9F91AA', fontSize: 9 },
  compactSwitch: { transform: [{ scale: 0.72 }] },
});
