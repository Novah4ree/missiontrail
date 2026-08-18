import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useDailyActivity } from '@/providers/activity-progress-provider';

import { EggHatchAnimation } from '@/components/eggs/EggHatchAnimation';
import type { Companion } from '../data/companions';
import { COMPANION_EGGS } from '../data/companion-eggs';
import {
  getEggHatchPercentage,
  getEggMilesRemaining,
  hatchEgg,
  isEggReadyToHatch,
} from '../data/egg-hatching';

// Purpose: Renders the eggs screen interface.
export default function EggsScreen() {
  const router = useRouter();

  // Use the same verified daily activity source as
  // Home, Missions, and Profile.
  const dailyActivity = useDailyActivity();

  const distanceWalkedMiles = Math.max(
    0,
    dailyActivity.todayDistanceMiles ?? 0
  );

  // Only show eggs that currently have artwork.
  const ownedEggs = useMemo(
    () =>
      COMPANION_EGGS.filter(
        (egg) =>
          egg.id === 'water-egg' ||
          egg.id === 'fire-egg'
      ),
    []
  );

  const [selectedEggId, setSelectedEggId] =
    useState('water-egg');

  const [hatchedCompanion, setHatchedCompanion] =
    useState<Companion | null>(null);

  const [isHatching, setIsHatching] =
    useState(false);

  const selectedEgg =
    ownedEggs.find(
      (egg) => egg.id === selectedEggId
    ) ?? ownedEggs[0];

  if (!selectedEgg) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyTitle}>
          No Eggs Found
        </Text>
      </View>
    );
  }

  const progress = getEggHatchPercentage(
    selectedEgg.id,
    distanceWalkedMiles
  );

  const milesRemaining = getEggMilesRemaining(
    selectedEgg.id,
    distanceWalkedMiles
  );

  const ready = isEggReadyToHatch(
    selectedEgg.id,
    distanceWalkedMiles
  );

  // Purpose: Handles hatch egg.
  const handleHatchEgg = () => {
    if (!ready || isHatching) {
      return;
    }

    const companion = hatchEgg(
      selectedEgg.id
    );

    if (!companion) {
      console.warn(
        `[Egg Hatch] Could not hatch ${selectedEgg.id}`
      );
      return;
    }

    setHatchedCompanion(companion);
    setIsHatching(true);
  };

  // Purpose: Handles claim companion.
  const handleClaimCompanion = () => {
    setIsHatching(false);
    setHatchedCompanion(null);

    // NEXT STEP:
    // Save the companion into the user's
    // permanent Supabase companion inventory.
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.back()}
        >
          <Ionicons
            name="chevron-back"
            size={26}
            color="#FFFFFF"
          />
        </TouchableOpacity>

        <View>
          <Text style={styles.headerTitle}>
            Egg Incubator
          </Text>

          <Text style={styles.headerSubtitle}>
            Walk. Explore. Hatch.
          </Text>
        </View>

        <View style={styles.headerButton}>
          <Ionicons
            name="egg-outline"
            size={24}
            color="#8BE9FD"
          />
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={
          styles.scrollContent
        }
      >
        <Text style={styles.sectionLabel}>
          ACTIVE EGG
        </Text>

        <View
          style={[
            styles.incubatorCard,
            {
              borderColor:
                selectedEgg.glowColor,
            },
          ]}
        >
          <View
            style={[
              styles.glow,
              {
                shadowColor:
                  selectedEgg.glowColor,
              },
            ]}
          >
            {selectedEgg.image ? (
              <Image
                source={selectedEgg.image}
                style={styles.mainEgg}
                resizeMode="contain"
              />
            ) : (
              <Ionicons
                name="egg"
                size={150}
                color={
                  selectedEgg.glowColor
                }
              />
            )}
          </View>

          <Text style={styles.eggName}>
            {selectedEgg.name}
          </Text>

          <Text style={styles.description}>
            {selectedEgg.description}
          </Text>

          <View style={styles.distanceRow}>
            <Text style={styles.distanceText}>
              {distanceWalkedMiles.toFixed(
                2
              )}{' '}
              mi
            </Text>

            <Text style={styles.distanceGoal}>
              /{' '}
              {selectedEgg.hatchDistanceMiles.toFixed(
                2
              )}{' '}
              mi
            </Text>
          </View>

          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${progress}%`,
                  backgroundColor:
                    selectedEgg.glowColor,
                  shadowColor:
                    selectedEgg.glowColor,
                },
              ]}
            />
          </View>

          <View style={styles.progressInfo}>
            <Text style={styles.percentText}>
              {progress}%
            </Text>

            <Text style={styles.remainingText}>
              {ready
                ? 'Ready to hatch'
                : `${milesRemaining.toFixed(
                    2
                  )} mi remaining`}
            </Text>
          </View>

          <TouchableOpacity
            disabled={!ready}
            style={[
              styles.hatchButton,
              {
                borderColor:
                  selectedEgg.glowColor,
              },
              !ready &&
                styles.hatchButtonDisabled,
            ]}
          >
            <Ionicons
              name={
                ready
                  ? 'sparkles'
                  : 'footsteps'
              }
              size={20}
              color={
                ready
                  ? selectedEgg.glowColor
                  : '#737386'
              }
            />

            <Text
              style={[
                styles.hatchButtonText,
                ready && {
                  color:
                    selectedEgg.glowColor,
                },
              ]}
            >
              {ready
                ? 'HATCH EGG'
                : 'KEEP WALKING'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.inventoryHeader}>
          <Text style={styles.sectionLabel}>
            YOUR EGGS
          </Text>

          <Text style={styles.inventoryCount}>
            {ownedEggs.length} Eggs
          </Text>
        </View>

        <View style={styles.eggGrid}>
          {ownedEggs.map((egg) => {
            const selected =
              egg.id === selectedEgg.id;

            const eggProgress =
              getEggHatchPercentage(
                egg.id,
                distanceWalkedMiles
              );

            return (
              <TouchableOpacity
                key={egg.id}
                activeOpacity={0.8}
                onPress={() =>
                  setSelectedEggId(egg.id)
                }
                style={[
                  styles.eggCard,
                  selected && {
                    borderColor:
                      egg.glowColor,
                    shadowColor:
                      egg.glowColor,
                  },
                ]}
              >
                <View style={styles.miniImageArea}>
                  {egg.image ? (
                    <Image
                      source={egg.image}
                      style={styles.miniEgg}
                      resizeMode="contain"
                    />
                  ) : (
                    <Ionicons
                      name="egg"
                      size={70}
                      color={egg.glowColor}
                    />
                  )}
                </View>

                <Text style={styles.cardName}>
                  {egg.name}
                </Text>

                <Text style={styles.cardDistance}>
                  {egg.hatchDistanceMiles.toFixed(
                    2
                  )}{' '}
                  mi hatch
                </Text>

                <View
                  style={
                    styles.cardProgressTrack
                  }
                >
                  <View
                    style={[
                      styles.cardProgressFill,
                      {
                        width: `${eggProgress}%`,
                        backgroundColor:
                          egg.glowColor,
                      },
                    ]}
                  />
                </View>

                <Text
                  style={[
                    styles.cardPercent,
                    selected && {
                      color:
                        egg.glowColor,
                    },
                  ]}
                >
                  {eggProgress}%
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.tipCard}>
          <Ionicons
            name="walk-outline"
            size={27}
            color="#22D3EE"
          />

          <View style={styles.tipTextArea}>
            <Text style={styles.tipTitle}>
              Exploration Hatches Eggs
            </Text>

            <Text style={styles.tipText}>
              Distance will count while you
              explore Mission Trails. Each egg
              requires a different amount of
              walking before it can hatch.
            </Text>
          </View>
        </View>
      </ScrollView>

      {hatchedCompanion && (
        <EggHatchAnimation
          visible={isHatching}
          eggImage={selectedEgg.image}
          eggName={selectedEgg.name}
          glowColor={selectedEgg.glowColor}
          companionName={hatchedCompanion.name}
          companionRarity={hatchedCompanion.rarity}
          onClose={handleClaimCompanion}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07090E',
  },

  header: {
    paddingTop: 58,
    paddingHorizontal: 20,
    paddingBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#1B2330',
  },

  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#111720',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#253041',
  },

  headerTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },

  headerSubtitle: {
    color: '#737F91',
    marginTop: 3,
    fontSize: 12,
    textAlign: 'center',
    letterSpacing: 1,
  },

  scrollContent: {
    padding: 20,
    paddingBottom: 70,
  },

  sectionLabel: {
    color: '#8B98AA',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.8,
    marginBottom: 12,
  },

  incubatorCard: {
    backgroundColor: '#0C1119',
    borderRadius: 28,
    padding: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    overflow: 'hidden',
  },

  glow: {
    width: 240,
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.7,
    shadowRadius: 30,
  },

  mainEgg: {
    width: 210,
    height: 210,
  },

  eggName: {
    color: '#FFFFFF',
    fontSize: 27,
    fontWeight: '900',
    marginTop: 4,
  },

  description: {
    color: '#8D98A8',
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
    maxWidth: 320,
  },

  distanceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 24,
  },

  distanceText: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
  },

  distanceGoal: {
    color: '#778396',
    fontSize: 16,
    fontWeight: '700',
  },

  progressTrack: {
    width: '100%',
    height: 12,
    borderRadius: 20,
    backgroundColor: '#171E29',
    overflow: 'hidden',
    marginTop: 12,
  },

  progressFill: {
    height: '100%',
    borderRadius: 20,
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },

  progressInfo: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },

  percentText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  remainingText: {
    color: '#7F8A9B',
    fontSize: 13,
  },

  hatchButton: {
    marginTop: 24,
    height: 52,
    width: '100%',
    borderRadius: 18,
    backgroundColor: '#111820',
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },

  hatchButtonDisabled: {
    borderColor: '#252D39',
    opacity: 0.75,
  },

  hatchButtonText: {
    color: '#737386',
    fontWeight: '900',
    letterSpacing: 1,
  },

  inventoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 30,
  },

  inventoryCount: {
    color: '#697587',
    fontSize: 12,
    marginBottom: 12,
  },

  eggGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },

  eggCard: {
    width: '48%',
    backgroundColor: '#0C1119',
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: '#202836',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },

  miniImageArea: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },

  miniEgg: {
    width: 110,
    height: 110,
  },

  cardName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 5,
  },

  cardDistance: {
    color: '#778396',
    fontSize: 11,
    marginTop: 4,
  },

  cardProgressTrack: {
    height: 5,
    backgroundColor: '#1A212C',
    borderRadius: 10,
    overflow: 'hidden',
    marginTop: 12,
  },

  cardProgressFill: {
    height: '100%',
  },

  cardPercent: {
    color: '#687487',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 7,
    textAlign: 'right',
  },

  tipCard: {
    marginTop: 25,
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1B3340',
    backgroundColor: '#0A151B',
    flexDirection: 'row',
    gap: 14,
  },

  tipTextArea: {
    flex: 1,
  },

  tipTitle: {
    color: '#D9FAFF',
    fontSize: 14,
    fontWeight: '800',
  },

  tipText: {
    color: '#778B96',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
  },

  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    margin: 30,
  },
});
