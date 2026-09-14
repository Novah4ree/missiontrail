import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { Pressable, Text } from 'react-native';

import { AuthProvider } from '../../context/auth';
import { ActivityProgressProvider } from '@/providers/activity-progress-provider';

// Purpose: Renders the layout interface.
export default function Layout() {
  const router = useRouter();

  return (
    <AuthProvider>
      <ActivityProgressProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="trail-details" options={{ presentation: 'card' }} />
          <Stack.Screen
            name="profile"
            options={{
              headerShown: true,
              headerTitle: '',
              headerStyle: { backgroundColor: '#060611' },
              headerShadowVisible: false,
              headerTintColor: '#F8F7FF',
              headerRight: () => (
                <Pressable
                  onPress={() => router.push('/privacy-center')}
                  accessibilityRole="button"
                  accessibilityLabel="Privacy and Account"
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 6 }}
                >
                  <Ionicons name="shield-checkmark-outline" size={20} color="#22D3EE" />
                  <Text style={{ color: '#F8F7FF', fontSize: 14, fontWeight: '800' }}>Privacy</Text>
                </Pressable>
              ),
            }}
          />
          <Stack.Screen name="privacy-center" options={{ presentation: 'card' }} />
          <Stack.Screen name="privacy-policy" options={{ presentation: 'card' }} />
          <Stack.Screen name="terms" options={{ presentation: 'card' }} />
          <Stack.Screen name="support" options={{ presentation: 'card' }} />
          <Stack.Screen name="account-deletion" options={{ presentation: 'card' }} />
        </Stack>
      </ActivityProgressProvider>
    </AuthProvider>
  );
}
