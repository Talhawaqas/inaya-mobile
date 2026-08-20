// src/screens/learn/LearnSearchResultsScreen.js
//
// Search results — FlatList with onEndReached-driven pageToken pagination.
// A deliberate departure from this app's usual ScrollView+.map() screen
// convention, since Inaya Learn's spec (§16) requires lazy-loading and
// nothing else in this app paginates.

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import { colors, spacing, fonts } from '../../theme';
import { searchLearnVideos, logLearnEvent } from '../../utils/learnApi';
import { useLearnLibrary } from './useLearnLibrary';
import VideoCard from '../../components/learn/VideoCard';

export default function LearnSearchResultsScreen({ route, navigation }) {
  const { query, categoryId } = route.params || {};
  const [results, setResults] = useState([]);
  const [pageToken, setPageToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const { isVideoSaved, toggleSave } = useLearnLibrary();

  const runSearch = useCallback(async (token) => {
    try {
      const data = await searchLearnVideos({ query, categoryId, pageToken: token });
      setResults((prev) => (token ? [...prev, ...data.results] : data.results));
      setPageToken(data.nextPageToken || null);
      setError(null);
    } catch (err) {
      setError(err.message || 'Search failed.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [query, categoryId]);

  useEffect(() => {
    setLoading(true);
    setResults([]);
    setPageToken(null);
    runSearch(null);
    logLearnEvent({ event: 'search_performed', categoryId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, categoryId]);

  const loadMore = () => {
    if (!pageToken || loadingMore) return;
    setLoadingMore(true);
    runSearch(pageToken);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerLabel}>Educational results for</Text>
        <Text style={styles.headerQuery} numberOfLines={1}>“{query}”</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.cyan} style={{ marginTop: spacing.xxl }} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : results.length === 0 ? (
        <Text style={styles.empty}>No educational results found. Try a different search.</Text>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.videoId}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <VideoCard
              title={item.title}
              channelTitle={item.channelTitle}
              thumbnailUrl={item.thumbnailUrl}
              saved={isVideoSaved(item.videoId)}
              onToggleSave={() => toggleSave({
                videoId: item.videoId,
                title: item.title,
                thumbnailUrl: item.thumbnailUrl,
                channelTitle: item.channelTitle,
                categoryId,
              })}
              onPress={() => navigation.navigate('LearnVideo', { videoId: item.videoId, categoryId })}
            />
          )}
          onEndReachedThreshold={0.4}
          onEndReached={loadMore}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.cyan} style={{ marginVertical: spacing.lg }} /> : null}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { padding: spacing.lg, paddingBottom: spacing.sm },
  headerLabel: { color: colors.textMuted, fontFamily: fonts.mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 },
  headerQuery: { color: colors.textPrimary, fontFamily: fonts.sansBold, fontSize: 16, marginTop: 2 },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },
  error: { color: colors.danger, fontFamily: fonts.sans, fontSize: 13, textAlign: 'center', marginTop: spacing.xxl, paddingHorizontal: spacing.lg },
  empty: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: 13, textAlign: 'center', marginTop: spacing.xxl, paddingHorizontal: spacing.lg },
});
