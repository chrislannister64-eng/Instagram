import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useApp } from '../store/AppContext';

export function Toast() {
  const { toast } = useApp();
  if (!toast) return null;

  return (
    <View pointerEvents="none" style={styles.wrap}>
      <View style={styles.toast}>
        <Text style={styles.text}>{toast}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 76,
    alignItems: 'center',
    zIndex: 1000,
  },
  toast: {
    backgroundColor: 'rgba(38,38,38,0.95)',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },
  text: {
    color: '#fff',
    fontSize: 14,
  },
});
