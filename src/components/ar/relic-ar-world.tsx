import type { ImageSourcePropType } from "react-native";
import {
  StyleSheet,
  View,
} from "react-native";

import {
  ViroARSceneNavigator,
} from "@reactvision/react-viro";

import RelicARScene, {
  type RelicARSceneAppProps,
} from "./relic-ar-scene";

type RelicARWorldProps = {
  relicId: string;
  relicIcon: ImageSourcePropType;

  // Purpose:
  // Tells the normal React Native screen that
  // AR found a usable real-world surface.
  onPlaneFound?: () => void;

  // Purpose:
  // Tells Mission Trails that the player
  // physically tapped the relic inside AR.
  onRelicTouched?: () => void;
};

// Purpose:
// Owns the actual AR camera and loads
// Mission Trails' relic AR scene.
export function RelicARWorld({
  relicId,
  relicIcon,
  onPlaneFound,
  onRelicTouched,
}: RelicARWorldProps) {
  const viroAppProps: RelicARSceneAppProps = {
    relicId,
    relicIcon,
    onPlaneFound,
    onRelicTouched,
  };

  return (
    <View style={styles.container}>
      <ViroARSceneNavigator
        provider="none"
        initialScene={{
          scene: RelicARScene,
        }}
        viroAppProps={viroAppProps}
        style={StyleSheet.absoluteFillObject}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
});
