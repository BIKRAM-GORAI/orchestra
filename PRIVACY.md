# 🔒 Privacy Policy

**Last Updated: October 6, 2026**

**OmniVerse** (Agent Orchestra, "we", "us", or "our") values your privacy and is committed to transparency regarding how data is handled when you interact with our autonomous multi-agent engineering platform, web application, and APIs.

This Privacy Policy explains what information is collected, how it is processed, and your rights concerning your data.

---

## 1. Information We Collect and Process

### 1.1 User Directives & Prompts
When you submit a prompt to generate a website or analyze a document, we process the text of your prompt to decompose tasks, assign agent specialists, and produce software source code.

### 1.2 Uploaded Documents (Multimodal Task Flow)
If you upload PDF, DOCX, or text files via the Document Analyst feature, the file is parsed in memory to extract text and structure for agent synthesis. Uploaded document buffers are used solely to fulfill the requested task.

### 1.3 Operational Telemetry
We collect basic operational telemetry to maintain platform reliability:
- Error logs and AST validation failure rates (anonymized).
- Response latencies and token spend metrics across model tiers.
- HTTP access logs (IP address, user agent, requested paths).

---

## 2. How Data is Processed & Forwarded

### 2.1 Model Gateway Anonymization
To execute code generation, OmniVerse forwards task prompts to configured upstream AI model providers:
- **NVIDIA NIM** (e.g. Moonshot AI Kimi K3)
- **Google Cloud / Gemini API** (e.g. Gemini 3.5 Flash)
- **Mistral AI** (e.g. Codestral Latest)
- **OpenRouter** (e.g. Qwen 2.5 72B Instruct)

We **do not** include user identifiers, personal identities, or unrelated session metadata in the payload sent to these third-party model providers. Only the technical prompt context necessary for agent generation is transmitted.

### 2.2 Client-Side API Keys & Self-Hosting
When self-hosting OmniVerse, your API keys (`NVIDIA_API_KEY`, `GEMINI_API_KEY`, `MISTRAL_API_KEY`, etc.) remain in your private `.env` file on your server. They are never sent to external servers other than the designated provider endpoints.

---

## 3. Sandboxing & Code Isolation

All generated web applications executed in the live preview run within an isolated sandbox iframe with a strict Content Security Policy (`CSP`):
- Untrusted preview code runs under a separate origin or sandboxed container.
- Sandbox scripts are barred from reading cookies, localStorage, or calling internal `/api/*` endpoints of the parent studio origin.

---

## 4. Data Storage & Retention

- **Ephemeral by Default**: Unsaved exploration sessions in Simple Mode do not persist sensitive data permanently.
- **Projects**: When you save a project, generated files (HTML, CSS, JS) are saved to your local storage or connected MongoDB instance under project-isolated collections.
- **Data Deletion**: You can delete projects, revisions, and generated files at any time via the project management API or file system removal.

---

## 5. Cookies & Tracking

OmniVerse **does not** use tracking cookies, third-party advertising trackers, or behavioral analytics pixels. Local storage is strictly utilized for UI state preferences (such as selected budget tier, active editor theme, and session tokens).

---

## 6. Open Source Self-Hosting

Because OmniVerse is 100% open-source, you have full sovereignty over your data:
- You may run the entire stack on an air-gapped local workstation or private virtual private cloud (VPC).
- When running with local models (e.g., via Ollama or vLLM), zero bytes leave your private network infrastructure.

---

## 7. Contact & Questions

If you have questions, concerns, or feedback regarding this Privacy Policy, please open an issue or discussion on our [GitHub Repository](https://github.com/BIKRAM-GORAI/orchestra).
