// src/screens/KnowledgeBaseScreen.js
//
// Mobile port of the web dApp's Updates & Knowledge Base slide-out
// drawer — same real article data (src/data/knowledgeArticles.js,
// synced verbatim from the web source), presented as its own drawer
// menu item here rather than a slide-out panel, since the mobile nav is
// already a left-side drawer (see App.js) — a nested drawer-within-
// drawer would be redundant, a dedicated screen fits the existing
// pattern better.

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius, fonts } from '../theme';
import { KNOWLEDGE_ARTICLES } from '../data/knowledgeArticles';
import { openExternalLink } from '../utils/appLockSuspend';

const FILTERS = ['All', 'Knowledge Base', 'Blog'];

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function KnowledgeBaseScreen() {
  const tabBarHeight = useSafeAreaInsets().bottom;
  const [filter, setFilter] = useState('All');
  const [expandedId, setExpandedId] = useState(null);

  const articles = filter === 'All' ? KNOWLEDGE_ARTICLES : KNOWLEDGE_ARTICLES.filter((a) => a.category === filter);

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + spacing.xl }]}>
      <Text style={styles.title}>📣 UPDATES & KNOWLEDGE BASE</Text>
      <Text style={styles.subtitle}>File sharding, decentralization, and how Inaya solves it — plus DePIN & Web3 posts from the team.</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabRow} contentContainerStyle={{ gap: spacing.sm }}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f}
            onPress={() => setFilter(f)}
            style={[styles.tabButton, filter === f && styles.tabButtonActive]}
          >
            <Text style={[styles.tabButtonText, filter === f && styles.tabButtonTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={{ gap: spacing.md }}>
        {articles.map((article) => {
          const isExpanded = expandedId === article.id;
          const isKnowledgeBase = article.category === 'Knowledge Base';
          const onPress = () => {
            if (article.externalUrl) openExternalLink(article.externalUrl);
            else setExpandedId(isExpanded ? null : article.id);
          };

          return (
            <TouchableOpacity key={article.id} style={styles.card} onPress={onPress} activeOpacity={0.8}>
              <View style={styles.cardHeader}>
                <View style={[styles.badge, isKnowledgeBase ? styles.badgeKnowledge : styles.badgeBlog]}>
                  <Text style={[styles.badgeText, isKnowledgeBase ? styles.badgeTextKnowledge : styles.badgeTextBlog]}>
                    {isKnowledgeBase ? '📚 KNOWLEDGE BASE' : '📝 BLOG'}
                  </Text>
                </View>
                <Text style={styles.date}>{formatDate(article.date)}</Text>
              </View>

              <Text style={styles.cardTitle}>
                {article.title}
                {article.externalUrl ? ' ↗' : ''}
              </Text>
              <Text style={styles.excerpt}>{article.excerpt}</Text>

              {!article.externalUrl && (
                <>
                  <Text style={styles.readMore}>{isExpanded ? '▲ Show less' : '▼ Read more'}</Text>
                  {isExpanded && <Text style={styles.body}>{article.body}</Text>}
                </>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl, paddingBottom: spacing.xxxl + 8 },
  title: { fontSize: 20, fontFamily: fonts.sansExtraBold, color: colors.textPrimary, letterSpacing: 0.5 },
  subtitle: { fontSize: 12, fontFamily: fonts.sans, color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.lg, lineHeight: 17 },
  tabRow: { marginBottom: spacing.lg, flexGrow: 0 },
  tabButton: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.03)' },
  tabButtonActive: { backgroundColor: 'rgba(0,242,254,0.1)', borderWidth: 1, borderColor: colors.cyan },
  tabButtonText: { fontFamily: fonts.monoBold, fontSize: 11, color: colors.textMuted },
  tabButtonTextActive: { color: colors.cyan },
  card: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.full, borderWidth: 1 },
  badgeKnowledge: { backgroundColor: 'rgba(0,242,254,0.1)', borderColor: 'rgba(0,242,254,0.3)' },
  badgeBlog: { backgroundColor: 'rgba(124,92,255,0.1)', borderColor: 'rgba(124,92,255,0.3)' },
  badgeText: { fontFamily: fonts.monoBold, fontSize: 9, letterSpacing: 0.4 },
  badgeTextKnowledge: { color: colors.cyan },
  badgeTextBlog: { color: '#a78bfa' }, // lighter violet tint safe for text — colors.violet itself is glow-only, see theme.js
  date: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted },
  cardTitle: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.textPrimary, lineHeight: 19 },
  excerpt: { fontFamily: fonts.sans, fontSize: 12, color: colors.textSecondary, marginTop: spacing.xs, lineHeight: 17 },
  readMore: { fontFamily: fonts.monoBold, fontSize: 11, color: colors.cyan, marginTop: spacing.sm },
  body: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: '#cbd5e1',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    lineHeight: 19,
  },
});
