import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ImageSourcePropType,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  ReduceMotion,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

type CardCategory = 'relic' | 'egg' | 'food';

type MatchingItem = {
  id: string;
  name: string;
  category: CardCategory;
  image: ImageSourcePropType;
};

type MatchingCard = {
  id: string;
  pairId: string;
  name: string;
  category: CardCategory;
  image: ImageSourcePropType;
  matched: boolean;
  faceUp: boolean;
};

type LevelConfig = {
  level: number;
  pairCount: number;
  categories: CardCategory[];
  moveLimit: number | null;
  timeLimit: number | null;
};

type GameStatus = 'intro' | 'playing' | 'complete' | 'failed';

type MatchingCardsProgress = {
  highestUnlockedLevel: number;
  completedLevels: number[];
  bestScore: number;
  bestScoresByLevel: Record<string, number>;
};

const PROGRESS_STORAGE_KEY = 'mission-trails-matching-cards-progress-v1';

const DEFAULT_PROGRESS: MatchingCardsProgress = {
  highestUnlockedLevel: 1,
  completedLevels: [],
  bestScore: 0,
  bestScoresByLevel: {},
};

const ITEM_POOL: MatchingItem[] = [
  {
    id: 'solar-sun',
    name: 'Radiant Solar Sun',
    category: 'relic',
    image: require('../../assets/images/relicsIcons/radiantsolarsun.png'),
  },
  {
    id: 'phoenix-ember',
    name: 'Phoenix Ember Crystal',
    category: 'relic',
    image: require('../../assets/images/relicsIcons/phoenixembercrystal.png'),
  },
  {
    id: 'aurora-gem',
    name: 'Aurora Gem',
    category: 'relic',
    image: require('../../assets/images/relicsIcons/auroragem.png'),
  },
  {
    id: 'cosmic-shard',
    name: 'Cosmic Shard',
    category: 'relic',
    image: require('../../assets/images/relicsIcons/cosmicshard.png'),
  },
  {
    id: 'prismatic-shard',
    name: 'Prismatic Shard',
    category: 'relic',
    image: require('../../assets/images/relicsIcons/prismaticshard.png'),
  },
  {
    id: 'nebula-crystal',
    name: 'Nebula Crystal',
    category: 'relic',
    image: require('../../assets/images/relicsIcons/nebulacrystal.png'),
  },
  {
    id: 'dark-moon',
    name: 'Dark Moon',
    category: 'relic',
    image: require('../../assets/images/relicsIcons/darkmoon.png'),
  },
  {
    id: 'meteor-heart',
    name: 'Meteor Heart',
    category: 'relic',
    image: require('../../assets/images/relicsIcons/meteorheart.png'),
  },
  {
    id: 'star-fragment',
    name: 'Star Fragment',
    category: 'relic',
    image: require('../../assets/images/relicsIcons/starfragment.png'),
  },
  {
    id: 'storm-core',
    name: 'Storm Core',
    category: 'relic',
    image: require('../../assets/images/relicsIcons/stormcoreelement.png'),
  },
  {
    id: 'neon-apple',
    name: 'Neon Apple',
    category: 'food',
    image: require('../../assets/images/companionfoodicons/fruitsquick-energy/neonapple.png'),
  },
  {
    id: 'solar-mango',
    name: 'Solar Mango',
    category: 'food',
    image: require('../../assets/images/companionfoodicons/fruitsquick-energy/solarmango.png'),
  },
  {
    id: 'cosmic-berry',
    name: 'Cosmic Berry',
    category: 'food',
    image: require('../../assets/images/companionfoodicons/fruitsquick-energy/cosmicberry.png'),
  },
  {
    id: 'star-biscuit',
    name: 'Star Biscuit',
    category: 'food',
    image: require('../../assets/images/companionfoodicons/bakedtreatssweets-happines/starbiscuit.png'),
  },
  {
    id: 'galaxy-donut',
    name: 'Galaxy Donut',
    category: 'food',
    image: require('../../assets/images/companionfoodicons/bakedtreatssweets-happines/galaxydonut.png'),
  },
  {
    id: 'meteor-burger',
    name: 'Meteor Burger',
    category: 'food',
    image: require('../../assets/images/companionfoodicons/proteinfullmeals-hungerrestoration/meteorburger.png'),
  },
  {
    id: 'power-bowl',
    name: 'Power Bowl',
    category: 'food',
    image: require('../../assets/images/companionfoodicons/proteinfullmeals-hungerrestoration/powerbowl.png'),
  },
  {
    id: 'moon-milk',
    name: 'Moon Milk',
    category: 'food',
    image: require('../../assets/images/companionfoodicons/drinks-recovery/moonmilk.png'),
  },
  {
    id: 'dream-tea',
    name: 'Dream Tea',
    category: 'food',
    image: require('../../assets/images/companionfoodicons/drinks-recovery/dreamtea.png'),
  },
  {
    id: 'cyber-lollipop',
    name: 'Cyber Lollipop',
    category: 'food',
    image: require('../../assets/images/companionfoodicons/mythicboost/cyberlollipop.png'),
  },
  {
    id: 'inferno-core-egg',
    name: 'Inferno Core Egg',
    category: 'egg',
    image: require('../../assets/eggs/rare/fire/Inferno Core Egg.png'),
  },
  {
    id: 'glacial-heart-egg',
    name: 'Glacial Heart Egg',
    category: 'egg',
    image: require('../../assets/eggs/rare/frost/Glacial Heart Egg.png'),
  },
  {
    id: 'neon-rift-egg',
    name: 'Neon Rift Egg',
    category: 'egg',
    image: require('../../assets/eggs/epic/storm/Neon Rift Egg.png'),
  },
  {
    id: 'cybercore-egg',
    name: 'Cybercore Egg',
    category: 'egg',
    image: require('../../assets/eggs/epic/tech/Cybercore Egg.png'),
  },
  {
    id: 'astral-nexus-egg',
    name: 'Astral Nexus Egg',
    category: 'egg',
    image: require('../../assets/eggs/mythic/cosmic/Astral Nexus Egg.png'),
  },
  {
    id: 'verdant-soul-egg',
    name: 'Verdant Soul Egg',
    category: 'egg',
    image: require('../../assets/eggs/rare/nature/Verdant Soul Egg.png'),
  },
  {
    id: 'sunforge-egg',
    name: 'Sunforge Egg',
    category: 'egg',
    image: require('../../assets/eggs/legendary/solar/Sunforge Egg.png'),
  },
  {
    id: 'dreammoon-egg',
    name: 'Dreammoon Egg',
    category: 'egg',
    image: require('../../assets/eggs/legendary/lunar/Dreammoon Egg.png'),
  },
  {
    id: 'venomcore-egg',
    name: 'Venomcore Egg',
    category: 'egg',
    image: require('../../assets/eggs/epic/toxic/Venomcore Egg.png'),
  },
  {
    id: 'primordial-egg',
    name: 'Primordial Egg',
    category: 'egg',
    image: require('../../assets/eggs/mythic/ancient/Primordial Egg.png'),
  },
];

