/**
 * Agent Orchestra — Client Application Controller
 * Handles 4-quadrant atelier dashboard, animated virtual office floor,
 * live device preview simulations (mobile/tablet/desktop/new-tab),
 * real-time SSE stream events, and locked editing during active builds.
 */

import { OfficeEngine } from './office.js';

// DOM Elements
const apiStatusDot = document.getElementById('apiStatusDot');
const apiStatusText = document.getElementById('apiStatusText');
const currentModelDisplay = document.getElementById('currentModelDisplay');
const providerDisplay = document.getElementById('providerDisplay');
const activeProjectNameDisplay = document.getElementById('activeProjectNameDisplay');
const projectSelect = document.getElementById('projectSelect');
const newProjectBtn = document.getElementById('newProjectBtn');
const terminalLogs = document.getElementById('terminalLogs');
const clearLogsBtn = document.getElementById('clearLogsBtn');
const samplePromptBtn = document.getElementById('samplePromptBtn');
const promptInput = document.getElementById('promptInput');
const startOrchestrationBtn = document.getElementById('startOrchestrationBtn');
const orchestratorStatusTag = document.getElementById('orchestratorStatusTag');

// Preview DOM
const previewWrap = document.getElementById('previewWrap');
const previewIframe = document.getElementById('previewIframe');
const previewUrlBadge = document.getElementById('previewUrlBadge');
const refreshPreviewBtn = document.getElementById('refreshPreviewBtn');
const openNewTabBtn = document.getElementById('openNewTabBtn');
const vpButtons = document.querySelectorAll('.viewport-btn[data-mode]');

// Edits & QA DOM
const editsSection = document.getElementById('editsSection');
const lockIndicator = document.getElementById('lockIndicator');
const feedbackInput = document.getElementById('feedbackInput');
const applyFeedbackBtn = document.getElementById('applyFeedbackBtn');
const qaAuditCard = document.getElementById('qaAuditCard');
const qaVerdictBadge = document.getElementById('qaVerdictBadge');
const qaSummaryText = document.getElementById('qaSummaryText');
const qaIssuesList = document.getElementById('qaIssuesList');

// Canvas for Office Simulation
const officeCanvas = document.getElementById('officeCanvas');
let officeEngine = null;

// Active state tracking
let activeProjectId = null;
let eventSource = null;
let currentPreviewUrl = '/api/preview';

// Initialize Office Simulation Engine
if (officeCanvas) {
  officeEngine = new OfficeEngine(officeCanvas, {
    onMurmur: (agentId, text) => {
      addLog(`💭 [Thinking] ${agentId.toUpperCase()}: "${text}"`, 'murmur');
    }
  });
  officeEngine.start();
}

// Terminal Logging Utility with Agent-specific Color Coding
export function addLog(message, type = 'info') {
  const line = document.createElement('div');
  
  // Auto-detect agent prefix for colored styling if not already typed
  let resolvedType = type;
  if (resolvedType === 'info') {
    if (message.includes('[MANAGER]')) resolvedType = 'manager';
    else if (message.includes('[DESIGNER]')) resolvedType = 'designer';
    else if (message.includes('[FRONTEND]')) resolvedType = 'frontend';
    else if (message.includes('[FEATURE]')) resolvedType = 'feature';
    else if (message.includes('[CODING') || message.includes('[CODER]')) resolvedType = 'coder';
    else if (message.includes('[QA')) resolvedType = 'qa';
    else if (message.includes('[Thinking]') || message.includes('💭')) resolvedType = 'murmur';
  }

  line.className = `log-line ${resolvedType}`;
  const timestamp = new Date().toLocaleTimeString();
  line.textContent = `[${timestamp}] ${message}`;
  terminalLogs.appendChild(line);
  terminalLogs.scrollTop = terminalLogs.scrollHeight;
}

// Clear terminal logs
if (clearLogsBtn) {
  clearLogsBtn.addEventListener('click', () => {
    terminalLogs.innerHTML = '';
    addLog('Terminal logs cleared.', 'muted');
  });
}

