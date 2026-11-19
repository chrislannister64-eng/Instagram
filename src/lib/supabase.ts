import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** False until the developer creates a .env file (see .env.example). The app shows a setup screen instead of crashing. */
export const isSupabaseConfigured = url.length > 0 && anonKey.length > 0;

export const supabase = createClient(
  isSupabaseConfigured ? url : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? anonKey : 'placeholder-anon-key',
  {
    auth: {
      // Keeps the user signed in across reloads (localStorage on web, AsyncStorage on phones).
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      // Needed on the web so the link in a confirmation email can sign the user in.
      detectSessionInUrl: Platform.OS === 'web',
    },
  },
);

// On phones, stop refreshing tokens while the app is in the background.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

/** Turns any thrown value into a message that is safe to show to the user. */
export function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = String((error as { message: unknown }).message);
    if (message) return message;
  }
  return 'Something went wrong. Please try again.';
}
