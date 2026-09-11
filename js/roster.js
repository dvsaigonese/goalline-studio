let rosterData = [];
let activeTeam = 'all';
let activeLoc = 'all';
let activeStatus = 'active';
let searchQuery = '';
let currentView = 'grid'; // 'grid' | 'table'

// Sorting State
let sortCol = 'role';
let sortAsc = true;

// Bảng thứ bậc chức vụ (Càng nhỏ càng cao: CEO -> COO -> Director -> Support -> Specialist)
const ROLE_HIERARCHY = {
  'CEO': 1,
  'COO': 2,
  'Creative Director': 3,
  'Executive Support': 4,
  'Content': 5,
  'Design': 6,
  'Video Editor': 7,
  'Publisher': 8
};

// Thứ bậc phòng ban & trạng thái
const TEAM_HIERARCHY = {
  'Executive': 1,
  'Management': 2,
  'Production': 3,
  'Support': 4
};

const STATUS_HIERARCHY = {
  'active': 1,
  'on leave': 2,
  'inactive': 3
};

// DOM Elements
const gridContainer = document.getElementById('roster-grid');
const tableWrap = document.getElementById('roster-table-wrap');
const tableBody = document.getElementById('table-body');
const searchInput = document.getElementById('roster-search');
const clearSearchBtn = document.getElementById('clear-search');
const emptyState = document.getElementById('empty-results');

const statTotal = document.getElementById('stat-total');
const statActive = document.getElementById('stat-active');

// Modal Elements
const modal = document.getElementById('dossier-modal');
const modalCloseBtn = document.getElementById('modal-close-btn');
const mAvatarWrap = document.getElementById('m-avatar-wrap');
const mHandle = document.getElementById('m-handle');
const mFullName = document.getElementById('m-fullname');
const mStatus = document.getElementById('m-status');
const mRole = document.getElementById('m-role');
const mTeam = document.getElementById('m-team');
const mLoc = document.getElementById('m-loc');
const mDob = document.getElementById('m-dob');
const mGen = document.getElementById('m-gen');
const mEmail = document.getElementById('m-email');
const mWorksContainer = document.getElementById('m-works-container');
const copyEmailBtn = document.getElementById('btn-copy-email');

// --- INITIALIZATION ---
async function initRoster() {
  try {
    const res = await fetch('./assets/data/roster.json');
    if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
    
    const rawData = await res.json();
    
    // Phòng vệ dữ liệu: nhận diện cả mảng thuần [...] hoặc object bọc { roster: [...] } / { data: [...] }
    if (Array.isArray(rawData)) {
      rosterData = rawData;
    } else if (rawData && typeof rawData === 'object') {
      rosterData = rawData.roster || rawData.data || rawData.members || [];
    } else {
      rosterData = [];
    }

    renderAll();
    setupEvents();
  } catch (err) {
    console.error("Failed to load squad data:", err);
    if (gridContainer) {
      gridContainer.innerHTML = `<div class="empty-state"><h3>FAILED TO LOAD ROSTER DATA</h3><p>${err.message}</p></div>`;
    }
  }
}

