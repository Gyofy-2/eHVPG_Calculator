"use strict";

/**
 * eHVPG Calculator
 *
 * The platelet model variable is the count per uL multiplied by 10^-6.
 * Single-input mode takes platelet in x10^3/uL; batch mode lets the user
 * choose between raw /uL and x10^3/uL.
 */

const COEFFS = {
  intercept: 37.31,
  inr: 5.63,
  albumin: -2.56,
  sodium: -0.16,
  platelet: -12.31, // applied to platelet expressed in x10^-6/uL
  bilirubin: 0.48,
};

const CSPH_THRESHOLD = 10; // mmHg

const FIELDS = [
  { id: "inr", label: "INR" },
  { id: "albumin", label: "Albumin" },
  { id: "sodium", label: "Sodium" },
  { id: "platelet", label: "Platelet" },
  { id: "bilirubin", label: "Total Bilirubin" },
];

/**
 * Core model. `plateletPerMicroL` is the platelet count per uL (e.g. 139000).
 */
function pressFromRaw({ inr, albumin, sodium, plateletPerMicroL, bilirubin }) {
  const plateletVar = plateletPerMicroL * 1e-6;
  return (
    COEFFS.intercept +
    COEFFS.inr * inr +
    COEFFS.albumin * albumin +
    COEFFS.sodium * sodium +
    COEFFS.platelet * plateletVar +
    COEFFS.bilirubin * bilirubin
  );
}

function fmt(n, digits = 2) {
  return Number(n).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/* ----------------------------- Single input ----------------------------- */

function readInputs() {
  const values = {};
  const missing = [];
  for (const f of FIELDS) {
    const el = document.getElementById(f.id);
    const raw = el.value.trim();
    el.classList.remove("invalid");
    if (raw === "" || isNaN(Number(raw))) {
      missing.push(f);
      el.classList.add("invalid");
      continue;
    }
    values[f.id] = Number(raw);
  }
  return { values, missing };
}

function renderResult(press) {
  document.getElementById("press-value").textContent = fmt(press, 1);
  const interp = document.getElementById("interpretation");
  if (press >= CSPH_THRESHOLD) {
    interp.innerHTML =
      `<span class="badge high">CSPH suspected</span> Estimated HVPG ≥ ${CSPH_THRESHOLD} mmHg.`;
  } else {
    interp.innerHTML =
      `<span class="badge low">Below threshold</span> Estimated HVPG &lt; ${CSPH_THRESHOLD} mmHg.`;
  }
}

function calculate() {
  const errorEl = document.getElementById("error-msg");
  const { values, missing } = readInputs();

  if (missing.length > 0) {
    errorEl.hidden = false;
    errorEl.textContent =
      "Please enter a valid value for: " + missing.map((m) => m.label).join(", ");
    return;
  }
  errorEl.hidden = true;

  // Single-input platelet is in x10^3/uL -> convert to per uL.
  const press = pressFromRaw({
    inr: values.inr,
    albumin: values.albumin,
    sodium: values.sodium,
    plateletPerMicroL: values.platelet * 1000,
    bilirubin: values.bilirubin,
  });
  renderResult(press);
}

function resetAll() {
  document.getElementById("press-value").textContent = "—";
  document.getElementById("interpretation").innerHTML = "";
  document.getElementById("error-msg").hidden = true;
  for (const f of FIELDS) {
    document.getElementById(f.id).classList.remove("invalid");
  }
}

/* ------------------------------ Batch (CSV) ------------------------------ */

// Header aliases (normalized: lowercased, alphanumerics only).
const COLUMN_ALIASES = {
  inr: ["inr"],
  albumin: ["albumin", "alb"],
  sodium: ["na", "sodium", "sodiumna"],
  platelet: ["plt", "platelet", "platelets", "plate", "pltcount"],
  bilirubin: ["tb", "tbil", "tbili", "bilirubin", "totalbilirubin", "totbilirubin"],
};

function normalizeKey(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Minimal RFC-4180-ish CSV parser handling quotes, commas, CRLF and BOM. */
function parseCSV(text) {
  text = text.replace(/^﻿/, "");
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      rows.push(row); row = [];
    } else field += c;
  }
  if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
  // Drop fully-empty trailing rows.
  while (rows.length && rows[rows.length - 1].every((x) => x === "")) rows.pop();
  return rows;
}

