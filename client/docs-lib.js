const DOCUMENTS = [
  {
    id: 'launch-plan',
    title: 'Horizon v2.0 — Launch Plan',
    lastEdited: 'Today, 8:15 AM',
    icon: '📄',
    sections: [
      {
        id: 'overview',
        type: 'heading',
        content: 'Launch Overview'
      },
      {
        id: 'intro',
        type: 'paragraph',
        content: 'This document outlines the launch plan for Horizon v2.0. The release includes a major dashboard redesign, new API endpoints, and an updated onboarding flow. All teams have been aligned on the timeline below.'
      },
      {
        id: 'status-table',
        type: 'status-table',
        rows: [
          { milestone: 'Engineering', status: 'Ready', statusClass: 'status-ready' },
          { milestone: 'Customer', status: 'Notified', statusClass: 'status-notified' },
          { milestone: 'Launch Time', status: '10:00 AM', statusClass: '' },
          { milestone: 'Final System Check', status: 'Pending', statusClass: 'status-pending' }
        ]
      },
      {
        id: 'timeline',
        type: 'heading',
        content: 'Timeline'
      },
      {
        id: 'timeline-details',
        type: 'list',
        items: [
          '8:00 AM — Team standup & final checklist review',
          '8:30 AM — Staging environment verification',
          '9:00 AM — Go/no-go decision with engineering lead',
          '9:30 AM — Marketing assets go live (blog post, email blast)',
          '10:00 AM — Production deploy & feature flag flip',
          '10:15 AM — Smoke tests on production',
          '10:30 AM — All-hands announcement in #general'
        ]
      },
      {
        id: 'rollback',
        type: 'heading',
        content: 'Rollback Plan'
      },
      {
        id: 'rollback-details',
        type: 'paragraph',
        content: 'If critical issues are detected within the first 30 minutes post-launch, we will revert via feature flag (instant) and roll back the database migration if needed (estimated 5 minutes). Alex Rivera is the designated rollback owner.'
      },
      {
        id: 'stakeholders',
        type: 'heading',
        content: 'Stakeholders'
      },
      {
        id: 'stakeholder-list',
        type: 'list',
        items: [
          'Sarah Chen — Engineering Manager (launch coordinator)',
          'Alex Rivera — Senior Engineer (tech lead & rollback owner)',
          'Jordan Kim — Product Designer (dashboard & onboarding UX)',
          'Priya Patel — VP of Product (executive sponsor)',
          'Marketing Team — Press release & customer communications'
        ]
      },
      {
        id: 'notes',
        type: 'heading',
        content: 'Notes'
      },
      {
        id: 'notes-content',
        type: 'paragraph',
        content: 'Please flag any blockers in #horizon-launch immediately. The go/no-go call at 9:00 AM is the last checkpoint before we commit to the 10:00 AM deploy.'
      }
    ]
  }
];

let documents = [];
let activeDocId = null;
let comments = {};
let openCommentSectionId = null;
let editingSectionId = null;
let _clickTimer = null;
let _abortController = null;
let _context = {};

const DATA_VERSION = 1;

function loadData() {
  try {
    const savedVersion = localStorage.getItem('docs-lib-version');
    if (Number(savedVersion) === DATA_VERSION) {
      const savedComments = localStorage.getItem('docs-lib-comments');
      if (savedComments) comments = JSON.parse(savedComments);
      const savedDocs = localStorage.getItem('docs-lib-documents');
      if (savedDocs) {
        documents = JSON.parse(savedDocs);
        return;
      }
    } else {
      comments = {};
      localStorage.setItem('docs-lib-version', String(DATA_VERSION));
    }
  } catch (err) {
    console.error('Failed to load docs data:', err);
    comments = {};
  }
  documents = JSON.parse(JSON.stringify(DOCUMENTS));
}

function saveDocuments() {
  try {
    localStorage.setItem('docs-lib-documents', JSON.stringify(documents));
  } catch (err) {
    console.error('Failed to save documents:', err);
  }
}

