import type { QueuedGpsSample } from '@/types/daily-progress';

// This provider cannot be imported into a production build path. The server also
// requires an explicit feature flag and user allow-list, so __DEV__ alone is not trust.
export function createDevelopmentWalkingSamples(
  latitude: number,
  longitude: number,
  count = 6,
): QueuedGpsSample[] {
  if (!__DEV__) throw new Error('Development distance provider is unavailable');

  const endingAt = Date.now();
  return Array.from({ length: count }, (_, index) => ({
    sampleId: `development-${endingAt}-${index}`,
    latitude: latitude + index * 0.00005,
    longitude,
    accuracyMeters: 3,
    capturedAt: new Date(endingAt - (count - index) * 5_000).toISOString(),
    reportedSpeedMetersPerSecond: 1.1,
    mocked: true,
    movementKind: 'walking',
  }));
}
