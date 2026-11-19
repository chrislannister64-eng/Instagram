import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useApp } from '../store/AppContext';
import { colors, layout } from '../theme';
import { PhotoGrid, PostViewer } from './PhotoGrid';

export function Explore() {
  const { state, getUser } = useApp();
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const posts = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^[#@]/, '');
    const sorted = [...state.posts].sort((a, b) => b.likes - a.likes);
    if (!q) return sorted;
    return sorted.filter(
      (p) =>
        p.caption.toLowerCase().includes(q) || getUser(p.userId).username.toLowerCase().includes(q),
    );
  }, [state.posts, query, getUser]);

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <View style={styles.container}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search captions, #tags or users"
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {posts.length === 0 ? (
          <Text style={styles.empty}>No results for “{query.trim()}”.</Text>
        ) : (
          <PhotoGrid posts={posts} onSelect={(post) => setSelectedId(post.id)} />
        )}
      </View>

      <PostViewer postId={selectedId} onClose={() => setSelectedId(null)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  container: {
    width: '100%',
    maxWidth: layout.profileMaxWidth,
    padding: 12,
    gap: 14,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#efefef',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
  },
  empty: {
    textAlign: 'center',
    color: colors.textMuted,
    paddingVertical: 40,
    fontSize: 15,
  },
});
