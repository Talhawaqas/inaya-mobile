// src/screens/learn/LearnVideoScreen.js
//
// Embedded playback via react-native-youtube-iframe (wraps the official
// YouTube IFrame Player API in a WebView) — chosen specifically because its
// imperative getCurrentTime()/seekTo() give real position data, which
// react-native-webview + a raw embed URL can't without hand-rolling a
// postMessage bridge. Resumes from saved progress on load, polls position
// while playing to drive "continue watching", and offers Save/Mark
// Complete/Report.
//
// "More like this" uses same-category results, not YouTube's
// relatedToVideoId — that param was deprecated/removed from search.list in
// 2023 (see src/lib/youtube.js on the backend).

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet, Dimensions, TextInput, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import YoutubePlayer from 'react-native-youtube-iframe';
import { colors, glassCard, spacing, radius, fonts } from '../../theme';
import { getLearnVideo, reportLearnVideo, logLearnEvent, askLearnTutor } from '../../utils/learnApi';
import { useLearnLibrary } from './useLearnLibrary';
import VideoCard from '../../components/learn/VideoCard';

const PROGRESS_SYNC_INTERVAL_MS = 8000;
const COMPLETE_THRESHOLD = 0.92; // 92% watched counts as complete, matching common streak-video conventions

const REPORT_REASONS = [
  { id: 'not_educational', label: 'Not educational' },
  { id: 'unavailable', label: 'Unavailable / broken' },
  { id: 'inappropriate', label: 'Inappropriate' },
  { id: 'other', label: 'Other' },
];

