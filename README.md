# Agent Orchestra 🎼

> **Agent workspace for file analysis, Markdown deliverables, and website development**, with project-scoped files, revision history, and live website preview.

---

## 🌟 Overview

**Agent Orchestra** routes your request to the appropriate agent workflow. Upload files and ask for a summary, explanation, comparison, requirements document, guide, or other written answer—the **Document Analyst** saves the actual deliverable as a Markdown file. You can also ask general questions without uploading anything.

Website requests use the existing Manager → specialists → Coding Agent → QA workflow. Import a ZIP, folder, or selection of files, or generate a new site with separate pages, stylesheets, JavaScript modules, and assets.

In Chat and the Office dispatcher, **Output** offers **Auto**, **Markdown document**, and **Website / app**. Auto uses the Manager to choose the requested deliverable; explicit modes skip that classification call. The diagram below shows the website branch.

```
                    ┌─────────────────────────┐
                    │       USER REQUEST      │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │      MANAGER AGENT      │
                    │   (Plan & Agent Select) │
                    └────────────┬────────────┘
                                 │
                 ┌───────────────┼───────────────┐
                 ▼               ▼               ▼
          ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
          │   DESIGNER  │ │  FRONTEND   │ │   FEATURE   │
          │    AGENT    │ │  ARCHITECT  │ │  ARCHITECT  │
          │ (UI/UX, CSS)│ │(DOM, State) │ │ (Behavior)  │
          └──────┬──────┘ └──────┬──────┘ └──────┬──────┘
                 │               │               │
                 └───────────────┼───────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │    MANAGER SYNTHESIS    │
                    │ (Unified Implementation)│
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │      CODING AGENT       │
                    │  (Stages file changes)  │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │        QA AGENT         │
                    │   (Structured Audit)    │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │      LIVE PREVIEW       │
                    │   (Interactive iframe)  │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │     HUMAN FEEDBACK      │
                    │(Minimal Change Editing) │
                    └─────────────────────────┘
```

---

## 🏛️ Core Architectural Principles

### 1. Agents and Models Are Decoupled
- **Agents** are logical personas with specific skills, boundaries, and prompt contracts.
- **Models** are inference engines (`moonshotai/kimi-k3` via NVIDIA NIM).
- Agents never call provider endpoints directly. All inference flows through the centralized **Model Gateway**. Changing models requires zero rewrites to agents or orchestration logic.

### 2. Project-Scoped Files and Revisions
- Each project has its own manifest, source files, binary assets, and revision history:
  ```text
  projects/
  ├── sports-ecommerce-1727623910-abcd/
   │   ├── index.html
   │   ├── css/main.css
   │   ├── js/app.js
   │   ├── pages/about.html
   │   ├── assets/logo.png
   │   ├── project.json     <- Committed manifest and metadata
   │   └── .orchestra/      <- Immutable local blobs and revision snapshots
  └── boutique-store-1727623990-wxyz/
      ├── index.html
      └── project.json
  ```
- The committed manifest is authoritative; source files on disk are compatibility mirrors. MongoDB mode stores blobs in GridFS and snapshots in `project_revisions`.
- A file batch publishes as one revision. Stale edits are rejected with HTTP `409`; rollback creates a new revision without erasing history.

### 3. Sole Implementation Ownership
- The **Coding Agent** owns application changes across all files. Specialists provide plans, including a file tree, entry point, and dependencies. Manual edits are available in the IDE.
- The **Document Analyst** reads project files and creates a new Markdown deliverable. It has no source-edit/delete tool; original uploads are preserved.

### 4. Minimal Change Preservation Rule (Human Feedback)
- Existing projects, including uploads, use the contextual editing flow. The agent receives the file tree and relevant source, can request additional files, and must read existing files before modifying them.
- Omitted files remain byte-for-byte unchanged. Renames and deletions are explicit; all staged batches commit together after a complete response.

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js 24** (the verified runtime).
- API keys for the providers selected by your model/budget routing: NVIDIA NIM, Google Gemini, and/or OpenRouter. File import, manual editing, preview, and revision history work without model keys.

### 2. Environment Setup
Create `.env` from `.env.example` if you do not already have one. The default local configuration is:
```env
PORT=3000
HOST=localhost
PREVIEW_PORT=3001
# Add the API keys for your selected providers.
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Run Automated Tests
```bash
npm test
```
This uses disposable filesystem storage and mocked model providers. MongoDB checks are opt-in; see **Verification** below.

### 5. Launch the Platform
```bash
npm run dev
# or: npm start
```
Open **`http://localhost:3000`** in your browser.

The same process also starts the read-only preview server on port **3001**. Local project previews use `<projectId>.localhost:3001`, providing separate browser storage per project. When accessing the studio from another machine, set `HOST=0.0.0.0` and make both ports accessible. Behind HTTPS/reverse proxies, set `PREVIEW_ORIGIN` to a separate preview origin; use `https://{projectId}.preview.example.com` with wildcard DNS/TLS for per-project origins. Proxy that host to the preview listener, never the studio listener.

---

