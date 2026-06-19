// context/auth.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { useRouter, useSegments } from 'expo-router';

// Reaching across to your lib folder
import { supabase } from '../lib/supabase';

const AuthContext = createContext<{ session: Session | null; loading: boolean }>({
  session: null,
  loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // 1. Check for an active session on boot
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // 2. Keep a live ear out for login/logout events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // 3. Keep guard over the app screens
  useEffect(() => {
    if (loading) return;

    // Check if the user is currently looking at an authentication screen
    const inAuthGroup = segments[0] === 'login' || segments[0] === 'Signup' || segments[0] === 'welcome_mat';

    if (!session && !inAuthGroup) {
      // If they have no key card, bounce them to the login screen
      router.replace('/login');
    } else if (session && inAuthGroup) {
      // If they are logged in, send them straight to home-backup
      router.replace('/home-backup'); 
    }
  }, [session, loading, segments]);

  return (
    <AuthContext.Provider value={{ session, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);