export default function LearnVideoScreen({ route, navigation }) {
  const { videoId, categoryId } = route.params || {};
  const [video, setVideo] = useState(null);
  const [more, setMore] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportSent, setReportSent] = useState(false);
  const [markedComplete, setMarkedComplete] = useState(false);

  const [tutorOpen, setTutorOpen] = useState(false);
  const [tutorMessages, setTutorMessages] = useState([]);
  const [tutorInput, setTutorInput] = useState('');
  const [tutorSending, setTutorSending] = useState(false);

  const { isVideoSaved, toggleSave, getVideoProgress, updateProgress, walletAddress } = useLearnLibrary();
  const playerRef = useRef(null);
  const hasSeekedRef = useRef(false);
  const syncTimerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getLearnVideo(videoId, categoryId);
        if (cancelled) return;
        setVideo(data.video);
        setMore(data.more || []);
        setMarkedComplete(getVideoProgress(videoId)?.status === 'completed');
        logLearnEvent({ event: 'video_started', videoId, categoryId });
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load this video.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  const syncProgress = useCallback(async (status) => {
    if (!playerRef.current) return;
    try {
      const [current, duration] = await Promise.all([playerRef.current.getCurrentTime(), playerRef.current.getDuration()]);
      if (!duration) return;
      const ratio = current / duration;
      const finalStatus = status || (ratio >= COMPLETE_THRESHOLD ? 'completed' : 'watching');
      if (finalStatus === 'completed' && !markedComplete) {
        setMarkedComplete(true);
        logLearnEvent({ event: 'video_completed', videoId, categoryId });
      }
      updateProgress({
        videoId,
        title: video?.title,
        thumbnailUrl: video?.thumbnailUrl,
        channelTitle: video?.channelTitle,
        positionSeconds: Math.floor(current),
        durationSeconds: Math.floor(duration),
        status: finalStatus,
      });
    } catch {
      // Player not ready yet — safe to skip, next interval tick retries.
    }
  }, [videoId, categoryId, video, updateProgress, markedComplete]);

  const onStateChange = useCallback((state) => {
    if (state === 'playing') {
      setPlaying(true);
      if (!hasSeekedRef.current) {
        hasSeekedRef.current = true;
        const resumeAt = getVideoProgress(videoId)?.positionSeconds;
        if (resumeAt > 5) playerRef.current?.seekTo(resumeAt, true);
      }
      if (!syncTimerRef.current) {
        syncTimerRef.current = setInterval(() => syncProgress(), PROGRESS_SYNC_INTERVAL_MS);
      }
    } else if (state === 'paused') {
      setPlaying(false);
      syncProgress();
    } else if (state === 'ended') {
      setPlaying(false);
      syncProgress('completed');
    }
  }, [videoId, getVideoProgress, syncProgress]);

  useEffect(() => () => {
    if (syncTimerRef.current) clearInterval(syncTimerRef.current);
  }, []);

  const handleToggleSave = () => {
    if (!video) return;
    toggleSave({ videoId, title: video.title, thumbnailUrl: video.thumbnailUrl, channelTitle: video.channelTitle, categoryId });
    logLearnEvent({ event: isVideoSaved(videoId) ? 'video_unsaved' : 'video_saved', videoId, categoryId });
  };

  const handleMarkComplete = () => {
    syncProgress('completed');
  };

  const handleReport = async (reason) => {
    try {
      await reportLearnVideo({ videoId, reason, walletAddress });
      setReportSent(true);
      setReportOpen(false);
    } catch {
      setReportOpen(false);
    }
  };

  const handleSendTutorMessage = async () => {
    const text = tutorInput.trim();
    if (!text || tutorSending) return;
    const nextMessages = [...tutorMessages, { role: 'user', content: text }];
    setTutorMessages(nextMessages);
    setTutorInput('');
    setTutorSending(true);
    try {
      const { reply } = await askLearnTutor({
        walletAddress,
        videoContext: video ? { title: video.title, channelTitle: video.channelTitle, categoryId, description: video.description } : null,
        messages: nextMessages,
      });
      setTutorMessages([...nextMessages, { role: 'assistant', content: reply || "Sorry, I couldn't come up with an answer for that." }]);
    } catch (err) {
      setTutorMessages([...nextMessages, { role: 'assistant', content: `The tutor is temporarily unavailable: ${err.message}` }]);
    } finally {
      setTutorSending(false);
    }
  };

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator color={colors.cyan} /></View>;
  }
  if (error || !video) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={28} color={colors.danger} />
        <Text style={styles.errorText}>{error || 'This video is unavailable.'}</Text>
      </View>
    );
  }

  const width = Dimensions.get('window').width;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <YoutubePlayer
        ref={playerRef}
        height={Math.round((width * 9) / 16)}
        play={playing}
        videoId={videoId}
        onChangeState={onStateChange}
      />

      <Text style={styles.title}>{video.title}</Text>
      <Text style={styles.channel}>{video.channelTitle}</Text>

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.actionButton} onPress={handleToggleSave}>
          <Ionicons name={isVideoSaved(videoId) ? 'bookmark' : 'bookmark-outline'} size={16} color={isVideoSaved(videoId) ? colors.cyan : colors.textSecondary} />
          <Text style={[styles.actionText, isVideoSaved(videoId) && { color: colors.cyan }]}>Save</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={handleMarkComplete} disabled={markedComplete}>
          <Ionicons name={markedComplete ? 'checkmark-circle' : 'checkmark-circle-outline'} size={16} color={markedComplete ? colors.success : colors.textSecondary} />
          <Text style={[styles.actionText, markedComplete && { color: colors.success }]}>{markedComplete ? 'Completed' : 'Mark complete'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => setReportOpen((o) => !o)} disabled={reportSent}>
          <Ionicons name="flag-outline" size={16} color={colors.textMuted} />
          <Text style={styles.actionText}>{reportSent ? 'Reported' : 'Report'}</Text>
        </TouchableOpacity>
      </View>

      {reportOpen && (
        <View style={styles.reportBox}>
          {REPORT_REASONS.map((r) => (
            <TouchableOpacity key={r.id} style={styles.reportOption} onPress={() => handleReport(r.id)}>
              <Text style={styles.reportOptionText}>{r.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {!!video.description && (
        <Text style={styles.description} numberOfLines={6}>{video.description}</Text>
      )}

      <View style={styles.tutorCard}>
        <TouchableOpacity onPress={() => setTutorOpen((v) => !v)}>
          <Text style={styles.tutorTitle}>🎓 Ask AI Tutor {tutorOpen ? '▲' : '▼'}</Text>
        </TouchableOpacity>
        {tutorOpen && (
          <>
            <Text style={styles.tutorHint}>Ask a question about this video, or anything you're learning.</Text>
            <FlatList
              data={tutorMessages}
              keyExtractor={(_, i) => String(i)}
              style={{ maxHeight: 240, marginTop: spacing.sm }}
              renderItem={({ item }) => (
                <View style={[styles.chatBubble, item.role === 'user' ? styles.chatBubbleUser : styles.chatBubbleAssistant]}>
                  <Text style={styles.chatText}>{item.content}</Text>
                </View>
              )}
            />
            <View style={styles.checkRow}>
              <TextInput
                style={styles.input}
                placeholder="Ask a question…"
                placeholderTextColor={colors.textMuted}
                value={tutorInput}
                onChangeText={setTutorInput}
              />
              <TouchableOpacity style={styles.checkButton} onPress={handleSendTutorMessage} disabled={tutorSending || !tutorInput.trim()}>
                {tutorSending ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.checkButtonText}>Send</Text>}
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {more.length > 0 && (
        <View style={styles.moreSection}>
          <Text style={styles.moreTitle}>More like this</Text>
          {more.map((item) => (
            <VideoCard
              key={item.videoId}
              title={item.title}
              channelTitle={item.channelTitle}
              thumbnailUrl={item.thumbnailUrl}
              onPress={() => navigation.push('LearnVideo', { videoId: item.videoId, categoryId })}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: spacing.xxxl },
  centered: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  errorText: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: 13, marginTop: spacing.sm, textAlign: 'center' },
  title: { color: colors.textPrimary, fontFamily: fonts.sansBold, fontSize: 16, marginHorizontal: spacing.lg, marginTop: spacing.md },
  channel: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: 12, marginHorizontal: spacing.lg, marginTop: 4 },
  actionRow: { flexDirection: 'row', gap: spacing.lg, marginHorizontal: spacing.lg, marginTop: spacing.md },
  actionButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: { color: colors.textSecondary, fontFamily: fonts.sansMedium, fontSize: 12 },
  reportBox: { ...glassCard, marginHorizontal: spacing.lg, marginTop: spacing.md, padding: spacing.sm },
  reportOption: { paddingVertical: spacing.sm, paddingHorizontal: spacing.sm },
  reportOptionText: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: 13 },
  description: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: 12, lineHeight: 18, marginHorizontal: spacing.lg, marginTop: spacing.lg },
  tutorCard: { ...glassCard, marginHorizontal: spacing.lg, marginTop: spacing.lg, padding: spacing.lg },
  tutorTitle: { color: colors.textPrimary, fontFamily: fonts.sansBold, fontSize: 14 },
  tutorHint: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: 11, marginTop: spacing.xs, lineHeight: 16 },
  checkRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, alignItems: 'center' },
  input: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    color: colors.textPrimary, fontFamily: fonts.sans, fontSize: 12,
  },
  checkButton: { backgroundColor: colors.cyan, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, alignItems: 'center', justifyContent: 'center' },
  checkButtonText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.bg, textTransform: 'uppercase', letterSpacing: 0.5 },
  chatBubble: { padding: spacing.sm, borderRadius: radius.md, marginTop: spacing.xs, maxWidth: '90%' },
  chatBubbleUser: { backgroundColor: colors.cyan, alignSelf: 'flex-end' },
  chatBubbleAssistant: { backgroundColor: 'rgba(255,255,255,0.06)', alignSelf: 'flex-start' },
  chatText: { fontFamily: fonts.sans, fontSize: 12, color: colors.textPrimary },
  moreSection: { marginTop: spacing.xl, paddingHorizontal: spacing.lg },
  moreTitle: { color: colors.textPrimary, fontFamily: fonts.sansBold, fontSize: 14, marginBottom: spacing.md },
});
