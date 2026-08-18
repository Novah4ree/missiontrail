import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ReturnTypeOfSecureRelicField } from '@/types/secure-relic-hook';
import {
  describeRelicSignal,
  formatRelicSignalDistance,
  getRelicSignalStage,
} from '@/utils/relic-radar';

// Purpose: Renders the nearby relic radar interface.
export function NearbyRelicRadar({
  field,
}: {
  field: ReturnTypeOfSecureRelicField;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <View style={styles.panel}>
      <View style={styles.headerRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'Collapse Nearby Signals' : 'Expand Nearby Signals'}
          accessibilityState={{ expanded }}
          onPress={() => setExpanded((current) => !current)}
          style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
        >
          <Ionicons name="radio-outline" size={15} color="#DDA7FF" />
          <Text style={styles.heading}>NEARBY SIGNALS</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{field.signals.length}</Text>
          </View>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={14}
            color="#BDA8CE"
          />
        </Pressable>
      </View>

      {expanded ? (
        <View style={styles.body}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Use Auto Nearest relic targeting"
            accessibilityState={{ selected: field.targetMode === 'auto' }}
            disabled={field.isBusy}
            onPress={field.useAutoNearest}
            style={({ pressed }) => [
              styles.autoButton,
              field.targetMode === 'auto' && styles.autoButtonSelected,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name={field.targetMode === 'auto' ? 'navigate' : 'navigate-outline'}
              size={13}
              color={field.targetMode === 'auto' ? '#160A24' : '#DDA7FF'}
            />
            <Text
              style={[
                styles.autoText,
                field.targetMode === 'auto' && styles.autoTextSelected,
              ]}
            >
              AUTO NEAREST
            </Text>
          </Pressable>

          {field.signals.length === 0 ? (
            <Text accessibilityLiveRegion="polite" style={styles.emptyText}>
              {field.isBusy ? 'Scanning nearby signals…' : 'No active signals detected.'}
            </Text>
          ) : (
            field.signals.map((signal) => {
              const selected = signal.assignmentId === field.selectedAssignmentId;
              const locked = signal.availability === 'locked';
              const ambient = signal.encounterType === 'ambient';
              const stage = locked ? 'LOCKED' : getRelicSignalStage(signal.distanceFeet);
              const direction = ambient ? 'ALL AROUND YOU' : signal.direction ?? 'SCANNING';

              return (
                <Pressable
                  key={signal.assignmentId}
                  accessibilityRole="button"
                  accessibilityLabel={describeRelicSignal(signal)}
                  accessibilityHint={
                    locked
                      ? 'Complete more exploration to unlock this signal'
                      : 'Sets this relic as the active hunt target'
                  }
                  accessibilityState={{ selected, disabled: locked }}
                  disabled={locked || field.isBusy}
                  onPress={() => field.selectSignal(signal.assignmentId)}
                  style={({ pressed }) => [
                    styles.signalRow,
                    selected && styles.signalRowSelected,
                    locked && styles.signalRowLocked,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={[styles.signalIcon, selected && styles.signalIconSelected]}>
                    <Ionicons
                      name={locked ? 'lock-closed' : ambient ? 'sparkles' : 'diamond-outline'}
                      size={15}
                      color={locked ? '#A79BAD' : selected ? '#FFD76A' : '#DDA7FF'}
                    />
                  </View>
                  <View style={styles.signalCopy}>
                    <View style={styles.signalTitleRow}>
                      <Text style={styles.signalTitle}>
                        {locked ? 'UNKNOWN SIGNAL' : ambient ? 'AMBIENT SIGNAL' : '???'}
                      </Text>
                      {selected ? <Text style={styles.targetText}>TARGET</Text> : null}
                    </View>
                    <Text style={[styles.stageText, locked && styles.lockedText]}>
                      {stage}
                    </Text>
                    {locked ? (
                      <Text style={styles.lockedHint}>Explore more to unlock</Text>
                    ) : null}
                  </View>
                  <View style={styles.signalMetrics}>
                    <Text style={styles.distanceText}>
                      {formatRelicSignalDistance(signal.distanceFeet)}
                    </Text>
                    <Text style={styles.directionText}>{direction}</Text>
                  </View>
                </Pressable>
              );
            })
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderWidth: 1,
    borderColor: 'rgba(192,132,252,0.38)',
    borderRadius: 10,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(20,10,38,0.78)',
    overflow: 'hidden',
  },
  headerRow: { minHeight: 34 },
  headerButton: {
    minHeight: 34,
    paddingHorizontal: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heading: { flex: 1, color: '#F7EDFF', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  countBadge: {
    minWidth: 21,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(168,85,247,0.24)',
  },
  countText: { color: '#E9D5FF', fontSize: 10, fontWeight: '900', fontVariant: ['tabular-nums'] },
  body: { borderTopWidth: 1, borderTopColor: 'rgba(192,132,252,0.2)', padding: 5, gap: 4 },
  autoButton: {
    minHeight: 30,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: 'rgba(221,167,255,0.6)',
    borderRadius: 8,
    paddingHorizontal: 8,
  },
  autoButtonSelected: { backgroundColor: '#DDA7FF', borderColor: '#DDA7FF' },
  autoText: { color: '#DDA7FF', fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  autoTextSelected: { color: '#160A24' },
  emptyText: { color: '#BDA8CE', fontSize: 10, textAlign: 'center', paddingVertical: 8 },
  signalRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.22)',
    borderRadius: 9,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(8,5,24,0.72)',
    paddingHorizontal: 7,
    paddingVertical: 5,
  },
  signalRowSelected: { borderColor: '#FFD76A', backgroundColor: 'rgba(79,52,8,0.36)' },
  signalRowLocked: { opacity: 0.72 },
  signalIcon: {
    width: 29,
    height: 29,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(221,167,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signalIconSelected: { borderColor: '#FFD76A' },
  signalCopy: { flex: 1, gap: 1 },
  signalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  signalTitle: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  targetText: { color: '#FFD76A', fontSize: 8, fontWeight: '900' },
  stageText: { color: '#C084FC', fontSize: 8, fontWeight: '900', letterSpacing: 0.35 },
  lockedText: { color: '#B8ACBF' },
  lockedHint: { color: '#8F8298', fontSize: 8 },
  signalMetrics: { alignItems: 'flex-end', gap: 2, maxWidth: 92 },
  distanceText: { color: '#FFD76A', fontSize: 11, fontWeight: '900', fontVariant: ['tabular-nums'] },
  directionText: { color: '#D9CBE2', fontSize: 8, fontWeight: '800', textAlign: 'right' },
  pressed: { opacity: 0.72 },
});
