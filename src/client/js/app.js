/**
 * Agent Orchestra — Main Client Controller
 * Manages fixed 2.5D virtual office simulation, boss task delegations,
 * Paperclip/Linear-style sidebar metrics & recent tasks, expanded color-coded terminal,
 * and live device preview synchronization.
 */

import { PixiOffice, AGENT_ROSTER } from './pixi-office.js?v=4';
import { getLucideIcon, AGENT_ICONS, FILE_EXT_ICONS } from './icons.js';
import { agentStateManager, AGENT_STATUS, getStatusDisplayText } from './agent-state.js?v=4';
import { ProjectWorkspace } from './project-workspace.js';

const escapeHtml = text => String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const projectWorkspace = new ProjectWorkspace({
  isLocked: () => isOrchestrating,
  onMessage: (message, error) => addLog(message, error ? 'error' : 'info', 'SYS', 'FILES'),
  onChanged: async id => { await loadProjects(); updatePreview(id); },
  onImported: async id => { await loadProjects(); selectProject(id); switchTab(projectsList.find(p => p.id === id)?.projectType === 'documents' ? 'chat' : 'ide'); await loadProjectFiles(id); },
});

// Global State
let pixiOffice = null;
let activeTab = 'office';
let activeProjectId = null;
let currentPreviewUrl = '/api/preview';
let eventSource = null;
let selectedAgentId = 'nova';
let isChoreographyActive = false;
let activeRunId = null;
let previewRequest = 0;
let selectedTaskType = 'auto';

document.querySelectorAll('.task-type-select').forEach(select => select.addEventListener('change', () => {
  selectedTaskType = select.value;
  document.querySelectorAll('.task-type-select').forEach(other => { other.value = selectedTaskType; });
}));
document.querySelectorAll('.task-upload-btn').forEach(button => button.addEventListener('click', () => projectWorkspace.openImport()));

// DOM Elements: Navigation
const navButtons = document.querySelectorAll('.nav-tab-btn');
const tabViews = document.querySelectorAll('.tab-view');

// DOM Elements: Header Status & Project Selection
const headerProjectSelect = document.getElementById('headerProjectSelect');
const currentModelDisplay = document.getElementById('currentModelDisplay');
const headerAgentStats = document.getElementById('headerAgentStats');

// DOM Elements: Office Workspace
const pixiContainer = document.getElementById('pixiOfficeContainer');
const presetButtons = document.querySelectorAll('.preset-btn');
const presetStatusNotice = document.getElementById('presetStatusNotice');
const callToBossBtn = document.getElementById('callToBossBtn');

// 16-Agent Agency Orchestra Emoji Map
export const AGENT_EMOJIS = {
  atlas: '👑',
  // Designers
  pixel: '🎨', chroma: '✨', canvas: '🖌️',
  // Frontend Architects
  nova: '📐', blueprint: '🏗️', apex: '🖥️',
  // Feature Architects
  scout: '⚡', beacon: '🧭', compass: '🎯',
  // Coders
  byte: '💻', cipher: '⌨️', matrix: '🚀',
  // QA Auditors
  query: '🛡️', audit: '🔍', sentinel: '⚖️',
};

// DOM Elements: Agent Identity Inspector & Current Task Panel
const agentInspectorCard = document.getElementById('agentInspectorCard');
const closeInspectorBtn = document.getElementById('closeInspectorBtn');
const inspAvatar = document.getElementById('inspAvatar');
const inspName = document.getElementById('inspName');
const inspRole = document.getElementById('inspRole');
const inspCoreTag = document.getElementById('inspCoreTag');
const inspStatusBadge = document.getElementById('inspStatusBadge');
const inspQuote = document.getElementById('inspQuote');
const inspTaskTitle = document.getElementById('inspTaskTitle');
const inspTaskAction = document.getElementById('inspTaskAction');
const inspProgressFill = document.getElementById('inspProgressFill');
const inspProgressText = document.getElementById('inspProgressText');
const inspStartedAt = document.getElementById('inspStartedAt');
const inspModelTag = document.getElementById('inspModelTag');
const inspSkillsWrap = document.getElementById('inspSkillsWrap');
const inspBtnCoffee = document.getElementById('inspBtnCoffee');
const inspBtnMeeting = document.getElementById('inspBtnMeeting');
const inspBtnDesk = document.getElementById('inspBtnDesk');
const inspBtnBriefing = document.getElementById('inspBtnBriefing');

// DOM Elements: Sidebar Dual Rows
const sidebarTerminalLogs = document.getElementById('sidebarTerminalLogs');
const sidebarClearLogsBtn = document.getElementById('sidebarClearLogsBtn');
const sidebarChatStream = document.getElementById('sidebarChatStream');
const agentsRosterStrip = document.getElementById('agentsRosterStrip');
const sidebarPromptInput = document.getElementById('sidebarPromptInput');
const sidebarLaunchBtn = document.getElementById('sidebarLaunchBtn');

// DOM Elements: IDE Workspace
const ideProjectSelect = document.getElementById('ideProjectSelect');
const refreshFilesBtn = document.getElementById('refreshFilesBtn');
const ideFileList = document.getElementById('ideFileList');
const ideFileCount = document.getElementById('ideFileCount');
const ideActiveFilename = document.getElementById('ideActiveFilename');
const ideActiveFileIcon = document.getElementById('ideActiveFileIcon');
const ideActiveFileExt = document.getElementById('ideActiveFileExt');
const ideFileContent = document.getElementById('ideFileContent');
const copyCodeBtn = document.getElementById('copyCodeBtn');

// DOM Elements: Chat Command Center
const chatMessagesStream = document.getElementById('chatMessagesStream');
const chatPromptInput = document.getElementById('chatPromptInput');
const chatSendBtn = document.getElementById('chatSendBtn');
const chatMentionSelect = document.getElementById('chatMentionSelect');
const chatStatusTag = document.getElementById('chatStatusTag');

// DOM Elements: Preview
const previewWrap = document.getElementById('previewWrap');
const previewIframe = document.getElementById('previewIframe');
const previewUrlBadge = document.getElementById('previewUrlBadge');
const refreshPreviewBtn = document.getElementById('refreshPreviewBtn');
const openNewTabBtn = document.getElementById('openNewTabBtn');
const vpButtons = document.querySelectorAll('.viewport-btn[data-mode]');
const feedbackInput = document.getElementById('feedbackInput');
const applyFeedbackBtn = document.getElementById('applyFeedbackBtn');

// DOM Elements: Agents Directory
const agentsDirectoryGrid = document.getElementById('agentsDirectoryGrid');

// ==========================================================================
// 1. Navigation Tab Controller & Global Stores
// ==========================================================================

// --- Tasks Kanban Store & Controller ---
export let tasksStore = [
  {
    id: 'task-init',
    title: 'Autonomous System Environment Online',
    desc: '10 AI specialist roles loaded with dynamic model routing & atelier floor simulation.',
    stage: 'done',
    agentId: 'atlas',
    agentName: 'Atlas (Manager)',
    time: 'Ready'
  },
  {
    id: 'task-standby',
    title: 'Awaiting User Directives',
    desc: 'Manager standing by to analyze goals, assemble specialists, and generate execution plan.',
    stage: 'backlog',
    agentId: 'atlas',
    agentName: 'Atlas (Manager)',
    time: 'Standby'
  }
];

export function updateTasksBanner(text, agent = 'Atlas (Manager)') {
  const textEl = document.getElementById('tasksActiveText');
  const agentEl = document.getElementById('tasksActiveAgent');
  if (textEl) textEl.textContent = text;
  if (agentEl) agentEl.textContent = agent;
}

export function renderTasksBoard() {
  const backlogEl = document.getElementById('kanbanBacklogList');
  const progressEl = document.getElementById('kanbanProgressList');
  const reviewEl = document.getElementById('kanbanReviewList');
  const doneEl = document.getElementById('kanbanDoneList');

  const backlogCountEl = document.getElementById('kanbanBacklogCount');
  const progressCountEl = document.getElementById('kanbanProgressCount');
  const reviewCountEl = document.getElementById('kanbanReviewCount');
  const doneCountEl = document.getElementById('kanbanDoneCount');

  if (!backlogEl || !progressEl || !reviewEl || !doneEl) return;

  const cols = { backlog: [], progress: [], review: [], done: [] };
  tasksStore.forEach(t => {
    if (cols[t.stage]) cols[t.stage].push(t);
    else cols.backlog.push(t);
  });

  if (backlogCountEl) backlogCountEl.textContent = cols.backlog.length;
  if (progressCountEl) progressCountEl.textContent = cols.progress.length;
  if (reviewCountEl) reviewCountEl.textContent = cols.review.length;
  if (doneCountEl) doneCountEl.textContent = cols.done.length;

  const renderCard = (task) => {
    const agent = AGENT_ROSTER[task.agentId] || { name: task.agentName || 'Specialist', color: '#3B82F6' };
    return `
      <div class="kanban-task-card" data-task-id="${task.id}">
        <div class="kanban-card-top">
          <span class="kanban-stage-tag tag-${task.stage}">${task.stage.toUpperCase()}</span>
          <span class="kanban-card-time">${task.time || ''}</span>
        </div>
        <div class="kanban-card-title">${escapeHtml(task.title)}</div>
        <div class="kanban-card-desc">${escapeHtml(task.desc)}</div>
        <div class="kanban-card-footer">
          <span class="kanban-agent-badge">
            <span class="kanban-agent-dot" style="background:${agent.color || '#3B82F6'};"></span>
            <span>${agent.name}</span>
          </span>
        </div>
      </div>
    `;
  };

  backlogEl.innerHTML = cols.backlog.length ? cols.backlog.map(renderCard).join('') : '<div class="kanban-empty-state">No backlog tasks</div>';
  progressEl.innerHTML = cols.progress.length ? cols.progress.map(renderCard).join('') : '<div class="kanban-empty-state">No active sprint tasks</div>';
  reviewEl.innerHTML = cols.review.length ? cols.review.map(renderCard).join('') : '<div class="kanban-empty-state">No pending reviews</div>';
  doneEl.innerHTML = cols.done.length ? cols.done.map(renderCard).join('') : '<div class="kanban-empty-state">No completed tasks yet</div>';
}

export function startPipelineTasks(promptText) {
  const time = new Date().toLocaleTimeString();
  tasksStore = [
    {
      id: 'task-plan',
      title: 'Analyze Goal & Architecture Plan',
      desc: `Deconstruct user objective: "${(promptText || '').slice(0, 55)}..."`,
      stage: 'progress',
      agentId: 'atlas',
      agentName: 'Atlas (Manager)',
      time
    },
    {
      id: 'task-design',
      title: 'Visual Direction & UI/UX Design System',
      desc: 'Formulate color palette, typography tokens, animations, and micro-interactions',
      stage: 'backlog',
      agentId: 'pixel',
      agentName: 'Pixel (UI/UX Designer)',
      time: 'Queued'
    },
    {
      id: 'task-arch',
      title: 'DOM Architecture & Component Structure',
      desc: 'Engineered single-file DOM hierarchy, state management schema & execution flow',
      stage: 'backlog',
      agentId: 'nova',
      agentName: 'Nova (Frontend Architect)',
      time: 'Queued'
    },
    {
      id: 'task-feat',
      title: 'Behavioral Specifications & Interaction Flows',
      desc: 'Define reactive state, event triggers, validation constraints, and user action states',
      stage: 'backlog',
      agentId: 'scout',
      agentName: 'Scout (Feature Architect)',
      time: 'Queued'
    },
    {
      id: 'task-synth',
      title: 'Synthesize Master Implementation Blueprint',
      desc: 'Synthesize specialist specifications into unified specification for Coding Agent',
      stage: 'backlog',
      agentId: 'atlas',
      agentName: 'Atlas (Manager)',
      time: 'Queued'
    },
    {
      id: 'task-code',
      title: 'Full-Stack Single-File Coding (index.html)',
      desc: 'Generate complete, self-contained HTML/CSS/JS application matching design tokens',
      stage: 'backlog',
      agentId: 'byte',
      agentName: 'Byte (Lead Coder)',
      time: 'Queued'
    },
    {
      id: 'task-qa',
      title: 'QA DOM & JavaScript Compliance Audit',
      desc: 'Inspect semantic markup, responsive layout, JavaScript handlers & quality standards',
      stage: 'backlog',
      agentId: 'query',
      agentName: 'Query (QA Auditor)',
      time: 'Queued'
    }
  ];
  updateTasksBanner(`Executing sprint for: "${(promptText || '').slice(0, 40)}..."`, 'Atlas (Manager)');
  renderTasksBoard();
}

function startDocumentTasks(prompt) {
  tasksStore = [
    { id: 'task-doc-read', title: 'Inspect source material', desc: prompt, stage: 'progress', agentId: 'document-1', agentName: 'Document Analyst' },
    { id: 'task-doc-write', title: 'Write the requested Markdown document', desc: 'Use source evidence, requested detail, and format.', stage: 'backlog', agentId: 'document-1', agentName: 'Document Analyst' },
    { id: 'task-doc-save', title: 'Save and deliver the .md file', desc: 'Keep original files intact and record a new revision.', stage: 'backlog', agentId: 'document-1', agentName: 'Document Analyst' },
  ];
  renderTasksBoard();
}

