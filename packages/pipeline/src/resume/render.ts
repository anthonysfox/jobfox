import PDFDocument from "pdfkit";

/*
 * Renders resume Markdown to a one-column PDF. It understands only what my
 * resume uses: "#" name, the contact line under it, "##" sections, "###"
 * entries, "-" bullets, paragraphs, and **bold**. A line ending in a date
 * range ("**Engineer**, July 2025 – Present") puts the dates at the right
 * margin, and skills lists have no bullet markers. Built-in Helvetica keeps
 * it dependency-free and ATS-readable (real text, not an image).
 */

const MARGIN = 36; // 0.5 in
const REGULAR = "Helvetica";
const BOLD = "Helvetica-Bold";
const TEXT = "#1c1917";
const MUTED = "#57534e";
const ACCENT = "#2c3e6b";
const BODY_SIZE = 9.5;
const LINE_GAP = 1.5;

type Doc = InstanceType<typeof PDFDocument>;

const DATE_RANGE =
  /^(.*\S),\s+((?:[A-Z][a-z]+ )?\d{4}\s+[–-]\s+(?:Present|(?:[A-Z][a-z]+ )?\d{4}))$/;

/** "**Engineer**, July 2025 – Present" -> ["**Engineer**", "July 2025 – Present"]. */
export function splitDates(line: string): [string, string] | null {
  const match = DATE_RANGE.exec(line);
  return match ? [match[1] ?? "", match[2] ?? ""] : null;
}

/** Splits "**Bold:** rest" into styled runs; stray single asterisks are dropped. */
export function inlineRuns(text: string): { text: string; bold: boolean }[] {
  return text
    .split(/\*\*(.+?)\*\*/)
    .map((part, i) => ({ text: part.replace(/\*/g, ""), bold: i % 2 === 1 }))
    .filter((run) => run.text.length > 0);
}

function writeRuns(doc: Doc, text: string, x: number, width: number, align: "left" | "center") {
  const runs = inlineRuns(text);
  const y = doc.y;
  runs.forEach((run, i) => {
    doc.font(run.bold ? BOLD : REGULAR);
    const options = { width, align, lineGap: LINE_GAP, continued: i < runs.length - 1 };
    if (i === 0) doc.text(run.text, x, y, options);
    else doc.text(run.text, options);
  });
}

export interface RenderedResume {
  pdf: Buffer;
  pages: number;
}

export function renderResumePdf(markdown: string): Promise<RenderedResume> {
  const doc = new PDFDocument({
    size: "LETTER",
    // Keeps pages in memory until end(), so the page count is known.
    bufferPages: true,
    margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
    info: { Title: /^# (.+)$/m.exec(markdown)?.[1] ?? "Resume" },
  });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  let pages = 1;
  const done = new Promise<RenderedResume>((resolve, reject) => {
    doc.on("end", () => {
      resolve({ pdf: Buffer.concat(chunks), pages });
    });
    doc.on("error", reject);
  });

  const left = MARGIN;
  const width = doc.page.width - MARGIN * 2;
  let afterName = false;
  let section = "";

  for (const raw of markdown.split("\n")) {
    const line = raw.trim();
    if (line === "") continue;
    doc.fillColor(TEXT);

    if (line.startsWith("# ")) {
      doc.font(BOLD).fontSize(20).text(line.slice(2).toUpperCase(), left, doc.y, {
        width,
        align: "center",
        characterSpacing: 1.5,
      });
      afterName = true;
      continue;
    }
    // Every line between the name and the first heading is contact info.
    if (afterName && !line.startsWith("#")) {
      doc.fontSize(BODY_SIZE).fillColor(MUTED);
      writeRuns(doc, line, left, width, "center");
      continue;
    }
    if (afterName) {
      afterName = false;
      doc.moveDown(0.4);
    }

    if (line.startsWith("## ")) {
      section = line.toLowerCase();
      doc.moveDown(0.5);
      doc
        .fillColor(ACCENT)
        .font(BOLD)
        .fontSize(10.5)
        .text(line.slice(3).toUpperCase(), left, doc.y, { width, characterSpacing: 0.6 });
      const y = doc.y + 1;
      doc
        .moveTo(left, y)
        .lineTo(left + width, y)
        .lineWidth(0.6)
        .strokeColor(MUTED)
        .stroke();
      doc.fillColor(TEXT).moveDown(0.35);
    } else if (line.startsWith("### ")) {
      doc.moveDown(0.25);
      doc.fontSize(10);
      writeRuns(doc, `**${line.slice(4).replace(/\*\*/g, "")}**`, left, width, "left");
    } else if (/^[-*]\s+/.test(line) && section.includes("skill")) {
      doc.fontSize(BODY_SIZE);
      writeRuns(doc, line.replace(/^[-*]\s+/, ""), left, width, "left");
      doc.moveDown(0.15);
    } else if (/^[-*]\s+/.test(line)) {
      doc.fontSize(BODY_SIZE);
      const y = doc.y;
      doc.font(REGULAR).text("•", left + 4, y, { lineBreak: false });
      doc.y = y;
      writeRuns(doc, line.replace(/^[-*]\s+/, ""), left + 14, width - 14, "left");
      doc.moveDown(0.15);
    } else {
      doc.fontSize(BODY_SIZE);
      const dated = splitDates(line);
      if (dated) {
        const [text, dates] = dated;
        const y = doc.y;
        doc.font(REGULAR).text(dates, left, y, { width, align: "right", lineBreak: false });
        const dateWidth = doc.widthOfString(dates);
        doc.y = y;
        writeRuns(doc, text, left, width - dateWidth - 12, "left");
      } else {
        writeRuns(doc, line, left, width, "left");
      }
      doc.moveDown(0.15);
    }
  }

  pages = doc.bufferedPageRange().count;
  doc.end();
  return done;
}
