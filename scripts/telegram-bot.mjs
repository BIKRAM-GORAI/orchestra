import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

// Load .env
function loadEnv() {
  const envPath = path.join(ROOT_DIR, '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const k = trimmed.slice(0, idx).trim();
        const v = trimmed.slice(idx + 1).trim();
        if (!process.env[k]) process.env[k] = v;
      }
    }
  }
}

loadEnv();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ORCHESTRA_URL = process.env.ORCHESTRA_URL || `http://${process.env.HOST || 'localhost'}:${process.env.PORT || 3000}`;
const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const TG_FILE_BASE = `https://api.telegram.org/file/bot${BOT_TOKEN}`;

if (!BOT_TOKEN) {
  console.error('[TELEGRAM BOT] Error: TELEGRAM_BOT_TOKEN is not defined in .env');
  process.exit(1);
}

// User session memory: chatId -> { budget: 0.35, awaitingInput: null, pendingPrompt: null, lastProjectId: null }
const userSessions = new Map();

function getSession(chatId) {
  if (!userSessions.has(chatId)) {
    userSessions.set(chatId, {
      budget: 0.35,
      awaitingInput: null,
      pendingPrompt: null,
      lastProjectId: null,
    });
  }
  return userSessions.get(chatId);
}

// Telegram API Helper
async function tgCall(method, payload) {
  const isFormData = payload instanceof FormData;
  const res = await fetch(`${TG_API}/${method}`, {
    method: 'POST',
    headers: isFormData ? undefined : { 'Content-Type': 'application/json' },
    body: isFormData ? payload : JSON.stringify(payload),
  });
  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Telegram ${method} failed: ${data.description}`);
  }
  return data.result;
}

async function sendTyping(chatId) {
  try {
    await tgCall('sendChatAction', { chat_id: chatId, action: 'typing' });
  } catch (_) {}
}

// Persistent Navigation Keyboard docked at the bottom of the chat
const MAIN_REPLY_KEYBOARD = {
  keyboard: [
    [{ text: '🌐 Build Website' }, { text: '📝 Research & Docs' }],
    [{ text: '💰 Set Budget' }, { text: 'ℹ️ Status & Preview' }],
  ],
  resize_keyboard: true,
  persistent: true,
};

async function sendWelcome(chatId) {
  const session = getSession(chatId);
  session.awaitingInput = null;
  session.pendingPrompt = null;

  const text = `🎼 *Agent Orchestra — Autonomous Multi-Agent Workspace*\n\n` +
    `Welcome! You can control your 10-agent team directly from Telegram.\n\n` +
    `⚡ *Choose an action using the buttons below:*\n\n` +
    `• 🌐 *Build Website*: Plans, designs, codes, and audits full multi-file web apps.\n` +
    `• 📝 *Research & Docs*: Analyzes files (PDF/DOCX/Code) or general topics and writes grounded Markdown reports.\n` +
    `• 💰 *Set Budget*: Configure model tiers from Free ($0.00) to Max ($1.00).\n` +
    `• ℹ️ *Status & Preview*: Check live server status and local preview links.\n\n` +
    `_Current Budget: $${session.budget.toFixed(2)}_`;

  await tgCall('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'Markdown',
    reply_markup: MAIN_REPLY_KEYBOARD,
  });
}

async function promptForWebsite(chatId) {
  const session = getSession(chatId);
  session.awaitingInput = 'website';
  session.pendingPrompt = null;

  await tgCall('sendMessage', {
    chat_id: chatId,
    text: `🌐 *Website Builder Activated*\n\n` +
      `Please describe what website or web application you would like the team to build:\n\n` +
      `_Examples:_\n` +
      `• _"Build an artisan coffee shop website with menu, specials, and order modal"_\n` +
      `• _"Create a sleek dark-mode portfolio for an AI engineer with projects and skills grid"_\n` +
      `• _"Build an interactive financial dashboard with charts, KPI cards, and light/dark toggle"_\n\n` +
      `✍️ *Type your website description below:*`,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'cancel_action' }]],
    },
  });
}

async function promptForDocument(chatId) {
  const session = getSession(chatId);
  session.awaitingInput = 'document';
  session.pendingPrompt = null;

  await tgCall('sendMessage', {
    chat_id: chatId,
    text: `📝 *Research & Document Analyst Activated*\n\n` +
      `Please send your research topic, questions, or attach a document (*PDF, DOCX, ZIP, or Code*):\n\n` +
      `_Examples:_\n` +
      `• _"Conduct a deep comparative analysis of Vector vs Graph Databases"_\n` +
      `• _"Explain the Model Gateway retry fallback mechanism step-by-step"_\n` +
      `• *(Or drag & drop any PDF/DOCX to extract and summarize)*\n\n` +
      `✍️ *Type your research prompt or send a file:*`,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'cancel_action' }]],
    },
  });
}

async function showBudgetMenu(chatId) {
  const session = getSession(chatId);
  const text = `💰 *Orchestra Budget & Model Allocation*\n\n` +
    `Choose a budget allocation tier for the agent team:\n\n` +
    `• *Free ($0.00)*: 100% Free models (Mistral Codestral Latest)\n` +
    `• *Lean ($0.15)*: Prioritizes Lead Coder model\n` +
    `• *Mid ($0.35)*: NVIDIA Kimi K3 for all specialists\n` +
    `• *Max ($1.00+)*: Gemini 3.5 Flash Lite & high-tier models\n\n` +
    `_Currently active: $${session.budget.toFixed(2)}_`;

  const reply_markup = {
    inline_keyboard: [
      [
        { text: `Free ($0.00)${session.budget === 0 ? ' ✅' : ''}`, callback_data: 'set_budget_0.00' },
        { text: `Lean ($0.15)${session.budget === 0.15 ? ' ✅' : ''}`, callback_data: 'set_budget_0.15' },
      ],
      [
        { text: `Mid ($0.35)${session.budget === 0.35 ? ' ✅' : ''}`, callback_data: 'set_budget_0.35' },
        { text: `Max ($1.00)${session.budget >= 1.0 ? ' ✅' : ''}`, callback_data: 'set_budget_1.00' },
      ],
    ],
  };

  await tgCall('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'Markdown',
    reply_markup,
  });
}

async function showStatusMenu(chatId) {
  const session = getSession(chatId);
  try {
    const res = await fetch(`${ORCHESTRA_URL}/api/health`);
    const health = await res.json();

    const text = `ℹ️ *Agent Orchestra Status: ${health.status.toUpperCase()}*\n\n` +
      `💻 *Local Server:* \`${ORCHESTRA_URL}\`\n` +
      `🌐 *Studio Workspace:* [http://localhost:3000](http://localhost:3000)\n` +
      `👁️ *Direct Live Preview:* [http://localhost:3001](http://localhost:3001)\n` +
      `🤖 *Primary Model:* \`${health.env?.defaultModel || 'kimi-k3'}\`\n` +
      `💰 *Your Budget:* $${session.budget.toFixed(2)}\n` +
      (session.lastProjectId ? `📁 *Last Project:* \`${session.lastProjectId}\`\n` : '') +
      `\n_The studio is actively listening. When you trigger a build, you can watch the agents on http://localhost:3000 in real time!_`;

    await tgCall('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🌐 Open Studio (Port 3000)', url: 'http://localhost:3000' },
            { text: '👁️ Live Preview (Port 3001)', url: 'http://localhost:3001' },
          ],
        ],
      },
    });
  } catch (err) {
    await tgCall('sendMessage', {
      chat_id: chatId,
      text: `⚠️ *Cannot connect to Orchestra server at \`${ORCHESTRA_URL}\`*\n\nEnsure \`npm run dev\` is running in your terminal.`,
      parse_mode: 'Markdown',
    });
  }
}

