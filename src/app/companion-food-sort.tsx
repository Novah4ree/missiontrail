import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  Animated,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type GestureResponderEvent,
  type ImageSourcePropType,
} from 'react-native';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { supabase } from '../../lib/supabase';

import {
  FOOD_SORT_COLUMNS,
  FOOD_SORT_ROWS,
  areFoodSortTilesAdjacent,
  createEmptyCollected,
  createFoodSortBoard,
  findFoodSortMatches,
  resolveFoodSortBoard,
  swapFoodSortTiles,
  type FoodSortCollected,
  type FoodSortFoodId,
  type FoodSortTile,
} from '@/utils/food-sort-game';

import {
  getLevelConfig,
  type FoodSortLevelGoal,
} from '@/utils/food-sort-level';

import {
  countFoodSortObstacles,
  createFoodSortObstacleBoard,
  damageFoodSortObstacles,
  damageFoodSortRelics,
  spreadFoodSortSlime,
  type FoodSortObstacleBoard,
} from '@/utils/food-sort-obstacles';


const companionImage =
  require(
    '../../assets/images/tabIcons/companion.png',
  );


// ============================================================
// FOOD ART
// Uses food PNGs already inside Mission Trails.
// ============================================================

const FOOD_ART:
  Record<
    FoodSortFoodId,
    {
      label: string;
      image:
        ImageSourcePropType;
    }
  > = {
  treat: {
    label: 'Treat',
    image: require(
      '../../assets/images/companionfoodicons/bakedtreatssweets-happines/aurorapudding.png',
    ),
  },

  carrot: {
    label: 'Carrot',
    image: require(
      '../../assets/images/companionfoodicons/fruitsquick-energy/embercarrot.png',
    ),
  },

  berry: {
    label: 'Berry',
    image: require(
      '../../assets/images/companionfoodicons/fruitsquick-energy/cosmicberry.png',
    ),
  },

  drink: {
    label: 'Drink',
    image: require(
      '../../assets/images/companionfoodicons/drinks-recovery/electrowaterbottle.png',
    ),
  },

  meal: {
    label: 'Meal',
    image: require(
      '../../assets/images/companionfoodicons/proteinfullmeals-hungerrestoration/powerbowl.png',
    ),
  },
};



// ============================================================
// FOOD SORT LEVEL THEMES
//
// Purpose:
// Gives later Food Sort levels different Mission Trails foods
// while keeping each match type visually consistent.
// ============================================================

type FoodSortArtEntry = {
  label: string;
  image: ImageSourcePropType;
};


type FoodSortArtSet =
  Record<
    FoodSortFoodId,
    FoodSortArtEntry
  >;


const FOOD_ART_SETS:
  FoodSortArtSet[] = [

  // LEVEL THEME 1
  FOOD_ART,


  // LEVEL THEME 2
  {
    treat: {
      label: 'Galaxy Donut',
      image: require(
        '../../assets/images/companionfoodicons/bakedtreatssweets-happines/galaxydonut.png',
      ),
    },

    carrot: {
      label: 'Neon Apple',
      image: require(
        '../../assets/images/companionfoodicons/fruitsquick-energy/neonapple.png',
      ),
    },

    berry: {
      label: 'Plasma Grapes',
      image: require(
        '../../assets/images/companionfoodicons/fruitsquick-energy/plasmagrapes.png',
      ),
    },

    drink: {
      label: 'Moon Milk',
      image: require(
        '../../assets/images/companionfoodicons/drinks-recovery/moonmilk.png',
      ),
    },

    meal: {
      label: 'Meteor Burger',
      image: require(
        '../../assets/images/companionfoodicons/proteinfullmeals-hungerrestoration/meteorburger.png',
      ),
    },
  },


  // LEVEL THEME 3
  {
    treat: {
      label: 'Comet Cupcake',
      image: require(
        '../../assets/images/companionfoodicons/bakedtreatssweets-happines/cometcupcake.png',
      ),
    },

    carrot: {
      label: 'Solar Mango',
      image: require(
        '../../assets/images/companionfoodicons/fruitsquick-energy/solarmango.png',
      ),
    },

    berry: {
      label: 'Icy Frost Melon',
      image: require(
        '../../assets/images/companionfoodicons/fruitsquick-energy/icyfrostmelon.png',
      ),
    },

    drink: {
      label: 'Dream Tea',
      image: require(
        '../../assets/images/companionfoodicons/drinks-recovery/dreamtea.png',
      ),
    },

    meal: {
      label: 'Energy Steak',
      image: require(
        '../../assets/images/companionfoodicons/proteinfullmeals-hungerrestoration/energysteak.png',
      ),
    },
  },


  // LEVEL THEME 4
  {
    treat: {
      label: 'Novah Waffle',
      image: require(
        '../../assets/images/companionfoodicons/bakedtreatssweets-happines/novahwaffle.png',
      ),
    },

    carrot: {
      label: 'Rainbow Starfruit',
      image: require(
        '../../assets/images/companionfoodicons/fruitsquick-energy/rainbowstarfruit.png',
      ),
    },

    berry: {
      label: 'Cosmic Berry',
      image: require(
        '../../assets/images/companionfoodicons/fruitsquick-energy/cosmicberry.png',
      ),
    },

    drink: {
      label: 'Stamina Smooth',
      image: require(
        '../../assets/images/companionfoodicons/drinks-recovery/staminasmooth.png',
      ),
    },

    meal: {
      label: 'Salmon',
      image: require(
        '../../assets/images/companionfoodicons/proteinfullmeals-hungerrestoration/salmon.png',
      ),
    },
  },


  // LEVEL THEME 5
  {
    treat: {
      label: 'Pixel Macaron',
      image: require(
        '../../assets/images/companionfoodicons/bakedtreatssweets-happines/pixelmacaron.png',
      ),
    },

    carrot: {
      label: 'Ember Carrot',
      image: require(
        '../../assets/images/companionfoodicons/fruitsquick-energy/embercarrot.png',
      ),
    },

    berry: {
      label: 'Plasma Grapes',
      image: require(
        '../../assets/images/companionfoodicons/fruitsquick-energy/plasmagrapes.png',
      ),
    },

    drink: {
      label: 'Sunbeam Soup',
      image: require(
        '../../assets/images/companionfoodicons/drinks-recovery/sunbeamsoup.png',
      ),
    },

    meal: {
      label: 'Turbo Drumstick',
      image: require(
        '../../assets/images/companionfoodicons/proteinfullmeals-hungerrestoration/turbodrumstick.png',
      ),
    },
  },


  // LEVEL THEME 6
  {
    treat: {
      label: 'Star Biscuit',
      image: require(
        '../../assets/images/companionfoodicons/bakedtreatssweets-happines/starbiscuit.png',
      ),
    },

    carrot: {
      label: 'Neon Apple',
      image: require(
        '../../assets/images/companionfoodicons/fruitsquick-energy/neonapple.png',
      ),
    },

    berry: {
      label: 'Rainbow Starfruit',
      image: require(
        '../../assets/images/companionfoodicons/fruitsquick-energy/rainbowstarfruit.png',
      ),
    },

    drink: {
      label: 'Electro Water',
      image: require(
        '../../assets/images/companionfoodicons/drinks-recovery/electrowaterbottle.png',
      ),
    },

    meal: {
      label: 'Power Bowl',
      image: require(
        '../../assets/images/companionfoodicons/proteinfullmeals-hungerrestoration/powerbowl.png',
      ),
    },
  },
];


// Purpose:
// Selects one consistent food theme for the whole level.
//
// Level 1 = theme 1
// Level 2 = theme 2
// ...
// After the last theme, the themes rotate again.
// ============================================================
// RARE FOOD SORT SNACKS
// ============================================================
//
// Purpose:
// Occasionally lets rare companion foods appear
// as the Treat artwork during Food Sort.
//
// This is VISUAL variety only.
// It does not change matching, scoring, or rewards.
// ============================================================

const RARE_FOOD_SORT_TREATS:
  FoodSortArtEntry[] = [
  {
    label: 'Crystal Rock',

    image: require(
      '../../assets/images/companionfoodicons/mythicboost/crystalrock.png',
    ),
  },

  {
    label: 'Cyber Lollipop',

    image: require(
      '../../assets/images/companionfoodicons/mythicboost/cyberlollipop.png',
    ),
  },

  {
    label: 'Infinity Candy',

    image: require(
      '../../assets/images/companionfoodicons/mythicboost/infinitycandy.png',
    ),
  },

  {
    label: 'Jelly Beans',

    image: require(
      '../../assets/images/companionfoodicons/mythicboost/jellybeans.png',
    ),
  },

  {
    label: 'Quantum Gummy',

    image: require(
      '../../assets/images/companionfoodicons/mythicboost/quantumgummy.png',
    ),
  },

  {
    label: 'Stardust Taffy',

    image: require(
      '../../assets/images/companionfoodicons/mythicboost/stardusttaffy.png',
    ),
  },

  {
    label: 'Time Crystal Cake',

    image: require(
      '../../assets/images/companionfoodicons/mythicboost/timecrystalcake.png',
    ),
  },
];


function getFoodSortArtSet(
  _level: number,
  forceRareTreat = false,
): FoodSortArtSet {
  // Purpose:
  // Creates a fresh random snack lineup
  // every time Food Sort starts.


  function randomSet() {
    return FOOD_ART_SETS[
      Math.floor(
        Math.random() *
        FOOD_ART_SETS.length,
      )
    ];
  }


  // Pick the two fruit categories separately.
  let carrotArt =
    randomSet().carrot;

  let berryArt =
    randomSet().berry;


  // Purpose:
  // Avoid showing the exact same fruit
  // image for two different match categories.
  let attempts = 0;

  while (
    carrotArt.image ===
      berryArt.image &&
    attempts < 8
  ) {
    berryArt =
      randomSet().berry;

    attempts += 1;
  }


  let treatArt =
    randomSet().treat;


  // Purpose:
  // About 1 out of every 4 rounds gets
  // a rare Mythic snack as the Treat skin.
  const getsRareTreat =
    forceRareTreat ||
    Math.random() < 0.06;


  if (getsRareTreat) {
    treatArt =
      RARE_FOOD_SORT_TREATS[
        Math.floor(
          Math.random() *
          RARE_FOOD_SORT_TREATS.length,
        )
      ];
  }


  return {
    treat:
      treatArt,

    carrot:
      carrotArt,

    berry:
      berryArt,

    drink:
      randomSet().drink,

    meal:
      randomSet().meal,
  };
}


const BOARD_GAP = 2;
const BOARD_PADDING = 4;


// Purpose: Gives the screen a safe Level 1
// while permanent progress loads from Supabase.
const INITIAL_LEVEL =
  getLevelConfig(1);


type GameStatus =
  | 'intro'
  | 'playing'
  | 'won'
  | 'lost';


type FailureReason =
  | 'time'
  | 'mistakes'
  | 'moves'
  | 'verification';


// Purpose: Adds newly matched foods to the
// player's current level totals.
function addCollectedFood(
  current:
    FoodSortCollected,
  earned:
    FoodSortCollected,
) {
  const next = {
    ...current,
  };

  next.treat += earned.treat;
  next.carrot += earned.carrot;
  next.berry += earned.berry;
  next.drink += earned.drink;
  next.meal += earned.meal;

  return next;
}


// Purpose: Checks if every level goal has
// been completed.
function goalsAreComplete(
  collected:
    FoodSortCollected,

  goals:
    FoodSortLevelGoal[],
) {
  return goals.every(
    (goal) =>
      collected[goal.foodId] >=
      goal.target,
  );
}


function totalCollectedFood(
  collected: FoodSortCollected,
) {
  return Object.values(collected).reduce(
    (total, amount) => total + amount,
    0,
  );
}


function calculateAccuracy(
  successfulMoves: number,
  mistakes: number,
) {
  const attempts =
    successfulMoves + mistakes;

  if (attempts === 0) {
    return 0;
  }

  return Math.round(
    successfulMoves /
      attempts *
      100,
  );
}


