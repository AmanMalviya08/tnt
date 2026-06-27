const PDFDocument = require("pdfkit");

const MARGIN = 40;
const ROW_GAP = 6;
const MIN_ROW_HEIGHT = 14;

function formatCellValue(val, format) {
  if (val == null || val === "") return "";
  if (format === "currency" || format === "number") {
    const num = Number(val);
    if (Number.isFinite(num)) {
      return num.toLocaleString("en-IN", {
        minimumFractionDigits: format === "currency" ? 2 : 0,
        maximumFractionDigits: format === "currency" ? 2 : 2,
      });
    }
  }
  return String(val);
}

function buildColumnLayout(doc, columns) {
  const availableWidth = doc.page.width - MARGIN * 2;
  const totalWeight = columns.reduce((sum, col) => sum + (col.weight || 1), 0);
  let x = MARGIN;

  return columns.map((col) => {
    const width = (availableWidth * (col.weight || 1)) / totalWeight;
    const layout = { ...col, x, width, padding: 4 };
    x += width;
    return layout;
  });
}

function cellTextWidth(col) {
  return Math.max(col.width - col.padding * 2, 20);
}

function measureRowHeight(doc, colDefs, getText, { bold = false } = {}) {
  doc.font(bold ? "Helvetica-Bold" : "Helvetica");
  let maxHeight = MIN_ROW_HEIGHT;

  colDefs.forEach((col) => {
    const text = getText(col);
    const height = doc.heightOfString(text, { width: cellTextWidth(col) });
    maxHeight = Math.max(maxHeight, height);
  });

  return maxHeight + ROW_GAP;
}

function drawRow(doc, colDefs, y, getText, { bold = false } = {}) {
  doc.font(bold ? "Helvetica-Bold" : "Helvetica");
  colDefs.forEach((col) => {
    doc.text(getText(col), col.x + col.padding, y, {
      width: cellTextWidth(col),
      lineBreak: true,
    });
  });
}

function rowsToCsv(rows, columns) {
  const header = columns.map((c) => c.label).join(",");
  const lines = rows.map((row) =>
    columns
      .map((c) => {
        const val = formatCellValue(c.get(row), c.format);
        return `"${val.replace(/"/g, '""')}"`;
      })
      .join(",")
  );
  return [header, ...lines].join("\n");
}

function sendCsvExport(res, filename, rows, columns) {
  const csv = rowsToCsv(rows, columns);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}.csv"`);
  return res.send(csv);
}

function buildPdfBuffer(title, rows, columns) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: MARGIN, size: "A4" });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(16).font("Helvetica-Bold").text(title, { align: "center" });
    doc.moveDown();
    doc.fontSize(9);

    const colDefs = buildColumnLayout(doc, columns);
    const pageBottom = doc.page.height - MARGIN;
    let y = doc.y;

    const ensureSpace = (neededHeight) => {
      if (y + neededHeight > pageBottom) {
        doc.addPage();
        y = MARGIN;
      }
    };

    const headerHeight = measureRowHeight(doc, colDefs, (col) => col.label, { bold: true });
    ensureSpace(headerHeight);
    drawRow(doc, colDefs, y, (col) => col.label, { bold: true });
    y += headerHeight;

    doc
      .moveTo(MARGIN, y - ROW_GAP / 2)
      .lineTo(doc.page.width - MARGIN, y - ROW_GAP / 2)
      .strokeColor("#cccccc")
      .stroke();

    rows.forEach((row) => {
      const rowHeight = measureRowHeight(doc, colDefs, (col) =>
        formatCellValue(col.get(row), col.format)
      );
      ensureSpace(rowHeight);
      drawRow(doc, colDefs, y, (col) => formatCellValue(col.get(row), col.format));
      y += rowHeight;
    });

    doc.end();
  });
}

async function sendPdfExport(res, filename, title, rows, columns) {
  const buffer = await buildPdfBuffer(title, rows, columns);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}.pdf"`);
  return res.send(buffer);
}

module.exports = { rowsToCsv, sendCsvExport, sendPdfExport, buildPdfBuffer, formatCellValue };
