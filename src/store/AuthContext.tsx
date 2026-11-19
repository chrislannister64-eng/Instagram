import { Session } from '@supabase/supabase-js';
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Platform } from 'react-native';

import { errorMessage, supabase } from '../lib/supabase';

export interface SignUpInput {
  email: string;
  password: string;
  username: string;
  name: string;
}

interface AuthContextValue {
  session: Session | null;
  /** True only while we check whether a saved session exists on startup. */
  loading: boolean;
  /** Returns an error message, or null on success. */
  signIn: (email: string, password: string) => Promise<string | null>;
  /** needsConfirmation is true when the project requires clicking an email link before signing in. */
  signUp: (input: SignUpInput) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    // Fires on sign in, sign out and token refresh.
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return error ? errorMessage(error) : null;
  }, []);

  const signUp = useCallback(async ({ email, password, username, name }: SignUpInput) => {
    const cleanUsername = username.trim().toLowerCase();

    // Friendly pre-check so the user gets a clear message instead of a database error.
    const { data: existing, error: lookupError } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', cleanUsername)
      .maybeSingle();
    if (lookupError) return { error: errorMessage(lookupError), needsConfirmation: false };
    if (existing) return { error: 'That username is already taken.', needsConfirmation: false };

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        // Read by the handle_new_user() trigger in supabase/schema.sql to create the profile.
        data: { username: cleanUsername, name: name.trim() },
        emailRedirectTo:
          Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : undefined,
      },
    });
    if (error) return { error: errorMessage(error), needsConfirmation: false };

    // No session returned = the project has "Confirm email" turned on.
    return { error: null, needsConfirmation: data.session === null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo(
    () => ({ session, loading, signIn, signUp, signOut }),
    [session, loading, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
