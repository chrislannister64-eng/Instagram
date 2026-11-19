import React from 'react';
import { Platform, Pressable, PressableStateCallbackType, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useApp } from '../store/AppContext';
import { colors, layout } from '../theme';
import { TabKey } from '../types';
import { Avatar } from './Avatar';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface TabConfig {
  key: TabKey;
  label: string;
  icon: IconName;
  iconActive: IconName;
}

const TABS: TabConfig[] = [
  { key: 'home', label: 'Home', icon: 'home-outline', iconActive: 'home' },
  { key: 'explore', label: 'Explore', icon: 'search-outline', iconActive: 'search' },
  { key: 'create', label: 'Create', icon: 'add-circle-outline', iconActive: 'add-circle' },
  { key: 'activity', label: 'Notifications', icon: 'heart-outline', iconActive: 'heart' },
  { key: 'profile', label: 'Profile', icon: 'person-circle-outline', iconActive: 'person-circle' },
];

type HoverState = PressableStateCallbackType & { hovered?: boolean };

/* ---------------------------------- Logo ---------------------------------- */

export function Logo({ size = 28 }: { size?: number }) {
  return <Text style={[styles.logo, { fontSize: size }]}>Instagram</Text>;
}

/* --------------------------------- Sidebar -------------------------------- */

interface SidebarProps {
  active: TabKey;
  compact: boolean;
  onSelect: (key: TabKey) => void;
  onMessages: () => void;
}

export function Sidebar({ active, compact, onSelect, onMessages }: SidebarProps) {
  return (
    <View
      style={[
        styles.sidebar,
        { width: compact ? layout.sidebarCompactWidth : layout.sidebarWidth },
      ]}
    >
      <View style={[styles.sidebarLogo, compact && styles.sidebarLogoCompact]}>
        {compact ? <Ionicons name="logo-instagram" size={26} color={colors.text} /> : <Logo />}
      </View>

      {TABS.map((tab) => (
        <SidebarItem
          key={tab.key}
          label={tab.label}
          icon={active === tab.key ? tab.iconActive : tab.icon}
          active={active === tab.key}
          compact={compact}
          onPress={() => onSelect(tab.key)}
        />
      ))}

      <SidebarItem
        label="Messages"
        icon={active === 'messages' ? 'paper-plane' : 'paper-plane-outline'}
        active={active === 'messages'}
        compact={compact}
        onPress={onMessages}
      />
    </View>
  );
}

interface SidebarItemProps {
  label: string;
  icon: IconName;
  active: boolean;
  compact: boolean;
  onPress: () => void;
}

function SidebarItem({ label, icon, active, compact, onPress }: SidebarItemProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={(state) => [
        styles.item,
        compact && styles.itemCompact,
        (state as HoverState).hovered && styles.itemHover,
        state.pressed && styles.itemPressed,
      ]}
    >
      <Ionicons name={icon} size={26} color={colors.text} />
      {!compact && (
        <Text style={[styles.itemLabel, active && styles.itemLabelActive]}>{label}</Text>
      )}
    </Pressable>
  );
}

/* ------------------------------ Mobile header ----------------------------- */

interface MobileHeaderProps {
  onActivity: () => void;
  onMessages: () => void;
}

export function MobileHeader({ onActivity, onMessages }: MobileHeaderProps) {
  return (
    <View style={styles.mobileHeader}>
      <Logo />
      <View style={styles.mobileHeaderActions}>
        <Pressable accessibilityRole="button" accessibilityLabel="Notifications" onPress={onActivity} hitSlop={8}>
          <Ionicons name="heart-outline" size={26} color={colors.text} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Messages" onPress={onMessages} hitSlop={8}>
          <Ionicons name="paper-plane-outline" size={25} color={colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

/* ------------------------------- Bottom tabs ------------------------------ */

interface BottomTabsProps {
  active: TabKey;
  onSelect: (key: TabKey) => void;
}

export function BottomTabs({ active, onSelect }: BottomTabsProps) {
  const { currentUser } = useApp();

  return (
    <View style={styles.bottomTabs}>
      {TABS.map((tab) => {
        const isActive = active === tab.key;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="button"
            accessibilityLabel={tab.label}
            onPress={() => onSelect(tab.key)}
            style={styles.bottomTab}
          >
            {tab.key === 'profile' ? (
              <View style={[styles.profileTab, isActive && styles.profileTabActive]}>
                <Avatar uri={currentUser.avatar} size={24} />
              </View>
            ) : (
              <Ionicons
                name={isActive ? tab.iconActive : tab.icon}
                size={tab.key === 'create' ? 30 : 26}
                color={colors.text}
              />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

/* --------------------------------- Styles --------------------------------- */

const styles = StyleSheet.create({
  logo: {
    color: colors.text,
    fontWeight: '700',
    fontStyle: 'italic',
    fontFamily: Platform.select({
      ios: 'Snell Roundhand',
      android: 'cursive',
      default: '"Billabong", "Segoe Script", "Brush Script MT", cursive',
    }),
  },

  sidebar: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 20,
  },
  sidebarLogo: {
    paddingHorizontal: 12,
    paddingTop: 24,
    paddingBottom: 20,
    marginBottom: 8,
  },
  sidebarLogoCompact: {
    alignItems: 'center',
    paddingHorizontal: 0,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 12,
    marginVertical: 2,
    borderRadius: 8,
  },
  itemCompact: {
    justifyContent: 'center',
  },
  itemHover: {
    backgroundColor: colors.surface,
  },
  itemPressed: {
    opacity: 0.6,
  },
  itemLabel: {
    fontSize: 16,
    color: colors.text,
  },
  itemLabelActive: {
    fontWeight: '700',
  },

  mobileHeader: {
    height: 52,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  mobileHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },

  bottomTabs: {
    height: 52,
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  bottomTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileTab: {
    padding: 1,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  profileTabActive: {
    borderColor: colors.text,
  },
});
