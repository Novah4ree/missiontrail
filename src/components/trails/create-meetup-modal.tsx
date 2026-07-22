import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MissionTrailColors as C } from '@/constants/theme';
import type { CreateMeetupInput } from '@/services/trail-data-service';
import type { MeetupPace, Trail } from '@/types/trails';

// This form collects only public meetup details and never asks for a private location.
export function CreateMeetupModal({ visible, trail, onClose, onCreate }: {
  visible: boolean;
  trail: Trail;
  onClose: () => void;
  onCreate: (input: CreateMeetupInput) => Promise<void>;
}) {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('Public Trail Walk');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [meetingPoint, setMeetingPoint] = useState(trail.startLocation);
  const [pace, setPace] = useState<MeetupPace>('moderate');
  const [maxGroupSize, setMaxGroupSize] = useState('10');

  // Keeps the public meeting-point field matched to the currently selected trail.
  useEffect(() => { setMeetingPoint(trail.startLocation); }, [trail.startLocation]);

  const canSubmit = Boolean(title.trim() && date.trim() && startTime.trim() && meetingPoint.trim() && Number(maxGroupSize) >= 2);

  // Validates the simple form, limits group size, and sends clean values to the service.
  async function submit() {
    if (!canSubmit) return;
    await onCreate({
      trailId: trail.id,
      title: title.trim(),
      date: date.trim(),
      startTime: startTime.trim(),
      meetingPoint: meetingPoint.trim(),
      pace,
      maxGroupSize: Math.min(50, Math.round(Number(maxGroupSize))),
    });
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <View><Text style={styles.eyebrow}>PUBLIC EVENT</Text><Text style={styles.title}>Create Meetup</Text></View>
          <Pressable accessibilityLabel="Close create meetup" onPress={onClose} style={styles.close}><Ionicons name="close" size={22} color={C.text} /></Pressable>
        </View>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 30 }]} keyboardShouldPersistTaps="handled">
          <Text style={styles.trailName}>{trail.name}</Text>
          <Field label="Meetup title" value={title} onChangeText={setTitle} placeholder="Morning trail walk" />
          <Field label="Date" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />
          <Field label="Start time" value={startTime} onChangeText={setStartTime} placeholder="9:00 AM" />
          <Field label="Public meeting point" value={meetingPoint} onChangeText={setMeetingPoint} placeholder="Public trail information sign" />
          <Text style={styles.label}>Pace</Text>
          <View style={styles.paces}>
            {(['relaxed', 'moderate', 'fast'] as const).map((option) => <Pressable key={option} accessibilityRole="button" accessibilityState={{ selected: pace === option }} onPress={() => setPace(option)} style={[styles.pace, pace === option && styles.selectedPace]}><Text style={[styles.paceText, pace === option && styles.selectedPaceText]}>{option}</Text></Pressable>)}
          </View>
          <Field label="Maximum group size" value={maxGroupSize} onChangeText={setMaxGroupSize} placeholder="10" keyboardType="number-pad" />
          <View style={styles.notice}><Ionicons name="shield-checkmark-outline" size={20} color={C.green} /><Text style={styles.noticeText}>Use only a public trail meeting point. Never post a home address, live private location, phone number, or other private information.</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Create public trail meetup" disabled={!canSubmit} onPress={() => void submit()} style={[styles.submit, !canSubmit && styles.disabled]}><Text style={styles.submitText}>Create Meetup</Text></Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// Reuses the same accessible label and styling for every meetup text field.
function Field({ label, ...inputProps }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; keyboardType?: 'default' | 'number-pad' }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} placeholderTextColor="#766B81" style={styles.input} {...inputProps} /></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.background },
  header: { minHeight: 92, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: C.border, paddingHorizontal: 18, paddingBottom: 12 },
  eyebrow: { color: C.magenta, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  title: { color: C.text, fontSize: 23, fontWeight: '900' },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: C.surfaceRaised },
  content: { padding: 20 },
  trailName: { color: C.cyan, fontSize: 15, fontWeight: '900', marginBottom: 18 },
  field: { marginBottom: 15 },
  label: { color: C.textMuted, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 7 },
  input: { minHeight: 48, borderRadius: 13, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, color: C.text, fontSize: 14, paddingHorizontal: 13 },
  paces: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  pace: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: C.border },
  selectedPace: { borderColor: C.cyan, backgroundColor: '#123146' },
  paceText: { color: C.textMuted, fontSize: 11, fontWeight: '800', textTransform: 'capitalize' },
  selectedPaceText: { color: C.text },
  notice: { flexDirection: 'row', gap: 10, borderRadius: 14, borderWidth: 1, borderColor: '#295C47', backgroundColor: '#0D241B', padding: 13, marginTop: 3 },
  noticeText: { flex: 1, color: '#B9EACF', fontSize: 11, lineHeight: 17 },
  submit: { minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 999, backgroundColor: '#73258C', borderWidth: 1, borderColor: C.magenta, marginTop: 20 },
  submitText: { color: C.text, fontSize: 14, fontWeight: '900' },
  disabled: { opacity: 0.4 },
});
