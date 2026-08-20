// src/screens/learn/LearnHomeScreen.js
//
// Inaya Learn entry screen — search, category grid, curated collections,
// and a "Continue watching" row sourced from useLearnLibrary's local-first
// progress state.

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, glassCard, spacing, radius, fonts } from '../../theme';
import { getLearnConfig } from '../../utils/learnApi';
import { useLearnLibrary } from './useLearnLibrary';
import VideoCard from '../../components/learn/VideoCard';

export default function LearnHomeScreen({ navigation }) {
  const [query, setQuery] = useState('');
  const [config, setConfig] = useState(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const { ready, progress, getVideoProgress } = useLearnLibrary();

  useEffect(() => {
    (async () => {
      try {
        const data = await getLearnConfig();
        setConfig(data);
      } catch {
        setConfig({ categories: [], collections: [], paths: [] });
      } finally {
        setLoadingConfig(false);
      }
    })();
  }, []);

  const runSearch = useCallback((q, categoryId) => {
    const trimmed = (q || '').trim();
    if (!trimmed) return;
    navigation.navigate('LearnSearchResults', { query: trimmed, categoryId: categoryId || null });
  }, [navigation]);

  const continuing = [...progress].filter((p) => p.status === 'watching').slice(0, 8);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Inaya Learn</Text>
      <Text style={styles.subtitle}>What do you want to learn today?</Text>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={16} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search courses, topics and lessons"
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => runSearch(query)}
          returnKeyType="search"
        />
      </View>

      {continuing.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Continue watching</Text>
          {continuing.map((p) => (
            <VideoCard
              key={p.videoId}
              title={p.title}
              channelTitle={p.channelTitle}
              thumbnailUrl={p.thumbnailUrl}
              progressPercent={p.durationSeconds ? (p.positionSeconds / p.durationSeconds) * 100 : 0}
              onPress={() => navigation.navigate('LearnVideo', { videoId: p.videoId })}
            />
          ))}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recommended Categories</Text>
        {loadingConfig ? (
          <ActivityIndicator color={colors.cyan} style={{ marginTop: spacing.md }} />
        ) : (
          <View style={styles.categoryGrid}>
            {config.categories.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={styles.categoryTile}
                activeOpacity={0.8}
                onPress={() => navigation.navigate('LearnCategory', { categoryId: cat.id })}
              >
                <Text style={styles.categoryIcon}>{cat.icon}</Text>
                <Text style={styles.categoryLabel} numberOfLines={2}>{cat.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {!loadingConfig && config.collections.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Featured Learning Collections</Text>
          {config.collections.map((col) => (
            <TouchableOpacity
              key={col.id}
              style={styles.collectionCard}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('LearnCategory', { categoryId: col.categoryId })}
            >
              <Text style={styles.collectionTitle}>{col.title}</Text>
              <Text style={styles.collectionDesc} numberOfLines={2}>{col.description}</Text>
              <Text style={styles.collectionTopics}>{col.topics.map((t) => t.title).join(' · ')}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  title: { color: colors.textPrimary, fontFamily: fonts.sansExtraBold, fontSize: 24 },
  subtitle: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: 13, marginTop: 4, marginBottom: spacing.lg },
  searchBar: {
    ...glassCard,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  searchInput: { flex: 1, color: colors.textPrimary, fontFamily: fonts.sans, fontSize: 13, marginLeft: spacing.xs },
  section: { marginTop: spacing.xl },
  sectionTitle: { color: colors.textPrimary, fontFamily: fonts.sansBold, fontSize: 14, marginBottom: spacing.md },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  categoryTile: {
    ...glassCard,
    width: '31%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
  },
  categoryIcon: { fontSize: 22, marginBottom: 4 },
  categoryLabel: { color: colors.textSecondary, fontFamily: fonts.sansMedium, fontSize: 10, textAlign: 'center' },
  collectionCard: { ...glassCard, padding: spacing.md, marginBottom: spacing.md },
  collectionTitle: { color: colors.cyan, fontFamily: fonts.sansBold, fontSize: 14 },
  collectionDesc: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: 12, marginTop: 4 },
  collectionTopics: { color: colors.textMuted, fontFamily: fonts.mono, fontSize: 10, marginTop: spacing.sm },
});
