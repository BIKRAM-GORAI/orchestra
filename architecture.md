# Agent Orchestra — Architecture & Architectural Decisions

Current scope: general written tasks and source-grounded Markdown deliverables, plus multi-file static website generation/editing and isolated browser preview. Framework source is editable but has no managed build/runtime.

## Request Routing and Document Workflow

`POST /api/orchestrate/task` is the general entry point. `taskType: auto` invokes the Manager with a dedicated routing prompt and schema, independent of its website-planning contract. Explicit `document`/`website` modes skip classification. Explaining a website is a document task; building a site from notes is a website task. Existing `/build`, `/spec`, and `/feedback` APIs retain their explicit website behavior.

Document tasks instantiate a run-local **Document Analyst**, using the selected implementation-tier model and fallback chain. Its independent prompt supports summaries, explanations, comparisons, requirements, guides, and general questions. It cannot issue source changes: the service only accepts a completed Markdown response and saves one new `.md` file. Website stages and website QA are bypassed.

`documentSession.js` provides a revision-pinned, read-only file inventory and bounded excerpts. The analyst can request additional ranges and carry evidence notes between turns. Server-owned coverage records are updated only for excerpts delivered to the model, with partial/unread/unavailable status. Unread source citations, malformed responses, unsupported binary-only input, and stale revisions fail without publishing a document. New output paths avoid existing files; explicit paths cannot overwrite uploads. Content and `lastTask` provenance publish in the same manifest commit, and restore restores/clears task metadata with its snapshot.

UTF-8 source text is decoded directly. `documentTextWorker.js` uses `unpdf` for PDF text and `mammoth` for DOCX raw text, with DOCX ZIP expansion checks. Workers have a 30-second timeout and 192 MB old-generation heap bound; extraction stops at 2 million characters or 200 PDF pages. There is no OCR or uploaded-code execution. Source-coverage information is appended to the Markdown output independently of model assertions. Binary originals remain intact.

Document workspaces use `projectType: documents` and no HTML entry point. Adding a document to a website preserves its entry point and website QA metadata. Chat/dispatcher mode controls feed the generic API; completed documents open in the IDE with download links, and progress uses document-specific SSE stages. Markdown is displayed as text rather than inserted as executable HTML. The usual manual editing, revision diffs, and restore operations also apply to documents.

## 1. Core Architectural Principle: Separation of Agents and Models

An **Agent** is a logical role, defined by:
- Name and identity
- Core responsibilities and boundaries
- Specialized skills and prompt instructions
- Output contracts and schemas
- Configured model assignment

A **Model** is an inference engine, defined by:
- Provider adapter (e.g. NVIDIA NIM, Gemini, OpenRouter, Ollama)
- Endpoint configuration
- Default inference parameters (max_tokens, temperature, reasoning_effort)
- Capabilities (streaming, reasoning, chat)

**Agents never communicate directly with provider APIs.** All agent requests pass through the centralized **Model Gateway**. Changing an underlying model never requires modifying agent definitions, prompt schemas, or orchestration state machines.

```
                  AGENT ORCHESTRATOR
                         │
                  AGENT RUNTIME
                         │
                   MODEL GATEWAY
                         │
         ┌───────────────┴───────────────┐
         ▼                               ▼
     NVIDIA PROVIDER             OTHER PROVIDERS
   (moonshotai/kimi-k3)        (Gemini, OpenRouter)
```

---

## 2. Model Gateway & Provider Abstraction

- **Centralized Gateway**: Responsible for model selection, provider dispatch, request streaming, error handling, timeout management, and retry backoff.
- **Provider Adapters**: Standardized interface (`generate(messages, options, onChunk)`) converting internal parameters to provider-specific payloads and streaming chunk events back.
- **MVP Provider**: NVIDIA NIM chat completions (`https://integrate.api.nvidia.com/v1/chat/completions`) using `moonshotai/kimi-k3`.
- **Routing and Fallbacks**: `config/models.js`, provider adapters, and the budget service define primary models, retry policy, and fallback lists. Logical agents remain independent of provider selection.

---

## 3. Logical Agent Registry

1. **Manager**: Decomposes user goal, selects relevant specialists, plans execution graph, and synthesizes specialist outputs into a single Unified Implementation Specification. Does NOT write code.
2. **Designer**: Defines visual direction, color system, typography, responsive layout rules, spacing, and interaction styles. Does NOT write code.
3. **Frontend Architect**: Defines the file tree, entry points, shared CSS/JS modules, dependencies, state ownership, and DOM contracts. Does NOT write code.
4. **Feature Architect**: Decomposes functional requirements, user flows, interaction behaviors, and state transitions. Does NOT write code.
5. **Coding Agent**: The **sole agent implementation owner**. Stages creates, updates, renames and deletions across the project. Other agents do not write application source.
6. **QA Agent**: Inspects source and deterministic validation results for missing elements, broken references, scripts, or unfulfilled requirements. Returns an evidence-based report and may request more files. Does NOT modify code or claim unperformed browser tests.

Tier definitions share `agents/projectContracts.js` through `ProjectAgent`/`BaseAgent`. A per-call schema override allows the Manager to use distinct planning and synthesis contracts.

---

## 4. Persistence and Atomic Revisions

`services/projectService.js` exposes the same project/file/revision operations in two storage modes:

- **Filesystem**: `projects/<id>/project.json` holds the committed manifest. Immutable blobs and revision records live under `.orchestra/blobs/` and `.orchestra/revisions/`. Source paths outside `.orchestra` are best-effort compatibility mirrors.
- **MongoDB**: The `projects` collection holds committed manifests; `project_revisions` holds snapshots; the `orchestra_blobs` GridFS bucket holds text and binary bytes. Blob IDs include the project ID. Disk mirrors are not authoritative.

