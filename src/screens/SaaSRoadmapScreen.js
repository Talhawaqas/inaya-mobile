// src/screens/SaaSRoadmapScreen.js
//
// Public Business SaaS Roadmap — presentation only, no auth, no network
// calls. Content comes entirely from src/data/saasRoadmap.js, which is a
// deliberate mirror of the web app's src/lib/saasRoadmap.js (see that
// file's header comment) so both apps make identical claims about what's
// live vs. planned.
//
// Vertical timeline of expandable stage cards, per the mobile design
// brief — collapsed by default (number, title, status, short description)
// so the whole roadmap is scannable in one scroll, with a tap revealing
// the full feature list / diagram / notes for that stage.

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, fonts, glassCard } from '../theme';
import {
  STATUS_LABELS,
  STATUS_COLORS,
  ARCHITECTURE_LAYERS,
  POSITIONING_STATEMENT,
  POSITIONING_SUBTEXT,
  DOCUMENT_WORKFLOW_DIAGRAM,
  ROADMAP_STAGES,
  VISION,
} from '../data/saasRoadmap';

function StatusBadge({ status }) {
  const color = STATUS_COLORS[status];
  return (
    <View style={[badgeStyles.badge, { borderColor: `${color}55`, backgroundColor: `${color}1f` }]}>
      <View style={[badgeStyles.dot, { backgroundColor: color }]} />
      <Text style={[badgeStyles.text, { color }]}>{STATUS_LABELS[status]}</Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  text: { fontFamily: fonts.monoBold, fontSize: 9, letterSpacing: 0.6, textTransform: 'uppercase' },
});

function WorkflowDiagram() {
  const { linear, splits, loops } = DOCUMENT_WORKFLOW_DIAGRAM;
  return (
    <View style={diagramStyles.box}>
      <View style={diagramStyles.row}>
        {linear.map((step, i) => (
          <React.Fragment key={step.id}>
            <View style={diagramStyles.chip}><Text style={diagramStyles.chipText}>{step.label}</Text></View>
            {i < linear.length - 1 && <Text style={diagramStyles.arrow}>→</Text>}
          </React.Fragment>
        ))}
      </View>
      {splits.map((s) => (
        <View key={s.to} style={diagramStyles.branchRow}>
          <Text style={diagramStyles.branchLabel}>↳ {s.label} →</Text>
          <View style={diagramStyles.chip}><Text style={diagramStyles.chipText}>{s.to.replace('_', ' ')}</Text></View>
        </View>
      ))}
      {loops.map((l) => (
        <View key={`${l.from}-${l.to}`} style={diagramStyles.branchRow}>
          <Text style={diagramStyles.branchLabel}>{l.from.replace('_', ' ')} — {l.label} →</Text>
          <View style={diagramStyles.chip}><Text style={diagramStyles.chipText}>{l.to.replace('_', ' ')}</Text></View>
        </View>
      ))}
    </View>
  );
}

const diagramStyles = StyleSheet.create({
  box: { marginTop: spacing.md, backgroundColor: 'rgba(0,0,0,0.2)', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs },
  chip: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  chipText: { fontFamily: fonts.mono, fontSize: 10, color: colors.textSecondary },
  arrow: { fontFamily: fonts.mono, fontSize: 12, color: colors.textMuted },
  branchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm, paddingLeft: spacing.sm },
  branchLabel: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted },
});

