import type { Trail } from '@/types/trails';

type TrailMapMarkerProps = {
  trail: Trail;
  selected: boolean;
  onPress: () => void;
};

// Web uses the Trails screen's existing non-map message, so no native marker is rendered.
export function TrailMapMarker(_props: TrailMapMarkerProps) {
  return null;
}
