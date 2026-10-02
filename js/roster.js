const SUPABASE_URL = 'https://exutfqxfwurwyfyxzskj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4dXRmcXhmd3Vyd3lmeXh6c2tqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4NTM0MzksImV4cCI6MjEwNjQyOTQzOX0.e3DZMEaGqgEQjMbUrll718a0lWFjY011wzPPLqh9Ls8';

// Khởi tạo Supabase client toàn cục trên window
window.sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


let rosterData = [];
let activeTeam = 'all';
let activeLoc = 'all';
let activeStatus = 'active';
let searchQuery = '';
let currentView = 'grid';

let sortCol = 'role';
let sortAsc = true;
let currentViewingMemberId = null;

const ROLE_HIERARCHY = {
  'CEO': 1, 'COO': 2, 'Creative Director': 3, 'Executive Support': 4,
  'Content': 5, 'Design': 6, 'Video Editor': 7, 'Publisher': 8
};
const TEAM_HIERARCHY = { 'Executive': 1, 'Management': 2, 'Production': 3, 'Support': 4 };
const STATUS_HIERARCHY = { 'active': 1, 'on leave': 2, 'inactive': 3 };

// DOM
const gridContainer = document.getElementById('roster-grid');
const tableWrap = document.getElementById('roster-table-wrap');
const tableBody = document.getElementById('table-body');
const searchInput = document.getElementById('roster-search');
const clearSearchBtn = document.getElementById('clear-search');
const emptyState = document.getElementById('empty-results');
const statTotal = document.getElementById('stat-total');
const statActive = document.getElementById('stat-active');

// Dossier View
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
const mNote = document.getElementById('m-note');
const mWorksContainer = document.getElementById('m-works-container');
const copyEmailBtn = document.getElementById('btn-copy-email');

