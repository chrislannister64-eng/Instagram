import React, { memo, useCallback, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useApp } from '../store/AppContext';
import { colors } from '../theme';
import { Post } from '../types';
import { timeAgoLong } from '../utils/time';
import { Avatar } from './Avatar';

const DOUBLE_TAP_MS = 300;
const USE_NATIVE_DRIVER = Platform.OS !== 'web';

/** Renders text with #hashtags and @mentions highlighted. */
function RichText({ text }: { text: string }) {
  const parts = text.split(/(#\w+|@[\w.]+)/g);
  return (
    <Text>
      {parts.map((part, i) =>
        part.startsWith('#') || part.startsWith('@') ? (
          <Text key={i} style={styles.tag}>
            {part}
          </Text>
        ) : (
          part
        ),
      )}
    </Text>
  );
}

interface PostCardProps {
  post: Post;
}

function PostCardBase({ post }: PostCardProps) {
  const { state, currentUser, getUser, toggleLike, toggleSave, addComment, deletePost, blockUser, showToast } =
    useApp();
  const author = getUser(post.userId);
  const isOwn = author.id === currentUser.id;

  const [showAllComments, setShowAllComments] = useState(false);
  const [draft, setDraft] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const inputRef = useRef<React.ComponentRef<typeof TextInput>>(null);

  /* Double-tap to like */
  const lastTap = useRef(0);
  const heartScale = useRef(new Animated.Value(0)).current;
  const heartOpacity = useRef(new Animated.Value(0)).current;

  const playHeart = useCallback(() => {
    heartScale.setValue(0.3);
    heartOpacity.setValue(1);
    Animated.sequence([
      Animated.spring(heartScale, { toValue: 1, friction: 4, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.delay(350),
      Animated.timing(heartOpacity, { toValue: 0, duration: 250, useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start();
  }, [heartScale, heartOpacity]);

  const handleImagePress = () => {
    const now = Date.now();
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      lastTap.current = 0;
      if (!post.likedByMe) toggleLike(post.id);
      playHeart();
    } else {
      lastTap.current = now;
    }
  };

  const handleSubmitComment = () => {
    const text = draft.trim();
    if (!text) return;
    addComment(post.id, text);
    setDraft('');
    setShowAllComments(true);
  };

  const handleShare = () => {
    if (
      Platform.OS === 'web' &&
      typeof navigator !== 'undefined' &&
      navigator.clipboard &&
      typeof window !== 'undefined'
    ) {
      navigator.clipboard
        .writeText(`${window.location.origin}/p/${post.id}`)
        .then(
          () => showToast('Link copied to clipboard'),
          () => showToast('Could not copy the link'),
        );
    } else {
      showToast('Sharing is not available in this demo');
    }
  };

  const ring = author.hasStory && !isOwn
    ? state.seenStories.includes(author.id)
      ? 'seen'
      : 'unseen'
    : 'none';

  const visibleComments = showAllComments ? post.comments : post.comments.slice(-2);
  const hiddenCount = post.comments.length - visibleComments.length;

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <Avatar uri={author.avatar} size={32} ring={ring} />
        <View style={styles.headerText}>
          <Text style={styles.username} numberOfLines={1}>
            {author.username}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="More options"
          onPress={() => setMenuOpen((open) => !open)}
          hitSlop={10}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.text} />
        </Pressable>

        {menuOpen && (
          <View style={styles.menu}>
            {isOwn && (
              <Pressable
                style={styles.menuItem}
                onPress={() => {
                  setMenuOpen(false);
                  deletePost(post.id);
                  showToast('Post deleted');
                }}
              >
                <Text style={[styles.menuText, styles.menuDanger]}>Delete</Text>
              </Pressable>
            )}
            <Pressable
              style={styles.menuItem}
              onPress={() => {
                setMenuOpen(false);
                handleShare();
              }}
            >
              <Text style={styles.menuText}>Copy link</Text>
            </Pressable>
            {!isOwn && (
              <Pressable
                style={styles.menuItem}
                onPress={() => {
                  setMenuOpen(false);
                  setConfirmBlock(true);
                }}
              >
                <Text style={[styles.menuText, styles.menuDanger]}>Block</Text>
              </Pressable>
            )}
            <Pressable style={styles.menuItem} onPress={() => setMenuOpen(false)}>
              <Text style={styles.menuText}>Cancel</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Block confirmation (an inline bar works on web, where Alert does not) */}
      {confirmBlock && (
        <View style={styles.confirmBar}>
          <Text style={styles.confirmText}>
            Block {author.username}? They won't be able to see your posts or message you.
          </Text>
          <View style={styles.confirmActions}>
            <Pressable onPress={() => setConfirmBlock(false)} accessibilityRole="button">
              <Text style={styles.confirmCancel}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setConfirmBlock(false);
                void blockUser(author.id);
              }}
              accessibilityRole="button"
            >
              <Text style={styles.confirmBlock}>Block</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Media (double-tap to like) */}
      <Pressable onPress={handleImagePress} accessibilityLabel="Post photo. Double tap to like.">
        <Image
          source={{ uri: post.image }}
          style={[styles.image, { aspectRatio: post.aspectRatio }]}
          resizeMode="cover"
        />
        <Animated.View
          pointerEvents="none"
          style={[styles.bigHeart, { opacity: heartOpacity, transform: [{ scale: heartScale }] }]}
        >
          <Ionicons name="heart" size={96} color="#fff" />
        </Animated.View>
      </Pressable>

      {/* Action bar */}
      <View style={styles.actions}>
        <View style={styles.actionsLeft}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={post.likedByMe ? 'Unlike' : 'Like'}
            onPress={() => toggleLike(post.id)}
            hitSlop={6}
          >
            <Ionicons
              name={post.likedByMe ? 'heart' : 'heart-outline'}
              size={27}
              color={post.likedByMe ? colors.like : colors.text}
            />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Comment"
            onPress={() => inputRef.current?.focus()}
            hitSlop={6}
          >
            <Ionicons name="chatbubble-outline" size={25} color={colors.text} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Share" onPress={handleShare} hitSlop={6}>
            <Ionicons name="paper-plane-outline" size={25} color={colors.text} />
          </Pressable>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={post.saved ? 'Remove from saved' : 'Save'}
          onPress={() => toggleSave(post.id)}
          hitSlop={6}
        >
          <Ionicons
            name={post.saved ? 'bookmark' : 'bookmark-outline'}
            size={26}
            color={colors.text}
          />
        </Pressable>
      </View>

      {/* Body */}
      <View style={styles.body}>
        <Text style={styles.likes}>
          {post.likes.toLocaleString('en-US')} {post.likes === 1 ? 'like' : 'likes'}
        </Text>

        {post.caption.length > 0 && (
          <Text style={styles.text}>
            <Text style={styles.bold}>{author.username} </Text>
            <RichText text={post.caption} />
          </Text>
        )}

        {hiddenCount > 0 && (
          <Pressable onPress={() => setShowAllComments(true)}>
            <Text style={styles.muted}>
              View all {post.comments.length} comments
            </Text>
          </Pressable>
        )}

        {visibleComments.map((c) => (
          <Text key={c.id} style={styles.text}>
            <Text style={styles.bold}>{getUser(c.userId).username} </Text>
            <RichText text={c.text} />
          </Text>
        ))}

        {showAllComments && post.comments.length > 2 && (
          <Pressable onPress={() => setShowAllComments(false)}>
            <Text style={styles.muted}>Hide comments</Text>
          </Pressable>
        )}

        <Text style={styles.time}>{timeAgoLong(post.createdAt).toUpperCase()}</Text>
      </View>

      {/* Add comment */}
      <View style={styles.commentRow}>
        <TextInput
          ref={inputRef}
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={handleSubmitComment}
          placeholder="Add a comment…"
          placeholderTextColor={colors.textMuted}
          returnKeyType="send"
          style={styles.commentInput}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Post comment"
          onPress={handleSubmitComment}
          disabled={draft.trim().length === 0}
        >
          <Text style={[styles.postButton, draft.trim().length === 0 && styles.postButtonDisabled]}>
            Post
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export const PostCard = memo(PostCardBase);

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    marginBottom: 12,
    zIndex: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    zIndex: 5,
  },
  headerText: {
    flex: 1,
  },
  username: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  menu: {
    position: 'absolute',
    top: 44,
    right: 8,
    minWidth: 150,
    backgroundColor: colors.background,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingVertical: 4,
    zIndex: 20,
    elevation: 6,
  },
  menuItem: {
    paddingVertical: 11,
    paddingHorizontal: 16,
  },
  menuText: {
    fontSize: 14,
    color: colors.text,
  },
  menuDanger: {
    color: colors.like,
    fontWeight: '700',
  },
  confirmBar: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: 8,
  },
  confirmText: {
    fontSize: 14,
    color: colors.text,
  },
  confirmActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 24,
  },
  confirmCancel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  confirmBlock: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.like,
  },
  image: {
    width: '100%',
    backgroundColor: colors.surface,
  },
  bigHeart: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  actionsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  body: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
    gap: 4,
  },
  likes: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  text: {
    fontSize: 14,
    lineHeight: 19,
    color: colors.text,
  },
  bold: {
    fontWeight: '700',
  },
  tag: {
    color: colors.link,
  },
  muted: {
    fontSize: 14,
    color: colors.textMuted,
  },
  time: {
    marginTop: 2,
    fontSize: 10,
    letterSpacing: 0.3,
    color: colors.textMuted,
  },
  commentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: 8,
  },
  commentInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    paddingVertical: 4,
  },
  postButton: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  postButtonDisabled: {
    opacity: 0.4,
  },
});
