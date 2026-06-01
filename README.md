# eHVPG Calculator

A static web calculator that estimates the Hepatic Venous Pressure Gradient (HVPG)
from serum markers (INR, Albumin, Sodium, Platelet, Total Bilirubin).

> ⚠️ **For research and educational use only.** Do not use alone for clinical diagnosis
> or treatment decisions.

## Features

- **Single calculation** — enter the five parameters and get an estimated HVPG (mmHg).
- **Batch from CSV** — upload a CSV and download a result CSV with the estimate per row.
  - **Auto column detection** with a substring fallback (e.g. `inr_value`, `Alb_g_dl`,
    `Plt count`, `Sodium level` are recognized automatically).
  - **Manual column mapping** — if a column is not recognized, pick it from a dropdown,
    so files with any column naming (including non-English headers) can still be used.
  - **Platelet unit selector** — `/µL` (raw count, e.g. 139000) or `×10³/µL` (e.g. 139).
  - **Runs entirely in the browser** — the file is never uploaded to any server.

## Input Units

| Variable | Unit | Notes |
|---|---|---|
| INR | dimensionless | typical range 0.8–3.0 |
| Albumin | g/dL | |
| Sodium (Na) | mmol/L | |
| Platelet | ×10³/µL (single) / selectable (batch) | single input uses ×10³/µL; batch lets you choose `/µL` or `×10³/µL` |
| Total Bilirubin | mg/dL | |

## Output

An estimated HVPG in mmHg-equivalent.

Batch mode downloads `<input-name>_eHVPG.csv` with the columns:

```
row, INR, Albumin, Sodium, Platelet_per_uL, Total_Bilirubin, eHVPG_mmHg, note
```

Original columns from the uploaded file are not carried over. Rows with missing or
invalid values are left blank with a reason in the `note` column.

## Run Locally

A pure static site with no build step.

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy (GitHub Pages)

1. Push this repository to GitHub
2. **Settings → Pages → Build and deployment → Source: `Deploy from a branch`**
3. Select Branch: `main` / `/ (root)` and save
4. The site is served at `https://<user>.github.io/eHVPG_Calculator/`

## Project Structure

```
eHVPG_Calculator/
├── index.html      # page markup
├── styles.css      # styles
├── script.js       # single + batch calculation logic
├── assets/         # logos
└── README.md
```

## Data Policy

Medical data (CSV/DICOM, etc.) is never committed to this repository (blocked via
`.gitignore`). Batch CSV processing happens locally in the browser; uploaded files are
not sent anywhere.
