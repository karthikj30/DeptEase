<div align="center">

# DebtEase

Smart, explainable debt‑settlement and expense‑sharing assistant.

</div>

---

## 1. What this project is

DebtEase is an end‑to‑end system that helps groups settle shared expenses with **minimal number of payments** and a **clear, visual explanation** of how the settlement was computed.

It combines:

- 🧮 **Greedy debt‑settlement algorithm** (Python and Node/Express)
- 📊 **Interactive React dashboard** (Vite + React Router + D3)
- 🧠 **In‑app assistant & vault** for explanations and document storage
- 🌐 Optional **Next.js + Clerk** app (`my-clerk-app/`) for hosted auth‑first UX

If you just want to try the app locally, jump to:

- [Quick start](#4-quick-start)  
- [How to run the React app](#5-run-the-react-app)  
- [How to run the Python HTTP server](#6-run-the-python-http-server-optional)

For a detailed step‑by‑step guide of the original algorithm and datasets, see `DEBTEASE_GUIDE.md` and `QUICK_START.txt`.

---

## 2. Key features

- **Upload & track shared expenses** across a group
- **Greedy settlement optimizer** that minimizes the number of payments
- **Net balance view** – who ultimately owes whom, and how much
- **Graph visualizer** (force‑graph) of money flows before vs. after optimization
- **Interactive dashboard** with dark/light theme and responsive layout
- **AI/assistant style panel** (`AppAssistant`) to explain results and workflows
- **Vault** for storing JSON and text artifacts related to your settlements
- Optional **Next.js + Clerk** app for hosted login and multi‑device access

The raw data‑processing and algorithm pipeline (merge → JSON → optimize → visualize) is documented in depth in `DEBTEASE_GUIDE.md`.

---

## 3. Project structure

High‑level layout (only the most relevant pieces shown):

```text
DeptEase/
├─ Dataset/                    # Source CSV expense datasets
├─ src/                        # Main React (Vite) web app
│  ├─ App.jsx                  # App shell + routing
│  ├─ main.jsx                 # Vite entry point
│  ├─ components/
│  │  ├─ Topbar.jsx
│  │  ├─ Sidebar.jsx
│  │  ├─ AppAssistant.jsx      # In‑app assistant UI
│  │  └─ OCRPlusWizard.jsx     # (if enabled) OCR/import wizard
│  ├─ pages/
│  │  ├─ Home.jsx
│  │  ├─ Login.jsx
│  │  ├─ Dashboard.jsx
│  │  ├─ Visualizer.jsx
│  │  ├─ NetBalances.jsx
│  │  ├─ AddExpense.jsx
│  │  ├─ SettlementPlan.jsx
│  │  └─ Vault.jsx
│  └─ utils/
│     ├─ algorithm.js          # JS port of the settlement logic
│     ├─ AssistantEngine.js
│     └─ vaultStore.js
│
├─ run_site.py                 # Python HTTP server + vault API
├─ debt_ease_algorithm.py      # Core Python settlement algorithm
├─ merge_csv.py                # Merge multiple CSV datasets
├─ convert_to_json.py          # Convert merged CSV → JSON
├─ api_integration.py          # JSONBin / remote API helper
├─ settlement_results.json     # Example settlement output
│
├─ index.html                  # Legacy static dashboard (local JSON)
├─ index_api.html              # Legacy static dashboard (API‑backed)
│
├─ my-clerk-app/               # Optional Next.js + Clerk frontend
│  └─ ...                      # See my-clerk-app/README.md
│
├─ DEBTEASE_GUIDE.md           # Full pipeline & algorithm guide
├─ QUICK_START.txt             # High‑level summary of completed steps
└─ README.md                   # You are here
```

---

## 4. Quick start

### 4.1. Prerequisites

- Node.js 18+ and npm
- Python 3.10+ (for the data pipeline and `run_site.py`)

> If you are using GitHub Codespaces or a dev container, these are already available.

### 4.2. Install JavaScript dependencies

From the repo root:

```bash
npm install
```

This installs dependencies for the Vite React app under the root `package.json` (`debtease-react`).

If you also want to use the optional Next.js + Clerk app under `my-clerk-app/`:

```bash
cd my-clerk-app
npm install
cd ..
```

### 4.3. (Optional) Install Python dependencies

If you plan to run the raw data pipeline / algorithm from Python:

```bash
pip install pandas openpyxl requests
```

The exact pipeline is described in `DEBTEASE_GUIDE.md`, but the typical sequence is:

```bash
python merge_csv.py
python convert_to_json.py
python debt_ease_algorithm.py
```

This generates `merged_dataset.*`, `balances.json`, `settlements.json`, and `settlement_results.json`.

---

## 5. Run the React app

From the repo root:

```bash
npm run dev
```

This starts the Vite dev server (by default on port 5173). Open the printed URL in your browser.

Core routes (`src/App.jsx`):

- `/` – Landing page (`Home`)
- `/login` – Local login / user selection
- `/dashboard` – Main dashboard for a signed‑in user
- `/visualizer` – Graph visualizer of settlements
- `/net-balances` – Net balance table per participant
- `/add-expense` – Add new shared expense records
- `/settlement-plan` – Optimized settlement schedule
- `/vault` – View and manage vault documents

The app preserves theme and current user in `localStorage` and can optionally mirror Clerk auth (via `@clerk/clerk-react`) if you integrate it with the Next.js app.

---

## 6. Run the Python HTTP server (optional)

`run_site.py` is a standalone Python HTTP server that can:

- Serve `index.html` / `index_api.html` and static assets
- Provide a lightweight API for vault operations (`vault/metadata.json`)
- Optionally send email verification codes if SMTP is configured

To start it from the repo root:

```bash
python run_site.py
```

By default it listens on `http://127.0.0.1:8000` and opens `index.html` in your browser.  
To use email verification, configure these environment variables before running:

- `SMTP_HOST`
- `SMTP_PORT` (default `465`)
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM` (optional – falls back to `SMTP_USER`)

> If you only need the modern React dashboard, you can ignore `run_site.py` and use `npm run dev` instead.

---

## 7. Optional: Next.js + Clerk app (`my-clerk-app/`)

Under `my-clerk-app/` there is a separate Next.js  app that demonstrates how to:

- Use **Clerk** for authentication (`@clerk/nextjs`)
- Protect routes and show a signed‑in experience
- Potentially host a multi‑tenant DebtEase UI

Basic usage:

```bash
cd my-clerk-app
npm install        # if not done yet
npm run dev
```

Then configure your Clerk keys in `.env.local` as described in `my-clerk-app/README.md`.

This app is **optional** – the main DebtEase experience is in the root Vite React app.

---

## 8. Data pipeline & algorithm (high level)

The canonical description lives in `DEBTEASE_GUIDE.md`. In short:

1. **Merge datasets** – `merge_csv.py` aggregates multiple CSVs in `Dataset/` into `merged_dataset.csv` / `merged_dataset.xlsx`.
2. **Convert to JSON** – `convert_to_json.py` produces `merged_dataset.json` for APIs and frontends.
3. **Run algorithm** – `debt_ease_algorithm.py` (and the JS `algorithm.js`) compute:
	- Per‑person net balance  
	- A minimal set of settlement transactions using a greedy matching strategy.
4. **Visualize** – the React app (or `index.html`/`index_api.html`) show:
	- Summary stats (participants, original vs. optimized transactions)
	- Settlement schedule (debtor → creditor, amount)
	- Net balances and graphs of flows

Outputs like `balances.json`, `settlements.json`, and `settlement_results.json` can be fed into other tools or uploaded to JSONBin / APIs using `api_integration.py`.

---

## 9. Configuration & environment

**Front‑end (Vite React)**

- No required env vars for basic local usage.  
- If you wire it to Clerk or an external backend, add a `.env` file according to those services.

**Python server / email**

- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` as described in [Run the Python HTTP server](#6-run-the-python-http-server-optional).

**Datasets**

- Place additional CSVs into `Dataset/` and re‑run the Python pipeline (`merge_csv.py`, `convert_to_json.py`, `debt_ease_algorithm.py`).

---

## 10. Contributing / next steps

- Explore the algorithm in `debt_ease_algorithm.py` and `src/utils/algorithm.js`.
- Extend the **Visualizer** page with new graph types or metrics.
- Enhance the **AppAssistant** to answer more “why did I pay this?” style questions.
- Integrate the React app with the Next.js + Clerk setup for a unified auth story.

Bug reports, ideas, and improvements are welcome via issues or pull requests.

---

**Last updated:** April 14, 2026