async function openDocumentResult(projectId, path) {
  selectProject(projectId, false);
  if (activeProjectId !== projectId) return;
  projectWorkspace.selectedPath = path;
  switchTab('ide');
  await loadProjectFiles(projectId);
  await loadFileContent(projectId, path);
}

function showDocumentResult(projectId, data) {
  const doc = data.document;
  for (const stream of [chatMessagesStream, sidebarChatStream]) {
    if (!stream) continue;
    const card = document.createElement('div'); card.className = 'document-result';
    const title = document.createElement('strong'); title.textContent = doc.title;
    const detail = document.createElement('p'); detail.textContent = `${doc.path} · Revision ${data.revision}`;
    const coverage = document.createElement('p'); coverage.textContent = doc.warnings.length ? `${doc.warnings.length} source limitation(s); see Source coverage in the document.` : 'Markdown document saved.';
    const actions = document.createElement('div'); actions.className = 'result-actions';
    const open = document.createElement('button'); open.className = 'btn btn-xs btn-primary'; open.textContent = 'Open Markdown';
    open.addEventListener('click', () => { if (!isOrchestrating && !projectWorkspace.busy) openDocumentResult(projectId, doc.path); });
    const download = document.createElement('a'); download.className = 'btn btn-xs btn-outline'; download.textContent = 'Download .md';
    download.href = `/api/projects/${encodeURIComponent(projectId)}/files/${doc.path.split('/').map(encodeURIComponent).join('/')}?download=true`;
    actions.append(open, download); card.append(title, detail, coverage, actions); stream.append(card); stream.scrollTop = stream.scrollHeight;
  }
}

export function setTaskStage(taskId, newStage, note = null) {
  const task = tasksStore.find(t => t.id === taskId);
  if (task) {
    task.stage = newStage;
    task.time = new Date().toLocaleTimeString();
    if (note) task.desc = note;
    renderTasksBoard();
  }
}

// --- Inter-Agent Coordination Wire Store & Controller (Part 2 of Chat) ---
export let interagentMessages = [
  {
    id: 'wire-init',
    fromAgent: 'atlas',
    fromName: 'Atlas (Manager)',
    toAgent: 'specialists',
    toName: 'Specialist Ensemble',
    subject: 'System Standby & Channel Verification',
    message: 'Orchestrator ready. Standing by for project goals and user requirements.',
    timestamp: 'Initial'
  }
];

export function addInteragentMessage({ fromAgent, fromName, toAgent, toName, subject, message, timestamp } = {}) {
  const msgObj = {
    id: 'wire-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
    fromAgent: fromAgent || 'atlas',
    fromName: fromName || 'Atlas (Manager)',
    toAgent: toAgent || 'specialist',
    toName: toName || 'Specialist',
    subject: subject || 'Directives Hand-off',
    message: message || '',
    timestamp: timestamp || new Date().toLocaleTimeString()
  };
  interagentMessages.push(msgObj);
  renderInteragentStream();

  addActivityItem({
    type: 'comms',
    agentId: fromAgent || 'atlas',
    agentName: fromName || 'Atlas',
    title: `${fromName} ➔ ${toName}: ${subject}`,
    desc: message,
    timestamp: msgObj.timestamp
  });
}

export function renderInteragentStream() {
  const streamEl = document.getElementById('chatInteragentStream');
  if (!streamEl) return;

  if (interagentMessages.length === 0) {
    streamEl.innerHTML = `
      <div class="interagent-empty-state">
        <div class="wire-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
        </div>
        <p>Inter-agent communication channel is open. Dispatched task directives and specialist responses will stream here in real-time.</p>
      </div>
    `;
    return;
  }

  streamEl.innerHTML = interagentMessages.map(m => `
    <div class="interagent-card">
      <div class="interagent-route-row">
        <div class="wire-route-wrap">
           <span class="wire-sender-tag">${escapeHtml(m.fromName)}</span>
          <span class="wire-arrow">➔</span>
           <span class="wire-receiver-tag">${escapeHtml(m.toName)}</span>
        </div>
        <span class="wire-time">${m.timestamp}</span>
      </div>
      <div class="wire-subject">${escapeHtml(m.subject)}</div>
      <div class="wire-body">${escapeHtml(m.message)}</div>
    </div>
  `).join('');

  streamEl.scrollTop = streamEl.scrollHeight;
}

// --- Chronological Activity Timeline Store & Controller ---
export let activityStore = [
  {
    id: 'act-init',
    type: 'simulation',
    agentId: 'atlas',
    agentName: 'Atlas (Manager)',
    title: 'Workspace Initialized',
    desc: '10 AI specialist agents ready on duty in fixed 2.5D atelier simulation.',
    timestamp: 'Initial'
  }
];
export let currentActivityFilter = 'all';

export function addActivityItem({ type = 'simulation', agentId = 'sys', agentName = 'System', title = '', desc = '', timestamp = null } = {}) {
  const item = {
    id: 'act-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
    type,
    agentId,
    agentName,
    title,
    desc,
    timestamp: timestamp || new Date().toLocaleTimeString()
  };
  activityStore.unshift(item);
  if (activityStore.length > 250) activityStore.pop();
  renderActivityTimeline();
}

export function renderActivityTimeline() {
  const listEl = document.getElementById('activityTimelineList');
  if (!listEl) return;

  const filtered = currentActivityFilter === 'all'
    ? activityStore
    : activityStore.filter(a => a.type === currentActivityFilter);

  if (filtered.length === 0) {
    listEl.innerHTML = `
      <div class="timeline-empty-state">
        <span class="empty-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
        </span>
        <p>No activity recorded in this category yet.</p>
      </div>
    `;
    return;
  }

  listEl.innerHTML = filtered.map(item => {
    const emoji = AGENT_EMOJIS[item.agentId] || '⚡';
    return `
      <div class="activity-timeline-item">
        <div class="timeline-avatar">${emoji}</div>
        <div class="timeline-item-body">
          <div class="timeline-header-row">
            <div class="timeline-title-wrap">
              <span class="timeline-agent-name">${item.agentName}</span>
              <span class="timeline-type-badge type-${item.type}">${item.type}</span>
            </div>
            <span class="timeline-time">${item.timestamp}</span>
          </div>
          <div style="font-size:0.76rem;font-weight:700;color:var(--text-primary);margin-top:2px;">${escapeHtml(item.title)}</div>
          <div class="timeline-text">${escapeHtml(item.desc)}</div>
        </div>
      </div>
    `;
  }).join('');
}

// --- Main Tab Switcher ---
export function switchTab(tabId) {
  activeTab = tabId;

  navButtons.forEach(btn => {
    const isActive = btn.dataset.tab === tabId;
    btn.classList.toggle('active', isActive);
  });

  tabViews.forEach(view => {
    const targetId = tabId === 'ide' ? 'viewIde' : `view${tabId.charAt(0).toUpperCase() + tabId.slice(1)}`;
    const isActive = view.id === targetId;
    view.classList.toggle('active', isActive);

    if (isActive && window.Motion) {
      window.Motion.animate(view, { opacity: [0.65, 1], y: [6, 0] }, { duration: 0.2, easing: [0.16, 1, 0.3, 1] });
    }
  });

  if (tabId === 'tasks') {
    renderTasksBoard();
  } else if (tabId === 'chat') {
    if (chatMessagesStream) chatMessagesStream.scrollTop = chatMessagesStream.scrollHeight;
    renderInteragentStream();
  } else if (tabId === 'activity') {
    renderActivityTimeline();
  } else if (tabId === 'preview') {
    updatePreview(activeProjectId);
  } else if (tabId === 'ide') {
    loadProjectFiles(activeProjectId);
  } else if (tabId === 'agents') {
    renderAgentRosters();
  }
}

navButtons.forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// Setup listeners for Tasks, Chat wire, and Activity timeline actions
const addTaskBtn = document.getElementById('addTaskBtn');
if (addTaskBtn) {
  addTaskBtn.addEventListener('click', () => {
    const title = prompt('Enter new sprint task title:');
    if (title && title.trim()) {
      tasksStore.push({
        id: 'task-' + Date.now(),
        title: title.trim(),
        desc: 'Custom task created by user',
        stage: 'backlog',
        agentId: 'atlas',
        agentName: 'Atlas (Manager)',
        time: new Date().toLocaleTimeString()
      });
      renderTasksBoard();
      addLog(`Created new sprint task: "${title.trim()}"`, 'info', 'USER', 'TASK');
    }
  });
}

const clearActivityBtn = document.getElementById('clearActivityBtn');
if (clearActivityBtn) {
  clearActivityBtn.addEventListener('click', () => {
    activityStore = [];
    renderActivityTimeline();
    addLog('Activity timeline cleared.', 'info', 'SYS', 'CLEAR');
  });
}

const clearInteragentBtn = document.getElementById('clearInteragentBtn');
if (clearInteragentBtn) {
  clearInteragentBtn.addEventListener('click', () => {
    interagentMessages = [];
    renderInteragentStream();
  });
}

document.querySelectorAll('.activity-filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.activity-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentActivityFilter = btn.dataset.filter || 'all';
    renderActivityTimeline();
  });
});

// ==========================================================================
// 2. Initialize Fixed 2.5D Office Simulation
// ==========================================================================
function initOfficeSimulation() {
  if (!pixiContainer) return;

  pixiOffice = new PixiOffice(pixiContainer, {
    onAgentSelect: (agentId, agentData) => {
      showAgentInspector(agentId, agentData);
    },
    onLog: (msg, type) => {
      addLog(msg, type);
    }
  });

  // Presets
  presetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      presetButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const preset = btn.dataset.preset;
      pixiOffice.setPreset(preset);

      const labels = {
        focus: 'Focus Work Mode Active',
        coffee: 'Coffee Break Active ☕',
        meeting: 'All-Hands Meeting 👥',
        free: 'Free Roam Simulation 🚶'
      };
      if (presetStatusNotice) presetStatusNotice.textContent = labels[preset] || 'Active';
      addLog(`[PRESET] Switched office mode to: ${preset.toUpperCase()}`, 'info', 'SYS');
    });
  });

  // Boss Delegation Action Button
  if (callToBossBtn) {
    callToBossBtn.addEventListener('click', () => {
      if (pixiOffice) {
        pixiOffice.triggerManagerDelegation(selectedAgentId, 'Review sprint specs & implementation');
        addLog(`[DELEGATION] Manager Atlas summoned ${AGENT_ROSTER[selectedAgentId].name} for task briefing.`, 'info', 'AT');
      }
    });
  }

  // Quorum Meeting, Gated Desk Return & Review Protocol Simulation Button
  const runSprintMeetingFlowBtn = document.getElementById('runSprintMeetingFlowBtn');
  if (runSprintMeetingFlowBtn) {
    runSprintMeetingFlowBtn.addEventListener('click', () => {
      executeChoreographedMeetingWorkflow('Build modern portfolio with interactive showcase and contact drawer', { runBackendBuild: false });
    });
  }
}

// ==========================================================================
// 3. Agent Identity Inspector & Live Task Panel (Section 10)
// ==========================================================================
export function updateInspectorDetails(agentState) {
  if (!agentState || !agentInspectorCard) return;

  inspName.textContent = agentState.name;
  inspRole.textContent = agentState.role;
  inspCoreTag.style.display = agentState.core ? 'inline-block' : 'none';

  // Section 2 & 10: Accurate status badge
  const statusLower = (agentState.status || 'idle').toLowerCase();
  inspStatusBadge.className = `insp-status-badge status-${statusLower}`;

  let badgeLabel = `● ${agentState.status}`;
  if (agentState.status === AGENT_STATUS.IDLE) badgeLabel = '○ IDLE';
  else if (agentState.status === AGENT_STATUS.QUEUED) badgeLabel = '⏳ QUEUED';
  else if (agentState.status === AGENT_STATUS.COMPLETED) badgeLabel = '✓ COMPLETED';
  else if (agentState.status === AGENT_STATUS.FAILED) badgeLabel = '× FAILED';
  else if (agentState.status === AGENT_STATUS.WAITING) badgeLabel = '⏸ WAITING';

  inspStatusBadge.textContent = badgeLabel;

  // Exact activity text from Section 2
  inspQuote.textContent = `«${getStatusDisplayText(agentState.status, agentState.lastAction)}»`;

  // Section 10: Current Task Panel
  if (inspTaskTitle) {
    inspTaskTitle.textContent = agentState.currentTask || (agentState.status === AGENT_STATUS.IDLE ? 'No active task' : 'General Directive');
  }
  if (inspTaskAction) {
    inspTaskAction.textContent = agentState.lastAction || (agentState.status === AGENT_STATUS.IDLE ? 'Waiting for instructions' : 'Processing...');
  }
  if (inspProgressFill && inspProgressText) {
    const pct = agentState.status === AGENT_STATUS.IDLE ? 0 : (agentState.progress || 0);
    inspProgressFill.style.width = `${pct}%`;
    inspProgressText.textContent = `${pct}%`;
  }
  if (inspStartedAt) {
    inspStartedAt.textContent = agentState.startedAt || '—';
  }
}