// --- FILTER & SORT PIPELINE ---
function getFilteredAndSortedData() {
  if (!Array.isArray(rosterData)) return [];

  // 1. Filter
  const filtered = rosterData.filter(member => {
    if (!member) return false;
    if (activeTeam !== 'all' && member.team !== activeTeam) return false;

    if (activeLoc !== 'all') {
      if (activeLoc === 'other') {
        if (member.location === 'HCM' || member.location === 'Hanoi') return false;
      } else if (member.location !== activeLoc) {
        return false;
      }
    }

    if (activeStatus !== 'all' && member.status !== activeStatus) return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchHandle = (member.handle || '').toLowerCase().includes(q);
      const matchName = (member.fullName || '').toLowerCase().includes(q);
      const matchRole = (member.role || '').toLowerCase().includes(q);
      const matchEmail = (member.email || '').toLowerCase().includes(q);
      if (!matchHandle && !matchName && !matchRole && !matchEmail) return false;
    }

    return true;
  });

  // 2. Hierarchical & Custom Sorting
  filtered.sort((a, b) => {
    let valA = a[sortCol] || '';
    let valB = b[sortCol] || '';

    // Phân cấp vai trò: CEO -> COO -> Lead -> Staff
    if (sortCol === 'role') {
      const rankA = ROLE_HIERARCHY[valA] || 99;
      const rankB = ROLE_HIERARCHY[valB] || 99;
      return sortAsc ? rankA - rankB : rankB - rankA;
    }

    // Phân cấp phòng ban: Executive -> Management -> Production -> Support
    if (sortCol === 'team') {
      const rankA = TEAM_HIERARCHY[valA] || 99;
      const rankB = TEAM_HIERARCHY[valB] || 99;
      return sortAsc ? rankA - rankB : rankB - rankA;
    }

    // Phân cấp trạng thái: Active -> On leave -> Inactive
    if (sortCol === 'status') {
      const rankA = STATUS_HIERARCHY[valA] || 99;
      const rankB = STATUS_HIERARCHY[valB] || 99;
      return sortAsc ? rankA - rankB : rankB - rankA;
    }

    // Sort Gen theo số nguyên (Gen 0 -> Gen 9)
    if (sortCol === 'gen') {
      const genNumA = parseInt(valA) || 0;
      const genNumB = parseInt(valB) || 0;
      return sortAsc ? genNumA - genNumB : genNumB - genNumA;
    }

    // Sort Alphabet mặc định cho Handle, Full Name, Location
    valA = valA.toString().toLowerCase();
    valB = valB.toString().toLowerCase();

    if (valA < valB) return sortAsc ? -1 : 1;
    if (valA > valB) return sortAsc ? 1 : -1;
    return 0;
  });

  return filtered;
}

// --- RENDER MAIN VIEW ---
function renderAll() {
  const data = getFilteredAndSortedData();

  // Cập nhật số liệu Metrics
  if (statTotal) statTotal.textContent = rosterData.length;
  if (statActive) statActive.textContent = rosterData.filter(m => m.status === 'active').length;

  if (!data || data.length === 0) {
    emptyState?.classList.remove('hidden');
    gridContainer?.classList.add('hidden');
    tableWrap?.classList.add('hidden');
    return;
  }

  emptyState?.classList.add('hidden');

  if (currentView === 'grid') {
    gridContainer?.classList.remove('hidden');
    tableWrap?.classList.add('hidden');
    renderGrid(data);
  } else {
    gridContainer?.classList.add('hidden');
    tableWrap?.classList.remove('hidden');
    renderTable(data);
  }

  updateSortHeadersUI();
}

// --- RENDER GRID VIEW ---
function renderGrid(members) {
  if (!gridContainer) return;

  gridContainer.innerHTML = members.map(m => {
    const initials = (m.handle || 'GL').substring(0, 2).toUpperCase();
    const statusClass = m.status === 'active' ? 'active' : (m.status === 'on leave' ? 'on-leave' : 'inactive');
    const genDisplay = m.gen ? m.gen.split('-')[0].trim() : '0';

    const avatarMarkup = m.avatar 
      ? `<img src="${m.avatar}" alt="${m.handle}" onerror="this.outerHTML='<span>${initials}</span>'"/>`
      : `<span>${initials}</span>`;

    return `
      <div class="member-card" data-id="${m.id}">
        <div class="card-team-strip team-${m.team || 'Production'}"></div>
        <div class="card-inner">
          <div class="card-header-line">
            <span class="gen-tag">GEN ${genDisplay}</span>
            <span class="status-indicator-dot">
              <span class="s-dot ${statusClass}"></span>
              ${m.status || 'unknown'}
            </span>
          </div>

          <div class="card-profile-section">
            <div class="avatar-badge">${avatarMarkup}</div>
            <div class="name-block">
              <h3 class="handle-text">${escapeHtml(m.handle)}</h3>
              <p class="realname-text">${escapeHtml(m.fullName)}</p>
            </div>
          </div>

          <div class="card-badges-line">
            <span class="role-pill">${escapeHtml(m.role)}</span>
            <span class="loc-pill">${escapeHtml(m.location)}</span>
          </div>
        </div>

        <div class="card-footer-action">
          <span>SCOUT PROFILE</span>
          <i class="fa-solid fa-arrow-right"></i>
        </div>
      </div>
    `;
  }).join('');
}

