/**
 * OMNIVERSE — Simplified UI Controller
 * Manages prompt dispatch, real-time SSE progress tracking,
 * deliverable display, and live preview rendering.
 */

// DOM Elements
const promptInput = document.getElementById('promptInput');
const budgetSelect = document.getElementById('budgetSelect');
const generateBtn = document.getElementById('generateBtn');
const promptForm = document.getElementById('promptForm');
const ideaChips = document.querySelectorAll('.idea-chip');

// States
const promptSection = document.getElementById('promptSection');
const progressCard = document.getElementById('progressCard');
const progressBarFill = document.getElementById('progressBarFill');
const progressPercent = document.getElementById('progressPercent');
const activityTicker = document.getElementById('activityTicker');
const resultsCard = document.getElementById('resultsCard');

// Deliverables
const previewUrlBtn = document.getElementById('previewUrlBtn');
const openStudioBtn = document.getElementById('openStudioBtn');
const navStudioBtn = document.getElementById('navStudioBtn');
const navWorkingBadge = document.getElementById('navWorkingBadge');
const toggleInlineBtn = document.getElementById('toggleInlineBtn');
const inlinePreviewWrap = document.getElementById('inlinePreviewWrap');
const previewIframe = document.getElementById('previewIframe');
const previewIframeBox = document.getElementById('previewIframeBox');
const filesGrid = document.getElementById('filesGrid');
const fileCountBadge = document.getElementById('fileCountBadge');
const resetBtn = document.getElementById('resetBtn');

// Viewport buttons
const vpDesktop = document.getElementById('vpDesktop');
const vpTablet = document.getElementById('vpTablet');
const vpMobile = document.getElementById('vpMobile');

// Modal
const fileModal = document.getElementById('fileModal');
const modalFilename = document.getElementById('modalFilename');
const modalCode = document.getElementById('modalCode');
const modalClose = document.getElementById('modalClose');

// Internal State
let currentProjectId = null;
let currentPreviewUrl = '';
let currentFiles = [];
let eventSource = null;

// Pipeline Step Mapping
const steps = {
  manager: document.getElementById('stepManager'),
  specialists: document.getElementById('stepSpecialists'),
  synthesis: document.getElementById('stepSynthesis'),
  coding: document.getElementById('stepCoding'),
  qa: document.getElementById('stepQA'),
};

function updateStepStatus(activeKey) {
  const order = ['manager', 'specialists', 'synthesis', 'coding', 'qa'];
  const activeIndex = order.indexOf(activeKey);

  order.forEach((key, idx) => {
    const el = steps[key];
    if (!el) return;
    el.classList.remove('active', 'completed');
    if (idx < activeIndex) {
      el.classList.add('completed');
    } else if (idx === activeIndex) {
      el.classList.add('active');
    }
  });
}

function updateProgress(percent, message) {
  progressBarFill.style.width = `${percent}%`;
  progressPercent.textContent = `${percent}%`;
  if (message) {
    activityTicker.innerHTML = `<span class="ticker-dot"></span><span>${message}</span>`;
  }
}

function setWorkingState(isWorking) {
  if (isWorking) {
    if (navStudioBtn) navStudioBtn.style.display = 'none';
    if (navWorkingBadge) navWorkingBadge.style.display = 'inline-flex';
    window.onbeforeunload = () => 'An agent website build is currently in progress. Are you sure you want to leave?';
  } else {
    if (navStudioBtn) navStudioBtn.style.display = 'inline-flex';
    if (navWorkingBadge) navWorkingBadge.style.display = 'none';
    window.onbeforeunload = null;
  }
}

// Attach Quick Idea Chips
ideaChips.forEach(chip => {
  chip.addEventListener('click', () => {
    promptInput.value = chip.dataset.prompt;
    promptInput.focus();
  });
});

// Viewport Switching
[vpDesktop, vpTablet, vpMobile].forEach(btn => {
  if (!btn) return;
  btn.addEventListener('click', () => {
    [vpDesktop, vpTablet, vpMobile].forEach(b => b?.classList.remove('active'));
    btn.classList.add('active');
    const mode = btn.dataset.viewport;
    previewIframeBox.className = `preview-iframe-box ${mode}`;
  });
});

