const SUPABASE_URL = 'https://exutfqxfwurwyfyxzskj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4dXRmcXhmd3Vyd3lmeXh6c2tqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4NTM0MzksImV4cCI6MjEwNjQyOTQzOX0.e3DZMEaGqgEQjMbUrll718a0lWFjY011wzPPLqh9Ls8';

// Khởi tạo Supabase client toàn cục trên window
window.sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let rosterData = [];
let activeTeam = 'all';
let activeLoc = 'all';
let activeStatus = 'active';
let searchQuery = '';
let currentView = 'grid'; // 'grid' | 'table'

let sortCol = 'role';
let sortAsc = true;

let currentViewingMemberId = null;

const ROLE_HIERARCHY = {
  'CEO': 1, 'COO': 2, 'Creative Director': 3, 'Executive Support': 4,
  'Content': 5, 'Design': 6, 'Video Editor': 7, 'Publisher': 8
};
const TEAM_HIERARCHY = { 'Executive': 1, 'Management': 2, 'Production': 3, 'Support': 4 };
const STATUS_HIERARCHY = { 'active': 1, 'on leave': 2, 'inactive': 3 };

// DOM Elements
const gridContainer = document.getElementById('roster-grid');
const tableWrap = document.getElementById('roster-table-wrap');
const tableBody = document.getElementById('table-body');
const searchInput = document.getElementById('roster-search');
const clearSearchBtn = document.getElementById('clear-search');
const emptyState = document.getElementById('empty-results');
const statTotal = document.getElementById('stat-total');
const statActive = document.getElementById('stat-active');

// Dossier View Elements
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

// Edit Elements
const editModal = document.getElementById('edit-member-modal');
const btnCloseEditModal = document.getElementById('btn-close-edit-member');
const btnOpenEditMember = document.getElementById('btn-open-edit-member');
const formEditMember = document.getElementById('form-edit-member');
const editWorksList = document.getElementById('edit-works-list');
const btnAddWorkItem = document.getElementById('btn-add-work-item');

// --- TẢI DỮ LIỆU TỪ SUPABASE ---
async function fetchRosterData() {
  try {
    const { data, error } = await sb
      .from('squad_members')
      .select('*')
      .order('id', { ascending: true });

    if (error) throw error;

    rosterData = (data || []).map(m => ({
      id: m.id,
      handle: m.handle,
      fullName: m.full_name || '',
      dob: m.dob || '',
      email: m.email || '',
      role: m.role || 'Content',
      team: m.team || 'Production',
      gen: m.gen || '',
      location: m.location || 'HCM',
      status: m.status || 'active',
      avatar: m.avatar || '',
      masterpieces: Array.isArray(m.masterpieces) ? m.masterpieces : []
    }));

    renderAll();

    // Nếu đang mở Dossier của ai thì refresh luôn nội dung modal đó
    if (currentViewingMemberId) {
      openDossier(currentViewingMemberId);
    }
  } catch (err) {
    console.error("Lỗi lấy dữ liệu Squad:", err);
  }
}

// --- FILTER & SORT PIPELINE ---
function getFilteredAndSortedData() {
  if (!Array.isArray(rosterData)) return [];

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

  filtered.sort((a, b) => {
    let valA = a[sortCol] || '';
    let valB = b[sortCol] || '';

    if (sortCol === 'role') {
      return sortAsc ? (ROLE_HIERARCHY[valA] || 99) - (ROLE_HIERARCHY[valB] || 99) : (ROLE_HIERARCHY[valB] || 99) - (ROLE_HIERARCHY[valA] || 99);
    }
    if (sortCol === 'team') {
      return sortAsc ? (TEAM_HIERARCHY[valA] || 99) - (TEAM_HIERARCHY[valB] || 99) : (TEAM_HIERARCHY[valB] || 99) - (TEAM_HIERARCHY[valA] || 99);
    }
    if (sortCol === 'status') {
      return sortAsc ? (STATUS_HIERARCHY[valA] || 99) - (STATUS_HIERARCHY[valB] || 99) : (STATUS_HIERARCHY[valB] || 99) - (STATUS_HIERARCHY[valA] || 99);
    }
    if (sortCol === 'gen') {
      const gA = parseInt(valA) || 0;
      const gB = parseInt(valB) || 0;
      return sortAsc ? gA - gB : gB - gA;
    }

    valA = valA.toString().toLowerCase();
    valB = valB.toString().toLowerCase();
    if (valA < valB) return sortAsc ? -1 : 1;
    if (valA > valB) return sortAsc ? 1 : -1;
    return 0;
  });

  return filtered;
}

