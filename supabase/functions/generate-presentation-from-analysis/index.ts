// supabase/functions/generate-presentation-from-analysis/index.ts
// Generates HTML presentation from analysis results
// Uses default template or user-specified template

import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  global: { fetch },
  auth: { persistSession: false },
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
};

interface ChartConfig {
  type: string;
  title: string;
  data: {
    labels: string[];
    datasets: Array<{
      label: string;
      data: number[];
      backgroundColor?: string[];
      borderColor?: string;
    }>;
  };
}

async function getDefaultAnalysisTemplate(): Promise<any> {
  const { data, error } = await supabase
    .from("models")
    .select("*")
    .eq("category", "data_analysis")
    .eq("is_system_template", true)
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    throw new Error("Default analysis template not found. Please run migrations.");
  }

  return data;
}

function generateInsightsHTML(insights: any[]): string {
  if (!insights || insights.length === 0) {
    return '<div class="insight-card"><h3>Sem insights</h3><p>Nenhum insight foi identificado nesta análise.</p></div>';
  }

  return insights
    .map((insight) => {
      const confidence = insight.confidence || 0;
      const confidenceClass =
        confidence >= 80 ? "confidence-high" : confidence >= 60 ? "confidence-medium" : "confidence-low";

      return `
        <div class="insight-card">
          <h3>${insight.title || "Insight"}</h3>
          <p>${insight.description || ""}</p>
          <span class="confidence-badge ${confidenceClass}">Confiança: ${confidence}%</span>
        </div>
      `;
    })
    .join("\n");
}

function generateMetricsHTML(calculations: any[]): string {
  if (!calculations || calculations.length === 0) {
    return '<div class="metric-card"><div class="metric-label">Sem métricas</div><div class="metric-value">-</div></div>';
  }

  return calculations
    .map((calc) => {
      return `
        <div class="metric-card">
          <div class="metric-label">${calc.metric || "Métrica"}</div>
          <div class="metric-value">${calc.value}</div>
          ${calc.interpretation ? `<div class="metric-interpretation">${calc.interpretation}</div>` : ""}
        </div>
      `;
    })
    .join("\n");
}

async function generateChartImages(charts: ChartConfig[]): Promise<string> {
  if (!charts || charts.length === 0) {
    return '<div class="chart-wrapper"><p style="text-align: center; color: #6b7280;">Nenhum gráfico disponível para esta análise.</p></div>';
  }

  // For now, return placeholder text
  // In production, you would convert charts to images using Chart.js server-side or embed interactive charts
  return charts
    .map((chart) => {
      return `
        <div class="chart-wrapper">
          <div class="chart-title">${chart.title || "Gráfico"}</div>
          <div style="background: #f3f4f6; padding: 80px 40px; text-align: center; border-radius: 8px; color: #6b7280;">
            <p style="font-size: 1.1rem; margin-bottom: 12px;">📊 ${chart.type.toUpperCase()}</p>
            <p style="font-size: 0.9rem;">Dados: ${chart.data.labels.length} pontos</p>
            <p style="font-size: 0.85rem; margin-top: 8px; font-style: italic;">
              Gráfico interativo disponível no chat. Export de imagens em desenvolvimento.
            </p>
          </div>
        </div>
      `;
    })
    .join("\n");
}

function generateRecommendationsHTML(recommendations: string[]): string {
  if (!recommendations || recommendations.length === 0) {
    return "<li>Nenhuma recomendação específica para esta análise.</li>";
  }

  return recommendations.map((rec) => `<li>${rec}</li>`).join("\n");
}

function fillTemplate(templateHTML: string, data: Record<string, string>): string {
  let result = templateHTML;

  for (const [key, value] of Object.entries(data)) {
    const placeholder = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g");
    result = result.replace(placeholder, value || "");
  }

  // Remove any remaining unfilled placeholders
  result = result.replace(/\{\{\s*[\w.-]+\s*\}\}/g, "");

  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    console.log(`[generate-presentation] ${req.method} ${req.url}`);

    // Authentication
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      throw new Error("Authorization token required");
    }

    const token = authHeader.split(" ")[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error("User not authenticated");
    }

    const body = await req.json();
    const { analysis_id, template_id, conversation_id } = body;

    if (!analysis_id) {
      throw new Error("analysis_id is required");
    }

    console.log(`[generate-presentation] Analysis ID: ${analysis_id}`);
    console.log(`[generate-presentation] User: ${user.id}`);

    // Fetch analysis from data_analyses table
    const { data: analysis, error: analysisError } = await supabase
      .from("data_analyses")
      .select("*")
      .eq("id", analysis_id)
      .eq("user_id", user.id)
      .single();

    if (analysisError || !analysis) {
      throw new Error("Analysis not found or access denied");
    }

    console.log(`[generate-presentation] Analysis found`);

    // Get template (use default if not specified)
    let template;
    if (template_id) {
      const { data: customTemplate, error: templateError } = await supabase
        .from("models")
        .select("*")
        .eq("id", template_id)
        .single();

      if (templateError) {
        console.warn(`[generate-presentation] Custom template not found, using default`);
        template = await getDefaultAnalysisTemplate();
      } else {
        template = customTemplate;
      }
    } else {
      template = await getDefaultAnalysisTemplate();
    }

    console.log(`[generate-presentation] Using template: ${template.name}`);

    // Extract analysis data from new data_analyses structure
    const interpretation = analysis.interpretation || {};
    const insights = interpretation.insights || [];
    const metrics = interpretation.metrics || [];
    const charts = interpretation.charts || [];
    const recommendations = interpretation.recommendations || [];
    const summary = interpretation.summary || "Sem resumo disponível";

    // Generate HTML components
    const insightsHTML = generateInsightsHTML(insights);
    const metricsHTML = generateMetricsHTML(metrics);
    const chartsHTML = await generateChartImages(charts);
    const recommendationsHTML = generateRecommendationsHTML(recommendations);

    // Prepare template data
    const datasetInfo = analysis.file_metadata || {};
    const datasetName = datasetInfo.filename || "Dataset";
    const qualityScore = `${analysis.full_dataset_rows || 0} linhas analisadas`;

    const templateData = {
      titulo_analise: analysis.user_question || "Análise de Dados",
      periodo_analise: "Completo",
      dataset_nome: datasetName,
      insights_principais: insightsHTML,
      calculos_chave: metricsHTML,
      graficos: chartsHTML,
      recomendacoes: recommendationsHTML,
      qualidade_dados: qualityScore,
      data_geracao: new Date().toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }),
      resumo_executivo: summary,
    };

    // Fill template
    const baseHTML = template.content_html || template.template_content || "";
    const finalHTML = fillTemplate(baseHTML, templateData);

    console.log(`[generate-presentation] Presentation generated successfully`);

    return new Response(
      JSON.stringify({
        success: true,
        html: finalHTML,
        template_name: template.name,
        analysis_id: analysis_id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error(`[generate-presentation] ERROR:`, error.message);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Internal error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
