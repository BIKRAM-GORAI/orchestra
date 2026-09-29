/**
 * Agent Orchestra — Client Application Controller
 * Handles dashboard interactions, SSE streaming events, project switching,
 * and multi-agent build orchestration with live iframe preview.
 */

// DOM Elements
const apiStatusDot = document.getElementById('apiStatusDot');
const apiStatusText = document.getElementById('apiStatusText');
const currentModelDisplay = document.getElementById('currentModelDisplay');
const projectSelect = document.getElementById('projectSelect');
const terminalLogs = document.getElementById('terminalLogs');
const clearLogsBtn = document.getElementById('clearLogsBtn');
const samplePromptBtn = document.getElementById('samplePromptBtn');
const promptInput = document.getElementById('promptInput');
const startOrchestrationBtn = document.getElementById('startOrchestrationBtn');
const orchestratorStatusTag = document.getElementById('orchestratorStatusTag');
const previewWrap = document.getElementById('previewWrap');
const previewIframe = document.getElementById('previewIframe');
const refreshPreviewBtn = document.getElementById('refreshPreviewBtn');
const vpButtons = document.querySelectorAll('.viewport-btn[data-width]');
const feedbackInput = document.getElementById('feedbackInput');
const applyFeedbackBtn = document.getElementById('applyFeedbackBtn');
const qaAuditCard = document.getElementById('qaAuditCard');
const qaVerdictBadge = document.getElementById('qaVerdictBadge');
const qaSummaryText = document.getElementById('qaSummaryText');
const qaIssuesList = document.getElementById('qaIssuesList');

// Active state tracking
let activeProjectId = null;
let eventSource = null;

// Terminal Logging Utility
export function addLog(message, type = 'info') {
  const line = document.createElement('div');
  line.className = `log-line ${type}`;
  const timestamp = new Date().toLocaleTimeString();
  line.textContent = `[${timestamp}] ${message}`;
  terminalLogs.appendChild(line);
  terminalLogs.scrollTop = terminalLogs.scrollHeight;
}

// Clear terminal logs
if (clearLogsBtn) {
  clearLogsBtn.addEventListener('click', () => {
    terminalLogs.innerHTML = '';
    addLog('Terminal cleared.', 'muted');
  });
}

// Agent State Machine visual updater
export function setAgentState(agentId, state, details = {}) {
  const card = document.getElementById(`agent-card-${agentId}`);
  const badge = document.getElementById(`badge-${agentId}`);
  if (!card || !badge) return;

  // Clear previous states
  card.classList.remove('idle', 'thinking', 'working', 'streaming', 'completed', 'error', 'retrying');
  const normalizedState = state.toLowerCase();
  card.classList.add(normalizedState);
  badge.textContent = state.toUpperCase();

  if (details.durationMs) {
    addLog(`Agent [${agentId.toUpperCase()}] completed in ${details.durationMs}ms`, 'success');
  }
}

// Reset all agents to idle
export function resetAllAgentCards() {
  const agentIds = ['manager', 'designer', 'frontend_architect', 'feature_architect', 'coding_agent', 'qa'];
  for (const id of agentIds) {
    setAgentState(id, 'idle');
  }
}

// Pipeline Steps visual updater
export function setPipelineStep(stepId, status = 'active') {
  const step = document.getElementById(stepId);
  if (!step) return;

  step.classList.remove('active', 'done');
  if (status === 'active') {
    step.classList.add('active');
  } else if (status === 'done') {
    step.classList.add('done');
  }
}

export function resetPipelineSteps() {
  const steps = [
    'step-user',
    'step-manager-plan',
    'step-specialists',
    'step-synthesis',
    'step-coder',
    'step-qa',
    'step-preview',
  ];
  for (const id of steps) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active', 'done');
  }
  if (qaAuditCard) {
    qaAuditCard.style.display = 'none';
  }
}

// Update Live Preview Iframe
export function updatePreview(projectId = null) {
  const cacheBuster = `t=${Date.now()}`;
  if (projectId) {
    previewIframe.src = `/api/projects/${projectId}/preview?${cacheBuster}`;
  } else {
    previewIframe.src = `/api/preview?${cacheBuster}`;
  }

  // Visual pulse on reload
  previewWrap.style.boxShadow = '0 0 24px rgba(6, 182, 212, 0.4)';
  setTimeout(() => {
    previewWrap.style.boxShadow = '';
  }, 1000);
}