function saveComments() {
  try {
    localStorage.setItem('docs-lib-comments', JSON.stringify(comments));
  } catch (err) {
    console.error('Failed to save comments:', err);
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getCommentsForSection(docId, sectionId) {
  const key = `${docId}:${sectionId}`;
  return comments[key] || [];
}

function addComment(docId, sectionId, text, author) {
  const key = `${docId}:${sectionId}`;
  if (!comments[key]) comments[key] = [];
  comments[key].push({ author: author || 'You', text, time: formatTime() });
  saveComments();
}

function renderSidebar() {
  const listEl = document.getElementById('docs-file-list');
  if (!listEl) return;

  listEl.innerHTML = documents.map(doc => `
    <button class="docs-file-item ${doc.id === activeDocId ? 'active' : ''}" data-doc-id="${doc.id}">
      <span class="docs-file-icon">${doc.icon}</span>
      <div class="docs-file-info">
        <div class="docs-file-name">${escapeHtml(doc.title)}</div>
        <div class="docs-file-meta">${doc.lastEdited}</div>
      </div>
    </button>
  `).join('');
}

function renderSectionHtml(doc, section) {
  const sectionComments = getCommentsForSection(doc.id, section.id);
  const hasComments = sectionComments.length > 0;
  const isOpen = openCommentSectionId === section.id;
  const isEditing = editingSectionId === section.id;
  const commentCount = sectionComments.length;

  let inner = '';
  if (isEditing) {
    if (section.type === 'heading') {
      inner = `<h2 contenteditable="true" class="docs-editable">${escapeHtml(section.content)}</h2>`;
    } else if (section.type === 'paragraph') {
      inner = `<p contenteditable="true" class="docs-editable">${escapeHtml(section.content)}</p>`;
    } else if (section.type === 'list') {
      inner = `<ul>${section.items.map(item => `<li contenteditable="true" class="docs-editable">${escapeHtml(item)}</li>`).join('')}</ul>`;
    } else if (section.type === 'status-table') {
      inner = `
        <table class="docs-status-table">
          <thead><tr><th>Milestone</th><th>Status</th></tr></thead>
          <tbody>${section.rows.map(row => `
            <tr>
              <td contenteditable="true" class="docs-editable">${escapeHtml(row.milestone)}</td>
              <td contenteditable="true" class="docs-editable ${row.statusClass}">${escapeHtml(row.status)}</td>
            </tr>
          `).join('')}</tbody>
        </table>
      `;
    }
  } else {
    if (section.type === 'heading') {
      inner = `<h2>${escapeHtml(section.content)}</h2>`;
    } else if (section.type === 'paragraph') {
      inner = `<p>${escapeHtml(section.content)}</p>`;
    } else if (section.type === 'list') {
      inner = `<ul>${section.items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
    } else if (section.type === 'status-table') {
      inner = `
        <table class="docs-status-table">
          <thead><tr><th>Milestone</th><th>Status</th></tr></thead>
          <tbody>${section.rows.map(row => `
            <tr>
              <td>${escapeHtml(row.milestone)}</td>
              <td class="${row.statusClass}">${escapeHtml(row.status)}</td>
            </tr>
          `).join('')}</tbody>
        </table>
      `;
    }
  }

  const editIcon = `<span class="docs-edit-indicator" title="Double-click to edit">&#9998;</span>`;
  const indicator = `<span class="docs-comment-indicator">${commentCount || '+'}</span>`;

  const classes = [
    'docs-commentable',
    hasComments ? 'has-comments' : '',
    isEditing ? 'editing' : '',
    isOpen ? 'comment-active' : '',
  ].filter(Boolean).join(' ');

  return `
    <div class="${classes}" data-section-id="${section.id}">
      ${inner}
      ${isEditing ? '' : editIcon}
      ${isEditing ? '' : indicator}
    </div>
  `;
}

function renderDocument() {
  const viewerTitle = document.getElementById('docs-viewer-title');
  const viewerBody = document.getElementById('docs-viewer-body');

  if (!activeDocId) {
    viewerTitle.textContent = 'Select a document';
    viewerBody.innerHTML = '<div class="docs-empty">Choose a document from the sidebar to view it.</div>';
    return;
  }

  const doc = documents.find(d => d.id === activeDocId);
  if (!doc) return;

  viewerTitle.textContent = doc.title;
  viewerBody.innerHTML = `
    <div class="docs-page">
      <h1>${escapeHtml(doc.title)}</h1>
      ${doc.sections.map(s => renderSectionHtml(doc, s)).join('')}
    </div>
  `;
}

function renderSideComments() {
  const viewerBody = document.getElementById('docs-viewer-body');
  let panel = viewerBody.querySelector('.docs-side-comments');

  if (!openCommentSectionId || !activeDocId || editingSectionId) {
    if (panel) panel.remove();
    return;
  }

  const section = document.querySelector(`.docs-commentable[data-section-id="${openCommentSectionId}"]`);
  if (!section) {
    if (panel) panel.remove();
    return;
  }

  const sectionComments = getCommentsForSection(activeDocId, openCommentSectionId);
  const commentListHtml = sectionComments.map(c => `
    <div class="docs-comment">
      <div class="docs-comment-header">
        <span class="docs-comment-author">${escapeHtml(c.author)}</span>
        <span class="docs-comment-time">${c.time}</span>
      </div>
      <div class="docs-comment-text">${escapeHtml(c.text)}</div>
    </div>
  `).join('');

  const html = `
    ${commentListHtml}
    <form class="docs-comment-form" data-section-id="${openCommentSectionId}">
      <input type="text" class="input" placeholder="Add a comment..." autocomplete="off" />
      <button type="submit" class="button button-primary">Post</button>
    </form>
  `;

  if (!panel) {
    panel = document.createElement('div');
    panel.className = 'docs-side-comments';
    viewerBody.appendChild(panel);
  }
  panel.innerHTML = html;
  positionSidePanel();
}

function positionSidePanel() {
  const viewerBody = document.getElementById('docs-viewer-body');
  const panel = viewerBody?.querySelector('.docs-side-comments');
  if (!panel || !openCommentSectionId) return;

  const section = document.querySelector(`.docs-commentable[data-section-id="${openCommentSectionId}"]`);
  if (!section) return;

  const bodyRect = viewerBody.getBoundingClientRect();
  const sectionRect = section.getBoundingClientRect();
  const top = sectionRect.top - bodyRect.top + viewerBody.scrollTop;
  panel.style.top = `${top}px`;
}

function startEditing(sectionId) {
  if (editingSectionId === sectionId) return;
  if (editingSectionId) commitEdit(editingSectionId);
  editingSectionId = sectionId;
  openCommentSectionId = null;
  renderDocument();
  renderSideComments();

  const el = document.querySelector(`.docs-commentable[data-section-id="${sectionId}"] .docs-editable`);
  if (el) {
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }
}

function commitEdit(sectionId) {
  if (!activeDocId || !sectionId) return;
  const doc = documents.find(d => d.id === activeDocId);
  if (!doc) return;
  const section = doc.sections.find(s => s.id === sectionId);
  if (!section) return;

  const wrapper = document.querySelector(`.docs-commentable[data-section-id="${sectionId}"]`);
  if (!wrapper) return;

  if (section.type === 'heading' || section.type === 'paragraph') {
    const el = wrapper.querySelector('[contenteditable]');
    if (el) section.content = el.textContent.trim();
  } else if (section.type === 'list') {
    const items = wrapper.querySelectorAll('li[contenteditable]');
    section.items = Array.from(items).map(li => li.textContent.trim()).filter(t => t);
  } else if (section.type === 'status-table') {
    const rows = wrapper.querySelectorAll('tbody tr');
    rows.forEach((tr, i) => {
      if (!section.rows[i]) return;
      const cells = tr.querySelectorAll('td[contenteditable]');
      if (cells[0]) section.rows[i].milestone = cells[0].textContent.trim();
      if (cells[1]) section.rows[i].status = cells[1].textContent.trim();
    });
  }

  editingSectionId = null;
  saveDocuments();
}

function cancelEdit() {
  editingSectionId = null;
  renderDocument();
}

function selectDocument(docId) {
  activeDocId = docId;
  openCommentSectionId = null;
  renderSidebar();
  renderDocument();
}

function toggleCommentSection(sectionId) {
  document.querySelectorAll('.docs-commentable.comment-active').forEach(el => el.classList.remove('comment-active'));

  if (openCommentSectionId === sectionId) {
    openCommentSectionId = null;
  } else {
    openCommentSectionId = sectionId;
    const el = document.querySelector(`.docs-commentable[data-section-id="${sectionId}"]`);
    if (el) el.classList.add('comment-active');
  }

  renderSideComments();

  if (openCommentSectionId) {
    const input = document.querySelector('.docs-side-comments .docs-comment-form input');
    if (input) input.focus();
  }
}

export function init(context = {}) {
  _context = context;
  _abortController = new AbortController();
  const signal = _abortController.signal;

  loadData();
  renderSidebar();
  renderDocument();

  document.getElementById('docs-file-list').addEventListener('click', (e) => {
    const item = e.target.closest('.docs-file-item');
    if (item) selectDocument(item.dataset.docId);
  }, { signal });

  const viewerBody = document.getElementById('docs-viewer-body');

  viewerBody.addEventListener('click', (e) => {
    if (e.target.closest('[contenteditable]')) return;
    const commentable = e.target.closest('.docs-commentable');
    if (commentable && commentable.classList.contains('editing')) return;
    if (editingSectionId) {
      commitEdit(editingSectionId);
      renderDocument();
      return;
    }
    if (commentable && !e.target.closest('.docs-comment-panel')) {
      const sectionId = commentable.dataset.sectionId;
      if (_clickTimer) clearTimeout(_clickTimer);
      _clickTimer = setTimeout(() => {
        _clickTimer = null;
        toggleCommentSection(sectionId);
      }, 250);
    }
  }, { signal });

  viewerBody.addEventListener('dblclick', (e) => {
    if (_clickTimer) { clearTimeout(_clickTimer); _clickTimer = null; }
    if (e.target.closest('.docs-comment-panel')) return;
    const commentable = e.target.closest('.docs-commentable');
    if (!commentable) return;
    e.preventDefault();
    startEditing(commentable.dataset.sectionId);
  }, { signal });

  viewerBody.addEventListener('focusout', (e) => {
    if (!editingSectionId) return;
    const wrapper = document.querySelector(`.docs-commentable[data-section-id="${editingSectionId}"]`);
    if (!wrapper) return;
    setTimeout(() => {
      if (!wrapper.contains(document.activeElement)) {
        commitEdit(editingSectionId);
        renderDocument();
      }
    }, 0);
  }, { signal });

  viewerBody.addEventListener('keydown', (e) => {
    if (!editingSectionId) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      const doc = documents.find(d => d.id === activeDocId);
      const section = doc?.sections.find(s => s.id === editingSectionId);
      if (section && (section.type === 'heading' || section.type === 'status-table')) {
        e.preventDefault();
        commitEdit(editingSectionId);
        renderDocument();
      }
    }
  }, { signal });

  viewerBody.addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.target.closest('.docs-comment-form');
    if (!form) return;
    const input = form.querySelector('input');
    const text = input.value.trim();
    if (!text || !activeDocId) return;
    const sectionId = form.dataset.sectionId;
    addComment(activeDocId, sectionId, text);
    renderDocument();
    renderSideComments();
    if (_context.emit) {
      _context.emit('doc:comment-added', { docId: activeDocId, sectionId, text });
    }
  }, { signal });

  viewerBody.addEventListener('scroll', () => {
    positionSidePanel();
  }, { signal, passive: true });

  if (documents.length === 1) {
    selectDocument(documents[0].id);
  }
}

export function destroy() {
  if (_abortController) {
    _abortController.abort();
    _abortController = null;
  }
  documents = [];
  activeDocId = null;
  comments = {};
  openCommentSectionId = null;
  editingSectionId = null;
}

export function onAction(action) {
  if (action.type === 'add-comment') {
    const p = action.payload || {};
    const docId = p.docId || (documents[0] && documents[0].id);
    if (!docId || !p.sectionId) return;
    addComment(docId, p.sectionId, p.text || '', p.author || 'System');
    if (activeDocId === docId) { renderDocument(); renderSideComments(); }
  } else if (action.type === 'update-status') {
    const p = action.payload || {};
    const docId = p.docId || (documents[0] && documents[0].id);
    const doc = documents.find(d => d.id === docId);
    if (!doc) return;
    const section = doc.sections.find(s => s.id === (p.sectionId || 'status-table'));
    if (!section || section.type !== 'status-table') return;
    const row = section.rows.find(r => r.milestone === p.milestone);
    if (row) {
      row.status = p.newStatus || row.status;
      row.statusClass = p.newStatusClass || row.statusClass;
      if (activeDocId === docId) { renderDocument(); renderSideComments(); }
    }
  }
}

export function onMessage(message) {
  console.log('Docs Lib received message:', message);
}
