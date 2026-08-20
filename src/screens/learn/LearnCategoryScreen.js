// src/screens/learn/LearnCategoryScreen.js
//
// Category detail — description, curated collection topics (as tappable
// chips that jump straight to a scoped search), and a browse list of
// results for the category itself.

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { colors, glassCard, spacing, radius, fonts } from '../../theme';
import { getLearnConfig, searchLearnVideos, logLearnEvent } from '../../utils/learnApi';
import { useLearnLibrary } from './useLearnLibrary';
import VideoCard from '../../components/learn/VideoCard';

export default function LearnCategoryScreen({ route, navigation }) {
  const { categoryId } = route.params || {};
  const [category, setCategory] = useState(null);
  const [collections, setCollections] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const { isVideoSaved, toggleSave } = useLearnLibrary();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const config = await getLearnConfig();
        const cat = config.categories.find((c) => c.id === categoryId);
        const cols = config.collections.filter((c) => c.categoryId === categoryId);
        if (cancelled) return;
        setCategory(cat || null);
        setCollections(cols);
        navigation.setOptions({ title: cat?.name || 'Category' });

        const searchData = await searchLearnVideos({ query: cat?.name || categoryId, categoryId });
        if (!cancelled) setResults(searchData.results);

        logLearnEvent({ event: 'collection_opened', categoryId });
      } catch {
        // Best-effort — an empty category screen is a reasonable fallback.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId]);

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator color={colors.cyan} /></View>;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.icon}>{category?.icon}</Text>
      <Text style={styles.title}>{category?.name || 'Category'}</Text>

      {collections.map((col) => (
        <View key={col.id} style={styles.collectionBox}>
          <Text style={styles.collectionTitle}>{col.title}</Text>
          <Text style={styles.collectionDesc}>{col.description}</Text>
          <View style={styles.chipRow}>
            {col.topics.map((topic) => (
              <TouchableOpacity
                key={topic.id}
                style={styles.chip}
                onPress={() => navigation.navigate('LearnSearchResults', { query: topic.searchQuery, categoryId })}
              >
                <Text style={styles.chipText}>{topic.title}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}

      <Text style={styles.sectionTitle}>Recommended Videos</Text>
      {results.length === 0 ? (
        <Text style={styles.empty}>No educational results found for this category yet.</Text>
      ) : (
        results.map((item) => (
          <VideoCard
            key={item.videoId}
            title={item.title}
            channelTitle={item.channelTitle}
            thumbnailUrl={item.thumbnailUrl}
            saved={isVideoSaved(item.videoId)}
            onToggleSave={() => toggleSave({ videoId: item.videoId, title: item.title, thumbnailUrl: item.thumbnailUrl, channelTitle: item.channelTitle, categoryId })}
            onPress={() => navigation.navigate('LearnVideo', { videoId: item.videoId, categoryId })}
          />
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  icon: { fontSize: 32 },
  title: { color: colors.textPrimary, fontFamily: fonts.sansExtraBold, fontSize: 20, marginTop: 4, marginBottom: spacing.lg },
  collectionBox: { ...glassCard, padding: spacing.md, marginBottom: spacing.lg },
  collectionTitle: { color: colors.cyan, fontFamily: fonts.sansBold, fontSize: 14 },
  collectionDesc: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: 12, marginTop: 4, marginBottom: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  chipText: { color: colors.textSecondary, fontFamily: fonts.sansMedium, fontSize: 11 },
  sectionTitle: { color: colors.textPrimary, fontFamily: fonts.sansBold, fontSize: 14, marginBottom: spacing.md },
  empty: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: 13 },
});