A change batch validates paths, sizes and collisions, writes blobs and an immutable revision snapshot, then publishes the new manifest. Readers see a complete old or new manifest. Filesystem writers use an in-process queue and a cross-process `proper-lockfile` lock. MongoDB writers use `_generation` compare-and-swap. User-facing changes also require `expectedRevision`; stale writes return `409`.

The project revision starts at 0 and increments once per source batch. Reports are separate artifact descriptors and do not create source revisions. Diffs compare snapshots; restore creates a new revision. Legacy nested projects and the old `project_files` collection are migrated on their first edit with a revision-0 baseline. Failed/unpublished writes can leave unreachable blobs or snapshots; automatic garbage collection and history retention policies are not implemented.

Every filesystem path is validated and checked for symlinks. ZIP import is bounded by compressed and expanded sizes and file counts; dependency/cache folders and environment files are filtered. Filenames use full relative paths throughout storage, APIs, and the UI.

---

## 5. File Context and Agent Commit Protocol

`services/agentFileSession.js` maintains an in-memory working tree over a project revision:

1. Seed context includes the file tree, entry page, and a bounded set of local dependencies.
2. Agents can return `status: "read_files"` and request up to 12 paths (160,000 characters per read batch).
3. Coding responses contain explicit `changes`, an optional `entryPoint`, and `done`. Existing files must have been read before mutation; text output cannot overwrite binary assets.
4. Batches remain staged until a complete response arrives. At most 12 agent rounds are allowed. Invalid/truncated JSON or a protocol failure cannot publish a partial source batch.
5. Final staged state is reduced to coherent per-path changes, validated, and committed with the session's original revision. Omitted files are preserved. Simple renames remain visible in history; swaps/replacements are represented as final writes/deletes.

Agents use browser-native HTML/CSS/JavaScript with no assumed build process or application server. Framework uploads are source-only; preview requires externally built static output.

---

## 6. Human-in-the-Loop & Minimal Change Preservation Rule

- After generation, the website renders in the Live Preview iframe.
- Human feedback and build requests targeting existing projects go directly to the Coding Agent along with:
  1. Original user requirements
  2. Current file tree, entry point, relevant file contents, and a file-read protocol
  3. User modification request
- **Minimal Change Rule**: The Coding Agent acts as an editor, modifying strictly the requested element/feature while preserving all other markup, styling, JavaScript, and IDs intact.

---

## 7. Execution Flow & State Machine

```
User Request
     │
     ▼
Manager Decomposition & Agent Selection
     │
     ▼
Specialists Executed Concurrently (Designer, Frontend Architect, Feature Architect)
     │
     ▼
Manager Synthesis (Unified Implementation Specification)
     │
     ▼
Coding Agent (Stages and commits a complete file batch)
     │
     ▼
Deterministic validation + QA Agent audit (optional repair pass)
     │
     ▼
Live Preview Rendered
     │
     ▼
Human Feedback Loop (Direct to Coding Agent with Minimal Change Rule)
```
Every agent reports real-time state: `idle`, `thinking`, `working`, `streaming`, `completed`, `retrying`, `error`.

`AsyncLocalStorage` supplies run-scoped registry instances and event context. Same-project agent runs are mutually exclusive within the server process; optimistic persistence also prevents stale writes from other processes. Independent specialist work is awaited with `Promise.allSettled`, including artifact saves. `SPECIFICATION_COMPLETED` is distinct from the full build's `PIPELINE_COMPLETED`, which occurs after implementation and audit. SSE carries project/run identifiers; the client ignores unrelated runs.

Deterministic validation covers JavaScript/JSON syntax, HTML IDs, entry-point availability, local HTML/CSS references and literal module imports. Findings do not prevent importing/editing incomplete source; the QA report includes them. Malformed or failed QA is reported as `issues_found`, never as a pass. A saved revision and a clean audit are separate outcomes.

## 8. Preview and Dashboard

- Express serves the studio from `src/client/`. The workspace UI (`project-workspace.js`) uses full paths for nested file selection, editing, upload, entry-page selection, history/diffs and restore. Dirty edits and stale revisions are guarded.
- A second Express listener serves **read-only** preview files on `PREVIEW_PORT` (default `PORT + 1`), under `/p/<id>/...`. Preview responses use MIME-aware serving, no-cache headers, and a response-level CSP sandbox, also effective in a separate tab.
- Local URLs use `<id>.localhost`, isolating project browser storage while allowing modules and localStorage. The iframe allows scripts/forms/modals/same-origin on that **separate origin**. Studio APIs reject cross-origin requests. Preview does not mount studio APIs or serve agent reports.
- Relative resources resolve naturally; root-relative HTML/CSS URLs and literal JS module/fetch URLs are rewritten only in preview responses. Stored source bytes are unchanged.
- `PREVIEW_ORIGIN` supports a separate HTTPS origin and an optional `{projectId}` hostname template behind a reverse proxy. A fixed shared preview origin shares browser storage across projects; per-project hostnames avoid that.

## 9. Verification and Operational Boundaries

`npm test` creates temporary filesystem storage and mocks providers. `npm run test:mongo` starts disposable MongoDB to exercise manifests, GridFS, revisions and competing writers. `npm run test:browser` uses Chromium against the real studio/preview listeners, including import, manual editing, navigation, history, project-origin storage separation, and mocked generation/editing over HTTP/SSE. These checks do not validate live model availability or the quality of every generated application.

Budget estimates/pre-run checks and in-memory spend tracking remain separate from the file protocol; there is no per-call hard spending cap for multi-round generation. The current studio has no multi-user authentication layer or managed framework/backend execution.
