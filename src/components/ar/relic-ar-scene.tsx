import type { ImageSourcePropType } from "react-native";

import {
  ViroARPlane,
  ViroARScene,
  ViroImage,
} from "@reactvision/react-viro";

// Purpose:
// Information passed from the Mission Trails screen
// into the real AR scene.
export type RelicARSceneAppProps = {
  relicIcon: ImageSourcePropType;

  // Called when AR finds a real surface.
  onPlaneFound?: () => void;

  // Called when the player taps the relic in AR.
  onRelicTouched?: () => void;
};

type SceneNavigator = {
  viroAppProps?: RelicARSceneAppProps;
};

type RelicARSceneProps = {
  sceneNavigator?: SceneNavigator;
  arSceneNavigator?: SceneNavigator;
};

// Purpose:
// Detects a real horizontal surface such as a counter,
// floor, sidewalk, pavement, or trail and anchors the
// relic PNG into that real-world location.
export default function RelicARScene({
  sceneNavigator,
  arSceneNavigator,
}: RelicARSceneProps) {
  const navigator =
    sceneNavigator ?? arSceneNavigator;

  const appProps = navigator?.viroAppProps;

  // If Mission Trails has not passed a relic yet,
  // keep AR running but display nothing.
  if (!appProps?.relicIcon) {
    return (
      <ViroARScene
        anchorDetectionTypes={["PlanesHorizontal"]}
      />
    );
  }

  return (
    <ViroARScene
      anchorDetectionTypes={["PlanesHorizontal"]}
      onAnchorFound={() => {
        appProps.onPlaneFound?.();
      }}
    >
      {/*
        Viro waits until ARKit/ARCore finds a horizontal
        real-world surface at least 30cm x 30cm.

        Once found, everything inside ViroARPlane becomes
        locked to that physical surface.
      */}
      <ViroARPlane
        alignment="Horizontal"
        minWidth={0.3}
        minHeight={0.3}
      >
        {/*
          The relic floats about 15cm above the surface.

          billboardY keeps the flat PNG facing the player
          while still remaining anchored in world space.
        */}
        <ViroImage
          source={appProps.relicIcon}
          width={0.28}
          height={0.28}
          position={[0, 0.15, 0]}
          transformBehaviors={["billboardY"]}
          onClick={() => {
            appProps.onRelicTouched?.();
          }}
        />
      </ViroARPlane>
    </ViroARScene>
  );
}
