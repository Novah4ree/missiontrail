import { Stack } from 'expo-router';
import { AuthProvider } from '../../context/auth';
import { ActivityProgressProvider } from '@/providers/activity-progress-provider';
import { LocationProvider } from '@/providers/location-provider';

// Important note: Sets up the shared layout used by the app screens.
export default function Layout() {
  return (
    <AuthProvider>
      <LocationProvider>
        <ActivityProgressProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="trail-details" options={{ presentation: 'card' }} />
          </Stack>
        </ActivityProgressProvider>
      </LocationProvider>
    </AuthProvider>
  );
}
