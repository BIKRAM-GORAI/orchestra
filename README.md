# OmniVerse (Agent Orchestra) 🎼

> **Autonomous Multi-Agent Web & Document Engineering Platform** featuring a **16-Agent Multi-Tier Staff Roster**, **Pixi.js 2.5D Animated Virtual Office**, **Simple Mode (1-Click Instant Deploy)**, **Multi-Provider AI Gateway** (NVIDIA NIM Kimi K3, Gemini 3.5 Flash, Mistral Codestral), **Intelligent Budget Allocation Engine**, **Sandboxed Live Preview**, and **Atomic Versioned Storage** (Filesystem or MongoDB + GridFS).

---

## 📚 Quick Documentation Links

| Resource | Description | Location |
| :--- | :--- | :--- |
| 📖 **Technical Documentation (A to Z)** | Comprehensive architecture, agent roles, and guides | [`src/client/docs.html`](src/client/docs.html) / [`/docs`](http://localhost:3000/docs.html) |
| 📡 **API Reference** | Full REST endpoints, SSE streams, payload schemas & cURL | [`API_REFERENCE.md`](API_REFERENCE.md) |
| 🚀 **Releases & Changelog** | v1.0.0 (Hackathon Launch) & v2.0.0 (Production) | [`RELEASES.md`](RELEASES.md) |
| 📜 **Terms of Service** | Usage policy, code ownership, and platform terms | [`TERMS.md`](TERMS.md) |
| 🔒 **Privacy Policy** | Data handling, model gateway transmission, and security | [`PRIVACY.md`](PRIVACY.md) |
| 📄 **MIT License** | Open-source software license | [`LICENSE`](LICENSE) |

---

## 🌟 Overview

**OmniVerse (Agent Orchestra)** transforms natural-language requests into production-grade multi-file websites or comprehensive, source-grounded Markdown documents. It pairs a **16-agent team of specialists** with an intelligent **Manager (Atlas)**, coordinating visual design, frontend architecture, interaction behavior, implementation, deterministic validation, and QA audits.

The platform provides two complementary ways to create and inspect software:
1. **Simple Mode (`simple.html`)**: Instant 1-prompt generation with live deployed sandbox previews (`/p/:id`), downloadable code zips, and mobile-friendly controls.
2. **Studio Atelier (`index.html`)**: Watch your agents collaborate in real-time inside a **Pixi.js 2.5D isometric virtual office simulation**, follow real-time streaming telemetry across a 4-quadrant layout, test your applications in a multi-device simulator, and collaborate via targeted human feedback.

```
                            ┌─────────────────────────┐
                            │       USER REQUEST      │
                            │ (Chat / Dispatch / API) │
                            └────────────┬────────────┘
                                         │
                                         ▼
                            ┌─────────────────────────┐
                            │    ROUTING & BUDGET     │
                            │(Auto-Detect / Tier Pick)│
                            └────────────┬────────────┘
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 │                                               │
                 ▼                                               ▼
       [ Website / App Flow ]                         [ Document Analyst Flow ]
  ┌─────────────────────────────┐                  ┌─────────────────────────────┐
  │        MANAGER AGENT        │                  │      DOCUMENT ANALYST       │
  │     (Atlas - Plan & Spec)   │                  │  (Bounded Excerpts/Workers) │
  └──────────────┬──────────────┘                  └──────────────┬──────────────┘
                 │                                                │
   ┌─────────────┼─────────────┐                   ┌──────────────┴──────────────┐
   ▼             ▼             ▼                   ▼                             ▼
┌───────┐   ┌─────────┐   ┌─────────┐       ┌──────────────┐              ┌──────────────┐
│DESIGN │   │FRONTEND │   │ FEATURE │       │  PDF / DOCX  │              │ UTF-8 Source │
│(3 Tiers)  │(3 Tiers)│   │(3 Tiers)│       │  Extraction  │              │ Text Analysis│
└───────┬─┘ └────┬────┘   └────┬────┘       └──────┬───────┘              └──────┬───────┘
        │        │             │                   │                             │
        └────────┼─────────────┘                   └──────────────┬──────────────┘
                 │                                                │
                 ▼                                                ▼
  ┌─────────────────────────────┐                  ┌─────────────────────────────┐
  │      MANAGER SYNTHESIS      │                  │    MARKDOWN DELIVERABLE     │
  │  (Unified Architecture Spec)│                  │(documents/<title>.md + Cov.)│
  └──────────────┬──────────────┘                  └──────────────┬──────────────┘
                 │                                                │
                 ▼                                                ▼
  ┌─────────────────────────────┐                  ┌─────────────────────────────┐
  │        CODING AGENT         │                  │    IDE / DOWNLOAD EXPORT    │
  │ (Byte / Cipher / Matrix)    │                  │  (Atomic Provenance Commit) │
  └──────────────┬──────────────┘                  └─────────────────────────────┘
                 │
                 ▼
  ┌─────────────────────────────┐
  │ DETERMINISTIC AUDIT + QA    │
  │  (Acorn/DOM + Sentinel/QA)  │
  └──────────────┬──────────────┘
                 │
                 ▼
  ┌─────────────────────────────┐
  │  SANDBOXED LIVE PREVIEW     │
  │ (Isolated Project Origin)   │
  └──────────────┬──────────────┘
                 │
                 ▼
  ┌─────────────────────────────┐
  │  HUMAN-IN-THE-LOOP FEEDBACK │
  │ (Minimal Change Preserved)  │
  └─────────────────────────────┘
```

---

## 🏛️ Core Architectural Pillars

### 1. Decoupled 16-Agent Multi-Tier Staff Roster
Agents are logical personas with strict boundaries, schemas, and skills. They never invoke LLM APIs directly. Inference is routed dynamically through the **Model Gateway**.

The agency employs **16 registered staff members** across **3 specialization tiers**:

| Role | Free Tier (`-1`)<br>*(Codestral Latest)* | Pro Tier (`-2`)<br>*(Kimi K3)* | Max Tier (`-3`)<br>*(Gemini 3.5 Flash Lite)* | Responsibilities |
|---|---|---|---|---|
| **Manager** | — | — | **Atlas** (`manager-1`) | Intent routing, specialist delegation, graph planning, unified specification synthesis. |
| **Designer** | **Pixel** (`designer-1`) | **Chroma** (`designer-2`) | **Canvas** (`designer-3`) | Design systems, color palettes, typography, glassmorphism, responsive UX. |
| **Frontend Architect** | **Nova** (`frontend-1`) | **Blueprint** (`frontend-2`) | **Apex** (`frontend-3`) | DOM hierarchy, file tree structure, CSS/JS modularity, dependencies. |
| **Feature Architect** | **Scout** (`feature-1`) | **Beacon** (`feature-2`) | **Compass** (`feature-3`) | User journeys, state transitions, interactive behaviors, edge cases. |
| **Coding Agent** | **Byte** (`coder-1`) | **Cipher** (`coder-2`) | **Matrix** (`coder-3`) | **Sole implementation owner**. Stages atomic multi-file edits, renames, and deletions. |
| **QA Auditor** | **Query** (`qa-1`) | **Audit** (`qa-2`) | **Sentinel** (`qa-3`) | AST validation, broken link/import auditing, DOM completeness checks. |
| **Document Analyst** | — | — | Run-local Specialist | Deep file analysis, PDF/DOCX extraction, source-grounded Markdown reports. |

### 2. Tri-Provider Model Gateway & Automatic Fallback Cascades
Inference runs through a unified provider-agnostic gateway supporting streaming, token usage calculation, exponential backoff, and automatic fallback chains:

1. **Lead / Premium**: **Google Gemini 3.5 Flash / Flash Lite** (`gemini-3.5-flash-lite`, `gemini-3.5-flash`) via Google AI Studio. 32,768 output tokens, ultra-low latency, and structured reasoning.
2. **Standard / Deep Reasoning**: **Moonshot AI Kimi K3** (`kimi-k3` / `moonshotai/kimi-k3`) via NVIDIA NIM. 16,384 output tokens with deep chain-of-thought capability (`reasoning_effort: max`).
3. **Budget / Free**: **Mistral AI Codestral** (`codestral-latest`). 256,000 token context window, 16,384 output tokens, optimized for code generation. *(Replaces deprecated OpenRouter free models to prevent output clamping).*
4. **Quota Guard & Cascade Fallback**: If an upstream model encounters rate limits, transient `5xx` errors, or daily quota exhaustion (`RESOURCE_EXHAUSTED`), the gateway automatically cascades to configured fallback models without breaking active pipelines.

### 3. Dynamic Budget Allocation Engine
Optimize spend per project across 3 pricing tiers:
- **Free Tier ($0.00)**: Deploys all Free-tier specialists powered by Mistral Codestral.
- **Lean / Balanced Tier ($0.05 – $0.49, default $0.25)**: Smart prioritization engine allocates the high-performance **Matrix** (`coder-3`) for code generation, balancing research and planning specialists on standard/free tiers.
- **Premium Tier ($0.50+, uncapped)**: Deploys the top-tier Max specialist roster powered by Gemini 3.5 Flash Lite and Kimi K3.
- **Spend Tracking & Guardrails**: In-memory expenditure tracking per project with automatic budget caps (`HTTP 402` returned when budget limit is reached).

### 4. Interactive Virtual Office & Modern UI Experiences
- **Pixi.js 2.5D Animated Office**: Real-time canvas simulation featuring isometric desks, animated agent sprites, activity badges, thinking bubbles, and walking/working states.
- **4-Quadrant Studio Atelier**:
  - **Left**: Agent Team Roster & live status badges (`IDLE`, `WORKING`, `STREAMING`, `COMPLETED`, `RETRYING`, `ERROR`).
  - **Center**: Dual Chat Wire, real-time pipeline visualizer, and color-coded streaming terminal logs.
  - **Right**: Sandboxed Live Preview with responsive viewports (Desktop 100%, Tablet 768px, Mobile 375px) and Direct-to-Coder Human Feedback card.
  - **Bottom / Drawer**: Multi-file nested IDE with syntax highlighting, diff viewer, and revision restore.
- **Paperclip-Inspired Minimal Landing Page** (`/home`): Minimalist luxury landing page with interactive, connected organizational chart illustrating agent hierarchies.

### 5. Multi-File Project Workspace & Nested IDE
- Full directory hierarchies: HTML pages, CSS stylesheets, ES modules, images, fonts, and data files.
- Drag-and-drop ZIP, folder, and multi-file imports with path normalization and malicious file/symlink filtering.
- In-memory working tree (`agentFileSession.js`) supporting iterative file reads (up to 12 files / 160k characters per round) with atomic staged commits.
- **Minimal Change Preservation Rule**: Targeted feedback edits only touch requested files, keeping untouched source code byte-for-byte intact.

### 6. Dual-Engine Storage & Concurrency
- **Filesystem Mode** (Default): Committed manifests in `projects/<id>/project.json`, immutable content-addressed blobs in `.orchestra/blobs/`, revision records in `.orchestra/revisions/`, protected with cross-process file locks (`proper-lockfile`).
- **MongoDB + GridFS Mode**: High-scale distributed storage storing manifests in `projects`, snapshots in `project_revisions`, and binary/text blobs in `orchestra_blobs` GridFS with `_generation` Compare-And-Swap (CAS) optimistic concurrency.
- **Zero-Data-Loss History**: Revisions increment monotonically. Stale edits return `HTTP 409 Conflict`. Rollback creates a new revision without destroying past snapshots.

### 7. Isolated Multi-Origin Live Preview
- Separate read-only preview server running on `PREVIEW_PORT` (default `3001`).
- Origin isolation via `<projectId>.localhost:3001` guarantees that project scripts, cookies, and `localStorage` cannot access or compromise Studio APIs.
- Strict Content Security Policy (CSP) sandboxing with root-relative and module URL rewriting.

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js 24+** (ESM native runtime).
- API keys for your preferred model providers:
  - **Google Gemini** (Recommended primary): [Google AI Studio](https://aistudio.google.com/)
  - **NVIDIA NIM** (Reasoning tier): [NVIDIA Build](https://build.nvidia.com/)
  - **Mistral AI** (Free/Budget tier): [Mistral Console](https://console.mistral.ai/)
- *(Optional)* **MongoDB 6+** for enterprise persistence.

### 2. Installation
```bash
git clone https://github.com/BIKRAM-GORAI/orchestra.git
cd orchestra
npm install
```

### 3. Environment Configuration
Create a `.env` file in the root directory (refer to `.env.example`):
```env
# Server Configuration
PORT=3000
HOST=localhost
PREVIEW_PORT=3001

# Model Provider API Keys
GEMINI_API_KEY=your_gemini_api_key_here
NVIDIA_API_KEY=your_nvidia_api_key_here
MISTRAL_API_KEY=your_mistral_api_key_here

# Optional: MongoDB Storage (defaults to local filesystem if blank)
# MONGO_URI=mongodb://localhost:27017
# MONGO_DB_NAME=orchestra
```

### 4. Running the Platform
```bash
# Start in development mode (with server auto-restart)
npm run dev

# Or run in standard production mode
npm start
```

Access the interfaces:
- **Studio Atelier & Virtual Office**: [http://localhost:3000](http://localhost:3000)
- **Paperclip Org Tree Landing Page**: [http://localhost:3000/home](http://localhost:3000/home)
- **Live Preview Listener**: [http://localhost:3001](http://localhost:3001)

---

## 🛠️ Verification & Test Suite

The test suite covers provider contracts, model gateway fallbacks, budget allocation, multi-round agent sessions, document analysis workers, concurrency locks, and revision rollbacks:

```bash
# Run the complete test suite (unit, integration & gateway mocks)
npm test

# Run browser automated workflow tests (requires Playwright Chromium)
npx playwright install chromium
npm run test:browser

# Run MongoDB persistence & GridFS concurrency tests
npm run test:mongo
```

---

## 📡 REST & Real-Time SSE API Reference

### Orchestration & Execution

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/orchestrate/task` | Unified entry point: auto-classifies intent, produces Markdown document or builds website. |
| `POST` | `/api/orchestrate/build` | Initiates full website generation pipeline (Manager → Specialists → Coder → QA). |
| `POST` | `/api/orchestrate/feedback` | Sends human-in-the-loop feedback directly to Coding Agent with Minimal Change preservation. |
| `POST` | `/api/orchestrate/spec` | Executes Manager decomposition, parallel specialist planning, and specification synthesis. |
| `GET` | `/api/orchestrate/events` | Real-time Server-Sent Events (SSE) stream (`agentState`, `pipeline`, and `heartbeat`). |

#### Task Execution Payload (`POST /api/orchestrate/task`)
```json
{
  "prompt": "Analyze uploaded contracts, extract key milestones, and compare liability clauses.",
  "taskType": "auto",
  "projectId": "project-id-optional",
  "budget": 0.25,
  "outputPath": "documents/contract_analysis.md"
}
```
*Note: `taskType` accepts `"auto"`, `"document"`, or `"website"`. Omit `projectId` to automatically create a new project workspace.*

---

### Budget & Model Management

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/budget/status` | Current budget limit, active project spend, budget tier descriptions, and model registry. |
| `POST` | `/api/budget/allocate` | Dynamically re-assigns the 16-agent roster and fallback chains based on budget amount. |
| `GET` | `/api/models` | List all available registered models, latency profiles, pricing, and retry policies. |
| `GET` | `/api/agents` | List active agent team configurations, assigned model IDs, and fallback cascades. |
| `POST` | `/api/agents/create` | Instantiate a new dynamic specialist with a unique sequential ID (`designer-4`, `coder-4`). |
| `PUT` | `/api/agents/:id/config` | Update an agent's primary model and fallback model cascade. |
| `POST` | `/api/agents/:id/model` | Quick reassignment of an agent's primary model. |

---

### Project & File Workspace Management

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/projects` | List all projects with metadata, revision counters, and file counts. |
| `POST` | `/api/projects` | Create a new empty project. |
| `GET` | `/api/projects/:id` | Fetch project details, specifications, and QA reports. |
| `POST` | `/api/projects/import` | Upload a ZIP, folder, or multi-file bundle to initialize a new project. |
| `POST` | `/api/projects/:id/import` | Import files into an existing project (requires `expectedRevision`). |
| `GET` | `/api/projects/:id/files` | Get full-path manifest, revision number, entry point, and project type. |
| `GET` | `/api/projects/:id/files/:path` | Read file content (`?download=true` for binary download). |
| `POST` | `/api/projects/:id/changes` | Commit staged batch of file additions, modifications, renames, and deletions. |
| `GET` | `/api/projects/:id/preview-info` | Get sandboxed preview URL and runtime compatibility status. |
| `GET` | `/api/projects/:id/preview` | Direct redirect to the project's sandboxed preview origin. |
| `GET` | `/api/projects/:id/revisions` | Retrieve revision history timeline. |
| `GET` | `/api/projects/:id/revisions/:rev` | View detailed unified text diffs and binary change summaries. |
| `POST` | `/api/projects/:id/revisions/:rev/restore` | Restore a historical snapshot as a new revision. |

#### File Changes Batch Payload (`POST /api/projects/:id/changes`)
```json
{
  "expectedRevision": 3,
  "note": "Refactor navigation and update theme tokens",
  "changes": [
    { "action": "update", "path": "css/theme.css", "content": ":root { --brand: #6366f1; }" },
    { "action": "rename", "path": "pages/old-contact.html", "to": "pages/contact.html" },
    { "action": "delete", "path": "temp.js" }
  ]
}
```

---

## 📁 Repository Structure

```text
orchestra/
├── src/
│   ├── client/                  # Frontend UI Assets
│   │   ├── home.html            # Landing page with glassmorphic navbar & Section 6 showcase
│   │   ├── simple.html          # Simple Mode (1-prompt web app generator)
│   │   ├── docs.html            # Complete A to Z technical documentation
│   │   ├── index.html           # 4-Quadrant Atelier studio application
│   │   ├── home.css             # Landing page styles & mobile responsive media queries
│   │   ├── simple.css           # Simple Mode stylesheet
│   │   ├── index.css            # Atelier design system & dark theme tokens
│   │   └── js/
│   │       ├── app.js           # Studio client controller & SSE stream coordinator
│   │       ├── simple.js        # Simple Mode client pipeline controller
│   │       ├── home.js          # Interactive video scale & cursor interpolation
│   │       ├── pixi-office.js   # Pixi.js 2.5D isometric virtual office simulation
│   │       ├── office.js        # Office telemetry, agent desk mapping & state sync
│   │       ├── agent-state.js   # Real-time state machine & activity feeds
│   │       └── project-workspace.js # Multi-file IDE explorer, diffs, & file editor
│   └── server/                  # Backend Node.js Services (ESM)
│       ├── index.js             # Express application & preview server listeners
│       ├── agents/              # Agent Registry & Logical Personas
│       ├── config/              # Central Configuration (env, models, pricing)
│       ├── db/                  # Persistence Layer (MongoDB / GridFS)
│       ├── gateway/             # Multi-Model AI Gateway (Kimi, Gemini, Codestral)
│       ├── orchestrator/        # Multi-agent graph runner & SSE broadcaster
│       ├── providers/           # Provider Adapters (NVIDIA NIM, Gemini, Mistral)
│       ├── routes/              # Express API Routes (orchestrate, projects, preview)
│       └── services/            # Budget, storage, document text parsing & validation
├── API_REFERENCE.md             # Complete REST & SSE API specification
├── RELEASES.md                  # Release notes for v1.0.0, v2.0.0 & future roadmap
├── TERMS.md                     # Platform terms of service & code ownership
├── PRIVACY.md                   # Privacy policy & model gateway transmission
├── LICENSE                      # Official MIT License
├── scripts/                     # Automated test suites (55 verified cases)
├── projects/                    # Local storage directory for isolated project files
└── package.json                 # Project dependencies and test scripts
```

---

## 🔒 Security & Sandboxing

1. **Origin Isolation**: Previews run on dedicated origins (`<projectId>.localhost:3001` or separate domains configured via `PREVIEW_ORIGIN`). Preview pages are strictly blocked from invoking Studio APIs via Origin header validation.
2. **Content Security Policy (CSP)**: Sandboxed iframe headers restrict script execution to project resources and disallow privilege escalation.
3. **Upload Sanitization**: Upload archives and folders are checked against path traversal (`../`), reserved filenames, symlinks, binary limits (10 MB/file, 50 MB total), and malicious file extensions.
4. **Worker Thread Bounding**: PDF and DOCX extraction run inside isolated Node.js worker threads restricted to 30-second timeouts, 192 MB heap limits, and max 2,000,000 character extraction bounds to prevent memory denial-of-service.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
