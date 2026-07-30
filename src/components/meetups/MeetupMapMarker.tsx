import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { Marker } from '@/components/maps/map-components';
import { MissionTrailColors as C } from '@/constants/theme';
import type { Meetup, MeetupCategory } from '@/types/meetups';

type Props = {
  meetup: Meetup;
  friendsAttending: number;
  onPress: (meetupId: string) => void;
};

type CategoryVisual = {
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
};

const CATEGORY_VISUALS: Readonly<Record<MeetupCategory, CategoryVisual>> = {
  adventure: { color: C.green, icon: 'compass', label: 'Adventure' },
  games: { color: C.magenta, icon: 'game-controller', label: 'Games' },
  shopping: { color: '#FFB84D', icon: 'bag-handle', label: 'Shopping' },
  culture: { color: C.purple, icon: 'business', label: 'Culture' },
  food: { color: '#FF718D', icon: 'cafe', label: 'Food' },
  fitness: { color: C.cyan, icon: 'fitness', label: 'Fitness' },
};

/** Draws one social landmark pin without showing any attendee coordinates. */
function MeetupMapMarkerComponent({ meetup, friendsAttending, onPress }: Props) {
  if (Platform.OS === 'web') return null;
  const visual = CATEGORY_VISUALS[meetup.category];
  const officialAndVerified = meetup.type === 'official' && meetup.isVerified;
  const description = [
    visual.label,
    meetup.landmarkName,
    friendsAttending > 0 ? `${friendsAttending} friends attending` : null,
    officialAndVerified ? 'Official verified meetup' : null,
  ].filter(Boolean).join('. ');

  return (
    <Marker
      key={`${meetup.id}:${meetup.category}:${friendsAttending}:${officialAndVerified}`}
      accessibilityLabel={`${meetup.title}. ${description}`}
      accessibilityRole="button"
      coordinate={{ latitude: meetup.latitude, longitude: meetup.longitude }}
      description={description}
      onPress={() => onPress(meetup.id)}
      title={meetup.title}
      tracksViewChanges={false}
    >
      <View style={[styles.pinHalo, { borderColor: visual.color }]}>
        <View style={[styles.pinCore, { backgroundColor: visual.color }]}>
          <Ionicons name={visual.icon} size={18} color="#08020F" />
        </View>

        {friendsAttending > 0 ? (
          <View accessibilityLabel={`${friendsAttending} friends attending`} style={styles.friendBadge}>
            <Ionicons name="people" size={9} color="#08020F" />
            <Text style={styles.friendCount}>{Math.min(friendsAttending, 9)}</Text>
          </View>
        ) : null}

        {officialAndVerified ? (
          <View accessibilityLabel="Official verified meetup" style={styles.verifiedBadge}>
            <Ionicons name="shield-checkmark" size={11} color="#08020F" />
          </View>
        ) : null}
      </View>
    </Marker>
  );
}

/** Prevents unrelated map state changes from redrawing an unchanged marker. */
function markerPropsAreEqual(previous: Props, next: Props): boolean {
  return previous.meetup.id === next.meetup.id
    && previous.meetup.latitude === next.meetup.latitude
    && previous.meetup.longitude === next.meetup.longitude
    && previous.meetup.title === next.meetup.title
    && previous.meetup.landmarkName === next.meetup.landmarkName
    && previous.meetup.category === next.meetup.category
    && previous.meetup.type === next.meetup.type
    && previous.meetup.isVerified === next.meetup.isVerified
    && previous.friendsAttending === next.friendsAttending
    && previous.onPress === next.onPress;
}

export const MeetupMapMarker = memo(MeetupMapMarkerComponent, markerPropsAreEqual);

const styles = StyleSheet.create({
  pinHalo: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    backgroundColor: 'rgba(8, 2, 15, 0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.cyan,
    shadowOpacity: 0.45,
    shadowRadius: 7,
    elevation: 7,
  },
  pinCore: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendBadge: {
    position: 'absolute',
    right: -7,
    bottom: -4,
    minWidth: 24,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#08020F',
    backgroundColor: C.green,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    paddingHorizontal: 3,
  },
  friendCount: { color: '#08020F', fontSize: 9, fontWeight: '900' },
  verifiedBadge: {
    position: 'absolute',
    left: -6,
    top: -5,
    width: 21,
    height: 21,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#08020F',
    backgroundColor: C.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