// Set Locked / Unlocked state for human edits & project controls
export function setOrchestrationLock(isLocked) {
  if (editsSection) {
    if (isLocked) {
      editsSection.classList.add('orchestrating-locked');
    } else {
      editsSection.classList.remove('orchestrating-locked');
    }
  }

  if (lockIndicator) {
    if (isLocked) {
      lockIndicator.className = 'lock-indicator-badge locked';
      lockIndicator.innerHTML = '<span class="lock-icon">🔒</span><span class="lock-text">Orchestrating...</span>';
    } else {
      lockIndicator.className = 'lock-indicator-badge';
      lockIndicator.innerHTML = '<span class="lock-icon">🟢</span><span class="lock-text">Ready for Edits</span>';
    }
  }

  if (feedbackInput) feedbackInput.disabled = isLocked;
  if (applyFeedbackBtn) applyFeedbackBtn.disabled = isLocked;
  if (projectSelect) projectSelect.disabled = isLocked;
  if (newProjectBtn) newProjectBtn.disabled = isLocked;
  if (startOrchestrationBtn) startOrchestrationBtn.disabled = isLocked;
}

// Agent State updater (forwards to Office Engine)
export function setAgentState(agentId, state, details = {}) {
  if (officeEngine) {
    officeEngine.setAgentState(agentId, state);
  }
}

// Reset all agents to idle
export function resetAllAgents() {
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
    currentPreviewUrl = `/api/projects/${projectId}/preview`;
  } else {
    currentPreviewUrl = `/api/preview`;
  }

  previewIframe.src = `${currentPreviewUrl}?${cacheBuster}`;
  if (previewUrlBadge) {
    previewUrlBadge.textContent = currentPreviewUrl;
  }

  // Visual pulse on reload
  previewWrap.style.boxShadow = '0 0 24px rgba(245, 158, 11, 0.4)';
  setTimeout(() => {
    previewWrap.style.boxShadow = '';
  }, 1000);
}

// Viewport Device Mode Switcher (Desktop, Tablet, Mobile)
vpButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    vpButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const mode = btn.dataset.mode;
    previewWrap.classList.remove('desktop-mode', 'tablet-mode', 'mobile-mode');

    if (mode === 'mobile') {
      previewWrap.classList.add('mobile-mode');
      addLog('Switched live viewport to Smartphone frame (380px device simulation with notch).', 'muted');
    } else if (mode === 'tablet') {
      previewWrap.classList.add('tablet-mode');
      addLog('Switched live viewport to Tablet frame (720px iPad simulation).', 'muted');
    } else {
      previewWrap.classList.add('desktop-mode');
      addLog('Switched live viewport to Full Desktop resolution (100%).', 'muted');
    }
  });
});

// Open in New Tab Button (Fullscreen testing)
if (openNewTabBtn) {
  openNewTabBtn.addEventListener('click', () => {
    const targetUrl = activeProjectId 
      ? `/api/projects/${activeProjectId}/preview` 
      : `/api/preview`;
    window.open(targetUrl, '_blank');
    addLog(`Opened full preview in new tab: ${targetUrl}`, 'info');
  });
}

// Refresh Preview iframe
if (refreshPreviewBtn) {
  refreshPreviewBtn.addEventListener('click', () => {
    updatePreview(activeProjectId);
    addLog('Refreshed live preview frame.', 'muted');
  });
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
  if (officeEngine) {
    officeEngine.handlePipelineEvent(event);
  }

  const stage = event.stage;
  switch (stage) {
    case 'PIPELINE_STARTED':
      setOrchestrationLock(true);
      switchDockTab('telemetry');
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
      addLog('[SPECIALISTS] All specialists completed their technical specifications.', 'success');
      break;

    case 'MANAGER_SYNTHESIS_STARTED':
      setPipelineStep('step-synthesis', 'active');
      addLog('[MANAGER] Synthesizing specialist outputs into Unified Implementation Specification...', 'info');
      break;

    case 'MANAGER_SYNTHESIS_COMPLETED':
      setPipelineStep('step-synthesis', 'done');
      addLog('[MANAGER] Unified specification generated. Handing over to Coding Agent in Dev Den.', 'success');
      break;

    case 'CODING_AGENT_STARTED':
      setPipelineStep('step-coder', 'active');
      addLog('[CODING AGENT] Assembling complete self-contained index.html with styles & scripts...', 'info');
      break;

    case 'CODING_AGENT_COMPLETED':
      setPipelineStep('step-coder', 'done');
      addLog(`[CODING AGENT] index.html successfully generated (${event.contentLength} bytes).`, 'success');
      break;

    case 'QA_STARTED':
      setPipelineStep('step-qa', 'active');
      switchDockTab('qa');
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
              <span class="qa-issue-sev">${iss.severity?.toUpperCase()}:</span>
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
      setOrchestrationLock(false);
      setPipelineStep('step-preview', 'done');
      switchDockTab('edits');
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
      const current = projects.find(p => p.id === activeProjectId);
      if (current && activeProjectNameDisplay) {
        activeProjectNameDisplay.textContent = current.name;
      }
    } else if (projects.length > 0) {
      if (activeProjectNameDisplay) {
        activeProjectNameDisplay.textContent = projects[0].name;
      }
    }
  } catch (err) {
    console.error('Failed to load projects:', err);
  }
}

