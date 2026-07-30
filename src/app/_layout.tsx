import { Stack } from 'expo-router';
import { AuthProvider } from '../../context/auth';
import { ActivityProgressProvider } from '@/providers/activity-progress-provider';

export default function Layout() {
  return (
    <AuthProvider>
      <ActivityProgressProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="trail-details" options={{ presentation: 'card' }} />
        </Stack>
      </ActivityProgressProvider>
    </AuthProvider>
  );
}
