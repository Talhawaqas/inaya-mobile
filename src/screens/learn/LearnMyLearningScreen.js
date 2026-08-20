// src/screens/learn/LearnMyLearningScreen.js
//
// "My Learning" — currently watching / completed / saved, sourced from
// useLearnLibrary's local-first (optionally wallet-synced) state. A simple
// 3-way segmented toggle rather than a tab library — no top-tabs package
// is installed in this app, and this matches its existing low-dependency,
// simple-component conventions.

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { colors, glassCard, spacing, radius, fonts } from '../../theme';
import { useLearnLibrary } from './useLearnLibrary';
import VideoCard from '../../components/learn/VideoCard';

const SECTIONS = [
  { id: 'watching', label: 'Continue Watching' },
  { id: 'completed', label: 'Completed' },
  { id: 'saved', label: 'Saved' },
];

export default function LearnMyLearningScreen({ navigation }) {
  const [section, setSection] = useState('watching');
  const { ready, saved, progress, toggleSave, isVideoSaved } = useLearnLibrary();

  let items = [];
  if (section === 'watching') items = progress.filter((p) => p.status === 'watching');
  else if (section === 'completed') items = progress.filter((p) => p.status === 'completed');
  else items = saved;

  return (
    <View style={styles.container}>
      <View style={styles.tabRow}>
        {SECTIONS.map((s) => (
          <TouchableOpacity
            key={s.id}
            style={[styles.tab, section === s.id && styles.tabActive]}
            onPress={() => setSection(s.id)}
          >
            <Text style={[styles.tabText, section === s.id && styles.tabTextActive]}>{s.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {!ready ? null : items.length === 0 ? (
          <Text style={styles.empty}>
            {section === 'watching' && 'Nothing in progress yet — start a video from Learn Home.'}
            {section === 'completed' && "You haven't completed any videos yet."}
            {section === 'saved' && "You haven't saved any videos yet."}
          </Text>
        ) : (
          items.map((item) => (
            <VideoCard
              key={item.videoId}
              title={item.title}
              channelTitle={item.channelTitle}
              thumbnailUrl={item.thumbnailUrl}
              progressPercent={item.durationSeconds ? (item.positionSeconds / item.durationSeconds) * 100 : undefined}
              saved={section === 'saved' ? true : isVideoSaved(item.videoId)}
              onToggleSave={() => toggleSave(item)}
              onPress={() => navigation.navigate('LearnVideo', { videoId: item.videoId, categoryId: item.categoryId })}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  tabRow: { flexDirection: 'row', padding: spacing.lg, gap: spacing.sm },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  tabActive: { borderColor: colors.cyan, backgroundColor: 'rgba(0,242,254,0.08)' },
  tabText: { color: colors.textMuted, fontFamily: fonts.sansMedium, fontSize: 11 },
  tabTextActive: { color: colors.cyan },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },
  empty: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: 13, textAlign: 'center', marginTop: spacing.xxl },
});
