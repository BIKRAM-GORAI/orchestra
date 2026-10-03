const encodePath = value => value.split('/').map(encodeURIComponent).join('/');
const $ = id => document.getElementById(id);

async function api(url, options) {
  const response = await fetch(url, options);
  let result;
  try {
    result = await response.json();
  } catch (_) {
    throw new Error(`Server connection closed or returned unexpected format (${response.status} ${response.statusText})`);
  }
  if (!response.ok) throw new Error(result.error || result.message || `Request failed (${response.status})`);
  return result;
}

export class ProjectWorkspace {
  constructor({ onChanged, onImported, onMessage, isLocked }) {
    this.onChanged = onChanged;
    this.onImported = onImported;
    this.onMessage = onMessage;
    this.isLocked = isLocked;
    this.projectId = null;
    this.revision = 0;
    this.selectedPath = null;
    this.files = [];
    this.request = 0;
    this.readRequest = 0;
    this.uploadFiles = [];
    this.dirty = false;
    this.busy = false;
  }

  init() {
    $('importProjectBtn')?.addEventListener('click', () => this.openImport());
    $('newFileBtn')?.addEventListener('click', () => this.createFile());
    $('renameFileBtn')?.addEventListener('click', () => this.renameFile());
    $('deleteFileBtn')?.addEventListener('click', () => this.deleteFile());
    $('editFileBtn')?.addEventListener('click', () => this.editFile());
    $('saveFileBtn')?.addEventListener('click', () => this.saveFile());
    $('cancelFileEditBtn')?.addEventListener('click', () => this.cancelEdit());
    $('projectHistoryBtn')?.addEventListener('click', () => this.openHistory());
    $('projectEntryPoint')?.addEventListener('change', async e => {
      try { await this.change([], 'Changed preview entry point', e.target.value); }
      catch (err) { this.message(err.message, true); await this.load(this.projectId); }
    });
    $('projectFileEditor')?.addEventListener('input', () => { this.dirty = true; this.updateControls(); });
    $('projectFileEditor')?.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); this.saveFile(); }
    });
    document.querySelectorAll('[data-close-dialog]').forEach(button => button.addEventListener('click', () => $(button.dataset.closeDialog).close()));
    $('uploadZipBtn')?.addEventListener('click', () => $('projectZipInput').click());
    $('uploadFolderBtn')?.addEventListener('click', () => $('projectFolderInput').click());
    $('uploadFilesBtn')?.addEventListener('click', () => $('projectFilesInput').click());
    for (const id of ['projectZipInput', 'projectFolderInput', 'projectFilesInput']) {
      $(id)?.addEventListener('change', e => {
        this.uploadFiles = [...e.target.files];
        $('stripUploadRoot').checked = id !== 'projectFilesInput';
        $('uploadSelection').textContent = `${this.uploadFiles.length} selected: ${this.uploadFiles.slice(0, 5).map(f => f.webkitRelativePath || f.name).join(', ')}`;
        if (!$('importProjectName').value) $('importProjectName').value = this.uploadFiles[0]?.webkitRelativePath.split('/')[0] || this.uploadFiles[0]?.name.replace(/\.zip$/i, '') || 'Imported website';
      });
    }
    $('submitProjectImport')?.addEventListener('click', () => this.upload());
    window.addEventListener('beforeunload', e => { if (this.dirty) { e.preventDefault(); e.returnValue = ''; } });
    this.updateControls();
  }

  message(text, error = false) {
    $('workspaceNotice').textContent = text;
    $('workspaceNotice').classList.toggle('notice-error', error);
    this.onMessage?.(text, error);
  }

  updateControls() {
    const locked = this.busy || this.isLocked();
    const source = this.files.find(f => f.path === this.selectedPath);
    for (const id of ['newFileBtn', 'projectHistoryBtn', 'projectEntryPoint']) $(id).disabled = locked || this.dirty || !this.projectId;
    for (const id of ['renameFileBtn', 'deleteFileBtn']) $(id).disabled = locked || this.dirty || !source || source.artifact;
    $('editFileBtn').disabled = locked || this.dirty || !source || source.binary || source.artifact;
    $('saveFileBtn').disabled = locked;
    $('cancelFileEditBtn').disabled = locked;
    $('projectFileEditor').disabled = locked;
    $('ideFileList').querySelectorAll('button').forEach(button => { button.disabled = this.busy; });
    $('importProjectBtn').disabled = locked || this.dirty;
    document.querySelectorAll('.task-upload-btn').forEach(button => { button.disabled = locked || this.dirty; });
    $('headerProjectSelect').disabled = locked;
    $('ideProjectSelect').disabled = locked;
  }

  clear() {
    ++this.request; ++this.readRequest;
    this.projectId = null; this.selectedPath = null; this.selectedFile = null; this.files = []; this.revision = 0;
    $('downloadProjectFile').hidden = true;
    this.cancelEdit();
    $('ideFileList').textContent = 'Create or import a project to browse its folders.';
    $('ideFileContent').textContent = '// Select a project file.';
    $('ideActiveFilename').textContent = 'No file selected';
    $('ideFileCount').textContent = '0 files';
    $('projectEntryPoint').replaceChildren();
    $('workspaceNotice').textContent = 'Upload source material for analysis, or create a website. Markdown results appear here.';
    this.updateControls();
  }

  async load(projectId) {
    if (!projectId || projectId === '__new__') { this.clear(); return; }
    if (this.dirty && projectId !== this.projectId && !confirm('Discard your unsaved file edits?')) return;
    if (projectId !== this.projectId) { this.cancelEdit(); this.selectedPath = null; }
    this.projectId = projectId;
    const sequence = ++this.request;
    try {
      const result = await api(`/api/projects/${encodeURIComponent(projectId)}/files`);
      if (sequence !== this.request) return;
      this.files = result.files;
      // Keep the editor's base revision while dirty so a concurrent save yields 409.
      if (!this.dirty) this.revision = result.revision;
      $('ideFileCount').textContent = `${this.files.length} files · r${result.revision}`;
      this.renderTree();
      const selector = $('projectEntryPoint');
      selector.replaceChildren();
      for (const file of this.files.filter(f => !f.artifact && /\.html?$/i.test(f.path))) selector.add(new Option(file.path, file.path));
      selector.value = result.entryPoint || '';
      if (result.projectType === 'source-only') this.message('Source imported for editing. A framework build/runtime is required for preview.');
      if (result.projectType === 'documents') this.message('Files ready. Ask for a summary, explanation, or written deliverable in Chat.');
      if (!this.dirty) {
        const target = this.files.find(f => f.path === this.selectedPath) || this.files.find(f => f.path === result.entryPoint) || this.files[0];
        if (target) await this.read(projectId, target.path);
        else { ++this.readRequest; this.selectedPath = null; this.selectedFile = null; $('downloadProjectFile').hidden = true; $('ideActiveFilename').textContent = 'No file selected'; $('ideFileContent').textContent = '// This project has no files yet.'; }
      }
      this.updateControls();
    } catch (err) { if (sequence === this.request) this.message(err.message, true); }
  }

  renderTree() {
    const open = new Set([...$('ideFileList').querySelectorAll('details[open]')].map(el => el.dataset.path));
    const root = new Map();
    for (const file of this.files) {
      let node = root;
      const parts = file.path.split('/');
      parts.forEach((part, i) => {
        if (i === parts.length - 1) node.set(part, file);
        else { if (!node.has(part)) node.set(part, new Map()); node = node.get(part); }
      });
    }
    const render = (node, parent, prefix = '') => {
      const entries = [...node].sort(([a, av], [b, bv]) => Number(bv instanceof Map) - Number(av instanceof Map) || a.localeCompare(b));
      for (const [name, child] of entries) {
        const p = prefix ? `${prefix}/${name}` : name;
        if (child instanceof Map) {
          const details = document.createElement('details'); details.dataset.path = p;
          details.open = open.has(p) || Boolean(this.selectedPath?.startsWith(p + '/'));
          const summary = document.createElement('summary'); summary.textContent = name;
          details.append(summary); render(child, details, p); parent.append(details);
        } else {
          const button = document.createElement('button'); button.type = 'button'; button.className = 'file-item';
          button.classList.toggle('active', p === this.selectedPath); button.title = p;
          button.dataset.file = p; button.textContent = `${child.binary ? '◇' : '▤'} ${name}`;
          button.addEventListener('click', () => this.read(this.projectId, p));
          parent.append(button);
        }
      }
    };
    $('ideFileList').replaceChildren();
    render(root, $('ideFileList'));
  }

  async read(projectId, filePath) {
    if (projectId !== this.projectId) return;
    if (this.dirty && !confirm('Discard your unsaved file edits?')) return;
    this.cancelEdit();
    const sequence = ++this.readRequest;
    try {
      const file = await api(`/api/projects/${encodeURIComponent(projectId)}/files/${encodePath(filePath)}`);
      if (sequence !== this.readRequest || projectId !== this.projectId) return;
      this.selectedPath = filePath;
      this.selectedFile = file;
      $('ideActiveFilename').textContent = filePath;
      $('ideActiveFileExt').textContent = file.extension.toUpperCase();
      $('ideFileContent').textContent = file.binary ? `Binary asset: ${file.mimeType}\nSize: ${file.size.toLocaleString()} bytes\nUse Download to save this file.` : file.content;
      const download = $('downloadProjectFile');
      download.href = `/api/projects/${encodeURIComponent(projectId)}/files/${encodePath(filePath)}?download=true`;
      download.hidden = false;
      this.renderTree(); this.updateControls();
    } catch (err) { this.message(err.message, true); }
  }

  editFile() {
    if (this.isLocked() || !this.selectedFile || this.selectedFile.binary || this.selectedFile.artifact) return;
    $('projectFileEditor').value = this.selectedFile.content;
    $('projectFileEditor').hidden = false;
    $('ideFileContent').parentElement.hidden = true;
    $('saveFileBtn').hidden = false; $('cancelFileEditBtn').hidden = false;
    $('projectFileEditor').focus();
  }

  cancelEdit() {
    this.dirty = false;
    if (!$('projectFileEditor')) return;
    $('projectFileEditor').hidden = true;
    $('ideFileContent').parentElement.hidden = false;
    $('saveFileBtn').hidden = true; $('cancelFileEditBtn').hidden = true;
    this.updateControls();
  }

  async change(changes, note, entryPoint) {
    if (this.isLocked() || this.busy || !this.projectId) throw new Error('Select an idle project first');
    this.busy = true; this.updateControls();
    try {
      const result = await api(`/api/projects/${encodeURIComponent(this.projectId)}/changes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ changes, note, entryPoint, expectedRevision: this.revision }) });
      this.cancelEdit();
      this.message(`Saved revision ${result.revision}. ${result.validation?.issues?.length || 0} validation finding(s).`);
      await this.load(this.projectId);
      await this.onChanged?.(this.projectId, result);
      return result;
    } finally { this.busy = false; this.updateControls(); }
  }

  async saveFile() {
    try { await this.change([{ action: 'update', path: this.selectedPath, content: $('projectFileEditor').value }], `Edited ${this.selectedPath}`); }
    catch (err) { this.message(err.message, true); }
  }

  async createFile() {
    if (!this.projectId || this.isLocked()) return;
    const path = prompt('New file path, e.g. css/theme.css');
    if (!path) return;
    try { await this.change([{ action: 'create', path, content: '' }], `Created ${path}`); await this.read(this.projectId, path); this.editFile(); }
    catch (err) { this.message(err.message, true); }
  }

  async renameFile() {
    const to = prompt('New full path', this.selectedPath);
    if (!to || to === this.selectedPath) return;
    try { await this.change([{ action: 'rename', path: this.selectedPath, to }], `Renamed ${this.selectedPath}`); await this.read(this.projectId, to); }
    catch (err) { this.message(err.message, true); }
  }

  async deleteFile() {
    if (!this.selectedPath || !confirm(`Delete ${this.selectedPath}? You can restore it from revision history.`)) return;
    try { await this.change([{ action: 'delete', path: this.selectedPath }], `Deleted ${this.selectedPath}`); }
    catch (err) { this.message(err.message, true); }
  }

  openImport() {
    if (this.isLocked() || this.busy) return;
    if (this.dirty) { this.message('Save or cancel your current file edit before importing.', true); return; }
    $('uploadToCurrent').disabled = !this.projectId;
    $('uploadToCurrent').checked = false;
    $('importProgress').textContent = '';
    $('projectImportDialog').showModal();
  }

  async upload() {
    if (this.busy || this.isLocked()) return;
    if (!this.uploadFiles.length) { $('importProgress').textContent = 'Select files first.'; return; }
    const intoCurrent = $('uploadToCurrent').checked && this.projectId;
    const body = new FormData();
    for (const file of this.uploadFiles) body.append('files', file, file.name);
    body.append('paths', JSON.stringify(this.uploadFiles.map(f => f.webkitRelativePath || f.name)));
    body.append('name', $('importProjectName').value || 'Imported files');
    body.append('stripRoot', String($('stripUploadRoot').checked));
    if (intoCurrent) body.append('expectedRevision', String(this.revision));
    this.busy = true; $('submitProjectImport').disabled = true;
    this.updateControls();
    $('importProgress').textContent = 'Uploading and validating project files…';
    try {
      const url = intoCurrent ? `/api/projects/${encodeURIComponent(this.projectId)}/import` : '/api/projects/import';
      const result = await api(url, { method: 'POST', body });
      this.cancelEdit();
      $('projectImportDialog').close();
      await this.onImported(result.projectId);
      this.message(`Imported ${result.changes.length} file(s). ${result.previewSupported ? 'Preview is ready; you can also ask about these files in Chat.' : result.project.projectType === 'documents' ? 'Ask for a summary or explanation in Chat to create a Markdown document.' : 'Source is available for analysis/editing; website preview needs a build/runtime.'}`);
      this.uploadFiles = [];
      for (const id of ['projectZipInput', 'projectFolderInput', 'projectFilesInput']) $(id).value = '';
      $('uploadSelection').textContent = 'No files selected';
    } catch (err) { $('importProgress').textContent = err.message; }
    finally { this.busy = false; $('submitProjectImport').disabled = false; this.updateControls(); }
  }

  async openHistory() {
    if (!this.projectId) return;
    const projectId = this.projectId;
    const dialog = $('projectHistoryDialog');
    $('revisionList').textContent = 'Loading revisions…'; $('revisionDiff').textContent = '';
    dialog.showModal();
    try {
      const result = await api(`/api/projects/${encodeURIComponent(projectId)}/revisions`);
      $('revisionList').replaceChildren();
      if (!result.revisions.length) $('revisionList').textContent = 'No saved revisions yet.';
      for (const revision of result.revisions) {
        const row = document.createElement('div'); row.className = 'revision-row';
        const view = document.createElement('button'); view.className = 'btn btn-outline btn-sm';
        view.textContent = `r${revision.revision} · ${revision.note}`;
        view.addEventListener('click', async () => {
          try {
            const diff = await api(`/api/projects/${encodeURIComponent(projectId)}/revisions/${revision.revision}`);
            $('revisionDiff').textContent = diff.changes.map(c => `${c.action.toUpperCase()} ${c.path}${c.to ? ` → ${c.to}` : ''}\n${c.patch}`).join('\n\n') || 'Entry point or metadata revision.';
          } catch (err) { $('revisionDiff').textContent = err.message; }
        });
        const restore = document.createElement('button'); restore.className = 'btn btn-outline btn-xs'; restore.textContent = 'Restore';
        restore.disabled = revision.revision === result.revision;
        restore.addEventListener('click', async () => {
          if (this.isLocked() || this.busy || !confirm(`Restore revision ${revision.revision} as a new revision?`)) return;
            this.busy = true; restore.disabled = true;
            this.updateControls();
          try {
            const restored = await api(`/api/projects/${encodeURIComponent(projectId)}/revisions/${revision.revision}/restore`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expectedRevision: result.revision }) });
            this.cancelEdit(); dialog.close(); await this.load(projectId); await this.onChanged(projectId, restored); this.message(`Restored as revision ${restored.revision}.`);
          } catch (err) { $('revisionDiff').textContent = err.message; }
          finally { this.busy = false; restore.disabled = false; this.updateControls(); }
        });
        row.append(view, restore); $('revisionList').append(row);
      }
    } catch (err) { $('revisionList').textContent = err.message; }
  }
}