/** Wrap a field in quotes if it contains comma, quote or newline. */
function csvField(v) {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// Substring hints used as a fallback when no exact alias matches.
const COLUMN_HINTS = {
  inr: ["inr"],
  albumin: ["albumin", "alb"],
  sodium: ["sodium"],
  platelet: ["platelet", "plt", "plate"],
  bilirubin: ["bilirubin", "bili", "tbil"],
};

/**
 * Best-effort auto-detection. First an exact alias match, then a substring
 * fallback. A column is never assigned to two fields. Returns -1 when unknown
 * — the user can still fix it manually with the mapping dropdowns.
 */
function detectColumns(header) {
  const normHeader = header.map(normalizeKey);
  const mapping = {};
  const used = new Set();

  for (const key of Object.keys(COLUMN_ALIASES)) {
    const idx = normHeader.findIndex(
      (h, i) => !used.has(i) && COLUMN_ALIASES[key].includes(h)
    );
    mapping[key] = idx;
    if (idx >= 0) used.add(idx);
  }
  for (const key of Object.keys(COLUMN_HINTS)) {
    if (mapping[key] >= 0) continue;
    const idx = normHeader.findIndex(
      (h, i) => !used.has(i) && COLUMN_HINTS[key].some((k) => h.includes(k))
    );
    mapping[key] = idx;
    if (idx >= 0) used.add(idx);
  }
  return mapping;
}

let batchState = { header: null, rows: null, mapping: null, fileName: null };

function setBatchStatus(html, type) {
  const el = document.getElementById("batch-status");
  el.className = "batch-status" + (type ? " " + type : "");
  el.innerHTML = html;
}

/** Build one dropdown per required field, pre-selecting the auto-detected column. */
function buildColumnMap(header, mapping) {
  const wrap = document.getElementById("column-map-rows");
  wrap.innerHTML = "";

  const optionsHtml = (selectedIdx) => {
    let html = `<option value="-1">— not in file —</option>`;
    header.forEach((h, i) => {
      const name = h.trim() === "" ? `(column ${i + 1})` : h;
      const sel = i === selectedIdx ? " selected" : "";
      html += `<option value="${i}"${sel}>${escapeHtml(name)}</option>`;
    });
    return html;
  };

  for (const f of FIELDS) {
    const rowEl = document.createElement("div");
    rowEl.className = "map-row";
    rowEl.innerHTML =
      `<label for="map-${f.id}">${f.label}</label>` +
      `<select id="map-${f.id}" data-field="${f.id}">${optionsHtml(mapping[f.id])}</select>`;
    wrap.appendChild(rowEl);
  }

  wrap.querySelectorAll("select").forEach((sel) => {
    sel.addEventListener("change", () => {
      batchState.mapping[sel.dataset.field] = Number(sel.value);
      validateBatch();
    });
  });

  document.getElementById("column-map").hidden = false;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

/** Re-check mapping and update status + button state. Called on load and on change. */
function validateBatch() {
  const { header, rows, mapping } = batchState;
  if (!rows) return;

  FIELDS.forEach((f) => {
    const sel = document.getElementById("map-" + f.id);
    if (sel) sel.classList.toggle("unset", Number(sel.value) < 0);
  });

  const missing = FIELDS.filter((f) => mapping[f.id] < 0).map((f) => f.label);
  let html = `<strong>${rows.length}</strong> data row(s) detected.`;
  if (missing.length) {
    html +=
      `<br /><span class="warn-text">Please select a column for: ${missing.join(", ")} ` +
      "(use the dropdowns above).</span>";
    setBatchStatus(html, "warn");
    document.getElementById("batch-download").disabled = true;
  } else {
    html += "<br />All parameters mapped. Ready to calculate.";
    setBatchStatus(html, "ok");
    document.getElementById("batch-download").disabled = false;
  }
}

function onFileSelected(file) {
  document.getElementById("batch-download").disabled = true;
  document.getElementById("column-map").hidden = true;
  batchState = { header: null, rows: null, mapping: null, fileName: file.name };

  const reader = new FileReader();
  reader.onload = () => {
    const rows = parseCSV(reader.result);
    if (rows.length < 2) {
      setBatchStatus("The file has no data rows.", "error");
      return;
    }
    batchState.header = rows[0];
    batchState.rows = rows.slice(1);
    batchState.mapping = detectColumns(rows[0]);

    buildColumnMap(batchState.header, batchState.mapping);
    validateBatch();
  };
  reader.onerror = () => setBatchStatus("Failed to read the file.", "error");
  reader.readAsText(file);
}

function plateletToPerMicroL(value) {
  const unit = document.getElementById("plt-unit").value; // 'perul' | 'k'
  return unit === "k" ? value * 1000 : value;
}

function runBatch() {
  if (!batchState.rows) return;
  const { rows, mapping } = batchState;

  // English-only standardized output (original columns are not carried over,
  // which also keeps any identifying fields out of the result).
  const outHeader = [
    "row",
    "INR",
    "Albumin",
    "Sodium",
    "Platelet_per_uL",
    "Total_Bilirubin",
    "eHVPG_mmHg",
    "note",
  ];
  const outRows = [outHeader];
  let computed = 0;
  let skipped = 0;

  rows.forEach((row, i) => {
    const vals = {};
    const badCols = [];
    for (const f of FIELDS) {
      const idx = mapping[f.id];
      const raw = idx >= 0 ? String(row[idx]).trim() : "";
      if (raw === "" || isNaN(Number(raw))) badCols.push(f.label);
      else vals[f.id] = Number(raw);
    }

    let press = "";
    let note = "";
    let plateletPerMicroL = "";
    if (badCols.length) {
      note = "missing/invalid: " + badCols.join("; ");
      skipped++;
    } else {
      plateletPerMicroL = plateletToPerMicroL(vals.platelet);
      press = pressFromRaw({
        inr: vals.inr,
        albumin: vals.albumin,
        sodium: vals.sodium,
        plateletPerMicroL,
        bilirubin: vals.bilirubin,
      }).toFixed(2);
      computed++;
    }
    outRows.push([
      i + 1,
      vals.inr ?? "",
      vals.albumin ?? "",
      vals.sodium ?? "",
      plateletPerMicroL,
      vals.bilirubin ?? "",
      press,
      note,
    ]);
  });

  const csv = outRows.map((r) => r.map(csvField).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const base = (batchState.fileName || "input.csv").replace(/\.csv$/i, "");
  a.href = url;
  a.download = `${base}_eHVPG.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  setBatchStatus(
    `Done. <strong>${computed}</strong> computed, <strong>${skipped}</strong> skipped. ` +
      "Result downloaded as CSV.",
    skipped ? "warn" : "ok"
  );
}

/* -------------------------------- Wiring -------------------------------- */

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("calc-btn").addEventListener("click", calculate);
  document.getElementById("reset-btn").addEventListener("click", resetAll);
  document.getElementById("calc-form").addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); calculate(); }
  });

  const fileInput = document.getElementById("csv-file");
  const fileName = document.getElementById("file-name");
  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    fileName.textContent = file ? file.name : "No file selected";
    if (file) onFileSelected(file);
  });
  document.getElementById("batch-download").addEventListener("click", runBatch);
});