// --- RENDER TABLE VIEW ---
function renderTable(members) {
  if (!tableBody) return;

  tableBody.innerHTML = members.map(m => {
    const statusClass = m.status === 'active' ? 'active' : (m.status === 'on leave' ? 'on-leave' : 'inactive');

    return `
      <tr>
        <td><strong>${escapeHtml(m.handle)}</strong></td>
        <td>${escapeHtml(m.fullName)}</td>
        <td><span class="role-pill">${escapeHtml(m.role)}</span></td>
        <td><span class="team-${m.team}" style="padding:2px 6px; border:1.5px solid #000; font-family:var(--font-mono); font-size:10px; font-weight:800;">${m.team || '--'}</span></td>
        <td><code style="font-family:var(--font-mono);">${m.gen || '--'}</code></td>
        <td>${escapeHtml(m.location)}</td>
        <td><span class="s-dot ${statusClass}" style="display:inline-block; margin-right:4px;"></span> ${m.status}</td>
        <td><button class="btn-inspect" data-id="${m.id}">VIEW</button></td>
      </tr>
    `;
  }).join('');
}

// --- CẬP NHẬT BIỂU TƯỢNG SORT ---
function updateSortHeadersUI() {
  document.querySelectorAll('.sortable-th').forEach(th => {
    const col = th.dataset.sort;
    const iconSpan = th.querySelector('.sort-icon');
    if (!iconSpan) return;

    if (col === sortCol) {
      iconSpan.textContent = sortAsc ? ' ▲' : ' ▼';
      th.style.color = 'var(--neo-yellow)';
    } else {
      iconSpan.textContent = '';
      th.style.color = '';
    }
  });
}

// --- MODAL DOSSIER ---
function openDossier(memberId) {
  const m = rosterData.find(item => String(item.id) === String(memberId));
  if (!m || !modal) return;

  const initials = (m.handle || 'GL').substring(0, 2).toUpperCase();

  if (mAvatarWrap) {
    if (m.avatar) {
      mAvatarWrap.innerHTML = `<img src="${m.avatar}" alt="${m.handle}" onerror="this.outerHTML='<span>${initials}</span>'"/>`;
    } else {
      mAvatarWrap.innerHTML = `<span>${initials}</span>`;
    }
  }

  if (mHandle) mHandle.textContent = (m.handle || '').toUpperCase();
  if (mFullName) mFullName.textContent = m.fullName || '';
  
  if (mStatus) {
    mStatus.textContent = (m.status || '').toUpperCase();
    const statusClass = m.status === 'active' ? '' : (m.status === 'on leave' ? 'on-leave' : 'inactive');
    mStatus.className = `status-badge ${statusClass}`;
  }

  if (mRole) mRole.textContent = (m.role || '').toUpperCase();
  if (mTeam) mTeam.textContent = (m.team || '').toUpperCase();
  if (mLoc) mLoc.textContent = `HUB: ${(m.location || '').toUpperCase()}`;

  const birthYear = parseInt(m.dob);
  const currentYear = new Date().getFullYear();
  const ageDisplay = isNaN(birthYear) ? (m.dob || '--') : `${m.dob} (${currentYear - birthYear} yo)`;

  if (mDob) mDob.textContent = ageDisplay;
  if (mGen) mGen.textContent = `GEN ${m.gen || '--'}`;
  if (mEmail) mEmail.textContent = m.email || 'N/A';

  // Render nhiều bài viết vinh danh
  if (mWorksContainer) {
    if (m.masterpieces && m.masterpieces.length > 0) {
      mWorksContainer.innerHTML = m.masterpieces.map(post => `
        <a href="${post.url}" target="_blank" rel="noopener noreferrer" class="sig-item-card">
          <span class="sig-item-title"><i class="fa-solid fa-star" style="color:var(--neo-orange); margin-right:6px;"></i> ${escapeHtml(post.title)}</span>
          <i class="fa-solid fa-arrow-up-right-from-square"></i>
        </a>
      `).join('');
    } else {
      mWorksContainer.innerHTML = `<p class="sig-empty-notice">No featured articles assigned yet. Ready for the next breakout story.</p>`;
    }
  }

  modal.classList.add('active');
}

