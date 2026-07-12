import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { createClient } from '@supabase/supabase-js';

// ======================================================
// SUPABASE PROJECT URL
// ======================================================

const supabaseUrl =
  'https://vcthpbebwzfstaverlvz.supabase.co';

// ======================================================
// SUPABASE PUBLIC ANON KEY
// ======================================================

const supabaseAnonKey =
  'sb_publishable_FUl3SA3Dely5yOfpQlFK6g_KEfRCjeF';

// ======================================================
// CREATE SUPABASE CLIENT
// ======================================================

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