# 🚀 OmniVerse (Agent Orchestra) Releases & Changelog

All notable changes, architectural milestones, and version updates to OmniVerse (Agent Orchestra) are documented in this file.

This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## 📑 Release Timeline Summary

| Version | Codename | Release Date | Stage | Key Milestone |
| :--- | :--- | :--- | :--- | :--- |
| [**v2.0.0**](#v200---post-hackathon-production-release) | *OmniVerse 2.0 & One-Click Deploy* | *2 Days Post-Hackathon* | **Production** | Simple Mode, Instant Live Deployed Link, Mobile Responsiveness, Budget Optimization |
| [**v1.0.0**](#v100---hackathon-launch-edition) | *OmniVerse Genesis* | *Hackathon Day* | **Hackathon Launch** | Core 16-Agent Team, 2.5D Studio Atelier, NVIDIA Kimi K3, Live Sandbox Preview |
| [**v2.1+ / v3.0**](#-future-roadmap--upcoming-versions) | *Ecosystem & Autonomy* | *Q4 2026 / 2027* | **Roadmap** | Multi-Repo Sync, Custom Domain DNS, Voice Directives, Marketplace |

---

## [v2.0.0] - Post-Hackathon Production Release
*Released: 2 Days after Hackathon completion*

### 🌟 Major Highlights & New Features

- **Simple Mode (`simple.html`)**:
  - Introduced an ultra-clean, minimal web application interface tailored for non-developers and rapid ideation.
  - Generates full production-ready, multi-file HTML, CSS, and JavaScript websites from a single plain-English prompt.
  - Integrated 1-click generation, step indicator (`1. Prompt → 2. AI Code & Audit → 3. Live Site`), and downloadable source code zip.

- **Instant Live Deployed Link**:
  - Direct URL sandbox routing (`/p/:id`) allowing instant access to live, functional web deployments directly from the simple interface.
  - Zero-wait preview container with strict Content Security Policy (`CSP`) sandbox isolation.

- **Complete Mobile Responsiveness**:
  - Full responsive overhaul for tablet (`<= 960px`), standard smartphone (`<= 768px`), and small viewport devices (`<= 480px`).
  - Mobile viewport optimization with `font-size: 16px` on inputs to eliminate iOS automatic zoom jumps.
  - Adaptive hero split-pane, mobile-optimized cards, touch-friendly tap targets (`min-height: 42px`), and fluid robot staging.

- **Mobile View Access Control for Workspace**:
  - In mobile viewports (`<= 768px`), resource-heavy desktop workspace links ("Advanced Workspace" buttons) are completely removed to protect touch users from complex 2.5D canvas and multi-pane Monaco views.
  - Added an elegant, glass-styled advisory notice in the footer:
    > *"To access the Advanced Multi-Agent Workspace, please open OmniVerse in Desktop mode on a larger display."*
  - Section 6 showcase video click handler dynamically routes mobile users to `simple.html` instead of the desktop atelier.

- **Glassmorphism Navigation Capsule**:
  - Unified navbar navigation buttons (`Agents`, `Alignment`, `Tickets`, `Platform`, `Workflow`) into a floating glass capsule container.
  - Tactile micro-animations with frosted glass hover states, internal specular lighting, and mathematically verified vertical height centering.

- **Interactive Section 6 Video Showcase**:
  - Smooth 0-to-1 scale bloom for floating cursor badge with fluid 0.35 lerp interpolation.
  - Continuous rotating frame border glow synced with scroll progress.
  - Rich 1.5-line tagline: *"Turn your simple plain-text prompt into a fully functional, production-ready website and receive an instant live deployed preview URL with clean, audited source files."*

- **3-Tier Intelligent Budget Allocation**:
  - Decoupled model assignment into Free ($0.00), Balanced ($0.25), and Premium ($0.60) pricing tiers.
  - Real-time spend tracking and transparent agent tier assignments.

- **Complete Test Suite Stability**:
  - 100% test pass rate across all **55 automated unit and integration tests**.

---

## [v1.0.0] - Hackathon Launch Edition
*Released: Hackathon Submission Day*

### 🌟 Initial Architectural Breakthroughs

- **16-Agent Multi-Tier Staff Roster**:
  - **Atlas (Manager)**: Prompt decomposition, quorum consensus alignment, architectural synthesis.
  - **Byte, Cipher, Matrix (Coders)**: Multi-file HTML/CSS/JS engineering across model tiers.
  - **Pixel, Palette, Prisma (Design)**: Design tokens, color harmony, typography hierarchies.
  - **Nova, Orbit, Stella (Frontend)**: DOM structure, semantic layouts, responsive grids.
  - **Spark, Flux, Apex (Features)**: State management, interaction listeners, web animations.
  - **Sentinel, Query, Aegis (QA Auditors)**: AST syntax trees, linting, accessibility verification.
  - **Scribe (Document Analyst)**: Multimodal document extraction for PDFs and DOCX files.

- **Pixi.js 2.5D Isometric Virtual Office (Studio Atelier)**:
  - Custom canvas simulation showing agents walking to desks, gathering in conference quorums, and status badges.
  - 4-quadrant layout: Atelier Canvas, Live Sandboxed Iframe, Monaco Multi-File Editor, Directives Terminal.

- **Multi-Model Gateway with Dynamic Fallback**:
  - First-class support for NVIDIA NIM (Moonshot AI Kimi K3), Google Gemini 3.5 Flash, Mistral Codestral, and OpenRouter (Qwen 2.5 72B).
  - Automated retry on 429 rate limits and graceful failover to secondary providers on transient outages.

- **Deterministic AST Code Safety Gate**:
  - Acorn parser validates JavaScript syntax before commit.
  - DOM tree validation ensures valid HTML5 semantic tags.
  - Rejection of partial commits: Broken syntax is caught and regenerated before preview rendering.

- **Dual-Mode Project Storage**:
  - Atomic local filesystem storage with collision prevention.
  - Optional enterprise MongoDB + GridFS multi-tenant persistence.

---

## 🔮 Future Roadmap & Upcoming Versions

### [v2.1.0] - Automated GitHub Export & Collaboration *(Planned)*
- [ ] Direct repository creation and push via GitHub OAuth.
- [ ] Automatic PR branch creation with agent code review comments embedded as GitHub checks.
- [ ] Team collaboration rooms with multi-user cursors on the 2.5D canvas.

### [v2.5.0] - Custom Domains & SSL Edge Provisioning *(Planned)*
- [ ] One-click custom domain binding (`yourbrand.com`) with automated Cloudflare DNS & Let's Encrypt SSL.
- [ ] Webhook triggers: Automatically regenerate websites when CMS content or Notion docs update.
- [ ] Analytics dashboard: Visitor count, page performance metrics, agent generation logs.

### [v3.0.0] - Multimodal Voice & Pluggable Agent Marketplace *(Planned)*
- [ ] Full voice directive interface: Speak your requirements directly to Manager Atlas.
- [ ] Audio synthesis: Agents report task completion and audit findings with custom AI voices.
- [ ] Pluggable Agent Marketplace: Community members can train and publish custom agent roles (e.g. SEO Specialist, Three.js 3D Animator, Web3 Smart Contract Auditor).

---

&copy; 2026 Agent Orchestra Labs. Distributed under the MIT License.
