// supabase/functions/generate-template/index.ts
// Gera previews (DOCX, XLSX, PPTX, HTML) a partir de template_json.
// Ajustes: PPTX com header_banner na raiz + decorations como ARRAY
// (vertical_bars, rounded_squares_cluster, diagonal_stripes_corner)
// e uso de layout.title_box/subtitle_box.

import { Document, Packer, Paragraph, TextRun, AlignmentType } from "npm:docx@^8.5.0";
import ExcelJS from "npm:exceljs@^4.4.0";
import PptxGenJS from "npm:pptxgenjs@^3.12.0";

type TemplateJson = any;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// ----------------- Helpers -----------------
function percentToInches(percent: number, totalInches: number) {
  return (percent / 100) * totalInches;
}
function toInchesX(v: unknown, totalX: number) {
  if (typeof v === "string" && v.trim().endsWith("%")) return percentToInches(parseFloat(v), totalX);
  if (typeof v === "number") return percentToInches(v, totalX); // compat com número em %
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function toInchesY(v: unknown, totalY: number) {
  if (typeof v === "string" && v.trim().endsWith("%")) return percentToInches(parseFloat(v), totalY);
  if (typeof v === "number") return percentToInches(v, totalY);
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function formatColor(color?: string) {
  if (!color) return "0066CC";
  return color.replace("#", "").toUpperCase();
}
function arrayBufferToBase64(ab: ArrayBuffer) {
  const bytes = new Uint8Array(ab);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

// ----------------- HTTP -----------------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { template_json } = await req.json();
    if (!template_json) throw new Error("template_json is required");

    const type = String(template_json.type || "pptx").toLowerCase();

    let result:
      | { content: string; filename: string; mimeType: string }
      | undefined;

    switch (type) {
      case "docx":
        result = await generateTemplateDocx(template_json);
        break;
      case "xlsx":
        result = await generateTemplateXlsx(template_json);
        break;
      case "pptx":
        result = await generateTemplatePptx(template_json);
        break;
      case "html":
        result = await generateTemplateHtml(template_json);
        break;
      default:
        result = await generateTemplatePptx(template_json);
        break;
    }

    return new Response(JSON.stringify({ ...result, type, success: true }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("[generate-template] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to generate template", success: false }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
});

// ----------------- PPTX -----------------
async function generateTemplatePptx(templateJson: TemplateJson) {
  try {
    const pptx = new PptxGenJS();

    // Tema (básico)
    const theme = templateJson.theme || {};
    // pptx.theme não é API pública para todos temas, mas fontes funcionam por slide.addText
    // Mantemos só as cores via calls abaixo.

    const SLIDE_WIDTH = 10;   // 4:3
    const SLIDE_HEIGHT = 7.5;

    const slide1 = pptx.addSlide();
    slide1.background = { color: formatColor(theme.background_color || "#FFFFFF") };

    // Header banner na RAIZ
    if (templateJson.header_banner?.type === "rectangle") {
      const b = templateJson.header_banner;
      const x = toInchesX(b.position?.x ?? "0%", SLIDE_WIDTH);
      const y = toInchesY(b.position?.y ?? "0%", SLIDE_HEIGHT);
      const w = toInchesX(b.size?.width ?? "100%", SLIDE_WIDTH);
      const h = toInchesY(b.size?.height ?? "6%", SLIDE_HEIGHT);
      const color = formatColor(b.color || theme.secondary_color || "#6DC3C1");
      slide1.addShape(pptx.ShapeType.rect, {
        x, y, w, h,
        fill: { color },
        line: { color, width: 0 },
      });
    }

    // Decorations (ARRAY)
    const decorations: any[] = Array.isArray(templateJson.decorations)
      ? templateJson.decorations
      : [];

    for (const deco of decorations) {
      switch (deco.type) {
        case "vertical_bars": {
          const count = Math.max(1, Number(deco.count ?? 3));
          const color = formatColor(deco.color || theme.primary_color || "#054C45");
          const spacingIn = deco.spacing === "tight" ? 0.12 : 0.2;
          const barW = 0.12;
          const barH = 0.9;
          const centerX =
            deco.position?.x != null ? toInchesX(deco.position.x, SLIDE_WIDTH) : SLIDE_WIDTH / 2;
          const topY =
            deco.position?.y != null ? toInchesY(deco.position.y, SLIDE_HEIGHT) : 0.3;
          const totalW = count * barW + (count - 1) * spacingIn;
          const startX = centerX - totalW / 2;

          for (let i = 0; i < count; i++) {
            slide1.addShape(pptx.ShapeType.rect, {
              x: startX + i * (barW + spacingIn),
              y: topY,
              w: barW,
              h: barH,
              fill: { color },
              line: { color, width: 0 },
            });
          }
          break;
        }
        case "rounded_squares_cluster": {
          const colors = deco.colors || [
            theme.secondary_color || "#6DC3C1",
            theme.primary_color || "#054C45",
          ];
          const outline = formatColor(deco.outline_color || theme.secondary_color || "#6DC3C1");
          const side = 0.8;
          const gap = 0.18;
          const isBL = deco.position === "bottom_left";
          const isTR = deco.position === "top_right";
          const startX = isBL ? 0.4 : isTR ? SLIDE_WIDTH - (side * 2 + gap + 0.6) : 0.4;
          const startY = isBL ? SLIDE_HEIGHT - (side * 2 + gap + 0.6) : isTR ? 0.6 : 0.6;

          let k = 0;
          for (let r = 0; r < 2; r++) {
            for (let c = 0; c < 2; c++) {
              const x = startX + c * (side + gap);
              const y = startY + r * (side + gap);
              const color = formatColor(colors[k % colors.length]);

              slide1.addShape(pptx.ShapeType.roundRect, {
                x, y, w: side, h: side,
                rectRadius: 0.2,
                fill: { color },
                line: { color: outline, width: 1 },
              });
              k++;
            }
          }
          break;
        }
        case "diagonal_stripes_corner": {
          const colors = deco.colors || [
            theme.secondary_color || "#6DC3C1",
            "#5BA5AD",
            theme.primary_color || "#054C45",
          ];
          const stripeW = 2.2;
          const stripeH = 0.25;
          const baseX = SLIDE_WIDTH - 3.3;
          const baseY = SLIDE_HEIGHT - 1.4;

          colors.forEach((c: string, i: number) => {
            const color = formatColor(c);
            slide1.addShape(pptx.ShapeType.rect, {
              x: baseX + i * 0.25,
              y: baseY + i * 0.25,
              w: stripeW,
              h: stripeH,
              rotate: -30,
              fill: { color },
              line: { color, width: 0 },
            });
          });
          break;
        }
        default:
          break;
      }
    }

    // Ícone opcional
    if (templateJson.icon?.type === "crest_style_logo") {
      const x = toInchesX(templateJson.icon.position?.x ?? "3%", SLIDE_WIDTH);
      const y = toInchesY(templateJson.icon.position?.y ?? "5%", SLIDE_HEIGHT);
      const primary = formatColor(theme.primary_color || "#054C45");
      slide1.addShape(pptx.ShapeType.triangle, {
        x, y, w: 0.5, h: 0.5,
        fill: { color: primary },
        line: { color: primary, width: 0 },
      });
      slide1.addShape(pptx.ShapeType.rect, {
        x: x + 0.15, y: y + 0.22, w: 0.2, h: 0.2,
        fill: { color: "FFFFFF" },
        line: { color: "FFFFFF", width: 0 },
      });
    }

    // Título/Subtítulo
    const titleSlide = templateJson.structure?.slides?.[0] || {};
    const title = titleSlide.title || templateJson.template_name || "Title";
    const subtitle = titleSlide.subtitle || templateJson.description || "";

    const tBox = templateJson.layout?.title_box ?? {
      position: { x: "10%", y: "40%" },
      size: { width: "80%", height: "20%" },
    };
    const sBox = templateJson.layout?.subtitle_box ?? {
      position: { x: "10%", y: "63%" },
      size: { width: "80%", height: "10%" },
    };

    // Título
    slide1.addText(title, {
      x: toInchesX(tBox.position.x, SLIDE_WIDTH),
      y: toInchesY(tBox.position.y, SLIDE_HEIGHT),
      w: toInchesX(tBox.size.width, SLIDE_WIDTH),
      h: toInchesY(tBox.size.height, SLIDE_HEIGHT),
      fontSize: Number(theme.title_font_size ?? 60),
      bold: true,
      color: formatColor(theme.primary_color || "#054C45"),
      align: "center",
      fontFace: theme.font_family || "Georgia",
    });

    // Subtítulo
    slide1.addText(subtitle, {
      x: toInchesX(sBox.position.x, SLIDE_WIDTH),
      y: toInchesY(sBox.position.y, SLIDE_HEIGHT),
      w: toInchesX(sBox.size.width, SLIDE_WIDTH),
      h: toInchesY(sBox.size.height, SLIDE_HEIGHT),
      fontSize: Number(theme.body_font_size ?? 24),
      color: formatColor(theme.primary_color || "#054C45"),
      align: "center",
      fontFace: theme.font_family || "Georgia",
    });

    // Saída: usar 'arraybuffer' no Edge
    const ab = (await pptx.write("arraybuffer")) as ArrayBuffer;
    const base64 = arrayBufferToBase64(ab);
    const filenameBase = String(templateJson.template_name || "template").replace(/[^a-zA-Z0-9]/g, "_");

    return {
      content: base64,
      filename: `${filenameBase}_template.pptx`,
      mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    };
  } catch (error: any) {
    console.error("Error generating template PPTX:", error);
    throw new Error(`Failed to generate template PPTX: ${error.message}`);
  }
}

// ----------------- DOCX -----------------
async function generateTemplateDocx(templateJson: TemplateJson) {
  try {
    const theme = templateJson.theme || {};
    const structure = templateJson.structure || {};
    const title = templateJson.template_name || "Template Preview";

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: title,
                  bold: true,
                  size: 64 / 2,
                  color: formatColor(theme.primary_color || "#0066CC"),
                }),
              ],
            }),
            new Paragraph({ children: [new TextRun("")] }),
            new Paragraph({
              children: [
                new TextRun({
                  text: templateJson.description || "Este é um template de exemplo gerado automaticamente.",
                  size: 48 / 2,
                }),
              ],
            }),
          ],
        },
      ],
    });

    if (structure.sections) {
      structure.sections.forEach((section: any) => {
        doc.addSection({
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: section.title || "Seção", bold: true, size: 56 / 2 }),
              ],
            }),
            new Paragraph({
              children: [new TextRun({ text: section.placeholder || "Conteúdo da seção...", size: 44 / 2 })],
            }),
          ],
        });
      });
    }

    // Preferir toBlob no Deno Edge
    const blob = await Packer.toBlob(doc);
    const ab = await blob.arrayBuffer();
    const base64 = arrayBufferToBase64(ab);
    const filenameBase = String(title || "template").replace(/[^a-zA-Z0-9]/g, "_");

    return {
      content: base64,
      filename: `${filenameBase}_template.docx`,
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
  } catch (error: any) {
    console.error("Error generating template DOCX:", error);
    throw new Error(`Failed to generate template DOCX: ${error.message}`);
  }
}