// Toggle Inline Preview
if (toggleInlineBtn) {
  toggleInlineBtn.addEventListener('click', () => {
    const isHidden = inlinePreviewWrap.style.display === 'none' || !inlinePreviewWrap.style.display;
    inlinePreviewWrap.style.display = isHidden ? 'block' : 'none';
    toggleInlineBtn.innerHTML = isHidden
      ? `<i data-lucide="eye-off" style="width: 16px; height: 16px;"></i><span>Hide Embedded Preview</span>`
      : `<i data-lucide="eye" style="width: 16px; height: 16px;"></i><span>Toggle Embedded Preview</span>`;
    if (window.lucide) window.lucide.createIcons();
  });
}

// File Modal Viewer
if (modalClose) {
  modalClose.addEventListener('click', () => {
    fileModal.style.display = 'none';
  });
}
window.addEventListener('click', e => {
  if (e.target === fileModal) {
    fileModal.style.display = 'none';
  }
});

async function openFileViewer(filePath) {
  if (!currentProjectId) return;
  try {
    const res = await fetch(`/api/projects/${encodeURIComponent(currentProjectId)}/files/${encodeURIComponent(filePath)}`);
    const data = await res.json();
    modalFilename.textContent = filePath;
    modalCode.textContent = data.content || '// Binary or empty file';
    fileModal.style.display = 'flex';
  } catch (err) {
    alert(`Could not load file: ${err.message}`);
  }
}

// Reset / Build Another
if (resetBtn) {
  resetBtn.addEventListener('click', () => {
    resultsCard.style.display = 'none';
    progressCard.style.display = 'none';
    promptSection.style.display = 'block';
    promptInput.value = '';
    promptInput.focus();
    generateBtn.disabled = false;
    currentProjectId = null;
    currentFiles = [];
    localStorage.removeItem('omni_simple_last_project');
    localStorage.removeItem('omni_simple_last_prompt');
    localStorage.removeItem('omni_simple_last_budget');
    window.history.pushState({}, '', window.location.pathname);
    setWorkingState(false);
    if (navStudioBtn) {
      navStudioBtn.href = './index.html';
    }
  });
}

// Connect to Real-time SSE
function connectEventStream() {
  if (eventSource) {
    eventSource.close();
  }
  eventSource = new EventSource('/api/orchestrate/events');

  eventSource.addEventListener('pipeline', e => {
    try {
      const ev = JSON.parse(e.data);
      handlePipelineEvent(ev);
    } catch (_) {}
  });

  eventSource.addEventListener('agentState', e => {
    try {
      const ev = JSON.parse(e.data);
      if (ev.state === 'working' || ev.state === 'streaming') {
        const agentName = ev.agentName || ev.agentId || 'Agent';
        activityTicker.innerHTML = `<span class="ticker-dot"></span><span>${agentName} is generating specifications & source...</span>`;
      }
    } catch (_) {}
  });

  eventSource.onerror = () => {
    // Reconnects automatically
  };
}

function handlePipelineEvent(ev) {
  switch (ev.stage) {
    case 'PIPELINE_STARTED':
    case 'MANAGER_PLAN_STARTED':
      updateStepStatus('manager');
      updateProgress(15, 'Manager Atlas is analyzing requirements and creating the file architecture...');
      break;

    case 'MANAGER_PLAN_COMPLETED':
    case 'SPECIALISTS_STARTED':
      updateStepStatus('specialists');
      updateProgress(35, 'Specialist Quorum convened: Designer, Frontend Architect, and Feature Architect are drafting contracts...');
      break;

    case 'SPECIALISTS_COMPLETED':
    case 'MANAGER_SYNTHESIS_STARTED':
      updateStepStatus('synthesis');
      updateProgress(60, 'Synthesizing visual direction, DOM layouts, and state machines into Unified Implementation Spec...');
      break;

    case 'MANAGER_SYNTHESIS_COMPLETED':
    case 'IMPLEMENTATION_STARTED':
      updateStepStatus('coding');
      updateProgress(75, 'Lead Coder Matrix is writing modular HTML, CSS stylesheets, and JavaScript...');
      break;

    case 'QA_AUDIT_STARTED':
    case 'QA_STARTED':
      updateStepStatus('qa');
      updateProgress(90, 'QA Auditor Query is running deterministic AST parsing & verifying resource links...');
      break;

    case 'QA_REPAIR_STARTED':
      updateStepStatus('qa');
      updateProgress(94, 'QA detected a link/syntax discrepancy. Performing automatic targeted repair...');
      break;

    case 'PIPELINE_COMPLETED':
      updateProgress(100, 'Website successfully built and validated!');
      break;

    case 'PIPELINE_FAILED':
      activityTicker.innerHTML = `<span class="ticker-dot" style="background:var(--accent-rose)"></span><span>Error: ${ev.error || 'Generation failed'}</span>`;
      break;
  }
}

