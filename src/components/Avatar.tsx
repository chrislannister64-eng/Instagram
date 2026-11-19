import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, seenGradient, storyGradient } from '../theme';

export type StoryRing = 'none' | 'unseen' | 'seen';

interface AvatarProps {
  uri: string;
  size?: number;
  ring?: StoryRing;
}

export function Avatar({ uri, size = 32, ring = 'none' }: AvatarProps) {
  const image = (
    <Image
      source={{ uri }}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.border }}
    />
  );

  if (ring === 'none') return image;

  const outer = size + 8;
  const inner = size + 4;

  return (
    <LinearGradient
      colors={ring === 'unseen' ? storyGradient : seenGradient}
      start={{ x: 0, y: 1 }}
      end={{ x: 1, y: 0 }}
      style={[styles.ring, { width: outer, height: outer, borderRadius: outer / 2 }]}
    >
      <View
        style={[
          styles.gap,
          { width: inner, height: inner, borderRadius: inner / 2 },
        ]}
      >
        {image}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  gap: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
