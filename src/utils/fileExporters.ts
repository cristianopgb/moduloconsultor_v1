import { saveAs } from 'file-saver';
import { Document, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import PptxGenJS from 'pptxgenjs';

export interface ExportOptions {
  content: string;
  fileName: string;
  mimeType: string;
}

export async function exportToWord(markdown: string, fileName: string): Promise<void> {
  try {
    const lines = markdown.split('\n');
    const paragraphs: Paragraph[] = [];

    for (const line of lines) {
      if (!line.trim()) {
        paragraphs.push(new Paragraph({ text: '' }));
        continue;
      }

      if (line.startsWith('# ')) {
        paragraphs.push(
          new Paragraph({
            text: line.replace('# ', ''),
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 240, after: 120 }
          })
        );
      } else if (line.startsWith('## ')) {
        paragraphs.push(
          new Paragraph({
            text: line.replace('## ', ''),
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 100 }
          })
        );
      } else if (line.startsWith('### ')) {
        paragraphs.push(
          new Paragraph({
            text: line.replace('### ', ''),
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 160, after: 80 }
          })
        );
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        paragraphs.push(
          new Paragraph({
            text: line.replace(/^[*-]\s/, ''),
            bullet: { level: 0 },
            spacing: { before: 60, after: 60 }
          })
        );
      } else if (line.match(/^\d+\.\s/)) {
        paragraphs.push(
          new Paragraph({
            text: line.replace(/^\d+\.\s/, ''),
            numbering: { reference: 'default-numbering', level: 0 },
            spacing: { before: 60, after: 60 }
          })
        );
      } else {
        const runs: TextRun[] = [];
        const parts = line.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/);

        for (const part of parts) {
          if (part.startsWith('**') && part.endsWith('**')) {
            runs.push(new TextRun({ text: part.slice(2, -2), bold: true }));
          } else if (part.startsWith('*') && part.endsWith('*')) {
            runs.push(new TextRun({ text: part.slice(1, -1), italics: true }));
          } else if (part.startsWith('`') && part.endsWith('`')) {
            runs.push(new TextRun({ text: part.slice(1, -1), font: 'Courier New' }));
          } else {
            runs.push(new TextRun({ text: part }));
          }
        }

        paragraphs.push(
          new Paragraph({
            children: runs,
            spacing: { before: 80, after: 80 }
          })
        );
      }
    }

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: paragraphs
        }
      ]
    });

    const blob = await doc.toBlob();
    saveAs(blob, fileName.replace(/\.[^.]+$/, '.docx'));
  } catch (error) {
    console.error('Error exporting to Word:', error);
    throw new Error('Falha ao exportar para Word');
  }
}

export async function exportToPowerPoint(markdown: string, fileName: string): Promise<void> {
  try {
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_16x9';
    pptx.author = 'Manus AI Assistant';

    const slides = markdown.split(/(?=^# )/m);

    for (const slideContent of slides) {
      if (!slideContent.trim()) continue;

      const slide = pptx.addSlide();
      const lines = slideContent.split('\n');
      let title = '';
      const bulletPoints: string[] = [];
      let currentY = 1.5;

      for (const line of lines) {
        if (line.startsWith('# ')) {
          title = line.replace('# ', '');
        } else if (line.startsWith('## ')) {
          if (!title) title = line.replace('## ', '');
        } else if (line.startsWith('- ') || line.startsWith('* ')) {
          bulletPoints.push(line.replace(/^[*-]\s/, ''));
        } else if (line.trim() && !line.startsWith('#')) {
          bulletPoints.push(line.trim());
        }
      }

      if (title) {
        slide.addText(title, {
          x: 0.5,
          y: 0.5,
          w: '90%',
          h: 1,
          fontSize: 32,
          bold: true,
          color: '363636'
        });
      }

      if (bulletPoints.length > 0) {
        slide.addText(bulletPoints.map(bp => ({ text: bp, options: { bullet: true } })), {
          x: 0.5,
          y: currentY,
          w: '90%',
          h: 4,
          fontSize: 18,
          color: '363636'
        });
      }
    }

    if (pptx.slides.length === 0) {
      const slide = pptx.addSlide();
      slide.addText('Documento Exportado', {
        x: 0.5,
        y: 0.5,
        w: '90%',
        fontSize: 32,
        bold: true
      });
      slide.addText(markdown, {
        x: 0.5,
        y: 1.5,
        w: '90%',
        h: 4,
        fontSize: 16
      });
    }

    await pptx.writeFile({ fileName: fileName.replace(/\.[^.]+$/, '.pptx') });
  } catch (error) {
    console.error('Error exporting to PowerPoint:', error);
    throw new Error('Falha ao exportar para PowerPoint');
  }
}

export function openInNewTab(url: string, fileName: string): void {
  const newWindow = window.open(url, '_blank');
  if (!newWindow) {
    throw new Error('Popup bloqueado. Por favor, permita popups para este site.');
  }
  newWindow.document.title = fileName;
}

export async function downloadFile(url: string, fileName: string): Promise<void> {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Falha ao baixar arquivo');

    const blob = await response.blob();
    saveAs(blob, fileName);
  } catch (error) {
    console.error('Error downloading file:', error);
    throw new Error('Falha ao fazer download do arquivo');
  }
}

export function isMarkdownFile(mimeType: string, fileName: string): boolean {
  return (
    mimeType === 'text/markdown' ||
    mimeType === 'text/x-markdown' ||
    fileName.endsWith('.md') ||
    fileName.endsWith('.markdown')
  );
}

export function isTextFile(mimeType: string, fileName: string): boolean {
  return (
    mimeType.startsWith('text/') ||
    fileName.endsWith('.txt') ||
    fileName.endsWith('.csv') ||
    fileName.endsWith('.json') ||
    fileName.endsWith('.xml')
  );
}