// Edit Works Only
const editModal = document.getElementById('edit-member-modal');
const btnCloseEditModal = document.getElementById('btn-close-edit-member');
const btnOpenEditMember = document.getElementById('btn-open-edit-member');
const formEditMember = document.getElementById('form-edit-member');
const editWorksList = document.getElementById('edit-works-list');
const btnAddWorkItem = document.getElementById('btn-add-work-item');
const editHandleTitle = document.getElementById('edit-m-handle-title');

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
      note: m.note || '',
      masterpieces: Array.isArray(m.masterpieces) ? m.masterpieces : []
    }));

    renderAll();
    if (currentViewingMemberId) openDossier(currentViewingMemberId);
  } catch (err) {
    console.error("Lỗi lấy dữ liệu Squad:", err);
  }
}

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

    if (sortCol === 'role') return sortAsc ? (ROLE_HIERARCHY[valA] || 99) - (ROLE_HIERARCHY[valB] || 99) : (ROLE_HIERARCHY[valB] || 99) - (ROLE_HIERARCHY[valA] || 99);
    if (sortCol === 'team') return sortAsc ? (TEAM_HIERARCHY[valA] || 99) - (TEAM_HIERARCHY[valB] || 99) : (TEAM_HIERARCHY[valB] || 99) - (TEAM_HIERARCHY[valA] || 99);
    if (sortCol === 'status') return sortAsc ? (STATUS_HIERARCHY[valA] || 99) - (STATUS_HIERARCHY[valB] || 99) : (STATUS_HIERARCHY[valB] || 99) - (STATUS_HIERARCHY[valA] || 99);
    if (sortCol === 'gen') return sortAsc ? (parseInt(valA) || 0) - (parseInt(valB) || 0) : (parseInt(valB) || 0) - (parseInt(valA) || 0);

    valA = valA.toString().toLowerCase();
    valB = valB.toString().toLowerCase();
    if (valA < valB) return sortAsc ? -1 : 1;
    if (valA > valB) return sortAsc ? 1 : -1;
    return 0;
  });

  return filtered;
}

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
        <td style="text-align:center;"><button class="btn-inspect" data-id="${m.id}">VIEW</button></td>
      </tr>
    `;
  }).join('');
}

function openDossier(memberId) {
  const m = rosterData.find(item => String(item.id) === String(memberId));
  if (!m || !modal) return;
  currentViewingMemberId = m.id;

  const initials = (m.handle || 'GL').substring(0, 2).toUpperCase();
  if (mAvatarWrap) {
    mAvatarWrap.innerHTML = m.avatar 
      ? `<img src="${m.avatar}" alt="${m.handle}" onerror="this.outerHTML='<span>${initials}</span>'"/>`
      : `<span>${initials}</span>`;
  }

  if (mHandle) mHandle.textContent = (m.handle || '').toUpperCase();
  if (mFullName) mFullName.textContent = m.fullName || '';
  if (mStatus) {
    mStatus.textContent = (m.status || '').toUpperCase();
    mStatus.className = `status-badge ${m.status === 'active' ? '' : (m.status === 'on leave' ? 'on-leave' : 'inactive')}`;
  }
  if (mRole) mRole.textContent = (m.role || '').toUpperCase();
  if (mTeam) mTeam.textContent = (m.team || '').toUpperCase();
  if (mLoc) mLoc.textContent = `HUB: ${(m.location || '').toUpperCase()}`;

  const birthYear = parseInt(m.dob);
  const currentYear = new Date().getFullYear();
  if (mDob) mDob.textContent = isNaN(birthYear) ? (m.dob || '--') : `${m.dob} (${currentYear - birthYear} yo)`;
  if (mGen) mGen.textContent = `GEN ${m.gen || '--'}`;
  if (mEmail) mEmail.textContent = m.email || 'N/A';
  
  // Hiển thị Note (Chỉ xem)
  if (mNote) mNote.textContent = m.note || 'None recorded';

  if (mWorksContainer) {
    if (m.masterpieces && m.masterpieces.length > 0) {
      mWorksContainer.innerHTML = m.masterpieces.map(post => `
        <a href="${post.url}" target="_blank" rel="noopener noreferrer" class="sig-item-card">
          <span class="sig-item-title"><i class="fa-solid fa-star" style="color:var(--neo-orange); margin-right:6px;"></i> ${escapeHtml(post.title)}</span>
          <i class="fa-solid fa-arrow-up-right-from-square"></i>
        </a>
      `).join('');
    } else {
      mWorksContainer.innerHTML = `<p class="sig-empty-notice">No featured articles assigned yet.</p>`;
    }
  }

  modal.classList.add('active');
}

function closeDossier() {
  modal?.classList.remove('active');
  currentViewingMemberId = null;
}

// MỞ MODAL SỬA CHỈ CHO PHÉP SỬA HALL OF FAME
// MỞ MODAL SỬA: LẤY AVATAR VÀ HALL OF FAME HIỆN TẠI
btnOpenEditMember?.addEventListener('click', () => {
  const m = rosterData.find(item => String(item.id) === String(currentViewingMemberId));
  if (!m) return;

  const currentAdmin = localStorage.getItem('gl_current_user') || 'Vinci';
  if (m.handle.toLowerCase() !== currentAdmin.toLowerCase()) {
    const pin = prompt(`Editing Profile for [${m.handle}].\nIf this is not your profile, please enter Admin PIN:`);
    if (pin !== '2026') {
      if (pin !== null) alert("Incorrect Admin PIN!");
      return;
    }
  }

  document.getElementById('edit-m-id').value = m.id;
  if (editHandleTitle) editHandleTitle.textContent = m.handle.toUpperCase();

  // Đổ link avatar hiện tại vào input
  const avatarInput = document.getElementById('edit-m-avatar');
  if (avatarInput) avatarInput.value = m.avatar || '';

  renderEditWorksInputs(m.masterpieces || []);
  editModal.classList.add('active');
});

btnCloseEditModal?.addEventListener('click', () => editModal.classList.remove('active'));

// LƯU CẢ LINK AVATAR VÀ DANH SÁCH HALL OF FAME XUỐNG DATABASE
formEditMember?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('edit-m-id').value;
  const submitBtn = document.getElementById('btn-save-member');
  submitBtn.innerText = 'SAVING...';
  submitBtn.disabled = true;

  // 1. Lấy link Avatar
  const avatarUrl = document.getElementById('edit-m-avatar').value.trim();

  // 2. Lấy danh sách bài viết Hall of Fame
  const rows = editWorksList.querySelectorAll('.edit-work-row');
  const masterpieces = [];
  rows.forEach(r => {
    const t = r.querySelector('.work-title').value.trim();
    const u = r.querySelector('.work-url').value.trim();
    if (t && u) masterpieces.push({ title: t, url: u });
  });

  // 3. Cập nhật đồng thời avatar và masterpieces vào Supabase
  const { error } = await sb
    .from('squad_members')
    .update({ 
      avatar: avatarUrl,
      masterpieces: masterpieces, 
      updated_at: new Date() 
    })
    .eq('id', id);

  if (error) {
    alert("Error updating profile: " + error.message);
  } else {
    editModal.classList.remove('active');
    fetchRosterData();
    alert("PROFILE & HALL OF FAME UPDATED SUCCESSFULLY!");
  }

  submitBtn.innerText = 'SAVE PROFILE CHANGES';
  submitBtn.disabled = false;
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
    <input type="text" class="work-title" placeholder="Article Title..." value="${escapeHtml(title)}" style="flex:1.6; padding:8px; border:2px solid #000; font-size:0.85rem;" required/>
    <input type="url" class="work-url" placeholder="https://..." value="${escapeHtml(url)}" style="flex:1; padding:8px; border:2px solid #000; font-size:0.85rem;" required/>
    <button type="button" class="btn-del-work" style="background:none; border:none; color:red; cursor:pointer; font-size:1.2rem; padding:0 4px;" title="Delete">✕</button>
  `;
  row.querySelector('.btn-del-work').onclick = () => row.remove();
  editWorksList.appendChild(row);
}

