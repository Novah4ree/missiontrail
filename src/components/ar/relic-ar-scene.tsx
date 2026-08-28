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
  relicId: string;
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
// Gives each relic a repeatable hidden position.
// The same relic ID gets the same offset during the encounter.
function getHiddenRelicPosition(
  relicId: string,
): [number, number, number] {
  const positions: [number, number, number][] = [
    [-0.12, 0.12, -0.10],
    [0.12, 0.12, -0.10],
    [-0.11, 0.12, 0.11],
    [0.11, 0.12, 0.11],
    [0, 0.12, -0.14],
    [-0.14, 0.12, 0],
    [0.14, 0.12, 0],
    [0, 0.12, 0.14],
  ];

  const hash = [...relicId].reduce(
    (total, character) =>
      total + character.charCodeAt(0),
    0,
  );

  return positions[hash % positions.length];
}

// Purpose:
// Detects a real horizontal surface such as a counter,
// floor, sidewalk, pavement, or trail and anchors the
// relic PNG into that real-world location.
export default function RelicARScene({
  sceneNavigator,
  arSceneNavigator,
}: RelicARSceneProps = {}) {
  const navigator =
    sceneNavigator ?? arSceneNavigator;

  const appProps = navigator?.viroAppProps;

  const relicPosition = appProps
    ? getHiddenRelicPosition(appProps.relicId)
    : [0, 0.12, 0] as [number, number, number];

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
        minWidth={0.45}
        minHeight={0.45}
      >
        {/*
          The relic floats about 15cm above the surface.

          billboardY keeps the flat PNG facing the player
          while still remaining anchored in world space.
        */}
        <ViroImage
          source={appProps.relicIcon}
          width={0.20}
          height={0.20}
          position={relicPosition}
          transformBehaviors={["billboardY"]}
          onClick={() => {
            appProps.onRelicTouched?.();
          }}
        />
      </ViroARPlane>
    </ViroARScene>
  );
}
