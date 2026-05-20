import PDFDocument from 'pdfkit';
import type { Pathway, Limitations } from '../repositories/pathways.repo';

const COLORS = {
  ink: '#1d1d1f',
  mute: '#6b6b70',
  rule: '#d4d4d8',
  sage: '#5a7a5a',
  amber: '#a87a3a',
  clay: '#b85c4a',
  card: '#fafaf8',
};

function toneColor(tone: string): string {
  if (tone === 'sage') return COLORS.sage;
  if (tone === 'amber') return COLORS.amber;
  if (tone === 'clay') return COLORS.clay;
  return COLORS.mute;
}

function drawHr(doc: PDFKit.PDFDocument): void {
  const y = doc.y + 6;
  doc.save();
  doc.strokeColor(COLORS.rule).lineWidth(0.5).moveTo(doc.page.margins.left, y)
    .lineTo(doc.page.width - doc.page.margins.right, y).stroke();
  doc.restore();
  doc.moveDown(0.8);
}

function renderLimitations(doc: PDFKit.PDFDocument, limitations: Limitations): void {
  doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(13).text(limitations.headline);
  doc.moveDown(0.3);
  doc.fillColor(COLORS.mute).font('Helvetica').fontSize(10).text(limitations.summary);
  doc.moveDown(0.4);
  doc.fillColor(COLORS.ink).fontSize(10);
  for (const bullet of limitations.bullets) {
    doc.font('Helvetica').text(`•  ${bullet}`, { indent: 6, lineGap: 2 });
    doc.moveDown(0.2);
  }
}

function renderPathway(doc: PDFKit.PDFDocument, pathway: Pathway): void {
  const rankLabel = String(pathway.rank).padStart(2, '0');
  doc.fillColor(COLORS.mute).font('Helvetica').fontSize(9)
    .text(`PATHWAY ${rankLabel}${pathway.featured ? '  ·  RECOMMENDED' : ''}`, { characterSpacing: 1.5 });
  doc.moveDown(0.2);

  doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(18).text(pathway.title);
  doc.moveDown(0.2);
  doc.fillColor(COLORS.mute).font('Helvetica').fontSize(11).text(pathway.sub);
  doc.moveDown(0.6);

  doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(13).text(pathway.wageRange, { continued: true });
  doc.fillColor(COLORS.mute).font('Helvetica').fontSize(10).text(`   ${pathway.wageNote}`);
  doc.moveDown(0.4);

  doc.fillColor(COLORS.ink).font('Helvetica').fontSize(10)
    .text(`Fit confidence: ${'●'.repeat(pathway.confidence)}${'○'.repeat(5 - pathway.confidence)}  (${pathway.confidence}/5)`);
  doc.moveDown(0.6);

  doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(11).text('Career ladder');
  doc.moveDown(0.2);
  doc.font('Helvetica').fontSize(10);
  for (const step of pathway.ladder) {
    const marker = step.current ? '▶' : '·';
    doc.fillColor(step.current ? COLORS.ink : COLORS.mute)
      .text(`${marker}  ${step.role}  —  ${step.meta}`, { indent: 6, lineGap: 2 });
  }
  doc.moveDown(0.4);

  if (pathway.tags.length > 0) {
    doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(11).text('Tags');
    doc.moveDown(0.2);
    doc.font('Helvetica').fontSize(10);
    for (const tag of pathway.tags) {
      doc.fillColor(toneColor(tag.tone)).text(`◆  ${tag.label}`, { indent: 6 });
    }
    doc.moveDown(0.4);
  }

  doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(11).text('Why this fits you');
  doc.moveDown(0.2);
  doc.fillColor(COLORS.ink).font('Helvetica').fontSize(10.5).text(pathway.why, { lineGap: 2 });
}

export function streamPathwaysPdf(
  res: NodeJS.WritableStream,
  pathways: Pathway[],
  limitations: Limitations,
  sourceFiles: string[],
): void {
  const doc = new PDFDocument({
    size: 'LETTER',
    margins: { top: 56, bottom: 56, left: 56, right: 56 },
    info: {
      Title: 'TruePath Pathway Recommendations',
      Creator: 'TruePath',
    },
  });

  doc.pipe(res);

  doc.fillColor(COLORS.mute).font('Helvetica').fontSize(9)
    .text('TRUEPATH  ·  CAREER PATHWAY RECOMMENDATIONS', { characterSpacing: 1.5 });
  doc.moveDown(0.3);
  doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(22).text('Three pathways that fit.');
  doc.moveDown(0.2);
  doc.fillColor(COLORS.mute).font('Helvetica').fontSize(10).text(
    `Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}  ·  Ranked by fit`,
  );
  doc.moveDown(0.8);

  renderLimitations(doc, limitations);
  doc.moveDown(0.6);
  drawHr(doc);

  pathways.forEach((pathway, i) => {
    if (i > 0) {
      doc.addPage();
    }
    renderPathway(doc, pathway);
  });

  if (sourceFiles.length > 0) {
    doc.moveDown(1.2);
    drawHr(doc);
    doc.fillColor(COLORS.mute).font('Helvetica').fontSize(9)
      .text(`Source documents: ${sourceFiles.join(' · ')}`);
  }

  doc.end();
}
