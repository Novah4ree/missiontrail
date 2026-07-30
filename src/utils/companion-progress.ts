export function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function getEnergyPercent(energy: number, maximumEnergy: number) {
  if (!Number.isFinite(maximumEnergy) || maximumEnergy <= 0) return 0;
  return clampPercent((Math.max(0, energy) / maximumEnergy) * 100);
}

export function formatCompanionName(companionId: string | null | undefined) {
  if (!companionId) return null;
  return companionId
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
