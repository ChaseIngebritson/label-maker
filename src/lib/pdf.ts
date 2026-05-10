import { jsPDF } from "jspdf";
import type { Address, LabelFont, LabelTemplate, Region, ReturnLabelStyle } from "../types";

function formatName(address: Address): string {
  return [address.title, address.firstName, address.lastName, address.suffix]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatCityLine(address: Address): string {
  const cityState = [address.city, address.state].filter(Boolean).join(", ");
  return [cityState, address.postalCode].filter(Boolean).join(" ").trim();
}

function toLines(address: Address): string[] {
  return [
    formatName(address),
    address.address1.trim(),
    address.address2.trim(),
    formatCityLine(address),
    address.country.trim(),
  ].filter(Boolean);
}

function createDocument(region: Region): jsPDF {
  if (region === "US") {
    return new jsPDF({ unit: "in", format: "letter" });
  }
  return new jsPDF({ unit: "in", format: [8.27, 11.69] });
}

function mapFont(font: LabelFont): "helvetica" | "times" | "courier" {
  return font;
}

export function generateLabelsPdf(params: {
  addresses: Address[];
  template: LabelTemplate;
  region: Region;
  skipLabels: number;
  filename: string;
  style?: ReturnLabelStyle;
}): void {
  const { addresses, template, region, skipLabels, filename, style } = params;
  const labelsPerPage = template.cols * template.rows;
  const placed = [...Array(skipLabels).fill(null), ...addresses];

  const doc = createDocument(region);
  doc.setFont(mapFont(style?.font ?? "helvetica"), "normal");
  doc.setFontSize(10);

  placed.forEach((entry, index) => {
    const page = Math.floor(index / labelsPerPage);
    const slot = index % labelsPerPage;
    const row = Math.floor(slot / template.cols);
    const col = slot % template.cols;

    if (page > 0 && slot === 0) {
      doc.addPage();
    }

    if (!entry) return;

    const x = template.sideMargin + col * template.hPitch;
    const y = template.topMargin + row * template.vPitch;
    const lines = toLines(entry);
    const maxWidth = template.width - 0.1;
    const lineHeight = 0.14;
    const leadingSymbol = style?.leadingSymbol?.trim() ?? "";
    const textStartX = x + (leadingSymbol ? 0.18 : 0.05);

    if (leadingSymbol) {
      doc.text(leadingSymbol, x + 0.05, y + 0.2, { baseline: "middle" });
    }

    lines.forEach((line, lineIndex) => {
      const wrapped = doc.splitTextToSize(line, maxWidth) as string[];
      wrapped.forEach((wrappedLine, wrappedIndex) => {
        const drawY = y + 0.2 + lineHeight * (lineIndex + wrappedIndex);
        if (drawY < y + template.height - 0.05) {
          doc.text(wrappedLine, textStartX, drawY, { baseline: "middle" });
        }
      });
    });
  });

  doc.save(filename);
}
