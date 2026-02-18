/**
 * Build PALETTE array from DMC CSV.
 * Data: CrossStitchCreator DMC Cotton Floss to RGB (github.com/adrianj/CrossStitchCreator)
 * Ref: https://diamant-strass-dmc.com/en/diamond-painting-colors-dmc-near-replacement/
 */
const fs = require("fs");
const path = require("path");

const csvPath = path.join(__dirname, "DMC Cotton Floss converted to RGB Values.csv");
let csv;
try {
  csv = fs.readFileSync(csvPath, "utf8");
} catch (e) {
  console.error("Missing DMC Cotton Floss converted to RGB Values.csv");
  process.exit(1);
}

const lines = csv.replace(/\r\n/g, "\n").split("\n").filter(Boolean);
const header = lines[0];
if (!header.startsWith("Floss")) {
  // Skip "# Content from..." if present
  const idx = lines.findIndex((l) => l.startsWith("Floss"));
  if (idx >= 0) lines.splice(0, idx);
}
const dataLines = lines.slice(1).filter((l) => /^\d|^[A-Za-z]/.test(l.trim().split(",")[0]));

const palette = [];
dataLines.forEach((line, index) => {
  const parts = line.split(",");
  if (parts.length < 5) return;
  const floss = parts[0].trim();
  const name = (parts[1] || "").trim().replace(/"/g, '\\"');
  const r = Math.max(0, Math.min(255, parseInt(parts[2], 10) || 0));
  const g = Math.max(0, Math.min(255, parseInt(parts[3], 10) || 0));
  const b = Math.max(0, Math.min(255, parseInt(parts[4], 10) || 0));
  const id = /^\d+$/.test(floss) ? parseInt(floss, 10) : index + 1;
  palette.push({ id, name, rgb: [r, g, b] });
});

const out = `// ——— 2. PALETTE (DMC ${palette.length} colors, LAB precomputed) ———
// DMC diamond painting / embroidery floss colors (see diamant-strass-dmc.com)
const PALETTE = [
${palette.map((c) => `  { id: ${JSON.stringify(c.id)}, name: ${JSON.stringify(c.name)}, rgb: [${c.rgb.join(", ")}] },`).join("\n")}
];`;

const outPath = path.join(__dirname, "palette-dmc.js");
fs.writeFileSync(outPath, out, "utf8");
console.log("Wrote", palette.length, "colors to", outPath);