function StageCard({ stage, expanded, onToggle, isLast }) {
  return (
    <View style={styles.timelineRow}>
      <View style={styles.timelineRail}>
        <View style={[styles.timelineDot, { backgroundColor: STATUS_COLORS[stage.status] }]} />
        {!isLast && <View style={styles.timelineLine} />}
      </View>

      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onToggle}
        style={[styles.card, stage.highlight && styles.cardHighlight]}
      >
        <View style={styles.cardHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 }}>
            <Text style={styles.stageNumber}>{String(stage.number).padStart(2, '0')}</Text>
            <Text style={styles.stageTitle}>{stage.title}</Text>
          </View>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
        </View>

        <View style={{ marginTop: spacing.xs }}>
          <StatusBadge status={stage.status} />
        </View>

        <Text style={styles.description}>{stage.description}</Text>

        {expanded && (
          <View style={{ marginTop: spacing.md }}>
            {stage.securityStatement && (
              <View style={styles.securityBox}>
                <Text style={styles.securityText}>{stage.securityStatement}</Text>
              </View>
            )}

            {stage.features && (
              <View style={{ marginTop: spacing.sm }}>
                {stage.features.map((f) => (
                  <View key={f} style={styles.featureRow}>
                    <Text style={styles.checkmark}>✓</Text>
                    <Text style={styles.featureText}>{f}</Text>
                  </View>
                ))}
              </View>
            )}

            {stage.groups && (
              <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
                {stage.groups.map((g) => (
                  <View key={g.title} style={styles.groupBox}>
                    <Text style={styles.groupTitle}>{g.title}</Text>
                    {g.items.map((item) => (
                      <Text key={item} style={styles.groupItem}>• {item}</Text>
                    ))}
                  </View>
                ))}
              </View>
            )}

            {stage.tools && (
              <View style={{ marginTop: spacing.md }}>
                <Text style={styles.subLabel}>Implemented AI tools</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs }}>
                  {stage.tools.map((t) => (
                    <View key={t} style={styles.toolChip}><Text style={styles.toolChipText}>{t}</Text></View>
                  ))}
                </View>
              </View>
            )}

            {stage.diagram === 'DOCUMENT_WORKFLOW_DIAGRAM' && <WorkflowDiagram />}

            {stage.examples && (
              <View style={styles.examplesBox}>
                {stage.examples.map((ex) => (
                  <Text key={ex} style={styles.exampleText}>{ex}</Text>
                ))}
                {stage.examplesNote && <Text style={styles.examplesNote}>{stage.examplesNote}</Text>}
              </View>
            )}

            {stage.notes && <Text style={styles.notes}>{stage.notes}</Text>}
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

