import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { Activity } from './src/components/Activity';
import { AuthScreen, LoadingScreen, SetupNotice } from './src/components/AuthScreen';
import { CreatePostModal } from './src/components/CreatePostModal';
import { Explore } from './src/components/Explore';
import { Feed } from './src/components/Feed';
import { Messages } from './src/components/Messages';
import { BottomTabs, MobileHeader, Sidebar } from './src/components/Navigation';
import { Profile } from './src/components/Profile';
import { Toast } from './src/components/Toast';
import { useBreakpoint } from './src/hooks/useBreakpoint';
import { isSupabaseConfigured } from './src/lib/supabase';
import { AppProvider, useApp } from './src/store/AppContext';
import { AuthProvider, useAuth } from './src/store/AuthContext';
import { colors } from './src/theme';
import { TabKey } from './src/types';

function Shell() {
  const { isMobile, isTablet } = useBreakpoint();
  const { loading } = useApp();

  const [tab, setTab] = useState<TabKey>('home');
  const [creating, setCreating] = useState(false);

  const handleSelect = useCallback((key: TabKey) => {
    // "Create" opens a modal and does not change the visible screen.
    if (key === 'create') {
      setCreating(true);
      return;
    }
    setTab(key);
  }, []);

  const handleMessages = useCallback(() => setTab('messages'), []);

  if (loading) return <LoadingScreen />;

  const screen = (() => {
    switch (tab) {
      case 'home':
        return <Feed onCreate={() => setCreating(true)} />;
      case 'explore':
        return <Explore />;
      case 'activity':
        return <Activity />;
      case 'profile':
        return <Profile />;
      case 'messages':
        return <Messages />;
      default:
        return null;
    }
  })();

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.body}>
        {!isMobile && (
          <Sidebar
            active={tab}
            compact={isTablet}
            onSelect={handleSelect}
            onMessages={handleMessages}
          />
        )}

        <View style={styles.content}>
          {isMobile && tab !== 'messages' && (
            <MobileHeader onActivity={() => setTab('activity')} onMessages={handleMessages} />
          )}
          <View style={styles.screen}>{screen}</View>
          {isMobile && <BottomTabs active={tab} onSelect={handleSelect} />}
        </View>
      </View>

      <CreatePostModal
        visible={creating}
        onClose={() => setCreating(false)}
        onPublished={() => {
          setCreating(false);
          setTab('home');
        }}
      />
      <Toast />
    </SafeAreaView>
  );
}

/**
 * Decides what to show:
 *   no .env keys      -> setup instructions
 *   checking session  -> spinner
 *   signed out        -> login / sign-up
 *   signed in         -> the app (data store is created per user, so signing out wipes it)
 */
function Gate() {
  const { session, loading } = useAuth();

  if (!isSupabaseConfigured) return <SetupNotice />;
  if (loading) return <LoadingScreen />;
  if (!session) return <AuthScreen />;

  return (
    <AppProvider key={session.user.id} userId={session.user.id}>
      <Shell />
    </AppProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <Gate />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
  },
  content: {
    flex: 1,
  },
  screen: {
    flex: 1,
  },
});