// Real-Time SSE Stream Listener
function initEventSource() {
  if (eventSource) {
    eventSource.close();
  }

  eventSource = new EventSource('/api/orchestrate/events');

  eventSource.addEventListener('agentState', (e) => {
    try {
      const data = JSON.parse(e.data);
      setAgentState(data.agentId, data.state, data);
    } catch (_) {}
  });

  eventSource.addEventListener('pipeline', (e) => {
    try {
      const data = JSON.parse(e.data);
      handlePipelineEvent(data);
    } catch (_) {}
  });

  eventSource.onerror = () => {
    // Retry automatically handled by browser EventSource
  };
}

// Handle Pipeline Lifecycle Events
function handlePipelineEvent(event) {
  const stage = event.stage;
  switch (stage) {
    case 'PIPELINE_STARTED':
      setPipelineStep('step-user', 'done');
      orchestratorStatusTag.textContent = 'Orchestrating...';
      addLog(`[ORCHESTRATOR] Task received: "${event.prompt?.slice(0, 60)}..."`, 'info');
      break;

    case 'MANAGER_PLAN_STARTED':
      setPipelineStep('step-manager-plan', 'active');
      addLog('[MANAGER] Formulating execution plan and selecting specialists...', 'info');
      break;

    case 'MANAGER_PLAN_COMPLETED':
      setPipelineStep('step-manager-plan', 'done');
      addLog(`[MANAGER] Plan finalized. Selected: ${event.plan?.selected_agents?.join(', ')}`, 'success');
      break;

    case 'SPECIALISTS_STARTED':
      setPipelineStep('step-specialists', 'active');
      addLog('[SPECIALISTS] Launching Designer, Frontend Architect, and Feature Architect in parallel...', 'info');
      break;

    case 'SPECIALISTS_COMPLETED':
      setPipelineStep('step-specialists', 'done');
      addLog('[SPECIALISTS] All specialists completed their specifications.', 'success');
      break;

    case 'MANAGER_SYNTHESIS_STARTED':
      setPipelineStep('step-synthesis', 'active');
      addLog('[MANAGER] Synthesizing specialist outputs into Unified Implementation Specification...', 'info');
      break;

    case 'MANAGER_SYNTHESIS_COMPLETED':
      setPipelineStep('step-synthesis', 'done');
      addLog('[MANAGER] Unified specification generated. Handing over to Coding Agent.', 'success');
      break;

    case 'CODING_AGENT_STARTED':
      setPipelineStep('step-coder', 'active');
      addLog('[CODING AGENT] Generating self-contained index.html...', 'info');
      break;

    case 'CODING_AGENT_COMPLETED':
      setPipelineStep('step-coder', 'done');
      addLog(`[CODING AGENT] index.html successfully generated (${event.contentLength} bytes).`, 'success');
      break;

    case 'QA_STARTED':
      setPipelineStep('step-qa', 'active');
      if (qaAuditCard) {
        qaAuditCard.style.display = 'block';
        qaVerdictBadge.className = 'badge';
        qaVerdictBadge.textContent = 'AUDITING...';
        qaSummaryText.textContent = 'Auditing generated DOM elements, script handlers, and requirements...';
        qaIssuesList.innerHTML = '';
      }
      addLog('[QA AGENT] Starting static inspection & compliance audit of generated index.html...', 'info');
      break;

    case 'QA_COMPLETED':
      setPipelineStep('step-qa', 'done');
      setPipelineStep('step-preview', 'active');
      if (qaAuditCard) {
        qaAuditCard.style.display = 'block';
        if (event.result === 'passed' || !event.issues || event.issues.length === 0) {
          qaVerdictBadge.className = 'badge qa-pass';
          qaVerdictBadge.textContent = 'PASSED';
          qaSummaryText.textContent = event.summary?.verdict || 'Code verification passed with zero critical defects.';
          qaIssuesList.innerHTML = '<div class="qa-issue-item" style="border-left-color: var(--accent-emerald);">✨ All DOM and script checks validated. Zero critical issues detected.</div>';
          addLog('[QA AGENT] Audit passed with zero critical issues.', 'success');
        } else {
          qaVerdictBadge.className = 'badge qa-warn';
          qaVerdictBadge.textContent = `${event.issues.length} ISSUE(S)`;
          qaSummaryText.textContent = event.summary?.verdict || 'Issues found during static verification.';
          qaIssuesList.innerHTML = event.issues.map(iss => `
            <div class="qa-issue-item ${iss.severity}">
              <span class="qa-issue-sev">${iss.severity}:</span>
              <span><strong>${iss.location || 'Code'}:</strong> ${iss.description}</span>
            </div>
          `).join('');
          addLog(`[QA AGENT] Audit finished: ${event.issues.length} issue(s) identified.`, 'warn');
        }
      }
      break;

    case 'QA_REPAIR_STARTED':
      orchestratorStatusTag.textContent = 'Auto-Repairing...';
      setPipelineStep('step-coder', 'active');
      addLog(`[QA AUTO-REPAIR] ${event.issueCount} defect(s) detected. Coding Agent is automatically repairing the HTML code...`, 'warn');
      break;

    case 'QA_REPAIR_COMPLETED':
      setPipelineStep('step-coder', 'done');
      setPipelineStep('step-qa', 'done');
      setPipelineStep('step-preview', 'active');
      orchestratorStatusTag.textContent = 'Preview Ready';
      if (qaAuditCard) {
        if (event.qaResult === 'passed' || !event.issues || event.issues.length === 0) {
          qaVerdictBadge.className = 'badge qa-pass';
          qaVerdictBadge.textContent = 'REPAIRED (PASSED)';
          qaSummaryText.textContent = event.summary?.verdict || 'Auto-repair resolved all identified defects.';
          qaIssuesList.innerHTML = '<div class="qa-issue-item" style="border-left-color: var(--accent-emerald);">✨ All defects resolved by Coding Agent. Full verification passed.</div>';
        } else {
          qaVerdictBadge.className = 'badge qa-warn';
          qaVerdictBadge.textContent = `${event.issues.length} ISSUE(S)`;
          qaSummaryText.textContent = event.summary?.verdict || 'Audit after repair completed.';
        }
      }
      updatePreview(event.projectId || activeProjectId);
      addLog('[QA AUTO-REPAIR] Defects resolved. Live preview reloaded.', 'success');
      break;

    case 'PIPELINE_COMPLETED':
      setPipelineStep('step-preview', 'done');
      orchestratorStatusTag.textContent = 'Build Complete';
      addLog('[ORCHESTRATOR] Project successfully built and preview ready.', 'success');
      break;
  }
}