function closeDossier() {
  modal?.classList.remove('active');
}

// --- EVENTS BINDING ---
function setupEvents() {
  // Search
  searchInput?.addEventListener('input', (e) => {
    searchQuery = e.target.value.trim();
    clearSearchBtn?.classList.toggle('hidden', !searchQuery);
    renderAll();
  });

  clearSearchBtn?.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    searchQuery = '';
    clearSearchBtn.classList.add('hidden');
    renderAll();
  });

  // Team Filter
  document.getElementById('team-chips')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.chip-btn');
    if (!btn) return;
    document.querySelectorAll('#team-chips .chip-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeTeam = btn.dataset.filter;
    renderAll();
  });

  // Location Filter
  document.getElementById('location-chips')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.chip-btn');
    if (!btn) return;
    document.querySelectorAll('#location-chips .chip-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeLoc = btn.dataset.loc;
    renderAll();
  });

  // Status Filter
  document.getElementById('status-chips')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.chip-btn');
    if (!btn) return;
    document.querySelectorAll('#status-chips .chip-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeStatus = btn.dataset.status;
    renderAll();
  });

  // View Switcher
  const btnGrid = document.getElementById('view-grid');
  const btnTable = document.getElementById('view-table');

  btnGrid?.addEventListener('click', () => {
    currentView = 'grid';
    btnGrid.classList.add('active');
    btnTable?.classList.remove('active');
    renderAll();
  });

  btnTable?.addEventListener('click', () => {
    currentView = 'table';
    btnTable.classList.add('active');
    btnGrid?.classList.remove('active');
    renderAll();
  });

  // Table Sort Click
  document.querySelectorAll('.sortable-th').forEach(th => {
    th.addEventListener('click', () => {
      const clickedCol = th.dataset.sort;
      if (sortCol === clickedCol) {
        sortAsc = !sortAsc;
      } else {
        sortCol = clickedCol;
        sortAsc = true;
      }
      renderAll();
    });
  });

  // Open Modal Click
  gridContainer?.addEventListener('click', (e) => {
    const card = e.target.closest('.member-card');
    if (card) openDossier(card.dataset.id);
  });

  tableBody?.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-inspect');
    if (btn) openDossier(btn.dataset.id);
  });

  // Close Modal
  modalCloseBtn?.addEventListener('click', closeDossier);
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) closeDossier();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal?.classList.contains('active')) closeDossier();
  });

  // Copy Email
  copyEmailBtn?.addEventListener('click', async () => {
    const email = mEmail?.textContent;
    if (!email || email === 'N/A') return;
    try {
      await navigator.clipboard.writeText(email);
      copyEmailBtn.innerHTML = '<i class="fa-solid fa-check" style="color:#00f076;"></i>';
      setTimeout(() => {
        copyEmailBtn.innerHTML = '<i class="fa-regular fa-copy"></i>';
      }, 1500);
    } catch (err) {
      console.warn("Clipboard access error", err);
    }
  });

  // Reset Filters Button
  document.getElementById('reset-filters-btn')?.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    searchQuery = '';
    activeTeam = 'all';
    activeLoc = 'all';
    activeStatus = 'all';
    sortCol = 'handle';
    sortAsc = true;
    document.querySelectorAll('.chip-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('#team-chips [data-filter="all"]')?.classList.add('active');
    document.querySelector('#location-chips [data-loc="all"]')?.classList.add('active');
    document.querySelector('#status-chips [data-status="all"]')?.classList.add('active');
    renderAll();
  });
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

initRoster();