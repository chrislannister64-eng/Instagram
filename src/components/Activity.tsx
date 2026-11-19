import React from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useApp } from '../store/AppContext';
import { colors, layout } from '../theme';
import { AppNotification } from '../types';
import { timeAgo } from '../utils/time';
import { Avatar } from './Avatar';

export function Activity() {
  const { state } = useApp();
  const items = [...state.notifications].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <View style={styles.container}>
        <Text style={styles.title}>Notifications</Text>
        {items.map((n) => (
          <Row key={n.id} item={n} />
        ))}
      </View>
    </ScrollView>
  );
}

function Row({ item }: { item: AppNotification }) {
  const { state, getUser } = useApp();
  const user = getUser(item.userId);
  const post = item.postId ? state.posts.find((p) => p.id === item.postId) : undefined;

  const action =
    item.type === 'like'
      ? 'liked your photo.'
      : item.type === 'comment'
        ? `commented: ${item.text ?? ''}`
        : 'started following you.';

  return (
    <View style={styles.row}>
      <Avatar uri={user.avatar} size={44} />
      <Text style={styles.text}>
        <Text style={styles.bold}>{user.username} </Text>
        {action} <Text style={styles.time}>{timeAgo(item.createdAt)}</Text>
      </Text>
      {post && <Image source={{ uri: post.image }} style={styles.thumb} />}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  container: {
    width: '100%',
    maxWidth: layout.feedMaxWidth + 80,
    paddingVertical: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  text: {
    flex: 1,
    fontSize: 14,
    lineHeight: 19,
    color: colors.text,
  },
  bold: {
    fontWeight: '700',
  },
  time: {
    color: colors.textMuted,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 4,
    backgroundColor: colors.surface,
  },
});