// Projects Management
export async function loadProjects() {
  try {
    const res = await fetch('/api/projects');
    const data = await res.json();
    const projects = data.projects || [];

    projectSelect.innerHTML = '<option value="">Active Workspace</option>';
    for (const proj of projects) {
      const opt = document.createElement('option');
      opt.value = proj.id;
      opt.textContent = `${proj.name} (v${proj.version || 1})`;
      projectSelect.appendChild(opt);
    }

    if (activeProjectId) {
      projectSelect.value = activeProjectId;
    }
  } catch (err) {
    console.error('Failed to load projects:', err);
  }
}

// Project Selection Change
if (projectSelect) {
  projectSelect.addEventListener('change', () => {
    activeProjectId = projectSelect.value || null;
    updatePreview(activeProjectId);
    addLog(`Switched view to project: ${activeProjectId || 'Active Workspace'}`, 'info');
  });
}

// New Project Reset
const newProjectBtn = document.getElementById('newProjectBtn');
if (newProjectBtn) {
  newProjectBtn.addEventListener('click', () => {
    activeProjectId = null;
    if (projectSelect) projectSelect.value = '';
    if (promptInput) promptInput.value = '';
    resetAllAgentCards();
    resetPipelineSteps();
    updatePreview(null);
    orchestratorStatusTag.textContent = 'Ready for Task';
    addLog('[PROJECT] Cleared workspace. Enter a new goal to create a separate project.', 'info');
  });
}

// System Health & Model Discovery
const providerDisplay = document.getElementById('providerDisplay');

async function initSystemStatus() {
  try {
    const res = await fetch('/api/health');
    const data = await res.json();
    if (data.status === 'ok') {
      if (data.env.hasGeminiKey) {
        apiStatusDot.style.backgroundColor = 'var(--accent-emerald)';
        apiStatusText.textContent = 'Ready (Gemini 3.5 Flash)';
        if (providerDisplay) providerDisplay.textContent = 'Google AI Studio';
      } else if (data.env.hasNvidiaKey) {
        apiStatusDot.style.backgroundColor = 'var(--accent-emerald)';
        apiStatusText.textContent = 'Ready (NVIDIA NIM)';
        if (providerDisplay) providerDisplay.textContent = 'NVIDIA NIM';
      } else {
        apiStatusDot.style.backgroundColor = 'var(--accent-amber)';
        apiStatusText.textContent = 'API Key Missing';
      }
    }
  } catch (err) {
    apiStatusDot.style.backgroundColor = 'var(--accent-rose)';
    apiStatusText.textContent = 'Offline';
  }

  try {
    const res = await fetch('/api/models');
    const data = await res.json();
    if (data.models && data.models.length > 0) {
      currentModelDisplay.textContent = data.models[0].name;
    }
  } catch (err) {
    console.error('Failed to load models:', err);
  }

  try {
    const res = await fetch('/api/agents');
    const data = await res.json();
    if (data.agents) {
      for (const agent of data.agents) {
        const tag = document.getElementById(`agent-model-${agent.id}`);
        if (tag) {
          tag.textContent = `Model: ${agent.modelId}`;
        }
      }
    }
  } catch (err) {
    console.error('Failed to load agents:', err);
  }
}

