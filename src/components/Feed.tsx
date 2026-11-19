import React, { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { useBreakpoint } from '../hooks/useBreakpoint';
import { useApp } from '../store/AppContext';
import { colors, layout } from '../theme';
import { Avatar } from './Avatar';
import { PostCard } from './PostCard';
import { Stories } from './Stories';

interface FeedProps {
  onCreate: () => void;
}

export function Feed({ onCreate }: FeedProps) {
  const { state, refresh, refreshing } = useApp();
  const { width } = useBreakpoint();

  const posts = useMemo(
    () => [...state.posts].sort((a, b) => b.createdAt - a.createdAt),
    [state.posts],
  );

  return (
    <View style={styles.root}>
      <View style={styles.row}>
        <FlatList
          style={styles.list}
          data={posts}
          keyExtractor={(post) => post.id}
          renderItem={({ item }) => <PostCard post={item} />}
          ListHeaderComponent={<Stories onCreate={onCreate} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No posts yet</Text>
              <Text style={styles.emptyText}>Tap Create to share your first photo.</Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={refresh}
          initialNumToRender={3}
          windowSize={7}
        />
        {width >= layout.suggestionsBreakpoint && <Suggestions />}
      </View>
    </View>
  );
}

/* ------------------------------- Suggestions ------------------------------ */

function Suggestions() {
  const { state, currentUser, toggleFollow } = useApp();

  const suggested = useMemo(
    () =>
      Object.values(state.users)
        .filter(
          (u) => u.id !== currentUser.id && !u.followedByMe && !state.blocked.includes(u.id),
        )
        .slice(0, 5),
    [state.users, state.blocked, currentUser.id],
  );

  return (
    <View style={styles.suggestions}>
      <View style={styles.suggestionRow}>
        <Avatar uri={currentUser.avatar} size={44} />
        <View style={styles.suggestionText}>
          <Text style={styles.suggestionName}>{currentUser.username}</Text>
          <Text style={styles.suggestionSub}>{currentUser.name}</Text>
        </View>
      </View>

      <Text style={styles.suggestionsTitle}>Suggested for you</Text>

      {suggested.length === 0 && <Text style={styles.suggestionSub}>You're all caught up.</Text>}

      {suggested.map((user) => (
        <View key={user.id} style={styles.suggestionRow}>
          <Avatar uri={user.avatar} size={36} />
          <View style={styles.suggestionText}>
            <Text style={styles.suggestionName}>{user.username}</Text>
            <Text style={styles.suggestionSub} numberOfLines={1}>
              {user.name}
            </Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => toggleFollow(user.id)}>
            <Text style={styles.follow}>Follow</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  list: {
    flex: 1,
    maxWidth: layout.feedMaxWidth,
  },
  empty: {
    padding: 40,
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
  },

  suggestions: {
    width: 319,
    marginLeft: 64,
    paddingTop: 36,
    gap: 14,
  },
  suggestionsTitle: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '700',
    color: colors.textMuted,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  suggestionText: {
    flex: 1,
  },
  suggestionName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  suggestionSub: {
    fontSize: 13,
    color: colors.textMuted,
  },
  follow: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
});
