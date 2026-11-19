import { AppState } from 'react-native';
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';

import {
  mapMessage,
  mapNotification,
  mapPost,
  mapProfile,
  mapStory,
  MessageRow,
  NotificationRow,
  placeholderAvatar,
  PostRow,
  ProfileRow,
  StoryRow,
} from '../lib/mappers';
import { isLocalUri, uploadImage } from '../lib/storage';
import { errorMessage, supabase } from '../lib/supabase';
import { AppNotification, Comment, Conversation, Message, Post, Story, User } from '../types';

/** The fields a user can change from the Edit Profile screen. */
export type ProfileChanges = Partial<Pick<User, 'name' | 'username' | 'bio' | 'avatar'>>;

/* ---------------------------------- State --------------------------------- */

interface State {
  users: Record<string, User>;
  posts: Post[];
  notifications: AppNotification[];
  stories: Story[];
  conversations: Conversation[];
  /** Ids of the people YOU have blocked. */
  blocked: string[];
  /** User ids whose story you've opened (kept for this session only). */
  seenStories: string[];
}

const emptyState: State = {
  users: {},
  posts: [],
  notifications: [],
  stories: [],
  conversations: [],
  blocked: [],
  seenStories: [],
};

type Action =
  | { type: 'LOAD'; payload: Omit<State, 'seenStories'> }
  | { type: 'TOGGLE_LIKE'; postId: string }
  | { type: 'TOGGLE_SAVE'; postId: string }
  | { type: 'ADD_COMMENT'; postId: string; comment: Comment }
  | { type: 'ADD_POST'; post: Post }
  | { type: 'DELETE_POST'; postId: string }
  | { type: 'ADD_STORY'; story: Story }
  | { type: 'SEEN_STORY'; userId: string }
  | { type: 'UPSERT_USER'; user: User }
  | { type: 'UPDATE_PROFILE'; userId: string; changes: ProfileChanges }
  | { type: 'TOGGLE_FOLLOW'; userId: string; meId: string }
  | { type: 'ADD_MESSAGE'; otherId: string; message: Message; unread: boolean }
  | { type: 'MARK_READ'; userId: string }
  | { type: 'ADD_NOTIFICATION'; notification: AppNotification }
  | { type: 'BLOCK'; userId: string }
  | { type: 'UNBLOCK'; userId: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'LOAD':
      return { ...state, ...action.payload };

    case 'TOGGLE_LIKE':
      return {
        ...state,
        posts: state.posts.map((p) =>
          p.id === action.postId
            ? { ...p, likedByMe: !p.likedByMe, likes: p.likes + (p.likedByMe ? -1 : 1) }
            : p,
        ),
      };

    case 'TOGGLE_SAVE':
      return {
        ...state,
        posts: state.posts.map((p) => (p.id === action.postId ? { ...p, saved: !p.saved } : p)),
      };

    case 'ADD_COMMENT':
      return {
        ...state,
        posts: state.posts.map((p) =>
          p.id === action.postId ? { ...p, comments: [...p.comments, action.comment] } : p,
        ),
      };

    case 'ADD_POST':
      return { ...state, posts: [action.post, ...state.posts] };

    case 'DELETE_POST':
      return { ...state, posts: state.posts.filter((p) => p.id !== action.postId) };

    case 'ADD_STORY': {
      const owner = state.users[action.story.userId];
      return {
        ...state,
        stories: [...state.stories, action.story],
        users: owner ? { ...state.users, [owner.id]: { ...owner, hasStory: true } } : state.users,
      };
    }

    case 'SEEN_STORY':
      if (state.seenStories.includes(action.userId)) return state;
      return { ...state, seenStories: [...state.seenStories, action.userId] };

    case 'UPSERT_USER': {
      const existing = state.users[action.user.id];
      return {
        ...state,
        users: {
          ...state.users,
          [action.user.id]: existing
            ? { ...action.user, followedByMe: existing.followedByMe, hasStory: existing.hasStory }
            : action.user,
        },
      };
    }

    case 'UPDATE_PROFILE': {
      const user = state.users[action.userId];
      if (!user) return state;
      return { ...state, users: { ...state.users, [user.id]: { ...user, ...action.changes } } };
    }

    case 'TOGGLE_FOLLOW': {
      const target = state.users[action.userId];
      const me = state.users[action.meId];
      if (!target || !me || target.id === me.id) return state;
      const nowFollowing = !target.followedByMe;
      const delta = nowFollowing ? 1 : -1;
      return {
        ...state,
        users: {
          ...state.users,
          [target.id]: { ...target, followedByMe: nowFollowing, followers: target.followers + delta },
          [me.id]: { ...me, following: me.following + delta },
        },
      };
    }

    case 'ADD_MESSAGE': {
      const existing = state.conversations.find((c) => c.userId === action.otherId);
      // Ignore duplicates (a message can arrive both from our own insert and from realtime).
      if (existing?.messages.some((m) => m.id === action.message.id)) return state;

      const conversations = existing
        ? state.conversations.map((c) =>
            c.userId === action.otherId
              ? {
                  ...c,
                  messages: [...c.messages, action.message],
                  unread: c.unread + (action.unread ? 1 : 0),
                }
              : c,
          )
        : [
            ...state.conversations,
            { userId: action.otherId, messages: [action.message], unread: action.unread ? 1 : 0 },
          ];
      return { ...state, conversations };
    }

    case 'MARK_READ':
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.userId === action.userId && c.unread > 0 ? { ...c, unread: 0 } : c,
        ),
      };

    case 'ADD_NOTIFICATION':
      if (state.notifications.some((n) => n.id === action.notification.id)) return state;
      return { ...state, notifications: [action.notification, ...state.notifications] };

    case 'BLOCK': {
      const target = state.users[action.userId];
      return {
        ...state,
        blocked: state.blocked.includes(action.userId)
          ? state.blocked
          : [...state.blocked, action.userId],
        // Hide everything from that person straight away.
        posts: state.posts.filter((p) => p.userId !== action.userId),
        stories: state.stories.filter((s) => s.userId !== action.userId),
        notifications: state.notifications.filter((n) => n.userId !== action.userId),
        conversations: state.conversations.filter((c) => c.userId !== action.userId),
        users: target
          ? { ...state.users, [target.id]: { ...target, followedByMe: false, hasStory: false } }
          : state.users,
      };
    }

    case 'UNBLOCK':
      return { ...state, blocked: state.blocked.filter((id) => id !== action.userId) };

    default:
      return state;
  }
}

