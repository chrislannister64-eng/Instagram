import React, { useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { useBreakpoint } from '../hooks/useBreakpoint';
import { rememberPickedImage } from '../lib/storage';
import { ProfileChanges, useApp } from '../store/AppContext';
import { useAuth } from '../store/AuthContext';
import { colors, layout } from '../theme';
import { User } from '../types';
import { Avatar } from './Avatar';
import { PhotoGrid, PostViewer } from './PhotoGrid';

type ProfileTab = 'posts' | 'saved';

const formatCount = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 10_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return n.toLocaleString('en-US');
};

export function Profile() {
  const { state, currentUser, updateProfile, getUser, unblockUser, showToast } = useApp();
  const { isMobile } = useBreakpoint();
  const { signOut } = useAuth();

  const [tab, setTab] = useState<ProfileTab>('posts');
  const [editing, setEditing] = useState(false);
  const [showBlocked, setShowBlocked] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const myPosts = useMemo(
    () =>
      state.posts
        .filter((p) => p.userId === currentUser.id)
        .sort((a, b) => b.createdAt - a.createdAt),
    [state.posts, currentUser.id],
  );
  const savedPosts = useMemo(() => state.posts.filter((p) => p.saved), [state.posts]);
  const shown = tab === 'posts' ? myPosts : savedPosts;

  const avatarSize = isMobile ? 80 : 150;

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <View style={styles.container}>
        {/* Header */}
        <View style={[styles.header, isMobile && styles.headerMobile]}>
          <View style={isMobile ? undefined : styles.avatarColumn}>
            <Avatar uri={currentUser.avatar} size={avatarSize} />
          </View>

          <View style={styles.info}>
            <View style={styles.nameRow}>
              <Text style={styles.username}>{currentUser.username}</Text>
              <Pressable style={styles.button} onPress={() => setEditing(true)} accessibilityRole="button">
                <Text style={styles.buttonText}>Edit profile</Text>
              </Pressable>
              <Pressable
                style={styles.button}
                onPress={() => setShowBlocked(true)}
                accessibilityRole="button"
              >
                <Text style={styles.buttonText}>Blocked accounts</Text>
              </Pressable>
              <Pressable style={styles.button} onPress={signOut} accessibilityRole="button">
                <Text style={styles.buttonText}>Log out</Text>
              </Pressable>
            </View>

            <View style={styles.stats}>
              <Stat value={myPosts.length} label="posts" />
              <Stat value={currentUser.followers} label="followers" />
              <Stat value={currentUser.following} label="following" />
            </View>

            <View style={styles.bio}>
              <Text style={styles.displayName}>{currentUser.name}</Text>
              <Text style={styles.bioText}>{currentUser.bio}</Text>
            </View>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TabButton label="POSTS" icon="grid-outline" active={tab === 'posts'} onPress={() => setTab('posts')} />
          <TabButton
            label="SAVED"
            icon="bookmark-outline"
            active={tab === 'saved'}
            onPress={() => setTab('saved')}
          />
        </View>

        {/* Grid */}
        {shown.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons
              name={tab === 'posts' ? 'camera-outline' : 'bookmark-outline'}
              size={48}
              color={colors.text}
            />
            <Text style={styles.emptyTitle}>{tab === 'posts' ? 'No posts yet' : 'Nothing saved yet'}</Text>
          </View>
        ) : (
          <PhotoGrid posts={shown} gap={isMobile ? 2 : 24} onSelect={(post) => setSelectedId(post.id)} />
        )}
      </View>

      <EditProfileModal
        visible={editing}
        initial={currentUser}
        takenUsernames={Object.values(state.users)
          .filter((u) => u.id !== currentUser.id)
          .map((u) => u.username.toLowerCase())}
        onClose={() => setEditing(false)}
        onSave={async (changes) => {
          const problem = await updateProfile(changes);
          if (!problem) {
            setEditing(false);
            showToast('Profile updated');
          }
          return problem;
        }}
      />
      <PostViewer postId={selectedId} onClose={() => setSelectedId(null)} />

      <Modal visible={showBlocked} transparent animationType="fade" onRequestClose={() => setShowBlocked(false)}>
        <View style={styles.backdrop}>
          <View style={[styles.sheet, styles.blockedSheet]}>
            <Text style={styles.sheetTitle}>Blocked accounts</Text>
            {state.blocked.length === 0 ? (
              <Text style={styles.emptyBlocked}>You haven't blocked anyone.</Text>
            ) : (
              state.blocked.map((id) => {
                const user = getUser(id);
                return (
                  <View key={id} style={styles.blockedRow}>
                    <Avatar uri={user.avatar} size={40} />
                    <View style={styles.blockedText}>
                      <Text style={styles.blockedName}>{user.username}</Text>
                      {user.name ? <Text style={styles.blockedSub}>{user.name}</Text> : null}
                    </View>
                    <Pressable style={styles.button} onPress={() => unblockUser(id)} accessibilityRole="button">
                      <Text style={styles.buttonText}>Unblock</Text>
                    </Pressable>
                  </View>
                );
              })
            )}
            <View style={styles.sheetActions}>
              <Pressable style={styles.button} onPress={() => setShowBlocked(false)} accessibilityRole="button">
                <Text style={styles.buttonText}>Done</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <Text style={styles.stat}>
      <Text style={styles.statValue}>{formatCount(value)}</Text> {label}
    </Text>
  );
}