/**
 * Prebuilt automated model routing & fallback chain metadata helper:
 * - Free Tier (Pixel, Nova, Scout, Byte, Query):
 *     Primary: Codestral Latest ($0.00 Free)
 *     Fallback 1: Kimi K3 ($0.05)
 *     Fallback 2: Gemini 3.5 Flash Lite ($0.10)
 * - Pro Tier (Chroma, Blueprint, Beacon, Cipher, Audit):
 *     Primary: Kimi K3 ($0.05)
 *     Fallback 1: Gemini 3.5 Flash Lite ($0.10)
 *     Fallback 2: Codestral Latest ($0.00 Free)
 * - Max Tier (Canvas, Apex, Compass, Matrix, Sentinel) & Manager (Atlas):
 *     Primary: Gemini 3.5 Flash Lite ($0.10)
 *     Fallback 1: Kimi K3 ($0.05)
 *     Fallback 2: Codestral Latest ($0.00 Free)
 */
export function getAgentRoutingInfo(agent) {
  if (!agent) {
    return {
      tier: 'pro',
      tierLabel: 'Pro Tier',
      tierBadgeClass: 'badge-tier-pro',
      costTag: '$0.05',
      primaryModel: 'Kimi K3',
      primaryCost: '$0.05',
      primaryDesc: 'Deep Reasoning',
      fallbackChain: [
        { name: 'Gemini 3.5 Flash Lite', cost: '$0.10' },
        { name: 'Codestral Latest', cost: '$0.00 Free' },
      ],
    };
  }

  const m = (agent.model || agent.modelId || '').toLowerCase();
  const id = (agent.id || agent.backendId || '').toLowerCase();
  const name = (agent.name || '').toLowerCase();

  // Tier classification: Free, Pro, or Max
  const isFree = m.includes('codestral') || m.includes('qwen') || id.includes('free') || id.endsWith('-1') || name.includes('junior') || name.includes('(free');
  const isPro = !isFree && (m.includes('kimi') || id.includes('pro') || id.endsWith('-2') || name.includes('(pro'));

  if (isFree) {
    return {
      tier: 'free',
      tierLabel: 'Free Tier',
      tierBadgeClass: 'badge-tier-free',
      costTag: '$0.00 Free',
      primaryModel: 'Codestral Latest',
      primaryCost: '$0.00 Free',
      primaryDesc: 'Fast & Free (16k)',
      fallbackChain: [
        { name: 'Kimi K3', cost: '$0.05' },
        { name: 'Gemini 3.5 Flash Lite', cost: '$0.10' },
      ],
    };
  } else if (isPro) {
    return {
      tier: 'pro',
      tierLabel: 'Pro Tier',
      tierBadgeClass: 'badge-tier-pro',
      costTag: '$0.05',
      primaryModel: 'Kimi K3',
      primaryCost: '$0.05',
      primaryDesc: 'Deep Reasoning',
      fallbackChain: [
        { name: 'Gemini 3.5 Flash Lite', cost: '$0.10' },
        { name: 'Codestral Latest', cost: '$0.00 Free' },
      ],
    };
  } else {
    // Max Tier & Manager
    return {
      tier: 'max',
      tierLabel: id.includes('manager') ? 'Lead Architect' : 'Max Tier',
      tierBadgeClass: 'badge-tier-max',
      costTag: '$0.10',
      primaryModel: 'Gemini 3.5 Flash Lite',
      primaryCost: '$0.10',
      primaryDesc: 'Highest Fidelity',
      fallbackChain: [
        { name: 'Kimi K3', cost: '$0.05' },
        { name: 'Codestral Latest', cost: '$0.00 Free' },
      ],
    };
  }
}

export function showAgentInspector(agentId) {
  selectedAgentId = agentId;
  const agentState = agentStateManager.getAgent(agentId);
  const def = AGENT_ROSTER[agentId] || agentState;
  if (!def || !agentInspectorCard) return;

  agentInspectorCard.style.display = 'flex';
  if (window.Motion) {
    window.Motion.animate(agentInspectorCard, { opacity: [0.65, 1], scale: [0.96, 1], y: [6, 0] }, { duration: 0.2, easing: [0.16, 1, 0.3, 1] });
  }

  inspAvatar.innerHTML = getLucideIcon(AGENT_ICONS[agentId] || 'bot', { size: 18 });
  inspAvatar.style.background = `${def.color || '#38BDF8'}22`;
  inspAvatar.style.borderColor = def.color || '#38BDF8';
  if (inspModelTag) inspModelTag.textContent = def.model;
  inspSkillsWrap.innerHTML = (def.skills || []).map(s => `<span class="skill-chip">${s}</span>`).join('');

  updateInspectorDetails(agentState || def);

  // Update prebuilt intelligence routing
  const routing = getAgentRoutingInfo(agentState || def);
  const inspCostTag = document.getElementById('inspCostTag');
  const inspCoreTag = document.getElementById('inspCoreTag');
  const inspPrimaryBadge = document.getElementById('inspPrimaryBadge');
  const inspPrimaryText = document.getElementById('inspPrimaryText');
  const inspFallbackList = document.getElementById('inspFallbackList');
  const inspRoutingCard = document.getElementById('inspRoutingCard');

  if (inspCoreTag) {
    inspCoreTag.textContent = def.backendId || def.id;
  }

  if (inspCostTag) {
    inspCostTag.textContent = `${routing.costTag} / call`;
  }

  if (inspRoutingCard) {
    inspRoutingCard.className = `prebuilt-route-card ${routing.tierBadgeClass}`;
  }

  if (inspPrimaryText) {
    inspPrimaryText.textContent = `${routing.primaryModel} (${routing.primaryCost})`;
  } else if (inspPrimaryBadge) {
    inspPrimaryBadge.innerHTML = `
      <span class="route-dot"></span>
      <span id="inspPrimaryText">${routing.primaryModel} (${routing.primaryCost})</span>
      <span class="route-locked-pill" style="margin-left: auto;">PREBUILT</span>
    `;
  }

  if (inspFallbackList) {
    inspFallbackList.innerHTML = routing.fallbackChain.map((fb, idx) => `
      ${idx > 0 ? '<span class="route-arrow">→</span>' : ''}
      <span class="route-step-chip">${fb.name} <small>(${fb.cost})</small></span>
    `).join('');
  }

  // Update active chip in sidebar strip
  document.querySelectorAll('.agent-mini-chip').forEach(el => {
    el.classList.toggle('active', el.dataset.agent === agentId);
  });

  // Focus Camera smoothly on selected agent
  if (pixiOffice) {
    pixiOffice.focusOnAgent(agentId);
  }
}

if (closeInspectorBtn) {
  closeInspectorBtn.addEventListener('click', () => {
    agentInspectorCard.style.display = 'none';
  });
}

if (inspBtnCoffee) {
  inspBtnCoffee.addEventListener('click', () => {
    if (pixiOffice && pixiOffice.agents[selectedAgentId]) {
      pixiOffice.navigateTo(pixiOffice.agents[selectedAgentId], 620, 395, {
        onComplete: () => {
          const a = pixiOffice.agents[selectedAgentId];
          a.state = 'coffee';
          a.bubbleText = 'Coffee ☕';
          a.bubbleTimer = 400;
          showAgentInspector(selectedAgentId);
          addLog(`${a.name} stepped away to Coffee Lounge for espresso.`, 'info', a.tag, 'PAUSE');
        }
      });
    }
  });
}

if (inspBtnMeeting) {
  inspBtnMeeting.addEventListener('click', () => {
    if (pixiOffice && pixiOffice.agents[selectedAgentId]) {
      pixiOffice.navigateTo(pixiOffice.agents[selectedAgentId], 380, 95, {
        onComplete: () => {
          const a = pixiOffice.agents[selectedAgentId];
          a.state = 'meeting';
          a.bubbleText = 'Meeting 👥';
          a.bubbleTimer = 400;
          showAgentInspector(selectedAgentId);
          addLog(`${a.name} joined the conference meeting room.`, 'info', a.tag, 'SYNC');
        }
      });
    }
  });
}

if (inspBtnDesk) {
  inspBtnDesk.addEventListener('click', () => {
    if (pixiOffice && pixiOffice.agents[selectedAgentId]) {
      const a = pixiOffice.agents[selectedAgentId];
      pixiOffice.navigateTo(a, a.home.x, a.home.y, {
        onComplete: () => {
          a.isSeated = true;
          a.facing = a.home.facing;
          showAgentInspector(selectedAgentId);
          addLog(`${a.name} seated at workstation.`, 'info', a.tag, 'STATION');
        }
      });
    }
  });
}

if (inspBtnBriefing) {
  inspBtnBriefing.addEventListener('click', () => {
    if (pixiOffice) {
      pixiOffice.triggerManagerDelegation(selectedAgentId, 'Review sprint objectives');
      addLog(`Manager Atlas briefing ${AGENT_ROSTER[selectedAgentId].name} on sprint goals.`, 'info', 'AT', 'BRIEF');
    }
  });
}

// Header Live Stats (Section 8)
export function updateHeaderStats() {
  if (headerAgentStats) {
    const active = agentStateManager.getActiveAgentsCount();
    const idle = agentStateManager.getIdleAgentsCount();
    headerAgentStats.textContent = `Active: ${active} | Idle: ${idle}`;
  }
}

// ==========================================================================
// 4. Render Sidebar Roster & Team Directory (Derived from Central State)
// ==========================================================================
function renderAgentRosters() {
  const allAgents = agentStateManager.getAllAgents();

  // 1. Sidebar Horizontal Chip Strip
  if (agentsRosterStrip) {
    agentsRosterStrip.innerHTML = allAgents.map(agent => {
      const isWorking = agent.status === AGENT_STATUS.WORKING || agent.status === AGENT_STATUS.CODING || agent.status === AGENT_STATUS.THINKING || agent.status === AGENT_STATUS.RUNNING;
      const isCompleted = agent.status === AGENT_STATUS.COMPLETED;
      const isFailed = agent.status === AGENT_STATUS.FAILED;

      return `
        <div class="agent-mini-chip ${agent.id === selectedAgentId ? 'active' : ''} ${isWorking ? 'working' : ''}" data-agent="${agent.id}">
          <span class="chip-avatar" style="border-color:${agent.color};">
            ${getLucideIcon(AGENT_ICONS[agent.id] || 'bot', { size: 13 })}
          </span>
          <span class="chip-name">${agent.name}</span>
          <span class="chip-status-dot ${isWorking ? 'dot-working' : (isCompleted ? 'dot-completed' : (isFailed ? 'dot-failed' : 'dot-idle'))}"></span>
        </div>
      `;
    }).join('');

    agentsRosterStrip.querySelectorAll('.agent-mini-chip').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.dataset.agent;
        if (id) {
          showAgentInspector(id);
          if (pixiOffice) {
            pixiOffice.selectAgent(id);
            pixiOffice.focusOnAgent(id);
          }
        }
      });
    });
  }

  // 2. Full Directory Grid (Team Tab)
  if (agentsDirectoryGrid) {
    agentsDirectoryGrid.innerHTML = allAgents.map(agent => {
      return `
        <div class="agent-dossier-card" data-agent="${agent.id}">
          <div class="dossier-header">
            <div class="dossier-avatar" style="border-color: ${agent.color};">
              ${getLucideIcon(AGENT_ICONS[agent.id] || 'bot', { size: 18 })}
            </div>
            <div class="dossier-meta">
              <div class="name-row">
                <span class="dossier-name">${agent.name}</span>
                ${agent.isHired ? '<span class="core-tag" style="background:#10B98120;color:#10B981;border-color:#10B98140;">HIRED</span>' : '<span class="core-tag" style="background:#64748B20;color:#64748B;border-color:#64748B40;">STANDBY</span>'}
              </div>
              <span class="dossier-role">${agent.role}</span>
            </div>
            <span class="insp-status-badge status-${agent.status.toLowerCase()}">
              ${agent.status === AGENT_STATUS.IDLE ? '○ IDLE' : (agent.status === AGENT_STATUS.COMPLETED ? '✓ COMPLETED' : (agent.status === AGENT_STATUS.FAILED ? '× FAILED' : `● ${agent.status}`))}
            </span>
          </div>

          <div class="insp-section task-section" style="margin-top:6px;padding:6px 8px;border-radius:6px;background:#F8FAFC;border:1px solid #E2E8F0;">
            <span class="section-label" style="font-size:0.6rem;color:#64748B;font-weight:700;">Current Task</span>
            <div class="dossier-task-title" style="font-size:0.75rem;font-weight:600;color:var(--text-primary);">
              ${agent.currentTask || 'No active task'}
            </div>
            <div class="dossier-task-action" style="font-size:0.68rem;color:var(--text-secondary);">
              ${agent.lastAction || 'Waiting for instructions'}
            </div>
          </div>

          <div class="insp-section model-config-section" style="margin-top:6px;">
            <div class="section-label-row">
              <span class="section-label">Prebuilt Model Routing</span>
              <span class="cost-tag">${getAgentRoutingInfo(agent).costTag}</span>
            </div>
            <div class="prebuilt-route-card ${getAgentRoutingInfo(agent).tierBadgeClass}">
              <div class="route-primary-row">
                <div class="route-primary-chip">
                  <span class="route-dot"></span>
                  <span class="route-model-name">${getAgentRoutingInfo(agent).primaryModel}</span>
                  <span class="route-model-cost">(${getAgentRoutingInfo(agent).primaryCost})</span>
                </div>
                <span class="route-locked-pill" title="Prebuilt & Locked: Automated cascade on rate limit/failure">LOCKED</span>
              </div>
              <div class="route-fallback-row">
                <span class="route-fallback-title">↳ Auto Fallbacks:</span>
                <div class="route-fallback-steps">
                  ${getAgentRoutingInfo(agent).fallbackChain.map((fb, idx) => `
                    ${idx > 0 ? '<span class="route-arrow">→</span>' : ''}
                    <span class="route-step-chip">${fb.name} <small>(${fb.cost})</small></span>
                  `).join('')}
                </div>
              </div>
            </div>
          </div>

          <div class="insp-section">
            <span class="section-label">Specialist Capabilities</span>
            <div class="skills-wrap">
              ${agent.skills.map(s => `<span class="skill-chip">${s}</span>`).join('')}
            </div>
          </div>

          <div class="inspector-actions">
            <button class="btn btn-xs btn-outline btn-locate-agent" data-agent="${agent.id}">
              ${getLucideIcon('compass', { size: 12 })} Locate in Office
            </button>
            <button class="btn btn-xs btn-primary btn-delegate-agent" data-agent="${agent.id}">
              ${getLucideIcon('briefcase', { size: 12 })} Boss Brief
            </button>
          </div>
        </div>
      `;
    }).join('');

    agentsDirectoryGrid.querySelectorAll('.btn-locate-agent').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.agent;
        switchTab('office');
        if (pixiOffice) pixiOffice.selectAgent(id);
      });
    });

    agentsDirectoryGrid.querySelectorAll('.btn-delegate-agent').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.agent;
        switchTab('office');
        if (pixiOffice) {
          pixiOffice.selectAgent(id);
          pixiOffice.triggerManagerDelegation(id, 'Implement Deliverable');
        }
      });
    });
  }
}

