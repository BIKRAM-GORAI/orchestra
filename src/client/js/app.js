/**
 * Agent Orchestra — Main Client Controller
 * Manages fixed 2.5D virtual office simulation, boss task delegations,
 * Paperclip/Linear-style sidebar metrics & recent tasks, expanded color-coded terminal,
 * and live device preview synchronization.
 */

import { PixiOffice, AGENT_ROSTER } from './pixi-office.js';
import { getLucideIcon, AGENT_ICONS, FILE_EXT_ICONS } from './icons.js';
import { agentStateManager, AGENT_STATUS, getStatusDisplayText } from './agent-state.js';

// Global State
let pixiOffice = null;
let activeTab = 'office';
let activeProjectId = null;
let currentPreviewUrl = '/api/preview';
let eventSource = null;
let selectedAgentId = 'nova';

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
// 1. Navigation Tab Controller
// ==========================================================================
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

  if (tabId === 'preview') {
    updatePreview(activeProjectId);
  } else if (tabId === 'ide') {
    loadProjectFiles(activeProjectId);
  }
}

navButtons.forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
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

  showAgentInspector('nova', AGENT_ROSTER.nova);
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
 *     Primary: Qwen 3.8 27B ($0.00 Free)
 *     Fallback 1: Kimi K3 ($0.05)
 *     Fallback 2: Gemini 3.5 Flash Lite ($0.10)
 * - Pro Tier (Chroma, Blueprint, Beacon, Cipher, Audit):
 *     Primary: Kimi K3 ($0.05)
 *     Fallback 1: Gemini 3.5 Flash Lite ($0.10)
 *     Fallback 2: Qwen 3.8 27B ($0.00 Free)
 * - Max Tier (Canvas, Apex, Compass, Matrix, Sentinel) & Manager (Atlas):
 *     Primary: Gemini 3.5 Flash Lite ($0.10)
 *     Fallback 1: Kimi K3 ($0.05)
 *     Fallback 2: Qwen 3.8 27B ($0.00 Free)
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
        { name: 'Qwen 3.8 27B', cost: '$0.00 Free' },
      ],
    };
  }

  const m = (agent.model || agent.modelId || '').toLowerCase();
  const id = (agent.id || agent.backendId || '').toLowerCase();
  const name = (agent.name || '').toLowerCase();

  // Tier classification: Free, Pro, or Max
  const isFree = m.includes('qwen') || id.includes('free') || id.endsWith('-1') || name.includes('junior') || name.includes('(free');
  const isPro = !isFree && (m.includes('kimi') || id.includes('pro') || id.endsWith('-2') || name.includes('(pro'));

  if (isFree) {
    return {
      tier: 'free',
      tierLabel: 'Free Tier',
      tierBadgeClass: 'badge-tier-free',
      costTag: '$0.00 Free',
      primaryModel: 'Qwen 3.8 27B',
      primaryCost: '$0.00 Free',
      primaryDesc: 'Fast & Free',
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
        { name: 'Qwen 3.8 27B', cost: '$0.00 Free' },
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
        { name: 'Qwen 3.8 27B', cost: '$0.00 Free' },
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
    <span class="term-msg">${cleanMsg}</span>
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
      return `<option value="${p.id}">${name}</option>`;
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
  if (projectId === '__new__' || !projectId) {
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

  if (headerProjectSelect) headerProjectSelect.value = projectId;
  if (ideProjectSelect) ideProjectSelect.value = projectId;

  if (reloadPreview) {
    updatePreview(activeProjectId);
  }

  if (activeTab === 'ide') {
    loadProjectFiles(activeProjectId);
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
      : "Direct the team or suggest changes (e.g. 'Add product cards with cart')...";
  }
  if (sidebarLaunchBtn) sidebarLaunchBtn.disabled = locked;

  if (chatPromptInput) {
    chatPromptInput.disabled = locked;
    chatPromptInput.placeholder = locked
      ? 'Agents are collaborating on sprint... Modifications locked.'
      : 'Enter objective or instructions for the team (or use @Agent)...';
  }
  if (chatSendBtn) chatSendBtn.disabled = locked;

  if (feedbackInput) {
    feedbackInput.disabled = locked;
    feedbackInput.placeholder = locked
      ? 'Agents are working... Modifications locked.'
      : 'e.g. Change primary button color to emerald and add customer review cards...';
  }
  if (applyFeedbackBtn) applyFeedbackBtn.disabled = locked;
}

// ==========================================================================
// 7. IDE Project File Explorer & Source Viewer
// ==========================================================================
let currentActiveFilename = null;

export async function loadProjectFiles(projectId) {
  if (!ideFileList) return;

  if (!projectId) {
    ideFileList.innerHTML = '<div class="ide-empty-state">No active project selected. Generate or select a project first.</div>';
    if (ideFileCount) ideFileCount.textContent = '0 files';
    return;
  }

  try {
    const res = await fetch(`/api/projects/${projectId}/files`);
    if (!res.ok) throw new Error('Failed to fetch project files');
    const data = await res.json();
    const files = data.files || [];

    if (ideFileCount) ideFileCount.textContent = `${files.length} file${files.length === 1 ? '' : 's'}`;

    if (files.length === 0) {
      ideFileList.innerHTML = '<div class="ide-empty-state">No files generated yet for this project.</div>';
      return;
    }

    ideFileList.innerHTML = files.map(file => {
      const ext = file.extension || 'txt';
      const isSelected = file.name === currentActiveFilename;
      return `
        <div class="file-item ${isSelected ? 'active' : ''}" data-file="${file.name}">
          <span class="file-item-icon">${getLucideIcon(FILE_EXT_ICONS[ext] || 'file-text', { size: 14 })}</span>
          <span class="file-item-name">${file.name}</span>
          <span class="file-item-meta">${Math.max(1, Math.ceil(file.size / 1024))} KB</span>
        </div>
      `;
    }).join('');

    ideFileList.querySelectorAll('.file-item').forEach(item => {
      item.addEventListener('click', () => {
        const filename = item.dataset.file;
        loadFileContent(projectId, filename);
      });
    });

    // Auto-select index.html or first file
    const targetFile = files.find(f => f.name === currentActiveFilename) ||
                       files.find(f => f.name === 'index.html') ||
                       files[0];
    if (targetFile) {
      loadFileContent(projectId, targetFile.name);
    }
  } catch (err) {
    ideFileList.innerHTML = `<div class="ide-empty-state error">Error loading files: ${err.message}</div>`;
  }
}

export async function loadFileContent(projectId, filename) {
  currentActiveFilename = filename;
  if (!ideFileContent) return;

  ideFileList?.querySelectorAll('.file-item').forEach(el => {
    el.classList.toggle('active', el.dataset.file === filename);
  });

  const ext = filename.split('.').pop() || '';
  if (ideActiveFilename) ideActiveFilename.textContent = filename;
  if (ideActiveFileExt) ideActiveFileExt.textContent = ext.toUpperCase();
  if (ideActiveFileIcon) {
    ideActiveFileIcon.innerHTML = getLucideIcon(FILE_EXT_ICONS[ext] || 'file-text', { size: 16 });
  }

  ideFileContent.textContent = '// Loading file contents...';

  try {
    const res = await fetch(`/api/projects/${projectId}/files/${filename}`);
    if (!res.ok) throw new Error('File not found');
    const data = await res.json();
    ideFileContent.textContent = data.content || '// Empty file';
  } catch (err) {
    ideFileContent.textContent = `// Error loading file: ${err.message}`;
  }
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
export function updatePreview(projectId = null) {
  const cacheBuster = `t=${Date.now()}`;
  if (projectId) {
    currentPreviewUrl = `/api/projects/${projectId}/preview`;
  } else {
    currentPreviewUrl = `/api/preview`;
  }

  if (previewIframe) previewIframe.src = `${currentPreviewUrl}?${cacheBuster}`;
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
    const url = activeProjectId ? `/api/projects/${activeProjectId}/preview` : `/api/preview`;
    window.open(url, '_blank');
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

  addLog(`Feedback received: "${feedback}"`, 'info', 'USER', 'FEEDBACK');
  agentStateManager.setAgentState('byte', {
    status: AGENT_STATUS.QUEUED,
    currentTask: `Modify application: "${feedback}"`,
    lastAction: 'Human feedback received. Queued for patch',
    progress: 10,
  });

  setControlsLocked(true);

  try {
    const res = await fetch('/api/orchestrate/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: activeProjectId, feedback })
    });
    const data = await res.json();
    if (!res.ok || data.status !== 'success') {
      if (res.status === 402 || data.status === 'budget_exhausted') {
        showBudgetExhaustedModal(data.spent, data.budget, handleApplyFeedback);
        return;
      }
      throw new Error(data.message || data.error || 'Feedback failed');
    }

    feedbackInput.value = '';
    updatePreview(activeProjectId || data.projectId);
    loadProjectFiles(activeProjectId || data.projectId);
    addLog(`Minimal-change edit applied. Preview reloaded.`, 'success', 'BY', 'COMPLETE');
  } catch (err) {
    addLog(`Feedback failed: ${err.message}`, 'error', 'QR', 'FAILED');
  } finally {
    setControlsLocked(false);
  }
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
  const sideSlider = document.getElementById('sidebarBudgetSlider');
  const chatSlider = document.getElementById('chatBudgetSlider');

  if (sideTag) sideTag.textContent = label;
  if (chatTag) chatTag.textContent = label;
  if (sideNumInput && parseFloat(sideNumInput.value) !== rounded) sideNumInput.value = rounded.toFixed(2);
  if (chatNumInput && parseFloat(chatNumInput.value) !== rounded) chatNumInput.value = rounded.toFixed(2);
  if (sideSlider && parseFloat(sideSlider.value) !== rounded) sideSlider.value = rounded;
  if (chatSlider && parseFloat(chatSlider.value) !== rounded) chatSlider.value = rounded;

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
// 9. Prompt Dispatcher & Live Orchestration
// ==========================================================================
async function handleSendPrompt(promptText) {
  if (!promptText || !promptText.trim() || isOrchestrating) return;
  const prompt = promptText.trim();

  // Lock project switching and user inputs while agents are actively working
  setControlsLocked(true);

  const timestamp = new Date().toLocaleTimeString();

  // 1. Append user message to both main chat and sidebar chat
  const userHtml = `
    <div class="msg-avatar">${getLucideIcon('users', { size: 14 })}</div>
    <div class="msg-content">
      <div class="msg-header"><span class="msg-sender">YOU</span><span class="msg-time">${timestamp}</span></div>
      <div class="msg-body">${prompt}</div>
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
        <div class="msg-body">Objective accepted. Specialist team summoned for delegation. Orchestration in progress!</div>
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
    lastAction: 'Task assigned. Launching orchestration pipeline',
    progress: 5,
  });

  if (chatStatusTag) chatStatusTag.textContent = 'Orchestrating...';

  try {
    const payload = { prompt, budget: currentBudgetAmount };
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
          showBudgetExhaustedModal(errJson.spent, errJson.budget, prompt);
          setControlsLocked(false);
          return;
        }
        errorMsg = errJson.message || errJson.error || errorMsg;
      } catch (_) {}
      throw new Error(errorMsg);
    }

    const data = await res.json();
    if (data.status !== 'success') throw new Error(data.message || 'Build failed');

    activeProjectId = data.projectId;
    await loadProjects();
    selectProject(activeProjectId, true);
    loadProjectFiles(activeProjectId);

    if (chatStatusTag) chatStatusTag.textContent = 'Preview Ready';
  } catch (err) {
    if (chatStatusTag) chatStatusTag.textContent = 'Error';
    addLog(`Build failed: ${err.message}`, 'error', 'QR', 'FAILED');
    agentStateManager.setAgentState('atlas', {
      status: AGENT_STATUS.FAILED,
      lastAction: err.message,
    });
  } finally {
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
      agentStateManager.handleAgentStateEvent(data);
    } catch (_) {}
  });

  eventSource.addEventListener('pipeline', (e) => {
    try {
      const data = JSON.parse(e.data);
      agentStateManager.handlePipelineEvent(data);

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
        setControlsLocked(false);
        const pid = data.projectId || activeProjectId;
        if (pid) {
          activeProjectId = pid;
          loadProjects();
          selectProject(pid, true);
          loadProjectFiles(pid);
        }
      } else if (data.stage === 'PIPELINE_FAILED' || data.stage === 'FEEDBACK_FAILED') {
        setControlsLocked(false);
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
  initOfficeSimulation();
  renderAgentRosters();
  loadProjects();
  initEventSource();
  initSystemHealth();

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