// Handle Form Submission
if (promptForm) {
  promptForm.addEventListener('submit', async e => {
    e.preventDefault();
    const prompt = promptInput.value.trim();
    if (!prompt) return;

    const budget = parseFloat(budgetSelect?.value || '1.00');

    // Transition UI to Progress Mode
    promptSection.style.display = 'none';
    progressCard.style.display = 'block';
    resultsCard.style.display = 'none';
    generateBtn.disabled = true;
    setWorkingState(true);

    updateProgress(5, 'Connecting to OmniVerse Agent Orchestrator...');
    updateStepStatus('manager');
    connectEventStream();

    try {
      const response = await fetch('/api/orchestrate/task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          taskType: 'website',
          budget,
        }),
      });

      const result = await response.json();

      if (!response.ok || result.status !== 'success') {
        throw new Error(result.error || result.message || 'Website generation failed');
      }

      currentProjectId = result.projectId;

      // Persist state to localStorage
      try {
        localStorage.setItem('omni_simple_last_project', currentProjectId);
        localStorage.setItem('omni_simple_last_prompt', prompt);
        localStorage.setItem('omni_simple_last_budget', budget.toString());
      } catch (_) {}

      // Update URL without page reload so browser Back/Forward tracks this project
      const stateUrl = `${window.location.pathname}?project=${encodeURIComponent(currentProjectId)}`;
      window.history.pushState({ projectId: currentProjectId, prompt }, '', stateUrl);

      await displayResults(currentProjectId);

    } catch (err) {
      setWorkingState(false);
      alert(`Generation failed: ${err.message}`);
      promptSection.style.display = 'block';
      progressCard.style.display = 'none';
      generateBtn.disabled = false;
    }
  });
}

