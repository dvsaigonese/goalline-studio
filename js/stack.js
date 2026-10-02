const SUPABASE_URL = 'https://exutfqxfwurwyfyxzskj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4dXRmcXhmd3Vyd3lmeXh6c2tqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4NTM0MzksImV4cCI6MjEwNjQyOTQzOX0.e3DZMEaGqgEQjMbUrll718a0lWFjY011wzPPLqh9Ls8';

// Khởi tạo Supabase client toàn cục trên window
window.sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const GL_TEAM = [
  'Maztermind', 'Vinci', 'Voet', 'Quýt', 'Tiryth', 'Tizzy', 'Nikolaj', 
  'Cakashi', 'Nedu', 'Terry', 'Naruto', 'Ruben', 'Dante', 'Daugust', 
  'Draco', 'Harif', 'Giáo 5ư', 'Tom', 'Brunson', 'Vate', 'Zenriot', 
  'Kaiz', 'Metis', 'Genie', 'Dmoney'
];

function checkIdentity() {
  let currentUser = localStorage.getItem('gl_current_user');
  if (!currentUser) {
    const chosen = prompt(`CHÀO MỪNG ĐẾN VỚI GOAL-LINE STUDIO!\nBạn là ai trong team?\n(${GL_TEAM.join(', ')})`, 'Vinci');
    currentUser = chosen ? chosen.trim() : 'Vinci';
    localStorage.setItem('gl_current_user', currentUser);
  }
  
  const displayEl = document.getElementById('current-user-display');
  if (displayEl) displayEl.innerText = `ADMIN: ${currentUser.toUpperCase()}`;
  
  const authorInput = document.getElementById('input-author');
  if (authorInput) authorInput.value = currentUser;
  
  return currentUser;
}

document.getElementById('btn-change-identity').onclick = () => {
  const chosen = prompt(`Chọn lại tên của bạn:\n(${GL_TEAM.join(', ')})`, localStorage.getItem('gl_current_user') || 'Vinci');
  if (chosen) {
    localStorage.setItem('gl_current_user', chosen.trim());
    checkIdentity();
  }
};

let posts = [];
let activeFilter = 'all';
let currentReadingPost = null;
let selectedPostIds = new Set(); // Tập hợp ID các bài được chọn để xóa

// ==========================================
// TẢI DỮ LIỆU TỪ SUPABASE
// ==========================================
async function loadPostsFromDB() {
  try {
    const { data, error } = await window.sb
      .from('stack_posts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Lỗi kết nối Supabase:', error.message);
      return;
    }

    posts = data.map(item => {
      const isApproved = item.status === 'approved' || item.status === 'ready';
      return {
        id: item.id,
        author: item.author || '--',
        title: item.title || 'Không có tiêu đề',
        content: item.content || '',
        imgUrl: item.img_url || '',
        designer: item.designer || '--',
        note: item.note || '--',
        scheduleNote: item.schedule_note || '--',
        status: isApproved ? 'approved' : 'unapproved'
      };
    });

    renderTable();
  } catch (err) {
    console.error('Lỗi:', err);
  }
}