// Mini-chip live updater
function updateMiniChipStatus(agentState) {
  if (!agentsRosterStrip) return;
  const chip = agentsRosterStrip.querySelector(`.agent-mini-chip[data-agent="${agentState.id}"]`);
  if (!chip) return;

  const isWorking = agentState.status === AGENT_STATUS.WORKING || agentState.status === AGENT_STATUS.CODING || agentState.status === AGENT_STATUS.THINKING || agentState.status === AGENT_STATUS.RUNNING;
  const isCompleted = agentState.status === AGENT_STATUS.COMPLETED;
  const isFailed = agentState.status === AGENT_STATUS.FAILED;

  chip.classList.toggle('working', isWorking);

  const dot = chip.querySelector('.chip-status-dot');
  if (dot) {
    dot.className = `chip-status-dot ${isWorking ? 'dot-working' : (isCompleted ? 'dot-completed' : (isFailed ? 'dot-failed' : 'dot-idle'))}`;
  }
}

// Directory card live updater
function updateDirectoryCardStatus(agentState) {
  if (!agentsDirectoryGrid) return;
  const card = agentsDirectoryGrid.querySelector(`.agent-dossier-card[data-agent="${agentState.id}"]`);
  if (!card) return;

  const badge = card.querySelector('.insp-status-badge');
  if (badge) {
    badge.className = `insp-status-badge status-${agentState.status.toLowerCase()}`;
    badge.textContent = agentState.status === AGENT_STATUS.IDLE ? '○ IDLE' : (agentState.status === AGENT_STATUS.COMPLETED ? '✓ COMPLETED' : (agentState.status === AGENT_STATUS.FAILED ? '× FAILED' : `● ${agentState.status}`));
  }

  const taskTitle = card.querySelector('.dossier-task-title');
  if (taskTitle) taskTitle.textContent = agentState.currentTask || 'No active task';

  const taskAction = card.querySelector('.dossier-task-action');
  if (taskAction) taskAction.textContent = agentState.lastAction || 'Waiting for instructions';
}

// ==========================================================================
// 5. Terminal & Activity Logging with Dedicated Agent Colors (Section 4 & 9)
// ==========================================================================
export function addTerminalEntry(timestamp, agentTag, status, message, type = 'info', agentColor = null) {
  if (!sidebarTerminalLogs) return;

  const color = agentColor || '#94A3B8';
  const cleanMsg = (message || '').replace(/^\[.*?\]\s*/, '');

  const entry = document.createElement('div');
  entry.className = `term-entry log-${type}`;
  entry.innerHTML = `
    <span class="term-time">${timestamp}</span>
    <span class="term-agent-pill" style="color: ${color}; border-color: ${color}44; background: ${color}14;">
      ${agentTag}
    </span>
    <span class="term-status-pill status-${(status || 'info').toLowerCase()}">
      ${status || 'INFO'}
    </span>
    <span class="term-msg">${escapeHtml(cleanMsg)}</span>
  `;

  sidebarTerminalLogs.appendChild(entry);
  sidebarTerminalLogs.scrollTop = sidebarTerminalLogs.scrollHeight;

  if (sidebarTerminalLogs.children.length > 120) {
    sidebarTerminalLogs.removeChild(sidebarTerminalLogs.children[0]);
  }

  if (window.Motion) {
    window.Motion.animate(entry, { opacity: [0.35, 1], x: [-3, 0] }, { duration: 0.15 });
  }
}

export function addLog(message, type = 'info', agentTag = 'SYS', status = 'INFO') {
  const timestamp = new Date().toLocaleTimeString();
  const colorMap = {
    AT: '#F59E0B', NV: '#38BDF8', BY: '#10B981', PX: '#C084FC',
    QR: '#FB923C', FG: '#F43F5E', SC: '#2DD4BF', EC: '#EAB308',
    LN: '#06B6D4', RX: '#A855F7', SYS: '#94A3B8', USER: '#3B82F6'
  };
  addTerminalEntry(timestamp, agentTag, status, message, type, colorMap[agentTag] || '#94A3B8');

  // Mirror into activity timeline
  const agentKeyMap = {
    AT: 'atlas', NV: 'nova', BY: 'byte', PX: 'pixel', QR: 'query',
    SC: 'scout', SYS: 'sys', USER: 'user'
  };
  const agentId = agentKeyMap[agentTag] || 'atlas';
  const agentName = AGENT_ROSTER[agentId]?.name || (agentTag === 'USER' ? 'User' : 'System');
  const actType = (status === 'PAUSE' || status === 'SYNC' || status === 'DESK' || status === 'PRESET' || status === 'BRIEF' || message.includes('stepped away') || message.includes('joined') || message.includes('returned') || message.includes('Coffee') || message.includes('Meeting') || message.includes('Desk'))
    ? 'simulation'
    : (status === 'TASK' || status === 'READY' || status === 'SPAWN' || status === 'CLEAR')
      ? 'pipeline'
      : (status === 'SPEND' || status === 'BUDGET')
        ? 'budget'
        : 'simulation';

  addActivityItem({
    type: actType,
    agentId,
    agentName,
    title: `[${status}] ${message.slice(0, 50)}${message.length > 50 ? '...' : ''}`,
    desc: message,
    timestamp
  });
}

if (sidebarClearLogsBtn) {
  sidebarClearLogsBtn.addEventListener('click', () => {
    if (sidebarTerminalLogs) {
      sidebarTerminalLogs.innerHTML = `
        <div class="terminal-banner">
          <span class="term-banner-prompt">orchestra@agent-atelier:~$</span> telemetry --follow --all
        </div>
      `;
      addLog('Terminal logs cleared.', 'info', 'SYS', 'CLEAR');
    }
  });
}

// ==========================================================================
// 6. Project Management & Synchronization
// ==========================================================================
let projectsList = [];
let isOrchestrating = false;

export async function loadProjects() {
  try {
    const res = await fetch('/api/projects');
    const data = await res.json();
    projectsList = data.projects || [];
    renderProjectDropdowns();
  } catch (err) {
    console.error('Failed to load projects:', err);
  }
}

function renderProjectDropdowns() {
  let optionsHtml = `<option value="__new__">+ New Project Setup</option>`;

  if (projectsList.length > 0) {
    optionsHtml += `<optgroup label="Saved Projects (${projectsList.length})">`;
    optionsHtml += projectsList.map(p => {
      const name = p.name || p.id;
      return `<option value="${escapeHtml(p.id)}">${escapeHtml(name)}</option>`;
    }).join('');
    optionsHtml += `</optgroup>`;
  }

  if (headerProjectSelect) {
    headerProjectSelect.innerHTML = optionsHtml;
    headerProjectSelect.value = activeProjectId || '__new__';
  }

  if (ideProjectSelect) {
    ideProjectSelect.innerHTML = optionsHtml;
    ideProjectSelect.value = activeProjectId || '__new__';
  }
}

export function selectProject(projectId, reloadPreview = true) {
  if (projectWorkspace.dirty && projectId !== activeProjectId) {
    if (!confirm('Discard your unsaved file edits?')) { renderProjectDropdowns(); return; }
    projectWorkspace.cancelEdit();
  }
  if (projectId === '__new__' || !projectId) {
    ++previewRequest;
    projectWorkspace.clear();
    activeProjectId = '__new__';

    if (headerProjectSelect) headerProjectSelect.value = '__new__';
    if (ideProjectSelect) ideProjectSelect.value = '__new__';

    // 1. Reset Preview frame
    currentPreviewUrl = '/api/preview?starter=true';
    if (previewIframe) {
      previewIframe.src = `${currentPreviewUrl}&t=${Date.now()}`;
    }
    if (previewUrlBadge) {
      previewUrlBadge.textContent = 'Waiting for directives...';
    }

    // 2. Reset IDE Workspace to clean empty state (0 files)
    if (ideFileList) {
      ideFileList.innerHTML = `
        <div class="ide-empty-state">
          <div style="font-weight:600;margin-bottom:4px;color:var(--text-primary);">✨ New Project Setup</div>
          <div>No files generated yet. Direct the team in Chat or Dispatcher to create your application files.</div>
        </div>
      `;
    }
    if (ideFileCount) ideFileCount.textContent = '0 files';
    if (ideActiveFilename) ideActiveFilename.textContent = 'No files created yet';
    if (ideActiveFileExt) ideActiveFileExt.textContent = '';
    if (ideActiveFileIcon) {
      ideActiveFileIcon.innerHTML = getLucideIcon('file-text', { size: 16 });
    }
    if (ideFileContent) {
      ideFileContent.textContent = '// Brand New Project Setup\n// Enter an objective in Directives or Chat to begin autonomous multi-agent generation.';
    }

    // 3. Clear human feedback input
    if (feedbackInput) {
      feedbackInput.value = '';
    }

    addLog('Switched to New Project Setup. Studio ready for new build.', 'info', 'SYS');
    return;
  }

  // Previous saved project was selected
  activeProjectId = projectId;
  loadProjectFiles(projectId);

  if (headerProjectSelect) headerProjectSelect.value = projectId;
  if (ideProjectSelect) ideProjectSelect.value = projectId;

  if (reloadPreview) {
    updatePreview(activeProjectId);
  }

  const proj = projectsList.find(p => p.id === projectId);
  addLog(`Switched active project to: ${proj?.name || projectId}`, 'info', 'SYS');
}

if (headerProjectSelect) {
  headerProjectSelect.addEventListener('change', (e) => {
    const selectedId = e.target.value;
    if (selectedId) {
      selectProject(selectedId, true);
      addLog(`Switched active project to: ${selectedId}`, 'info', 'SYS');
    }
  });
}

if (ideProjectSelect) {
  ideProjectSelect.addEventListener('change', (e) => {
    const selectedId = e.target.value;
    if (selectedId) {
      selectProject(selectedId, true);
      addLog(`Switched IDE project to: ${selectedId}`, 'info', 'SYS');
    }
  });
}

// Active Orchestration Locking
export function setControlsLocked(locked) {
  isOrchestrating = locked;

  if (headerProjectSelect) headerProjectSelect.disabled = locked;
  if (ideProjectSelect) ideProjectSelect.disabled = locked;

  const sidebarSendInlineBtn = document.getElementById('sidebarSendInlineBtn');
  const chatSendInlineBtn = document.getElementById('chatSendInlineBtn');
  if (sidebarSendInlineBtn) sidebarSendInlineBtn.disabled = locked;
  if (chatSendInlineBtn) chatSendInlineBtn.disabled = locked;

  if (sidebarPromptInput) {
    sidebarPromptInput.disabled = locked;
    sidebarPromptInput.placeholder = locked
      ? 'Agents are actively collaborating... Modifications locked.'
      : 'Summarize files, explain a topic, write a document, or build a website...';
  }
  if (sidebarLaunchBtn) sidebarLaunchBtn.disabled = locked;

  if (chatPromptInput) {
    chatPromptInput.disabled = locked;
    chatPromptInput.placeholder = locked
      ? 'Agents are collaborating on sprint... Modifications locked.'
      : 'What should the agents explain, summarize, write, or build?';
  }
  if (chatSendBtn) chatSendBtn.disabled = locked;

  if (feedbackInput) {
    feedbackInput.disabled = locked;
    feedbackInput.placeholder = locked
      ? 'Agents are working... Modifications locked.'
      : 'e.g. Change primary button color to emerald and add customer review cards...';
  }
  if (applyFeedbackBtn) applyFeedbackBtn.disabled = locked;
  document.querySelectorAll('.budget-pill, .budget-number-input, .preset-btn, .inspector-actions button').forEach(el => { el.disabled = locked; });
  document.querySelectorAll('.task-type-select, .task-upload-btn').forEach(el => { el.disabled = locked; });
  const feedbackBudgetNumberInput = document.getElementById('feedbackBudgetNumberInput');
  if (feedbackBudgetNumberInput) feedbackBudgetNumberInput.disabled = locked;
  projectWorkspace.updateControls();
}

