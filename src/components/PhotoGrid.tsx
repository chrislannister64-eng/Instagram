import React, { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useApp } from '../store/AppContext';
import { colors } from '../theme';
import { Post } from '../types';
import { PostCard } from './PostCard';

/* -------------------------------- Photo grid ------------------------------ */

interface PhotoGridProps {
  posts: Post[];
  gap?: number;
  onSelect: (post: Post) => void;
}

/** 3-column square grid used by Explore and Profile. */
export function PhotoGrid({ posts, gap = 3, onSelect }: PhotoGridProps) {
  const [width, setWidth] = useState(0);
  const size = width > 0 ? Math.floor((width - gap * 2) / 3) : 0;

  return (
    <View
      style={[styles.grid, { gap }]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {size > 0 &&
        posts.map((post) => (
          <GridTile key={post.id} post={post} size={size} onPress={() => onSelect(post)} />
        ))}
    </View>
  );
}

function GridTile({ post, size, onPress }: { post: Post; size: number; onPress: () => void }) {
  const { getUser } = useApp();
  const [hovered, setHovered] = useState(false);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open post by ${getUser(post.userId).username}`}
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={{ width: size, height: size, backgroundColor: colors.surface }}
    >
      <Image source={{ uri: post.image }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      {hovered && (
        <View style={styles.hover}>
          <View style={styles.stat}>
            <Ionicons name="heart" size={20} color="#fff" />
            <Text style={styles.statText}>{post.likes.toLocaleString('en-US')}</Text>
          </View>
          <View style={styles.stat}>
            <Ionicons name="chatbubble" size={18} color="#fff" />
            <Text style={styles.statText}>{post.comments.length}</Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}

/* ------------------------------- Post viewer ------------------------------ */

interface PostViewerProps {
  postId: string | null;
  onClose: () => void;
}

/** Modal that shows a full PostCard (likes / comments stay live from the store). */
export function PostViewer({ postId, onClose }: PostViewerProps) {
  const { state } = useApp();
  const post = postId ? state.posts.find((p) => p.id === postId) : undefined;

  return (
    <Modal visible={!!post} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        {post && (
          <View style={styles.viewerCard}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <PostCard post={post} />
            </ScrollView>
            <Pressable
              style={styles.closeButton}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close post"
            >
              <Ionicons name="close" size={22} color="#fff" />
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  grid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  hover: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },

  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  viewerCard: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '92%',
    backgroundColor: colors.background,
    borderRadius: 8,
    overflow: 'hidden',
  },
  closeButton: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
