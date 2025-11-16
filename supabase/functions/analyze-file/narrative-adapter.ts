/**
 * NARRATIVE ADAPTER
 * Converts narrative-engine.ts output to NarrativeDoc contract
 */

import type { NarrativeDoc, NarrativeSection, NarrativeMetadata } from '../_shared/analytics-contracts.ts';
import type { EnhancedNarrative } from './narrative-engine.ts';
import { v4 as uuidv4 } from 'https://esm.sh/uuid@9.0.0';

/**
 * Convert EnhancedNarrative to NarrativeDoc contract
 */
export function toNarrativeDoc(
  narrative: EnhancedNarrative,
  exec_ids: string[],
  domain: 'logistics' | 'sales' | 'hr' | 'financial' | 'generic',
  qualityScore: number
): NarrativeDoc {
  const sections: NarrativeSection[] = [];
  let order = 0;

  // Introduction section
  sections.push({
    section_id: uuidv4(),
    type: 'introduction',
    title: 'Introdução',
    content: narrative.introduction,
    order: order++,
  });

  // Situation Overview
  sections.push({
    section_id: uuidv4(),
    type: 'situation_overview',
    title: 'Visão Geral da Situação',
    content: narrative.situationOverview,
    exec_ids_ref: exec_ids,
    order: order++,
  });

  // Key Findings
  if (narrative.keyFindings.length > 0) {
    const findingsContent = narrative.keyFindings.map((finding, idx) => {
      const emoji = finding.severity === 'critical' ? '🔴' :
                    finding.severity === 'important' ? '🟡' :
                    finding.severity === 'positive' ? '🟢' : '🔵';
      return `${emoji} **${finding.title}**\n${finding.description}\n*Impacto: ${finding.impact}*`;
    }).join('\n\n');

    sections.push({
      section_id: uuidv4(),
      type: 'key_findings',
      title: 'Principais Descobertas',
      content: findingsContent,
      exec_ids_ref: exec_ids,
      order: order++,
    });
  }

  // Deep Dive Investigation
  if (narrative.deepDiveInvestigation.length > 0) {
    const investigationContent = narrative.deepDiveInvestigation.map(inv => {
      return `**${inv.question}**\n${inv.conclusion}`;
    }).join('\n\n');

    sections.push({
      section_id: uuidv4(),
      type: 'investigation',
      title: 'Investigação Detalhada',
      content: investigationContent,
      exec_ids_ref: exec_ids,
      order: order++,
    });
  }

  // Diagnosis
  if (narrative.diagnosis.rootCauses.length > 0 || narrative.diagnosis.opportunities.length > 0) {
    let diagnosisContent = '';

    if (narrative.diagnosis.rootCauses.length > 0) {
      diagnosisContent += '**Causas Identificadas:**\n';
      diagnosisContent += narrative.diagnosis.rootCauses.map(cause => `- ${cause}`).join('\n');
      diagnosisContent += '\n\n';
    }

    if (narrative.diagnosis.opportunities.length > 0) {
      diagnosisContent += '**Oportunidades:**\n';
      diagnosisContent += narrative.diagnosis.opportunities.map(opp => `- ${opp}`).join('\n');
    }

    sections.push({
      section_id: uuidv4(),
      type: 'diagnosis',
      title: 'Diagnóstico',
      content: diagnosisContent.trim(),
      order: order++,
    });
  }

  // Recommendations
  if (narrative.recommendations.length > 0) {
    const grouped = {
      immediate: narrative.recommendations.filter(r => r.priority === 'immediate'),
      'short-term': narrative.recommendations.filter(r => r.priority === 'short-term'),
      'medium-term': narrative.recommendations.filter(r => r.priority === 'medium-term'),
      'long-term': narrative.recommendations.filter(r => r.priority === 'long-term')
    };

    let recsContent = '';

    if (grouped.immediate.length > 0) {
      recsContent += '### ⚡ Ações Imediatas\n';
      grouped.immediate.forEach(rec => {
        recsContent += `**${rec.title}**\n${rec.description}\n*Impacto esperado: ${rec.expectedImpact}*\n\n`;
      });
    }

    if (grouped['short-term'].length > 0) {
      recsContent += '### 📅 Curto Prazo\n';
      grouped['short-term'].forEach(rec => {
        recsContent += `**${rec.title}**\n${rec.description}\n*Impacto esperado: ${rec.expectedImpact}*\n\n`;
      });
    }

    if (grouped['medium-term'].length > 0 || grouped['long-term'].length > 0) {
      recsContent += '### 🔮 Médio/Longo Prazo\n';
      [...grouped['medium-term'], ...grouped['long-term']].forEach(rec => {
        recsContent += `**${rec.title}**\n${rec.description}\n*Impacto esperado: ${rec.expectedImpact}*\n\n`;
      });
    }

    sections.push({
      section_id: uuidv4(),
      type: 'recommendations',
      title: 'Recomendações',
      content: recsContent.trim(),
      order: order++,
    });
  }

  // Conclusion
  sections.push({
    section_id: uuidv4(),
    type: 'conclusion',
    title: 'Conclusão',
    content: narrative.conclusion,
    order: order++,
  });

  // Next Steps
  if (narrative.nextSteps.length > 0) {
    const nextStepsContent = narrative.nextSteps.map(step => step).join('\n');

    sections.push({
      section_id: uuidv4(),
      type: 'next_steps',
      title: 'Próximos Passos',
      content: nextStepsContent,
      order: order++,
    });
  }

  // Calculate confidence level
  const confidenceLevel = qualityScore >= 85 ? 'high' : qualityScore >= 70 ? 'medium' : 'low';

  // Extract limitations
  const limitations: string[] = [];
  if (qualityScore < 85) {
    limitations.push(`Qualidade dos dados: ${qualityScore}/100 - resultados devem ser interpretados com cautela`);
  }
  if (narrative.diagnosis.risks.length > 0) {
    limitations.push(...narrative.diagnosis.risks);
  }

  const metadata: NarrativeMetadata = {
    domain,
    quality_score: qualityScore,
    confidence_level: confidenceLevel,
    limitations,
  };

  return {
    doc_id: uuidv4(),
    sections,
    exec_ids_used: exec_ids,
    metadata,
    created_at: new Date().toISOString(),
  };
}

/**
 * Format NarrativeDoc for display (backward compatibility)
 */
export function formatNarrativeDocForDisplay(doc: NarrativeDoc): string {
  let output = '';

  for (const section of doc.sections.sort((a, b) => a.order - b.order)) {
    output += `## ${section.title}\n\n`;
    output += section.content + '\n\n';
  }

  return output.trim();
}

/**
 * Extract executive summary from NarrativeDoc
 */
export function extractExecutiveSummary(doc: NarrativeDoc): string {
  const introSection = doc.sections.find(s => s.type === 'introduction');
  const situationSection = doc.sections.find(s => s.type === 'situation_overview');

  let summary = '';
  if (introSection) {
    summary += introSection.content + '\n\n';
  }
  if (situationSection) {
    summary += situationSection.content;
  }

  return summary.trim();
}
