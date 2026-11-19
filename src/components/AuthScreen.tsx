import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '../store/AuthContext';
import { colors } from '../theme';
import { Logo } from './Navigation';

type Mode = 'login' | 'signup';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[a-z0-9._]{3,30}$/;

export function AuthScreen() {
  const { signIn, signUp } = useAuth();

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isSignup = mode === 'signup';

  const validate = (): string | null => {
    if (!EMAIL_PATTERN.test(email.trim())) return 'Enter a valid email address.';
    if (password.length < 6) return 'Password must be at least 6 characters.';
    if (isSignup && !USERNAME_PATTERN.test(username.trim().toLowerCase())) {
      return 'Username: 3-30 characters, letters, numbers, periods or underscores.';
    }
    return null;
  };

  const submit = async () => {
    if (busy) return;
    setNotice(null);
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      if (isSignup) {
        const result = await signUp({ email, password, username, name });
        if (result.error) setError(result.error);
        else if (result.needsConfirmation) {
          setNotice('Account created! Check your email and click the confirmation link, then log in.');
          setMode('login');
          setPassword('');
        }
        // If no confirmation is needed, the auth listener signs us in automatically.
      } else {
        const message = await signIn(email, password);
        if (message) setError(message);
      }
    } finally {
      setBusy(false);
    }
  };

  const switchMode = () => {
    setMode(isSignup ? 'login' : 'signup');
    setError(null);
    setNotice(null);
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.logo}>
            <Logo size={40} />
          </View>
          <Text style={styles.subtitle}>
            {isSignup ? 'Sign up to see photos and videos from your friends.' : 'Log in to continue.'}
          </Text>

          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            style={styles.input}
          />
          {isSignup && (
            <>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Full name"
                placeholderTextColor={colors.textMuted}
                maxLength={40}
                style={styles.input}
              />
              <TextInput
                value={username}
                onChangeText={setUsername}
                placeholder="Username"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={30}
                style={styles.input}
              />
            </>
          )}
          <TextInput
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={submit}
            placeholder="Password"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            autoCapitalize="none"
            textContentType={isSignup ? 'newPassword' : 'password'}
            style={styles.input}
          />

          {error && <Text style={styles.error}>{error}</Text>}
          {notice && <Text style={styles.notice}>{notice}</Text>}

          <Pressable
            onPress={submit}
            disabled={busy}
            accessibilityRole="button"
            style={[styles.submit, busy && styles.submitBusy]}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>{isSignup ? 'Sign up' : 'Log in'}</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.switchCard}>
          <Text style={styles.switchText}>
            {isSignup ? 'Have an account? ' : "Don't have an account? "}
            <Text style={styles.switchLink} onPress={switchMode}>
              {isSignup ? 'Log in' : 'Sign up'}
            </Text>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Shown when the .env file with the Supabase keys is missing. */
export function SetupNotice() {
  return (
    <View style={[styles.root, styles.center]}>
      <View style={styles.card}>
        <View style={styles.logo}>
          <Logo size={40} />
        </View>
        <Text style={styles.setupTitle}>Connect Supabase to continue</Text>
        <Text style={styles.setupText}>1. Create a project at supabase.com.</Text>
        <Text style={styles.setupText}>2. Run supabase/schema.sql in the SQL Editor.</Text>
        <Text style={styles.setupText}>
          3. Copy .env.example to .env and paste your project URL and anon key.
        </Text>
        <Text style={styles.setupText}>4. Restart with: npx expo start -c</Text>
      </View>
    </View>
  );
}

/** Full-screen spinner used while the session or the data is loading. */
export function LoadingScreen() {
  return (
    <View style={[styles.root, styles.center]}>
      <ActivityIndicator size="large" color={colors.text} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 12,
  },
  card: {
    width: '100%',
    maxWidth: 350,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 32,
    paddingVertical: 28,
    gap: 8,
  },
  logo: {
    alignItems: 'center',
    marginBottom: 8,
  },
  subtitle: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 10,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
  },
  error: {
    color: colors.like,
    fontSize: 13,
    textAlign: 'center',
  },
  notice: {
    color: '#1a7f37',
    fontSize: 13,
    textAlign: 'center',
  },
  submit: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 6,
  },
  submitBusy: {
    opacity: 0.7,
  },
  submitText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  switchCard: {
    width: '100%',
    maxWidth: 350,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 18,
    alignItems: 'center',
  },
  switchText: {
    fontSize: 14,
    color: colors.text,
  },
  switchLink: {
    color: colors.primary,
    fontWeight: '700',
  },
  setupTitle: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    color: colors.text,
    marginBottom: 8,
  },
  setupText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
});