// --- RENDER MAIN ---
function renderAll() {
  const data = getFilteredAndSortedData();

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

// --- DOSSIER MODAL ---
function openDossier(memberId) {
  const m = rosterData.find(item => String(item.id) === String(memberId));
  if (!m || !modal) return;
  currentViewingMemberId = m.id;

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

  if (mWorksContainer) {
    if (m.masterpieces && m.masterpieces.length > 0) {
      mWorksContainer.innerHTML = m.masterpieces.map(post => `
        <a href="${post.url}" target="_blank" rel="noopener noreferrer" class="sig-item-card">
          <span class="sig-item-title"><i class="fa-solid fa-star" style="color:var(--neo-orange); margin-right:6px;"></i> ${escapeHtml(post.title)}</span>
          <i class="fa-solid fa-arrow-up-right-from-square"></i>
        </a>
      `).join('');
    } else {
      mWorksContainer.innerHTML = `<p class="sig-empty-notice">Chưa có bài viết nổi bật nào được ghim. Sẵn sàng cho siêu phẩm tiếp theo!</p>`;
    }
  }

  modal.classList.add('active');
}

function closeDossier() {
  modal?.classList.remove('active');
  currentViewingMemberId = null;
}

// --- LOGIC CHỈNH SỬA PROFILE & HALL OF FAME ---
btnOpenEditMember?.addEventListener('click', () => {
  const m = rosterData.find(item => String(item.id) === String(currentViewingMemberId));
  if (!m) return;

  const currentAdmin = localStorage.getItem('gl_current_user') || 'Vinci';

  // Nếu sửa bài của người khác -> Yêu cầu nhập PIN Admin 2026
  if (m.handle.toLowerCase() !== currentAdmin.toLowerCase()) {
    const pin = prompt(`Bạn đang sửa Profile của [${m.handle}].\nNếu không phải chính chủ, vui lòng nhập mã PIN Admin:`);
    if (pin !== '2026') {
      if (pin !== null) alert("Sai mã PIN Admin!");
      return;
    }
  }

  document.getElementById('edit-m-id').value = m.id;
  document.getElementById('edit-m-handle').value = m.handle;
  document.getElementById('edit-m-fullname').value = m.fullName;
  document.getElementById('edit-m-dob').value = m.dob;
  document.getElementById('edit-m-loc').value = m.location;
  document.getElementById('edit-m-status').value = m.status;
  document.getElementById('edit-m-avatar').value = m.avatar || '';

  renderEditWorksInputs(m.masterpieces || []);
  editModal.classList.add('active');
});

btnCloseEditModal?.addEventListener('click', () => editModal.classList.remove('active'));

function renderEditWorksInputs(works) {
  editWorksList.innerHTML = '';
  works.forEach(w => addWorkRow(w.title, w.url));
}

function addWorkRow(title = '', url = '') {
  const row = document.createElement('div');
  row.className = 'edit-work-row';
  row.style.cssText = 'display:flex; gap:6px; align-items:center;';
  row.innerHTML = `
    <input type="text" class="work-title" placeholder="Tiêu đề bài viết..." value="${escapeHtml(title)}" style="flex:1.5; padding:6px; border:1.5px solid #000; font-size:0.85rem;" required/>
    <input type="url" class="work-url" placeholder="https://facebook.com/..." value="${escapeHtml(url)}" style="flex:1; padding:6px; border:1.5px solid #000; font-size:0.85rem;" required/>
    <button type="button" class="btn-del-work" style="background:none; border:none; color:red; cursor:pointer; font-size:1.1rem;" title="Xóa bài này">✕</button>
  `;
  row.querySelector('.btn-del-work').onclick = () => row.remove();
  editWorksList.appendChild(row);
}

btnAddWorkItem?.addEventListener('click', () => addWorkRow('', ''));

formEditMember?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('edit-m-id').value;
  const submitBtn = document.getElementById('btn-save-member');
  submitBtn.innerText = 'ĐANG LƯU...';
  submitBtn.disabled = true;

  // Gom danh sách bài viết Hall of Fame
  const rows = editWorksList.querySelectorAll('.edit-work-row');
  const masterpieces = [];
  rows.forEach(r => {
    const t = r.querySelector('.work-title').value.trim();
    const u = r.querySelector('.work-url').value.trim();
    if (t && u) masterpieces.push({ title: t, url: u });
  });

  const updatePayload = {
    full_name: document.getElementById('edit-m-fullname').value.trim(),
    dob: document.getElementById('edit-m-dob').value.trim(),
    location: document.getElementById('edit-m-loc').value,
    status: document.getElementById('edit-m-status').value,
    avatar: document.getElementById('edit-m-avatar').value.trim(),
    masterpieces: masterpieces,
    updated_at: new Date()
  };

  const { error } = await sb.from('squad_members').update(updatePayload).eq('id', id);

  if (error) {
    alert("Lỗi khi cập nhật profile: " + error.message);
  } else {
    editModal.classList.remove('active');
    fetchRosterData();
    alert("ĐÃ CẬP NHẬT PROFILE & HALL OF FAME THÀNH CÔNG!");
  }

  submitBtn.innerText = 'LƯU THAY ĐỔI';
  submitBtn.disabled = false;
});