const LEVELS: LevelConfig[] = [
  { level: 1, pairCount: 6, categories: ['relic'], moveLimit: null, timeLimit: null },
  { level: 2, pairCount: 6, categories: ['food'], moveLimit: 18, timeLimit: null },
  { level: 3, pairCount: 8, categories: ['egg'], moveLimit: null, timeLimit: null },
  { level: 4, pairCount: 8, categories: ['relic', 'food'], moveLimit: 24, timeLimit: null },
  { level: 5, pairCount: 8, categories: ['relic', 'egg', 'food'], moveLimit: null, timeLimit: 75 },
  { level: 6, pairCount: 10, categories: ['relic', 'egg', 'food'], moveLimit: 30, timeLimit: null },
  { level: 7, pairCount: 10, categories: ['relic', 'egg', 'food'], moveLimit: null, timeLimit: 70 },
  { level: 8, pairCount: 12, categories: ['relic', 'egg', 'food'], moveLimit: null, timeLimit: 90 },
  { level: 9, pairCount: 12, categories: ['relic', 'egg', 'food'], moveLimit: 34, timeLimit: null },
  { level: 10, pairCount: 12, categories: ['relic', 'egg', 'food'], moveLimit: 32, timeLimit: 80 },
];

function normalizeProgress(value: unknown): MatchingCardsProgress {
  if (!value || typeof value !== 'object') {
    return DEFAULT_PROGRESS;
  }

  const stored = value as Partial<MatchingCardsProgress>;
  const completedLevels = Array.isArray(stored.completedLevels)
    ? [...new Set(
        stored.completedLevels.filter(
          (level): level is number =>
            Number.isInteger(level) && level >= 1 && level <= LEVELS.length,
        ),
      )].sort((a, b) => a - b)
    : [];
  const completedUnlock = completedLevels.length
    ? Math.min(LEVELS.length, Math.max(...completedLevels) + 1)
    : 1;
  const storedUnlocked = Number.isInteger(stored.highestUnlockedLevel)
    ? Number(stored.highestUnlockedLevel)
    : 1;
  const bestScoresByLevel =
    stored.bestScoresByLevel && typeof stored.bestScoresByLevel === 'object'
      ? Object.fromEntries(
          Object.entries(stored.bestScoresByLevel).filter(
            ([level, score]) =>
              Number(level) >= 1 &&
              Number(level) <= LEVELS.length &&
              typeof score === 'number' &&
              Number.isFinite(score) &&
              score >= 0,
          ),
        )
      : {};

  return {
    highestUnlockedLevel: Math.min(
      LEVELS.length,
      Math.max(1, storedUnlocked, completedUnlock),
    ),
    completedLevels,
    bestScore:
      typeof stored.bestScore === 'number' &&
      Number.isFinite(stored.bestScore) &&
      stored.bestScore >= 0
        ? Math.floor(stored.bestScore)
        : 0,
    bestScoresByLevel,
  };
}

function calculateLevelScore(
  level: LevelConfig,
  moves: number,
  timeRemaining: number | null,
) {
  const baseScore = level.level * 100;
  const efficientMoveTarget = level.moveLimit ?? level.pairCount * 3;
  const moveBonus = Math.max(0, efficientMoveTarget - moves) * 15;
  const timeBonus =
    level.timeLimit === null ? 0 : Math.max(0, timeRemaining ?? 0) * 5;

  return Math.max(0, Math.floor(baseScore + moveBonus + timeBonus));
}

function shuffleItems<T>(items: readonly T[]) {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [
      shuffled[randomIndex],
      shuffled[index],
    ];
  }

  return shuffled;
}

