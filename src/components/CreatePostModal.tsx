import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
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

import { rememberPickedImage } from '../lib/storage';
import { useApp } from '../store/AppContext';
import { colors } from '../theme';
import { Avatar } from './Avatar';

interface CreatePostModalProps {
  visible: boolean;
  onClose: () => void;
  /** Called after a post or story is published (e.g. to navigate to Home). */
  onPublished: () => void;
}

type Target = 'post' | 'story';

const RATIOS: { label: string; value: number }[] = [
  { label: '1:1', value: 1 },
  { label: '4:5', value: 0.8 },
  { label: '16:9', value: 16 / 9 },
];

const SAMPLE_URL = () => `https://picsum.photos/seed/${Math.random().toString(36).slice(2, 8)}/800/800`;

function isValidImageUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Snap an arbitrary width/height to the closest ratio the feed supports. */
function nearestRatio(width: number, height: number): number {
  const actual = width / height;
  return RATIOS.reduce((best, r) =>
    Math.abs(r.value - actual) < Math.abs(best.value - actual) ? r : best,
  ).value;
}

export function CreatePostModal({ visible, onClose, onPublished }: CreatePostModalProps) {
  const { currentUser, addPost, addStory, showToast } = useApp();
  const [target, setTarget] = useState<Target>('post');
  const [url, setUrl] = useState('');
  /** Local image chosen from the gallery or camera (takes priority over the URL field). */
  const [picked, setPicked] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [ratio, setRatio] = useState(1);
  const [imageFailed, setImageFailed] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  // Start fresh each time the modal opens.
  useEffect(() => {
    if (visible) {
      setTarget('post');
      setUrl('');
      setPicked(null);
      setCaption('');
      setRatio(1);
      setImageFailed(false);
      setPublishing(false);
      setPublishError(null);
    }
  }, [visible]);

  useEffect(() => setImageFailed(false), [url, picked]);

  const handleResult = (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled || result.assets.length === 0) return;
    const asset = result.assets[0];
    rememberPickedImage(asset.uri, asset.base64);
    setPublishError(null);
    setPicked(asset.uri);
    setUrl('');
    if (asset.width && asset.height) setRatio(nearestRatio(asset.width, asset.height));
  };

  const pickFromGallery = async () => {
    try {
      // Browsers don't need a permission prompt; native platforms do.
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
          allowsEditing: false,
          quality: 0.8,
          base64: Platform.OS !== 'web', // phones upload these bytes directly (see lib/storage.ts)
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
          allowsEditing: false,
          quality: 0.8,
          base64: Platform.OS !== 'web',
        }),
      );
    } catch {
      showToast('Camera is not available on this device');
    }
  };

  const trimmed = url.trim();
  const image = picked ?? trimmed;
  const urlOk = picked !== null || isValidImageUrl(trimmed);
  const canPublish = urlOk && !imageFailed && !publishing;

  const publish = async () => {
    if (!canPublish) return;
    setPublishing(true);
    setPublishError(null);
    // Each returns null on success, or a readable error message.
    const problem =
      target === 'story'
        ? await addStory(image)
        : await addPost({ image, caption: caption.trim(), aspectRatio: ratio });
    setPublishing(false);
    if (problem) {
      // Shown inside this popup: a toast would be hidden behind it on phones.
      setPublishError(problem);
      return;
    }
    showToast(target === 'story' ? 'Story shared' : 'Post shared');
    onPublished();
  };

  const isStory = target === 'story';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />

        <View style={styles.sheet}>
          <View style={styles.header}>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Cancel" hitSlop={8}>
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
            <Text style={styles.title}>{isStory ? 'New story' : 'Create new post'}</Text>
            <Pressable onPress={publish} disabled={!canPublish} accessibilityRole="button" hitSlop={8}>
              {publishing ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={[styles.share, !canPublish && styles.shareDisabled]}>Share</Text>
              )}
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            {/* Post or story */}
            <View style={styles.ratios}>
              {(['post', 'story'] as const).map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setTarget(t)}
                  style={[styles.chip, target === t && styles.chipActive]}
                  accessibilityRole="button"
                >
                  <Text style={[styles.chipText, target === t && styles.chipTextActive]}>
                    {t === 'post' ? 'Post' : 'Story'}
                  </Text>
                </Pressable>
              ))}
            </View>

            {publishError && <Text style={styles.error}>{publishError}</Text>}

            {/* Preview */}
            <View style={[styles.preview, { aspectRatio: isStory ? 9 / 16 : ratio }, isStory && styles.previewStory]}>
              {urlOk && !imageFailed ? (
                <Image
                  source={{ uri: image }}
                  style={StyleSheet.absoluteFill}
                  resizeMode="cover"
                  onError={() => setImageFailed(true)}
                />
              ) : (
                <View style={styles.placeholder}>
                  <Ionicons name="image-outline" size={44} color={colors.textMuted} />
                  <Text style={styles.placeholderText}>
                    {imageFailed
                      ? 'Could not load that image'
                      : 'Choose a photo, take one, or paste a URL'}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.sourceRow}>
              <Pressable style={styles.sourceButton} onPress={pickFromGallery} accessibilityRole="button">
                <Ionicons name="images-outline" size={18} color={colors.text} />
                <Text style={styles.sampleText}>Gallery</Text>
              </Pressable>
              <Pressable style={styles.sourceButton} onPress={takePhoto} accessibilityRole="button">
                <Ionicons name="camera-outline" size={18} color={colors.text} />
                <Text style={styles.sampleText}>Camera</Text>
              </Pressable>
            </View>

            <Text style={styles.label}>Or paste an image URL</Text>
            <View style={styles.urlRow}>
              <TextInput
                value={url}
                onChangeText={(text) => {
                  setUrl(text);
                  setPicked(null);
                }}
                placeholder="https://…"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                style={[styles.input, styles.flex]}
              />
              <Pressable
                style={styles.sampleButton}
                onPress={() => {
                  setPicked(null);
                  setUrl(SAMPLE_URL());
                }}
                accessibilityRole="button"
              >
                <Ionicons name="shuffle" size={16} color={colors.text} />
                <Text style={styles.sampleText}>Sample</Text>
              </Pressable>
            </View>
            {trimmed.length > 0 && !urlOk && (
              <Text style={styles.error}>Enter a valid http(s) link.</Text>
            )}

            {!isStory && (
              <>
                <Text style={styles.label}>Aspect ratio</Text>
                <View style={styles.ratios}>
                  {RATIOS.map((r) => (
                    <Pressable
                      key={r.label}
                      onPress={() => setRatio(r.value)}
                      style={[styles.chip, ratio === r.value && styles.chipActive]}
                      accessibilityRole="button"
                    >
                      <Text style={[styles.chipText, ratio === r.value && styles.chipTextActive]}>{r.label}</Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.label}>Caption</Text>
                <View style={styles.captionRow}>
                  <Avatar uri={currentUser.avatar} size={28} />
                  <TextInput
                    value={caption}
                    onChangeText={setCaption}
                    placeholder="Write a caption… use #hashtags"
                    placeholderTextColor={colors.textMuted}
                    multiline
                    maxLength={2200}
                    style={[styles.input, styles.flex, styles.captionInput]}
                  />
                </View>
                <Text style={styles.counter}>{caption.length}/2,200</Text>
              </>
            )}
            {isStory && <Text style={styles.counter}>Stories disappear after 24 hours.</Text>}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  sheet: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '94%',
    backgroundColor: colors.background,
    borderRadius: 14,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  share: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
  },
  shareDisabled: {
    opacity: 0.4,
  },
  body: {
    padding: 16,
    gap: 8,
  },
  preview: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 8,
  },
  previewStory: {
    maxWidth: 240,
    alignSelf: 'center',
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 8,
  },
  placeholderText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
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
  flex: {
    flex: 1,
  },
  urlRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  sourceRow: {
    flexDirection: 'row',
    gap: 8,
  },
  sourceButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#efefef',
  },
  sampleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#efefef',
  },
  sampleText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  error: {
    fontSize: 12,
    color: colors.like,
  },
  ratios: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#efefef',
  },
  chipActive: {
    backgroundColor: colors.text,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  chipTextActive: {
    color: '#fff',
  },
  captionRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  captionInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  counter: {
    alignSelf: 'flex-end',
    fontSize: 12,
    color: colors.textMuted,
  },
});
