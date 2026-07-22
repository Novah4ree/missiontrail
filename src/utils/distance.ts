export type Coordinate = {
  latitude: number;
  longitude: number;
};

const EARTH_RADIUS_METERS = 6_371_000;
const FEET_PER_METER = 3.280_839_895;

function degreesToRadians(degrees: number) {
  return degrees * (Math.PI / 180);
}

/** Returns the great-circle distance between two coordinates in meters. */
export function calculateDistanceMeters(from: Coordinate, to: Coordinate) {
  const latitudeDelta = degreesToRadians(to.latitude - from.latitude);
  const longitudeDelta = degreesToRadians(to.longitude - from.longitude);
  const fromLatitude = degreesToRadians(from.latitude);
  const toLatitude = degreesToRadians(to.latitude);

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  const centralAngle = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));

  return EARTH_RADIUS_METERS * centralAngle;
}

export function feetToMeters(feet: number) {
  return feet / FEET_PER_METER;
}

/** Formats a metric GPS distance for an imperial, feet-and-inches interface. */
export function formatDistanceFeetAndInches(distanceMeters: number) {
  const totalInches = Math.max(0, Math.round(distanceMeters * FEET_PER_METER * 12));
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;

  return `${feet.toLocaleString()} ft ${inches} in`;
}

/** Returns a coordinate a given number of feet and compass degrees from an origin. */
export function getCoordinateOffsetByFeet(
  origin: Coordinate,
  distanceFeet: number,
  bearingDegrees: number,
): Coordinate {
  const angularDistance = feetToMeters(distanceFeet) / EARTH_RADIUS_METERS;
  const bearing = degreesToRadians(bearingDegrees);
  const originLatitude = degreesToRadians(origin.latitude);
  const originLongitude = degreesToRadians(origin.longitude);

  const latitude = Math.asin(
    Math.sin(originLatitude) * Math.cos(angularDistance) +
      Math.cos(originLatitude) * Math.sin(angularDistance) * Math.cos(bearing),
  );
  const longitude =
    originLongitude +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(originLatitude),
      Math.cos(angularDistance) - Math.sin(originLatitude) * Math.sin(latitude),
    );

  return {
    latitude: latitude * (180 / Math.PI),
    longitude: longitude * (180 / Math.PI),
  };
}
