import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Relic } from '@/constants/relics';

type RelicDetailModalProps = {
  relic: Relic | null;
  isCollected: boolean;
  collectedAt?: string;
  onClose: () => void;
};

function formatCollectionDate(collectedAt?: string) {
  if (!collectedAt) {
    return 'Date unavailable';
  }

  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(collectedAt));
}

export function RelicDetailModal({
  relic,
  isCollected,
  collectedAt,
  onClose,
}: RelicDetailModalProps) {
  if (!relic) {
    return null;
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close relic details"
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />

        <View style={[styles.card, { borderColor: isCollected ? relic.primaryColor : '#4b345f' }]}>
          {isCollected ? (
            <>
              <Image source={relic.icon} style={styles.image} resizeMode="contain" />
              <Text style={[styles.name, { color: relic.primaryColor }]}>{relic.name}</Text>
              <Text style={styles.rarity}>{relic.rarity}</Text>
              {relic.lore ? <Text style={styles.description}>{relic.lore}</Text> : null}

              <View style={styles.detailsRow}>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>XP Reward</Text>
                  <Text style={styles.detailValue}>+{relic.xp} XP</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Date Collected</Text>
                  <Text style={styles.detailValue}>{formatCollectionDate(collectedAt)}</Text>
                </View>
              </View>
            </>
          ) : (
            <Text style={styles.lockedMessage}>Explore the map to discover this relic.</Text>
          )}

          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
          >
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 28,
    borderWidth: 1.5,
    backgroundColor: '#10051f',
    padding: 24,
    alignItems: 'center',
  },
  image: {
    width: 160,
    height: 160,
  },
  name: {
    fontSize: 25,
    fontWeight: '900',
    textAlign: 'center',
  },
  rarity: {
    color: '#b8afc4',
    fontSize: 14,
    marginTop: 5,
  },
  description: {
    color: '#ffffff',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 18,
  },
  detailsRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 12,
    marginTop: 22,
  },
  detailItem: {
    flex: 1,
    minHeight: 70,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailLabel: {
    color: '#9d93aa',
    fontSize: 11,
    textAlign: 'center',
  },
  detailValue: {
    color: '#ffd700',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 5,
  },
  lockedMessage: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 26,
    textAlign: 'center',
    paddingVertical: 30,
  },
  closeButton: {
    minWidth: 140,
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: '#6d28d9',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  closeText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }],
  },
});