function createDeck(level: LevelConfig) {
  const eligibleItems = ITEM_POOL.filter((item) =>
    level.categories.includes(item.category),
  );
  const requiredCategoryItems = level.categories.map((category) =>
    shuffleItems(eligibleItems.filter((item) => item.category === category))[0],
  );
  const selectedIds = new Set(requiredCategoryItems.map((item) => item.id));
  const remainingItems = shuffleItems(
    eligibleItems.filter((item) => !selectedIds.has(item.id)),
  ).slice(0, level.pairCount - requiredCategoryItems.length);
  const selectedItems = [...requiredCategoryItems, ...remainingItems];

  const cards = selectedItems.flatMap((item) =>
    [0, 1].map((copyNumber) => ({
      ...item,
      id: `${item.id}-${copyNumber}`,
      pairId: item.id,
      matched: false,
      faceUp: false,
    })),
  );

  return shuffleItems(cards);
}

function getGoalText(level: LevelConfig) {
  if (level.moveLimit && level.timeLimit) {
    return `Match all ${level.pairCount} pairs in ${level.moveLimit} moves and ${level.timeLimit} seconds.`;
  }

  if (level.moveLimit) {
    return `Match all cards in ${level.moveLimit} moves.`;
  }

  if (level.timeLimit) {
    return `Match all ${level.pairCount} pairs before ${level.timeLimit} seconds run out.`;
  }

  return `Find all ${level.pairCount} matching pairs.`;
}

function getCategoryLabel(categories: CardCategory[]) {
  if (categories.length > 1) {
    return 'MIXED MEMORY';
  }

  return `${categories[0].toUpperCase()} MEMORY`;
}

const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);

function MemoryCard({
  card,
  disabled,
  width,
  onPress,
}: {
  card: MatchingCard;
  disabled: boolean;
  width: number;
  onPress: () => void;
}) {
  const isVisible = card.faceUp || card.matched;
  const reducedMotion = useReducedMotion();
  const flipProgress = useSharedValue(isVisible ? 1 : 0);

  useEffect(() => {
    flipProgress.set(
      withTiming(isVisible ? 1 : 0, {
        duration: reducedMotion ? 0 : 180,
        easing: EASE_IN_OUT,
        reduceMotion: ReduceMotion.System,
      }),
    );
  }, [flipProgress, isVisible, reducedMotion]);

  const cardBackStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 800 },
      {
        rotateY: `${interpolate(flipProgress.get(), [0, 1], [0, 180])}deg`,
      },
    ],
  }));

  const cardFrontStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 800 },
      {
        rotateY: `${interpolate(flipProgress.get(), [0, 1], [180, 360])}deg`,
      },
    ],
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={isVisible ? card.name : 'Face-down memory card'}
      accessibilityState={{ disabled, selected: isVisible }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { width, height: width * 1.18 },
        pressed && !isVisible ? styles.cardPressed : undefined,
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[styles.cardFace, styles.cardFaceDown, cardBackStyle]}
      >
        <View style={styles.cardBackInner}>
          <Ionicons name="diamond-outline" size={30} color="#62E7FF" />
          <Text style={styles.cardBackMark}>?</Text>
        </View>
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.cardFace,
          styles.cardFaceUp,
          card.matched ? styles.cardMatched : undefined,
          cardFrontStyle,
        ]}
      >
        <Image source={card.image} resizeMode="contain" style={styles.cardImage} />
        <Text numberOfLines={2} style={styles.cardName}>
          {card.name}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

