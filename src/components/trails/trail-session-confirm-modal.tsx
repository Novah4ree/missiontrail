import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { MissionTrailColors as C } from '@/constants/theme';

export function TrailSessionConfirmModal({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  busy = false,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      animationType="fade"
      onRequestClose={onCancel}
      presentationStyle="overFullScreen"
      transparent
      visible={visible}
    >
      <View style={styles.backdrop}>
        <View accessibilityRole="alert" style={styles.card}>
          <View style={styles.icon}><Ionicons name="trail-sign" size={24} color={C.cyan} /></View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={onCancel}
              style={({ pressed }) => [styles.button, styles.keepButton, pressed && styles.pressed]}
            >
              <Text style={styles.keepText}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={onConfirm}
              style={({ pressed }) => [styles.button, styles.destructiveButton, busy && styles.disabled, pressed && styles.pressed]}
            >
              {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.destructiveText}>{confirmLabel}</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(3, 0, 12, 0.82)', padding: 24 },
  card: { borderRadius: 22, borderWidth: 1, borderColor: C.cyan, backgroundColor: '#130B20', padding: 22, shadowColor: C.cyan, shadowOpacity: 0.28, shadowRadius: 20, elevation: 12 },
  icon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.cyan, backgroundColor: 'rgba(0, 229, 255, 0.1)' },
  title: { color: C.text, fontSize: 20, fontWeight: '900', marginTop: 16 },
  message: { color: C.textMuted, fontSize: 13, lineHeight: 20, marginTop: 9 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 22 },
  button: { flex: 1, minHeight: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  keepButton: { borderWidth: 1, borderColor: C.border, backgroundColor: C.surface },
  destructiveButton: { borderWidth: 1, borderColor: '#FF477E', backgroundColor: '#8F1743' },
  keepText: { color: C.text, fontSize: 12, fontWeight: '900' },
  destructiveText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  pressed: { opacity: 0.76 },
  disabled: { opacity: 0.55 },
});