// Project Selection Change
if (projectSelect) {
  projectSelect.addEventListener('change', () => {
    activeProjectId = projectSelect.value || null;
    const selectedOption = projectSelect.options[projectSelect.selectedIndex];
    if (activeProjectNameDisplay) {
      activeProjectNameDisplay.textContent = selectedOption ? selectedOption.text : 'Active Workspace';
    }
    updatePreview(activeProjectId);
    addLog(`Switched view to project: ${activeProjectId || 'Active Workspace'}`, 'info');
  });
}

// New Project Reset
if (newProjectBtn) {
  newProjectBtn.addEventListener('click', () => {
    activeProjectId = null;
    if (projectSelect) projectSelect.value = '';
    if (promptInput) promptInput.value = '';
    if (activeProjectNameDisplay) activeProjectNameDisplay.textContent = 'New Project Atelier';
    resetAllAgents();
    resetPipelineSteps();
    updatePreview(null);
    orchestratorStatusTag.textContent = 'Ready for Task';
    addLog('[PROJECT] Cleared workspace. Enter a new goal to create a separate project.', 'info');
  });
}

// System Health & Model Discovery
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
}

// Sample Prompt
if (samplePromptBtn) {
  samplePromptBtn.addEventListener('click', () => {
    promptInput.value = 'Build a minimalist dark-mode portfolio landing page for an AI engineer with hero title, bio, interactive skills grid, and contact modal.';
    addLog('Loaded sample AI engineer portfolio specification.', 'info');
  });
}

// Trigger Full Multi-Agent Build
if (startOrchestrationBtn) {
  startOrchestrationBtn.addEventListener('click', async () => {
    const prompt = promptInput.value.trim();
    if (!prompt) {
      alert('Please enter a software or product goal to begin.');
      return;
    }

    setOrchestrationLock(true);
    orchestratorStatusTag.textContent = 'Building...';
    resetPipelineSteps();
    resetAllAgents();

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
      setOrchestrationLock(false);
    }
  });
}

// Apply Human Feedback (Minimal Change Rule)
async function handleApplyFeedback() {
  const feedback = feedbackInput.value.trim();
  if (!feedback) {
    alert('Please enter a modification request.');
    return;
  }

  setOrchestrationLock(true);
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
    setOrchestrationLock(false);
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

// Dock Tab Switching Logic (Telemetry, Targeted Edits, QA Audit, Projects)
export function switchDockTab(tabName) {
  const allTabs = document.querySelectorAll('.dock-tab-btn');
  const allPanes = document.querySelectorAll('.dock-pane');

  allTabs.forEach(btn => {
    const isActive = btn.dataset.tab === tabName;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });

  allPanes.forEach(pane => {
    const targetId = `pane${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`;
    pane.classList.toggle('active', pane.id === targetId);
  });
}

// Bind Dock Tab Clicks
document.querySelectorAll('.dock-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tabName = btn.dataset.tab;
    if (tabName) {
      switchDockTab(tabName);
    }
  });
});

// Quick Feedback Suggestion Chips
document.querySelectorAll('.suggestion-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    if (feedbackInput) {
      feedbackInput.value = chip.dataset.chip || chip.textContent.replace('+', '').trim();
      feedbackInput.focus();
    }
  });
});

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  initSystemStatus();
  initEventSource();
  loadProjects();
  setOrchestrationLock(false);
  switchDockTab('telemetry');
  addLog('Agent Orchestra Platform ready.', 'info');
});