// Ask user to clarify unprompted text
async function askClarification(chatId, text) {
  const session = getSession(chatId);
  session.pendingPrompt = text;
  session.awaitingInput = null;

  await tgCall('sendMessage', {
    chat_id: chatId,
    text: `💡 *Directive Received:*\n_"${text.slice(0, 150)}${text.length > 150 ? '...' : ''}"_\n\n` +
      `How should the 10 agents process this instruction?`,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🌐 Build as Website', callback_data: 'confirm_website' },
          { text: '📝 Research as Document', callback_data: 'confirm_document' },
        ],
        [{ text: '❌ Cancel', callback_data: 'cancel_action' }],
      ],
    },
  });
}

// Execute the task with live Telegram status updates
async function executeOrchestraTask(chatId, prompt, taskType, projectId = null) {
  const session = getSession(chatId);
  session.awaitingInput = null;
  session.pendingPrompt = null;

  const budget = session.budget;
  const isWebsite = taskType === 'website';

  const statusMsg = await tgCall('sendMessage', {
    chat_id: chatId,
    text: `🚀 *${isWebsite ? 'Website Build' : 'Document Research'} Started*\n\n` +
      `• *Directive:* "${prompt.slice(0, 120)}${prompt.length > 120 ? '...' : ''}"\n` +
      `• *Budget:* $${budget.toFixed(2)}\n\n` +
      `🧠 _Atlas (Manager) is analyzing requirements & assembling specialists..._`,
    parse_mode: 'Markdown',
  });

  const typingInterval = setInterval(() => sendTyping(chatId), 4000);

  // Progressive status updates
  const stageTimers = [];
  if (isWebsite) {
    stageTimers.push(setTimeout(() => {
      tgCall('editMessageText', {
        chat_id: chatId,
        message_id: statusMsg.message_id,
        text: `🎨 *Specialist Ensemble Collaborating*\n\n` +
          `• *Pixel (Designer)*: Creating botanical color tokens & typography\n` +
          `• *Nova (Frontend)*: Architecting modular DOM & component tree\n` +
          `• *Scout (Feature)*: Defining user flows & state transitions\n\n` +
          `⏳ _Generating unified technical specification..._`,
        parse_mode: 'Markdown',
      }).catch(() => {});
    }, 7000));

    stageTimers.push(setTimeout(() => {
      tgCall('editMessageText', {
        chat_id: chatId,
        message_id: statusMsg.message_id,
        text: `💻 *Byte (Lead Coder) Building Multi-File System*\n\n` +
          `• Staging \`index.html\`, CSS styles, and JavaScript interactions\n` +
          `• Resolving component references & atomic revisions\n\n` +
          `⏳ _Coding in progress... (watch live at http://localhost:3000)_`,
        parse_mode: 'Markdown',
      }).catch(() => {});
    }, 22000));

    stageTimers.push(setTimeout(() => {
      tgCall('editMessageText', {
        chat_id: chatId,
        message_id: statusMsg.message_id,
        text: `🔍 *Query (QA Auditor) Performing Source Inspection*\n\n` +
          `• Verifying semantic HTML tags, CSS rules & link targets\n` +
          `• Checking JavaScript event listeners & responsive layout\n\n` +
          `⏳ _Finalizing build..._`,
        parse_mode: 'Markdown',
      }).catch(() => {});
    }, 45000));
  } else {
    stageTimers.push(setTimeout(() => {
      tgCall('editMessageText', {
        chat_id: chatId,
        message_id: statusMsg.message_id,
        text: `📝 *Document Analyst Reading Sources*\n\n` +
          `• Inspecting project file excerpts & grounding facts\n` +
          `• Accumulating citations and synthesis notes\n\n` +
          `⏳ _Drafting comprehensive Markdown deliverable..._`,
        parse_mode: 'Markdown',
      }).catch(() => {});
    }, 7000));
  }

  try {
    const payload = {
      prompt,
      taskType, // EXPLICIT: 'website' or 'document'
      budget,
      projectId: projectId || undefined,
    };

    const res = await fetch(`${ORCHESTRA_URL}/api/orchestrate/task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    stageTimers.forEach(clearTimeout);
    clearInterval(typingInterval);

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(err.error || err.message || `Server Error ${res.status}`);
    }

    const data = await res.json();
    session.lastProjectId = data.projectId;
    const taskResult = data.data || {};

    if (isWebsite) {
      // 1. Finished Website
      const qaVerdict = taskResult.qaReport?.result === 'passed' ? 'Passed (100% verified)' : 'Review findings';
      const fileCount = taskResult.files ? Object.keys(taskResult.files).length : 'Multiple';

      await tgCall('editMessageText', {
        chat_id: chatId,
        message_id: statusMsg.message_id,
        text: `🎉 *Website Generation Complete!*\n\n` +
          `• *Project ID:* \`${data.projectId}\`\n` +
          `• *QA Validation:* ${qaVerdict}\n` +
          `• *Entry Point:* \`${taskResult.entryPoint || 'index.html'}\`\n` +
          `• *Files Created:* ${fileCount} modular source files\n\n` +
          `👁️ *Preview Live Now:* [http://localhost:3001](http://localhost:3001)\n` +
          `📁 *Inspect in Studio:* [http://localhost:3000](http://localhost:3000)`,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: [
            [
              { text: '👁️ Open Live Preview', url: 'http://localhost:3001' },
              { text: '🏢 View in Studio', url: 'http://localhost:3000' },
            ],
          ],
        },
      });

    } else {
      // 2. Finished Document / Research
      const md = taskResult.markdown || '';
      const title = taskResult.title || 'Research Deliverable';

      await tgCall('editMessageText', {
        chat_id: chatId,
        message_id: statusMsg.message_id,
        text: `✅ *Document Research Complete!*\n\n` +
          `📄 *${title}*\n` +
          `• *Project ID:* \`${data.projectId}\`\n` +
          `• *File:* \`${taskResult.document?.path || 'deliverable.md'}\``,
        parse_mode: 'Markdown',
      });

      // Send excerpt
      const previewText = md.length > 3500 ? md.slice(0, 3500) + '\n\n*(Full document attached below...)*' : md;
      try {
        await tgCall('sendMessage', { chat_id: chatId, text: previewText, parse_mode: 'Markdown' });
      } catch (_) {
        await tgCall('sendMessage', { chat_id: chatId, text: previewText });
      }

      // Send .md file attachment
      const blob = new Blob([Buffer.from(md, 'utf8')], { type: 'text/markdown' });
      const docForm = new FormData();
      docForm.append('chat_id', chatId);
      docForm.append('document', blob, `${(taskResult.document?.path || 'research_report.md').split('/').pop()}`);
      docForm.append('caption', `📝 Deliverable: ${title}`);
      await tgCall('sendDocument', docForm);
    }

  } catch (err) {
    stageTimers.forEach(clearTimeout);
    clearInterval(typingInterval);

    await tgCall('editMessageText', {
      chat_id: chatId,
      message_id: statusMsg.message_id,
      text: `❌ *Execution Failed*\n\nError: \`${err.message}\``,
      parse_mode: 'Markdown',
    });
  }
}

