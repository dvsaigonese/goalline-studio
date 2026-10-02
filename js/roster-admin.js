const SUPABASE_URL = 'https://exutfqxfwurwyfyxzskj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4dXRmcXhmd3Vyd3lmeXh6c2tqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4NTM0MzksImV4cCI6MjEwNjQyOTQzOX0.e3DZMEaGqgEQjMbUrll718a0lWFjY011wzPPLqh9Ls8';

// Khởi tạo Supabase client toàn cục trên window
window.sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 1. KIỂM TRA MÃ PIN ADMIN TRƯỚC KHI VÀO TRANG
function checkAdminAccess() {
  const isAuthed = sessionStorage.getItem('gl_admin_session');
  if (isAuthed === 'true') return;

  const pin = prompt("KHU VỰC QUẢN TRỊ MASTER\nVui lòng nhập mã PIN Admin để truy cập:");
  if (pin === '0709') {
    sessionStorage.setItem('gl_admin_session', 'true');
  } else {
    alert("Sai mã PIN! Đang chuyển hướng về Roster...");
    window.location.href = 'roster.html';
  }
}
checkAdminAccess();

document.getElementById('btn-lock-session').onclick = () => {
  sessionStorage.removeItem('gl_admin_session');
  window.location.href = 'roster.html';
};

// 2. KHỞI TẠO STATE
let adminMembers = [];
let adminFilterStatus = 'all';
let adminSearchText = '';

const tableBody = document.getElementById('admin-table-body');
const searchInput = document.getElementById('admin-search');
const editModal = document.getElementById('admin-edit-modal');
const formAdmin = document.getElementById('form-admin-save');

async function loadAdminData() {
  const { data, error } = await sb
    .from('squad_members')
    .select('*')
    .order('id', { ascending: true });

  if (error) {
    alert("Lỗi tải dữ liệu: " + error.message);
    return;
  }

  adminMembers = data || [];
  renderAdminTable();
}