/* --------------------------------- Context -------------------------------- */

interface NewPostInput {
  image: string;
  caption: string;
  aspectRatio: number;
}

interface AppContextValue {
  state: State;
  currentUser: User;
  /** True during the very first load after signing in. */
  loading: boolean;
  /** True while pulling fresh data (pull to refresh). */
  refreshing: boolean;
  toast: string | null;
  getUser: (id: string) => User;
  refresh: () => Promise<void>;
  toggleLike: (postId: string) => void;
  toggleSave: (postId: string) => void;
  addComment: (postId: string, text: string) => void;
  /** Each resolves to null on success, or a readable error message (shown inside the popup). */
  addPost: (input: NewPostInput) => Promise<string | null>;
  addStory: (image: string) => Promise<string | null>;
  deletePost: (postId: string) => void;
  markStorySeen: (userId: string) => void;
  /** Resolves to null when saved, or a readable error message. */
  updateProfile: (changes: ProfileChanges) => Promise<string | null>;
  toggleFollow: (userId: string) => void;
  blockUser: (userId: string) => Promise<boolean>;
  unblockUser: (userId: string) => Promise<void>;
  showToast: (message: string) => void;
  sendMessage: (userId: string, text: string) => void;
  markConversationRead: (userId: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

const POST_COLUMNS =
  'id, user_id, image_url, aspect_ratio, caption, created_at, likes(user_id), saves(user_id), comments(id, user_id, text, created_at)';

const unknownUser = (id: string): User => ({
  id,
  username: 'unknown',
  name: '',
  bio: '',
  avatar: placeholderAvatar('?'),
  followers: 0,
  following: 0,
  hasStory: false,
  followedByMe: false,
});

export function AppProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, emptyState);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Always-current copy of the state for callbacks that must read it without re-creating themselves.
  const stateRef = useRef(state);
  stateRef.current = state;

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  /* ------------------------------ Loading data ----------------------------- */

