# Agent Orchestra — Progress Log

## Current Status
- **Phase**: General agent tasks and Markdown deliverables
- **Status**: Implemented and verified (2026-10-02)
- **Next work**: Live-provider acceptance checks; additional readers/OCR or framework runtimes if required

## Latest Delivery — Document Analysis and Written Tasks

- Added automatic Manager routing and explicit Markdown/website modes through `/api/orchestrate/task`.
- Added a dedicated Document Analyst with source-grounded writing instructions, bounded reads, evidence notes, and source coverage.
- Added UTF-8/code/data-file reading and real PDF/DOCX extraction in bounded workers; originals stay unchanged.
- Summaries, explanations, comparisons, requirements, guides and general questions produce versioned `.md` deliverables, including tasks without uploads.
- Added Chat upload controls, result open/download cards, automatic IDE selection, document-specific progress, and visible error messages.
- Document-only projects no longer require an HTML entry or receive website-validation failures. Source edits, output collisions, unread citations, and revision conflicts are guarded.
- Verification: **54 default tests passed, 1 opt-in MongoDB check skipped; 26 MongoDB checks passed; Chromium website/document workflows passed; JavaScript syntax checks passed.** Model responses were mocked; text extraction and HTTP/SSE/storage paths were exercised directly.
- Current readers do not provide OCR, image/audio interpretation, or legacy binary Office support. Incomplete coverage is reported in the output.

## Previous Delivery — Multi-file Workspace

- Project-relative manifests, text/binary blobs, atomic source revisions, diffs and restore in filesystem and MongoDB/GridFS modes.
- Bounded ZIP/folder/multiple-file import, entry-page detection, source-only framework classification, and legacy-project migration on first edit.
- Shared multi-file agent contracts, bounded file reads, staged batches, explicit renames/deletions, minimal-change editing of uploads, and honest deterministic/model QA findings.
- Project/run-scoped SSE, per-run agent instances, awaited artifact persistence, and full-build completion after QA.
- Separate sandboxed preview listener with page/asset/module support; local per-project hostnames preserve localStorage while isolating it from the studio and other projects.
- Nested IDE explorer, manual edits, create/rename/delete, binary downloads, import UI, entry-page selection, revision diffs and rollback.
- Verification: `npm test` — **46 passed, 1 opt-in MongoDB check skipped**; `npm run test:mongo` — **18 reported passing checks**; Chromium workflow passed, including mocked generation/editing over real HTTP/SSE and visible QA findings; syntax checks passed for server/client/scripts JavaScript.
- Tests use disposable data and mocked providers. No live paid generation was performed for this delivery. Browser-ready static websites are executable; imported framework source requires an external build/runtime.

Earlier milestone notes below are historical. Current contracts and deployment/storage behavior are described in [architecture.md](architecture.md) and [README.md](README.md).

---

