import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

export function LevelUpCelebration({
  fromLevel,
  toLevel,
  onClose,
}: {
  fromLevel: number;
  toLevel: number;
  onClose: () => void;
}) {
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <LinearGradient colors={['#4e126d', '#101b48']} style={styles.card}>
          <Ionicons name="sparkles" size={42} color="#ffd43b" />
          <Text accessibilityRole="header" style={styles.eyebrow}>LEVEL UP</Text>
          <Text selectable style={styles.level}>
            {fromLevel} → {toLevel}
          </Text>
          <Text selectable style={styles.copy}>
            Your verified rewards pushed your explorer level forward.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Continue after leveling up"
            onPress={onClose}
            style={styles.button}
          >
            <Text style={styles.buttonText}>Continue Exploring</Text>
          </Pressable>
        </LinearGradient>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(2,0,8,0.78)', padding: 24 },
  card: { width: '100%', maxWidth: 360, alignItems: 'center', borderRadius: 24, borderWidth: 1, borderColor: '#ff2df7', padding: 26, gap: 12 },
  eyebrow: { color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 2 },
  level: { color: '#68e7ff', fontSize: 38, fontWeight: '900', fontVariant: ['tabular-nums'] },
  copy: { color: '#e7ddec', textAlign: 'center', fontSize: 13, lineHeight: 19 },
  button: { minHeight: 46, marginTop: 6, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#ff2df7', paddingHorizontal: 20 },
  buttonText: { color: '#fff', fontSize: 13, fontWeight: '900' },
});
