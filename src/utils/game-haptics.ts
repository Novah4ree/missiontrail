import * as Haptics from 'expo-haptics';

import type { RelicHuntStage } from '@/utils/relic-hunt';

// Purpose: Implements the wait operation.
function wait(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Egg hatch pattern:
 * small cracks -> stronger crack -> hatch burst
 */
// Purpose: Implements the play egg hatch haptics operation.
export async function playEggHatchHaptics() {
  try {
    await Haptics.impactAsync(
      Haptics.ImpactFeedbackStyle.Light
    );

    await wait(170);

    await Haptics.impactAsync(
      Haptics.ImpactFeedbackStyle.Light
    );

    await wait(170);

    await Haptics.impactAsync(
      Haptics.ImpactFeedbackStyle.Medium
    );

    await wait(220);

    await Haptics.impactAsync(
      Haptics.ImpactFeedbackStyle.Heavy
    );

    await wait(120);

    await Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Success
    );
  } catch (error) {
    console.warn(
      '[Haptics] Egg hatch feedback failed:',
      error
    );
  }
}

/**
 * Relic collection should feel quick and rewarding,
 * but not as dramatic as an egg hatch.
 */
// Purpose: Implements the play relic collect haptics operation.
export async function playRelicCollectHaptics() {
  try {
    await Haptics.impactAsync(
      Haptics.ImpactFeedbackStyle.Medium
    );

    await wait(100);

    await Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Success
    );
  } catch (error) {
    console.warn(
      '[Haptics] Relic collection feedback failed:',
      error
    );
  }
}

// Purpose: Implements the play relic hunt stage haptic operation.
export async function playRelicHuntStageHaptic(stage: RelicHuntStage) {
  try {
    if (stage === 'CLOSING_IN') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else if (stage === 'NEARBY') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else if (stage === 'VERY_CLOSE') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } else if (stage === 'SIGNAL_LOCKED') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
      await wait(90);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else if (stage === 'FOUND') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  } catch (error) {
    console.warn('[Haptics] Relic hunt feedback failed:', error);
  }
}
