const rawHtml = `<!-- Ökologie -->
<div class="col-lg-6 col-md-12 mb-1">
  <div class="card full-height">
    <div class="card__content">
      <div class="card__title">🐝 &Ouml;kologie</div>
      <table class="mt-1">
        <tbody>
          <tr><td>Wildbienen:</td><td>57 (Nektar und/oder Pollen, davon 20 spezialisiert)</td></tr>
          <tr><td>Raupen:</td><td>5 (davon 1 spezialisiert)</td></tr>
          <tr><td>Nektarwert:</td><td>1/4 - gering</td></tr>
          <tr><td>Pollenwert:</td><td>3/4 - viel</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</div>`;

const cleanText = (value) => {
  if (!value) return null;
  const cleaned = value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&uuml;/gi, "ü")
    .replace(/&ouml;/gi, "ö")
    .replace(/&auml;/gi, "ä")
    .replace(/&szlig;/gi, "ß")
    .replace(/\|/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length > 0 ? cleaned : null;
};

const extractEcologyCardTableHtml = (html) => {
  const match = html.match(/<div[^>]*class="card__title"[^>]*>[\s\S]*?(?:🐝\s*)?(?:&Ouml;|Ö)kologie[\s\S]*?<\/div>[\s\S]*?<table\b[\s\S]*?<\/table>/i);
  return match ? match[0] : null;
};

const extractTableRows = (tableHtml) => {
  const rows = [];
  const rowPattern = /<tr[^>]*>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi;

  for (const match of tableHtml.matchAll(rowPattern)) {
    const label = cleanText(match[1]);
    const value = cleanText(match[2]);
    if (label && value) {
      rows.push({ label, value });
    }
  }

  return rows;
};

const extractTableField = (rows, labels) => {
  const normalizedLabels = labels.map((label) => label.toLowerCase());
  const row = rows.find((entry) => normalizedLabels.includes(entry.label.toLowerCase().replace(/:$/, "")));
  return row?.value ?? null;
};

const extractNumericValue = (value) => {
  if (!value) return null;
  const match = value.match(/\b(\d+)\b/);
  return match ? Number(match[1]) : null;
};

const normalizeQuarterValue = (value) => {
  const cleaned = cleanText(value);
  if (!cleaned) return null;
  const strictMatch = cleaned.match(/\b([0-4])\s*\/\s*4\b/);
  return strictMatch ? `${strictMatch[1]}/4` : null;
};

const ecologyHtml = extractEcologyCardTableHtml(rawHtml);
const rows = extractTableRows(ecologyHtml);
const result = {
  wild_bees_count: extractNumericValue(extractTableField(rows, ["Wildbienen"])),
  caterpillars_count: extractNumericValue(extractTableField(rows, ["Raupen"])),
  nectar_value: normalizeQuarterValue(extractTableField(rows, ["Nektarwert"])),
  pollen_value: normalizeQuarterValue(extractTableField(rows, ["Pollenwert"])),
};

console.log(JSON.stringify({ rows, result }, null, 2));
