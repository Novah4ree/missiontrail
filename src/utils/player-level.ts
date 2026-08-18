import {
  PLAYER_LEVEL_XP_BASE,
  PLAYER_LEVEL_XP_EXPONENT,
} from '../config/progression-rules.ts';

export type PlayerLevelProgress = {
  level: number;
  totalXp: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  xpRemaining: number;
  progressPercent: number;
};

/** Returns the XP required to advance from the supplied level. */
// Purpose: Implements the xp for level operation.
export const xpForLevel = (level: number) =>
  Math.round(
    PLAYER_LEVEL_XP_BASE
      * Math.pow(Math.max(1, Math.floor(level)), PLAYER_LEVEL_XP_EXPONENT),
  );

/** Converts lifetime XP into a level and progress within that level. */
// Purpose: Returns player level progress.
export function getPlayerLevelProgress(totalXp: number): PlayerLevelProgress {
  const safeTotalXp = Number.isFinite(totalXp) ? Math.max(0, Math.floor(totalXp)) : 0;
  let level = 1;
  let xpIntoLevel = safeTotalXp;
  let xpForNextLevel = xpForLevel(level);

  while (xpIntoLevel >= xpForNextLevel) {
    xpIntoLevel -= xpForNextLevel;
    level += 1;
    xpForNextLevel = xpForLevel(level);
  }

  return {
    level,
    totalXp: safeTotalXp,
    xpIntoLevel,
    xpForNextLevel,
    xpRemaining: xpForNextLevel - xpIntoLevel,
    progressPercent: Math.round((xpIntoLevel / xpForNextLevel) * 100),
  };
}
