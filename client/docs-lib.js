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
let _abortController = null;
let _context = {};

const DATA_VERSION = 1;

function loadData() {
  try {
    const savedVersion = localStorage.getItem('docs-lib-version');
    if (Number(savedVersion) === DATA_VERSION) {
      const savedComments = localStorage.getItem('docs-lib-comments');
      if (savedComments) comments = JSON.parse(savedComments);
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
  const commentCount = sectionComments.length;

  let inner = '';
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

  const indicator = `<span class="docs-comment-indicator">${commentCount || '+'}</span>`;

  let commentPanel = '';
  if (isOpen) {
    const commentListHtml = sectionComments.map(c => `
      <div class="docs-comment">
        <div class="docs-comment-header">
          <span class="docs-comment-author">${escapeHtml(c.author)}</span>
          <span class="docs-comment-time">${c.time}</span>
        </div>
        <div class="docs-comment-text">${escapeHtml(c.text)}</div>
      </div>
    `).join('');

    commentPanel = `
      <div class="docs-comment-panel" data-section-id="${section.id}">
        ${commentListHtml}
        <form class="docs-comment-form" data-section-id="${section.id}">
          <input type="text" class="input" placeholder="Add a comment..." autocomplete="off" />
          <button type="submit" class="button button-primary">Post</button>
        </form>
      </div>
    `;
  }

  return `
    <div class="docs-commentable ${hasComments ? 'has-comments' : ''}" data-section-id="${section.id}">
      ${inner}
      ${indicator}
    </div>
    ${commentPanel}
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

function selectDocument(docId) {
  activeDocId = docId;
  openCommentSectionId = null;
  renderSidebar();
  renderDocument();
}

function toggleCommentSection(sectionId) {
  openCommentSectionId = openCommentSectionId === sectionId ? null : sectionId;
  renderDocument();

  if (openCommentSectionId) {
    const form = document.querySelector(`.docs-comment-form[data-section-id="${sectionId}"] input`);
    if (form) form.focus();
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

  document.getElementById('docs-viewer-body').addEventListener('click', (e) => {
    const commentable = e.target.closest('.docs-commentable');
    if (commentable && !e.target.closest('.docs-comment-panel')) {
      toggleCommentSection(commentable.dataset.sectionId);
    }
  }, { signal });

  document.getElementById('docs-viewer-body').addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.target.closest('.docs-comment-form');
    if (!form) return;
    const input = form.querySelector('input');
    const text = input.value.trim();
    if (!text || !activeDocId) return;
    addComment(activeDocId, form.dataset.sectionId, text);
    renderDocument();
    if (_context.emit) {
      _context.emit('doc:comment-added', { docId: activeDocId, sectionId: form.dataset.sectionId, text });
    }
  }, { signal });

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
}

export function onAction(action) {
  if (action.type === 'add-comment') {
    const p = action.payload || {};
    const docId = p.docId || (documents[0] && documents[0].id);
    if (!docId || !p.sectionId) return;
    addComment(docId, p.sectionId, p.text || '', p.author || 'System');
    if (activeDocId === docId) renderDocument();
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
      if (activeDocId === docId) renderDocument();
    }
  }
}

export function onMessage(message) {
  console.log('Docs Lib received message:', message);
}
