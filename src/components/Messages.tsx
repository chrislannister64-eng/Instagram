import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useBreakpoint } from '../hooks/useBreakpoint';
import { useApp } from '../store/AppContext';
import { colors } from '../theme';
import { Conversation } from '../types';
import { timeAgo } from '../utils/time';
import { Avatar } from './Avatar';

export function Messages() {
  const { state, currentUser } = useApp();
  const { isMobile } = useBreakpoint();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const conversations = useMemo(
    () =>
      [...state.conversations].sort(
        (a, b) =>
          b.messages[b.messages.length - 1].createdAt - a.messages[a.messages.length - 1].createdAt,
      ),
    [state.conversations],
  );

  // People you can start a new chat with.
  const newChatUsers = useMemo(
    () =>
      Object.values(state.users).filter(
        (u) =>
          u.id !== currentUser.id &&
          !state.blocked.includes(u.id) &&
          !state.conversations.some((c) => c.userId === u.id),
      ),
    [state.users, state.conversations, state.blocked, currentUser.id],
  );

  const list = (
    <View style={[styles.list, !isMobile && styles.listDesktop]}>
      <Text style={styles.listTitle}>{currentUser.username}</Text>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionLabel}>Messages</Text>
        {conversations.map((c) => (
          <ConversationRow
            key={c.userId}
            conversation={c}
            selected={c.userId === selectedId}
            onPress={() => setSelectedId(c.userId)}
          />
        ))}

        {newChatUsers.length > 0 && <Text style={styles.sectionLabel}>Start a new chat</Text>}
        {newChatUsers.map((u) => (
          <Pressable key={u.id} style={styles.row} onPress={() => setSelectedId(u.id)}>
            <Avatar uri={u.avatar} size={48} />
            <View style={styles.rowText}>
              <Text style={styles.rowName}>{u.username}</Text>
              <Text style={styles.rowPreview}>{u.name}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );

  const chat = selectedId ? (
    <Chat
      key={selectedId}
      userId={selectedId}
      showBack={isMobile}
      onBack={() => setSelectedId(null)}
    />
  ) : (
    <View style={styles.placeholder}>
      <Ionicons name="paper-plane-outline" size={56} color={colors.text} />
      <Text style={styles.placeholderTitle}>Your messages</Text>
      <Text style={styles.placeholderText}>Pick a conversation to start chatting.</Text>
    </View>
  );

  if (isMobile) return <View style={styles.root}>{selectedId ? chat : list}</View>;

  return (
    <View style={[styles.root, styles.rootDesktop]}>
      {list}
      <View style={styles.chatPane}>{chat}</View>
    </View>
  );
}

/* ------------------------------- List row ------------------------------- */

function ConversationRow({
  conversation,
  selected,
  onPress,
}: {
  conversation: Conversation;
  selected: boolean;
  onPress: () => void;
}) {
  const { getUser } = useApp();
  const user = getUser(conversation.userId);
  const last = conversation.messages[conversation.messages.length - 1];
  const unread = conversation.unread > 0;

  return (
    <Pressable style={[styles.row, selected && styles.rowSelected]} onPress={onPress}>
      <Avatar uri={user.avatar} size={48} />
      <View style={styles.rowText}>
        <Text style={[styles.rowName, unread && styles.bold]}>{user.username}</Text>
        <Text style={[styles.rowPreview, unread && styles.rowPreviewUnread]} numberOfLines={1}>
          {last.fromMe ? 'You: ' : ''}
          {last.text} · {timeAgo(last.createdAt)}
        </Text>
      </View>
      {unread && <View style={styles.dot} />}
    </Pressable>
  );
}

/* --------------------------------- Chat --------------------------------- */

function Chat({
  userId,
  showBack,
  onBack,
}: {
  userId: string;
  showBack: boolean;
  onBack: () => void;
}) {
  const { state, getUser, sendMessage, markConversationRead, blockUser } = useApp();
  const user = getUser(userId);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const conversation = state.conversations.find((c) => c.userId === userId);
  const messages = conversation?.messages ?? [];

  const [draft, setDraft] = useState('');
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);

  // Clear the unread badge whenever this chat is open and something new arrives.
  useEffect(() => {
    markConversationRead(userId);
  }, [userId, messages.length, markConversationRead]);

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    sendMessage(userId, text);
    setDraft('');
  };

  return (
    <KeyboardAvoidingView
      style={styles.chat}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.chatHeader}>
        {showBack && (
          <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" hitSlop={10}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </Pressable>
        )}
        <Avatar uri={user.avatar} size={32} />
        <View style={styles.chatTitle}>
          <Text style={styles.chatName}>{user.username}</Text>
          <Text style={styles.chatSub}>{user.name}</Text>
        </View>
        <Pressable
          onPress={() => setConfirmBlock(true)}
          accessibilityRole="button"
          accessibilityLabel={`Block ${user.username}`}
          hitSlop={8}
        >
          <Ionicons name="ban-outline" size={22} color={colors.text} />
        </Pressable>
      </View>

      {confirmBlock && (
        <View style={styles.confirmBar}>
          <Text style={styles.confirmText}>
            Block {user.username}? You won't see each other's posts and neither of you can send messages.
          </Text>
          <View style={styles.confirmActions}>
            <Pressable onPress={() => setConfirmBlock(false)} accessibilityRole="button">
              <Text style={styles.confirmCancel}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={async () => {
                setConfirmBlock(false);
                if (await blockUser(userId)) onBack();
              }}
              accessibilityRole="button"
            >
              <Text style={styles.confirmBlock}>Block</Text>
            </Pressable>
          </View>
        </View>
      )}

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.messages}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.length === 0 && (
          <Text style={styles.empty}>Say hi to {user.username} 👋</Text>
        )}
        {messages.map((m) => (
          <View key={m.id} style={[styles.bubbleRow, m.fromMe && styles.bubbleRowMe]}>
            <View style={[styles.bubble, m.fromMe ? styles.bubbleMe : styles.bubbleThem]}>
              <Text style={[styles.bubbleText, m.fromMe && styles.bubbleTextMe]}>{m.text}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.inputRow}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={send}
          placeholder="Message…"
          placeholderTextColor={colors.textMuted}
          returnKeyType="send"
          style={styles.input}
        />
        <Pressable onPress={send} disabled={draft.trim().length === 0} accessibilityRole="button">
          <Text style={[styles.sendText, draft.trim().length === 0 && styles.sendDisabled]}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  rootDesktop: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: 935,
    alignSelf: 'center',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },

  list: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listDesktop: {
    flex: 0,
    width: 350,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.border,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  rowSelected: {
    backgroundColor: colors.surface,
  },
  rowText: {
    flex: 1,
  },
  rowName: {
    fontSize: 14,
    color: colors.text,
  },
  rowPreview: {
    fontSize: 13,
    color: colors.textMuted,
  },
  rowPreviewUnread: {
    color: colors.text,
    fontWeight: '600',
  },
  bold: {
    fontWeight: '700',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },

  chatPane: {
    flex: 1,
  },
  chat: {
    flex: 1,
    backgroundColor: colors.background,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  chatTitle: {
    flex: 1,
  },
  confirmBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
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
  chatName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  chatSub: {
    fontSize: 12,
    color: colors.textMuted,
  },
  messages: {
    padding: 16,
    gap: 6,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  empty: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 14,
    paddingVertical: 24,
  },
  bubbleRow: {
    flexDirection: 'row',
  },
  bubbleRowMe: {
    justifyContent: 'flex-end',
  },
  bubble: {
    maxWidth: '75%',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
  },
  bubbleThem: {
    backgroundColor: '#efefef',
  },
  bubbleMe: {
    backgroundColor: '#3797f0',
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 19,
    color: colors.text,
  },
  bubbleTextMe: {
    color: '#fff',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    margin: 12,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    paddingVertical: 6,
  },
  sendText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  sendDisabled: {
    opacity: 0.4,
  },

  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  placeholderTitle: {
    fontSize: 20,
    color: colors.text,
  },
  placeholderText: {
    fontSize: 14,
    color: colors.textMuted,
  },
});
