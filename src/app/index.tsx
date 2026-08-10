import { Redirect } from 'expo-router';

// Important note: Chooses the first screen to show when the app opens.
export default function Index() {
  return <Redirect href="/splash" />;
}