// Handle File Attachments
async function handleFileUpload(msg) {
  const chatId = msg.chat.id;
  const doc = msg.document;
  const caption = (msg.caption || '').trim();

  const notifyMsg = await tgCall('sendMessage', {
    chat_id: chatId,
    text: `📥 *Downloading \`${doc.file_name}\` (${(doc.file_size / 1024).toFixed(1)} KB)...*`,
    parse_mode: 'Markdown',
  });

  try {
    const fileInfo = await tgCall('getFile', { file_id: doc.file_id });
    const downloadUrl = `${TG_FILE_BASE}/${fileInfo.file_path}`;

    const fileRes = await fetch(downloadUrl);
    if (!fileRes.ok) throw new Error('Failed to download file from Telegram');
    const arrayBuffer = await fileRes.arrayBuffer();

    const formData = new FormData();
    const blob = new Blob([Buffer.from(arrayBuffer)], { type: doc.mime_type || 'application/octet-stream' });
    formData.append('files', blob, doc.file_name);
    formData.append('name', doc.file_name.replace(/\.[^/.]+$/, ''));

    const importRes = await fetch(`${ORCHESTRA_URL}/api/projects/import`, {
      method: 'POST',
      body: formData,
    });

    if (!importRes.ok) {
      const err = await importRes.json().catch(() => ({ error: `HTTP ${importRes.status}` }));
      throw new Error(err.error || err.message || 'Import failed');
    }

    const importData = await importRes.json();
    const projectId = importData.projectId || importData.project?.id;
    getSession(chatId).lastProjectId = projectId;

    if (caption) {
      await tgCall('editMessageText', {
        chat_id: chatId,
        message_id: notifyMsg.message_id,
        text: `✅ *Imported \`${doc.file_name}\`!* Starting analysis for directive: _"${caption}"_`,
        parse_mode: 'Markdown',
      });
      await executeOrchestraTask(chatId, caption, 'document', projectId);
    } else {
      await tgCall('editMessageText', {
        chat_id: chatId,
        message_id: notifyMsg.message_id,
        text: `✅ *Imported \`${doc.file_name}\`!* (Project: \`${projectId}\`)\n\n` +
          `What should the agents do with this file?`,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📝 Summarize Key Findings', callback_data: `file_action_sum_${projectId}` },
              { text: '🔍 Explain In-Depth', callback_data: `file_action_exp_${projectId}` },
            ],
            [
              { text: '🌐 Build Website from Content', callback_data: `file_action_site_${projectId}` },
            ],
          ],
        },
      });
    }

  } catch (err) {
    await tgCall('editMessageText', {
      chat_id: chatId,
      message_id: notifyMsg.message_id,
      text: `❌ *Upload Failed:*\n\`${err.message}\``,
      parse_mode: 'Markdown',
    });
  }
}

