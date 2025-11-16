/**
 * VISUALIZATION ADAPTER
 * Converts visualization-engine.ts output to VizSpec[] contract
 */

import type { VizSpec, VizConfig } from '../_shared/analytics-contracts.ts';
import type { ChartConfig } from './visualization-engine.ts';
import { v4 as uuidv4 } from 'https://esm.sh/uuid@9.0.0';

/**
 * Convert ChartConfig to VizSpec contract
 */
export function toVizSpec(
  chart: ChartConfig,
  exec_id: string,
  position: number
): VizSpec {
  const config: VizConfig = mapChartConfigToVizConfig(chart);

  return {
    viz_id: uuidv4(),
    exec_id_ref: exec_id,
    type: chart.type,
    title: chart.title,
    description: chart.description,
    data: chart.data,
    config,
    insights: chart.insights,
    position_in_report: position,
    created_at: new Date().toISOString(),
  };
}

/**
 * Convert array of ChartConfigs to VizSpec[] array
 */
export function toVizSpecArray(
  charts: ChartConfig[],
  exec_id: string
): VizSpec[] {
  return charts.map((chart, index) => toVizSpec(chart, exec_id, index + 1));
}

/**
 * Map legacy ChartConfig.config to new VizConfig
 */
function mapChartConfigToVizConfig(chart: ChartConfig): VizConfig {
  const legacyConfig = chart.config || {};

  const vizConfig: VizConfig = {};

  // Map common properties
  if (legacyConfig.xAxis) vizConfig.xAxis = legacyConfig.xAxis;
  if (legacyConfig.yAxis) vizConfig.yAxis = legacyConfig.yAxis;
  if (legacyConfig.series) vizConfig.series = legacyConfig.series;
  if (legacyConfig.colors) vizConfig.colors = legacyConfig.colors;
  if (legacyConfig.thresholds) vizConfig.thresholds = legacyConfig.thresholds;
  if (legacyConfig.showTrend !== undefined) vizConfig.showTrend = legacyConfig.showTrend;
  if (legacyConfig.showBenchmark !== undefined) vizConfig.showBenchmark = legacyConfig.showBenchmark;
  if (legacyConfig.horizontal !== undefined) vizConfig.horizontal = legacyConfig.horizontal;
  if (legacyConfig.stacked !== undefined) vizConfig.stacked = legacyConfig.stacked;

  // Infer format from chart type and data
  if (chart.type === 'gauge' || chart.title.toLowerCase().includes('otif')) {
    vizConfig.format = {
      yAxis: 'percentage',
      decimals: 1,
      suffix: '%',
    };
  } else if (chart.title.toLowerCase().includes('receita') || chart.title.toLowerCase().includes('custo')) {
    vizConfig.format = {
      yAxis: 'currency',
      decimals: 2,
      prefix: 'R$',
    };
  }

  return vizConfig;
}

/**
 * Create VizSpec for table display
 */
export function createTableVizSpec(
  data: any[],
  exec_id: string,
  title: string = 'Tabela de Resultados',
  position: number = 1
): VizSpec {
  return {
    viz_id: uuidv4(),
    exec_id_ref: exec_id,
    type: 'table',
    title,
    description: 'Dados tabulares da análise',
    data: data.slice(0, 100), // Limit to 100 rows for display
    config: {
      format: {
        decimals: 2,
      },
    },
    insights: [],
    position_in_report: position,
    created_at: new Date().toISOString(),
  };
}

/**
 * Extract chart types distribution
 */
export function getChartTypesDistribution(vizSpecs: VizSpec[]): Record<string, number> {
  const distribution: Record<string, number> = {};

  vizSpecs.forEach(viz => {
    distribution[viz.type] = (distribution[viz.type] || 0) + 1;
  });

  return distribution;
}

/**
 * Filter VizSpecs by type
 */
export function filterVizSpecsByType(
  vizSpecs: VizSpec[],
  type: VizSpec['type']
): VizSpec[] {
  return vizSpecs.filter(viz => viz.type === type);
}

/**
 * Sort VizSpecs by position
 */
export function sortVizSpecsByPosition(vizSpecs: VizSpec[]): VizSpec[] {
  return [...vizSpecs].sort((a, b) => a.position_in_report - b.position_in_report);
}

/**
 * Get primary visualization (first chart or most important)
 */
export function getPrimaryVisualization(vizSpecs: VizSpec[]): VizSpec | null {
  if (vizSpecs.length === 0) return null;

  // Prefer gauge or dashboard-type charts
  const gauge = vizSpecs.find(v => v.type === 'gauge');
  if (gauge) return gauge;

  // Otherwise return first by position
  const sorted = sortVizSpecsByPosition(vizSpecs);
  return sorted[0];
}

/**
 * Format VizSpec for legacy chart format (backward compatibility)
 */
export function toLegacyChartFormat(vizSpec: VizSpec): any {
  return {
    type: vizSpec.type,
    title: vizSpec.title,
    description: vizSpec.description,
    data: vizSpec.data,
    config: vizSpec.config,
    insights: vizSpec.insights,
  };
}