## 🖥️ Dashboard Features

1. **Agent Registry & Playground (Left Panel)**: Real-time agent state indicators (`IDLE`, `WORKING`, `STREAMING`, `COMPLETED`, `RETRYING`, `ERROR`) with active pulse glow animations.
2. **Orchestration Flow & Pipeline (Center Panel)**:
   - 7-step visual execution pipeline.
   - Live streaming terminal log with timestamped progress.
   - Interactive QA Audit card displaying overall verdict and categorized findings.
3. **Live Preview & Human Feedback (Right Panel)**:
   - Sandboxed iframe with auto-reloading preview.
   - Viewport switcher: Desktop (100%), Tablet (768px), and Mobile (375px).
   - Project switcher dropdown to jump between isolated projects.
    - Direct-to-Coder Human Feedback card for targeted edits.
4. **IDE Workspace**: Nested explorer, full-path file selection, text editing, create/rename/delete, binary download, entry-page selection, revision diffs, and restore.
5. **Document Tasks**: Upload directly from Chat, choose an output mode, and open/download the generated `.md` file. Task progress shows source inspection and writing rather than website-building stages.

## 📝 Summaries, Explanations, and Other Written Tasks

1. In **Chat**, choose **Upload files**, or import files from the IDE. Select a saved project to use its existing material instead.
2. Leave Output on **Auto**, or select **Markdown document**.
3. Describe the deliverable, audience, and level of detail. For example:
   - “Summarize these files in five key points and list the action items.”
   - “Explain this code step by step for a beginner, with examples.”
   - “Compare these documents and list conflicting requirements.”
   - “Turn these notes into a requirements document with acceptance criteria.”
   - “Explain reinforcement learning with a simple example.” (No upload needed.)
4. The result opens in the IDE as `documents/<title>.md`. Chat also provides **Open Markdown** and **Download .md** actions. Each response creates a new revision and a new filename if the title was already used.

The file contains the requested response itself, followed by **Source coverage** describing which files/text ranges were available to the agent. Document-only projects do not need `index.html` and do not run website QA. You can also ask for an explanation of an existing website without modifying its HTML, CSS, scripts, or assets.

### Readable Material

- UTF-8 text, Markdown, source code, CSV/TSV, JSON, XML, YAML, logs, and other plain-text files.
- **Text-based PDF** and **DOCX**, extracted in bounded worker threads. Original binary files remain unchanged and downloadable.
- Image-only/scanned PDFs, images, audio/video, legacy `.doc`, and other unsupported binary formats require a different reader/OCR. Unavailable or partially inspected material is identified in Source coverage. If none of the uploaded files provide readable text, the task fails with an explanation instead of inventing a summary.

Analysis allows at most 12 agent turns, up to 6 excerpts of 16,000 characters per turn, and 24,000 characters of carried-forward evidence notes. Extraction is limited to 2 million characters/file, 200 PDF pages, and 30 seconds per PDF/DOCX worker. Truncation and incomplete coverage are reported. Document generation uses the selected implementation-tier model/fallbacks through the same gateway and spend tracking as website generation.

## 📂 Import and Continue an Existing Website

1. Open **IDE → Import** and choose a ZIP, folder, or multiple files.
2. Set the project name. Keep **strip outer folder** enabled for a ZIP/folder containing one enclosing directory; disable it when that directory is part of your website's paths.
3. Import into a new project, or choose the current project to add/replace matching files. Files omitted from an upload are preserved.
4. Select the HTML entry page and open **Preview**. Relative pages/assets, CSS, browser ES modules, images, fonts, and local storage are supported.
5. Edit files directly, or send a targeted request in Chat/Feedback. Open **History** to inspect changes or restore a previous snapshot.

### Supported Scope and Limits

- Preview executes **browser-ready static HTML/CSS/JavaScript**. Framework source such as React/Vite/Next.js can be imported and edited, but is marked source-only. Build that project externally and import its static output as a separate project for preview. Orchestra does not install uploaded dependencies or start application servers.
- Up to **500 tracked files**, **10 MB per file**, **50 MB total**, and **25 MB per ZIP**; ZIP expanded contents also obey project limits. Agent reports count toward tracked-file limits.
- Dependency/cache folders, VCS metadata, `.env` files, and platform junk are filtered. Unsafe paths, symlinks, duplicate/case-conflicting paths, and file/directory collisions are rejected.
- Preview resolves relative URLs and rewrites root-relative HTML/CSS URLs and literal JavaScript module/`fetch` URLs. Dynamically constructed absolute URLs, remote APIs, and external services still depend on the site's implementation and network configuration.
- QA combines JavaScript/JSON parsing, local-reference and DOM checks, and a model audit. This is not automatic browser execution of every generated site. Findings remain visible even when a revision was saved successfully.
- Existing budget selection uses estimated per-call prices and a pre-run check; it is not a hard spending cap during multi-round generation. Spend tracking is currently in memory.

### Storage

Without a Mongo URI, data is stored under `projects/` and `workspace/`. Set `ORCHESTRA_DATA_DIR` to choose their parent directory, or `ORCHESTRA_STORAGE=filesystem` to explicitly use local storage.

