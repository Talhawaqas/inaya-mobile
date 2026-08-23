// src/components/learn/AiTutorButton.js
//
// Header-right entry point for the Inaya Learn AI Tutor, wired into
// LearnStack.js's shared screenOptions so it's reachable from every Learn
// screen (home, search, category, my learning, video) — not just buried
// inside an already-open video, which was the actual complaint this fixes.
// Self-contained: owns its own open/Modal state so it can be dropped into
// any screen's headerRight with zero prop wiring.

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, fonts, glassCard } from '../../theme';
import { askLearnTutor } from '../../utils/learnApi';
import { useWallet } from '../../providers/WalletProvider';

const SUGGESTED_QUESTIONS = [
  'What should I learn first?',
  'Explain blockchain in simple terms',
  'What is Web3?',
  'Quiz me on what I just watched',
];

export default function AiTutorButton() {
  const { address } = useWallet();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  async function send(overrideText) {
    const text = (overrideText ?? input).trim();
    if (!text || sending) return;
    const nextMessages = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);
    setInput('');
    setSending(true);
    try {
      const { reply } = await askLearnTutor({ walletAddress: address, videoContext: null, messages: nextMessages });
      setMessages([...nextMessages, { role: 'assistant', content: reply || "Sorry, I couldn't come up with an answer for that." }]);
    } catch (err) {
      setMessages([...nextMessages, { role: 'assistant', content: `The tutor is temporarily unavailable: ${err.message}` }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <TouchableOpacity onPress={() => setOpen(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ marginRight: spacing.sm }}>
        <Text style={{ fontSize: 20 }}>🎓</Text>
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIcon}><Text style={{ fontSize: 16 }}>🎓</Text></View>
              <View>
                <Text style={styles.headerTitle}>Inaya Learn AI Tutor</Text>
                <Text style={styles.headerSub}>Ask anything — I&apos;m here to teach</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => setOpen(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {messages.length === 0 && (
            <View style={styles.suggestWrap}>
              <Text style={styles.suggestHint}>Not sure what to ask? Try one of these:</Text>
              <View style={styles.chipRow}>
                {SUGGESTED_QUESTIONS.map((q) => (
                  <TouchableOpacity key={q} style={styles.chip} onPress={() => send(q)} disabled={sending}>
                    <Text style={styles.chipText}>{q}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <FlatList
            data={messages}
            keyExtractor={(_, i) => String(i)}
            style={styles.list}
            contentContainerStyle={{ paddingBottom: spacing.md }}
            renderItem={({ item }) => (
              <View style={[styles.bubble, item.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant]}>
                <Text style={styles.bubbleText}>{item.content}</Text>
              </View>
            )}
          />
          {sending && <Text style={styles.thinking}>Thinking…</Text>}

          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Ask a question…"
              placeholderTextColor={colors.textMuted}
              value={input}
              onChangeText={setInput}
              onSubmitEditing={() => send()}
            />
            <TouchableOpacity style={styles.sendButton} onPress={() => send()} disabled={sending || !input.trim()}>
              {sending ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.sendText}>Send</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  modal: { flex: 1, backgroundColor: colors.bg, paddingTop: spacing.xxxl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  headerIcon: { width: 32, height: 32, borderRadius: radius.md, backgroundColor: colors.cyan, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: colors.textPrimary, fontFamily: fonts.sansExtraBold, fontSize: 15 },
  headerSub: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: 11, marginTop: 1 },
  suggestWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  suggestHint: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: 12, marginBottom: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { ...glassCard, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  chipText: { color: colors.textSecondary, fontFamily: fonts.sansMedium, fontSize: 11 },
  list: { flex: 1, paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  bubble: { padding: spacing.sm, borderRadius: radius.md, marginTop: spacing.xs, maxWidth: '90%' },
  bubbleUser: { backgroundColor: colors.cyan, alignSelf: 'flex-end' },
  bubbleAssistant: { backgroundColor: 'rgba(255,255,255,0.06)', alignSelf: 'flex-start' },
  bubbleText: { fontFamily: fonts.sans, fontSize: 12, color: colors.textPrimary },
  thinking: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: 11, paddingHorizontal: spacing.lg, marginBottom: spacing.xs },
  inputRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  input: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    color: colors.textPrimary, fontFamily: fonts.sans, fontSize: 12,
  },
  sendButton: { backgroundColor: colors.cyan, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, alignItems: 'center', justifyContent: 'center' },
  sendText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.bg, textTransform: 'uppercase', letterSpacing: 0.5 },
});
