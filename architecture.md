# Agent Orchestra — Architecture & Architectural Decisions

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
    NVIDIA PROVIDER             FUTURE PROVIDERS
  (moonshotai/kimi-k3)        (Gemini, OpenRouter)
```

---

## 2. Model Gateway & Provider Abstraction

- **Centralized Gateway**: Responsible for model selection, provider dispatch, request streaming, error handling, timeout management, and retry backoff.
- **Provider Adapters**: Standardized interface (`generate(messages, options, onChunk)`) converting internal parameters to provider-specific payloads and streaming chunk events back.
- **MVP Provider**: NVIDIA NIM chat completions (`https://integrate.api.nvidia.com/v1/chat/completions`) using `moonshotai/kimi-k3`.
- **Future Fallback Ready**: Gateway policy configuration supports `primary` model and `fallback` models list. For V1: primary is `kimi-k3`, fallback is empty, with 3 automatic retries on transient errors.

---

## 3. Logical Agent Registry

1. **Manager**: Decomposes user goal, selects relevant specialists, plans execution graph, and synthesizes specialist outputs into a single Unified Implementation Specification. Does NOT write code.
2. **Designer**: Defines visual direction, color system, typography, responsive layout rules, spacing, and interaction styles. Does NOT write code.
3. **Frontend Architect**: Determines technical implementation strategy (semantic DOM hierarchy, CSS architecture, JavaScript state management, single-file constraints). Does NOT write code.
4. **Feature Architect**: Decomposes functional requirements, user flows, interaction behaviors, and state transitions. Does NOT write code.
5. **Coding Agent**: The **sole implementation owner**. Only agent permitted to generate or edit `index.html`. Synthesizes all specifications into a single self-contained application.
6. **QA Agent**: Evaluates generated code statically and functionally for missing elements, broken scripts, or unfulfilled requirements. Returns structured audit. Does NOT modify code.

---

## 4. Multi-Project Directory Isolation

To support generating and maintaining multiple distinct websites without cross-contamination:
- Projects reside in isolated directories under `projects/<projectId>/`.
- Each project directory maintains its own self-contained state:
  - `index.html`: The generated website artifact owned exclusively by the Coding Agent.
  - `project.json`: Metadata, user prompt, Manager planning, specialist outputs (Designer, Frontend Architect, Feature Architect), QA reports, and revision history.
- **Zero Cross-Linkage**: Every project operates independently; revisions and human feedback apply strictly to the active project.
- The active project is dynamically mirrored or served to the Live Preview iframe via `/api/projects/:id/preview` or `/preview`.
- No database is required for MVP; the filesystem structure guarantees transparent debugging and persistence.

---

## 5. Single Generated Artifact Constraint (Per Project)

- Within any given project, the target output is strictly **one file**: `index.html`.
- Combines semantic HTML5, embedded `<style>`, and embedded `<script>`.
- Zero build tools required for the generated app; opens directly in a browser or sandboxed preview iframe.
- No multi-file or backend scaffolding in MVP.

---

## 5. Human-in-the-Loop & Minimal Change Preservation Rule

- After generation, the website renders in the Live Preview iframe.
- Human feedback for V1 goes directly to the Coding Agent along with:
  1. Original user requirements
  2. Current `index.html` (source of truth)
  3. User modification request
- **Minimal Change Rule**: The Coding Agent acts as an editor, modifying strictly the requested element/feature while preserving all other markup, styling, JavaScript, and IDs intact.

---

## 6. Execution Flow & State Machine

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
Coding Agent (Generates workspace/index.html)
     │
     ▼
QA Agent (Runs structured audit)
     │
     ▼
Live Preview Rendered
     │
     ▼
Human Feedback Loop (Direct to Coding Agent with Minimal Change Rule)
```
Every agent reports real-time state: `idle`, `thinking`, `working`, `streaming`, `completed`, `retrying`, `error`.