export default function SaaSRoadmapScreen() {
  const insets = useSafeAreaInsets();
  const [expandedStages, setExpandedStages] = useState({ 4: true }); // AI Business Assistant open by default — the strongest differentiator

  function toggleStage(number) {
    setExpandedStages((prev) => ({ ...prev, [number]: !prev[number] }));
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxxl }]}>
      <Text style={styles.eyebrow}>Product Roadmap</Text>
      <Text style={styles.title}>Business SaaS Roadmap</Text>
      <Text style={styles.positioning}>{POSITIONING_STATEMENT}</Text>
      <Text style={styles.positioningSub}>{POSITIONING_SUBTEXT}</Text>

      <View style={[styles.card, { marginTop: spacing.xl }]}>
        <Text style={styles.subLabel}>Architecture</Text>
        <View style={{ marginTop: spacing.sm }}>
          {ARCHITECTURE_LAYERS.map((layer, i) => (
            <View key={layer} style={{ alignItems: 'center' }}>
              <View style={[styles.archLayer, i === ARCHITECTURE_LAYERS.length - 1 && styles.archLayerFinal]}>
                <Text style={[styles.archLayerText, i === ARCHITECTURE_LAYERS.length - 1 && styles.archLayerTextFinal]}>{layer}</Text>
              </View>
              {i < ARCHITECTURE_LAYERS.length - 1 && <Text style={styles.archArrow}>↓</Text>}
            </View>
          ))}
        </View>
      </View>

      <View style={{ marginTop: spacing.xl }}>
        {ROADMAP_STAGES.map((stage, i) => (
          <StageCard
            key={stage.number}
            stage={stage}
            expanded={!!expandedStages[stage.number]}
            onToggle={() => toggleStage(stage.number)}
            isLast={i === ROADMAP_STAGES.length - 1}
          />
        ))}
      </View>

      <View style={styles.visionBox}>
        <Text style={styles.visionTitle}>{VISION.title}</Text>
        {VISION.paragraphs.map((p) => (
          <Text key={p} style={styles.visionParagraph}>{p}</Text>
        ))}
        <Text style={styles.visionClosing}>{VISION.closingStatement}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl },
  eyebrow: { fontFamily: fonts.monoBold, fontSize: 10, color: colors.cyan, letterSpacing: 2, textTransform: 'uppercase' },
  title: { fontFamily: fonts.sansExtraBold, fontSize: 24, color: colors.textPrimary, marginTop: spacing.xs, letterSpacing: 0.3 },
  positioning: { fontFamily: fonts.sans, fontSize: 13, color: colors.textSecondary, marginTop: spacing.md, lineHeight: 19 },
  positioningSub: { fontFamily: fonts.sans, fontSize: 11, color: colors.textMuted, marginTop: spacing.sm, lineHeight: 16 },

  card: { ...glassCard, padding: spacing.lg },
  cardHighlight: { borderColor: 'rgba(0,242,254,0.35)' },
  subLabel: { fontFamily: fonts.monoBold, fontSize: 9, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 },

  archLayer: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, minWidth: 220, alignItems: 'center' },
  archLayerFinal: { backgroundColor: 'rgba(0,242,254,0.1)', borderColor: 'rgba(0,242,254,0.3)' },
  archLayerText: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.textSecondary, textAlign: 'center' },
  archLayerTextFinal: { color: colors.cyan, fontFamily: fonts.sansBold },
  archArrow: { fontFamily: fonts.mono, fontSize: 16, color: colors.textMuted, marginVertical: 2 },

  timelineRow: { flexDirection: 'row', gap: spacing.md },
  timelineRail: { width: 14, alignItems: 'center' },
  timelineDot: { width: 10, height: 10, borderRadius: 5, marginTop: spacing.lg },
  timelineLine: { flex: 1, width: 2, backgroundColor: colors.border, marginTop: 4, marginBottom: 4 },

  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stageNumber: { fontFamily: fonts.mono, fontSize: 12, color: colors.textMuted },
  stageTitle: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.textPrimary, flexShrink: 1 },
  description: { fontFamily: fonts.sans, fontSize: 12, color: colors.textSecondary, marginTop: spacing.sm, lineHeight: 18 },

  securityBox: { backgroundColor: 'rgba(0,242,254,0.06)', borderWidth: 1, borderColor: 'rgba(0,242,254,0.2)', borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.sm },
  securityText: { fontFamily: fonts.mono, fontSize: 11, color: colors.cyan },

  featureRow: { flexDirection: 'row', gap: spacing.xs, marginTop: 4, alignItems: 'flex-start' },
  checkmark: { color: colors.success, fontSize: 12, marginTop: 1 },
  featureText: { fontFamily: fonts.sans, fontSize: 12, color: colors.textSecondary, flex: 1 },

  groupBox: { backgroundColor: 'rgba(0,0,0,0.2)', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  groupTitle: { fontFamily: fonts.monoBold, fontSize: 9, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing.xs },
  groupItem: { fontFamily: fonts.sans, fontSize: 12, color: colors.textSecondary, marginTop: 3 },

  toolChip: { backgroundColor: 'rgba(0,242,254,0.1)', borderWidth: 1, borderColor: 'rgba(0,242,254,0.25)', borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  toolChipText: { fontFamily: fonts.mono, fontSize: 10, color: colors.cyan },

  examplesBox: { marginTop: spacing.md, backgroundColor: 'rgba(0,0,0,0.2)', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  exampleText: { fontFamily: fonts.sans, fontSize: 12, color: colors.textMuted, fontStyle: 'italic', marginTop: 3 },
  examplesNote: { fontFamily: fonts.sans, fontSize: 10, color: colors.textMuted, marginTop: spacing.sm },

  notes: { fontFamily: fonts.sans, fontSize: 11, color: colors.textMuted, fontStyle: 'italic', marginTop: spacing.md, lineHeight: 16 },

  visionBox: { marginTop: spacing.xxxl, paddingTop: spacing.xxl, borderTopWidth: 1, borderTopColor: colors.border, alignItems: 'center' },
  visionTitle: { fontFamily: fonts.sansExtraBold, fontSize: 18, color: colors.textPrimary, textAlign: 'center' },
  visionParagraph: { fontFamily: fonts.sans, fontSize: 12, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm, lineHeight: 18, paddingHorizontal: spacing.md },
  visionClosing: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.cyan, textAlign: 'center', marginTop: spacing.lg },
});