// --- EVENTS ---
function setupEvents() {
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

  document.getElementById('team-chips')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.chip-btn');
    if (!btn) return;
    document.querySelectorAll('#team-chips .chip-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeTeam = btn.dataset.filter;
    renderAll();
  });

  document.getElementById('location-chips')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.chip-btn');
    if (!btn) return;
    document.querySelectorAll('#location-chips .chip-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeLoc = btn.dataset.loc;
    renderAll();
  });

  document.getElementById('status-chips')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.chip-btn');
    if (!btn) return;
    document.querySelectorAll('#status-chips .chip-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeStatus = btn.dataset.status;
    renderAll();
  });

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

  gridContainer?.addEventListener('click', (e) => {
    const card = e.target.closest('.member-card');
    if (card) openDossier(card.dataset.id);
  });

  tableBody?.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-inspect');
    if (btn) openDossier(btn.dataset.id);
  });

  modalCloseBtn?.addEventListener('click', closeDossier);
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) closeDossier();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeDossier();
      editModal?.classList.remove('active');
    }
  });

  copyEmailBtn?.addEventListener('click', async () => {
    const email = mEmail?.textContent;
    if (!email || email === 'N/A') return;
    await navigator.clipboard.writeText(email);
    copyEmailBtn.innerHTML = '<i class="fa-solid fa-check" style="color:#00f076;"></i>';
    setTimeout(() => { copyEmailBtn.innerHTML = '<i class="fa-regular fa-copy"></i>'; }, 1500);
  });

  document.getElementById('reset-filters-btn')?.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    searchQuery = '';
    activeTeam = 'all';
    activeLoc = 'all';
    activeStatus = 'all';
    sortCol = 'role';
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

// Bật đồng bộ Realtime cho cả team
sb.channel('realtime_squad_members')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'squad_members' }, fetchRosterData)
  .subscribe();

// Tự động làm mới khi mở lại điện thoại
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') fetchRosterData();
});

setupEvents();
fetchRosterData();