// Purpose: Renders the playable Mission Trails
// Companion Food Sort game.
export default function CompanionFoodSortScreen() {
  const router = useRouter();

  const safeArea =
    useSafeAreaInsets();

  const { width } =
    useWindowDimensions();


  const [
    levelConfig,
    setLevelConfig,
  ] =
    useState(
      INITIAL_LEVEL,
    );


  // Purpose:
  // Changes whenever a new Food Sort round starts.
  // This allows the same level to get fresh food artwork.
  const [
    foodArtRound,
    setFoodArtRound,
  ] =
    useState(0);


  // Purpose:
  // Keeps one consistent random set of food artwork
  // throughout the current round.
  const activeFoodArt =
    useMemo(
      () => {
        void foodArtRound;

        return getFoodSortArtSet(
          levelConfig.level,
          levelConfig.rareFoodRequired,
        );
      },
      [
        levelConfig.level,
        levelConfig.rareFoodRequired,
        foodArtRound,
      ],
    );


  const [board, setBoard] =
    useState<FoodSortTile[]>(
      () =>
        createFoodSortBoard(
          INITIAL_LEVEL.activeFoodIds,
          INITIAL_LEVEL.spawnWeights,
        ),
    );

  const [
    selectedIndex,
    setSelectedIndex,
  ] =
    useState<number | null>(
      null,
    );

  const [moves, setMoves] =
    useState(
      INITIAL_LEVEL.moves,
    );

  const [score, setScore] =
    useState(0);

  const [timeLeft, setTimeLeft] =
    useState(
      INITIAL_LEVEL.timeLimit,
    );

  const [mistakes, setMistakes] =
    useState(0);

  const [comboStreak, setComboStreak] =
    useState(0);

  const [bestCombo, setBestCombo] =
    useState(0);

  const [highestUnlockedLevel, setHighestUnlockedLevel] =
    useState(1);

  const [currentServerLevel, setCurrentServerLevel] =
    useState(1);

  const [showLevelSelect, setShowLevelSelect] =
    useState(false);

  const [
    collected,
    setCollected,
  ] =
    useState<FoodSortCollected>(
      () =>
        createEmptyCollected(),
    );

  const [
    gameStatus,
    setGameStatus,
  ] =
    useState<GameStatus>(
      'intro',
    );

  const [failureReason, setFailureReason] =
    useState<FailureReason | null>(
      null,
    );

  const [
    message,
    setMessage,
  ] =
    useState(
      'Swipe a food left, right, up, or down to make a match.',
    );

  const [
    runId,
    setRunId,
  ] =
    useState<string | null>(
      null,
    );

  const [
    isStartingRun,
    setIsStartingRun,
  ] =
    useState(false);

  const [
    isClaimingReward,
    setIsClaimingReward,
  ] =
    useState(false);

  const [
    rewardMessage,
    setRewardMessage,
  ] =
    useState<string | null>(
      null,
    );


  // Purpose:
  // Shows the Explorer Score actually awarded
  // by the server for the completed Food Sort level.
  const [
    earnedExplorerPoints,
    setEarnedExplorerPoints,
  ] =
    useState(0);


  // Purpose:
  // Shows the player's updated lifetime Explorer Score.
  const [
    totalExplorerScore,
    setTotalExplorerScore,
  ] =
    useState<number | null>(
      null,
    );


  // Purpose:
  // Shows the player's current global leaderboard rank.
  const [
    globalRank,
    setGlobalRank,
  ] =
    useState<number | null>(
      null,
    );


  // Purpose:
  // Stores Ice and future obstacles for each
  // square on the 6x6 Food Sort board.
  const [
    obstacles,
    setObstacles,
  ] =
    useState<FoodSortObstacleBoard>(
      () =>
        createFoodSortObstacleBoard(
          INITIAL_LEVEL.level,
          INITIAL_LEVEL.obstacleBudget,
          FOOD_SORT_ROWS *
            FOOD_SORT_COLUMNS,
        ),
    );


  // These refs guard server and round transitions that can happen
  // before React has committed the corresponding state update.
  const roundEndedRef =
    useRef(false);

  const mistakesRef =
    useRef(0);

  const comboStreakRef =
    useRef(0);

  const bestComboRef =
    useRef(0);

  const claimInFlightRef =
    useRef(false);

  const startInFlightRef =
    useRef(false);

  const isMountedRef =
    useRef(true);

  const runRequestIdRef =
    useRef(0);


  // Remembers where the player's finger started.
  const swipeStartRef =
    useRef<{
      index: number;
      x: number;
      y: number;
    } | null>(null);


  // Prevents the Pressable tap from firing again
  // immediately after a successful swipe.
  const ignoreNextPressRef =
    useRef(false);


  // Purpose:
  // Tracks which food is currently following
  // the player's finger during a swipe.
  const [
    draggingIndex,
    setDraggingIndex,
  ] =
    useState<number | null>(
      null,
    );


  // Purpose:
  // Moves the touched food visually before
  // the actual board swap is committed.
  const [dragOffset] = useState(
    () =>
      new Animated.ValueXY({
        x: 0,
        y: 0,
      }),
  );


  // Purpose:
  // Creates a visible blast over the board
  // for bombs, Mythics, and power combos.
  const [blastScale] = useState(
    () => new Animated.Value(0.4),
  );


  const [blastOpacity] = useState(
    () => new Animated.Value(0),
  );


  const [
    blastSymbol,
    setBlastSymbol,
  ] =
    useState('💥');


  // ============================================================
  // MATCH POP + FOOD DROP ANIMATION
  // ============================================================

  // Purpose:
  // Tracks the board positions currently exploding.
  const [
    poppingIndexes,
    setPoppingIndexes,
  ] =
    useState<number[]>([]);


  // Purpose:
  // Prevents another move while the board is animating.
  const [
    isBoardAnimating,
    setIsBoardAnimating,
  ] =
    useState(false);


  const [
    droppingFoods,
    setDroppingFoods,
  ] =
    useState(false);


  const [matchPopScale] = useState(
    () => new Animated.Value(1),
  );


  const [matchPopOpacity] = useState(
    () => new Animated.Value(1),
  );


  const [foodDropY] = useState(
    () => new Animated.Value(0),
  );


  const [foodDropOpacity] = useState(
    () => new Animated.Value(1),
  );


  // Purpose: Makes the 6x6 board use almost
  // the entire phone width while keeping every
  // tile perfectly square.
  const tileSize =
    useMemo(() => {
      const maximumBoardWidth =
        Math.min(
          width - 4,
          470,
        );

      return Math.floor(
        (
          maximumBoardWidth -
          BOARD_PADDING * 2 -
          BOARD_GAP *
            (
              FOOD_SORT_COLUMNS - 1
            )
        ) /
        FOOD_SORT_COLUMNS,
      );
    }, [width]);


  // Purpose: Calculates the exact board width
  // from six equal tiles, gaps, and padding.
  const actualBoardWidth =
    tileSize *
      FOOD_SORT_COLUMNS +
    BOARD_GAP *
      (
        FOOD_SORT_COLUMNS - 1
      ) +
    BOARD_PADDING * 2;


  // Purpose:
  // Temporary animation proof.
  // If this pulses on the iPhone, Animated is working
  // and the phone has loaded this exact source code.
  const [animationProofScale] = useState(
    () => new Animated.Value(0.75),
  );


  useEffect(() => {
    const animation =
      Animated.loop(
        Animated.sequence([
          Animated.timing(
            animationProofScale,
            {
              toValue: 1.3,
              duration: 450,
              useNativeDriver: true,
            },
          ),

          Animated.timing(
            animationProofScale,
            {
              toValue: 0.75,
              duration: 450,
              useNativeDriver: true,
            },
          ),
        ]),
      );

    animation.start();

    console.log(
      '[Food Sort] ANIMATION TEST BUILD LOADED',
    );

    return () => {
      animation.stop();
    };
  }, [
    animationProofScale,
  ]);


  // Purpose: Starts one secure Food Sort run on Supabase.
  async function startServerRun(
    requestedLevel?: number,
  ) {
    if (startInFlightRef.current) {
      return;
    }

    startInFlightRef.current =
      true;

    const requestId =
      runRequestIdRef.current + 1;

    runRequestIdRef.current =
      requestId;

    setIsStartingRun(true);
    setRunId(null);
    setRewardMessage(null);
    setFailureReason(null);

    roundEndedRef.current =
      false;

    mistakesRef.current =
      0;

    comboStreakRef.current =
      0;

    bestComboRef.current =
      0;


    // Purpose:
    // Give every new Food Sort game a fresh
    // random snack lineup.
    setFoodArtRound(
      previous =>
        previous + 1,
    );

    setEarnedExplorerPoints(
      0,
    );

    setTotalExplorerScore(
      null,
    );

    setGlobalRank(
      null,
    );

    try {
      // Purpose: Loads the permanent Food Sort
      // level saved on the player's account.
      const {
        data: progressData,
        error: progressError,
      } =
        await supabase.rpc(
          'server_get_food_sort_progress',
        );

      if (progressError) {
        throw progressError;
      }

      if (
        !isMountedRef.current ||
        requestId !==
          runRequestIdRef.current
      ) {
        return;
      }

      const progress =
        progressData &&
        typeof progressData === 'object'
          ? progressData as Record<string, unknown>
          : {};

      const serverLevel =
        Math.max(
          1,
          Number(
            progress.currentLevel ??
            1,
          ),
        );

      const serverHighestUnlocked =
        Math.max(
          serverLevel,
          1,
          Number(
            progress.highestLevel ??
            1,
          ),
        );

      setCurrentServerLevel(
        serverLevel,
      );

      setHighestUnlockedLevel(
        serverHighestUnlocked,
      );

      const selectedLevel =
        requestedLevel === undefined
          ? serverLevel
          : Math.max(
              1,
              Math.floor(
                requestedLevel,
              ),
            );

      if (
        selectedLevel >
        serverHighestUnlocked
      ) {
        throw new Error(
          `Level ${selectedLevel} is locked.`,
        );
      }

      // A small bounded seed changes equivalent target categories
      // and distractors on replays without changing difficulty.
      const replayVariant =
        Math.floor(
          Math.random() * 5,
        );

      let nextLevel =
        getLevelConfig(
          selectedLevel,
          replayVariant,
        );


      const { data, error } =
        await supabase.rpc(
          'server_start_food_sort_run_v3',
          {
            p_level:
              selectedLevel,
          },
        );

      if (error) {
        throw error;
      }

      if (
        !isMountedRef.current ||
        requestId !==
          runRequestIdRef.current
      ) {
        return;
      }

      const result =
        Array.isArray(data)
          ? data[0]
          : data;

      if (
        !result?.started ||
        !result?.run_id
      ) {
        throw new Error(
          String(
            result?.result_code ??
            'Food Sort run could not start.',
          ),
        );
      }

      // Purpose:
      // Uses the exact level attached to this server run.
      //
      // This prevents the UI from getting stuck on Level 1
      // when progression and run creation happen separately.
      const authoritativeLevel =
        Math.max(
          1,
          Number(
            result.level_number ??
            selectedLevel,
          ),
        );


      nextLevel =
        getLevelConfig(
          authoritativeLevel,
          replayVariant,
        );


      setRunId(
        String(result.run_id),
      );

      setLevelConfig(
        nextLevel,
      );

      setBoard(
        createFoodSortBoard(
          nextLevel.activeFoodIds,
          nextLevel.spawnWeights,
        ),
      );


      // Purpose:
      // Generates the Ice layout for this level.
      setObstacles(
        createFoodSortObstacleBoard(
          nextLevel.level,
          nextLevel.obstacleBudget,
          FOOD_SORT_ROWS *
            FOOD_SORT_COLUMNS,
        ),
      );


      setSelectedIndex(
        null,
      );

      setMoves(
        nextLevel.moves,
      );

      setScore(0);

      setTimeLeft(
        nextLevel.timeLimit,
      );

      setMistakes(0);

      setComboStreak(0);

      setBestCombo(0);

      setCollected(
        createEmptyCollected(),
      );

      setGameStatus(
        'intro',
      );

      setMessage(
        nextLevel.bossLevel
          ? `LEVEL ${nextLevel.level} CHECKPOINT! Review the goal, then start. 🔥`
          : `Level ${nextLevel.level} is ready. Review the goal, then start.`,
      );
    } catch (error) {
      console.warn(
        '[Food Sort] Could not start secure run.',
        error,
      );

      if (
        isMountedRef.current &&
        requestId ===
          runRequestIdRef.current
      ) {
        setMessage(
          error instanceof Error
            ? error.message
            : 'Food Sort could not connect to the reward server.',
        );
      }
    } finally {
      startInFlightRef.current =
        false;

      if (
        isMountedRef.current &&
        requestId ===
          runRequestIdRef.current
      ) {
        setIsStartingRun(false);
      }
    }
  }


  // Purpose:
  // Loads this player's current Explorer Score
  // and global leaderboard position.
  async function loadLeaderboardSnapshot() {
    try {
      const {
        data,
        error,
      } =
        await supabase.rpc(
          'server_get_explorer_leaderboard',
          {
            p_limit: 50,
          },
        );


      if (error) {
        throw error;
      }

      if (!isMountedRef.current) {
        return;
      }


      const rows =
        Array.isArray(data)
          ? data
          : [];


      const currentPlayer =
        rows.find(
          (row) =>
            row?.is_current_user ===
            true,
        );


      if (!currentPlayer) {
        return;
      }


      setTotalExplorerScore(
        Number(
          currentPlayer.explorer_score ??
          0,
        ),
      );


      setGlobalRank(
        Number(
          currentPlayer.rank_position ??
          0,
        ) || null,
      );

    } catch (error) {
      console.warn(
        '[Food Sort] Could not refresh leaderboard snapshot.',
        error,
      );
    }
  }


  // Purpose: Claims the fixed server-owned reward after a win.
  async function claimWinReward(
    completedRunId: string,
    finalScore: number,
    finalMoves: number,
  ) {
    if (claimInFlightRef.current) {
      return;
    }

    claimInFlightRef.current =
      true;

    setIsClaimingReward(true);
    setRewardMessage(
      'Claiming Mission Trails rewards...',
    );

    try {
      const { data, error } =
        await supabase.rpc(
          'server_complete_food_sort_run',
          {
            p_run_id:
              completedRunId,

            p_score:
              finalScore,

            p_moves_remaining:
              finalMoves,
          },
        );

      if (error) {
        throw error;
      }

      if (!isMountedRef.current) {
        return;
      }

      const result =
        Array.isArray(data)
          ? data[0]
          : data;

      if (!result?.completed) {
        const code =
          String(
            result?.result_code ??
            '',
          );

        if (
          code ===
          'RUN_TOO_FAST'
        ) {
          setRewardMessage(
            'That level finished too quickly for a secure reward. Play again for rewards.',
          );
        } else {
          setRewardMessage(
            'Level completed, but the reward could not be verified.',
          );
        }

        setFailureReason(
          'verification',
        );

        setGameStatus(
          'lost',
        );

        return;
      }

      // The completion update and unlock trigger share one server
      // transaction. Only a confirmed completion can expose N+1.
      const unlockedLevel =
        levelConfig.level + 1;

      setCurrentServerLevel(
        previous =>
          Math.max(
            previous,
            unlockedLevel,
          ),
      );

      setHighestUnlockedLevel(
        previous =>
          Math.max(
            previous,
            unlockedLevel,
          ),
      );

      const explorerPoints =
        Number(
          result.explorer_points ??
          0,
        );


      // Purpose:
      // Never invent leaderboard points on the phone.
      // Display exactly what Supabase awarded.
      setEarnedExplorerPoints(
        explorerPoints,
      );

      // Purpose:
      // Read the exact random companion food
      // selected by the Food Sort reward server.
      const rewardFoodName =
        typeof result.reward_food_name ===
          'string'
          ? result.reward_food_name
          : null;

      const rewardQuantity =
        Number(
          result.reward_quantity ??
            0,
        );

      const rewardKind =
        typeof result.reward_kind === 'string'
          ? result.reward_kind
          : 'completion';

      const rewardRarity =
        typeof result.reward_rarity === 'string'
          ? result.reward_rarity
          : null;

      const rewardKindLabel =
        rewardKind === 'milestone_first_clear'
          ? 'MILESTONE FIRST CLEAR'
          : rewardKind === 'first_clear'
            ? 'FIRST CLEAR'
            : rewardKind === 'replay'
              ? 'REPLAY REWARD'
              : 'LEVEL REWARD';


      if (result.rewarded) {
        setRewardMessage(
          rewardFoodName &&
          rewardQuantity > 0
            ? `${rewardKindLabel}! +${explorerPoints} Explorer Score • +${rewardQuantity} ${rewardFoodName}${rewardRarity ? ` (${rewardRarity})` : ''} • +5 Bond • +5 Happiness 🎁`
            : `${rewardKindLabel}! +${explorerPoints} Explorer Score • +5 Bond • +5 Happiness 🎁`,
        );


        // Purpose:
        // Celebrate only after the server confirms
        // this win actually received a reward.
        playRewardWinFx();

      } else {
        const resultCode =
          String(
            result.result_code ??
            '',
          );

        setRewardMessage(
          resultCode === 'REPLAY_SCORE_ONLY'
            ? `Replay complete: +${explorerPoints} Explorer Score. Replay food drops are intentionally reduced.`
            : `+${explorerPoints} Explorer Score. Today's Food Sort food reward limit has been reached.`,
        );
      }


      // Purpose:
      // The XP ledger was just updated.
      // Pull the player's new total and global rank.
      await loadLeaderboardSnapshot();
    } catch (error) {
      console.warn(
        '[Food Sort] Reward claim failed.',
        error,
      );

      if (isMountedRef.current) {
        setRewardMessage(
          'Level completion could not be verified. Try again while connected.',
        );

        setFailureReason(
          'verification',
        );

        setGameStatus(
          'lost',
        );
      }
    } finally {
      claimInFlightRef.current =
        false;

      if (isMountedRef.current) {
        setIsClaimingReward(false);
      }
    }
  }


  // Purpose: Restarts the displayed level without advancing it.
  async function restartGame() {
    setMessage(
      'Loading your next Food Sort challenge...',
    );

    await startServerRun(
      levelConfig.level,
    );
  }


  function beginLevel() {
    if (
      gameStatus !== 'intro' ||
      !runId ||
      isStartingRun
    ) {
      return;
    }

    setGameStatus('playing');
    setMessage(
      'Swipe a food left, right, up, or down to make a match.',
    );
  }


  function startNextLevel() {
    const nextLevel =
      levelConfig.level + 1;

    if (
      isClaimingReward ||
      nextLevel >
        highestUnlockedLevel
    ) {
      return;
    }

    void startServerRun(
      nextLevel,
    );
  }


  function selectLevel(
    selectedLevel: number,
  ) {
    if (
      selectedLevel >
        highestUnlockedLevel ||
      gameStatus === 'playing' ||
      isStartingRun ||
      isClaimingReward
    ) {
      return;
    }

    setShowLevelSelect(false);

    void startServerRun(
      selectedLevel,
    );
  }


  // Purpose: Creates the first secure run when the screen opens.
  useEffect(() => {
    isMountedRef.current =
      true;

    const startRunTimer = setTimeout(() => {
      if (isMountedRef.current) {
        void startServerRun();
      }
    }, 0);

    return () => {
      clearTimeout(startRunTimer);

      isMountedRef.current =
        false;

      runRequestIdRef.current +=
        1;
    };
  }, []);


  // The countdown starts only after the player dismisses the
  // level intro, so reading the objective never costs play time.
  useEffect(() => {
    if (gameStatus !== 'playing') {
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(previous => {
        if (roundEndedRef.current) {
          return previous;
        }

        if (previous <= 1) {
          roundEndedRef.current =
            true;

          setFailureReason('time');
          setGameStatus('lost');
          setMessage('Time is up. Try the level again!');
          return 0;
        }

        return previous - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, [gameStatus]);


  // Purpose: Performs one legal adjacent food swap.
  //
  // Both tapping and swiping use this same function,
  // so the game rules stay identical for both controls.
  function performFoodSwap(
    firstIndex: number,
    secondIndex: number,
  ) {
    if (
      gameStatus !== 'playing' ||
      roundEndedRef.current ||
      !runId ||
      isStartingRun ||
      isClaimingReward
    ) {
      return;
    }


    // Purpose:
    // Vines trap the food underneath them.
    //
    // The trapped food cannot be moved until
    // the Vine is broken by a nearby match.
    if (
      obstacles[firstIndex]?.type ===
        'vine' ||
      obstacles[secondIndex]?.type ===
        'vine'
    ) {
      setSelectedIndex(
        null,
      );

      setMessage(
        'That food is trapped in Vines! 🌿 Break the Vine with a match first.',
      );

      return;
    }


    // Purpose:
    // Buried Relic squares cannot move.
    //
    // Match food directly beside the Relic
    // to dig it out.
    if (
      obstacles[firstIndex]?.type ===
        'relic' ||
      obstacles[secondIndex]?.type ===
        'relic'
    ) {
      setSelectedIndex(
        null,
      );

      setMessage(
        'BURIED RELIC! 🗿 Match food beside it to dig it out.',
      );

      return;
    }


    if (
      !areFoodSortTilesAdjacent(
        firstIndex,
        secondIndex,
      )
    ) {
      setMessage(
        'Foods can only swap left, right, up, or down.',
      );

      return;
    }


    const swappedBoard =
      swapFoodSortTiles(
        board,
        firstIndex,
        secondIndex,
      );


    const firstMatch =
      findFoodSortMatches(
        swappedBoard,
      );


    // Invalid swaps bounce back.
    // They do NOT use one of the player's moves.
    if (
      firstMatch.size === 0
    ) {
      const nextMistakes =
        mistakesRef.current + 1;

      mistakesRef.current =
        nextMistakes;

      comboStreakRef.current =
        0;

      setComboStreak(0);

      setSelectedIndex(null);

      setMistakes(
        nextMistakes,
      );

      if (
        nextMistakes >=
        levelConfig.allowedMistakes + 1
      ) {
        roundEndedRef.current =
          true;

        setFailureReason(
          'mistakes',
        );

        setGameStatus('lost');
        setMessage(
          'Mistake limit reached. Try the level again!',
        );
        return;
      }

      setMessage(
        `That swap does not make a match. ${levelConfig.allowedMistakes - nextMistakes} mistake${levelConfig.allowedMistakes - nextMistakes === 1 ? '' : 's'} left.`,
      );

      return;
    }


    // Purpose:
    // Damages any Ice covering food that was
    // included in the player's successful match.
    const obstacleResult =
      damageFoodSortObstacles(
        obstacles,
        firstMatch,
      );


    // Purpose:
    // Buried Relics are damaged only by matches
    // directly beside them.
    const relicResult =
      damageFoodSortRelics(
        obstacleResult.obstacles,
        firstMatch,
        FOOD_SORT_COLUMNS,
      );


    // Purpose:
    // After the match damages blockers, surviving
    // Toxic Slime can spread to one neighboring tile.
    const completedMoveNumber =
      levelConfig.moves -
      moves +
      1;


    const slimeResult =
      spreadFoodSortSlime(
        relicResult.obstacles,
        levelConfig.level,
        completedMoveNumber,
        FOOD_SORT_ROWS,
        FOOD_SORT_COLUMNS,
      );


    const result =
      resolveFoodSortBoard(
        swappedBoard,
        levelConfig.activeFoodIds,
        levelConfig.spawnWeights,
      );


    // Purpose:
    // Gives every successful match physical feedback,
    // with stronger effects for specials and cascades.
    playFoodSortFx(
      result,
    );


    const nextCollected =
      addCollectedFood(
        collected,
        result.collected,
      );


    const nextMoves =
      moves - 1;


    const nextScore =
      score + result.score;

    const nextComboStreak =
      comboStreakRef.current + 1;

    const nextBestCombo =
      Math.max(
        bestComboRef.current,
        nextComboStreak,
      );

    comboStreakRef.current =
      nextComboStreak;

    bestComboRef.current =
      nextBestCombo;


    // Purpose:
    // Animate the player's match before showing
    // the completely resolved board.
    animateMatchedFoods(
      swappedBoard,
      firstMatch,
      result.board,
    );


    setObstacles(
      slimeResult.obstacles,
    );


    setCollected(
      nextCollected,
    );

    setScore(
      nextScore,
    );

    setMoves(
      nextMoves,
    );

    setComboStreak(
      nextComboStreak,
    );

    setBestCombo(
      nextBestCombo,
    );

    setSelectedIndex(
      null,
    );


    // Player wins as soon as every generated
    // level goal is complete.
    const remainingObstacles =
      countFoodSortObstacles(
        slimeResult.obstacles,
      );


    if (
      goalsAreComplete(
        nextCollected,
        levelConfig.foodTargets,
      ) &&
      (
        !levelConfig.sortTarget ||
        totalCollectedFood(
          nextCollected,
        ) >= levelConfig.sortTarget
      ) &&
      (
        !levelConfig.scoreTarget ||
        nextScore >=
          levelConfig.scoreTarget
      ) &&
      (
        !levelConfig.comboTarget ||
        nextBestCombo >=
          levelConfig.comboTarget
      ) &&
      remainingObstacles === 0
    ) {
      roundEndedRef.current =
        true;

      setGameStatus(
        'won',
      );

      setMessage(
        'LEVEL COMPLETE! Your companion is celebrating! 🎉',
      );


      void claimWinReward(
        runId,
        nextScore,
        nextMoves,
      );

      return;
    }


    if (
      nextMoves <= 0
    ) {
      roundEndedRef.current =
        true;

      setFailureReason(
        'moves',
      );

      setGameStatus(
        'lost',
      );

      setMessage(
        'Out of moves. Try the level again!',
      );

      return;
    }


    if (
      relicResult.cleared > 0
    ) {
      const relicsLeft =
        slimeResult.obstacles.filter(
          obstacle =>
            obstacle?.type ===
            'relic',
        ).length;


      setMessage(
        relicsLeft > 0
          ? `RELIC UNCOVERED! 🗿✨ ${relicsLeft} buried relic${relicsLeft === 1 ? '' : 's'} left.`
          : 'ALL RELICS UNCOVERED! 🗿✨',
      );

      return;
    }


    if (
      relicResult.hit > 0
    ) {
      setMessage(
        'DIG! ⛏️ The Buried Relic is cracking open.',
      );

      return;
    }


    if (
      obstacleResult.cleared > 0
    ) {
      const obstaclesLeft =
        countFoodSortObstacles(
          slimeResult.obstacles,
        );


      setMessage(
        obstaclesLeft > 0
          ? `OBSTACLE BROKEN! 💥 ${obstaclesLeft} blocker${obstaclesLeft === 1 ? '' : 's'} left.`
          : 'ALL BLOCKERS CLEARED! 💥 Finish your food goals!',
      );

      return;
    }


    if (
      obstacleResult.hit > 0
    ) {
      setMessage(
        'CRACK! That blocker needs another match.',
      );

      return;
    }


    if (
      slimeResult.spread
    ) {
      setMessage(
        'TOXIC SLIME SPREAD! ☣️ Match the infected food before it spreads again.',
      );

      return;
    }


    if (
      result.mythicsCreated > 0
    ) {
      setMessage(
        '6-MATCH MYTHIC BURST! ✦ Match it again to wipe that food type!',
      );

      return;
    }


    if (
      result.bombsCreated > 0
    ) {
      setMessage(
        'NOVA BOMB CREATED! 💣 Match it again to explode a 3x3 area!',
      );

      return;
    }


    if (
      result.specialsCreated > 0
    ) {
      setMessage(
        'POWER SNACK CREATED! 💥 Match it again to blast a row or column!',
      );

      return;
    }


    if (
      result.powerActivations > 0
    ) {
      setMessage(
        `POWER COMBO! ${result.powerActivations} special effect${result.powerActivations === 1 ? '' : 's'} activated! 💥`,
      );

      return;
    }


    if (
      result.cascades > 1
    ) {
      setMessage(
        `${result.cascades}x CASCADE! 🔥`,
      );

      return;
    }


    setMessage(
      `${nextComboStreak}x COMBO! Keep the streak going.`,
    );
  }


  // Purpose: Handles the original tap-to-swap controls.
  //
  // Tap one food, then tap a neighboring food.
  function pressTile(
    index: number,
  ) {
    if (
      ignoreNextPressRef.current
    ) {
      ignoreNextPressRef.current =
        false;

      return;
    }


    if (
      gameStatus !== 'playing' ||
      !runId ||
      isStartingRun ||
      isClaimingReward
    ) {
      return;
    }


    // Purpose:
    // A food covered by Vines cannot be selected
    // for movement until the Vine breaks.
    if (
      obstacles[index]?.type ===
      'vine'
    ) {
      setSelectedIndex(
        null,
      );

      setMessage(
        'VINES! 🌿 This food is trapped. Make a match through it to break the Vine.',
      );

      return;
    }


    if (
      obstacles[index]?.type ===
      'relic'
    ) {
      setSelectedIndex(
        null,
      );

      setMessage(
        'BURIED RELIC! 🗿 Match food directly beside it to dig.',
      );

      return;
    }


    if (
      selectedIndex === null
    ) {
      setSelectedIndex(
        index,
      );

      setMessage(
        'Selected. Tap a neighboring food or swipe it.',
      );

      return;
    }


    if (
      selectedIndex === index
    ) {
      setSelectedIndex(
        null,
      );

      setMessage(
        'Selection canceled.',
      );

      return;
    }


    if (
      !areFoodSortTilesAdjacent(
        selectedIndex,
        index,
      )
    ) {
      setSelectedIndex(
        index,
      );

      setMessage(
        'That food is not beside the first one. New food selected.',
      );

      return;
    }


    performFoodSwap(
      selectedIndex,
      index,
    );
  }


  // Purpose:
  // Smoothly puts the dragged food back
  // into its normal board position.
  function resetFoodDrag() {
    Animated.spring(
      dragOffset,
      {
        toValue: {
          x: 0,
          y: 0,
        },

        damping: 18,
        stiffness: 260,
        mass: 0.55,

        useNativeDriver:
          true,
      },
    ).start(
      () => {
        setDraggingIndex(
          null,
        );
      },
    );
  }


  // Purpose:
  // Makes the food visually follow the player's finger.
  function moveTileSwipe(
    index: number,
    event: GestureResponderEvent,
  ) {
    const start =
      swipeStartRef.current;


    if (
      !start ||
      start.index !== index
    ) {
      return;
    }


    const rawX =
      event.nativeEvent.pageX -
      start.x;

    const rawY =
      event.nativeEvent.pageY -
      start.y;


    const maximumDistance =
      tileSize * 0.85;


    const x =
      Math.max(
        -maximumDistance,
        Math.min(
          maximumDistance,
          rawX,
        ),
      );


    const y =
      Math.max(
        -maximumDistance,
        Math.min(
          maximumDistance,
          rawY,
        ),
      );


    dragOffset.setValue({
      x,
      y,
    });
  }


  // Purpose:
  // Plays visible and physical feedback
  // after Food Sort resolves a match.
  // Purpose:
  // Celebrates a verified Food Sort reward.
  // Reuses the board's existing blast overlay so
  // we do not create another animation system.
  // Purpose:
  // Shows the actual matched foods disappearing
  // before the resolved board drops into place.
  function animateMatchedFoods(
    swappedBoard: FoodSortTile[],
    matchedIndexes: Set<number>,
    resolvedBoard: FoodSortTile[],
  ) {
    setIsBoardAnimating(
      true,
    );


    // First show the player's completed swap.
    setBoard(
      swappedBoard,
    );


    setPoppingIndexes(
      Array.from(
        matchedIndexes,
      ),
    );


    matchPopScale.setValue(
      1,
    );

    matchPopOpacity.setValue(
      1,
    );


    // -----------------------------------------
    // MATCH POP
    // -----------------------------------------

    Animated.parallel([
      Animated.timing(
        matchPopScale,
        {
          toValue: 0.15,

          duration: Math.round(
            170 /
            levelConfig.speedMultiplier,
          ),

          useNativeDriver:
            true,
        },
      ),

      Animated.timing(
        matchPopOpacity,
        {
          toValue: 0,

          duration: Math.round(
            150 /
            levelConfig.speedMultiplier,
          ),

          useNativeDriver:
            true,
        },
      ),
    ]).start(
      () => {

        // -------------------------------------
        // PUT THE RESOLVED BOARD IN PLACE
        // -------------------------------------

        setBoard(
          resolvedBoard,
        );

        setPoppingIndexes(
          [],
        );


        matchPopScale.setValue(
          1,
        );

        matchPopOpacity.setValue(
          1,
        );


        // -------------------------------------
        // DROP NEW FOODS FROM ABOVE
        // -------------------------------------

        setDroppingFoods(
          true,
        );


        foodDropY.setValue(
          -Math.max(
            22,
            tileSize * 0.7,
          ),
        );

        foodDropOpacity.setValue(
          0.35,
        );


        requestAnimationFrame(
          () => {
            Animated.parallel([
              Animated.spring(
                foodDropY,
                {
                  toValue: 0,

                  damping: 14,

                  stiffness: 180,

                  mass: 0.65,

                  useNativeDriver:
                    true,
                },
              ),

              Animated.timing(
                foodDropOpacity,
                {
                  toValue: 1,

                  duration: Math.round(
                    220 /
                    levelConfig.speedMultiplier,
                  ),

                  useNativeDriver:
                    true,
                },
              ),
            ]).start(
              () => {
                setDroppingFoods(
                  false,
                );

                setIsBoardAnimating(
                  false,
                );
              },
            );
          },
        );
      },
    );
  }


  function playRewardWinFx() {
    void Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Success,
    );


    setBlastSymbol(
      '🎁',
    );


    blastScale.setValue(
      0.35,
    );

    blastOpacity.setValue(
      1,
    );


    Animated.parallel([
      Animated.sequence([
        Animated.spring(
          blastScale,
          {
            toValue: 1.4,
            speed: 18,
            bounciness: 14,
            useNativeDriver: true,
          },
        ),

        Animated.timing(
          blastScale,
          {
            toValue: 1,
            duration: 140,
            useNativeDriver: true,
          },
        ),
      ]),

      Animated.sequence([
        Animated.delay(
          350,
        ),

        Animated.timing(
          blastOpacity,
          {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          },
        ),
      ]),
    ]).start();
  }


  function playFoodSortFx(
    result: {
      bombsCreated: number;
      mythicsCreated: number;
      specialsCreated: number;
      powerActivations: number;
      cascades: number;
    },
  ) {
    let symbol =
      '✨';

    let scaleTarget =
      1.25;


    if (
      result.mythicsCreated >
      0
    ) {
      symbol =
        '✦';

      scaleTarget =
        2.15;

      void Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      );

    } else if (
      result.bombsCreated >
        0 ||
      result.powerActivations >
        0
    ) {
      symbol =
        '💥';

      scaleTarget =
        1.9;

      void Haptics.impactAsync(
        Haptics.ImpactFeedbackStyle.Heavy,
      );

    } else if (
      result.specialsCreated >
        0 ||
      result.cascades >
        1
    ) {
      symbol =
        '⚡';

      scaleTarget =
        1.55;

      void Haptics.impactAsync(
        Haptics.ImpactFeedbackStyle.Medium,
      );

    } else {
      void Haptics.impactAsync(
        Haptics.ImpactFeedbackStyle.Light,
      );
    }


    setBlastSymbol(
      symbol,
    );


    blastScale.setValue(
      0.35,
    );

    blastOpacity.setValue(
      0.95,
    );


    Animated.parallel([
      Animated.spring(
        blastScale,
        {
          toValue:
            scaleTarget,

          damping: 11,

          stiffness: 220,

          useNativeDriver:
            true,
        },
      ),

      Animated.timing(
        blastOpacity,
        {
          toValue: 0,

          duration: 420,

          useNativeDriver:
            true,
        },
      ),
    ]).start();
  }


  // Purpose: Saves the finger position when
  // the player begins touching a food tile.
  function startTileSwipe(
    index: number,
    event: GestureResponderEvent,
  ) {
    swipeStartRef.current = {
      index,

      x:
        event.nativeEvent.pageX,

      y:
        event.nativeEvent.pageY,
    };


    setDraggingIndex(
      index,
    );


    dragOffset.setValue({
      x: 0,
      y: 0,
    });


    void Haptics.selectionAsync();
  }


  // Purpose: Turns a swipe direction into the
  // neighboring board index.
  function getSwipeTarget(
    index: number,
    deltaX: number,
    deltaY: number,
  ) {
    const row =
      Math.floor(
        index /
        FOOD_SORT_COLUMNS,
      );

    const column =
      index %
      FOOD_SORT_COLUMNS;


    const horizontal =
      Math.abs(deltaX) >
      Math.abs(deltaY);


    if (horizontal) {
      // Swipe right.
      if (
        deltaX > 0 &&
        column <
          FOOD_SORT_COLUMNS - 1
      ) {
        return index + 1;
      }


      // Swipe left.
      if (
        deltaX < 0 &&
        column > 0
      ) {
        return index - 1;
      }


      return null;
    }


    // Swipe down.
    if (
      deltaY > 0 &&
      row <
        FOOD_SORT_ROWS - 1
    ) {
      return (
        index +
        FOOD_SORT_COLUMNS
      );
    }


    // Swipe up.
    if (
      deltaY < 0 &&
      row > 0
    ) {
      return (
        index -
        FOOD_SORT_COLUMNS
      );
    }


    return null;
  }


  // Purpose: Detects a completed finger swipe
  // and swaps with the neighboring food.
  function finishTileSwipe(
    index: number,
    event: GestureResponderEvent,
  ) {
    const start =
      swipeStartRef.current;


    swipeStartRef.current =
      null;


    if (
      !start ||
      start.index !== index
    ) {
      return;
    }


    const deltaX =
      event.nativeEvent.pageX -
      start.x;

    const deltaY =
      event.nativeEvent.pageY -
      start.y;


    // Short movement counts as a regular tap.
    const swipeDistance =
      Math.max(
        Math.abs(deltaX),
        Math.abs(deltaY),
      );


    const minimumSwipe =
      Math.max(
        16,
        tileSize * 0.22,
      );


    if (
      swipeDistance <
      minimumSwipe
    ) {
      resetFoodDrag();

      return;
    }


    const targetIndex =
      getSwipeTarget(
        index,
        deltaX,
        deltaY,
      );


    if (
      targetIndex === null
    ) {
      resetFoodDrag();

      setMessage(
        'You cannot swipe outside the board.',
      );

      return;
    }


    // Prevent the same gesture from also
    // triggering Pressable's onPress.
    ignoreNextPressRef.current =
      true;


    setTimeout(
      () => {
        ignoreNextPressRef.current =
          false;
      },
      250,
    );


    setSelectedIndex(
      null,
    );


    const rowDifference =
      Math.floor(
        targetIndex /
        FOOD_SORT_COLUMNS,
      ) -
      Math.floor(
        index /
        FOOD_SORT_COLUMNS,
      );


    const columnDifference =
      (
        targetIndex %
        FOOD_SORT_COLUMNS
      ) -
      (
        index %
        FOOD_SORT_COLUMNS
      );


    Animated.timing(
      dragOffset,
      {
        toValue: {
          x:
            columnDifference *
            tileSize *
            0.72,

          y:
            rowDifference *
            tileSize *
            0.72,
        },

        duration: 80,

        useNativeDriver:
          true,
      },
    ).start(
      () => {
        dragOffset.setValue({
          x: 0,
          y: 0,
        });


        setDraggingIndex(
          null,
        );


        performFoodSwap(
          index,
          targetIndex,
        );
      },
    );
  }


  const successfulMoves =
    Math.max(
      0,
      levelConfig.moves - moves,
    );

  const accuracy =
    calculateAccuracy(
      successfulMoves,
      mistakes,
    );

  const foodsCollected =
    totalCollectedFood(
      collected,
    );

  const collectedSummary =
    levelConfig.activeFoodIds
      .filter(
        foodId =>
          collected[foodId] > 0,
      )
      .map(
        foodId =>
          `${activeFoodArt[foodId].label} ${collected[foodId]}`,
      )
      .join(' • ');

  const failureMessages:
    string[] = [];

  if (failureReason === 'time') {
    failureMessages.push(
      'Time expired.',
    );
  } else if (
    failureReason === 'mistakes'
  ) {
    failureMessages.push(
      'Too many mistakes.',
    );
  } else if (
    failureReason === 'moves'
  ) {
    failureMessages.push(
      'No moves remained.',
    );
  } else if (
    failureReason === 'verification'
  ) {
    failureMessages.push(
      'Completion could not be verified by Mission Trails.',
    );
  }

  if (
    levelConfig.scoreTarget &&
    score < levelConfig.scoreTarget
  ) {
    failureMessages.push(
      `Score target not reached: ${score.toLocaleString()} / ${levelConfig.scoreTarget.toLocaleString()}.`,
    );
  }

  for (
    const goal
    of levelConfig.foodTargets
  ) {
    if (
      collected[goal.foodId] <
      goal.target
    ) {
      failureMessages.push(
        `Required ${goal.label} not collected: ${collected[goal.foodId]} / ${goal.target}.`,
      );
    }
  }

  if (
    levelConfig.sortTarget &&
    foodsCollected <
      levelConfig.sortTarget
  ) {
    failureMessages.push(
      `Food total not reached: ${foodsCollected} / ${levelConfig.sortTarget}.`,
    );
  }

  if (
    levelConfig.comboTarget &&
    bestCombo < levelConfig.comboTarget
  ) {
    failureMessages.push(
      `Combo target not reached: ${bestCombo} / ${levelConfig.comboTarget}.`,
    );
  }

  const blockersRemaining =
    countFoodSortObstacles(
      obstacles,
    );

  if (blockersRemaining > 0) {
    failureMessages.push(
      `${blockersRemaining} blocker${blockersRemaining === 1 ? '' : 's'} remained.`,
    );
  }


  return (
    <LinearGradient
      colors={[
        '#030007',
        '#11041C',
        '#080016',
        '#030007',
      ]}
      style={styles.screen}
    >
      <StatusBar
        style="light"
      />

      <ScrollView
        // Purpose:
        // Prevents the page from stealing the finger
        // while a Food Sort tile is being dragged.
        scrollEnabled={
          draggingIndex === null &&
          !isBoardAnimating
        }

        showsVerticalScrollIndicator={
          false
        }
        contentContainerStyle={[
          styles.content,
          {
            paddingTop:
              safeArea.top + 12,

            paddingBottom:
              safeArea.bottom + 30,
          },
        ]}
      >
        {/* HEADER */}
        <View
          style={
            styles.header
          }
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to Companion games"
            onPress={() =>
              router.back()
            }
            style={
              styles.backButton
            }
          >
            <Ionicons
              name="chevron-back"
              size={24}
              color="#FFFFFF"
            />
          </Pressable>

          <View
            style={
              styles.headerCopy
            }
          >
            <Text
              style={
                styles.title
              }
            >
              COMPANION FOOD SORT
            </Text>

            <Text
              style={
                styles.subtitle
              }
            >
              LEVEL {levelConfig.level} • {levelConfig.name.toUpperCase()}
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Restart level"
            onPress={
              restartGame
            }
            style={
              styles.restartIcon
            }
          >
            <Ionicons
              name="refresh"
              size={21}
              color="#62E7FF"
            />
          </Pressable>
        </View>


        {/* COMPANION */}
        <View
          style={
            styles.companionCard
          }
        >
          <View
            style={
              styles.companionOrb
            }
          >
            <Image
              source={
                companionImage
              }
              resizeMode="contain"
              style={
                styles.companionImage
              }
            />
          </View>

          <View
            style={
              styles.companionCopy
            }
          >
            <Text
              style={
                styles.companionLabel
              }
            >
              YOUR COMPANION
            </Text>

            <Text
              style={
                styles.companionMessage
              }
            >
              {gameStatus ===
              'won'
                ? 'YUM! We got everything! 💜'
                : gameStatus ===
                    'lost'
                  ? 'Almost! Let’s try again.'
                  : gameStatus ===
                      'intro'
                    ? 'Check our goal, then let’s sort!'
                    : 'Match my food before time runs out!'}
            </Text>
          </View>
        </View>


        {/* LIVE ROUND PROGRESS */}
        <View
          style={
            styles.statRow
          }
        >
          <View
            style={
              styles.statCard
            }
          >
            <Text
              style={
                styles.statLabel
              }
            >
              SCORE
            </Text>

            <Text
              style={
                styles.statValue
              }
            >
              {score.toLocaleString()}
            </Text>
          </View>

          <View
            style={
              styles.statCard
            }
          >
            <Text
              style={
                styles.statLabel
              }
            >
              MISTAKES
            </Text>

            <Text
              style={[
                styles.statValue,
                mistakes >=
                  levelConfig.allowedMistakes - 1
                  ? styles.movesLow
                  : undefined,
              ]}
            >
              {mistakes} / {levelConfig.allowedMistakes}
            </Text>
          </View>

          <View
            style={
              styles.statCard
            }
          >
            <Text
              style={
                styles.statLabel
              }
            >
              TIME
            </Text>

            <Text
              style={[
                styles.statValue,
                timeLeft <= 10
                  ? styles.movesLow
                  : undefined,
              ]}
            >
              {timeLeft}s
            </Text>
          </View>

          <View
            style={
              styles.statCard
            }
          >
            <Text
              style={
                styles.statLabel
              }
            >
              MOVES
            </Text>

            <Text
              style={[
                styles.statValue,
                moves <= 5
                  ? styles.movesLow
                  : undefined,
              ]}
            >
              {moves}
            </Text>
          </View>
        </View>


        <View
          style={
            styles.difficultyCard
          }
        >
          <View>
            <Text
              style={
                styles.difficultyLabel
              }
            >
              DIFFICULTY TIER
            </Text>

            <Text
              style={
                styles.difficultyValue
              }
            >
              {levelConfig.difficultyTier}
            </Text>
          </View>

          <View
            style={
              styles.difficultyCopy
            }
          >
            <Text
              style={
                styles.difficultyName
              }
            >
              {levelConfig.difficultyLabel} • {levelConfig.name}
            </Text>

            <Text
              style={
                styles.difficultyText
              }
            >
              {levelConfig.bossLevel
                ? `${levelConfig.timeLimit}s checkpoint • ${levelConfig.allowedMistakes} mistake limit`
                : `${levelConfig.timeLimit}s • ${levelConfig.moves} moves • ${levelConfig.activeFoodIds.length} types • ${levelConfig.distractorCount} distractors`}
            </Text>
          </View>

          {levelConfig.bossLevel ? (
            <Ionicons
              name="flame"
              size={24}
              color="#FF765E"
            />
          ) : null}
        </View>


        <View
          style={
            styles.levelSelectSection
          }
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Toggle level select"
            onPress={() =>
              setShowLevelSelect(
                previous =>
                  !previous,
              )
            }
            style={
              styles.levelSelectToggle
            }
          >
            <View>
              <Text
                style={
                  styles.levelSelectTitle
                }
              >
                LEVEL SELECT
              </Text>

              <Text
                style={
                  styles.levelSelectStatus
                }
              >
                Highest unlocked {highestUnlockedLevel} • Next {currentServerLevel}
              </Text>
            </View>

            <Ionicons
              name={
                showLevelSelect
                  ? 'chevron-up'
                  : 'chevron-down'
              }
              size={18}
              color="#62E7FF"
            />
          </Pressable>

          {showLevelSelect ? (
            <View
              style={
                styles.levelGrid
              }
            >
              {Array.from(
                { length: 30 },
                (_, index) => {
                  const level =
                    index + 1;
                  const locked =
                    level >
                    highestUnlockedLevel;
                  const completed =
                    level <
                    highestUnlockedLevel;
                  const selected =
                    level ===
                    levelConfig.level;

                  return (
                    <Pressable
                      key={`food-sort-level-${level}`}
                      accessibilityRole="button"
                      accessibilityLabel={
                        locked
                          ? `Level ${level}, locked`
                          : `Play level ${level}`
                      }
                      disabled={
                        locked ||
                        gameStatus === 'playing' ||
                        isStartingRun ||
                        isClaimingReward
                      }
                      onPress={() =>
                        selectLevel(
                          level,
                        )
                      }
                      style={[
                        styles.levelButton,
                        completed
                          ? styles.levelButtonComplete
                          : undefined,
                        selected
                          ? styles.levelButtonSelected
                          : undefined,
                        locked
                          ? styles.levelButtonLocked
                          : undefined,
                      ]}
                    >
                      {locked ? (
                        <Ionicons
                          name="lock-closed"
                          size={13}
                          color="#675C70"
                        />
                      ) : (
                        <Text
                          style={
                            styles.levelButtonText
                          }
                        >
                          {level}
                        </Text>
                      )}

                      {completed ? (
                        <Ionicons
                          name="checkmark-circle"
                          size={10}
                          color="#6CFFA4"
                          style={
                            styles.levelCheck
                          }
                        />
                      ) : null}
                    </Pressable>
                  );
                },
              )}
            </View>
          ) : null}
        </View>


        {gameStatus === 'intro' ? (
          <View
            style={
              styles.levelIntroCard
            }
          >
            <Text
              style={
                styles.levelIntroLevel
              }
            >
              LEVEL {levelConfig.level}
            </Text>

            <Text
              style={
                styles.levelIntroGoalLabel
              }
            >
              GOAL
            </Text>

            <Text
              style={
                styles.levelIntroGoal
              }
            >
              {levelConfig.goalSummary}
            </Text>

            <Text
              style={
                styles.levelIntroRules
              }
            >
              {levelConfig.timeLimit}s • {levelConfig.allowedMistakes} mistakes • {levelConfig.moves} moves
            </Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Start level ${levelConfig.level}`}
              disabled={
                !runId ||
                isStartingRun
              }
              onPress={
                beginLevel
              }
              style={
                styles.levelIntroButton
              }
            >
              <Ionicons
                name="play"
                size={17}
                color="#05000B"
              />

              <Text
                style={
                  styles.levelIntroButtonText
                }
              >
                {isStartingRun
                  ? 'PREPARING...'
                  : 'START LEVEL'}
              </Text>
            </Pressable>
          </View>
        ) : null}


        {/* GOALS */}
        <View
          style={
            styles.goalSection
          }
        >
          <Text
            style={
              styles.sectionTitle
            }
          >
            LEVEL GOALS
          </Text>

          <View
            style={
              styles.goalRow
            }
          >
            {levelConfig.foodTargets.map(
              (goal) => {
                const amount =
                  collected[
                    goal.foodId
                  ];

                const complete =
                  amount >=
                  goal.target;

                return (
                  <View
                    key={
                      goal.foodId
                    }
                    style={[
                      styles.goalCard,

                      complete
                        ? styles.goalComplete
                        : undefined,
                    ]}
                  >
                    <Image
                      source={
                        activeFoodArt[
                          goal.foodId
                        ].image
                      }
                      resizeMode="contain"
                      style={
                        styles.goalImage
                      }
                    />

                    <View
                      style={
                        styles.goalCopy
                      }
                    >
                      <Text
                        numberOfLines={1}
                        style={
                          styles.goalLabel
                        }
                      >
                        {levelConfig.rareFoodRequired &&
                        goal.category === 'treats'
                          ? 'Rare Treats'
                          : goal.label}
                      </Text>

                      <Text
                        style={
                          styles.goalText
                        }
                      >
                        {Math.min(
                          amount,
                          goal.target,
                        )}
                        {' / '}{goal.target}
                      </Text>
                    </View>

                    {complete ? (
                      <Ionicons
                        name="checkmark-circle"
                        size={16}
                        color="#6CFFA4"
                      />
                    ) : null}
                  </View>
                );
              },
            )}
          </View>

          {levelConfig.sortTarget ? (
            <View
              style={[
                styles.progressGoal,
                totalCollectedFood(collected) >=
                  levelConfig.sortTarget
                  ? styles.goalComplete
                  : undefined,
              ]}
            >
              <Text
                style={
                  styles.progressGoalLabel
                }
              >
                FOODS SORTED
              </Text>

              <Text
                style={
                  styles.progressGoalValue
                }
              >
                {Math.min(
                  totalCollectedFood(collected),
                  levelConfig.sortTarget,
                )}{' / '}{levelConfig.sortTarget}
              </Text>
            </View>
          ) : null}

          {levelConfig.scoreTarget ? (
            <View
              style={[
                styles.progressGoal,
                score >= levelConfig.scoreTarget
                  ? styles.goalComplete
                  : undefined,
              ]}
            >
              <Text
                style={
                  styles.progressGoalLabel
                }
              >
                SCORE TARGET
              </Text>

              <Text
                style={
                  styles.progressGoalValue
                }
              >
                {Math.min(
                  score,
                  levelConfig.scoreTarget,
                ).toLocaleString()}{' / '}{levelConfig.scoreTarget.toLocaleString()}
              </Text>
            </View>
          ) : null}

          {levelConfig.comboTarget ? (
            <View
              style={[
                styles.progressGoal,
                bestCombo >= levelConfig.comboTarget
                  ? styles.goalComplete
                  : undefined,
              ]}
            >
              <Text
                style={
                  styles.progressGoalLabel
                }
              >
                COMBO STREAK
              </Text>

              <Text
                style={
                  styles.progressGoalValue
                }
              >
                {Math.min(
                  bestCombo,
                  levelConfig.comboTarget,
                )}{' / '}{levelConfig.comboTarget} • NOW {comboStreak}x
              </Text>
            </View>
          ) : null}
        </View>


        {/* SECURE REWARD STATUS */}
        {rewardMessage ? (
          <View
            style={
              styles.rewardCard
            }
          >
            <Ionicons
              name="gift"
              size={18}
              color="#72F2C3"
            />

            <Text
              style={
                styles.rewardText
              }
            >
              {rewardMessage}
            </Text>
          </View>
        ) : null}


        {/* GAME MESSAGE */}
        <View
          style={
            styles.messageCard
          }
        >
          <Ionicons
            name={
              gameStatus ===
              'won'
                ? 'trophy'
                : gameStatus ===
                    'lost'
                  ? 'refresh'
                  : 'sparkles'
            }
            size={18}
            color="#FFD75E"
          />

          <Text
            style={
              styles.messageText
            }
          >
            {message}
          </Text>
        </View>


        {/* 6x6 BOARD */}
        <View
          style={[
            styles.board,
            {
              width:
                actualBoardWidth,
            },
          ]}
        >
          <Animated.View
            pointerEvents="none"
            style={[
              styles.blastFx,

              {
                opacity:
                  blastOpacity,

                transform: [
                  {
                    scale:
                      blastScale,
                  },
                ],
              },
            ]}
          >
            <Text
              style={
                styles.blastFxText
              }
            >
              {blastSymbol}
            </Text>
          </Animated.View>


          {Array.from(
            {
              length:
                FOOD_SORT_ROWS,
            },
            (_, rowIndex) => {
              const rowStart =
                rowIndex *
                FOOD_SORT_COLUMNS;

              const rowTiles =
                board.slice(
                  rowStart,
                  rowStart +
                    FOOD_SORT_COLUMNS,
                );


              return (
                <View
                  key={`food-sort-row-${rowIndex}`}
                  style={
                    styles.boardRow
                  }
                >
                  {rowTiles.map(
                    (
                      tile,
                      columnIndex,
                    ) => {
                      const index =
                        rowStart +
                        columnIndex;

                      const selected =
                        selectedIndex ===
                        index;


                      return (
                        <Pressable
                          key={
                            tile.id
                          }

                          accessibilityRole="button"

                          accessibilityLabel={
                            `${activeFoodArt[tile.foodId].label}${tile.special !== 'none' ? ` ${tile.special} power` : ''}`
                          }

                          disabled={
                            gameStatus !==
                              'playing' ||
                            !runId ||
                            isStartingRun ||
                            isClaimingReward ||
                            isBoardAnimating
                          }

                          // Purpose:
                          // The food tile owns the touch gesture
                          // instead of letting ScrollView take it.
                          onStartShouldSetResponder={() =>
                            true
                          }

                          onMoveShouldSetResponder={() =>
                            true
                          }

                          onResponderTerminationRequest={() =>
                            false
                          }

                          onPressIn={(
                            event,
                          ) =>
                            startTileSwipe(
                              index,
                              event,
                            )
                          }

                          onTouchMove={(
                            event,
                          ) =>
                            moveTileSwipe(
                              index,
                              event,
                            )
                          }

                          onTouchEnd={(
                            event,
                          ) =>
                            finishTileSwipe(
                              index,
                              event,
                            )
                          }

                          onTouchCancel={() => {
                            swipeStartRef.current =
                              null;

                            resetFoodDrag();
                          }}

                          onPress={() =>
                            pressTile(
                              index,
                            )
                          }

                          style={[
                            styles.tile,

                            {
                              width:
                                tileSize,

                              height:
                                tileSize,
                            },

                            selected
                              ? styles.tileSelected
                              : undefined,
                          ]}
                        >
                          <Animated.View
                            style={[
                              styles.foodMatchMotion,

                              poppingIndexes.includes(
                                index,
                              )
                                ? {
                                    opacity:
                                      matchPopOpacity,

                                    transform: [
                                      {
                                        scale:
                                          matchPopScale,
                                      },
                                    ],
                                  }
                                : droppingFoods
                                  ? {
                                      opacity:
                                        foodDropOpacity,

                                      transform: [
                                        {
                                          translateY:
                                            foodDropY,
                                        },
                                      ],
                                    }
                                  : undefined,
                            ]}
                          >

                          <Animated.View
                            style={[
                              styles.foodMotion,

                              draggingIndex === index
                                ? {
                                    transform:
                                      dragOffset.getTranslateTransform(),
                                  }
                                : undefined,
                            ]}
                          >
<Image
                            source={
                              activeFoodArt[
                                tile.foodId
                              ].image
                            }

                            resizeMode="contain"

                            style={
                              styles.tileImage
                            }
                          />
                          </Animated.View>
                          </Animated.View>


                          {/* Purpose:
                              Shows Ice over the food while
                              keeping swipe controls active. */}
                          {obstacles[
                            index
                          ]?.type ===
                          'ice' ? (
                            <View
                              pointerEvents="none"

                              style={[
                                styles.iceOverlay,

                                obstacles[
                                  index
                                ]?.health ===
                                2
                                  ? styles.iceOverlayStrong
                                  : undefined,
                              ]}
                            >
                              <Text
                                style={
                                  styles.iceSymbol
                                }
                              >
                                {obstacles[
                                  index
                                ]?.health ===
                                2
                                  ? '❄️'
                                  : '🧊'}
                              </Text>
                            </View>
                          ) : null}


                          {obstacles[
                            index
                          ]?.type ===
                          'rock' ? (
                            <View
                              pointerEvents="none"

                              style={[
                                styles.rockOverlay,

                                obstacles[
                                  index
                                ]?.health ===
                                3
                                  ? styles.rockOverlayStrong
                                  : undefined,
                              ]}
                            >
                              <Text
                                style={
                                  styles.rockSymbol
                                }
                              >
                                {obstacles[
                                  index
                                ]?.health ===
                                3
                                  ? '🪨'
                                  : '◼'}
                              </Text>

                              <Text
                                style={
                                  styles.rockHealth
                                }
                              >
                                {obstacles[
                                  index
                                ]?.health}
                              </Text>
                            </View>
                          ) : null}


                          {/* Purpose:
                              Vines trap the food underneath.
                              The overlay does not steal touches,
                              so the game can explain why the
                              candy cannot move. */}
                          {obstacles[
                            index
                          ]?.type ===
                          'vine' ? (
                            <View
                              pointerEvents="none"

                              style={[
                                styles.vineOverlay,

                                obstacles[
                                  index
                                ]?.health ===
                                2
                                  ? styles.vineOverlayStrong
                                  : undefined,
                              ]}
                            >
                              <Text
                                style={
                                  styles.vineSymbol
                                }
                              >
                                🌿
                              </Text>

                              {obstacles[
                                index
                              ]?.health ===
                              2 ? (
                                <Text
                                  style={
                                    styles.vineHealth
                                  }
                                >
                                  2
                                </Text>
                              ) : null}
                            </View>
                          ) : null}


                          {/* Purpose:
                              Toxic Slime covers food but does
                              not stop the player from swiping it. */}
                          {obstacles[
                            index
                          ]?.type ===
                          'slime' ? (
                            <View
                              pointerEvents="none"

                              style={[
                                styles.slimeOverlay,

                                obstacles[
                                  index
                                ]?.health ===
                                2
                                  ? styles.slimeOverlayStrong
                                  : undefined,
                              ]}
                            >
                              <Text
                                style={
                                  styles.slimeSymbol
                                }
                              >
                                ☣️
                              </Text>

                              {obstacles[
                                index
                              ]?.health ===
                              2 ? (
                                <Text
                                  style={
                                    styles.slimeHealth
                                  }
                                >
                                  2
                                </Text>
                              ) : null}
                            </View>
                          ) : null}


                          {/* Purpose:
                              Buried Relics cannot move.
                              Matching beside them digs them out. */}
                          {obstacles[
                            index
                          ]?.type ===
                          'relic' ? (
                            <View
                              pointerEvents="none"

                              style={[
                                styles.relicOverlay,

                                obstacles[
                                  index
                                ]?.health ===
                                3
                                  ? styles.relicOverlayStrong
                                  : undefined,
                              ]}
                            >
                              <Text
                                style={
                                  styles.relicSymbol
                                }
                              >
                                🗿
                              </Text>

                              <View
                                style={
                                  styles.relicHealthBadge
                                }
                              >
                                <Text
                                  style={
                                    styles.relicHealth
                                  }
                                >
                                  {obstacles[
                                    index
                                  ]?.health}
                                </Text>
                              </View>
                            </View>
                          ) : null}


                          {tile.special !==
                          'none' ? (
                            <View
                              pointerEvents="none"

                              style={[
                                styles.specialBadge,

                                tile.special ===
                                'mythic'
                                  ? styles.specialBadgeMythic
                                  : undefined,
                              ]}
                            >
                              <Text
                                style={
                                  styles.specialBadgeText
                                }
                              >
                                {tile.special ===
                                'row'
                                  ? '↔'
                                  : tile.special ===
                                      'column'
                                    ? '↕'
                                    : tile.special ===
                                        'bomb'
                                      ? '💣'
                                      : '✦'}
                              </Text>
                            </View>
                          ) : null}
                        </Pressable>
                      );
                    },
                  )}
                </View>
              );
            },
          )}
        </View>


        {/* END OF LEVEL */}
        {gameStatus === 'won' ||
        gameStatus === 'lost' ? (
          <Modal
            transparent
            visible
            animationType="fade"
            onRequestClose={() =>
              router.back()
            }
          >
            <View
              style={
                styles.resultOverlay
              }
            >
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={
                  styles.resultModalContent
                }
              >
                <View
                  style={
                    styles.resultCard
                  }
                >
            <Ionicons
              name={
                gameStatus ===
                'won'
                  ? 'trophy'
                  : 'refresh-circle'
              }
              size={44}
              color={
                gameStatus ===
                'won'
                  ? '#FFD75E'
                  : '#FF5AA9'
              }
            />

            <Text
              style={
                styles.resultTitle
              }
            >
              {gameStatus ===
              'won'
                ? 'LEVEL COMPLETE'
                : 'LEVEL FAILED'}
            </Text>

            <Text
              style={
                styles.resultScore
              }
            >
              LEVEL {levelConfig.level}
            </Text>

            <View
              style={
                styles.resultStatsGrid
              }
            >
              <View
                style={
                  styles.resultStat
                }
              >
                <Text style={styles.resultStatLabel}>SCORE</Text>
                <Text style={styles.resultStatValue}>{score.toLocaleString()}</Text>
              </View>

              <View
                style={
                  styles.resultStat
                }
              >
                <Text style={styles.resultStatLabel}>ACCURACY</Text>
                <Text style={styles.resultStatValue}>{accuracy}%</Text>
              </View>

              <View
                style={
                  styles.resultStat
                }
              >
                <Text style={styles.resultStatLabel}>MISTAKES</Text>
                <Text style={styles.resultStatValue}>{mistakes}</Text>
              </View>

              <View
                style={
                  styles.resultStat
                }
              >
                <Text style={styles.resultStatLabel}>FOODS COLLECTED</Text>
                <Text style={styles.resultStatValue}>{foodsCollected}</Text>
              </View>
            </View>

            {collectedSummary ? (
              <Text
                style={
                  styles.collectedSummary
                }
              >
                {collectedSummary}
              </Text>
            ) : null}

            {gameStatus === 'lost' ? (
              <View
                style={
                  styles.failurePanel
                }
              >
                {failureMessages.map(
                  failure => (
                    <Text
                      key={failure}
                      style={
                        styles.failureText
                      }
                    >
                      • {failure}
                    </Text>
                  ),
                )}
              </View>
            ) : null}

            {gameStatus === 'won' ? (
              <View
                style={
                  styles.leaderboardResult
                }
              >
                <View
                  style={
                    styles.leaderboardResultStat
                  }
                >
                  <Text
                    style={
                      styles.leaderboardResultLabel
                    }
                  >
                    EXPLORER SCORE EARNED
                  </Text>

                  <Text
                    style={
                      styles.leaderboardResultValue
                    }
                  >
                    +{earnedExplorerPoints.toLocaleString()}
                  </Text>
                </View>


                <View
                  style={
                    styles.leaderboardResultDivider
                  }
                />


                <View
                  style={
                    styles.leaderboardResultStat
                  }
                >
                  <Text
                    style={
                      styles.leaderboardResultLabel
                    }
                  >
                    TOTAL SCORE
                  </Text>

                  <Text
                    style={
                      styles.leaderboardResultValue
                    }
                  >
                    {totalExplorerScore === null
                      ? '...'
                      : totalExplorerScore.toLocaleString()}
                  </Text>
                </View>


                <View
                  style={
                    styles.leaderboardResultDivider
                  }
                />


                <View
                  style={
                    styles.leaderboardResultStat
                  }
                >
                  <Text
                    style={
                      styles.leaderboardResultLabel
                    }
                  >
                    GLOBAL RANK
                  </Text>

                  <Text
                    style={
                      styles.leaderboardResultValue
                    }
                  >
                    {globalRank
                      ? `#${globalRank}`
                      : '—'}
                  </Text>
                </View>
              </View>
            ) : null}


            <Text
              style={
                styles.resultRewardLabel
              }
            >
              REWARD
            </Text>

            <Text
              style={
                styles.resultNote
              }
            >
              {gameStatus === 'lost'
                ? rewardMessage ??
                  'Complete the level to earn its reward.'
                : isClaimingReward
                  ? 'Verifying your secure Mission Trails reward...'
                  : rewardMessage ??
                    'Reward verified.'}
            </Text>

            {gameStatus === 'won' ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="View global leaderboard"
                onPress={() =>
                  router.push(
                    '/leaderboard',
                  )
                }
                style={
                  styles.leaderboardButton
                }
              >
                <Ionicons
                  name="trophy"
                  size={18}
                  color="#05000B"
                />

                <Text
                  style={
                    styles.leaderboardButtonText
                  }
                >
                  VIEW LEADERBOARD
                </Text>
              </Pressable>
            ) : null}


            <Pressable
              accessibilityRole="button"
              disabled={
                isStartingRun ||
                isClaimingReward ||
                (
                  gameStatus === 'won' &&
                  levelConfig.level + 1 >
                    highestUnlockedLevel
                )
              }
              onPress={
                gameStatus === 'won'
                  ? startNextLevel
                  : restartGame
              }
              style={[
                styles.restartButton,
                isStartingRun ||
                isClaimingReward ||
                (
                  gameStatus === 'won' &&
                  levelConfig.level + 1 >
                    highestUnlockedLevel
                )
                  ? styles.resultButtonDisabled
                  : undefined,
              ]}
            >
              <Ionicons
                name={
                  gameStatus === 'won'
                    ? 'arrow-forward'
                    : 'refresh'
                }
                size={18}
                color="#FFFFFF"
              />

              <Text
                style={
                  styles.restartText
                }
              >
                {gameStatus === 'won'
                  ? 'NEXT LEVEL'
                  : 'TRY AGAIN'}
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Exit Food Sort"
              onPress={() =>
                router.back()
              }
              style={
                styles.exitButton
              }
            >
              <Text
                style={
                  styles.exitButtonText
                }
              >
                EXIT
              </Text>
            </Pressable>
                </View>
              </ScrollView>
            </View>
          </Modal>
        ) : null}


        <Text
          style={
            styles.helper
          }
        >
          Match 3 or more identical foods.
          Invalid swaps count as mistakes.
        </Text>
      </ScrollView>
    </LinearGradient>
  );
}


