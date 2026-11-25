// src/screens/ModeChooserScreen.js -- first-open question for new installs: Inaya Business OS or Inaya Network.
// Changeable later in Settings ("What do you use Inaya for?").
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, fonts } from '../theme';

const OPTIONS = [
  { mode: 'business', icon: 'briefcase-outline', title: 'Inaya Business OS', body: 'Run my company: jobs, finance, HR, inventory, documents and more. I sign in with my work email.' },
  { mode: 'network', icon: 'cloud-outline', title: 'Inaya Network', body: 'Decentralized storage, wallet, staking, bridge and the Watcher program.' },
];

export default function ModeChooserScreen({ onChoose }) {
  return (
    <ScrollView style={s.page} contentContainerStyle={s.wrap}>
      <Text style={s.brand}>INAYA</Text>
      <Text style={s.h}>What will you use Inaya for?</Text>
      <Text style={s.sub}>We'll show only what you need. You can change this any time in Settings.</Text>
      {OPTIONS.map((o) => (
        <TouchableOpacity key={o.mode} style={s.card} onPress={() => onChoose(o.mode)} accessibilityRole="button" accessibilityLabel={o.title}>
          <Ionicons name={o.icon} size={28} color={colors.cyan} />
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={s.title}>{o.title}</Text>
            <Text style={s.body}>{o.body}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </TouchableOpacity>
      ))}
      <TouchableOpacity onPress={() => onChoose('all')} style={s.both} accessibilityRole="button"><Text style={s.bothText}>I use both: show everything</Text></TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  wrap: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl },
  brand: { color: colors.cyan, fontFamily: fonts.sansExtraBold, fontSize: 14, letterSpacing: 3, marginBottom: spacing.lg },
  h: { color: colors.textPrimary, fontFamily: fonts.sansExtraBold, fontSize: 24, marginBottom: spacing.sm },
  sub: { color: colors.textSecondary, fontSize: 14, marginBottom: spacing.xl },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderAccent, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, minHeight: 88 },
  title: { color: colors.textPrimary, fontFamily: fonts.sansExtraBold, fontSize: 17, marginBottom: 4 },
  body: { color: colors.textSecondary, fontSize: 13, lineHeight: 18 },
  both: { alignItems: 'center', padding: spacing.lg, minHeight: 48 },
  bothText: { color: colors.textMuted, fontSize: 14, textDecorationLine: 'underline' },
});
