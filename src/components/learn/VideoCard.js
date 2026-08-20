// src/components/learn/VideoCard.js
//
// Reusable Inaya Learn result/saved-item card — thumbnail, title, channel,
// optional duration/progress badge, optional save toggle. Follows the
// glassCard + theme.js token conventions used everywhere else in the app.

import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, glassCard, spacing, radius, fonts } from '../../theme';

function formatDuration(totalSeconds) {
  if (!totalSeconds && totalSeconds !== 0) return null;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export default function VideoCard({
  title,
  channelTitle,
  thumbnailUrl,
  durationSeconds,
  progressPercent, // 0-100, optional — shown as a thin bar + "N% complete"
  saved,
  onPress,
  onToggleSave,
}) {
  const duration = formatDuration(durationSeconds);

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.8} onPress={onPress}>
      <View style={styles.thumbWrap}>
        {thumbnailUrl ? (
          <Image source={{ uri: thumbnailUrl }} style={styles.thumb} resizeMode="cover" />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]}>
            <Ionicons name="school-outline" size={22} color={colors.textMuted} />
          </View>
        )}
        {duration && (
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>{duration}</Text>
          </View>
        )}
      </View>

      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>{title}</Text>
        {!!channelTitle && <Text style={styles.channel} numberOfLines={1}>{channelTitle}</Text>}
        {typeof progressPercent === 'number' && (
          <View style={styles.progressRow}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.max(0, Math.min(100, progressPercent))}%` }]} />
            </View>
            <Text style={styles.progressText}>{Math.round(progressPercent)}% complete</Text>
          </View>
        )}
      </View>

      {onToggleSave && (
        <TouchableOpacity style={styles.saveButton} onPress={onToggleSave} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={20} color={saved ? colors.cyan : colors.textMuted} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const THUMB_WIDTH = 120;
const THUMB_HEIGHT = 68;

const styles = StyleSheet.create({
  card: {
    ...glassCard,
    flexDirection: 'row',
    padding: spacing.sm,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  thumbWrap: {
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  thumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationBadge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: radius.sm,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  durationText: {
    color: colors.textPrimary,
    fontFamily: fonts.monoMedium,
    fontSize: 10,
  },
  info: {
    flex: 1,
    marginLeft: spacing.sm,
    marginRight: spacing.xs,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    lineHeight: 17,
  },
  channel: {
    color: colors.textSecondary,
    fontFamily: fonts.sans,
    fontSize: 11,
    marginTop: 2,
  },
  progressRow: {
    marginTop: spacing.xs,
  },
  progressTrack: {
    height: 3,
    borderRadius: radius.full,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.cyan,
  },
  progressText: {
    color: colors.textMuted,
    fontFamily: fonts.mono,
    fontSize: 9,
    marginTop: 2,
  },
  saveButton: {
    padding: spacing.xs,
  },
});