function TabButton({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.tab, active && styles.tabActive]}
    >
      <Ionicons name={icon} size={14} color={active ? colors.text : colors.textMuted} />
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

/* ----------------------------- Edit profile modal ---------------------------- */

interface EditProps {
  visible: boolean;
  initial: User;
  /** Lower-cased usernames belonging to other people (usernames must be unique). */
  takenUsernames: string[];
  onClose: () => void;
  /** Resolves to null on success, or an error message to show in the form. */
  onSave: (changes: ProfileChanges) => Promise<string | null>;
}

const USERNAME_PATTERN = /^[a-z0-9._]{3,30}$/;

function EditProfileModal({ visible, initial, takenUsernames, onClose, onSave }: EditProps) {
  const { showToast } = useApp();
  const [avatar, setAvatar] = useState(initial.avatar);
  const [username, setUsername] = useState(initial.username);
  const [name, setName] = useState(initial.name);
  const [bio, setBio] = useState(initial.bio);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Reset the form each time the modal opens (adjusting state during render is React-approved).
  const [wasVisible, setWasVisible] = useState(false);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setAvatar(initial.avatar);
      setUsername(initial.username);
      setName(initial.name);
      setBio(initial.bio);
      setSaving(false);
      setSaveError(null);
    }
  }

  const cleanUsername = username.trim().toLowerCase();
  const usernameError = !USERNAME_PATTERN.test(cleanUsername)
    ? '3-30 characters: letters, numbers, periods and underscores.'
    : takenUsernames.includes(cleanUsername)
      ? 'That username is already taken.'
      : null;

  const handleResult = (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled || result.assets.length === 0) return;
    const asset = result.assets[0];
    rememberPickedImage(asset.uri, asset.base64);
    setAvatar(asset.uri);
  };

  const chooseFromGallery = async () => {
    try {
      if (Platform.OS !== 'web') {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          showToast('Photo library permission is needed to choose a photo');
          return;
        }
      }
      handleResult(
        await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
          base64: Platform.OS !== 'web',
        }),
      );
    } catch {
      showToast('Could not open your gallery');
    }
  };

  const takePhoto = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        showToast('Camera permission is needed to take a photo');
        return;
      }
      handleResult(
        await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
          base64: Platform.OS !== 'web',
        }),
      );
    } catch {
      showToast('Camera is not available on this device');
    }
  };

  const save = async () => {
    if (usernameError || saving) return;
    setSaving(true);
    setSaveError(null);
    const problem = await onSave({
      avatar,
      username: cleanUsername,
      name: name.trim() || initial.name,
      bio: bio.trim(),
    });
    setSaving(false);
    setSaveError(problem);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetScrollContent}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Edit profile</Text>

            <View style={styles.photoRow}>
              <Avatar uri={avatar} size={72} />
              <View style={styles.photoButtons}>
                <Pressable style={styles.smallButton} onPress={chooseFromGallery} accessibilityRole="button">
                  <Ionicons name="images-outline" size={16} color={colors.text} />
                  <Text style={styles.buttonText}>Gallery</Text>
                </Pressable>
                <Pressable style={styles.smallButton} onPress={takePhoto} accessibilityRole="button">
                  <Ionicons name="camera-outline" size={16} color={colors.text} />
                  <Text style={styles.buttonText}>Camera</Text>
                </Pressable>
              </View>
            </View>

            <Text style={styles.label}>Username</Text>
            <TextInput
              value={username}
              onChangeText={setUsername}
              style={[styles.input, usernameError ? styles.inputError : null]}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={30}
            />
            {usernameError && <Text style={styles.error}>{usernameError}</Text>}

            <Text style={styles.label}>Name</Text>
            <TextInput value={name} onChangeText={setName} style={styles.input} maxLength={40} />

            <Text style={styles.label}>Bio</Text>
            <TextInput
              value={bio}
              onChangeText={setBio}
              style={[styles.input, styles.bioInput]}
              multiline
              maxLength={150}
            />
            <Text style={styles.counter}>{bio.length}/150</Text>
            {saveError && <Text style={styles.error}>{saveError}</Text>}

            <View style={styles.sheetActions}>
              <Pressable onPress={onClose} style={styles.button} accessibilityRole="button">
                <Text style={styles.buttonText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={save}
                disabled={!!usernameError || saving}
                style={[styles.button, styles.buttonPrimary, !!usernameError && styles.buttonDisabled]}
                accessibilityRole="button"
              >
                <Text style={[styles.buttonText, styles.buttonPrimaryText]}>{saving ? 'Saving…' : 'Save'}</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
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
    padding: 16,
    paddingTop: 28,
  },

  header: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 28,
  },
  headerMobile: {
    gap: 20,
    marginBottom: 16,
  },
  avatarColumn: {
    flexBasis: 280,
    alignItems: 'center',
  },
  info: {
    flex: 1,
    gap: 18,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  username: {
    fontSize: 20,
    color: colors.text,
    marginRight: 8,
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 28,
  },
  stat: {
    fontSize: 15,
    color: colors.text,
  },
  statValue: {
    fontWeight: '700',
  },
  bio: {
    gap: 2,
  },
  displayName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  bioText: {
    fontSize: 14,
    lineHeight: 19,
    color: colors.text,
  },

  button: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#efefef',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  buttonPrimary: {
    backgroundColor: colors.primary,
  },
  buttonPrimaryText: {
    color: '#fff',
  },

  tabs: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 48,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    marginBottom: 16,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 14,
    marginTop: -StyleSheet.hairlineWidth,
    borderTopWidth: 1,
    borderTopColor: 'transparent',
  },
  tabActive: {
    borderTopColor: colors.text,
  },
  tabText: {
    fontSize: 12,
    letterSpacing: 1,
    fontWeight: '600',
    color: colors.textMuted,
  },
  tabTextActive: {
    color: colors.text,
  },

  empty: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 56,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '300',
    color: colors.text,
  },

  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  sheetScroll: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '100%',
  },
  sheetScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  sheet: {
    width: '100%',
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 20,
    gap: 8,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 15,
    color: colors.text,
  },
  inputError: {
    borderColor: colors.like,
  },
  error: {
    fontSize: 12,
    color: colors.like,
  },
  counter: {
    alignSelf: 'flex-end',
    fontSize: 12,
    color: colors.textMuted,
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 6,
  },
  photoButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  smallButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#efefef',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  blockedSheet: {
    maxWidth: 420,
  },
  emptyBlocked: {
    fontSize: 14,
    color: colors.textMuted,
    paddingVertical: 12,
  },
  blockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
  },
  blockedText: {
    flex: 1,
  },
  blockedName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  blockedSub: {
    fontSize: 13,
    color: colors.textMuted,
  },
  bioInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  sheetActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 14,
  },
});