// Display Completed Deliverables
async function displayResults(projectId) {
  setWorkingState(false);
  updateProgress(100, 'Finalizing live sandbox...');

  // 1. Fetch Preview Info
  let previewUrl = `/p/${encodeURIComponent(projectId)}/index.html`;
  try {
    const infoRes = await fetch(`/api/projects/${encodeURIComponent(projectId)}/preview-info`);
    const info = await infoRes.json();
    if (info?.url) {
      previewUrl = info.url;
    }
  } catch (_) {}

  currentPreviewUrl = previewUrl;
  const absolutePreviewUrl = new URL(previewUrl, window.location.origin).href;

  const liveShareInput = document.getElementById('liveShareInput');
  if (liveShareInput) {
    liveShareInput.value = absolutePreviewUrl;
  }

  // Bind Copy Live Link button
  const copyLiveUrlBtn = document.getElementById('copyLiveUrlBtn');
  const copyBtnText = document.getElementById('copyBtnText');
  if (copyLiveUrlBtn && !copyLiveUrlBtn.dataset.bound) {
    copyLiveUrlBtn.dataset.bound = 'true';
    copyLiveUrlBtn.addEventListener('click', async () => {
      const input = document.getElementById('liveShareInput');
      const textToCopy = input?.value || currentPreviewUrl;
      try {
        await navigator.clipboard.writeText(textToCopy);
        copyLiveUrlBtn.classList.add('copied');
        if (copyBtnText) copyBtnText.textContent = 'Copied!';
        setTimeout(() => {
          copyLiveUrlBtn.classList.remove('copied');
          if (copyBtnText) copyBtnText.textContent = 'Copy Link';
        }, 2200);
      } catch (_) {
        input?.select();
        document.execCommand('copy');
        copyLiveUrlBtn.classList.add('copied');
        if (copyBtnText) copyBtnText.textContent = 'Copied!';
        setTimeout(() => {
          copyLiveUrlBtn.classList.remove('copied');
          if (copyBtnText) copyBtnText.textContent = 'Copy Link';
        }, 2200);
      }
    });
  }

  // 2. Fetch Generated Files
  try {
    const filesRes = await fetch(`/api/projects/${encodeURIComponent(projectId)}/files`);
    const filesData = await filesRes.json();
    currentFiles = (filesData.files || []).filter(f => !f.artifact);
  } catch (_) {
    currentFiles = [];
  }

  // 3. Populate Preview links
  if (previewUrlBtn) {
    previewUrlBtn.href = currentPreviewUrl;
    previewUrlBtn.target = '_blank';
  }
  if (openStudioBtn) {
    openStudioBtn.href = `/index.html?project=${encodeURIComponent(projectId)}`;
    openStudioBtn.target = '_blank';
  }
  if (navStudioBtn) {
    navStudioBtn.href = `./index.html?project=${encodeURIComponent(projectId)}`;
  }
  if (previewIframe) {
    previewIframe.src = currentPreviewUrl;
  }

  // 4. Render Files Grid
  if (fileCountBadge) {
    fileCountBadge.textContent = `${currentFiles.length} file${currentFiles.length === 1 ? '' : 's'}`;
  }
  if (filesGrid) {
    filesGrid.innerHTML = '';
    currentFiles.forEach(file => {
      const card = document.createElement('div');
      card.className = 'file-card';
      const ext = file.path.split('.').pop() || 'txt';
      const sizeKb = Math.max(1, Math.round((file.size || 0) / 1024));
      const iconColor = ext === 'html' ? '#e11d48' : ext === 'css' ? '#0284c7' : ext === 'js' ? '#d97706' : '#6366f1';
      const iconName = ext === 'html' ? 'layout' : ext === 'css' ? 'palette' : ext === 'js' ? 'code-2' : 'file';

      card.innerHTML = `
        <div class="file-info">
          <i data-lucide="${iconName}" style="width: 18px; height: 18px; color: ${iconColor}; flex-shrink: 0;"></i>
          <span class="file-name" title="${file.path}">${file.path}</span>
        </div>
        <span class="file-size">${sizeKb} KB</span>
      `;
      card.addEventListener('click', () => openFileViewer(file.path));
      filesGrid.appendChild(card);
    });
  }

  // 5. Transition to Results Card
  promptSection.style.display = 'none';
  progressCard.style.display = 'none';
  resultsCard.style.display = 'block';

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// Restore saved project state on page load or when going back/forward
async function restoreSavedState() {
  const urlParams = new URLSearchParams(window.location.search);
  const pid = urlParams.get('project') || localStorage.getItem('omni_simple_last_project');
  if (!pid) return;

  currentProjectId = pid;

  const savedPrompt = localStorage.getItem('omni_simple_last_prompt');
  if (savedPrompt && promptInput) {
    promptInput.value = savedPrompt;
  } else {
    // If not in storage, fetch prompt from project metadata
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(pid)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.project?.prompt && promptInput) {
          promptInput.value = data.project.prompt;
        }
      }
    } catch (_) {}
  }

  const savedBudget = localStorage.getItem('omni_simple_last_budget');
  if (savedBudget && budgetSelect) {
    budgetSelect.value = savedBudget;
  }

  // Ensure URL reflects current project query
  if (!urlParams.get('project')) {
    window.history.replaceState({ projectId: pid }, '', `${window.location.pathname}?project=${encodeURIComponent(pid)}`);
  }

  promptSection.style.display = 'none';
  progressCard.style.display = 'none';
  resultsCard.style.display = 'block';

  await displayResults(pid);
}

// History navigation: handles browser Back and Forward button actions
window.addEventListener('popstate', async (e) => {
  const urlParams = new URLSearchParams(window.location.search);
  const pid = urlParams.get('project') || e.state?.projectId;
  if (pid) {
    await restoreSavedState();
  } else {
    // Navigated back to clean simple landing
    resultsCard.style.display = 'none';
    progressCard.style.display = 'none';
    promptSection.style.display = 'block';
    generateBtn.disabled = false;
  }
});

// Restore on initial DOM load and Back/Forward cache restore
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', restoreSavedState);
} else {
  restoreSavedState();
}

window.addEventListener('pageshow', (e) => {
  // If restored from bfcache or user pressed Back from another page
  restoreSavedState();
});
