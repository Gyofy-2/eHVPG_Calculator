"use strict";

/**
 * eHVPG Calculator
 *
 * Model equation (mmHg-equivalent):
 *   PRESS = 37.31 + 5.63*INR - 2.56*Albumin - 0.16*Sodium
 *           - 12.31*Platelet(x10^-6/uL) + 0.48*TotalBilirubin
 *
 * Platelet is entered in x10^3/uL (== x10^9/L). The model variable is the
 * count per uL multiplied by 10^-6, i.e. input(x10^3/uL) * 1e-3.
 */

const COEFFS = {
  intercept: 37.31,
  inr: 5.63,
  albumin: -2.56,
  sodium: -0.16,
  platelet: -12.31, // applied to platelet in x10^-6/uL units
  bilirubin: 0.48,
};

const CSPH_THRESHOLD = 10; // mmHg — clinically significant portal hypertension

const FIELDS = [
  { id: "inr", label: "INR" },
  { id: "albumin", label: "Albumin" },
  { id: "sodium", label: "Sodium" },
  { id: "platelet", label: "Platelet" },
  { id: "bilirubin", label: "Total Bilirubin" },
];

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

function computePress(v) {
  // Convert platelet from x10^3/uL to the model's x10^-6/uL variable.
  const plateletVar = v.platelet * 1e-3;

  const terms = [
    { name: "Intercept", coeff: 1, value: COEFFS.intercept, contribution: COEFFS.intercept },
    { name: "INR", coeff: COEFFS.inr, value: v.inr, contribution: COEFFS.inr * v.inr },
    { name: "Albumin", coeff: COEFFS.albumin, value: v.albumin, contribution: COEFFS.albumin * v.albumin },
    { name: "Sodium", coeff: COEFFS.sodium, value: v.sodium, contribution: COEFFS.sodium * v.sodium },
    {
      name: "Platelet (×10⁻⁶/µL)",
      coeff: COEFFS.platelet,
      value: plateletVar,
      contribution: COEFFS.platelet * plateletVar,
    },
    { name: "Total Bilirubin", coeff: COEFFS.bilirubin, value: v.bilirubin, contribution: COEFFS.bilirubin * v.bilirubin },
  ];

  const press = terms.reduce((sum, t) => sum + t.contribution, 0);
  return { press, terms };
}

function fmt(n, digits = 2) {
  return Number(n).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function renderResult(press, terms) {
  document.getElementById("press-value").textContent = fmt(press, 1);

  const interp = document.getElementById("interpretation");
  if (press >= CSPH_THRESHOLD) {
    interp.innerHTML =
      `<span class="badge high">CSPH 의심</span> 추정 HVPG ≥ ${CSPH_THRESHOLD} mmHg — ` +
      `임상적으로 유의한 문맥압항진증 범위입니다.`;
  } else {
    interp.innerHTML =
      `<span class="badge low">Below threshold</span> 추정 HVPG &lt; ${CSPH_THRESHOLD} mmHg.`;
  }

  const tbody = document.querySelector("#breakdown-table tbody");
  tbody.innerHTML = "";
  for (const t of terms) {
    const tr = document.createElement("tr");
    tr.innerHTML =
      `<td>${t.name}</td>` +
      `<td>${t.name === "Intercept" ? "—" : fmt(t.coeff, 2)}</td>` +
      `<td>${t.name === "Intercept" ? "—" : fmt(t.value, 3)}</td>` +
      `<td>${t.contribution >= 0 ? "+" : ""}${fmt(t.contribution, 3)}</td>`;
    tbody.appendChild(tr);
  }
}

function calculate() {
  const errorEl = document.getElementById("error-msg");
  const { values, missing } = readInputs();

  if (missing.length > 0) {
    errorEl.hidden = false;
    errorEl.textContent =
      "다음 값을 올바르게 입력해 주세요: " + missing.map((m) => m.label).join(", ");
    return;
  }
  errorEl.hidden = true;

  const { press, terms } = computePress(values);
  renderResult(press, terms);
}

function resetAll() {
  document.getElementById("press-value").textContent = "—";
  document.getElementById("interpretation").innerHTML = "";
  document.querySelector("#breakdown-table tbody").innerHTML = "";
  document.getElementById("error-msg").hidden = true;
  for (const f of FIELDS) {
    document.getElementById(f.id).classList.remove("invalid");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("calc-btn").addEventListener("click", calculate);
  document.getElementById("reset-btn").addEventListener("click", resetAll);

  // Allow Enter key within any input to trigger calculation.
  document.getElementById("calc-form").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      calculate();
    }
  });
});
