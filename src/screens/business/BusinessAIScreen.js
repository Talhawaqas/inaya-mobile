// src/screens/business/BusinessAIScreen.js
//
// The permission-aware AI Business Assistant, brought to mobile. Same
// backend as the web Business Workspace's AI Assistant tab — POST
// /api/ai/business-chat (lib/ai-business-tools.js) — reached through
// orgFetch(), which already attaches the stored session as an
// Authorization: Bearer header (see utils/orgApi.js). Nothing new on the
// backend was needed: that route already accepted Bearer auth from the
// getRawSessionToken() work that made the rest of this Business Workspace
// mobile-compatible.
//
// Every answer is scoped server-side to what THIS signed-in member can
// see (getAccessibleScope()) — this screen has no more say in what the
// assistant reveals than the web version does. See
// inaya-network-dapp/src/lib/ai-business-tools.js's header comment for
// the full argument.

import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, fonts, glassCard } from '../../theme';
import { orgFetch } from '../../utils/orgApi';

const SUGGESTIONS = [
  'Which documents are waiting for approval?',
  'Show me the latest rejected documents.',
  'Which projects currently have pending documents?',
  'Show me our recently approved documents.',
];

export default function BusinessAIScreen({ route }) {
  const { orgId } = route.params;
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hi — ask me about your company's departments, projects, documents, or recent activity. I only show you what you're already allowed to see." },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  async function send(text) {
    const trimmed = (text ?? input).trim();
    if (!trimmed || sending) return;
    const nextMessages = [...messages, { role: 'user', content: trimmed }];
    setMessages(nextMessages);
    setInput('');
    setSending(true);
    setError('');
    try {
      const data = await orgFetch('/api/ai/business-chat', { method: 'POST', body: { orgId, messages: nextMessages } });
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <ScrollView style={styles.messages} contentContainerStyle={styles.messagesContent}>
        {messages.map((m, i) => (
          <View key={i} style={[styles.bubbleRow, m.role === 'user' ? styles.bubbleRowUser : styles.bubbleRowAssistant]}>
            <View style={[styles.bubble, m.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant]}>
              <Text style={[styles.bubbleText, m.role === 'user' && styles.bubbleTextUser]}>{m.content}</Text>
            </View>
          </View>
        ))}
        {sending && (
          <View style={[styles.bubbleRow, styles.bubbleRowAssistant]}>
            <View style={[styles.bubble, styles.bubbleAssistant]}>
              <Text style={styles.thinkingText}>Thinking…</Text>
            </View>
          </View>
        )}

        {messages.length <= 1 && (
          <View style={styles.suggestions}>
            {SUGGESTIONS.map((s) => (
              <TouchableOpacity key={s} style={styles.suggestionChip} onPress={() => send(s)}>
                <Text style={styles.suggestionText}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Ask about documents, approvals, activity…"
          placeholderTextColor={colors.textMuted}
          editable={!sending}
          onSubmitEditing={() => send()}
        />
        <TouchableOpacity style={[styles.sendButton, (sending || !input.trim()) && styles.sendButtonDisabled]} onPress={() => send()} disabled={sending || !input.trim()}>
          {sending ? <ActivityIndicator color={colors.bg} size="small" /> : <Ionicons name="send" size={16} color={colors.bg} />}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  messages: { flex: 1 },
  messagesContent: { padding: spacing.lg, gap: spacing.sm },
  bubbleRow: { flexDirection: 'row' },
  bubbleRowUser: { justifyContent: 'flex-end' },
  bubbleRowAssistant: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '85%', borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  bubbleUser: { backgroundColor: 'rgba(0,242,254,0.15)' },
  bubbleAssistant: { backgroundColor: 'rgba(255,255,255,0.05)' },
  bubbleText: { fontFamily: fonts.sans, fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  bubbleTextUser: { color: colors.textPrimary },
  thinkingText: { fontFamily: fonts.sans, fontSize: 13, color: colors.textMuted, fontStyle: 'italic' },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  suggestionChip: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: colors.border, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  suggestionText: { fontFamily: fonts.sans, fontSize: 11, color: colors.textSecondary },
  error: { fontFamily: fonts.sans, fontSize: 11, color: colors.danger, marginTop: spacing.sm },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.navBar,
  },
  input: {
    flex: 1, fontFamily: fonts.sans, fontSize: 13, color: colors.textPrimary,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  sendButton: {
    width: 38, height: 38, borderRadius: radius.full, backgroundColor: colors.cyan,
    alignItems: 'center', justifyContent: 'center',
  },
  sendButtonDisabled: { opacity: 0.4 },
});