// ==========================================================================
// 7. IDE Project File Explorer & Source Viewer
// ==========================================================================
let currentActiveFilename = null;

export async function loadProjectFiles(projectId) {
  return projectWorkspace.load(projectId);
}

export async function loadFileContent(projectId, filename) {
  return projectWorkspace.read(projectId, filename);
}

if (copyCodeBtn) {
  copyCodeBtn.addEventListener('click', async () => {
    if (!ideFileContent) return;
    try {
      await navigator.clipboard.writeText(ideFileContent.textContent);
      const originalText = copyCodeBtn.textContent;
      copyCodeBtn.textContent = '✅ Copied!';
      setTimeout(() => { copyCodeBtn.textContent = originalText; }, 1500);
    } catch (_) {}
  });
}

if (refreshFilesBtn) {
  refreshFilesBtn.addEventListener('click', () => {
    if (activeProjectId) {
      loadProjectFiles(activeProjectId);
      addLog(`Refreshed files for project: ${activeProjectId}`, 'info', 'SYS');
    }
  });
}

// ==========================================================================
// 8. Live Preview Device Controls
// ==========================================================================
export async function updatePreview(projectId = null) {
  const sequence = ++previewRequest;
  currentPreviewUrl = '/api/preview?starter=true';
  if (projectId && projectId !== '__new__') {
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/preview-info`);
      const info = await res.json();
      if (sequence !== previewRequest) return;
      if (!res.ok) throw new Error(info.error || 'Unable to load preview');
      if (!info.supported) {
        previewIframe.src = '/api/preview?starter=true';
        previewUrlBadge.textContent = info.message;
        return;
      }
      currentPreviewUrl = info.url;
    } catch (err) { previewUrlBadge.textContent = err.message; return; }
  }
  const url = new URL(currentPreviewUrl, location.origin);
  url.searchParams.set('t', Date.now());
  if (previewIframe) previewIframe.src = url.href;
  if (previewUrlBadge) previewUrlBadge.textContent = currentPreviewUrl;
}

vpButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    vpButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const mode = btn.dataset.mode;
    previewWrap.classList.remove('desktop-mode', 'tablet-mode', 'mobile-mode');
    previewWrap.classList.add(`${mode}-mode`);
    addLog(`Preview viewport switched to ${mode.toUpperCase()} frame.`, 'info', 'SYS');
  });
});

if (openNewTabBtn) {
  openNewTabBtn.addEventListener('click', () => {
    const url = currentPreviewUrl;
    window.open(url, '_blank', 'noopener,noreferrer');
    addLog(`Opened live preview in full browser tab: ${url}`, 'info', 'SYS');
  });
}

if (refreshPreviewBtn) {
  refreshPreviewBtn.addEventListener('click', () => {
    updatePreview(activeProjectId);
    addLog('Refreshed live preview frame.', 'info', 'SYS');
  });
}

// Human Feedback (Minimal Change Edit)
async function handleApplyFeedback() {
  const feedback = feedbackInput.value.trim();
  if (!feedback || isOrchestrating) return;
  if (!activeProjectId || activeProjectId === '__new__') { addLog('Select or import a project before editing.', 'error'); return; }
  if (projectWorkspace.dirty || projectWorkspace.busy) { addLog('Save or cancel the current file edit first.', 'error'); return; }
  feedbackInput.value = '';
  await handleSendPrompt(feedback);
}

if (applyFeedbackBtn) applyFeedbackBtn.addEventListener('click', handleApplyFeedback);
if (feedbackInput) {
  feedbackInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleApplyFeedback();
    }
  });
}

// ==========================================================================
// 8.5. Prompt Budget Sync & Exhaustion Controls
// ==========================================================================
let currentBudgetAmount = 0.35;

function updateBudgetControls(val) {
  currentBudgetAmount = Math.max(0, parseFloat(val) || 0);
  const rounded = Math.round(currentBudgetAmount * 100) / 100;

  let label = `$${rounded.toFixed(2)}`;
  let activeTier = 'moderate';
  if (rounded <= 0.001) {
    label = 'Free ($0.00)';
    activeTier = 'free';
  } else if (rounded < 0.25) {
    label = `Lean ($${rounded.toFixed(2)})`;
    activeTier = 'lean';
  } else if (rounded < 0.50) {
    label = `Mid ($${rounded.toFixed(2)})`;
    activeTier = 'moderate';
  } else {
    label = `Max ($${rounded.toFixed(2)})`;
    activeTier = 'max';
  }

  const sideTag = document.getElementById('sidebarBudgetTierTag');
  const chatTag = document.getElementById('chatBudgetTierTag');
  const sideNumInput = document.getElementById('sidebarBudgetNumberInput');
  const chatNumInput = document.getElementById('chatBudgetNumberInput');
  const feedbackNumInput = document.getElementById('feedbackBudgetNumberInput');
  const feedbackCoderTag = document.getElementById('feedbackCoderModelTag');
  const sideSlider = document.getElementById('sidebarBudgetSlider');
  const chatSlider = document.getElementById('chatBudgetSlider');

  if (sideTag) sideTag.textContent = label;
  if (chatTag) chatTag.textContent = label;
  if (sideNumInput && parseFloat(sideNumInput.value) !== rounded) sideNumInput.value = rounded.toFixed(2);
  if (chatNumInput && parseFloat(chatNumInput.value) !== rounded) chatNumInput.value = rounded.toFixed(2);
  if (feedbackNumInput && parseFloat(feedbackNumInput.value) !== rounded) feedbackNumInput.value = rounded.toFixed(2);
  if (sideSlider && parseFloat(sideSlider.value) !== rounded) sideSlider.value = rounded;
  if (chatSlider && parseFloat(chatSlider.value) !== rounded) chatSlider.value = rounded;

  if (feedbackCoderTag) {
    if (activeTier === 'free') {
      feedbackCoderTag.textContent = 'Coder: Byte (Mistral $0.00)';
      feedbackCoderTag.className = 'feedback-coder-tag tier-free';
    } else {
      feedbackCoderTag.textContent = 'Coder: Matrix (Gemini $0.10)';
      feedbackCoderTag.className = 'feedback-coder-tag tier-pro';
    }
  }

  // Sync active pill state
  document.querySelectorAll('.budget-pill').forEach(pill => {
    const pillVal = parseFloat(pill.dataset.budget);
    let isPillActive = false;
    if (activeTier === 'free' && pillVal === 0.00) isPillActive = true;
    else if (activeTier === 'lean' && pillVal === 0.15) isPillActive = true;
    else if (activeTier === 'moderate' && pillVal === 0.35) isPillActive = true;
    else if (activeTier === 'max' && pillVal === 1.00) isPillActive = true;
    pill.classList.toggle('active', isPillActive);
  });
}

async function handleBudgetSliderChange(val) {
  updateBudgetControls(val);
  try {
    const res = await fetch('/api/budget/allocate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ budget: currentBudgetAmount }),
    });
    const data = await res.json();
    if (data.status === 'success') {
      if (data.selectedAgents) {
        agentStateManager.setHiredAgents(Object.values(data.selectedAgents));
      }
      if (data.assignments) {
        Object.values(data.assignments).forEach(asg => {
          agentStateManager.updateAgentModel(asg.agentId, asg.primaryModel);
        });
      }
      renderAgentRosters();
    }
  } catch (err) {
    console.warn('Failed to allocate budget:', err);
  }
}

function showBudgetExhaustedModal(spent = 0, limit = 0, pendingAction = null) {
  const modal = document.getElementById('budgetExhaustedModal');
  const spentEl = document.getElementById('budgetModalSpent');
  const limitEl = document.getElementById('budgetModalLimit');
  if (!modal) return;

  if (spentEl) spentEl.textContent = `$${parseFloat(spent || 0).toFixed(2)}`;
  if (limitEl) limitEl.textContent = `$${parseFloat(limit || 0).toFixed(2)}`;
  modal.style.display = 'flex';

  const closeBtn = document.getElementById('closeBudgetModalBtn');
  const cancelBtn = document.getElementById('cancelBudgetModalBtn');
  const confirmBtn = document.getElementById('confirmIncreaseBudgetBtn');
  const select = document.getElementById('increaseBudgetSelect');

  const closeModal = () => { modal.style.display = 'none'; };
  if (closeBtn) closeBtn.onclick = closeModal;
  if (cancelBtn) cancelBtn.onclick = closeModal;

  if (confirmBtn) {
    confirmBtn.onclick = async () => {
      const added = parseFloat(select?.value || '0.25');
      const newBudget = (added === 0) ? 0.00 : ((parseFloat(limit) || 0.25) + added);
      try {
        await fetch('/api/budget/allocate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ budget: newBudget }),
        });
        updateBudgetControls(newBudget);
        closeModal();
        addTerminalEntry(new Date().toLocaleTimeString(), 'BUDGET', 'EXTEND', `Budget extended to $${newBudget.toFixed(2)}. Resuming operation...`, 'info', '#10B981');
        if (typeof pendingAction === 'function') {
          pendingAction();
        } else if (typeof pendingAction === 'string') {
          handleSendPrompt(pendingAction);
        }
      } catch (err) {
        alert('Failed to update budget: ' + err.message);
      }
    };
  }
}

// ==========================================================================
// ==========================================================================
// 8.8. Choreographed Workflow: Quorum Meeting, Gated Desk Return & Review Protocol
// ==========================================================================
export async function executeChoreographedMeetingWorkflow(promptText, { runBackendBuild = false } = {}) {
  const delay = (ms) => new Promise(res => setTimeout(res, ms));
  const team = ['atlas', 'pixel', 'nova', 'scout', 'byte', 'query'];

  isChoreographyActive = true;
  addLog(`[WORKFLOW] Manager Atlas received directive: "${promptText.slice(0, 45)}..."`, 'info', 'AT', 'DIRECTIVE');

  // Switch to office view so the user watches the choreography live
  const officeTabBtn = document.querySelector('.nav-tab-btn[data-tab="office"]');
  if (officeTabBtn && activeTab !== 'office') {
    officeTabBtn.click();
  }

  try {
    // --------------------------------------------------------------------------
    // PHASE 1: Quorum Call (Boss + Specialists walk to Meeting Area)
    // --------------------------------------------------------------------------
    updateTasksBanner('QUORUM CALL: Atlas calling team to Conference Room for directive alignment...', 'Atlas (Manager)');
    if (presetStatusNotice) presetStatusNotice.textContent = 'Quorum Call: En Route to Meeting Room 👥';

    addInteragentMessage({
      fromAgent: 'atlas',
      fromName: 'Atlas (Manager)',
      toAgent: 'specialists',
      toName: 'Specialist Ensemble',
      subject: 'Quorum Call: Assemble in Conference Room',
      message: `@Team All specialists report to the Conference Room immediately. We have a new sprint directive: "${promptText.slice(0, 50)}..."`
    });

    // Populate tasks in Backlog — STRICT REQUIREMENT: NONE marked assigned or in-progress before meeting!
    tasksStore = [
      {
        id: 'task-plan',
        title: 'Sprint Objective & Roadmap Formulation',
        desc: `Deconstruct objective: "${promptText.slice(0, 40)}..." [Pending Meeting]`,
        stage: 'backlog',
        agentId: 'atlas',
        agentName: 'Atlas (Manager)',
        time: 'Pending Meeting'
      },
      {
        id: 'task-design',
        title: 'UI/UX Visual System & Design Tokens',
        desc: 'Formulate color palette & design tokens [Pending Meeting]',
        stage: 'backlog',
        agentId: 'pixel',
        agentName: 'Pixel (Designer)',
        time: 'Pending Meeting'
      },
      {
        id: 'task-arch',
        title: 'DOM Architecture & Layout Hierarchy',
        desc: 'Engineered single-file DOM hierarchy [Pending Meeting]',
        stage: 'backlog',
        agentId: 'nova',
        agentName: 'Nova (Frontend Architect)',
        time: 'Pending Meeting'
      },
      {
        id: 'task-feat',
        title: 'Interactive State Management & Handlers',
        desc: 'Define reactive state & user event handlers [Pending Meeting]',
        stage: 'backlog',
        agentId: 'scout',
        agentName: 'Scout (Feature Architect)',
        time: 'Pending Meeting'
      },
      {
        id: 'task-code',
        title: 'Master Single-File Web Application Implementation',
        desc: 'Generate complete production application [Pending Meeting]',
        stage: 'backlog',
        agentId: 'byte',
        agentName: 'Byte (Lead Coder)',
        time: 'Pending Meeting'
      },
      {
        id: 'task-qa',
        title: 'QA DOM & JavaScript Compliance Audit',
        desc: 'Inspect semantic markup & runtime compliance [Pending Meeting]',
        stage: 'backlog',
        agentId: 'query',
        agentName: 'Query (QA Auditor)',
        time: 'Pending Meeting'
      }
    ];
    renderTasksBoard();

    if (pixiOffice) {
      // Physically move Atlas and all specialists to Conference Table
      await pixiOffice.callQuorumMeeting(team, 'Sprint Objective Alignment');
    }

  // --------------------------------------------------------------------------
  // PHASE 2: Meeting in Session & Task Division
  // --------------------------------------------------------------------------
  updateTasksBanner('MEETING IN SESSION: Atlas breaking down roadmap & assigning tasks...', 'Atlas (Manager)');

  if (pixiOffice) {
    pixiOffice.showSpeechBubble('atlas', `Team, here is our roadmap: ${promptText.slice(0, 24)}... 📋`, 320);
  }

  addInteragentMessage({
    fromAgent: 'atlas',
    fromName: 'Atlas (Manager)',
    toAgent: 'specialists',
    toName: 'Specialist Ensemble',
    subject: 'Task Division & Work Breakdown',
    message: `Team, here is the roadmap: Pixel handles UI/UX design tokens; Nova designs single-file DOM schema; Scout maps interactive state; Byte generates master application; Query leads QA audit.`
  });

  await delay(1200);

  // Specialists acknowledge
  if (pixiOffice) {
    pixiOffice.showSpeechBubble('pixel', 'UI palette & tokens primed! 🎨', 240);
    pixiOffice.showSpeechBubble('nova', 'DOM architecture ready! 📐', 240);
    pixiOffice.showSpeechBubble('byte', 'Ready to code once at desk! 💻', 240);
  }

  addInteragentMessage({
    fromAgent: 'pixel',
    fromName: 'Pixel (Designer)',
    toAgent: 'atlas',
    toName: 'Atlas (Manager)',
    subject: 'Task Accepted: Design Tokens',
    message: 'Confirmed. Aligning executive color palette, typography tokens, and card hierarchies.'
  });

  await delay(1100);

  if (pixiOffice) {
    pixiOffice.showSpeechBubble('query', 'QA compliance suite primed! 🛡️', 240);
    pixiOffice.showSpeechBubble('atlas', 'Dismissed! Return to your desks before starting! 👑', 300);
  }

  addInteragentMessage({
    fromAgent: 'atlas',
    fromName: 'Atlas (Manager)',
    toAgent: 'specialists',
    toName: 'Specialist Ensemble',
    subject: 'Execution Rule: Strict Desk Seating Required',
    message: 'Dismissed! Absolute protocol: NOBODY begins work until you have walked to your desk and are fully seated.'
  });

  // Update tasks with detailed descriptions
  setTaskStage('task-plan', 'done', 'Requirements decomposed & team directives dispatched');
  setTaskStage('task-design', 'backlog', 'Assigned to Pixel [EN ROUTE TO DESK — LOCKED]');
  setTaskStage('task-arch', 'backlog', 'Assigned to Nova [EN ROUTE TO DESK — LOCKED]');
  setTaskStage('task-feat', 'backlog', 'Assigned to Scout [EN ROUTE TO DESK — LOCKED]');
  setTaskStage('task-code', 'backlog', 'Assigned to Byte [EN ROUTE TO DESK — LOCKED]');
  setTaskStage('task-qa', 'backlog', 'Assigned to Query [EN ROUTE TO DESK — LOCKED]');

  await delay(800);

  // --------------------------------------------------------------------------
  // PHASE 3: Gated Walk to Desks (Strict Rule: Work starts ONLY once seated)
  // --------------------------------------------------------------------------
  updateTasksBanner('TRANSIT: Specialists returning to workstations. Work remains LOCKED until seated.', 'Team Transit');
  if (presetStatusNotice) presetStatusNotice.textContent = 'Transit: Walking to Assigned Desks 🚶';

  if (pixiOffice) {
    // Send everyone back to their desks, tracking individual arrival
    const arrivalPromises = team.map(id => {
      const label = id === 'byte' ? 'coding 💻' : (id === 'atlas' ? 'monitoring 👑' : (id === 'query' ? 'inspecting 🔍' : 'working ⚙️'));
      const deskPromise = (typeof pixiOffice.sendAgentToDesk === 'function')
        ? pixiOffice.sendAgentToDesk(id, label)
        : (typeof pixiOffice.returnAgentsToDesks === 'function'
            ? pixiOffice.returnAgentsToDesks([id])
            : Promise.resolve());

      return deskPromise.then(() => {
        // Individual desk arrival handler: ONLY UNLOCK WHEN SEATED!
        const agentDef = AGENT_ROSTER[id];
        const updateStatus = (agentId, status, lastAction) => {
          if (agentStateManager && typeof agentStateManager.setAgentState === 'function') {
            agentStateManager.setAgentState(agentId, { status, lastAction });
          } else if (agentStateManager && typeof agentStateManager.setAgentStatus === 'function') {
            agentStateManager.setAgentStatus(agentId, status, { lastAction });
          }
        };

        if (id === 'pixel') {
          setTaskStage('task-design', 'progress', 'Seated at design desk. Formulating color palette & typography tokens.');
          updateStatus('pixel', AGENT_STATUS.WORKING, 'Formulating color palette & typography tokens');
        } else if (id === 'nova') {
          setTaskStage('task-arch', 'progress', 'Seated at architecture desk. Engineering semantic DOM hierarchy.');
          updateStatus('nova', AGENT_STATUS.WORKING, 'Engineering semantic DOM hierarchy');
        } else if (id === 'scout') {
          setTaskStage('task-feat', 'progress', 'Seated at feature desk. Implementing interactive state machines.');
          updateStatus('scout', AGENT_STATUS.WORKING, 'Implementing interactive state machines');
        } else if (id === 'byte') {
          setTaskStage('task-code', 'progress', 'Seated at coder desk. Compiling production index.html.');
          updateStatus('byte', AGENT_STATUS.CODING, 'Compiling production index.html');
        } else if (id === 'query') {
          setTaskStage('task-qa', 'backlog', 'Seated at QA desk. Monitoring build output for compliance inspection.');
          updateStatus('query', AGENT_STATUS.IDLE, 'Monitoring build output for compliance inspection');
        }
      });
    });

    await Promise.all(arrivalPromises);
  }

  updateTasksBanner('ALL AGENTS SEATED: Parallel specification & code generation active.', 'Specialists');
  if (presetStatusNotice) presetStatusNotice.textContent = 'Focus Work Active (All Specialists Seated)';

  // --------------------------------------------------------------------------
  // PHASE 4: Work Execution
  // --------------------------------------------------------------------------
  if (runBackendBuild) {
    const payload = { prompt: promptText, budget: currentBudgetAmount };
    if (activeProjectId && activeProjectId !== '__new__') {
      payload.projectId = activeProjectId;
    }
    const res = await fetch('/api/orchestrate/build', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      let errorMsg = `Server error ${res.status}`;
      try {
        const errJson = await res.json();
        if (res.status === 402 || errJson.status === 'budget_exhausted') {
          showBudgetExhaustedModal(errJson.spent, errJson.budget, promptText);
          setControlsLocked(false);
          return;
        }
        errorMsg = errJson.message || errJson.error || errorMsg;
      } catch (_) {}
      throw new Error(errorMsg);
    }
    const data = await res.json();
    if (data.projectId) {
      activeProjectId = data.projectId;
      await loadProjects();
      selectProject(activeProjectId, true);
      loadProjectFiles(activeProjectId);
    }
  } else {
    // Simulation delay to visualize active parallel work at desks
    await delay(2500);
  }

  // Mark specialist tasks done and transition code into review
  setTaskStage('task-design', 'done', 'Design tokens formulated and delivered');
  setTaskStage('task-arch', 'done', 'Single-file semantic DOM structure delivered');
  setTaskStage('task-feat', 'done', 'Interactive component schema delivered');
  setTaskStage('task-code', 'review', 'Code generated. Pending mandatory 1-on-1 QA audit in Meeting Room.');

  if (pixiOffice) {
    pixiOffice.markAgentDone('pixel', 'Tokens Ready ✓');
    pixiOffice.markAgentDone('nova', 'DOM Ready ✓');
    pixiOffice.markAgentDone('scout', 'State Ready ✓');
    pixiOffice.markAgentDone('byte', 'Code Ready ✓');
  }

  // --------------------------------------------------------------------------
  // PHASE 5: Reviewer Protocol (1-on-1 Meeting between Query and Byte)
  // --------------------------------------------------------------------------
  updateTasksBanner('QA AUDIT CALLED: Query summoning Byte to Conference Room for code review...', 'Query (QA Auditor)');
  if (presetStatusNotice) presetStatusNotice.textContent = '1-on-1 Review in Meeting Room (All Other Tasks Paused) 🔍';

  addInteragentMessage({
    fromAgent: 'query',
    fromName: 'Query (QA Auditor)',
    toAgent: 'byte',
    toName: 'Byte (Lead Coder)',
    subject: 'Code Review Protocol: Join Conference Room',
    message: '@Byte Code delivery received. Protocol requires a 1-on-1 audit in the Conference Room. Hold deployment until verified.'
  });

  if (pixiOffice) {
    pixiOffice.showSpeechBubble('query', '@Byte, to the Conference Room for review 🔍', 280);
    pixiOffice.showSpeechBubble('byte', 'On my way with code draft 🚶', 280);

    // Both navigate to conference room
    if (typeof pixiOffice.callReviewMeeting === 'function') {
      await pixiOffice.callReviewMeeting('query', 'byte', 'Single-File Code Audit');
    } else if (typeof pixiOffice.holdOneOnOneReview === 'function') {
      await pixiOffice.holdOneOnOneReview('query', 'byte', 'Single-File Code Audit');
    }
  }

  // Dialogue inside conference room
  updateTasksBanner('REVIEW IN SESSION: Query inspecting Byte\'s code delivery. Entire sprint gated.', 'Query (QA Auditor)');

  if (pixiOffice) {
    pixiOffice.showSpeechBubble('query', 'Checking DOM hierarchy, script tags & accessibility...', 300);
    await delay(1200);
    pixiOffice.showSpeechBubble('byte', 'Single-file HTML with responsive layout & zero dependencies.', 300);
    await delay(1200);
    pixiOffice.showSpeechBubble('query', 'Code passes compliance! Going to Manager Atlas to report. 🛡️', 300);
  }

  addInteragentMessage({
    fromAgent: 'query',
    fromName: 'Query (QA Auditor)',
    toAgent: 'atlas',
    toName: 'Atlas (Manager)',
    subject: 'Audit Completed: Escalating to Executive Desk',
    message: '1-on-1 code audit complete. Zero syntax violations detected. Heading to Manager Suite to present audit report to Atlas.'
  });

  await delay(900);

  // --------------------------------------------------------------------------
  // PHASE 6: Reviewer Reports to Manager (Boss Office)
  // --------------------------------------------------------------------------
  updateTasksBanner('ESCALATION: Query presenting audited file to Manager Atlas in Executive Suite...', 'Query (QA Auditor)');
  if (presetStatusNotice) presetStatusNotice.textContent = 'Audit Escalation: Query Reporting to Atlas';

  if (pixiOffice) {
    // Query walks to visitor spot in Atlas's office (x: 145, y: 120)
    await pixiOffice.reportToManager('query', 'Audit Report Submission');
    pixiOffice.showSpeechBubble('query', 'Boss, audit complete: 100% compliant, zero errors! 🛡️', 300);
    await delay(1200);
    pixiOffice.showSpeechBubble('atlas', 'Excellent work, Query. Approved! Notify Byte to publish. 👑', 320);
  }

  addInteragentMessage({
    fromAgent: 'atlas',
    fromName: 'Atlas (Manager)',
    toAgent: 'query',
    toName: 'Query (QA Auditor)',
    subject: 'Executive Sign-Off: Approved',
    message: 'Audit report reviewed and signed off. Code is certified for live preview deployment. Authorize Byte to publish.'
  });

  await delay(1000);

  // --------------------------------------------------------------------------
  // PHASE 7: Handover & Release
  // --------------------------------------------------------------------------
  if (pixiOffice) {
    pixiOffice.showSpeechBubble('query', 'Approved by Boss! ✓', 260);
    pixiOffice.showSpeechBubble('byte', 'Deploying to live preview! 🚀', 300);

    pixiOffice.markAgentDone('query', 'Audit Pass ✓');
    pixiOffice.markAgentDone('byte', 'Published ✓');
    pixiOffice.markAgentDone('atlas', 'Certified ✓');

    // Return Query and Byte to their desks
    const deskFn = typeof pixiOffice.sendAgentToDesk === 'function'
      ? (id, label) => pixiOffice.sendAgentToDesk(id, label)
      : (id) => pixiOffice.returnAgentsToDesks([id]);

    await Promise.all([
      deskFn('query', 'monitoring 🛡️'),
      deskFn('byte', '✓ published')
    ]);

    pixiOffice.releaseChoreographyLocks();
  }

  setTaskStage('task-code', 'done', 'Verified by Query & Manager. Deployed to live preview.');
  setTaskStage('task-qa', 'done', 'Full QA compliance certification granted (100% Pass)');
  updateTasksBanner('SPRINT COMPLETED: Application verified by QA Auditor & signed off by Manager.', 'Atlas (Manager)');
  if (presetStatusNotice) presetStatusNotice.textContent = 'Focus Work Active — Sprint Completed ✓';

  addActivityItem({
    type: 'pipeline',
    agentId: 'atlas',
    agentName: 'Atlas (Manager)',
    title: 'Sprint Complete & Certified',
    desc: `Objective "${promptText.slice(0, 45)}..." fully built, audited, and approved.`,
    timestamp: new Date().toLocaleTimeString()
  });

  if (activeProjectId) {
    loadProjectFiles(activeProjectId);
    updatePreview(activeProjectId);
  } else {
    updatePreview();
  }
  } finally {
    isChoreographyActive = false;
    if (pixiOffice) {
      pixiOffice.releaseChoreographyLocks();
    }
  }
}

// 9. Prompt Dispatcher & Live Orchestration
// ==========================================================================
async function handleSendPrompt(promptText) {
  if (!promptText || !promptText.trim() || isOrchestrating) return;
  if (projectWorkspace.dirty || projectWorkspace.busy) { addLog('Save or cancel your file edit before starting an agent run.', 'error'); return; }
  const prompt = promptText.trim();
  activeRunId = crypto.randomUUID();

  // Lock project switching and user inputs while agents are actively working
  setControlsLocked(true);

  const timestamp = new Date().toLocaleTimeString();

  // 1. Append user message to both main chat and sidebar chat
  const userHtml = `
    <div class="msg-avatar">${getLucideIcon('users', { size: 14 })}</div>
    <div class="msg-content">
      <div class="msg-header"><span class="msg-sender">YOU</span><span class="msg-time">${timestamp}</span></div>
      <div class="msg-body">${escapeHtml(prompt)}</div>
    </div>
  `;

  if (chatMessagesStream) {
    const userMsg = document.createElement('div');
    userMsg.className = 'chat-msg user';
    userMsg.innerHTML = userHtml;
    chatMessagesStream.appendChild(userMsg);
    chatMessagesStream.scrollTop = chatMessagesStream.scrollHeight;
  }

  if (sidebarChatStream) {
    const sideUserMsg = document.createElement('div');
    sideUserMsg.className = 'chat-msg user';
    sideUserMsg.innerHTML = userHtml;
    sidebarChatStream.appendChild(sideUserMsg);
    sidebarChatStream.scrollTop = sidebarChatStream.scrollHeight;
  }

  // 2. Append manager response
  setTimeout(() => {
    const mgrHtml = `
      <div class="msg-avatar">${getLucideIcon('crown', { size: 14 })}</div>
      <div class="msg-content">
        <div class="msg-header"><span class="msg-sender">ATLAS (MANAGER)</span><span class="msg-time">${new Date().toLocaleTimeString()}</span></div>
        <div class="msg-body">Request submitted. The Manager will choose a document or website workflow, and the assigned agent will use your project files to produce the requested result.</div>
      </div>
    `;

    if (chatMessagesStream) {
      const mgrMsg = document.createElement('div');
      mgrMsg.className = 'chat-msg manager';
      mgrMsg.innerHTML = mgrHtml;
      chatMessagesStream.appendChild(mgrMsg);
      chatMessagesStream.scrollTop = chatMessagesStream.scrollHeight;
    }

    if (sidebarChatStream) {
      const sideMgrMsg = document.createElement('div');
      sideMgrMsg.className = 'chat-msg manager';
      sideMgrMsg.innerHTML = mgrHtml;
      sidebarChatStream.appendChild(sideMgrMsg);
      sidebarChatStream.scrollTop = sidebarChatStream.scrollHeight;
    }
  }, 350);

  addLog(`Task received: "${prompt}"`, 'info', 'USER', 'TASK');
  agentStateManager.setAgentState('atlas', {
    status: AGENT_STATUS.QUEUED,
    currentTask: prompt,
    lastAction: 'Preparing project-aware execution',
    progress: 5,
  });

  if (chatStatusTag) chatStatusTag.textContent = 'Working on project…';

  try {
    tasksStore = [{ id: 'task-route', title: 'Select the requested deliverable', desc: prompt, stage: 'progress', agentId: 'atlas', agentName: 'Manager' }];
    renderTasksBoard();
    const payload = { prompt, taskType: selectedTaskType, budget: currentBudgetAmount, runId: activeRunId };
    if (activeProjectId && activeProjectId !== '__new__') payload.projectId = activeProjectId;
    const response = await fetch('/api/orchestrate/task', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    let result;
    try {
      result = await response.json();
    } catch (_) {
      throw new Error(`Server connection closed or returned unexpected format (${response.status} ${response.statusText})`);
    }
    if (!response.ok) {
      if (response.status === 402) { showBudgetExhaustedModal(result.spent, result.budget, prompt); return; }
      throw new Error(result.error || result.message || 'Task failed');
    }
    activeProjectId = result.projectId;
    await loadProjects();
    if (result.data.taskType === 'document') {
      showDocumentResult(activeProjectId, result.data);
      await openDocumentResult(activeProjectId, result.data.document.path);
      if (chatStatusTag) chatStatusTag.textContent = 'Markdown Ready';
      projectWorkspace.message(`Saved ${result.data.document.path} · Revision ${result.data.revision}. ${result.data.document.warnings.length} source limitation(s).`);
      return;
    }
    selectProject(activeProjectId);
    const verdict = result.data.qaReport?.result || 'not audited';
    if (chatStatusTag) chatStatusTag.textContent = verdict === 'passed' ? 'Preview Ready' : 'Saved · Review Findings';
    projectWorkspace.message(`Revision ${result.data.revision} saved. QA: ${verdict}. Open History to inspect file changes.`);
  } catch (err) {
    if (chatStatusTag) chatStatusTag.textContent = 'Error';
    const isNetworkError = err.name === 'TypeError' && (err.message.includes('fetch') || err.message.includes('NetworkError'));
    const displayMsg = isNetworkError
      ? 'Network error: request to server timed out or failed to fetch. Please verify that the server and model providers are reachable.'
      : err.message;
    addLog(`Task failed: ${displayMsg}`, 'error', 'SYS', 'FAILED');
    for (const stream of [chatMessagesStream, sidebarChatStream]) {
      if (!stream) continue;
      const message = document.createElement('p'); message.className = 'task-error'; message.setAttribute('role', 'alert'); message.textContent = displayMsg;
      stream.append(message); stream.scrollTop = stream.scrollHeight;
    }
    agentStateManager.setAgentState('atlas', {
      status: AGENT_STATUS.FAILED,
      lastAction: displayMsg,
    });
  } finally {
    activeRunId = null;
    setControlsLocked(false);
  }
}

// Quick Chat Chips
document.querySelectorAll('.chat-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const prompt = chip.dataset.prompt;
    if (chatPromptInput) {
      chatPromptInput.value = prompt;
      chatPromptInput.focus();
    }
  });
});

// Prompt Dispatch Handlers (NO auto-send on Enter! Plain Enter creates newline)
const dispatchSidebarPrompt = (e) => {
  if (e) e.preventDefault();
  if (!sidebarPromptInput) return;
  const val = sidebarPromptInput.value;
  if (val && val.trim()) {
    sidebarPromptInput.value = '';
    handleSendPrompt(val);
  }
};

const dispatchChatPrompt = (e) => {
  if (e) e.preventDefault();
  if (!chatPromptInput) return;
  const val = chatPromptInput.value;
  if (val && val.trim()) {
    chatPromptInput.value = '';
    handleSendPrompt(val);
  }
};

// Wire inline send buttons inside textboxes & footer buttons
const sidebarSendInlineBtn = document.getElementById('sidebarSendInlineBtn');
const chatSendInlineBtn = document.getElementById('chatSendInlineBtn');

if (sidebarSendInlineBtn) sidebarSendInlineBtn.addEventListener('click', dispatchSidebarPrompt);
if (sidebarLaunchBtn) sidebarLaunchBtn.addEventListener('click', dispatchSidebarPrompt);

if (chatSendInlineBtn) chatSendInlineBtn.addEventListener('click', dispatchChatPrompt);
if (chatSendBtn) chatSendBtn.addEventListener('click', dispatchChatPrompt);

// Optional shortcut: Ctrl+Enter or Cmd+Enter to dispatch (regular Enter just inserts newline)
if (sidebarPromptInput) {
  sidebarPromptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      dispatchSidebarPrompt();
    }
  });
}

if (chatPromptInput) {
  chatPromptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      dispatchChatPrompt();
    }
  });
}

// ==========================================================================
// 10. Real-time SSE Stream Listener (Single Source of Truth)
// ==========================================================================
function initEventSource() {
  if (eventSource) eventSource.close();
  eventSource = new EventSource('/api/orchestrate/events');

  eventSource.addEventListener('agentState', (e) => {
    try {
      const data = JSON.parse(e.data);
      if (activeRunId ? data.runId !== activeRunId : data.projectId && data.projectId !== activeProjectId) return;
      agentStateManager.handleAgentStateEvent(data);
    } catch (_) {}
  });

  eventSource.addEventListener('pipeline', (e) => {
    try {
      const data = JSON.parse(e.data);
      if (data.runId && (activeRunId ? data.runId !== activeRunId : data.projectId !== activeProjectId)) return;
      if (data.projectId && activeRunId === data.runId && (!activeProjectId || activeProjectId === '__new__')) activeProjectId = data.projectId;
      agentStateManager.handlePipelineEvent(data);

      if (data.stage === 'TASK_ROUTING_STARTED') {
        updateTasksBanner('Manager identifying the requested deliverable…');
      } else if (data.stage === 'TASK_ROUTED') {
        if (data.taskType === 'document') startDocumentTasks(data.prompt);
        else startPipelineTasks(data.prompt);
        addLog(`Selected workflow: ${data.taskType}`, 'info', 'MANAGER', 'ROUTE');
      } else if (data.stage === 'DOCUMENT_STARTED') {
        if (chatStatusTag) chatStatusTag.textContent = 'Analyzing source material…';
        updateTasksBanner('Document Analyst reading project files and preparing Markdown.', 'Document Analyst');
      } else if (data.stage === 'DOCUMENT_READING') {
        setTaskStage('task-doc-write', 'progress');
        addLog(`Document analysis turn ${data.round}: ${data.sources.filter(s => ['read', 'partial'].includes(s.status)).length} source(s) inspected.`, 'info', 'DOC', 'READ');
      } else if (data.stage === 'DOCUMENT_COMPLETED') {
        tasksStore.forEach(task => { task.stage = 'done'; }); renderTasksBoard();
        updateTasksBanner(`Markdown saved: ${data.document.path}`, 'Document Analyst');
        addLog(`Document saved: ${data.document.path}`, 'success', 'DOC', 'COMPLETE');
      } else if (data.stage === 'INTERAGENT_COMMUNICATION') {
        addInteragentMessage(data);
      } else if (isChoreographyActive) {
        // Physical office simulation is actively orchestrating meetings, desk walks & reviews.
        // Maintain synchronized spend metrics, logs, and IDE file refreshes without premature stage jumps.
        if (data.stage === 'AGENT_COST_INCURRED') {
          const spentEl = document.getElementById('spentCostDisplay');
          if (spentEl && data.totalProjectSpend !== undefined) {
            spentEl.textContent = `$${data.totalProjectSpend.toFixed(2)}`;
          }
          addTerminalEntry(
            new Date().toLocaleTimeString(),
            'COST',
            'SPEND',
            `${data.agentName} executed via ${data.modelUsed} (+$${data.cost.toFixed(2)}) | Spend: $${data.totalProjectSpend.toFixed(2)} / Budget: $${data.budget.toFixed(2)}`,
            'info',
            '#10B981'
          );
        } else if (data.stage === 'AGENT_FALLBACK') {
          addTerminalEntry(
            new Date().toLocaleTimeString(),
            'ROUTER',
            'FALLBACK',
            `⚠️ Agent ${data.agentId} model ${data.from} failed (${data.reason}). Automatically switched to ${data.to}`,
            'warning',
            '#F59E0B'
          );
        }
        const pid = data.projectId || activeProjectId;
        if (pid && (data.stage === 'MANAGER_PLAN_COMPLETED' || data.stage === 'SPECIALISTS_COMPLETED' || data.stage === 'CODING_AGENT_COMPLETED' || data.stage === 'QA_COMPLETED')) {
          loadProjectFiles(pid);
        }
      } else if (data.stage === 'PIPELINE_STARTED') {
        startPipelineTasks(data.prompt);
        addActivityItem({
          type: 'pipeline',
          agentId: 'atlas',
          agentName: 'Atlas (Manager)',
          title: 'Pipeline Dispatched',
          desc: `Assembling ensemble for: "${data.prompt}"`,
          timestamp: new Date().toLocaleTimeString(),
        });
      } else if (data.stage === 'MANAGER_PLAN_STARTED') {
        updateTasksBanner('Atlas analyzing requirements & structuring orchestration plan...', 'Atlas (Manager)');
      } else if (data.stage === 'MANAGER_PLAN_COMPLETED') {
        setTaskStage('task-plan', 'done');
        updateTasksBanner('Manager plan finalized. Specialist ensemble dispatched.', 'Atlas (Manager)');
        addActivityItem({
          type: 'pipeline',
          agentId: 'atlas',
          agentName: 'Atlas (Manager)',
          title: 'Plan & Agent Directives Finalized',
          desc: `Produced plan with ${data.plan?.explicit_requirements?.length || 0} requirements for selected specialists [${(data.plan?.selected_agents || []).join(', ')}]`,
          timestamp: new Date().toLocaleTimeString(),
        });
        const pid = data.projectId || activeProjectId;
        if (pid) loadProjectFiles(pid);
      } else if (data.stage === 'SPECIALISTS_STARTED') {
        setTaskStage('task-design', 'progress');
        setTaskStage('task-arch', 'progress');
        setTaskStage('task-feat', 'progress');
        updateTasksBanner('Design, Frontend, and Feature specialists executing in parallel...', 'Specialists');
      } else if (data.stage === 'SPECIALISTS_COMPLETED') {
        setTaskStage('task-design', 'done');
        setTaskStage('task-arch', 'done');
        setTaskStage('task-feat', 'done');
        if (pixiOffice) {
          pixiOffice.markAgentDone('pixel', 'Tokens Ready ✓');
          pixiOffice.markAgentDone('nova', 'DOM Ready ✓');
          pixiOffice.markAgentDone('scout', 'State Ready ✓');
        }
        updateTasksBanner('Specialist specifications delivered to Manager Atlas.', 'Specialists');
        addActivityItem({
          type: 'pipeline',
          agentId: 'nova',
          agentName: 'Specialist Ensemble',
          title: 'Specialist Specifications Delivered',
          desc: 'Design tokens, DOM architecture, and feature specifications completed.',
          timestamp: new Date().toLocaleTimeString(),
        });
        const pid = data.projectId || activeProjectId;
        if (pid) loadProjectFiles(pid);
      } else if (data.stage === 'MANAGER_SYNTHESIS_STARTED') {
        setTaskStage('task-synth', 'progress');
        updateTasksBanner('Synthesizing unified implementation specification for Coder...', 'Atlas (Manager)');
      } else if (data.stage === 'MANAGER_SYNTHESIS_COMPLETED') {
        setTaskStage('task-synth', 'done');
        updateTasksBanner('Unified master blueprint dispatched to Lead Coder Byte.', 'Atlas (Manager)');
        addActivityItem({
          type: 'pipeline',
          agentId: 'atlas',
          agentName: 'Atlas (Manager)',
          title: 'Master Blueprint Synthesized',
          desc: 'Unified Implementation Specification compiled and dispatched to Lead Coder.',
          timestamp: new Date().toLocaleTimeString(),
        });
        const pid = data.projectId || activeProjectId;
        if (pid) loadProjectFiles(pid);
      } else if (data.stage === 'CODING_AGENT_STARTED') {
        setTaskStage('task-code', 'progress');
        updateTasksBanner('Coding Agent implementing the requested project files...', 'Coding Agent');
      } else if (data.stage === 'CODING_AGENT_COMPLETED') {
        setTaskStage('task-code', 'review');
        if (pixiOffice) {
          pixiOffice.markAgentDone('byte', 'Code Ready ✓');
        }
        updateTasksBanner('Code delivery ready. Submitting to Query for QA audit...', 'Byte (Lead Coder)');
        addActivityItem({
          type: 'pipeline',
          agentId: 'byte',
          agentName: 'Byte (Lead Coder)',
          title: 'Code Delivery Finalized',
          desc: `Saved revision ${data.revision} with ${data.changes?.length || 0} file change(s) and build summary.`,
          timestamp: new Date().toLocaleTimeString(),
        });
        const pid = data.projectId || activeProjectId;
        if (pid) loadProjectFiles(pid);
      } else if (data.stage === 'QA_STARTED') {
        setTaskStage('task-qa', 'progress');
        updateTasksBanner('Query auditing DOM integrity and JavaScript interactions...', 'Query (QA Auditor)');
      } else if (data.stage === 'QA_COMPLETED') {
        setTaskStage('task-code', 'done');
        setTaskStage('task-qa', 'done');
        if (pixiOffice) {
          pixiOffice.markAgentDone('query', 'QA Certified ✓');
          pixiOffice.markAgentDone('atlas', 'Sprint Complete ✓');
        }
        updateTasksBanner(`QA Audit completed: ${(data.result || 'NOT AUDITED').toUpperCase()}`, 'Query (QA Auditor)');
        addActivityItem({
          type: 'pipeline',
          agentId: 'query',
          agentName: 'Query (QA Auditor)',
          title: `QA Audit Verdict: ${(data.result || 'NOT AUDITED').toUpperCase()}`,
          desc: `Audit finished with status: ${data.result || 'not audited'} (${(data.issues || []).length} issues found).`,
          timestamp: new Date().toLocaleTimeString(),
        });
        const pid = data.projectId || activeProjectId;
        if (pid) loadProjectFiles(pid);
      } else if (data.stage === 'AGENT_COST_INCURRED') {
        const spentEl = document.getElementById('spentCostDisplay');
        if (spentEl && data.totalProjectSpend !== undefined) {
          spentEl.textContent = `$${data.totalProjectSpend.toFixed(2)}`;
        }
        addTerminalEntry(
          new Date().toLocaleTimeString(),
          'COST',
          'SPEND',
          `${data.agentName} executed via ${data.modelUsed} (+$${data.cost.toFixed(2)}) | Spend: $${data.totalProjectSpend.toFixed(2)} / Budget: $${data.budget.toFixed(2)}`,
          'info',
          '#10B981'
        );
        addActivityItem({
          type: 'budget',
          agentId: 'atlas',
          agentName: 'Budget Service',
          title: `Cost Incurred: +$${data.cost.toFixed(2)}`,
          desc: `${data.agentName} via ${data.modelUsed}. Spend: $${data.totalProjectSpend.toFixed(2)} of $${data.budget.toFixed(2)}`,
          timestamp: new Date().toLocaleTimeString(),
        });
      } else if (data.stage === 'AGENT_FALLBACK') {
        addTerminalEntry(
          new Date().toLocaleTimeString(),
          'ROUTER',
          'FALLBACK',
          `⚠️ Agent ${data.agentId} model ${data.from} failed (${data.reason}). Automatically switched to ${data.to}`,
          'warning',
          '#F59E0B'
        );
      } else if (data.stage === 'BUDGET_ALLOCATED') {
        if (data.selectedAgents) {
          agentStateManager.setHiredAgents(Object.values(data.selectedAgents));
          renderAgentRosters();
        }
        addTerminalEntry(
          new Date().toLocaleTimeString(),
          'BUDGET',
          'TEAM',
          `Budget set to $${data.budget.toFixed(2)} (${data.tier.toUpperCase()}). Est. run cost: $${data.estimatedCost.toFixed(2)}`,
          'info',
          '#3B82F6'
        );
      }

      if (data.stage === 'PIPELINE_COMPLETED') {
        if (!activeRunId) setControlsLocked(false);
        const passed = data.qaReport?.result === 'passed';
        updateTasksBanner(data.specificationOnly ? 'Specification ready.' : passed ? 'Project saved and audited. Preview ready.' : 'Project saved. Review the QA findings.', 'Atlas (Manager)');
        tasksStore.forEach(t => { t.stage = !passed && t.id === 'task-qa' ? 'review' : 'done'; });
        renderTasksBoard();
        const pid = data.projectId || activeProjectId;
        if (pid) {
          activeProjectId = pid;
          loadProjects();
          selectProject(pid, true);
          loadProjectFiles(pid);
          updatePreview(pid);
        }
      } else if (data.stage === 'PIPELINE_FAILED' || data.stage === 'FEEDBACK_FAILED' || data.stage === 'TASK_FAILED') {
        if (!activeRunId) setControlsLocked(false);
        updateTasksBanner(`Pipeline halted: ${data.error || 'Check logs'}`, 'System');
      }
    } catch (_) {}
  });
}

// ==========================================================================
// 11. System Health & Initialization
// ==========================================================================
async function initSystemHealth() {
  try {
    const res = await fetch('/api/models');
    const data = await res.json();
    if (data.models && data.models.length > 0 && currentModelDisplay) {
      currentModelDisplay.textContent = data.models[0].name;
    }
  } catch (_) {}
}

function bootstrap() {
  projectWorkspace.init();
  // Global budget dialog must remain visible regardless of the active tab.
  const budgetDialog = document.getElementById('budgetExhaustedModal');
  if (budgetDialog) document.body.appendChild(budgetDialog);
  initOfficeSimulation();
  renderAgentRosters();
  loadProjects();
  initEventSource();
  initSystemHealth();
  renderTasksBoard();
  renderInteragentStream();
  renderActivityTimeline();

  // Single Source of Truth Subscription (Section 1 & 8)
  agentStateManager.subscribe((agentState) => {
    if (agentState.id === selectedAgentId) {
      updateInspectorDetails(agentState);
    }
    updateMiniChipStatus(agentState);
    updateDirectoryCardStatus(agentState);
    updateHeaderStats();
  });

  agentStateManager.onTerminalLog((log) => {
    addTerminalEntry(log.timestamp, log.agentTag, log.status, log.message, log.type, log.agentColor);
  });

  // Prompt Embedded Budget Controls (Pills, Number Inputs, and Sliders)
  const sidebarBudgetSlider = document.getElementById('sidebarBudgetSlider');
  const chatBudgetSlider = document.getElementById('chatBudgetSlider');
  const sidebarBudgetNumberInput = document.getElementById('sidebarBudgetNumberInput');
  const chatBudgetNumberInput = document.getElementById('chatBudgetNumberInput');

  // 1. Sliders
  if (sidebarBudgetSlider) {
    sidebarBudgetSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      handleBudgetSliderChange(val);
    });
  }

  if (chatBudgetSlider) {
    chatBudgetSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      handleBudgetSliderChange(val);
    });
  }

  // 2. Custom Numeric Inputs
  const handleNumberInput = (e) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val) && val >= 0) {
      handleBudgetSliderChange(val);
    }
  };

  if (sidebarBudgetNumberInput) {
    sidebarBudgetNumberInput.addEventListener('input', handleNumberInput);
    sidebarBudgetNumberInput.addEventListener('change', handleNumberInput);
  }

  if (chatBudgetNumberInput) {
    chatBudgetNumberInput.addEventListener('input', handleNumberInput);
    chatBudgetNumberInput.addEventListener('change', handleNumberInput);
  }

  const feedbackBudgetNumberInput = document.getElementById('feedbackBudgetNumberInput');
  if (feedbackBudgetNumberInput) {
    feedbackBudgetNumberInput.addEventListener('input', handleNumberInput);
    feedbackBudgetNumberInput.addEventListener('change', handleNumberInput);
  }

  // 3. Quick Budget Tier Pills (Free, Lean, Moderate, Max)
  document.querySelectorAll('.budget-pill').forEach(pill => {
    pill.addEventListener('click', (e) => {
      e.preventDefault();
      const budgetVal = parseFloat(pill.dataset.budget);
      if (!isNaN(budgetVal)) {
        handleBudgetSliderChange(budgetVal);
      }
    });
  });

  // Initialize budget controls at default Moderate ($0.35)
  updateBudgetControls(0.35);

  // Spawn Agent modal controller
  const spawnAgentBtn = document.getElementById('spawnAgentBtn');
  const spawnAgentModal = document.getElementById('spawnAgentModal');
  const closeSpawnModalBtn = document.getElementById('closeSpawnModalBtn');
  const cancelSpawnModalBtn = document.getElementById('cancelSpawnModalBtn');
  const confirmSpawnAgentBtn = document.getElementById('confirmSpawnAgentBtn');
  const newAgentRole = document.getElementById('newAgentRole');
  const newAgentModel = document.getElementById('newAgentModel');

  if (spawnAgentBtn && spawnAgentModal) {
    spawnAgentBtn.addEventListener('click', () => {
      spawnAgentModal.style.display = 'flex';
    });
    const closeModal = () => { spawnAgentModal.style.display = 'none'; };
    if (closeSpawnModalBtn) closeSpawnModalBtn.addEventListener('click', closeModal);
    if (cancelSpawnModalBtn) cancelSpawnModalBtn.addEventListener('click', closeModal);

    if (confirmSpawnAgentBtn) {
      confirmSpawnAgentBtn.addEventListener('click', async () => {
        const role = newAgentRole?.value || 'designer';
        const model = newAgentModel?.value || 'kimi-k3';
        try {
          const res = await fetch('/api/agents/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role, model }),
          });
          const data = await res.json();
          if (data.status === 'success') {
            addLog(`Spawned new agent ${data.agent.name} (${data.agent.id}) with model ${model}`, 'success', 'SYS', 'SPAWN');
            closeModal();
            agentStateManager.registerAgent({
              id: data.agent.id,
              backendId: data.agent.id,
              name: data.agent.name,
              tag: data.agent.id.slice(0, 2).toUpperCase(),
              role: data.agent.role,
              model: data.agent.model || model,
              color: '#38BDF8',
              room: 'Main Workspace',
              core: false,
              skills: data.agent.skills || ['Specialist Task'],
            });
            renderAgentRosters();
          }
        } catch (err) {
          alert('Failed to spawn agent: ' + err.message);
        }
      });
    }
  }

  updateHeaderStats();
  addLog('Agent Orchestra Workspace initialized. 10 AI specialist agents ready on duty.', 'info', 'SYS', 'READY');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