// Handle Button Callbacks
async function handleCallback(cq) {
  const chatId = cq.message.chat.id;
  const messageId = cq.message.message_id;
  const data = cq.data;
  const session = getSession(chatId);

  if (data.startsWith('set_budget_')) {
    const val = parseFloat(data.replace('set_budget_', ''));
    session.budget = val;
    // Sync with Orchestra backend
    fetch(`${ORCHESTRA_URL}/api/budget/allocate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ budget: val }),
    }).catch(() => {});

    await tgCall('answerCallbackQuery', { callback_query_id: cq.id, text: `Budget set to $${val.toFixed(2)}` });
    await tgCall('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: `✅ *Budget updated to $${val.toFixed(2)}!*\n\nAll subsequent builds and research tasks will operate under this allocation.`,
      parse_mode: 'Markdown',
    });

  } else if (data === 'confirm_website') {
    await tgCall('answerCallbackQuery', { callback_query_id: cq.id });
    const prompt = session.pendingPrompt;
    if (prompt) {
      await tgCall('deleteMessage', { chat_id: chatId, message_id: messageId }).catch(() => {});
      await executeOrchestraTask(chatId, prompt, 'website');
    }

  } else if (data === 'confirm_document') {
    await tgCall('answerCallbackQuery', { callback_query_id: cq.id });
    const prompt = session.pendingPrompt;
    if (prompt) {
      await tgCall('deleteMessage', { chat_id: chatId, message_id: messageId }).catch(() => {});
      await executeOrchestraTask(chatId, prompt, 'document');
    }

  } else if (data === 'cancel_action') {
    session.awaitingInput = null;
    session.pendingPrompt = null;
    await tgCall('answerCallbackQuery', { callback_query_id: cq.id, text: 'Cancelled' });
    await tgCall('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: `❌ Action cancelled. Tap any button below to start:`,
      parse_mode: 'Markdown',
    });

  } else if (data.startsWith('file_action_')) {
    const [_, __, act, pid] = data.split('_');
    await tgCall('answerCallbackQuery', { callback_query_id: cq.id });
    await tgCall('deleteMessage', { chat_id: chatId, message_id: messageId }).catch(() => {});

    if (act === 'site') {
      await executeOrchestraTask(chatId, 'Build a complete website presenting this material.', 'website', pid);
    } else if (act === 'sum') {
      await executeOrchestraTask(chatId, 'Summarize key findings, structure, and actionable takeaways.', 'document', pid);
    } else {
      await executeOrchestraTask(chatId, 'Explain this material in detail step by step with citations.', 'document', pid);
    }
  }
}

// Start Long-Polling Daemon
async function startDaemon() {
  console.log(`[TELEGRAM BOT] Initializing daemon for @orchestra_builder_bot...`);

  // Ensure no conflicting webhook exists
  try {
    await tgCall('deleteWebhook', { drop_pending_updates: false });
    console.log(`[TELEGRAM BOT] Webhook cleared. Starting long polling...`);
  } catch (e) {
    console.warn(`[TELEGRAM BOT] deleteWebhook warning:`, e.message);
  }

  let offset = 0;

  while (true) {
    try {
      const updates = await tgCall('getUpdates', { offset, timeout: 25 });
      for (const update of updates) {
        offset = update.update_id + 1;

        if (update.callback_query) {
          handleCallback(update.callback_query).catch(e => console.error('Callback error:', e.message));
        } else if (update.message) {
          const msg = update.message;
          const chatId = msg.chat.id;
          const session = getSession(chatId);

          if (msg.document) {
            handleFileUpload(msg).catch(e => console.error('File upload error:', e.message));
          } else if (msg.text) {
            const text = msg.text.trim();

            if (text === '/start' || text === '/help' || text === '/menu') {
              sendWelcome(chatId).catch(e => console.error('Welcome error:', e.message));
            } else if (text === '🌐 Build Website' || text === '/website' || text === '/site') {
              promptForWebsite(chatId).catch(e => console.error('Website prompt error:', e.message));
            } else if (text === '📝 Research & Docs' || text === '/doc' || text === '/research') {
              promptForDocument(chatId).catch(e => console.error('Doc prompt error:', e.message));
            } else if (text === '💰 Set Budget' || text === '/budget') {
              showBudgetMenu(chatId).catch(e => console.error('Budget error:', e.message));
            } else if (text === 'ℹ️ Status & Preview' || text === '/status') {
              showStatusMenu(chatId).catch(e => console.error('Status error:', e.message));
            } else {
              // User typed free text!
              if (session.awaitingInput === 'website') {
                executeOrchestraTask(chatId, text, 'website').catch(e => console.error('Website build error:', e.message));
              } else if (session.awaitingInput === 'document') {
                executeOrchestraTask(chatId, text, 'document').catch(e => console.error('Doc build error:', e.message));
              } else {
                // Not in an active state: ask user what they want to do!
                askClarification(chatId, text).catch(e => console.error('Clarification error:', e.message));
              }
            }
          }
        }
      }
    } catch (err) {
      if (!err.message.includes('ETIMEDOUT') && !err.message.includes('fetch failed')) {
        console.error('[TELEGRAM BOT] Polling error:', err.message);
      }
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

startDaemon();