// Viewport Switcher
vpButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    vpButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const width = btn.dataset.width;
    previewWrap.style.maxWidth = width;
  });
});

// Refresh Preview iframe
if (refreshPreviewBtn) {
  refreshPreviewBtn.addEventListener('click', () => {
    updatePreview(activeProjectId);
    addLog('Refreshed live preview frame.', 'muted');
  });
}

// Sample Prompt
if (samplePromptBtn) {
  samplePromptBtn.addEventListener('click', () => {
    promptInput.value = 'Build me a modern sports ecommerce website with dark theme, hero banner, product catalogue with search and category filtering, interactive shopping cart modal, and responsive design.';
    addLog('Loaded example sports ecommerce specification prompt.', 'info');
  });
}

// Trigger Full Multi-Agent Build (Phase 4 / 5)
if (startOrchestrationBtn) {
  startOrchestrationBtn.addEventListener('click', async () => {
    const prompt = promptInput.value.trim();
    if (!prompt) {
      alert('Please enter a software or product goal to begin.');
      return;
    }

    startOrchestrationBtn.disabled = true;
    orchestratorStatusTag.textContent = 'Building...';
    resetPipelineSteps();
    resetAllAgentCards();

    setPipelineStep('step-user', 'active');
    addLog(`Initiating multi-agent build for: "${prompt.slice(0, 60)}..."`, 'info');

    try {
      const res = await fetch('/api/orchestrate/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      const data = await res.json();
      if (!res.ok || data.status !== 'success') {
        throw new Error(data.message || 'Build failed');
      }

      activeProjectId = data.projectId;
      await loadProjects();
      if (projectSelect) projectSelect.value = activeProjectId;

      updatePreview(activeProjectId);
      orchestratorStatusTag.textContent = 'Preview Ready';
      setPipelineStep('step-preview', 'done');
      addLog(`Build complete! Live Preview loaded for project "${activeProjectId}".`, 'success');
    } catch (err) {
      orchestratorStatusTag.textContent = 'Error';
      addLog(`Build failed: ${err.message}`, 'error');
    } finally {
      startOrchestrationBtn.disabled = false;
    }
  });
}

// Apply Human Feedback (Phase 7 - Minimal Change Rule)
async function handleApplyFeedback() {
  const feedback = feedbackInput.value.trim();
  if (!feedback) {
    alert('Please enter a modification request.');
    return;
  }

  applyFeedbackBtn.disabled = true;
  orchestratorStatusTag.textContent = 'Applying Feedback...';
  addLog(`[HUMAN FEEDBACK] Submitting targeted edit: "${feedback}"`, 'info');

  try {
    const res = await fetch('/api/orchestrate/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: activeProjectId,
        feedback,
      }),
    });

    const data = await res.json();
    if (!res.ok || data.status !== 'success') {
      throw new Error(data.message || 'Feedback application failed');
    }

    feedbackInput.value = '';
    updatePreview(activeProjectId || data.projectId);
    await loadProjects();

    orchestratorStatusTag.textContent = 'Preview Updated';
    addLog(`[HUMAN FEEDBACK] Successfully applied minimal-change update (v${data.data?.version || '2'}). Preview reloaded.`, 'success');
  } catch (err) {
    orchestratorStatusTag.textContent = 'Error';
    addLog(`[HUMAN FEEDBACK ERROR] ${err.message}`, 'error');
  } finally {
    applyFeedbackBtn.disabled = false;
  }
}

if (applyFeedbackBtn) {
  applyFeedbackBtn.addEventListener('click', handleApplyFeedback);
}

if (feedbackInput) {
  feedbackInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleApplyFeedback();
    }
  });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  initSystemStatus();
  initEventSource();
  loadProjects();
  addLog('Agent Orchestra Platform ready.', 'info');
});