btnAddWorkItem?.addEventListener('click', () => addWorkRow('', ''));

// CHỈ CẬP NHẬT TRƯỜNG MASTERPIECES VÀO DATABASE
formEditMember?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('edit-m-id').value;
  const submitBtn = document.getElementById('btn-save-member');
  submitBtn.innerText = 'SAVING...';
  submitBtn.disabled = true;

  const rows = editWorksList.querySelectorAll('.edit-work-row');
  const masterpieces = [];
  rows.forEach(r => {
    const t = r.querySelector('.work-title').value.trim();
    const u = r.querySelector('.work-url').value.trim();
    if (t && u) masterpieces.push({ title: t, url: u });
  });

  const { error } = await sb
    .from('squad_members')
    .update({ masterpieces: masterpieces, updated_at: new Date() })
    .eq('id', id);

  if (error) {
    alert("Error updating Hall of Fame: " + error.message);
  } else {
    editModal.classList.remove('active');
    fetchRosterData();
    alert("HALL OF FAME UPDATED SUCCESSFULLY!");
  }

  submitBtn.innerText = 'SAVE HALL OF FAME';
  submitBtn.disabled = false;
});

// Setup Events
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

  gridContainer?.addEventListener('click', (e) => {
    const card = e.target.closest('.member-card');
    if (card) openDossier(card.dataset.id);
  });

  tableBody?.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-inspect');
    if (btn) openDossier(btn.dataset.id);
  });

  modalCloseBtn?.addEventListener('click', closeDossier);
  modal?.addEventListener('click', (e) => { if (e.target === modal) closeDossier(); });
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
    document.querySelectorAll('.chip-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('#team-chips [data-filter="all"]')?.classList.add('active');
    document.querySelector('#location-chips [data-loc="all"]')?.classList.add('active');
    document.querySelector('#status-chips [data-status="all"]')?.classList.add('active');
    renderAll();
  });

  window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeDossier();
    editModal?.classList.remove('active');
    avatarModal?.classList.remove('active'); // Thêm dòng này
  }
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

// ==========================================
// AVATAR LIGHTBOX VIEWER
// ==========================================
const avatarModal = document.getElementById('avatar-viewer-modal');
const btnCloseAvatarModal = document.getElementById('btn-close-avatar-modal');
const avModalContent = document.getElementById('av-modal-content');
const avModalTitle = document.getElementById('av-modal-title');
const btnOpenAvatarRaw = document.getElementById('btn-open-avatar-raw');

// Bấm vào ô avatar trong Scouting Report Dossier
mAvatarWrap?.addEventListener('click', () => {
  const m = rosterData.find(item => String(item.id) === String(currentViewingMemberId));
  if (!m || !avatarModal) return;

  const initials = (m.handle || 'GL').substring(0, 2).toUpperCase();
  if (avModalTitle) avModalTitle.innerHTML = `<i class="fa-solid fa-image"></i> ${escapeHtml(m.handle.toUpperCase())}'S AVATAR`;

  if (m.avatar && m.avatar.trim() !== '') {
    // Trường hợp 1: Có ảnh avatar thật
    avModalContent.innerHTML = `
      <img src="${m.avatar}" alt="${escapeHtml(m.handle)}" style="max-width: 100%; max-height: 60vh; object-fit: contain; border: 3px solid var(--neo-yellow); box-shadow: 6px 6px 0 #000;" onerror="this.outerHTML='<div class=\\'avatar-box\\' style=\\'width:200px;height:200px;font-size:5rem;border:3px solid #fff;\\'><span>${initials}</span></div>'"/>
    `;
    if (btnOpenAvatarRaw) {
      btnOpenAvatarRaw.href = m.avatar;
      btnOpenAvatarRaw.style.display = 'inline-flex';
    }
  } else {
    // Trường hợp 2: Chưa gắn link ảnh -> Hiển thị huy hiệu Monogram chữ to nguyên bản
    avModalContent.innerHTML = `
      <div class="avatar-box" style="width: 220px; height: 220px; font-size: 5.5rem; background: var(--neo-blue); border: 4px solid #fff; box-shadow: 8px 8px 0 var(--neo-yellow);">
        <span>${initials}</span>
      </div>
    `;
    if (btnOpenAvatarRaw) {
      btnOpenAvatarRaw.style.display = 'none';
    }
  }

  avatarModal.classList.add('active');
});

// Đóng modal Avatar
btnCloseAvatarModal?.addEventListener('click', () => avatarModal?.classList.remove('active'));
avatarModal?.addEventListener('click', (e) => {
  if (e.target === avatarModal) avatarModal.classList.remove('active');
});

sb.channel('realtime_squad_members')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'squad_members' }, fetchRosterData)
  .subscribe();

setupEvents();
fetchRosterData();