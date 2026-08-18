import type { Trail } from '@/types/trails';

type TrailMapMarkerProps = {
  trail: Trail;
  selected: boolean;
  onPress: () => void;
};

// Web uses the Trails screen's existing non-map message, so no native marker is rendered.
// Purpose: Renders the trail map marker interface.
export function TrailMapMarker(_props: TrailMapMarkerProps) {
  return null;
}
