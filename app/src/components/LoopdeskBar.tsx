import React from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { LOOPDESK_HUB_URL, isLoopdeskSession } from '../utils/loopdeskSso';

/**
 * Loopdesk AI top bar for Korvo on the web, shown when the owner opened Korvo
 * from Loopdesk. Same crimson bar and wording as the other tools
 * ("Loopdesk AI / Korvo", All tools, business name, Log out), so a bundle
 * client feels they are in one product. The phone app is unchanged.
 */
export function LoopdeskBar({ businessName, onLogout }: { businessName?: string | null; onLogout?: () => void }) {
  if (Platform.OS !== 'web' || !isLoopdeskSession()) return null;
  const go = (path: string) => { if (typeof window !== 'undefined') window.location.href = `${LOOPDESK_HUB_URL}${path}`; };
  return (
    <View
      accessibilityRole="header"
      style={{ height: 56, backgroundColor: '#a3122a', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12 }}
    >
      <Pressable onPress={() => go('/dashboard')} accessibilityRole="link" accessibilityLabel="Loopdesk AI home">
        <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: 16 }}>Loopdesk AI</Text>
      </Pressable>
      <Text style={{ color: '#ffd2d9' }}>/</Text>
      <Text style={{ color: '#ffffff', fontSize: 15 }}>Korvo</Text>
      <Pressable onPress={() => go('/dashboard')} accessibilityRole="link" style={{ marginLeft: 8, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: '#ffd2d9' }}>
        <Text style={{ color: '#ffffff', fontSize: 13 }}>All tools</Text>
      </Pressable>
      <View style={{ flex: 1 }} />
      {!!businessName && <Text style={{ color: '#ffd2d9', fontSize: 13 }} numberOfLines={1}>{businessName}</Text>}
      {onLogout && (
        <Pressable onPress={onLogout} accessibilityRole="button">
          <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '600' }}>Log out</Text>
        </Pressable>
      )}
    </View>
  );
}