const styles =
  StyleSheet.create({
    screen: {
      flex: 1,
    },

    content: {
      alignItems:
        'center',

      paddingHorizontal:
        10,

      gap: 14,
    },

    header: {
      width: '100%',
      maxWidth: 620,

      flexDirection:
        'row',

      alignItems:
        'center',

      gap: 12,
    },

    backButton: {
      width: 44,
      height: 44,

      borderRadius: 22,

      borderWidth: 1,

      borderColor:
        '#8F3BFF',

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        'rgba(10, 4, 22, 0.92)',
    },

    restartIcon: {
      width: 44,
      height: 44,

      borderRadius: 22,

      borderWidth: 1,

      borderColor:
        '#245B70',

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        'rgba(3, 16, 25, 0.92)',
    },

    headerCopy: {
      flex: 1,
    },

    title: {
      color: '#FFFFFF',

      fontSize: 18,

      fontWeight:
        '900',

      letterSpacing: 0.7,
    },

    subtitle: {
      color: '#62E7FF',

      fontSize: 11,

      fontWeight:
        '800',

      marginTop: 3,
    },

    companionCard: {
      width: '100%',
      maxWidth: 430,

      borderRadius: 20,

      borderWidth: 1,

      borderColor:
        '#713388',

      backgroundColor:
        'rgba(19, 6, 30, 0.95)',

      flexDirection:
        'row',

      alignItems:
        'center',

      padding: 12,

      gap: 13,
    },

    companionOrb: {
      width: 70,
      height: 70,

      borderRadius: 35,

      borderWidth: 2,

      borderColor:
        '#CF45FF',

      backgroundColor:
        '#08030E',

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    companionImage: {
      width: '82%',
      height: '82%',
    },

    companionCopy: {
      flex: 1,
    },

    companionLabel: {
      color: '#FF63E6',

      fontSize: 10,

      fontWeight:
        '900',

      letterSpacing: 1,
    },

    companionMessage: {
      color: '#FFFFFF',

      fontSize: 14,

      fontWeight:
        '700',

      marginTop: 5,

      lineHeight: 19,
    },

    statRow: {
      width: '100%',
      maxWidth: 430,

      flexDirection:
        'row',

      gap: 10,
    },

    statCard: {
      flex: 1,

      borderRadius: 16,

      borderWidth: 1,

      borderColor:
        '#342441',

      backgroundColor:
        'rgba(8, 5, 16, 0.95)',

      paddingVertical: 10,

      alignItems:
        'center',
    },

    statLabel: {
      color: '#8E8298',

      fontSize: 9,

      fontWeight:
        '900',

      letterSpacing: 0.8,
    },

    statValue: {
      color: '#FFFFFF',

      fontSize: 23,

      fontWeight:
        '900',

      marginTop: 2,
    },

    movesLow: {
      color: '#FF597F',
    },

    difficultyCard: {
      width: '100%',
      maxWidth: 430,

      minHeight: 68,

      borderRadius: 16,

      borderWidth: 1,

      borderColor:
        '#49305A',

      backgroundColor:
        'rgba(15, 7, 24, 0.96)',

      flexDirection:
        'row',

      alignItems:
        'center',

      paddingHorizontal: 14,

      paddingVertical: 10,

      gap: 14,
    },

    difficultyLabel: {
      color: '#7D7186',

      fontSize: 8,

      fontWeight:
        '900',

      letterSpacing: 0.8,
    },

    difficultyValue: {
      color: '#FFFFFF',

      fontSize: 25,

      fontWeight:
        '900',

      textAlign: 'center',
    },

    difficultyCopy: {
      flex: 1,
    },

    difficultyName: {
      color: '#E45FFF',

      fontSize: 13,

      fontWeight:
        '900',
    },

    difficultyText: {
      color: '#A99BB5',

      fontSize: 9,

      marginTop: 3,
    },

    levelSelectSection: {
      width: '100%',
      maxWidth: 430,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: '#49305A',
      backgroundColor: 'rgba(15, 7, 24, 0.96)',
      overflow: 'hidden',
    },

    levelSelectToggle: {
      minHeight: 54,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      gap: 12,
    },

    levelSelectTitle: {
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 0.9,
    },

    levelSelectStatus: {
      color: '#8E8298',
      fontSize: 9,
      fontWeight: '700',
      marginTop: 2,
    },

    levelGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 7,
      paddingHorizontal: 12,
      paddingBottom: 12,
    },

    levelButton: {
      width: 40,
      height: 40,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#4D365A',
      backgroundColor: '#13091A',
      alignItems: 'center',
      justifyContent: 'center',
    },

    levelButtonComplete: {
      borderColor: '#397E59',
      backgroundColor: 'rgba(22, 72, 45, 0.55)',
    },

    levelButtonSelected: {
      borderWidth: 2,
      borderColor: '#62E7FF',
    },

    levelButtonLocked: {
      borderColor: '#2D2532',
      backgroundColor: 'rgba(7, 5, 11, 0.75)',
    },

    levelButtonText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '900',
      fontVariant: [
        'tabular-nums',
      ],
    },

    levelCheck: {
      position: 'absolute',
      right: 2,
      bottom: 2,
    },

    levelIntroCard: {
      width: '100%',
      maxWidth: 430,
      borderRadius: 22,
      borderWidth: 2,
      borderColor: '#B84DFF',
      backgroundColor: 'rgba(29, 8, 45, 0.98)',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 18,
      gap: 7,
    },

    levelIntroLevel: {
      color: '#62E7FF',
      fontSize: 22,
      fontWeight: '900',
      letterSpacing: 1.2,
    },

    levelIntroGoalLabel: {
      color: '#FF63E6',
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 1.5,
    },

    levelIntroGoal: {
      color: '#FFFFFF',
      fontSize: 18,
      fontWeight: '900',
      lineHeight: 25,
      textAlign: 'center',
    },

    levelIntroRules: {
      color: '#B9A8C5',
      fontSize: 11,
      fontWeight: '700',
      textAlign: 'center',
    },

    levelIntroButton: {
      minWidth: 180,
      minHeight: 46,
      borderRadius: 99,
      backgroundColor: '#62E7FF',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      marginTop: 5,
    },

    levelIntroButtonText: {
      color: '#05000B',
      fontSize: 12,
      fontWeight: '900',
      letterSpacing: 0.7,
    },

    goalSection: {
      width: '100%',
      maxWidth: 430,
    },

    sectionTitle: {
      color: '#FFFFFF',

      fontSize: 12,

      fontWeight:
        '900',

      letterSpacing: 1,

      marginBottom: 7,
    },

    goalRow: {
      flexDirection:
        'row',

      flexWrap:
        'wrap',

      gap: 8,
    },

    goalCard: {
      flex: 1,

      minWidth: 118,

      minHeight: 60,

      borderRadius: 14,

      borderWidth: 1,

      borderColor:
        '#403049',

      backgroundColor:
        'rgba(8, 5, 16, 0.96)',

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'center',

      gap: 4,

      paddingHorizontal: 5,
    },

    goalCopy: {
      flexShrink: 1,
    },

    goalLabel: {
      color: '#A99BB5',
      fontSize: 8,
      fontWeight: '800',
    },

    goalComplete: {
      borderColor:
        '#4FCF79',

      backgroundColor:
        'rgba(23, 70, 40, 0.35)',
    },

    goalImage: {
      width: 28,
      height: 28,
    },

    goalText: {
      color: '#FFFFFF',

      fontSize: 11,

      fontWeight:
        '900',

      fontVariant: [
        'tabular-nums',
      ],
    },

    progressGoal: {
      width: '100%',
      minHeight: 42,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#403049',
      backgroundColor: 'rgba(8, 5, 16, 0.96)',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      marginTop: 8,
    },

    progressGoalLabel: {
      color: '#A99BB5',
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 0.7,
    },

    progressGoalValue: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '900',
      fontVariant: [
        'tabular-nums',
      ],
    },

    rewardCard: {
      width: '100%',
      maxWidth: 430,

      minHeight: 50,

      borderRadius: 14,

      borderWidth: 1,

      borderColor:
        '#315E52',

      backgroundColor:
        'rgba(18, 65, 52, 0.35)',

      flexDirection:
        'row',

      alignItems:
        'center',

      paddingHorizontal: 12,

      gap: 9,
    },

    rewardText: {
      flex: 1,

      color: '#C7FFE9',

      fontSize: 11,

      fontWeight:
        '800',

      lineHeight: 16,
    },

    messageCard: {
      width: '100%',
      maxWidth: 430,

      minHeight: 44,

      borderRadius: 14,

      borderWidth: 1,

      borderColor:
        '#614C2C',

      backgroundColor:
        'rgba(49, 34, 6, 0.36)',

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'center',

      paddingHorizontal: 12,

      gap: 8,
    },

    messageText: {
      flex: 1,

      color: '#FFF4C6',

      fontSize: 11,

      fontWeight:
        '700',

      textAlign:
        'center',
    },

    board: {
      position:
        'relative',
      padding:
        BOARD_PADDING,

      borderRadius: 20,

      borderWidth: 2,

      borderColor:
        '#7F38B8',

      backgroundColor:
        'rgba(4, 2, 10, 0.98)',

      alignSelf:
        'center',

      gap:
        BOARD_GAP,

      overflow:
        'hidden',
    },


    boardRow: {
      width: '100%',

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'flex-start',

      gap:
        BOARD_GAP,
    },

    tile: {
      flexGrow: 0,
      flexShrink: 0,

      borderRadius: 10,

      borderWidth: 1,

      borderColor:
        '#392447',

      backgroundColor:
        '#13091A',

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    tileSelected: {
      borderWidth: 3,

      borderColor:
        '#62E7FF',

      backgroundColor:
        '#182B34',
    },

    foodMatchMotion: {
      width: '100%',
      height: '100%',

      alignItems:
        'center',

      justifyContent:
        'center',
    },


    foodMotion: {
      // Purpose:
      // Gives the Animated.View a real box.
      // The Image inside uses percentage sizing.
      width: '100%',
      height: '100%',

      alignItems:
        'center',

      justifyContent:
        'center',

      zIndex: 20,
    },


    blastFx: {
      position:
        'absolute',

      left: '25%',
      right: '25%',
      top: '25%',
      bottom: '25%',

      alignItems:
        'center',

      justifyContent:
        'center',

      zIndex: 999,
      elevation: 30,

    },


    blastFxText: {
      fontSize: 72,

      textAlign:
        'center',
    },


    tileImage: {
      width: '97%',
      height: '97%',
    },


    iceOverlay: {
      position: 'absolute',
      top: 1,
      right: 1,
      bottom: 1,
      left: 1,

      borderRadius: 9,

      borderWidth: 2,

      borderColor:
        'rgba(168, 235, 255, 0.95)',

      backgroundColor:
        'rgba(124, 213, 255, 0.25)',

      alignItems: 'center',
      justifyContent: 'center',
    },


    iceOverlayStrong: {
      borderWidth: 3,

      backgroundColor:
        'rgba(128, 194, 255, 0.42)',

      borderColor:
        'rgba(221, 248, 255, 1)',
    },


    iceSymbol: {
      fontSize: 17,

      textShadowColor:
        'rgba(0, 0, 0, 0.8)',

      textShadowRadius: 3,
    },


    rockOverlay: {
      position: 'absolute',
      top: 1,
      right: 1,
      bottom: 1,
      left: 1,

      borderRadius: 9,

      borderWidth: 2,

      borderColor:
        'rgba(150, 150, 160, 0.95)',

      backgroundColor:
        'rgba(70, 70, 78, 0.45)',

      alignItems: 'center',
      justifyContent: 'center',
    },


    rockOverlayStrong: {
      borderWidth: 3,

      borderColor:
        'rgba(210, 210, 220, 1)',

      backgroundColor:
        'rgba(55, 55, 62, 0.62)',
    },


    rockSymbol: {
      fontSize: 19,

      textShadowColor:
        'rgba(0, 0, 0, 0.9)',

      textShadowRadius: 3,
    },


    rockHealth: {
      position: 'absolute',

      right: 4,

      bottom: 2,

      color: '#FFFFFF',

      fontSize: 10,

      fontWeight: '900',

      textShadowColor:
        'rgba(0, 0, 0, 0.9)',

      textShadowRadius: 2,
    },


    vineOverlay: {
      position: 'absolute',

      top: 1,
      right: 1,
      bottom: 1,
      left: 1,

      borderRadius: 9,

      borderWidth: 2,

      borderColor:
        'rgba(66, 255, 110, 0.92)',

      backgroundColor:
        'rgba(20, 110, 45, 0.20)',

      alignItems: 'center',
      justifyContent: 'center',
    },


    vineOverlayStrong: {
      borderWidth: 3,

      borderColor:
        'rgba(132, 255, 149, 1)',

      backgroundColor:
        'rgba(20, 120, 45, 0.35)',
    },


    vineSymbol: {
      fontSize: 24,

      textShadowColor:
        'rgba(0, 0, 0, 0.9)',

      textShadowRadius: 3,
    },


    vineHealth: {
      position: 'absolute',

      right: 3,

      bottom: 1,

      color: '#E8FFE9',

      fontSize: 10,

      fontWeight: '900',

      textShadowColor:
        'rgba(0, 0, 0, 0.9)',

      textShadowRadius: 2,
    },


    slimeOverlay: {
      position: 'absolute',

      top: 1,
      right: 1,
      bottom: 1,
      left: 1,

      borderRadius: 9,

      borderWidth: 2,

      borderColor:
        'rgba(105, 255, 36, 0.95)',

      backgroundColor:
        'rgba(62, 225, 24, 0.27)',

      alignItems: 'center',
      justifyContent: 'center',
    },


    slimeOverlayStrong: {
      borderWidth: 3,

      borderColor:
        'rgba(184, 255, 62, 1)',

      backgroundColor:
        'rgba(67, 205, 24, 0.43)',
    },


    slimeSymbol: {
      fontSize: 20,

      textShadowColor:
        'rgba(0, 0, 0, 0.9)',

      textShadowRadius: 3,
    },


    slimeHealth: {
      position: 'absolute',

      right: 3,

      bottom: 1,

      color: '#F2FFD8',

      fontSize: 10,

      fontWeight: '900',

      textShadowColor:
        'rgba(0, 0, 0, 0.9)',

      textShadowRadius: 2,
    },


    relicOverlay: {
      position: 'absolute',

      top: 1,
      right: 1,
      bottom: 1,
      left: 1,

      borderRadius: 9,

      borderWidth: 2,

      borderColor:
        'rgba(255, 187, 83, 0.96)',

      backgroundColor:
        'rgba(86, 55, 28, 0.60)',

      alignItems: 'center',
      justifyContent: 'center',
    },


    relicOverlayStrong: {
      borderWidth: 3,

      borderColor:
        'rgba(255, 219, 139, 1)',

      backgroundColor:
        'rgba(78, 46, 23, 0.76)',
    },


    relicSymbol: {
      fontSize: 25,

      textShadowColor:
        'rgba(0, 0, 0, 0.95)',

      textShadowRadius: 4,
    },


    relicHealthBadge: {
      position: 'absolute',

      right: 2,
      bottom: 2,

      minWidth: 16,
      height: 16,

      borderRadius: 8,

      backgroundColor:
        'rgba(0, 0, 0, 0.78)',

      alignItems: 'center',
      justifyContent: 'center',
    },


    relicHealth: {
      color: '#FFD98B',

      fontSize: 10,

      fontWeight: '900',
    },

    specialBadge: {
      position: 'absolute',

      right: 2,
      bottom: 2,

      minWidth: 21,
      height: 21,

      borderRadius: 11,

      borderWidth: 1,

      borderColor:
        '#62E7FF',

      backgroundColor:
        '#103647',

      alignItems:
        'center',

      justifyContent:
        'center',

      paddingHorizontal: 3,
    },

    specialBadgeMythic: {
      borderColor:
        '#FFD75E',

      backgroundColor:
        '#50350A',
    },

    specialBadgeText: {
      color: '#FFFFFF',

      fontSize: 13,

      fontWeight:
        '900',
    },

    resultOverlay: {
      flex: 1,
      backgroundColor: 'rgba(2, 0, 7, 0.88)',
    },

    resultModalContent: {
      flexGrow: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 14,
      paddingVertical: 30,
    },

    resultCard: {
      width: '100%',
      maxWidth: 430,

      borderRadius: 20,

      borderWidth: 1,

      borderColor:
        '#9143C1',

      backgroundColor:
        'rgba(18, 5, 28, 0.97)',

      alignItems:
        'center',

      padding: 20,
    },

    resultTitle: {
      color: '#FFFFFF',

      fontSize: 23,

      fontWeight:
        '900',

      marginTop: 8,
    },

    resultScore: {
      color: '#62E7FF',

      fontSize: 15,

      fontWeight:
        '900',

      marginTop: 5,
    },

    resultStatsGrid: {
      width: '100%',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 12,
    },

    resultStat: {
      width: '48%',
      minHeight: 62,
      borderRadius: 13,
      borderWidth: 1,
      borderColor: '#403049',
      backgroundColor: 'rgba(8, 5, 16, 0.92)',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8,
    },

    resultStatLabel: {
      color: '#8E8298',
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 0.7,
      textAlign: 'center',
    },

    resultStatValue: {
      color: '#FFFFFF',
      fontSize: 19,
      fontWeight: '900',
      fontVariant: [
        'tabular-nums',
      ],
      marginTop: 3,
    },

    collectedSummary: {
      color: '#C7B9D0',
      fontSize: 10,
      fontWeight: '700',
      lineHeight: 15,
      textAlign: 'center',
      marginTop: 9,
    },

    failurePanel: {
      width: '100%',
      borderRadius: 13,
      borderWidth: 1,
      borderColor: 'rgba(255, 90, 169, 0.45)',
      backgroundColor: 'rgba(84, 15, 48, 0.35)',
      padding: 11,
      gap: 4,
      marginTop: 10,
    },

    failureText: {
      color: '#FFD2E7',
      fontSize: 10,
      fontWeight: '700',
      lineHeight: 15,
    },

    resultRewardLabel: {
      color: '#72F2C3',
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 1,
      marginTop: 12,
    },

    leaderboardResult: {
      width: '100%',

      flexDirection:
        'row',

      alignItems:
        'stretch',

      justifyContent:
        'space-between',

      marginTop: 12,

      borderRadius: 16,

      borderWidth: 1,

      borderColor:
        'rgba(98, 231, 255, 0.32)',

      backgroundColor:
        'rgba(5, 22, 31, 0.82)',

      overflow:
        'hidden',
    },


    leaderboardResultStat: {
      flex: 1,

      minHeight: 74,

      alignItems:
        'center',

      justifyContent:
        'center',

      paddingHorizontal: 6,

      paddingVertical: 10,
    },


    leaderboardResultDivider: {
      width: 1,

      backgroundColor:
        'rgba(98, 231, 255, 0.18)',
    },


    leaderboardResultLabel: {
      color:
        '#8DA8AF',

      fontSize: 7,

      fontWeight:
        '900',

      letterSpacing: 0.7,

      textAlign:
        'center',
    },


    leaderboardResultValue: {
      color:
        '#62E7FF',

      fontSize: 20,

      fontWeight:
        '900',

      marginTop: 4,
    },


    leaderboardButton: {
      width: '100%',

      minHeight: 48,

      borderRadius: 15,

      backgroundColor:
        '#62E7FF',

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'center',

      gap: 8,

      marginTop: 4,
    },


    leaderboardButtonText: {
      color:
        '#05000B',

      fontSize: 11,

      fontWeight:
        '900',

      letterSpacing: 0.8,
    },


    resultNote: {
      color: '#A99BB5',

      fontSize: 11,

      lineHeight: 17,

      textAlign:
        'center',

      marginTop: 8,

      maxWidth: 320,
    },

    restartButton: {
      minWidth: 180,

      minHeight: 46,

      borderRadius: 99,

      marginTop: 15,

      backgroundColor:
        '#922BFF',

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'center',

      gap: 7,
    },

    restartText: {
      color: '#FFFFFF',

      fontSize: 12,

      fontWeight:
        '900',

      letterSpacing: 0.7,
    },

    resultButtonDisabled: {
      opacity: 0.45,
    },

    exitButton: {
      minWidth: 180,
      minHeight: 44,
      borderRadius: 99,
      borderWidth: 1,
      borderColor: '#60496E',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 9,
    },

    exitButtonText: {
      color: '#DCCEE5',
      fontSize: 12,
      fontWeight: '900',
      letterSpacing: 0.7,
    },

    helper: {
      color: '#746A7C',

      fontSize: 10,

      textAlign:
        'center',

      maxWidth: 350,

      lineHeight: 15,
    },
  });
