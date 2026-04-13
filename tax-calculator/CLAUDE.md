# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start development server (localhost:5173)
npm run build      # TypeScript check + production build (outputs to dist/)
npm run lint       # ESLint
npx tsc --noEmit   # Type-check only (no emit)
```

## Architecture

**Stack:** React 19 + Vite + TypeScript + Tailwind CSS v4 + Supabase + `@react-pdf/renderer`

### Tax Engine (`src/tax-engine/`)

The tax engine is pure TypeScript with no React dependencies. It takes a `TaxInput` and returns a `TaxOutput` (see `src/types/engine.ts`).

- `index.ts` — main `calculateTax(input)` orchestrator; all logic flows through here
- `constants/` — `FederalTaxData` objects per year (2024/2025/2026); load via `getTaxDataByYear(year)`
- `federal/` — individual modules: `brackets.ts`, `se-tax.ts`, `fica.ts`, `qbi.ts`, `child-tax-credit.ts`, `scorp-analysis.ts`
- `state/` — one file per state (TN, CA, GA, NC, NY, TX, AZ, FL); each exports `calculateXX(allocatedIncome, taxableIncome, filingStatus, year): StateResult`

**Key calculation notes:**
- Spousal/other income is included in `taxableIncome` for bracket placement only. A `businessRatio` (`businessIncome / totalIncome`) is applied so only business-derived tax flows into the quarterly estimate.
- Quarterly proration: Q1=0.25, Q2=0.50, Q3=0.75, Q4=1.00 (cumulative YTD, not per-quarter increments)
- Annualization divides income by the proration factor to project to a full year before applying brackets, then multiplies back
- S-Corp: SE tax is skipped; FICA from `fica.ts` is calculated on the shareholder salary and subtracted from the federal total (FICA already paid via payroll)

### Multi-Step Form (`src/pages/NewReport.tsx`)

Form state lives in `useFormState` (a `useReducer` hook in `src/hooks/`). Steps 1–3 collect data → `handleStep3` assembles `TaxInput` and calls `calculateTax()` → results render in `ResultsPanel`.

Live preview: once in "results" step, `calculateTax()` is called debounced (300ms) whenever form state changes.

### PDF (`src/components/pdf/`)

`@react-pdf/renderer` is **lazy-loaded** — it only loads when the user triggers a download. PDF components use `View`/`Text` from react-pdf with a shared `pdfStyles` stylesheet. Do not attempt to share Tailwind HTML components with the PDF layer.

### Database (Supabase)

- Schema: `supabase-schema.sql` (run once in Supabase SQL editor)
- Two tables: `clients` and `reports`
- `reports.input_snapshot` and `reports.output_snapshot` are full JSON snapshots — self-contained per calculation
- RLS is enforced: all rows are scoped to `auth.uid() = created_by`
- Hooks: `useClients.ts`, `useReports.ts` for CRUD; `supabase.ts` exports the typed client

### Environment Variables

`.env.local` (not committed):
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Add these as Environment Variables in the Vercel project dashboard before deploying.

## Deployment

Deploy via Vercel. `vercel.json` has the SPA rewrite rule. The Supabase anon key is safe to expose on the frontend — RLS policies enforce all data access controls.

## Updating Tax Data

When IRS publishes new year figures (typically Oct/Nov), add a new file `src/tax-engine/constants/YYYY.ts` following the existing pattern, register it in `constants/index.ts`, and update each state module if state rates changed.
