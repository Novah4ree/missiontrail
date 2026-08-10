import type { Trail } from '@/types/trails';

type TrailMapMarkerProps = {
  trail: Trail;
  selected: boolean;
  onPress: () => void;
};

// Web uses the Trails screen's existing non-map message, so no native marker is rendered.
// Important note: Displays the trail map marker on a map.
export function TrailMapMarker(_props: TrailMapMarkerProps) {
  return null;
}
