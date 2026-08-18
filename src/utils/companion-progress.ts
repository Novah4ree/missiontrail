// Purpose: Clamps percent to its supported range.
export function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

// Purpose: Returns energy percent.
export function getEnergyPercent(energy: number, maximumEnergy: number) {
  if (!Number.isFinite(maximumEnergy) || maximumEnergy <= 0) return 0;
  return clampPercent((Math.max(0, energy) / maximumEnergy) * 100);
}

// Purpose: Formats companion name.
export function formatCompanionName(companionId: string | null | undefined) {
  if (!companionId) return null;
  return companionId
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