Set `MONGO_URI` and optionally `MONGO_DB_NAME` for MongoDB/GridFS persistence. Legacy nested filesystem and `project_files` data are migrated on their first source edit, retaining a baseline revision. Back up the complete data directory in filesystem mode; in MongoDB mode back up the database including GridFS. Disk mirrors alone are not a MongoDB backup or a storage-mode migration.

## ✅ Verification

```bash
npm test

# Install Chromium once; Linux may also need Playwright system dependencies.
npx playwright install chromium
npm run test:browser

# Starts a disposable local MongoDB process; downloads its binary on first use.
npm run test:mongo
```

On supported Linux distributions, `npx playwright install-deps chromium` installs the browser's OS dependencies. Use `PLAYWRIGHT_BROWSERS_PATH` if you keep browser binaries in a custom cache.

All test commands isolate application data and use mocked model responses. PDF/DOCX extraction uses the real parsers. `test:browser` covers website import/editing/preview/revisions, automatic routing, document upload/analysis, Markdown open/download, source preservation, and explanations without uploads through the actual HTTP/SSE pipeline. `test:mongo` exercises document and website persistence, GridFS, revisions, and competing processes. To use an existing test MongoDB server, set `ORCHESTRA_TEST_MONGO_URI` when running `npm test`; the runner uses a uniquely named disposable database, not your application database.

The studio served by `npm start` is `src/client/`. The separate root `client/` and `dist/` directories are not the frontend served by this Express application.

---

## 📡 REST & SSE API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Gateway & API key status check |
| `GET` | `/api/models` | Available model registry & retry policies |
| `GET` | `/api/agents` | All registered logical agents and assigned models |
| `POST` | `/api/agents/:id/model` | Dynamically reassign an agent's model |
| `GET` | `/api/projects` | List all isolated projects |
| `GET` | `/api/projects/:id` | Get project metadata & specifications |
| `POST` | `/api/projects` | Create an empty project |
| `POST` | `/api/projects/import` | Import a ZIP/folder/multiple files as a new project |
| `POST` | `/api/projects/:id/import` | Add/replace files with `expectedRevision` |
| `GET` | `/api/projects/:id/files` | File metadata, full relative paths, revision and entry point |
| `GET` | `/api/projects/:id/files/:path` | Read a nested file; `?download=true` downloads original bytes |
| `POST` | `/api/projects/:id/changes` | Commit create/update/delete/rename actions |
| `GET` | `/api/projects/:id/preview-info` | Preview URL and runtime support status |
| `GET` | `/api/projects/:id/preview` | Redirect to the separate preview origin |
| `GET` | `/api/projects/:id/revisions` | Revision history |
| `GET` | `/api/projects/:id/revisions/:revision` | Textual/binary change summary and diffs |
| `POST` | `/api/projects/:id/revisions/:revision/restore` | Restore as a new revision with `expectedRevision` |
| `POST` | `/api/orchestrate/spec` | Run Manager Plan -> Specialists -> Synthesis |
| `POST` | `/api/orchestrate/task` | General request: auto-route, create Markdown, or build/edit a website |
| `POST` | `/api/orchestrate/build` | Generate a new site, or contextually edit an existing project |
| `POST` | `/api/orchestrate/feedback` | Apply targeted human feedback edit |
| `GET` | `/api/orchestrate/events` | Real-time Server-Sent Events (SSE) stream |

Multipart uploads use field `files`, optional JSON `paths` (one relative path per file), `name`, `stripRoot`, and `entryPoint`. Existing-project uploads require `expectedRevision`.

Example JSON body for `/api/projects/:id/changes`:

```json
{
  "expectedRevision": 1,
  "note": "Update shared styling",
  "changes": [
    { "action": "update", "path": "css/main.css", "content": "body { color: navy; }" },
    { "action": "rename", "path": "pages/about.html", "to": "pages/team.html" }
  ]
}
```

Renaming a file does not automatically rewrite its references; include the corresponding source edits in the same request. To change only the preview page, send `changes: []`, `entryPoint`, and `expectedRevision`. Agent-run events carry `projectId` and `runId`; SSE supports `?projectId=...` filtering.

Example request to `/api/orchestrate/task`:

```json
{
  "projectId": "your-uploaded-project-id",
  "prompt": "Explain these files for a beginner and list the requirements",
  "taskType": "document",
  "outputPath": "documents/explanation.md",
  "budget": 0.35
}
```

`projectId` is optional for a new task without uploads. `taskType` defaults to `auto` and accepts `website` or `document`. `outputPath` is optional, must end in `.md`, and must be unused. Document responses contain `data.taskType`, `data.revision`, and `data.document` (`path`, `title`, `sources`, `warnings`). File content is available from the usual project-file read/download endpoint. Document SSE stages are `TASK_ROUTING_STARTED`, `TASK_ROUTED`, `DOCUMENT_STARTED`, `DOCUMENT_READING`, `DOCUMENT_COMPLETED`, and `TASK_FAILED`.