## Completed Work (Phase 9 — Gemini 3.5 Flash Switch)
1. **Google Gemini Provider Adapter**:
   - Implemented [`GeminiProvider`](file:///c:/Desktop/orchestra/src/server/providers/geminiProvider.js) integrating Google AI Studio's Generative Language API.
   - Converts standard chat schemas (`system`, `user`, `assistant`) to Gemini's `systemInstruction` and `contents` structures.
   - Built with dual execution modes: SSE streaming (`:streamGenerateContent?alt=sse`) with automatic fallback to standard generation (`:generateContent`) on 503 high-load spikes.
2. **Model Gateway Registration & Policy**:
   - Registered `gemini-3.5-flash` as primary default model with `gemini-3.5-flash-lite` as automatic fallback.
3. **Agent Registry Model Reassignment**:
   - Reconfigured all 6 logical agents (Manager, Designer, Frontend Architect, Feature Architect, Coding Agent, QA Agent) to default to `gemini-3.5-flash`.
4. **Client UI & Status Indicators**:
   - Dashboard status pills reflect `gemini-3.5-flash` and `Google AI Studio`.
   - Dynamic agent cards display their active model assignment.
5. **Full Automated Test Suite**:
   - 22/22 unit and integration tests passing across all providers, agents, isolated project workspaces, and feedback loops.

## Completed Work (Phase 8 & MVP Completion)
1. **Frontend Orchestration Playground & UI Polish**:
   - Visual agent cards for all 6 logical roles with dynamic state indicators (`IDLE`, `WORKING`, `STREAMING`, `COMPLETED`, `RETRYING`, `ERROR`) and pulsing glow animations during active execution.
   - 7-step visual workflow progress tracking each phase in real time.
   - Live terminal log streaming timestamped, categorized events.
   - QA Audit findings card rendering score, verdict badge, and severity-categorized issues.
2. **Multi-Project Workspace Switcher & Fresh Project Control**:
   - Added `+ New` button and `#projectSelect` dropdown in header. Users can seamlessly create, browse, and switch between completely isolated project workspaces under `projects/<projectId>/` with zero cross-contamination.
3. **Comprehensive Documentation**:
   - Created full [`README.md`](file:///c:/Desktop/orchestra/README.md) detailing architecture, setup, API reference, and screenshots/flow diagrams.
   - Maintained stable architecture decisions in [`architecture.md`](file:///c:/Desktop/orchestra/architecture.md) and task tracker in [`tracker.md`](file:///c:/Desktop/orchestra/tracker.md).
4. **Complete Automated Test Suite**:
   - 19 automated unit & integration tests across Phases 0–7 passing 100%. Verified model registry, Model Gateway retries, agent state transitions, parallel specialist execution, coding agent HTML extraction, isolated file persistence, live preview endpoints, QA audits, and minimal-change human feedback modifications.
1. **Direct-to-Coder Human Feedback Stage**:
   - Implemented `applyFeedback({ projectId, feedback })` in [`Orchestrator`](file:///c:/Desktop/orchestra/src/server/orchestrator/orchestrator.js#L391-L453).
   - Treats the existing `index.html` as the absolute source of truth.
   - Enforces the **Minimal Change Preservation Rule**: modifies only what was explicitly requested while strictly preserving all other layout, styling, IDs, functions, and animations.
2. **Multi-Project Revision History & Versioning**:
   - Each feedback edit increments the project version (e.g. v1 -> v2 -> v3) and appends a timestamped history entry to `projects/<projectId>/project.json`.
   - Atomically overwrites `projects/<projectId>/index.html` and mirrors to `workspace/index.html`.
3. **API & Dashboard UI Integration**:
   - Added `POST /api/orchestrate/feedback` in [`src/server/routes/api.js`](file:///c:/Desktop/orchestra/src/server/routes/api.js).
   - Connected `#applyFeedbackBtn` and `#feedbackInput` in [`src/client/js/app.js`](file:///c:/Desktop/orchestra/src/client/js/app.js) with real-time UI status updates and live iframe reloads.
4. **Automated Test Suite**:
   - Implemented [`src/server/test/phase7.test.js`](file:///c:/Desktop/orchestra/src/server/test/phase7.test.js) testing minimal change instructions, targeted replacement, version increments, and history recording. All 19 tests passing.
1. **QA Agent Stage Integration**:
   - Implemented `audit({ projectId, userPrompt, unifiedSpec, htmlContent })` in [`Orchestrator`](file:///c:/Desktop/orchestra/src/server/orchestrator/orchestrator.js#L306-L352) running the [`QAAgent`](file:///c:/Desktop/orchestra/src/server/agents/definitions/qaAgent.js).
   - Audits DOM hierarchy, JavaScript handlers, responsive design, and requirements fulfillment without modifying code.
   - Outputs a structured audit report (`result: 'passed' | 'issues_found'`, `score`, `issues` array with `severity`, `category`, `description`, `location`, `recommendation`).
2. **Project Persistence of Audit Reports**:
   - Persisted the structured audit result to `projects/<projectId>/project.json` under `qaReport`.
3. **Dashboard QA Audit UI Card**:
   - Added an interactive QA Audit card in [`src/client/index.html`](file:///c:/Desktop/orchestra/src/client/index.html) and [`src/client/index.css`](file:///c:/Desktop/orchestra/src/client/index.css).
   - Shows overall verdict badge (`PASSED` or `N ISSUE(S)`), score, and categorized issue breakdowns in real-time when the QA Agent completes.
4. **Automated Test Suite**:
   - Created [`src/server/test/phase6.test.js`](file:///c:/Desktop/orchestra/src/server/test/phase6.test.js) testing pass validation, issue detection, and project metadata persistence. All 18 tests passing.
1. **Live Preview System & Iframe Synchronization**:
   - Sandboxed preview iframe connected directly to `/api/projects/:id/preview` and `/preview`.
   - Integrated cache-busting and cyan glow animation when a new project build completes or reloads.
2. **Multi-Project Switcher Dropdown**:
   - Added a stylish glassmorphic project selector to the header in [`src/client/index.html`](file:///c:/Desktop/orchestra/src/client/index.html) and [`src/client/index.css`](file:///c:/Desktop/orchestra/src/client/index.css).
   - Allows users to seamlessly select and view any project generated in `projects/<projectId>/` with its isolated version and code.
3. **Real-time SSE Dashboard Controller**:
   - Updated [`src/client/js/app.js`](file:///c:/Desktop/orchestra/src/client/js/app.js) with EventSource listening to `/api/orchestrate/events`.
   - Real-time agent state transitions (`working`, `streaming`, `completed`, `retrying`, `error`) dynamically pulsing agent cards.
   - Execution pipeline steps (1 to 7) highlighting active and completed stages in real time.
4. **Automated Test Suite**:
   - Implemented [`src/server/test/phase5.test.js`](file:///c:/Desktop/orchestra/src/server/test/phase5.test.js) verifying multi-project preview isolation, `/api/projects` catalog discovery, and SSE event streaming. All 16 tests passing.
1. **Coding Agent Implementation Stage**:
   - Integrated [`CodingAgent`](file:///c:/Desktop/orchestra/src/server/agents/definitions/codingAgent.js) into [`Orchestrator`](file:///c:/Desktop/orchestra/src/server/orchestrator/orchestrator.js) via `implement({ projectId, userPrompt, unifiedSpec })`.
   - The Coding Agent receives the Unified Implementation Specification and produces the single, self-contained `index.html` (semantic HTML, embedded `<style>`, embedded `<script>`).
2. **HTML Extraction & Sanitization**:
   - Implemented [`extractHtmlFromCodingResult`](file:///c:/Desktop/orchestra/src/server/orchestrator/orchestrator.js#L6-L32) providing resilient extraction across JSON structures, markdown code fences, and raw strings, ensuring doctype validity.
3. **Multi-Project File Persistence**:
   - Every generated website is saved in its isolated directory: `projects/<projectId>/index.html`.
   - Simultaneously mirrored to `workspace/index.html` for single-workspace active rendering.
4. **End-to-End Build Pipeline & API**:
   - Implemented `buildFullProject()` in [`Orchestrator`](file:///c:/Desktop/orchestra/src/server/orchestrator/orchestrator.js#L309-L339) running the complete pipeline: Manager Plan -> Parallel Specialists -> Manager Synthesis -> Coding Agent -> Saved `index.html`.
   - Added `POST /api/orchestrate/build` endpoint in [`src/server/routes/api.js`](file:///c:/Desktop/orchestra/src/server/routes/api.js).
5. **Automated Test Suite**:
   - Added [`src/server/test/phase4.test.js`](file:///c:/Desktop/orchestra/src/server/test/phase4.test.js) testing HTML extraction resilience, Coding Agent execution, isolated project file persistence, and the end-to-end build pipeline. All 14 tests passing in ~1.6s.
1. **Multi-Agent Orchestrator Service**:
   - Implemented [`Orchestrator`](file:///c:/Desktop/orchestra/src/server/orchestrator/orchestrator.js) coordinating the full workflow and event stream.
   - Stage 1: `plan(prompt)` invokes the [`ManagerAgent`](file:///c:/Desktop/orchestra/src/server/agents/definitions/managerAgent.js) to decompose the goal, extract explicit requirements, and select required specialist agents.
   - Stage 2: `runSpecialists(plan, prompt)` executes independent specialists ([`DesignerAgent`](file:///c:/Desktop/orchestra/src/server/agents/definitions/designerAgent.js), [`FrontendArchitectAgent`](file:///c:/Desktop/orchestra/src/server/agents/definitions/frontendArchitectAgent.js), [`FeatureArchitectAgent`](file:///c:/Desktop/orchestra/src/server/agents/definitions/featureArchitectAgent.js)) concurrently in parallel via `Promise.all` with selective context.
   - Stage 3: `synthesize(prompt, plan, specialistOutputs)` has the Manager synthesize all specialist specifications into a cohesive, conflict-free Unified Implementation Specification.
2. **Project Isolation Persistence**:
   - Project specifications are persisted to [`projectService.js`](file:///c:/Desktop/orchestra/src/server/services/projectService.js) in `projects/<projectId>/project.json` (`managerPlan`, `specialistOutputs`, `unifiedSpec`, `status: 'specification_ready'`).
3. **API & Real-time SSE Endpoints**:
   - Added `POST /api/orchestrate/spec` and `GET /api/orchestrate/events` (SSE streaming pipeline and agent state changes in real-time) in [`src/server/routes/api.js`](file:///c:/Desktop/orchestra/src/server/routes/api.js).
4. **Automated Test Suite**:
   - Built [`src/server/test/phase3.test.js`](file:///c:/Desktop/orchestra/src/server/test/phase3.test.js) testing Manager planning, parallel specialist execution, synthesis, and project isolation. All 11 tests passing in ~1.6s.
1. **BaseAgent & State Machine Architecture**:
   - Implemented [`BaseAgent`](file:///c:/Desktop/orchestra/src/server/agents/baseAgent.js) with EventEmitter state changes (`idle`, `thinking`, `working`, `streaming`, `completed`, `error`, `retrying`).
   - Integrated automatic JSON output schema prompt injection and markdown code-fence parsing with error resilience.
   - Tied execution directly into [`ModelGateway`](file:///c:/Desktop/orchestra/src/server/gateway/modelGateway.js).
2. **Logical Agent Definitions**:
   - Implemented 6 distinct roles:
     - [`ManagerAgent`](file:///c:/Desktop/orchestra/src/server/agents/definitions/managerAgent.js): Intent understanding, requirement extraction, agent selection, synthesis.
     - [`DesignerAgent`](file:///c:/Desktop/orchestra/src/server/agents/definitions/designerAgent.js): Color palettes, typography, responsive layout rules, visual aesthetics.
     - [`FrontendArchitectAgent`](file:///c:/Desktop/orchestra/src/server/agents/definitions/frontendArchitectAgent.js): Semantic DOM hierarchy, CSS architecture, single-file constraints, JS state schema.
     - [`FeatureArchitectAgent`](file:///c:/Desktop/orchestra/src/server/agents/definitions/featureArchitectAgent.js): Interaction flows, state transitions, search/cart behavior, edge cases.
     - [`CodingAgent`](file:///c:/Desktop/orchestra/src/server/agents/definitions/codingAgent.js): Sole generator of `index.html` and guardian of the Minimal Change Preservation Rule.
     - [`QAAgent`](file:///c:/Desktop/orchestra/src/server/agents/definitions/qaAgent.js): Static DOM/JS auditor producing structured pass/issues reports.
3. **Agent Registry & Dynamic Model Assignment**:
   - Implemented [`AgentRegistry`](file:///c:/Desktop/orchestra/src/server/agents/agentRegistry.js) and exported singleton [`agentRegistry`](file:///c:/Desktop/orchestra/src/server/agents/agentRegistry.js#L73).
   - All agents initialize with model `kimi-k3` while supporting dynamic reassignment via `updateAgentModel(agentId, modelId)`.
4. **API Integration & Tests**:
   - Added `GET /api/agents` and `POST /api/agents/:id/model` in [`src/server/routes/api.js`](file:///c:/Desktop/orchestra/src/server/routes/api.js).
   - Automated tests in [`src/server/test/phase2.test.js`](file:///c:/Desktop/orchestra/src/server/test/phase2.test.js) verifying registry initialization, model decoupling, state transitions, and structured JSON parsing. All 8 tests passing.
1. **NVIDIA NIM Provider Adapter**:
   - Implemented [`NvidiaProvider`](file:///c:/Desktop/orchestra/src/server/providers/nvidiaProvider.js) extending [`BaseProvider`](file:///c:/Desktop/orchestra/src/server/providers/baseProvider.js).
   - Targeted `https://integrate.api.nvidia.com/v1/chat/completions` with model `moonshotai/kimi-k3`.
   - Built SSE streaming line parser handling `delta.content` and `delta.reasoning_content` (accumulating reasoning traces).
   - Tested live endpoint against NVIDIA NIM: confirmed HTTP 200 and streaming chunks over SSE.
2. **Centralized Model Gateway**:
   - Implemented [`ModelGateway`](file:///c:/Desktop/orchestra/src/server/gateway/modelGateway.js) decoupling agents from inference providers.
   - Built exponential backoff retry mechanism (handling 429, 502, 503, 504 Gateway Timeouts and network disconnects).
   - Structured fallback architecture ready for multi-provider routing (Gemini, OpenRouter, etc.).
3. **Multi-Project Directory Isolation**:
   - Implemented [`projectService.js`](file:///c:/Desktop/orchestra/src/server/services/projectService.js) managing isolated projects under `projects/<projectId>/`.
   - Each project owns its own `index.html` and `project.json` (metadata, manager plan, specialist specs, QA report, feedback history). Zero cross-contamination between projects.
4. **Verification & Testing**:
   - Implemented unit tests in [`src/server/test/phase1.test.js`](file:///c:/Desktop/orchestra/src/server/test/phase1.test.js) for retry mechanics, contract enforcement, and chunk streaming. All 5 tests passing.
   - Added REST test endpoints `/api/gateway/test` and `/api/gateway/test-stream` in [`src/server/routes/api.js`](file:///c:/Desktop/orchestra/src/server/routes/api.js).
1. **Node.js Project & Dependencies**:
   - Initialized ES Module project (`package.json`) with `express`, `dotenv`, and `cors`.
   - Verified Node.js v24.20.0 and npm 11.19.0 runtime.
2. **Environment & Configuration**:
   - Created `.gitignore` preventing `.env` and `node_modules` from being committed.
   - Created `.env.example` and initial `.env` with `NVIDIA_API_KEY`, `PORT`, and `HOST`.
   - Created `src/server/config/env.js` with validation warnings if the API key is unconfigured.
   - Created `src/server/config/models.js` registering `moonshotai/kimi-k3` under the `nvidia` provider with endpoint `https://integrate.api.nvidia.com/v1/chat/completions` and parameters (`max_tokens: 16384`, `temperature: 1`, `reasoning_effort: "max"`, `stream: true`).
3. **Workspace Baseline**:
   - Created `workspace/index.html` with an initial placeholder page for the Live Preview iframe.
4. **Backend Server & Routing**:
   - Created `src/server/index.js` serving client static assets, `/workspace`, and `/api` routes.
   - Implemented `/api/health`, `/api/models`, and `/api/preview` endpoints.
5. **Frontend Architecture & Visual Design**:
   - Built modern 3-column dashboard (`src/client/index.html`):
     - Left: Agent Registry & Playground with cards for Manager, Designer, Frontend Architect, Feature Architect, Coding Agent, QA Agent.
     - Center: Orchestration flow graph, task input with sample prompt, execution pipeline steps, and live terminal logger.
     - Right: Live preview iframe with desktop/tablet/mobile viewport switchers and human feedback input card.
   - Built custom dark-theme CSS design system (`src/client/index.css`) with glassmorphism, glowing borders, active state animations, and typography via Plus Jakarta Sans and JetBrains Mono.
   - Implemented client controller (`src/client/js/app.js`) with system status polling, viewport sizing, and agent card state helpers.
6. **Documentation & Memory**:
   - Established `architecture.md`, `tracker.md`, and `progress.md`.

---

## Important Architectural Decisions
- **Separation of Concerns**: Agents are logical roles; models are inference engines. Agents never make direct HTTP calls to providers.
- **Multi-file Source of Truth**: Committed project manifests reference immutable blobs; the workspace HTML is only a legacy compatibility mirror.
- **Coding Agent Exclusive Agent Ownership**: The Coding Agent stages application source; specialists produce specifications and reports. Users may edit files in the IDE.
- **Minimal Change Rule**: Contextual edits include a file tree and bounded read protocol; omitted files remain unchanged.

---

## Known Issues / Gaps
- Provider availability and real model output quality require live acceptance checks with the configured routing/keys.
- Framework build processes, backend execution, automatic blob/history cleanup, and multi-user authentication are not implemented.
- Budget tracking is in-memory with estimated per-call pricing and a pre-run check, not a hard in-run cap.

---

## Follow-up Work
- Run live-provider acceptance checks for a new multi-page site and a targeted edit to an imported site.
- Design framework/runtime support separately if needed; current preview expects browser-ready static output.