export default function CompanionMatchingCardsScreen() {
  const router = useRouter();
  const safeArea = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [levelIndex, setLevelIndex] = useState(0);
  const levelConfig = LEVELS[levelIndex] ?? LEVELS[0];
  const [cards, setCards] = useState<MatchingCard[]>(() => createDeck(LEVELS[0]));
  const [matches, setMatches] = useState(0);
  const [moves, setMoves] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(
    LEVELS[0].timeLimit,
  );
  const [boardLocked, setBoardLocked] = useState(false);
  const [gameStatus, setGameStatus] = useState<GameStatus>('intro');
  const [failureReason, setFailureReason] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [rewardText, setRewardText] = useState('');
  const [isNewBest, setIsNewBest] = useState(false);
  const [progress, setProgress] = useState<MatchingCardsProgress>(DEFAULT_PROGRESS);
  const [progressLoaded, setProgressLoaded] = useState(false);
  const [isSavingProgress, setIsSavingProgress] = useState(false);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const cardsRef = useRef(cards);
  const movesRef = useRef(0);
  const matchesRef = useRef(0);
  const firstCardIdRef = useRef<string | null>(null);
  const boardLockedRef = useRef(true);
  const gameStatusRef = useRef<GameStatus>('intro');
  const mismatchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressRef = useRef<MatchingCardsProgress>(DEFAULT_PROGRESS);
  const saveInFlightRef = useRef(false);
  const resultActionRef = useRef(false);
  const mountedRef = useRef(true);

  const columnCount = levelConfig.pairCount >= 8 ? 4 : 3;
  const cardWidth = useMemo(
    () => {
      const boardWidth = Math.min(width - 32, 430);
      return Math.min(132, (boardWidth - (columnCount - 1) * 8) / columnCount);
    },
    [columnCount, width],
  );

  const clearMismatchTimeout = useCallback(() => {
    if (mismatchTimeoutRef.current) {
      clearTimeout(mismatchTimeoutRef.current);
      mismatchTimeoutRef.current = null;
    }
  }, []);

  const persistProgress = useCallback(async (nextProgress: MatchingCardsProgress) => {
    saveInFlightRef.current = true;
    if (mountedRef.current) {
      setIsSavingProgress(true);
    }

    try {
      await SecureStore.setItemAsync(
        PROGRESS_STORAGE_KEY,
        JSON.stringify(nextProgress),
      );
      if (mountedRef.current) {
        setStorageWarning(null);
      }
    } catch (error) {
      console.warn('Unable to save Matching Cards progress.', error);
      if (mountedRef.current) {
        setStorageWarning('Progress is available this session but could not be saved.');
      }
    } finally {
      saveInFlightRef.current = false;
      if (mountedRef.current) {
        setIsSavingProgress(false);
      }
    }
  }, []);

  const finishRound = useCallback(
    (
      result: Extract<GameStatus, 'complete' | 'failed'>,
      reason: string | null = null,
    ) => {
      if (gameStatusRef.current !== 'playing') {
        return false;
      }

      clearMismatchTimeout();
      gameStatusRef.current = result;
      boardLockedRef.current = true;
      setBoardLocked(true);
      setFailureReason(reason);
      setGameStatus(result);
      return true;
    },
    [clearMismatchTimeout],
  );

  const prepareLevel = useCallback((nextLevelIndex: number) => {
    const safeLevelIndex = Math.min(
      Math.max(0, nextLevelIndex),
      LEVELS.length - 1,
    );
    const nextLevel = LEVELS[safeLevelIndex];

    clearMismatchTimeout();
    setLevelIndex(safeLevelIndex);
    gameStatusRef.current = 'intro';
    boardLockedRef.current = true;
    firstCardIdRef.current = null;
    resultActionRef.current = false;
    setBoardLocked(true);
    setGameStatus('intro');
    setFailureReason(null);
    setMatches(0);
    setMoves(0);
    matchesRef.current = 0;
    movesRef.current = 0;
    setScore(0);
    setRewardText('');
    setIsNewBest(false);
    setTimeRemaining(nextLevel.timeLimit);
    const nextDeck = createDeck(nextLevel);
    cardsRef.current = nextDeck;
    setCards(nextDeck);
  }, [clearMismatchTimeout]);

  const beginLevel = useCallback(() => {
    if (!progressLoaded || gameStatusRef.current !== 'intro') {
      return;
    }

    gameStatusRef.current = 'playing';
    boardLockedRef.current = false;
    firstCardIdRef.current = null;
    setBoardLocked(false);
    setGameStatus('playing');
  }, [progressLoaded]);

  const restartGame = useCallback(() => {
    prepareLevel(levelIndex);
  }, [levelIndex, prepareLevel]);

  useEffect(() => {
    mountedRef.current = true;
    let active = true;

    const loadProgress = async () => {
      try {
        const storedProgress = await SecureStore.getItemAsync(PROGRESS_STORAGE_KEY);
        const nextProgress = normalizeProgress(
          storedProgress ? JSON.parse(storedProgress) : DEFAULT_PROGRESS,
        );

        if (!active) {
          return;
        }

        progressRef.current = nextProgress;
        setProgress(nextProgress);
        const resumeIndex = Math.max(0, nextProgress.highestUnlockedLevel - 1);
        setLevelIndex(resumeIndex);
        const resumeDeck = createDeck(LEVELS[resumeIndex]);
        cardsRef.current = resumeDeck;
        setCards(resumeDeck);
        setTimeRemaining(LEVELS[resumeIndex].timeLimit);
      } catch (error) {
        console.warn('Unable to load Matching Cards progress.', error);
        if (active) {
          setStorageWarning('Saved progress could not be loaded on this device.');
        }
      } finally {
        if (active) {
          setProgressLoaded(true);
        }
      }
    };

    void loadProgress();

    return () => {
      active = false;
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => clearMismatchTimeout, [clearMismatchTimeout]);

  useEffect(() => {
    if (gameStatus !== 'playing' || timeRemaining === null) {
      return;
    }

    if (timeRemaining <= 0) {
      finishRound('failed', 'Time expired before all pairs were matched.');
      return;
    }

    const timer = setTimeout(() => {
      setTimeRemaining((currentTime) =>
        currentTime === null ? null : Math.max(0, currentTime - 1),
      );
    }, 1000);

    return () => clearTimeout(timer);
  }, [finishRound, gameStatus, timeRemaining]);

  const completeLevel = useCallback(
    (completedMoves: number) => {
      if (!finishRound('complete')) {
        return;
      }

      const completedLevel = levelConfig.level;
      const earnedScore = calculateLevelScore(
        levelConfig,
        completedMoves,
        timeRemaining,
      );
      const previousProgress = progressRef.current;
      const firstClear = !previousProgress.completedLevels.includes(completedLevel);
      const previousLevelBest = previousProgress.bestScoresByLevel[String(completedLevel)] ?? 0;
      const nextProgress: MatchingCardsProgress = {
        highestUnlockedLevel: firstClear
          ? Math.min(
              LEVELS.length,
              Math.max(previousProgress.highestUnlockedLevel, completedLevel + 1),
            )
          : previousProgress.highestUnlockedLevel,
        completedLevels: firstClear
          ? [...previousProgress.completedLevels, completedLevel].sort((a, b) => a - b)
          : previousProgress.completedLevels,
        bestScore: Math.max(previousProgress.bestScore, earnedScore),
        bestScoresByLevel: {
          ...previousProgress.bestScoresByLevel,
          [String(completedLevel)]: Math.max(previousLevelBest, earnedScore),
        },
      };

      progressRef.current = nextProgress;
      setProgress(nextProgress);
      setScore(earnedScore);
      setIsNewBest(earnedScore > previousLevelBest);
      setRewardText(
        firstClear
          ? completedLevel < LEVELS.length
            ? `Level ${completedLevel + 1} unlocked • score saved locally`
            : 'All levels completed • score saved locally'
          : 'Replay complete • score only • no progression reward',
      );
      void persistProgress(nextProgress);
    },
    [finishRound, levelConfig, persistProgress, timeRemaining],
  );

  const handleCardPress = (card: MatchingCard) => {
    const selectedFirstCardId = firstCardIdRef.current;

    if (
      gameStatusRef.current !== 'playing' ||
      boardLockedRef.current ||
      card.matched ||
      card.faceUp ||
      selectedFirstCardId === card.id
    ) {
      return;
    }

    const cardsWithSelection = cardsRef.current.map((currentCard) =>
        currentCard.id === card.id
          ? { ...currentCard, faceUp: true }
          : currentCard,
      );
    cardsRef.current = cardsWithSelection;
    setCards(cardsWithSelection);

    if (!selectedFirstCardId) {
      firstCardIdRef.current = card.id;
      return;
    }

    const firstCard = cardsRef.current.find(
      (candidate) => candidate.id === selectedFirstCardId,
    );

    if (!firstCard || firstCard.id === card.id) {
      return;
    }

    boardLockedRef.current = true;
    setBoardLocked(true);
    const nextMoves = movesRef.current + 1;
    movesRef.current = nextMoves;
    setMoves(nextMoves);

    if (firstCard.pairId === card.pairId) {
      const matchedCards = cardsRef.current.map((currentCard) =>
          currentCard.pairId === card.pairId
            ? { ...currentCard, matched: true, faceUp: true }
            : currentCard,
        );
      cardsRef.current = matchedCards;
      setCards(matchedCards);
      const nextMatches = matchesRef.current + 1;
      matchesRef.current = nextMatches;
      setMatches(nextMatches);
      firstCardIdRef.current = null;

      if (nextMatches === levelConfig.pairCount) {
        completeLevel(nextMoves);
        return;
      }

      if (
        levelConfig.moveLimit !== null &&
        nextMoves >= levelConfig.moveLimit
      ) {
        finishRound('failed', 'The move limit was reached before all pairs were matched.');
        return;
      }

      boardLockedRef.current = false;
      setBoardLocked(false);
      return;
    }

    mismatchTimeoutRef.current = setTimeout(() => {
      const hiddenCards = cardsRef.current.map((currentCard) =>
          currentCard.id === firstCard.id || currentCard.id === card.id
            ? { ...currentCard, faceUp: false }
            : currentCard,
        );
      cardsRef.current = hiddenCards;
      setCards(hiddenCards);
      firstCardIdRef.current = null;
      mismatchTimeoutRef.current = null;

      if (
        levelConfig.moveLimit !== null &&
        nextMoves >= levelConfig.moveLimit
      ) {
        finishRound('failed', 'The move limit was reached before all pairs were matched.');
        return;
      }

      boardLockedRef.current = false;
      setBoardLocked(false);
    }, 700);
  };

  const selectLevel = (nextLevelIndex: number) => {
    const nextLevel = LEVELS[nextLevelIndex];

    if (
      !nextLevel ||
      nextLevel.level > progress.highestUnlockedLevel ||
      gameStatusRef.current === 'playing' ||
      saveInFlightRef.current
    ) {
      return;
    }

    prepareLevel(nextLevelIndex);
  };

  const runResultAction = (action: 'next' | 'replay' | 'select') => {
    if (resultActionRef.current || saveInFlightRef.current) {
      return;
    }

    resultActionRef.current = true;
    if (action === 'next') {
      prepareLevel(Math.min(levelIndex + 1, LEVELS.length - 1));
      return;
    }

    if (action === 'replay') {
      prepareLevel(levelIndex);
      return;
    }

    clearMismatchTimeout();
    gameStatusRef.current = 'intro';
    boardLockedRef.current = true;
    setBoardLocked(true);
    setGameStatus('intro');
    resultActionRef.current = false;
  };

  const timeUsed =
    levelConfig.timeLimit === null
      ? null
      : levelConfig.timeLimit - (timeRemaining ?? levelConfig.timeLimit);
  const isLastLevel = levelIndex === LEVELS.length - 1;
  const levelAlreadyCompleted = progress.completedLevels.includes(levelConfig.level);
  const rewardPreview = levelAlreadyCompleted
    ? 'Replay reward: score only. Your best score can improve.'
    : isLastLevel
      ? 'First clear: record Level 10 completion and your best score.'
      : `First clear: unlock Level ${levelConfig.level + 1} and save your score.`;

  return (
    <LinearGradient
      colors={['#030007', '#11041C', '#080016', '#030007']}
      style={styles.screen}
    >
      <StatusBar style="light" />

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: safeArea.top + 12,
            paddingBottom: safeArea.bottom + 30,
          },
        ]}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to Companion games"
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.headerButton,
              pressed ? styles.pressed : undefined,
            ]}
          >
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </Pressable>

          <View style={styles.headerCopy}>
            <Text style={styles.title}>MATCHING CARDS</Text>
            <Text style={styles.subtitle}>
              LEVEL {levelConfig.level} • {getCategoryLabel(levelConfig.categories)}
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Restart matching cards"
            onPress={restartGame}
            disabled={!progressLoaded || isSavingProgress}
            style={({ pressed }) => [
              styles.headerButton,
              styles.restartIcon,
              pressed ? styles.pressed : undefined,
            ]}
          >
            <Ionicons name="refresh" size={21} color="#62E7FF" />
          </Pressable>
        </View>

        <View style={styles.progressRow}>
          <View style={styles.progressStat}>
            <Text style={styles.statLabel}>CURRENT SCORE</Text>
            <Text style={styles.progressValue}>{score}</Text>
          </View>
          <View style={styles.progressStat}>
            <Text style={styles.statLabel}>BEST SCORE</Text>
            <Text style={styles.progressValue}>{progress.bestScore}</Text>
          </View>
          <View style={styles.progressStat}>
            <Text style={styles.statLabel}>HIGHEST LEVEL</Text>
            <Text style={styles.progressValue}>{progress.highestUnlockedLevel}</Text>
          </View>
        </View>

        <View style={styles.levelSelectCard}>
          <Text style={styles.levelSelectTitle}>LEVEL SELECT</Text>
          <View style={styles.levelSelectGrid}>
            {LEVELS.map((level, index) => {
              const locked = level.level > progress.highestUnlockedLevel;
              const completed = progress.completedLevels.includes(level.level);
              const selected = index === levelIndex;

              return (
                <Pressable
                  key={level.level}
                  accessibilityRole="button"
                  accessibilityLabel={
                    locked ? `Level ${level.level}, locked` : `Open Level ${level.level}`
                  }
                  accessibilityState={{ disabled: locked, selected }}
                  disabled={locked || gameStatus === 'playing' || isSavingProgress}
                  onPress={() => selectLevel(index)}
                  style={({ pressed }) => [
                    styles.levelSelectButton,
                    selected ? styles.levelSelectButtonSelected : undefined,
                    locked ? styles.levelSelectButtonLocked : undefined,
                    pressed ? styles.pressed : undefined,
                  ]}
                >
                  <Text
                    style={[
                      styles.levelSelectNumber,
                      locked ? styles.levelSelectNumberLocked : undefined,
                    ]}
                  >
                    {level.level}
                  </Text>
                  <Ionicons
                    name={locked ? 'lock-closed' : completed ? 'checkmark-circle' : 'play-circle'}
                    size={13}
                    color={locked ? '#5D5265' : completed ? '#FFD45A' : '#62E7FF'}
                  />
                </Pressable>
              );
            })}
          </View>
          {storageWarning ? <Text style={styles.storageWarning}>{storageWarning}</Text> : null}
        </View>

        <View style={styles.levelCard}>
          <View>
            <Text style={styles.levelLabel}>CURRENT MISSION</Text>
            <Text style={styles.levelValue}>Level {levelConfig.level}</Text>
          </View>

          <View style={styles.levelGoalBlock}>
            <Text style={styles.levelLabel}>GOAL</Text>
            <Text style={styles.levelGoal}>{getGoalText(levelConfig)}</Text>
          </View>
        </View>

        <View style={styles.statRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>MATCHES</Text>
            <Text style={styles.statValue}>
              {matches} / {levelConfig.pairCount}
            </Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statLabel}>MOVES</Text>
            <Text style={styles.statValue}>
              {moves}
              {levelConfig.moveLimit === null ? '' : ` / ${levelConfig.moveLimit}`}
            </Text>
          </View>

          {timeRemaining !== null ? (
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>TIME</Text>
              <Text
                style={[
                  styles.statValue,
                  timeRemaining <= 10 ? styles.statValueDanger : undefined,
                ]}
              >
                {timeRemaining}
              </Text>
            </View>
          ) : null}
        </View>

        {gameStatus === 'intro' ? (
          <View style={styles.introCard}>
            <Ionicons name="albums-outline" size={35} color="#62E7FF" />
            <Text style={styles.introEyebrow}>LEVEL {levelConfig.level} BRIEFING</Text>
            <Text style={styles.introTitle}>{getGoalText(levelConfig)}</Text>
            <View style={styles.introDetails}>
              <Text style={styles.introDetail}>{levelConfig.pairCount} PAIRS</Text>
              <Text style={styles.introDetail}>
                {levelConfig.moveLimit === null ? 'NO MOVE LIMIT' : `${levelConfig.moveLimit} MOVES`}
              </Text>
              <Text style={styles.introDetail}>
                {levelConfig.timeLimit === null ? 'NO TIMER' : `${levelConfig.timeLimit} SECONDS`}
              </Text>
            </View>
            <Text style={styles.rewardPreview}>{rewardPreview}</Text>
            <Pressable
              accessibilityRole="button"
              disabled={!progressLoaded}
              onPress={beginLevel}
              style={({ pressed }) => [
                styles.startButton,
                !progressLoaded ? styles.buttonDisabled : undefined,
                pressed ? styles.pressed : undefined,
              ]}
            >
              <Text style={styles.startButtonText}>
                {progressLoaded ? 'START LEVEL' : 'LOADING PROGRESS…'}
              </Text>
              <Ionicons name="play" size={17} color="#05000B" />
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={styles.instructions}>{getGoalText(levelConfig)}</Text>

            <View
              accessibilityLabel="Matching cards board"
              style={[
                styles.board,
                { maxWidth: cardWidth * columnCount + (columnCount - 1) * 8 },
              ]}
            >
              {cards.map((card) => (
                <MemoryCard
                  key={card.id}
                  card={card}
                  disabled={boardLocked || card.matched || gameStatus !== 'playing'}
                  width={cardWidth}
                  onPress={() => handleCardPress(card)}
                />
              ))}
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={restartGame}
              style={({ pressed }) => [
                styles.restartButton,
                pressed ? styles.pressed : undefined,
              ]}
            >
              <Ionicons name="refresh" size={18} color="#05000B" />
              <Text style={styles.restartButtonText}>RESTART GAME</Text>
            </Pressable>
          </>
        )}
      </ScrollView>

      <Modal
        animationType="fade"
        transparent
        visible={gameStatus === 'complete' || gameStatus === 'failed'}
        onRequestClose={() => {
          if (!saveInFlightRef.current) {
            restartGame();
          }
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.resultCard}>
            <View
              style={[
                styles.resultIcon,
                gameStatus === 'failed' ? styles.resultIconFailed : undefined,
              ]}
            >
              <Ionicons
                name={gameStatus === 'complete' ? 'sparkles' : 'close'}
                size={30}
                color={gameStatus === 'complete' ? '#FFF2A8' : '#FF7894'}
              />
            </View>

            <Text
              style={[
                styles.resultTitle,
                gameStatus === 'failed' ? styles.resultTitleFailed : undefined,
              ]}
            >
              {gameStatus === 'complete' ? 'LEVEL COMPLETE' : 'LEVEL FAILED'}
            </Text>

            <Text style={styles.resultLevel}>LEVEL {levelConfig.level}</Text>

            {gameStatus === 'failed' ? (
              <Text style={styles.resultReason}>{failureReason}</Text>
            ) : null}

            <View style={styles.resultStats}>
              <View style={styles.resultStat}>
                <Text style={styles.resultStatLabel}>SCORE</Text>
                <Text style={styles.resultStatValue}>{score}</Text>
              </View>
              <View style={styles.resultStat}>
                <Text style={styles.resultStatLabel}>MOVES USED</Text>
                <Text style={styles.resultStatValue}>
                  {moves}{levelConfig.moveLimit === null ? '' : ` / ${levelConfig.moveLimit}`}
                </Text>
              </View>

              {timeUsed !== null ? (
                <View style={styles.resultStat}>
                  <Text style={styles.resultStatLabel}>TIME USED</Text>
                  <Text style={styles.resultStatValue}>{timeUsed}s</Text>
                </View>
              ) : null}
            </View>

            {timeRemaining !== null ? (
              <Text style={styles.timeRemainingText}>TIME REMAINING: {timeRemaining}s</Text>
            ) : null}
            {levelConfig.moveLimit !== null ? (
              <Text style={styles.timeRemainingText}>
                BEST ALLOWED: {levelConfig.moveLimit} MOVES
              </Text>
            ) : null}

            {gameStatus === 'complete' ? (
              <View style={styles.rewardResult}>
                <Text style={styles.rewardResultLabel}>REWARD</Text>
                <Text style={styles.rewardResultText}>{rewardText}</Text>
                {isNewBest ? <Text style={styles.newBestText}>NEW LEVEL BEST</Text> : null}
                {isSavingProgress ? <Text style={styles.savingText}>SAVING…</Text> : null}
                {storageWarning ? <Text style={styles.storageWarning}>{storageWarning}</Text> : null}
              </View>
            ) : (
              <Text style={styles.noRewardText}>NO REWARD • LEVEL NOT COMPLETED</Text>
            )}

            {gameStatus === 'complete' && !isLastLevel ? (
              <Pressable
                accessibilityRole="button"
                disabled={isSavingProgress}
                onPress={() => runResultAction('next')}
                style={({ pressed }) => [
                  styles.resultPrimaryButton,
                  pressed ? styles.pressed : undefined,
                ]}
              >
                <Text style={styles.resultPrimaryButtonText}>NEXT LEVEL</Text>
                <Ionicons name="arrow-forward" size={18} color="#05000B" />
              </Pressable>
            ) : null}

            {gameStatus === 'complete' && isLastLevel ? (
              <Text style={styles.finalLevelText}>ALL 10 LEVELS COMPLETE</Text>
            ) : null}

            <Pressable
              accessibilityRole="button"
              disabled={isSavingProgress}
              onPress={() => runResultAction('replay')}
              style={({ pressed }) => [
                styles.resultSecondaryButton,
                pressed ? styles.pressed : undefined,
              ]}
            >
              <Text style={styles.resultSecondaryButtonText}>
                {gameStatus === 'complete' ? 'REPLAY LEVEL' : 'TRY AGAIN'}
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              disabled={isSavingProgress}
              onPress={() => runResultAction('select')}
              style={({ pressed }) => [
                styles.resultTertiaryButton,
                pressed ? styles.pressed : undefined,
              ]}
            >
              <Text style={styles.resultTertiaryButtonText}>LEVEL SELECT</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 16,
  },
  header: {
    width: '100%',
    maxWidth: 430,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#8F3BFF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10, 4, 22, 0.92)',
  },
  restartIcon: {
    borderColor: '#245B70',
    backgroundColor: 'rgba(3, 16, 25, 0.92)',
  },
  headerCopy: {
    flex: 1,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  subtitle: {
    color: '#62E7FF',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 3,
  },
  levelCard: {
    width: '100%',
    maxWidth: 430,
    minHeight: 76,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#49305A',
    backgroundColor: 'rgba(15, 7, 24, 0.96)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 14,
  },
  levelLabel: {
    color: '#A492B1',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  levelValue: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '900',
    marginTop: 3,
  },
  levelGoalBlock: {
    flex: 1,
    alignItems: 'flex-end',
  },
  levelGoal: {
    maxWidth: 260,
    color: '#FFFFFF',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
    textAlign: 'right',
    marginTop: 3,
  },
  progressRow: {
    width: '100%',
    maxWidth: 430,
    flexDirection: 'row',
    gap: 8,
  },
  progressStat: {
    flex: 1,
    minHeight: 58,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#3C2850',
    backgroundColor: 'rgba(10, 5, 18, 0.96)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  progressValue: {
    color: '#62E7FF',
    fontSize: 17,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    marginTop: 3,
  },
  levelSelectCard: {
    width: '100%',
    maxWidth: 430,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#342441',
    backgroundColor: 'rgba(8, 5, 16, 0.95)',
    padding: 12,
    gap: 9,
  },
  levelSelectTitle: {
    color: '#A492B1',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.9,
  },
  levelSelectGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  levelSelectButton: {
    width: 52,
    minHeight: 39,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#345B69',
    backgroundColor: 'rgba(5, 22, 30, 0.9)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  levelSelectButtonSelected: {
    borderColor: '#D453FF',
    backgroundColor: 'rgba(59, 12, 78, 0.88)',
  },
  levelSelectButtonLocked: {
    borderColor: '#29222D',
    backgroundColor: 'rgba(9, 7, 11, 0.78)',
  },
  levelSelectNumber: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  levelSelectNumberLocked: {
    color: '#625868',
  },
  storageWarning: {
    color: '#FFB067',
    fontSize: 10,
    lineHeight: 14,
  },
  statRow: {
    width: '100%',
    maxWidth: 430,
    flexDirection: 'row',
    gap: 8,
  },
  statCard: {
    flex: 1,
    minHeight: 62,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#342441',
    backgroundColor: 'rgba(8, 5, 16, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    paddingVertical: 8,
  },
  statLabel: {
    color: '#A492B1',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    marginTop: 3,
  },
  statValueDanger: {
    color: '#FF7894',
  },
  instructions: {
    maxWidth: 410,
    color: '#B8AFC1',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  introCard: {
    width: '100%',
    maxWidth: 430,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#6C36A3',
    backgroundColor: 'rgba(18, 6, 30, 0.96)',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
    gap: 12,
  },
  introEyebrow: {
    color: '#D453FF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  introTitle: {
    maxWidth: 340,
    color: '#FFFFFF',
    fontSize: 18,
    lineHeight: 25,
    fontWeight: '900',
    textAlign: 'center',
  },
  introDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 7,
  },
  introDetail: {
    color: '#BBDDE5',
    fontSize: 9,
    fontWeight: '900',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#294B58',
    backgroundColor: '#07141B',
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  rewardPreview: {
    maxWidth: 350,
    color: '#FFF2A8',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  startButton: {
    width: '100%',
    maxWidth: 290,
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: '#62E7FF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  startButtonText: {
    color: '#05000B',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  buttonDisabled: {
    opacity: 0.48,
  },
  board: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  card: {
    borderRadius: 16,
    backgroundColor: '#0A0311',
  },
  cardFace: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backfaceVisibility: 'hidden',
  },
  cardFaceUp: {
    borderColor: '#62E7FF',
    backgroundColor: 'rgba(7, 22, 34, 0.98)',
  },
  cardFaceDown: {
    borderColor: '#6C36A3',
    backgroundColor: '#160722',
  },
  cardMatched: {
    borderColor: '#FFD45A',
    backgroundColor: 'rgba(47, 31, 7, 0.96)',
  },
  cardPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.97 }],
  },
  cardBackInner: {
    width: '72%',
    height: '72%',
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#35234D',
    backgroundColor: '#0A0311',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  cardBackMark: {
    color: '#D453FF',
    fontSize: 19,
    fontWeight: '900',
  },
  cardImage: {
    width: '74%',
    height: '68%',
  },
  cardName: {
    width: '90%',
    color: '#FFFFFF',
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 3,
  },
  restartButton: {
    minWidth: 188,
    minHeight: 46,
    borderRadius: 23,
    backgroundColor: '#62E7FF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    gap: 8,
  },
  restartButtonText: {
    color: '#05000B',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  pressed: {
    opacity: 0.72,
  },
  modalBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(2, 0, 7, 0.84)',
    paddingHorizontal: 22,
  },
  resultCard: {
    width: '100%',
    maxWidth: 390,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#7F3DA0',
    backgroundColor: '#12051D',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 26,
    gap: 12,
  },
  resultIcon: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 1,
    borderColor: '#FFD45A',
    backgroundColor: 'rgba(69, 43, 5, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultIconFailed: {
    borderColor: '#B62E50',
    backgroundColor: 'rgba(69, 7, 24, 0.72)',
  },
  resultTitle: {
    color: '#FFF2A8',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  resultTitleFailed: {
    color: '#FF7894',
  },
  resultLevel: {
    color: '#62E7FF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  resultReason: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  resultStats: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
  },
  resultStat: {
    flex: 1,
    minHeight: 62,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#3B2746',
    backgroundColor: '#09030F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultStatLabel: {
    color: '#9789A0',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  resultStatValue: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    marginTop: 3,
  },
  timeRemainingText: {
    color: '#B8AFC1',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  rewardResult: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#705817',
    backgroundColor: 'rgba(45, 31, 5, 0.62)',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  rewardResultLabel: {
    color: '#FFD45A',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.9,
  },
  rewardResultText: {
    color: '#FFF8CF',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  newBestText: {
    color: '#62E7FF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  savingText: {
    color: '#B8AFC1',
    fontSize: 8,
    fontWeight: '800',
  },
  noRewardText: {
    color: '#FF7894',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  resultPrimaryButton: {
    width: '100%',
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: '#62E7FF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  resultPrimaryButtonText: {
    color: '#05000B',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  resultSecondaryButton: {
    width: '100%',
    minHeight: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: '#8F3BFF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(18, 6, 30, 0.92)',
  },
  resultSecondaryButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  resultTertiaryButton: {
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  resultTertiaryButtonText: {
    color: '#AFA3B8',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  finalLevelText: {
    color: '#FFF2A8',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
});
