import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  Image,
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
  createFoodSortLevel,
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


const BOARD_GAP = 2;
const BOARD_PADDING = 4;


// Purpose: Gives the screen a safe Level 1
// while permanent progress loads from Supabase.
const INITIAL_LEVEL =
  createFoodSortLevel(1);


type GameStatus =
  | 'playing'
  | 'won'
  | 'lost';


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


  const [board, setBoard] =
    useState<FoodSortTile[]>(
      () =>
        createFoodSortBoard(),
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
      'playing',
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


  // Purpose: Starts one secure Food Sort run on Supabase.
  async function startServerRun() {
    setIsStartingRun(true);
    setRunId(null);
    setRewardMessage(null);

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

      const nextLevel =
        createFoodSortLevel(
          serverLevel,
        );


      const { data, error } =
        await supabase.rpc(
          'server_start_food_sort_run',
        );

      if (error) {
        throw error;
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

      setRunId(
        String(result.run_id),
      );

      setLevelConfig(
        nextLevel,
      );

      setBoard(
        createFoodSortBoard(),
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

      setCollected(
        createEmptyCollected(),
      );

      setGameStatus(
        'playing',
      );

      setMessage(
        nextLevel.bossLevel
          ? `LEVEL ${nextLevel.level} CHECKPOINT! The kitchen just got tougher. 🔥`
          : `Level ${nextLevel.level} ready! Match the food goals.`,
      );
    } catch (error) {
      console.warn(
        '[Food Sort] Could not start secure run.',
        error,
      );

      setMessage(
        'Food Sort could not connect to the reward server.',
      );
    } finally {
      setIsStartingRun(false);
    }
  }


  // Purpose: Claims the fixed server-owned reward after a win.
  async function claimWinReward(
    completedRunId: string,
    finalScore: number,
    finalMoves: number,
  ) {
    if (isClaimingReward) {
      return;
    }

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

        return;
      }

      const explorerPoints =
        Number(
          result.explorer_points ??
          0,
        );

      const carrotQuantity =
        Number(
          result.carrot_quantity ??
          0,
        );

      const treatQuantity =
        Number(
          result.treat_quantity ??
          0,
        );

      if (result.rewarded) {
        setRewardMessage(
          `REWARDED! +${explorerPoints} Explorer Score • +${carrotQuantity} Ember Carrot • +${treatQuantity} Aurora Pudding • +5 Bond • +5 Happiness 🎁`,
        );
      } else {
        setRewardMessage(
          `+${explorerPoints} Explorer Score. Today's free Food Sort food rewards are already used.`,
        );
      }
    } catch (error) {
      console.warn(
        '[Food Sort] Reward claim failed.',
        error,
      );

      setRewardMessage(
        'Level completed, but the reward server could not be reached.',
      );
    } finally {
      setIsClaimingReward(false);
    }
  }


  // Purpose: Starts Level 1 over from scratch.
  async function restartGame() {
    setMessage(
      'Loading your next Food Sort challenge...',
    );

    await startServerRun();
  }


  // Purpose: Creates the first secure run when the screen opens.
  useEffect(() => {
    void startServerRun();
  }, []);


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
      setSelectedIndex(null);

      setMessage(
        'That swap does not make a match.',
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


    setBoard(
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
        levelConfig.goals,
      ) &&
      remainingObstacles === 0
    ) {
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
        'MYTHIC TREAT CREATED! ✦ Match it to unleash a huge clear!',
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
      'Nice match! Keep going.',
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


    performFoodSwap(
      index,
      targetIndex,
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
                  : 'Match my food before the moves run out!'}
            </Text>
          </View>
        </View>


        {/* SCORE */}
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
              GAME SCORE
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
              {levelConfig.name}
            </Text>

            <Text
              style={
                styles.difficultyText
              }
            >
              {levelConfig.bossLevel
                ? 'Checkpoint challenge • harder goals'
                : `${levelConfig.moves} moves • goals increase as you climb`}
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
            {levelConfig.goals.map(
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
                        FOOD_ART[
                          goal.foodId
                        ].image
                      }
                      resizeMode="contain"
                      style={
                        styles.goalImage
                      }
                    />

                    <Text
                      style={
                        styles.goalText
                      }
                    >
                      {Math.min(
                        amount,
                        goal.target,
                      )}
                      /{goal.target}
                    </Text>

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
                            `${FOOD_ART[tile.foodId].label}${tile.special !== 'none' ? ` ${tile.special} power` : ''}`
                          }

                          disabled={
                            gameStatus !==
                              'playing' ||
                            !runId ||
                            isStartingRun ||
                            isClaimingReward
                          }

                          onPressIn={(
                            event,
                          ) =>
                            startTileSwipe(
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
                          <Image
                            source={
                              FOOD_ART[
                                tile.foodId
                              ].image
                            }

                            resizeMode="contain"

                            style={
                              styles.tileImage
                            }
                          />


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
        {gameStatus !==
        'playing' ? (
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
                ? 'LEVEL COMPLETE!'
                : 'TRY AGAIN'}
            </Text>

            <Text
              style={
                styles.resultScore
              }
            >
              Game Score:{' '}
              {score.toLocaleString()}
            </Text>

            <Text
              style={
                styles.resultNote
              }
            >
              {isClaimingReward
                ? 'Verifying your secure Mission Trails reward...'
                : rewardMessage ??
                  'Your level result has been sent to Mission Trails.'}
            </Text>

            <Pressable
              onPress={
                restartGame
              }
              style={
                styles.restartButton
              }
            >
              <Ionicons
                name="refresh"
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
          </View>
        ) : null}


        <Text
          style={
            styles.helper
          }
        >
          Match 3 or more identical foods.
          Invalid swaps do not use a move.
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

      gap: 8,
    },

    goalCard: {
      flex: 1,

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

    helper: {
      color: '#746A7C',

      fontSize: 10,

      textAlign:
        'center',

      maxWidth: 350,

      lineHeight: 15,
    },
  });