function renderAdminTable() {
  if (!tableBody) return;

  // Cập nhật số đếm
  document.getElementById('cnt-all').innerText = adminMembers.length;
  document.getElementById('cnt-active').innerText = adminMembers.filter(m => m.status === 'active').length;
  document.getElementById('cnt-leave').innerText = adminMembers.filter(m => m.status === 'on leave').length;
  document.getElementById('cnt-inactive').innerText = adminMembers.filter(m => m.status === 'inactive').length;

  const filtered = adminMembers.filter(m => {
    if (adminFilterStatus !== 'all' && m.status !== adminFilterStatus) return false;
    if (adminSearchText) {
      const q = adminSearchText.toLowerCase();
      const match = (m.handle || '').toLowerCase().includes(q) ||
                    (m.full_name || '').toLowerCase().includes(q) ||
                    (m.email || '').toLowerCase().includes(q) ||
                    (m.note || '').toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="12" style="text-align:center; padding:20px; font-weight:700;">KHÔNG TÌM THẤY THÀNH VIÊN NÀO</td></tr>`;
    return;
  }

  tableBody.innerHTML = filtered.map(m => {
    const statusBg = m.status === 'active' ? '#00f076' : (m.status === 'on leave' ? '#ff944d' : '#e0e0e0');
    return `
      <tr>
        <td style="font-family:var(--font-mono); font-weight:800; text-align:center;">${m.id}</td>
        <td><strong>${m.handle}</strong></td>
        <td style="font-family:var(--font-mono);">${m.dob || '--'}</td>
        <td>${m.full_name || '--'}</td>
        <td style="font-family:var(--font-mono); font-size:0.8rem;">${m.email || '--'}</td>
        <td><span class="badge-role" style="background:#fff8e7;">${m.role || '--'}</span></td>
        <td><span class="badge-role" style="background:#eefaff;">${m.team || '--'}</span></td>
        <td style="font-family:var(--font-mono); font-size:0.8rem;">${m.gen || '--'}</td>
        <td><strong>${m.location || '--'}</strong></td>
        <td><span style="background:${statusBg}; padding:3px 6px; border:1.5px solid #000; font-family:var(--font-mono); font-size:0.75rem; font-weight:800; display:inline-block;">${m.status}</span></td>
        <td class="note-text">${m.note || '--'}</td>
        <td style="text-align:center;">
          <button class="btn-inspect" onclick="openAdminEdit(${m.id})" style="padding:4px 8px; font-size:0.85rem;" title="Edit Full Info">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button class="btn-inspect" onclick="deleteMember(${m.id}, '${m.handle}')" style="padding:4px 8px; font-size:0.85rem; background:#ff4757; color:#fff;" title="Delete Member">
            <i class="fa-solid fa-trash"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// 3. MỞ MODAL CHỈNH SỬA / THÊM MỚI
window.openAdminEdit = (id) => {
  const m = adminMembers.find(item => item.id === id);
  if (!m) return;

  document.getElementById('admin-modal-title').innerText = `EDIT MEMBER: ${m.handle.toUpperCase()}`;
  document.getElementById('adm-id').value = m.id;
  document.getElementById('adm-handle').value = m.handle;
  document.getElementById('adm-fullname').value = m.full_name || '';
  document.getElementById('adm-dob').value = m.dob || '';
  document.getElementById('adm-email').value = m.email || '';
  document.getElementById('adm-role').value = m.role || 'Content';
  document.getElementById('adm-team').value = m.team || 'Production';
  document.getElementById('adm-location').value = m.location || 'HCM';
  document.getElementById('adm-gen').value = m.gen || '';
  document.getElementById('adm-status').value = m.status || 'active';
  document.getElementById('adm-note').value = m.note || '';
  document.getElementById('adm-avatar').value = m.avatar || '';

  editModal.classList.add('active');
};

document.getElementById('btn-add-new-member').onclick = () => {
  document.getElementById('admin-modal-title').innerText = "ADD NEW SQUAD MEMBER";
  document.getElementById('adm-id').value = '';
  formAdmin.reset();
  editModal.classList.add('active');
};

document.getElementById('btn-close-admin-edit').onclick = () => editModal.classList.remove('active');

// 4. LƯU DỮ LIỆU XUỐNG SUPABASE
formAdmin.onsubmit = async (e) => {
  e.preventDefault();
  const id = document.getElementById('adm-id').value;
  const submitBtn = document.getElementById('btn-adm-submit');
  submitBtn.innerText = 'SAVING TO DB...';
  submitBtn.disabled = true;

  const payload = {
    handle: document.getElementById('adm-handle').value.trim(),
    full_name: document.getElementById('adm-fullname').value.trim(),
    dob: document.getElementById('adm-dob').value.trim(),
    email: document.getElementById('adm-email').value.trim(),
    role: document.getElementById('adm-role').value,
    team: document.getElementById('adm-team').value,
    location: document.getElementById('adm-location').value.trim(),
    gen: document.getElementById('adm-gen').value.trim(),
    status: document.getElementById('adm-status').value,
    note: document.getElementById('adm-note').value.trim(),
    avatar: document.getElementById('adm-avatar').value.trim(),
    updated_at: new Date()
  };

  try {
    let err = null;
    if (id) {
      // Update thành viên hiện tại
      const { error } = await sb.from('squad_members').update(payload).eq('id', id);
      err = error;
    } else {
      // Thêm thành viên mới
      const { error } = await sb.from('squad_members').insert([payload]);
      err = error;
    }

    if (err) throw err;
    editModal.classList.remove('active');
    loadAdminData();
    alert("DỮ LIỆU ĐÃ ĐƯỢC CẬP NHẬT TRỰC TIẾP VÀO DATABASE!");
  } catch (err) {
    alert("Lỗi khi lưu dữ liệu: " + err.message);
  } finally {
    submitBtn.innerText = 'SAVE TO DATABASE';
    submitBtn.disabled = false;
  }
};

// 5. XÓA THÀNH VIÊN
window.deleteMember = async (id, handle) => {
  if (!confirm(`Bạn có chắc chắn muốn xóa thành viên [${handle}] vĩnh viễn khỏi Database?`)) return;
  const { error } = await sb.from('squad_members').delete().eq('id', id);
  if (error) {
    alert("Lỗi xóa thành viên: " + error.message);
  } else {
    loadAdminData();
  }
};

// 6. TÌM KIẾM & BỘ LỌC
searchInput.oninput = (e) => {
  adminSearchText = e.target.value.trim();
  renderAdminTable();
};

document.querySelectorAll('[data-admin-status]').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('[data-admin-status]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    adminFilterStatus = btn.dataset.adminStatus;
    renderAdminTable();
  };
});

loadAdminData();