// src/screens/AIAssistantScreen.js
//
// Mobile port of the web dApp's Gemini-backed docs assistant
// (inaya-network-dapp/src/app/page.js, handleSendChatMessage +
// /api/ai/chat). This is a port, not a parallel implementation —
// investigated the real backend first (see AI_ASSISTANT_MOBILE.md at
// the repo root for the full findings) before writing any of this.
//
// ARCHITECTURE — non-negotiable per the scope of work:
//   - Calls the dApp's EXISTING /api/ai/chat route directly, the same
//     one the web frontend already calls. No second backend route was
//     built, and there is no code path anywhere in this file (or
//     anywhere else in this app) that calls Gemini directly — the
//     GEMINI_API_KEY lives only on the server and this app never sees it.
//   - Reuses the same request shape the web sends: { messages }. Does
//     NOT send the web version's walletContext (staking/PAYG/Corporate
//     Reserve snapshot) — that's a deliberate scope decision, not an
//     oversight: wiring that would mean duplicating several other
//     screens' live state into this one just for chat context, which
//     the SOW's functional scope (chat UI + streaming + basic history)
//     doesn't ask for. The assistant still answers from the static
//     knowledge base correctly; it just can't answer "what's MY
//     balance" the way the connected-wallet web version can.
//
// STREAMING — the real technical risk flagged in the SOW, resolved:
//   React Native's built-in global `fetch` does NOT support
//   response.body.getReader() at all (Hermes doesn't implement
//   ReadableStream on it — response.body is undefined; this is a
//   long-standing, still-open React Native core limitation, confirmed
//   via current research rather than assumed). The web's exact
//   getReader()-based consumption loop would silently break here.
//   Fixed by importing fetch from 'expo/fetch' instead of using the
//   global — Expo SDK 54 (this app's SDK, confirmed via package.json)
//   shipped a real native fetch implementation specifically to solve
//   LLM/AI response streaming on React Native, and its FetchResponse
//   backs `.body` with a genuine ReadableStream<Uint8Array>. Verified
//   by reading expo's own source (node_modules/expo/src/winter/fetch/
//   FetchResponse.ts) rather than trusting docs alone. No third-party
//   streaming library needed — it ships as part of the `expo` package
//   this app already depends on.
//
// HISTORY — matches the web version exactly: plain in-memory React
// state, not persisted to AsyncStorage. Confirmed by reading the web
// source (chatMessages is a bare useState, nothing writes it to
// localStorage) before deciding, per the SOW's own instruction not to
// assume.

import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { fetch as expoFetch } from 'expo/fetch';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, fonts, glassCard } from '../theme';

const API_BASE = 'https://www.inayanetwork.com';

const SUGGESTED_PROMPTS = [
  'Explain the tokenomics',
  'How does sharded storage work?',
  'What are the pricing tiers?',
  'How do I stake $INAYA?',
];

const GREETING = "👋 Hi, I'm the Inaya docs assistant. Ask me anything about pricing, tokenomics, staking, or how the sharded storage flow works.";

export default function AIAssistantScreen() {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState([{ role: 'assistant', content: GREETING }]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef(null);

  async function sendMessage(overrideText) {
    const trimmed = (overrideText ?? input).trim();
    if (!trimmed || isSending) return;

    const nextMessages = [...messages, { role: 'user', content: trimmed }];
    setMessages(nextMessages);
    setInput('');
    setError('');
    setIsSending(true);
    setIsStreaming(false);

    try {
      // expo/fetch, not the RN global fetch -- see module comment.
      const res = await expoFetch(`${API_BASE}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages }),
      });

      if (!res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await res.json();
          throw new Error(data.error || 'AI service temporarily unavailable.');
        }
        throw new Error(`Chat endpoint returned ${res.status}.`);
      }

      if (!res.body) {
        // Same fallback the web version has for browsers without stream support --
        // here it'd mean expo/fetch itself failed to provide a body, not expected
        // in practice, but keeps this from hanging silently if it ever happens.
        const wholeText = await res.text();
        setMessages((prev) => [...prev, { role: 'assistant', content: wholeText || "Sorry, I couldn't generate a response." }]);
        return;
      }

      setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);
      setIsStreaming(true);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: 'assistant', content: accumulated };
          return next;
        });
        scrollRef.current?.scrollToEnd({ animated: true });
      }

      if (!accumulated.trim()) {
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: 'assistant', content: "Sorry, I couldn't generate a response — please try again." };
          return next;
        });
      }
    } catch (err) {
      setError(err.message || 'Something went wrong reaching the docs assistant.');
    } finally {
      setIsSending(false);
      setIsStreaming(false);
      scrollRef.current?.scrollToEnd({ animated: true });
    }
  }

  const showSuggestions = messages.length === 1;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={insets.top}
    >
      <ScrollView
        ref={scrollRef}
        style={styles.messages}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl }}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map((m, i) => (
          <View key={i} style={[styles.bubbleRow, m.role === 'user' ? styles.bubbleRowUser : styles.bubbleRowAssistant]}>
            <View style={[styles.bubble, m.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant]}>
              <Text style={[styles.bubbleText, m.role === 'user' && styles.bubbleTextUser]}>
                {m.content || (isStreaming && i === messages.length - 1 ? '···' : '')}
              </Text>
            </View>
          </View>
        ))}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {showSuggestions && (
          <View style={styles.suggestions}>
            {SUGGESTED_PROMPTS.map((p) => (
              <TouchableOpacity key={p} style={styles.suggestionChip} onPress={() => sendMessage(p)}>
                <Text style={styles.suggestionText}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={[styles.inputRow, { paddingBottom: insets.bottom + spacing.sm }]}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Ask about Inaya Network..."
          placeholderTextColor={colors.textMuted}
          editable={!isSending}
          multiline
          onSubmitEditing={() => sendMessage()}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!input.trim() || isSending) && styles.sendButtonDisabled]}
          onPress={() => sendMessage()}
          disabled={!input.trim() || isSending}
        >
          <Ionicons name="arrow-up" size={18} color={colors.bg} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  messages: { flex: 1 },
  bubbleRow: { flexDirection: 'row', marginBottom: spacing.md },
  bubbleRowUser: { justifyContent: 'flex-end' },
  bubbleRowAssistant: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '85%', borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  bubbleAssistant: { ...glassCard, borderRadius: radius.lg },
  bubbleUser: { backgroundColor: 'rgba(0,242,254,0.14)', borderWidth: 1, borderColor: 'rgba(0,242,254,0.3)' },
  bubbleText: { fontFamily: fonts.sans, fontSize: 13, color: colors.textPrimary, lineHeight: 19 },
  bubbleTextUser: { color: colors.textPrimary },
  error: { fontFamily: fonts.sans, fontSize: 12, color: colors.danger, marginTop: spacing.xs },
  suggestions: { marginTop: spacing.md, gap: spacing.sm },
  suggestionChip: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  suggestionText: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.cyan },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.navBar,
  },
  input: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textPrimary,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxHeight: 100,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: { opacity: 0.35 },
});