// ----------------- XLSX -----------------
async function generateTemplateXlsx(templateJson: TemplateJson) {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Template");
    const title = templateJson.template_name || "Template Preview";

    worksheet.addRow([title]);
    worksheet.getRow(1).font = { bold: true, size: 16 };
    worksheet.addRow([]);
    worksheet.addRow([templateJson.description || "Template de exemplo"]);
    worksheet.addRow([]);

    if (templateJson.structure?.sections) {
      templateJson.structure.sections.forEach((section: any, index: number) => {
        worksheet.addRow([`Seção ${index + 1}: ${section.title || "Título"}`]);
        worksheet.addRow([section.placeholder || "Conteúdo..."]);
        worksheet.addRow([]);
      });
    }

    worksheet.columns.forEach((c: any) => (c.width = 24));

    const ab = (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
    const base64 = arrayBufferToBase64(ab);
    const filenameBase = String(title || "template").replace(/[^a-zA-Z0-9]/g, "_");

    return {
      content: base64,
      filename: `${filenameBase}_template.xlsx`,
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
  } catch (error: any) {
    console.error("Error generating template XLSX:", error);
    throw new Error(`Failed to generate template XLSX: ${error.message}`);
  }
}

// ----------------- HTML -----------------
async function generateTemplateHtml(templateJson: TemplateJson) {
  try {
    const theme = templateJson.theme || {};
    const structure = templateJson.structure || {};
    const decorations: any[] = Array.isArray(templateJson.decorations)
      ? templateJson.decorations
      : [];
    const title = templateJson.template_name || "Template Preview";

    const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    body {
      font-family: ${theme.font_family || "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"};
      line-height: 1.6;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
      background-color: ${theme.background_color || "#f8f9fa"};
      color: ${theme.text_color || "#333"};
      position: relative;
    }
    .header { text-align: center; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 3px solid ${theme.primary_color || "#007bff"}; position: relative; }
    .header h1 { color: ${theme.primary_color || "#007bff"}; font-size: 2.5em; margin: 0; font-weight: 300; }
    .content { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); margin-bottom: 30px; position: relative; }
    .section { margin-bottom: 30px; padding: 20px; border-left: 4px solid ${theme.accent_color || "#e9ecef"}; background-color: ${theme.section_background || "#f8f9fa"}; }
    .section h2 { color: ${theme.secondary_color || "#495057"}; margin-top: 0; }
    .footer { text-align: center; color: #666; font-size: 0.9em; margin-top: 40px; }

    .header-banner { position: absolute; top: 0; left: 0; right: 0; height: ${templateJson.header_banner?.size?.height || "15%"}; background-color: ${templateJson.header_banner?.color || theme.primary_color || "#007bff"}; z-index: -1; }
    .vertical-bars { position: absolute; left: 10%; top: 20%; width: 50%; height: 60%; display: flex; gap: 10px; z-index: -1; }
    .vertical-bar { flex: 1; background-color: ${theme.secondary_color || "#4A90E2"}; opacity: 0.3; }
    .rounded-squares { position: absolute; right: 5%; top: 20%; width: 30%; height: 40%; display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; z-index: -1; }
    .rounded-square { background-color: ${theme.accent_color || "#7B68EE"}; border-radius: 8px; opacity: 0.2; }
    .diagonal-stripes { position: absolute; top: 0; right: 0; width: 25%; height: 25%; background: repeating-linear-gradient(45deg, ${theme.accent_color || "#FFD700"}, ${theme.accent_color || "#FFD700"} 10px, transparent 10px, transparent 20px); opacity: 0.3; z-index: -1; }
  </style>
</head>
<body>
  ${templateJson.header_banner ? '<div class="header-banner"></div>' : ''}

  ${
    decorations.find((d) => d.type === 'vertical_bars')
      ? `<div class="vertical-bars">${
          Array.from({ length: decorations.find((d) => d.type === 'vertical_bars')?.count || 3 })
            .map(() => '<div class="vertical-bar"></div>')
            .join('')
        }</div>`
      : ''
  }

  ${decorations.find((d) => d.type === 'rounded_squares_cluster') ? `
      <div class="rounded-squares">
        ${Array.from({ length: 6 }).map(() => '<div class="rounded-square"></div>').join('')}
      </div>` : ''}

  ${decorations.find((d) => d.type === 'diagonal_stripes_corner') ? `<div class="diagonal-stripes"></div>` : ''}

  <div class="header">
    <h1>${title}</h1>
    ${templateJson.description ? `<p style="color:${theme.text_color || "#666"}; font-size: 1.1em;">${templateJson.description}</p>` : ""}
  </div>

  <div class="content">
    ${
      structure.sections
        ? structure.sections
            .map(
              (section: any) => `
      <div class="section">
        <h2>${section.title || "Título da Seção"}</h2>
        <p>${section.placeholder || "Conteúdo da seção será inserido aqui..."}</p>
        ${
          section.variables
            ? `<div style="margin-top: 15px; padding: 10px; background: #e3f2fd; border-radius: 4px;">
                 <strong>Variáveis disponíveis:</strong> ${section.variables.map((v: string) => `{{${v}}}`).join(", ")}
               </div>`
            : ""
        }
      </div>`,
            )
            .join("")
        : "<p>Template básico sem seções definidas.</p>"
    }
  </div>

  <div class="footer">
    <p>Template gerado pelo proceda.ia em ${new Date().toLocaleDateString("pt-BR")}</p>
    <p style="font-size: 0.8em; color: #999;">Este é um preview do template. O conteúdo real será inserido durante a geração.</p>
  </div>
</body>
</html>`.trim();

    const base64 = btoa(unescape(encodeURIComponent(htmlContent)));
    const filenameBase = String(title || "template").replace(/[^a-zA-Z0-9]/g, "_");

    return {
      content: base64,
      filename: `${filenameBase}_preview.html`,
      mimeType: "text/html",
    };
  } catch (error: any) {
    console.error("Error generating template HTML:", error);
    throw new Error(`Failed to generate template: ${error.message}`);
  }
}
