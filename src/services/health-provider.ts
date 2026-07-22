import { NativeModules, Platform } from 'react-native';

import type {
  DistanceSource,
  HealthActivityRecord,
  HealthPermissionState,
} from '@/types/daily-progress';

type HealthBridge = {
  requestPermissions(): Promise<boolean>;
  getPermissionStatus(): Promise<HealthPermissionState>;
  readWalkingRunningActivities(since: string): Promise<HealthActivityRecord[]>;
};

export type HealthProvider = {
  source: Extract<DistanceSource, 'healthkit' | 'health_connect'>;
  isAvailable(): boolean;
  getPermissionStatus(): Promise<HealthPermissionState>;
  requestPermissions(): Promise<HealthPermissionState>;
  readActivities(since: Date): Promise<HealthActivityRecord[]>;
};

function nativeBridge(): HealthBridge | undefined {
  return NativeModules.MissionTrailsHealthBridge as HealthBridge | undefined;
}

export function getPlatformHealthProvider(): HealthProvider | null {
  const source = Platform.OS === 'ios'
    ? 'healthkit'
    : Platform.OS === 'android'
      ? 'health_connect'
      : null;
  if (!source) return null;

  return {
    source,
    isAvailable: () => Boolean(nativeBridge()),
    getPermissionStatus: async () => nativeBridge()?.getPermissionStatus() ?? 'unavailable',
    requestPermissions: async () => {
      const bridge = nativeBridge();
      if (!bridge) return 'unavailable';
      return (await bridge.requestPermissions()) ? 'granted' : 'denied';
    },
    readActivities: async (since) => {
      const bridge = nativeBridge();
      if (!bridge) return [];
      return bridge.readWalkingRunningActivities(since.toISOString());
    },
  };
}