// ==========================================
// RENDER BẢNG STACK VÀ CHECKBOX
// ==========================================
function renderTable() {
  const tbody = document.getElementById('stack-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  const filtered = posts.filter(p => activeFilter === 'all' || p.status === activeFilter);

  // Cập nhật số đếm
  document.getElementById('count-all').innerText = posts.length;
  document.getElementById('count-unapproved').innerText = posts.filter(p => p.status === 'unapproved').length;
  document.getElementById('count-approved').innerText = posts.filter(p => p.status === 'approved').length;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:30px; font-weight:700;">CHƯA CÓ BÀI VIẾT NÀO TRONG MỤC NÀY</td></tr>`;
    updateBatchDeleteUI();
    return;
  }

  filtered.forEach(post => {
    const tr = document.createElement('tr');
    const isApproved = post.status === 'approved';
    const statusBadge = isApproved 
      ? `<span class="badge-status badge-approved">ĐÃ DUYỆT</span>`
      : `<span class="badge-status badge-unapproved">CHƯA DUYỆT</span>`;

    const isChecked = selectedPostIds.has(post.id) ? 'checked' : '';
    const hasValidImage = post.imgUrl && post.imgUrl.startsWith('http');

    tr.innerHTML = `
      <td style="text-align: center;">
        <input type="checkbox" class="neo-checkbox row-checkbox" data-id="${post.id}" ${isChecked}>
      </td>
      <td><span class="author-pill">${post.author}</span></td>
      <td>
        <div class="post-clickable-title" onclick="openReader('${post.id}')">
          <i class="fa-solid fa-file-lines" style="color:#2b7de9;"></i> ${post.title}
        </div>
        <br>
        ${statusBadge}
      </td>
      <td>
        ${hasValidImage ? `
          <div class="img-thumb-box img-thumb-clickable" onclick="openImageViewer('${post.imgUrl}', '${post.title}')" title="Click xem ảnh to">
            <img src="${post.imgUrl}" alt="Thumbnail" onerror="this.parentElement.innerHTML='(Lỗi ảnh)'">
          </div>
        ` : `<span style="font-size:0.75rem; color:#888;">(Chưa có ảnh)</span>`}
      </td>
      <td><strong>${post.designer}</strong></td>
      <td style="font-size:0.85rem; max-width:180px;">${post.note}</td>
      <td><span style="font-family:var(--font-mono); font-size:0.8rem; font-weight:700;">${post.scheduleNote}</span></td>
      <td>
        <div class="table-actions">
          <button class="btn-action-icon" title="Đọc duyệt bài" onclick="openReader('${post.id}')">
            <i class="fa-solid fa-eye"></i>
          </button>
          <button class="btn-action-icon" title="Chỉnh sửa mọi thông tin" onclick="openEditModal('${post.id}')" style="color:#0984e3;">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
          <button class="btn-action-icon" title="Copy tiêu đề" onclick="copyText('${post.title}')">
            <i class="fa-solid fa-copy"></i>
          </button>
          <button class="btn-action-icon" style="color:red;" title="Xóa bài này" onclick="deleteSinglePost('${post.id}')">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Gắn sự kiện checkbox từng dòng
  document.querySelectorAll('.row-checkbox').forEach(cb => {
    cb.onchange = (e) => {
      const id = e.target.dataset.id;
      if (e.target.checked) {
        selectedPostIds.add(id);
      } else {
        selectedPostIds.delete(id);
      }
      updateBatchDeleteUI();
    };
  });

  updateBatchDeleteUI();
}

// Cập nhật trạng thái nút xóa hàng loạt và Check All
function updateBatchDeleteUI() {
  const btnBatch = document.getElementById('btn-batch-delete');
  const countEl = document.getElementById('selected-count');
  const checkAllBox = document.getElementById('check-all');

  const count = selectedPostIds.size;
  countEl.innerText = count;

  if (count > 0) {
    btnBatch.style.display = 'inline-flex';
  } else {
    btnBatch.style.display = 'none';
  }

  const visibleRowCheckboxes = document.querySelectorAll('.row-checkbox');
  if (visibleRowCheckboxes.length > 0 && Array.from(visibleRowCheckboxes).every(cb => cb.checked)) {
    checkAllBox.checked = true;
  } else {
    checkAllBox.checked = false;
  }
}

// Check All logic
document.getElementById('check-all').onchange = (e) => {
  const isChecked = e.target.checked;
  const filtered = posts.filter(p => activeFilter === 'all' || p.status === activeFilter);

  filtered.forEach(p => {
    if (isChecked) {
      selectedPostIds.add(p.id);
    } else {
      selectedPostIds.delete(p.id);
    }
  });

  document.querySelectorAll('.row-checkbox').forEach(cb => {
    cb.checked = isChecked;
  });

  updateBatchDeleteUI();
};

// ==========================================
// XÓA ĐƠN LẺ & XÓA CHỌN HÀNG LOẠT (MÃ PIN)
// ==========================================

// Xóa 1 bài (Chỉ cần xác nhận nhanh)
window.deleteSinglePost = async (id) => {
  if (!confirm("Bạn có chắc chắn muốn xóa bài viết này khỏi Stack?")) return;

  const { error } = await window.sb.from('stack_posts').delete().eq('id', id);
  if (error) {
    alert("Lỗi khi xóa: " + error.message);
  } else {
    selectedPostIds.delete(id);
  }
};

// Xóa các bài đã chọn (Yêu cầu nhập mã PIN)
document.getElementById('btn-batch-delete').onclick = async () => {
  if (selectedPostIds.size === 0) return;

  const pin = prompt(`Bạn đang chọn xóa ${selectedPostIds.size} bài viết.\nNhập mã PIN Admin để xác nhận xóa hàng loạt:`);
  if (pin !== '2026') {
    if (pin !== null) alert("Sai mã PIN Admin!");
    return;
  }

  const idsToDelete = Array.from(selectedPostIds);
  const { error } = await window.sb
    .from('stack_posts')
    .delete()
    .in('id', idsToDelete);

  if (error) {
    alert("Lỗi khi xóa hàng loạt: " + error.message);
  } else {
    selectedPostIds.clear();
    alert(`Đã xóa thành công ${idsToDelete.length} bài viết!`);
    loadPostsFromDB();
  }
};

// ==========================================
// CHỨC NĂNG SỬA BÀI TOÀN DIỆN (CHO DESIGNER & ADMIN)
// ==========================================
const editModal = document.getElementById('edit-modal');

window.openEditModal = (id) => {
  const post = posts.find(p => p.id === id);
  if (!post) return;

  document.getElementById('edit-id').value = post.id;
  document.getElementById('edit-author').value = post.author;
  document.getElementById('edit-designer').value = post.designer === '--' ? '' : post.designer;
  document.getElementById('edit-title').value = post.title;
  document.getElementById('edit-content').value = post.content;
  document.getElementById('edit-image-url').value = post.imgUrl;
  document.getElementById('edit-note').value = post.note === '--' ? '' : post.note;
  document.getElementById('edit-schedule-note').value = post.scheduleNote === '--' ? '' : post.scheduleNote;
  document.getElementById('edit-status').value = post.status;
  document.getElementById('edit-image-file').value = '';

  editModal.classList.add('active');
};

document.getElementById('btn-close-edit-modal').onclick = () => {
  editModal.classList.remove('active');
};

// Submit form sửa
document.getElementById('form-edit-post').onsubmit = async (e) => {
  e.preventDefault();

  const id = document.getElementById('edit-id').value;
  const submitBtn = document.getElementById('btn-submit-edit');
  submitBtn.innerText = 'ĐANG LƯU...';
  submitBtn.disabled = true;

  try {
    let finalImageUrl = document.getElementById('edit-image-url').value.trim();
    const file = document.getElementById('edit-image-file').files[0];

    // Nếu designer tải ảnh mới lên từ máy
    if (file) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadError } = await window.sb.storage
        .from('stack-assets')
        .upload(fileName, file);

      if (!uploadError) {
        const { data: publicUrlData } = window.sb.storage
          .from('stack-assets')
          .getPublicUrl(fileName);
        finalImageUrl = publicUrlData.publicUrl;
      }
    }

    const updatedData = {
      author: document.getElementById('edit-author').value || 'HaRif',
      designer: document.getElementById('edit-designer').value.trim() || '--',
      title: document.getElementById('edit-title').value.trim() || 'Không có tiêu đề',
      content: document.getElementById('edit-content').value || '',
      img_url: finalImageUrl,
      note: document.getElementById('edit-note').value.trim() || '--',
      schedule_note: document.getElementById('edit-schedule-note').value.trim() || '--',
      status: document.getElementById('edit-status').value
    };

    const { error: updateError } = await window.sb
      .from('stack_posts')
      .update(updatedData)
      .eq('id', id);

    if (updateError) {
      alert("Lỗi cập nhật: " + updateError.message);
    } else {
      editModal.classList.remove('active');
      alert("Đã cập nhật bài viết thành công!");
      loadPostsFromDB();
    }
  } catch (err) {
    console.error(err);
  } finally {
    submitBtn.innerText = 'LƯU CẬP NHẬT';
    submitBtn.disabled = false;
  }
};

// ==========================================
// CÁC THAO TÁC KHÁC (READER, MODAL ĐẨY BÀI, COPY)
// ==========================================
window.openReader = (id) => {
  const post = posts.find(p => p.id === id);
  if (!post) return;
  currentReadingPost = post;

  document.getElementById('reader-modal-author').innerText = `TÁC GIẢ: ${post.author.toUpperCase()}`;
  document.getElementById('reader-modal-title').innerText = post.title;
  document.getElementById('reader-modal-text').innerText = post.content || '(Bài viết chưa có nội dung)';
  
  const wordCount = post.content ? post.content.trim().split(/\s+/).filter(Boolean).length : 0;
  document.getElementById('reader-word-count').innerText = `${wordCount} từ`;

  const btnToggle = document.getElementById('btn-toggle-approval');
  const statusLabel = document.getElementById('reader-status-label');

  if (post.status === 'approved') {
    statusLabel.innerText = 'ĐÃ DUYỆT';
    statusLabel.style.color = '#00b894';
    btnToggle.innerHTML = '<i class="fa-solid fa-xmark"></i> HỦY DUYỆT BÀI';
    btnToggle.style.background = '#ff7675';
    btnToggle.style.color = 'white';
  } else {
    statusLabel.innerText = 'CHƯA DUYỆT';
    statusLabel.style.color = '#d63031';
    btnToggle.innerHTML = '<i class="fa-solid fa-check"></i> DUYỆT BÀI';
    btnToggle.style.background = 'var(--neo-green)';
    btnToggle.style.color = 'black';
  }

  document.getElementById('reader-modal').classList.add('active');
};

document.getElementById('btn-close-reader').onclick = () => {
  document.getElementById('reader-modal').classList.remove('active');
};

document.getElementById('btn-toggle-approval').onclick = async () => {
  if (!currentReadingPost) return;
  const nextStatus = currentReadingPost.status === 'approved' ? 'unapproved' : 'approved';

  const { error } = await window.sb
    .from('stack_posts')
    .update({ status: nextStatus })
    .eq('id', currentReadingPost.id);

  if (!error) {
    document.getElementById('reader-modal').classList.remove('active');
    loadPostsFromDB();
  }
};

window.openImageViewer = (url, title) => {
  document.getElementById('image-modal-preview').src = url;
  document.getElementById('image-modal-title').innerText = `ẢNH: ${title}`;
  document.getElementById('btn-download-hd').href = url;
  document.getElementById('image-modal').classList.add('active');
};

document.getElementById('btn-close-image').onclick = () => {
  document.getElementById('image-modal').classList.remove('active');
};

window.copyText = (text) => {
  navigator.clipboard.writeText(text).then(() => alert(`Đã copy: "${text}"`));
};

// Form Đẩy bài mới
const addModal = document.getElementById('post-modal');
document.getElementById('btn-open-modal').onclick = () => addModal.classList.add('active');
document.getElementById('btn-close-modal').onclick = () => addModal.classList.remove('active');

document.getElementById('form-add-post').onsubmit = async (e) => {
  e.preventDefault();
  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.innerText = 'ĐANG ĐẨY LÊN...';
  submitBtn.disabled = true;

  try {
    let finalImageUrl = '';
    const file = document.getElementById('input-image-file').files[0];

    if (file) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const { error: uploadError } = await window.sb.storage.from('stack-assets').upload(fileName, file);

      if (!uploadError) {
        const { data } = window.sb.storage.from('stack-assets').getPublicUrl(fileName);
        finalImageUrl = data.publicUrl;
      }
    }

    const newPostData = {
      author: document.getElementById('input-author').value || 'Vinci',
      designer: document.getElementById('input-designer').value || '--',
      title: document.getElementById('input-title').value || 'Không có tiêu đề',
      content: document.getElementById('input-full-content').value || '',
      img_url: finalImageUrl,
      note: document.getElementById('input-note').value || '--',
      schedule_note: document.getElementById('input-schedule-note').value || '--',
      status: 'unapproved'
    };

    await window.sb.from('stack_posts').insert([newPostData]);
    e.target.reset();
    document.getElementById('input-author').value = localStorage.getItem('gl_current_user') || 'Vinci';
    addModal.classList.remove('active');
  } catch (err) {
    console.error(err);
  } finally {
    submitBtn.innerText = 'ĐẨY LÊN STACK CHO ANH EM CHECK';
    submitBtn.disabled = false;
  }
};

// Filter Tab
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilter = btn.dataset.filter;
    renderTable();
  };
});

// Realtime sync
window.sb.channel('realtime_stack')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'stack_posts' }, loadPostsFromDB)
  .subscribe();

// TỰ ĐỘNG LÀM MỚI STACK KHI MỞ LẠI TAB / BẬT MÀN HÌNH ĐIỆN THOẠI
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    loadPostsFromDB();
  }
});
window.addEventListener('focus', () => {
  loadPostsFromDB();
});

checkIdentity();
loadPostsFromDB();