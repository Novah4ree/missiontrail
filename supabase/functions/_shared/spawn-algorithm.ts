export type Coordinate = {
  latitude: number;
  longitude: number;
};

export type SpawnWindow = {
  windowId: string;
  startsAt: string;
  endsAt: string;
  graceEndsAt: string;
};

export type SpawnPoint = Coordinate & {
  slotIndex: number;
};

export type MysteryZone = {
  center: Coordinate;
  clueBandMeters: number;
  radiusMeters: number;
};

const EARTH_RADIUS_METERS = 6_371_000;
const GEOHASH_ALPHABET = '0123456789bcdefghjkmnpqrstuvwxyz';

function degreesToRadians(degrees: number) {
  return degrees * (Math.PI / 180);
}

function radiansToDegrees(radians: number) {
  return radians * (180 / Math.PI);
}

export function getSpawnWindow(
  serverNow: Date,
  windowMinutes = 30,
  gracePeriodSeconds = 120,
): SpawnWindow {
  const windowMilliseconds = windowMinutes * 60 * 1000;
  const windowNumber = Math.floor(serverNow.getTime() / windowMilliseconds);
  const startsAtMilliseconds = windowNumber * windowMilliseconds;
  const endsAtMilliseconds = startsAtMilliseconds + windowMilliseconds;

  return {
    // A window ID is derived only from server time. At 12:00 and 12:29:59 it is
    // identical; at 12:30 a new ID begins.
    windowId: String(windowNumber),
    startsAt: new Date(startsAtMilliseconds).toISOString(),
    endsAt: new Date(endsAtMilliseconds).toISOString(),
    graceEndsAt: new Date(endsAtMilliseconds + gracePeriodSeconds * 1000).toISOString(),
  };
}

export function distanceMeters(from: Coordinate, to: Coordinate) {
  const latitudeDelta = degreesToRadians(to.latitude - from.latitude);
  const longitudeDelta = degreesToRadians(to.longitude - from.longitude);
  const fromLatitude = degreesToRadians(from.latitude);
  const toLatitude = degreesToRadians(to.latitude);

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function destinationPoint(
  center: Coordinate,
  distanceFromCenterMeters: number,
  bearingDegrees: number,
): Coordinate {
  const angularDistance = distanceFromCenterMeters / EARTH_RADIUS_METERS;
  const bearing = degreesToRadians(bearingDegrees);
  const centerLatitude = degreesToRadians(center.latitude);
  const centerLongitude = degreesToRadians(center.longitude);

  const latitude = Math.asin(
    Math.sin(centerLatitude) * Math.cos(angularDistance) +
      Math.cos(centerLatitude) * Math.sin(angularDistance) * Math.cos(bearing),
  );
  const longitude =
    centerLongitude +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(centerLatitude),
      Math.cos(angularDistance) - Math.sin(centerLatitude) * Math.sin(latitude),
    );

  // Spherical destination math naturally accounts for longitude lines becoming
  // closer together toward the poles; a flat degrees-per-mile conversion does not.
  return {
    latitude: radiansToDegrees(latitude),
    longitude: ((radiansToDegrees(longitude) + 540) % 360) - 180,
  };
}

async function hmacBytes(secret: string, message: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));

  return new Uint8Array(signature);
}

