import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { createClient } from '@supabase/supabase-js';

// ======================================================
// SUPABASE PROJECT URL
// ======================================================

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL;
// ======================================================
// SUPABASE PUBLIC ANON KEY
// ======================================================

const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// ======================================================
// CREATE SUPABASE CLIENT
// ======================================================
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {

    auth: {

      // ======================================================
      // FIX FOR EXPO WEB + MOBILE
      // ======================================================

      storage:
        typeof window !== 'undefined'
          ? AsyncStorage
          : undefined,

      // ======================================================
      // AUTO REFRESH LOGIN TOKEN
      // ======================================================

      autoRefreshToken: true,

      // ======================================================
      // SAVE LOGIN SESSION
      // ======================================================

      persistSession: true,

      // ======================================================
      // REQUIRED FOR EXPO
      // ======================================================

      detectSessionInUrl: false,
    },
  }
);