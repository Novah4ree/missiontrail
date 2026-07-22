import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MissionTrailColors as C } from '@/constants/theme';
import type { TrailMeetup } from '@/types/trails';

// This card shows public meetup facts and provides join and safety actions.
export function TrailMeetupCard({ meetup, requested, onJoin, onReport, onBlock }: {
  meetup: TrailMeetup;
  requested: boolean;
  onJoin: () => void;
  onReport: () => void;
  onBlock: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.heading}><Text style={styles.title}>{meetup.title}</Text><Text style={styles.pace}>{meetup.pace.toUpperCase()}</Text></View>
      <MeetupLine icon="calendar-outline" text={`${meetup.date} · ${meetup.startTime}`} />
      <MeetupLine icon="location-outline" text={meetup.meetingPoint} />
      <MeetupLine icon="person-outline" text={`${meetup.hostName} · ${meetup.attendeeCount}/${meetup.maxGroupSize} attending`} />
      <View style={styles.actions}>
        <Pressable disabled={requested || meetup.attendeeCount >= meetup.maxGroupSize} onPress={onJoin} style={[styles.join, requested && styles.disabled]} accessibilityLabel={`Request to join ${meetup.title}`}>
          <Text style={styles.joinText}>{requested ? 'Request Sent' : 'Request to Join'}</Text>
        </Pressable>
        <Pressable accessibilityLabel={`Report host of ${meetup.title}`} onPress={onReport} style={styles.iconButton}><Ionicons name="flag-outline" size={18} color={C.warning} /></Pressable>
        <Pressable accessibilityLabel={`Block host of ${meetup.title}`} onPress={onBlock} style={styles.iconButton}><Ionicons name="ban-outline" size={18} color={C.danger} /></Pressable>
      </View>
    </View>
  );
}

// Displays one meetup detail with a matching icon.
function MeetupLine({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return <View style={styles.line}><Ionicons name={icon} size={15} color={C.cyan} /><Text style={styles.lineText}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, borderColor: C.border, backgroundColor: C.surfaceRaised, padding: 14, gap: 8, marginBottom: 10 },
  heading: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  title: { flex: 1, color: C.text, fontSize: 14, fontWeight: '900' },
  pace: { color: C.green, fontSize: 9, fontWeight: '900' },
  line: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  lineText: { flex: 1, color: C.textMuted, fontSize: 11, lineHeight: 16 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  join: { flex: 1, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#69227E' },
  joinText: { color: C.text, fontSize: 11, fontWeight: '900' },
  iconButton: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.5 },
});
