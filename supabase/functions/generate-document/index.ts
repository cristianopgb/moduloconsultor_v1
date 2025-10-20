// supabase/functions/generate-document/index.ts
// SIMPLIFICADO: Agora apenas formata documentos, a remixagem é feita na chat-assistant

import { Document, Packer, Paragraph, TextRun, AlignmentType } from "npm:docx@^8.5.0";
import ExcelJS from "npm:exceljs@^4.4.0";
import PptxGenJS from "npm:pptxgenjs@^3.12.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Max-Age": "86400",
};

function toBase64FromUint8(arr: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < arr.length; i += chunk) {
    bin += String.fromCharCode.apply(null, arr.subarray(i, i + chunk) as unknown as number[]);
  }
  return btoa(bin);
}

function colorHex(c?: string, fallback = "#333333"): string {
  return (c || fallback).replace("#", "").toUpperCase();
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const type = (body.type || "html").toLowerCase();
    
    console.log("[DEBUG][GENERATE] Processando:", {
      type,
      hasRemixedHtml: !!body.remixed_html,
      hasTemplateJson: !!body.template_json,
      hasContent: !!body.content
    });

    let result: { content: string; filename: string; mimeType: string };

    if (type === "html") {
      result = await generateHTML(body);
    } else if (type === "pptx") {
      result = await generatePPTX(body);
    } else if (type === "docx") {
      result = await generateDOCX(body);
    } else if (type === "xlsx") {
      result = await generateXLSX(body);
    } else {
      throw new Error(`Tipo de documento não suportado: ${type}`);
    }

    console.log("[DEBUG][GENERATE] Documento gerado:", {
      filename: result.filename,
      size: result.content.length,
      type: result.mimeType
    });

    return new Response(JSON.stringify({ ...result, type, success: true }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("[ERROR][GENERATE] Falha na geração:", error.message);
    return new Response(
      JSON.stringify({ error: error.message || "Falha na geração", success: false }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});

// ===== HTML - SIMPLIFICADO PARA USAR HTML JÁ REMIXADO =====
async function generateHTML(body: any) {
  console.log("[DEBUG][HTML] Iniciando geração HTML");

  // Se já temos HTML remixado (vindo da chat-assistant), usar diretamente
  if (body.remixed_html && body.remixed_html.trim()) {
    console.log("[DEBUG][HTML] Usando HTML já remixado da chat-assistant");
    
    const base64 = btoa(unescape(encodeURIComponent(body.remixed_html)));
    const title = body.title || body.templateJson?.template_name || "documento";
    const safeTitle = title.replace(/[^a-zA-Z0-9]/g, "_");

    return {
      content: base64,
      filename: `${safeTitle}.html`,
      mimeType: "text/html",
    };
  }

  // Fallback: geração básica (para compatibilidade)
  console.log("[DEBUG][HTML] Fallback - geração básica");
  
  const templateJson = body.template_json || {};
  const content = body.content || body.user_request || "Documento gerado automaticamente";
  const theme = templateJson.theme || {};
  const title = templateJson.template_name || body.title || "Documento";

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    body {
      font-family: ${theme.font_family || "Inter, system-ui, sans-serif"};
      color: ${theme.text_color || "#1f2937"};
      max-width: 900px;
      margin: 40px auto;
      line-height: 1.6;
      padding: 20px;
    }
    h1 { 
      color: ${theme.primary_color || "#2563eb"}; 
      margin-bottom: 20px; 
      text-align: center;
    }
    .content { 
      background: white; 
      padding: 30px; 
      border-radius: 8px; 
      box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
    }
    .footer { 
      text-align: center; 
      color: #666; 
      font-size: 0.9em; 
      margin-top: 40px; 
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="content">
    <p>${escapeHtml(String(content))}</p>
  </div>
  <div class="footer">
    <p>Gerado em ${new Date().toLocaleDateString("pt-BR")}</p>
  </div>
</body>
</html>`;

  const base64 = btoa(unescape(encodeURIComponent(html)));
  const safeTitle = title.replace(/[^a-zA-Z0-9]/g, "_");

  return {
    content: base64,
    filename: `${safeTitle}.html`,
    mimeType: "text/html",
  };
}

// ===== PPTX =====
async function generatePPTX(body: any) {
  const templateJson = body.template_json || {};
  const content = body.content || body.user_request || "";
  const theme = templateJson.theme || {};
  
  const pptx = new PptxGenJS();
  
  if (theme.font_family) {
    pptx.theme = {
      headFontFace: theme.font_family,
      bodyFontFace: theme.font_family,
    };
  }

  const slide = pptx.addSlide();
  
  // Background
  if (theme.background_color) {
    slide.background = { color: colorHex(theme.background_color) };
  }

  // Título
  const title = templateJson.template_name || "Apresentação";
  slide.addText(title, {
    x: 1, y: 1, w: 8, h: 1.5,
    fontSize: theme.title_font_size || 32,
    bold: true,
    color: colorHex(theme.primary_color || "#054C45"),
    align: "center",
  });

  // Conteúdo
  slide.addText(String(content), {
    x: 1, y: 3, w: 8, h: 4,
    fontSize: theme.body_font_size || 18,
    color: colorHex(theme.text_color || "#333333"),
    align: "left",
  });

  const buffer = await pptx.write("nodebuffer");
  const base64 = toBase64FromUint8(new Uint8Array(buffer));
  const safeTitle = title.replace(/[^a-zA-Z0-9]/g, "_");

  return {
    content: base64,
    filename: `${safeTitle}.pptx`,
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  };
}

// ===== DOCX =====
async function generateDOCX(body: any) {
  const templateJson = body.template_json || {};
  const content = body.content || body.user_request || "";
  const theme = templateJson.theme || {};
  const title = templateJson.template_name || "Documento";

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: title,
                bold: true,
                size: 32,
                color: colorHex(theme.primary_color || "#0066CC"),
              }),
            ],
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({ children: [new TextRun("")] }),
          new Paragraph({
            children: [
              new TextRun({
                text: String(content),
                size: 24,
              }),
            ],
          }),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const base64 = toBase64FromUint8(new Uint8Array(buffer));
  const safeTitle = title.replace(/[^a-zA-Z0-9]/g, "_");

  return {
    content: base64,
    filename: `${safeTitle}.docx`,
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };
}

// ===== XLSX =====
async function generateXLSX(body: any) {
  const templateJson = body.template_json || {};
  const content = body.content || body.user_request || "";
  const title = templateJson.template_name || "Planilha";

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Dados");

  worksheet.addRow([title]);
  worksheet.getRow(1).font = { bold: true, size: 16 };
  worksheet.addRow([]);
  worksheet.addRow([String(content)]);

  worksheet.columns.forEach((column: any) => (column.width = 30));

  const buffer = await workbook.xlsx.writeBuffer();
  const base64 = toBase64FromUint8(new Uint8Array(buffer));
  const safeTitle = title.replace(/[^a-zA-Z0-9]/g, "_");

  return {
    content: base64,
    filename: `${safeTitle}.xlsx`,
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
}