import type {
  ComponentClass,
  ReactNode,
} from "react";

import NativeMapView, {
  Circle,
  Marker,
  Polyline,
  PROVIDER_GOOGLE,
  type MapViewProps,
} from "react-native-maps";

// ============================================================
// MISSION TRAILS NATIVE MAP ADAPTER
// ============================================================
//
// react-native-maps works correctly at runtime, but the version
// used by this Expo project can have a JSX children typing
// mismatch with the current React TypeScript definitions.
//
// Keep the real native MapView.
// We only repair the TypeScript surface here.
// ============================================================

type MissionTrailMapViewProps =
  MapViewProps & {
    children?: ReactNode;
  };

const MapView =
  NativeMapView as unknown as ComponentClass<
    MissionTrailMapViewProps
  >;

export {
  Circle,
  MapView,
  Marker,
  Polyline,
  PROVIDER_GOOGLE,
};