export async function hmacDigest(secret: string, message: string) {
  return Array.from(await hmacBytes(secret, message))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function deterministicIndex(secret: string, message: string, length: number) {
  if (!Number.isInteger(length) || length <= 0) {
    throw new Error('A deterministic choice requires at least one item');
  }

  const bytes = await hmacBytes(secret, message);
  return Math.floor(unitInterval(bytes, 0) * length);
}

function unitInterval(bytes: Uint8Array, offset: number) {
  const value =
    bytes[offset] * 0x1000000 +
    bytes[offset + 1] * 0x10000 +
    bytes[offset + 2] * 0x100 +
    bytes[offset + 3];

  return value / 0x1_0000_0000;
}

export async function generateDeterministicCandidates({
  secret,
  regionGeohash,
  windowId,
  center,
  count,
  searchRadiusMeters,
  minimumSpacingMeters,
}: {
  secret: string;
  regionGeohash: string;
  windowId: string;
  center: Coordinate;
  count: number;
  searchRadiusMeters: number;
  minimumSpacingMeters: number;
}) {
  const candidates: SpawnPoint[] = [];
  const maximumAttempts = Math.max(80, count * 30);

  for (let attempt = 0; attempt < maximumAttempts && candidates.length < count; attempt += 1) {
    // HMAC makes the result deterministic for this region/window while preventing
    // a client from predicting it without the server-only secret.
    const bytes = await hmacBytes(
      secret,
      `candidate|${regionGeohash}|${windowId}|${attempt}`,
    );
    const radius = Math.sqrt(unitInterval(bytes, 0)) * searchRadiusMeters;
    const bearing = unitInterval(bytes, 4) * 360;
    const point = destinationPoint(center, radius, bearing);

    if (candidates.every((candidate) => distanceMeters(candidate, point) >= minimumSpacingMeters)) {
      candidates.push({ ...point, slotIndex: candidates.length });
    }
  }

  if (candidates.length !== count) {
    throw new Error('Unable to generate safely spaced relic candidates');
  }

  return candidates;
}

export async function selectDeterministicSafeLocations({
  secret,
  regionGeohash,
  windowId,
  locations,
  count,
  minimumSpacingMeters,
}: {
  secret: string;
  regionGeohash: string;
  windowId: string;
  locations: Array<Coordinate & { id: string }>;
  count: number;
  minimumSpacingMeters: number;
}) {
  const ranked = await Promise.all(
    locations.map(async (location) => ({
      location,
      rank: Array.from(
        await hmacBytes(secret, `safe-location|${regionGeohash}|${windowId}|${location.id}`),
      )
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join(''),
    })),
  );

  ranked.sort((left, right) => left.rank.localeCompare(right.rank));

  const selected: Array<Coordinate & { id: string; slotIndex: number }> = [];

  for (const entry of ranked) {
    if (selected.every((candidate) => distanceMeters(candidate, entry.location) >= minimumSpacingMeters)) {
      selected.push({ ...entry.location, slotIndex: selected.length });
    }

    if (selected.length === count) break;
  }

  return selected;
}

export async function createMysteryZone({
  secret,
  regionGeohash,
  windowId,
  slotIndex,
  exactPoint,
  clueDistanceBandsMeters,
}: {
  secret: string;
  regionGeohash: string;
  windowId: string;
  slotIndex: number;
  exactPoint: Coordinate;
  clueDistanceBandsMeters: readonly number[];
}): Promise<MysteryZone> {
  const bytes = await hmacBytes(
    secret,
    `mystery-zone|${regionGeohash}|${windowId}|${slotIndex}`,
  );
  const bandIndex = Math.min(
    clueDistanceBandsMeters.length - 1,
    Math.floor(unitInterval(bytes, 0) * clueDistanceBandsMeters.length),
  );
  const clueBandMeters = clueDistanceBandsMeters[bandIndex];
  const offsetMeters = clueBandMeters * (0.55 + unitInterval(bytes, 4) * 0.35);
  const bearing = unitInterval(bytes, 8) * 360;

  return {
    // The clue circle contains the relic, but its center is deliberately offset.
    // Returning an exact-centered circle would leak the secret point visually.
    center: destinationPoint(exactPoint, offsetMeters, bearing),
    clueBandMeters,
    radiusMeters: clueBandMeters,
  };
}

export function encodeGeohash(coordinate: Coordinate, precision = 5) {
  let latitudeRange: [number, number] = [-90, 90];
  let longitudeRange: [number, number] = [-180, 180];
  let evenBit = true;
  let bit = 0;
  let character = 0;
  let geohash = '';

  while (geohash.length < precision) {
    const range = evenBit ? longitudeRange : latitudeRange;
    const value = evenBit ? coordinate.longitude : coordinate.latitude;
    const midpoint = (range[0] + range[1]) / 2;

    if (value >= midpoint) {
      character = (character << 1) | 1;
      range[0] = midpoint;
    } else {
      character <<= 1;
      range[1] = midpoint;
    }

    evenBit = !evenBit;
    bit += 1;

    if (bit === 5) {
      geohash += GEOHASH_ALPHABET[character];
      bit = 0;
      character = 0;
    }
  }

  return geohash;
}

export function decodeGeohashCenter(geohash: string): Coordinate {
  let latitudeRange: [number, number] = [-90, 90];
  let longitudeRange: [number, number] = [-180, 180];
  let evenBit = true;

  for (const character of geohash.toLowerCase()) {
    const characterValue = GEOHASH_ALPHABET.indexOf(character);

    if (characterValue < 0) throw new Error('Invalid geohash');

    for (let mask = 16; mask > 0; mask >>= 1) {
      const range = evenBit ? longitudeRange : latitudeRange;
      const midpoint = (range[0] + range[1]) / 2;

      if ((characterValue & mask) !== 0) range[0] = midpoint;
      else range[1] = midpoint;

      evenBit = !evenBit;
    }
  }

  return {
    latitude: (latitudeRange[0] + latitudeRange[1]) / 2,
    longitude: (longitudeRange[0] + longitudeRange[1]) / 2,
  };
}
