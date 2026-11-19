import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useApp } from '../store/AppContext';
import { colors } from '../theme';
import { User } from '../types';
import { Avatar } from './Avatar';

const STORY_DURATION_MS = 5000;

interface StoriesProps {
  /** Called when the user taps "Your story". */
  onCreate: () => void;
}

export function Stories({ onCreate }: StoriesProps) {
  const { state, currentUser, markStorySeen } = useApp();
  const [activeUserId, setActiveUserId] = useState<string | null>(null);

  const storyUsers = useMemo(() => {
    const users = Object.values(state.users).filter((u) => u.hasStory && u.id !== currentUser.id);
    // Unseen stories first, like the real app.
    return [...users].sort(
      (a, b) =>
        Number(state.seenStories.includes(a.id)) - Number(state.seenStories.includes(b.id)),
    );
  }, [state.users, state.seenStories, currentUser.id]);

  const openStory = (user: User) => {
    markStorySeen(user.id);
    setActiveUserId(user.id);
  };

  const closeStory = useCallback(() => setActiveUserId(null), []);

  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add to your story"
          onPress={onCreate}
          style={styles.item}
        >
          <View>
            <Avatar uri={currentUser.avatar} size={56} ring="seen" />
            <View style={styles.plusBadge}>
              <Ionicons name="add" size={14} color="#fff" />
            </View>
          </View>
          <Text style={styles.name} numberOfLines={1}>
            Your story
          </Text>
        </Pressable>

        {storyUsers.map((user) => (
          <Pressable
            key={user.id}
            accessibilityRole="button"
            accessibilityLabel={`View ${user.username}'s story`}
            onPress={() => openStory(user)}
            style={styles.item}
          >
            <Avatar
              uri={user.avatar}
              size={56}
              ring={state.seenStories.includes(user.id) ? 'seen' : 'unseen'}
            />
            <Text style={styles.name} numberOfLines={1}>
              {user.username}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <StoryViewer
        user={activeUserId ? state.users[activeUserId] ?? null : null}
        onClose={closeStory}
      />
    </View>
  );
}

/* ------------------------------ Story viewer ------------------------------ */

function StoryViewer({ user, onClose }: { user: User | null; onClose: () => void }) {
  const { state } = useApp();
  // Show this person's most recent story.
  const storyImage = user
    ? [...state.stories].filter((s) => s.userId === user.id).pop()?.imageUrl
    : undefined;
  const progress = useRef(new Animated.Value(0)).current;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: STORY_DURATION_MS,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    animation.start(({ finished }) => {
      if (finished) closeRef.current();
    });
    return () => animation.stop();
  }, [userId, progress]);

  return (
    <Modal visible={!!user} animationType="fade" onRequestClose={onClose}>
      {user && (
        <Pressable style={styles.viewer} onPress={onClose} accessibilityLabel="Close story">
          <View style={styles.viewerFrame}>
            <Image
              source={{ uri: storyImage ?? user.avatar }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
            <View style={styles.viewerTop}>
              <View style={styles.progressTrack}>
                <Animated.View
                  style={[
                    styles.progressFill,
                    {
                      width: progress.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                      }),
                    },
                  ]}
                />
              </View>
              <View style={styles.viewerUser}>
                <Avatar uri={user.avatar} size={32} />
                <Text style={styles.viewerName}>{user.username}</Text>
                <View style={styles.flex} />
                <Ionicons name="close" size={28} color="#fff" />
              </View>
            </View>
          </View>
        </Pressable>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 14,
  },
  item: {
    width: 72,
    alignItems: 'center',
    gap: 6,
  },
  name: {
    fontSize: 12,
    color: colors.text,
    maxWidth: 72,
  },
  plusBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },

  viewer: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerFrame: {
    width: '100%',
    maxWidth: 420,
    height: '100%',
    maxHeight: 750,
    backgroundColor: '#111',
    overflow: 'hidden',
  },
  viewerTop: {
    padding: 12,
    gap: 12,
  },
  progressTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.35)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fff',
  },
  viewerUser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  viewerName: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  flex: {
    flex: 1,
  },
});