  const load = useCallback(async () => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [profiles, posts, follows, stories, notifications, messages, blocks] = await Promise.all([
      supabase.from('profiles_with_counts').select('*'),
      supabase.from('posts').select(POST_COLUMNS).order('created_at', { ascending: false }).limit(100),
      supabase.from('follows').select('following_id').eq('follower_id', userId),
      supabase.from('stories').select('id, user_id, image_url, created_at').gte('created_at', since).order('created_at'),
      supabase.from('notifications').select('id, type, actor_id, post_id, text, created_at').order('created_at', { ascending: false }).limit(50),
      supabase.from('messages').select('id, sender_id, receiver_id, text, created_at, read_at').order('created_at').limit(1000),
      supabase.from('blocks').select('blocked_id'),
    ]);

    const failure = [profiles, posts, follows, stories, notifications, messages, blocks].find((r) => r.error);
    if (failure?.error) throw failure.error;

    const blockedIds = ((blocks.data ?? []) as { blocked_id: string }[]).map((b) => b.blocked_id);
    const blockedSet = new Set(blockedIds);
    const followedIds = new Set((follows.data ?? []).map((f: { following_id: string }) => f.following_id));
    const storyRows = (stories.data ?? []) as StoryRow[];
    const storyOwners = new Set(storyRows.map((s) => s.user_id));

    const users: Record<string, User> = {};
    ((profiles.data ?? []) as ProfileRow[]).forEach((row) => {
      users[row.id] = mapProfile(row, followedIds.has(row.id), storyOwners.has(row.id));
    });

    // Group flat message rows into one conversation per person.
    const byPerson = new Map<string, Conversation>();
    ((messages.data ?? []) as MessageRow[]).forEach((row) => {
      const { otherId, message, unread } = mapMessage(row, userId);
      const convo = byPerson.get(otherId) ?? { userId: otherId, messages: [], unread: 0 };
      convo.messages.push(message);
      if (unread) convo.unread += 1;
      byPerson.set(otherId, convo);
    });

    dispatch({
      type: 'LOAD',
      payload: {
        users,
        posts: ((posts.data ?? []) as PostRow[]).map((row) => mapPost(row, userId)),
        stories: storyRows.map(mapStory),
        notifications: ((notifications.data ?? []) as NotificationRow[])
          .map(mapNotification)
          .filter((n) => !blockedSet.has(n.userId)),
        // Old chats with people you've blocked stay in the database but are hidden here.
        conversations: Array.from(byPerson.values()).filter((c) => !blockedSet.has(c.userId)),
        blocked: blockedIds,
      },
    });
  }, [userId]);

  useEffect(() => {
    let active = true;
    load()
      .catch((e) => showToast(`Could not load your feed: ${errorMessage(e)}`))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [load, showToast]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } catch (e) {
      showToast(`Could not refresh: ${errorMessage(e)}`);
    } finally {
      setRefreshing(false);
    }
  }, [load, showToast]);

  /** Makes sure we know who someone is (e.g. a brand-new user who just messaged us). */
  const ensureUser = useCallback(async (id: string) => {
    if (stateRef.current.users[id]) return;
    const { data } = await supabase.from('profiles_with_counts').select('*').eq('id', id).maybeSingle();
    if (data) dispatch({ type: 'UPSERT_USER', user: mapProfile(data as ProfileRow, false, false) });
  }, []);

  // Pick up posts made on another device (e.g. your laptop) when you come back to the app or browser tab.
  // (On the web, React Native's AppState also fires when the tab becomes visible again.)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') void load().catch(() => undefined);
    });
    return () => subscription.remove();
  }, [load]);

  /* -------------------------------- Realtime ------------------------------- */

  useEffect(() => {
    const channel = supabase
      .channel(`inbox-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${userId}` },
        (payload) => {
          const { otherId, message, unread } = mapMessage(payload.new as MessageRow, userId);
          void ensureUser(otherId);
          dispatch({ type: 'ADD_MESSAGE', otherId, message, unread });
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          const notification = mapNotification(payload.new as NotificationRow);
          void ensureUser(notification.userId);
          dispatch({ type: 'ADD_NOTIFICATION', notification });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, ensureUser]);

  /* -------------------------------- Actions -------------------------------- */

  const toggleLike = useCallback(
    async (postId: string) => {
      const post = stateRef.current.posts.find((p) => p.id === postId);
      if (!post) return;
      dispatch({ type: 'TOGGLE_LIKE', postId }); // optimistic: update the screen first
      const { error } = post.likedByMe
        ? await supabase.from('likes').delete().match({ post_id: postId, user_id: userId })
        : await supabase.from('likes').insert({ post_id: postId, user_id: userId });
      if (error) {
        dispatch({ type: 'TOGGLE_LIKE', postId }); // roll back
        showToast('Could not update your like');
      }
    },
    [userId, showToast],
  );

  const toggleSave = useCallback(
    async (postId: string) => {
      const post = stateRef.current.posts.find((p) => p.id === postId);
      if (!post) return;
      dispatch({ type: 'TOGGLE_SAVE', postId });
      const { error } = post.saved
        ? await supabase.from('saves').delete().match({ post_id: postId, user_id: userId })
        : await supabase.from('saves').insert({ post_id: postId, user_id: userId });
      if (error) {
        dispatch({ type: 'TOGGLE_SAVE', postId });
        showToast('Could not update saved posts');
      }
    },
    [userId, showToast],
  );

  const addComment = useCallback(
    async (postId: string, text: string) => {
      const { data, error } = await supabase
        .from('comments')
        .insert({ post_id: postId, user_id: userId, text })
        .select('id, user_id, text, created_at')
        .single();
      if (error || !data) {
        showToast('Could not post your comment');
        return;
      }
      dispatch({
        type: 'ADD_COMMENT',
        postId,
        comment: { id: data.id, userId: data.user_id, text: data.text, createdAt: Date.parse(data.created_at) },
      });
    },
    [userId, showToast],
  );

  const addPost = useCallback(
    async ({ image, caption, aspectRatio }: NewPostInput) => {
      try {
        const imageUrl = isLocalUri(image) ? await uploadImage(userId, image, 'posts') : image;
        const { data, error } = await supabase
          .from('posts')
          .insert({ user_id: userId, image_url: imageUrl, aspect_ratio: aspectRatio, caption })
          .select('id, user_id, image_url, aspect_ratio, caption, created_at')
          .single();
        if (error) throw error;
        dispatch({ type: 'ADD_POST', post: mapPost(data as PostRow, userId) });
        return null;
      } catch (e) {
        return `Could not share your post: ${errorMessage(e)}`;
      }
    },
    [userId],
  );

  const addStory = useCallback(
    async (image: string) => {
      try {
        const imageUrl = isLocalUri(image) ? await uploadImage(userId, image, 'stories') : image;
        const { data, error } = await supabase
          .from('stories')
          .insert({ user_id: userId, image_url: imageUrl })
          .select('id, user_id, image_url, created_at')
          .single();
        if (error) throw error;
        dispatch({ type: 'ADD_STORY', story: mapStory(data as StoryRow) });
        return null;
      } catch (e) {
        return `Could not share your story: ${errorMessage(e)}`;
      }
    },
    [userId],
  );

  const deletePost = useCallback(
    async (postId: string) => {
      const previous = stateRef.current.posts;
      dispatch({ type: 'DELETE_POST', postId });
      const { error } = await supabase.from('posts').delete().eq('id', postId).eq('user_id', userId);
      if (error) {
        dispatch({ type: 'LOAD', payload: { ...stateRef.current, posts: previous } });
        showToast('Could not delete the post');
      }
    },
    [userId, showToast],
  );

  const markStorySeen = useCallback((id: string) => dispatch({ type: 'SEEN_STORY', userId: id }), []);

  const updateProfile = useCallback(
    async (changes: ProfileChanges) => {
      try {
        const current = stateRef.current.users[userId];
        const patch: Record<string, string> = {};
        const local: ProfileChanges = {};

        if (changes.name !== undefined) patch.name = local.name = changes.name;
        if (changes.username !== undefined) patch.username = local.username = changes.username;
        if (changes.bio !== undefined) patch.bio = local.bio = changes.bio;

        // Only touch the avatar if the user actually chose a new picture.
        if (changes.avatar !== undefined && changes.avatar !== current?.avatar) {
          const url = isLocalUri(changes.avatar)
            ? await uploadImage(userId, changes.avatar, 'avatars')
            : changes.avatar;
          patch.avatar_url = local.avatar = url;
        }

        const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
        if (error) {
          return error.code === '23505' ? 'That username is already taken.' : errorMessage(error);
        }
        dispatch({ type: 'UPDATE_PROFILE', userId, changes: local });
        return null;
      } catch (e) {
        return `Could not save your profile: ${errorMessage(e)}`;
      }
    },
    [userId],
  );

  const toggleFollow = useCallback(
    async (targetId: string) => {
      const target = stateRef.current.users[targetId];
      if (!target || targetId === userId) return;
      dispatch({ type: 'TOGGLE_FOLLOW', userId: targetId, meId: userId });
      const { error } = target.followedByMe
        ? await supabase.from('follows').delete().match({ follower_id: userId, following_id: targetId })
        : await supabase.from('follows').insert({ follower_id: userId, following_id: targetId });
      if (error) {
        dispatch({ type: 'TOGGLE_FOLLOW', userId: targetId, meId: userId });
        showToast('Could not update follow');
      }
    },
    [userId, showToast],
  );

  const blockUser = useCallback(
    async (targetId: string) => {
      if (targetId === userId) return false;
      const { error } = await supabase.from('blocks').insert({ blocker_id: userId, blocked_id: targetId });
      // 23505 = already blocked, which is fine.
      if (error && error.code !== '23505') {
        showToast('Could not block this account');
        return false;
      }
      dispatch({ type: 'BLOCK', userId: targetId });
      showToast('Account blocked');
      // Re-sync follower counts and the feed with what the database now allows.
      void load().catch(() => undefined);
      return true;
    },
    [userId, showToast, load],
  );

  const unblockUser = useCallback(
    async (targetId: string) => {
      const { error } = await supabase
        .from('blocks')
        .delete()
        .match({ blocker_id: userId, blocked_id: targetId });
      if (error) {
        showToast('Could not unblock this account');
        return;
      }
      dispatch({ type: 'UNBLOCK', userId: targetId });
      showToast('Account unblocked');
      void load().catch(() => undefined); // brings their posts back into the feed
    },
    [userId, showToast, load],
  );

  const sendMessage = useCallback(
    async (otherId: string, text: string) => {
      const { data, error } = await supabase
        .from('messages')
        .insert({ sender_id: userId, receiver_id: otherId, text })
        .select('id, sender_id, receiver_id, text, created_at, read_at')
        .single();
      if (error || !data) {
        // 42501 = the database's security policy refused it (e.g. the other person blocked you).
        showToast(error?.code === '42501' ? "You can't message this person" : 'Message not sent');
        return;
      }
      const { message } = mapMessage(data as MessageRow, userId);
      dispatch({ type: 'ADD_MESSAGE', otherId, message, unread: false });
    },
    [userId, showToast],
  );

  const markConversationRead = useCallback(
    async (otherId: string) => {
      const convo = stateRef.current.conversations.find((c) => c.userId === otherId);
      if (!convo || convo.unread === 0) return;
      dispatch({ type: 'MARK_READ', userId: otherId });
      await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('receiver_id', userId)
        .eq('sender_id', otherId)
        .is('read_at', null);
    },
    [userId],
  );

  /* --------------------------------- Value --------------------------------- */

  const value = useMemo<AppContextValue>(
    () => ({
      state,
      currentUser: state.users[userId] ?? unknownUser(userId),
      loading,
      refreshing,
      toast,
      getUser: (id) => state.users[id] ?? unknownUser(id),
      refresh,
      toggleLike,
      toggleSave,
      addComment,
      addPost,
      addStory,
      deletePost,
      markStorySeen,
      updateProfile,
      toggleFollow,
      blockUser,
      unblockUser,
      showToast,
      sendMessage,
      markConversationRead,
    }),
    [
      state,
      userId,
      loading,
      refreshing,
      toast,
      refresh,
      toggleLike,
      toggleSave,
      addComment,
      addPost,
      addStory,
      deletePost,
      markStorySeen,
      updateProfile,
      toggleFollow,
      blockUser,
      unblockUser,
      showToast,
      sendMessage,
      markConversationRead,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}
