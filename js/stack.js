const SUPABASE_URL = 'https://exutfqxfwurwyfyxzskj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4dXRmcXhmd3Vyd3lmeXh6c2tqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4NTM0MzksImV4cCI6MjEwNjQyOTQzOX0.e3DZMEaGqgEQjMbUrll718a0lWFjY011wzPPLqh9Ls8';

// Khởi tạo Supabase client toàn cục trên window
window.sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
// RENDER BẢNG STACK (AN TOÀN TUYỆT ĐỐI - KHÔNG LỖI TOKEN)
// ==========================================
function renderTable() {
  const tbody = document.getElementById('stack-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  const filtered = posts.filter(p => activeFilter === 'all' || p.status === activeFilter);

  // Cập nhật số lượng bài trên các Tab bộ lọc
  const countAll = document.getElementById('count-all');
  const countUnapproved = document.getElementById('count-unapproved');
  const countApproved = document.getElementById('count-approved');

  if (countAll) countAll.innerText = posts.length;
  if (countUnapproved) countUnapproved.innerText = posts.filter(p => p.status === 'unapproved').length;
  if (countApproved) countApproved.innerText = posts.filter(p => p.status === 'approved').length;

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

    // Khởi tạo HTML cho cột ảnh (Không gán onclick chuỗi ở đây)
    let imageCellMarkup = `<span style="font-size:0.75rem; color:#888;">(Chưa có ảnh)</span>`;
    const cleanUrl = (post.imgUrl || '').trim();

    if (cleanUrl !== '') {
      if (cleanUrl.includes('drive.google.com')) {
        imageCellMarkup = `
          <a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" class="slot-pill" style="text-decoration:none; display:inline-flex; align-items:center; gap:6px; background:var(--neo-yellow); color:#000; font-size:0.75rem; font-weight:900;" title="Mở Google Drive">
            <i class="fa-brands fa-google-drive"></i> Link Drive
          </a>
        `;
      } else if (cleanUrl.startsWith('http')) {
        imageCellMarkup = `
          <div class="img-thumb-box img-thumb-clickable" title="Click để phóng to ảnh">
            <img src="${cleanUrl}" alt="Thumbnail" referrerpolicy="no-referrer" loading="lazy" onerror="this.onerror=null; this.src='assets/img/GL_logo.jpg';">
          </div>
        `;
      }
    }

    tr.innerHTML = `
      <td style="text-align: center;">
        <input type="checkbox" class="neo-checkbox row-checkbox" data-id="${post.id}" ${isChecked}>
      </td>
      <td><span class="author-pill">${post.author || 'Vinci'}</span></td>
      <td>
        <div class="post-clickable-title btn-open-reader" style="cursor:pointer;">
          <i class="fa-solid fa-file-lines" style="color:#2b7de9;"></i> ${post.title || 'Không có tiêu đề'}
        </div>
        <br>
        ${statusBadge}
      </td>
      <td>
        ${imageCellMarkup}
      </td>
      <td><strong>${post.designer || '--'}</strong></td>
      <td style="font-size:0.85rem; max-width:180px;">${post.note || '--'}</td>
      <td><span style="font-family:var(--font-mono); font-size:0.8rem; font-weight:700;">${post.scheduleNote || '--'}</span></td>
      <td>
        <div class="table-actions">
          <button class="btn-action-icon btn-action-read" title="Đọc & duyệt bài">
            <i class="fa-solid fa-eye"></i>
          </button>
          <button class="btn-action-icon btn-action-edit" title="Chỉnh sửa mọi thông tin" style="color:#0984e3;">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
          <button class="btn-action-icon btn-action-copy" title="Copy tiêu đề">
            <i class="fa-solid fa-copy"></i>
          </button>
          <button class="btn-action-icon btn-action-delete" style="color:red;" title="Xóa bài viết">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </td>
    `;

    // GẮN SỰ KIỆN TRỰC TIẾP QUA BIẾN JS (TRÁNH LỖI INVALID TOKEN 100%)
    const thumbBox = tr.querySelector('.img-thumb-clickable');
    if (thumbBox) {
      thumbBox.onclick = () => openImageViewer(cleanUrl, post.title);
    }

    const titleBtn = tr.querySelector('.btn-open-reader');
    if (titleBtn) {
      titleBtn.onclick = () => openReader(post.id);
    }

    const readBtn = tr.querySelector('.btn-action-read');
    if (readBtn) {
      readBtn.onclick = () => openReader(post.id);
    }

    const editBtn = tr.querySelector('.btn-action-edit');
    if (editBtn) {
      editBtn.onclick = () => openEditModal(post.id);
    }

    const copyBtn = tr.querySelector('.btn-action-copy');
    if (copyBtn) {
      copyBtn.onclick = () => copyText(post.title || '');
    }

    const deleteBtn = tr.querySelector('.btn-action-delete');
    if (deleteBtn) {
      deleteBtn.onclick = () => deleteSinglePost(post.id);
    }

    tbody.appendChild(tr);
  });

  // Gắn sự kiện chọn Checkbox cho từng dòng
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

// ==========================================
// HÀM CẬP NHẬT GIAO DIỆN CHỌN NHIỀU BÀI (SELECT)
// ==========================================
function updateBatchDeleteUI() {
  const btnBatch = document.getElementById('btn-batch-delete');
  const countEl = document.getElementById('selected-count');
  const checkAllBox = document.getElementById('check-all');

  const count = selectedPostIds.size;
  if (countEl) countEl.innerText = count;

  if (btnBatch) {
    btnBatch.style.display = count > 0 ? 'inline-flex' : 'none';
  }

  const visibleRowBoxes = document.querySelectorAll('.row-checkbox');
  if (checkAllBox) {
    checkAllBox.checked = visibleRowBoxes.length > 0 && Array.from(visibleRowBoxes).every(cb => cb.checked);
  }
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

// ==========================================
// TRÌNH XEM ẢNH & TẢI ẢNH GỐC TOÀN NĂNG (FIT MỌI ĐỊNH DẠNG)
// ==========================================
let currentModalImageUrl = '';
let currentModalImageTitle = '';

window.openImageViewer = function (url, title) {
  if (!url) return;
  currentModalImageUrl = url;
  currentModalImageTitle = title || 'goal-line-asset';

  const modal = document.getElementById('image-viewer-modal');
  const imgEl = document.getElementById('image-viewer-img');
  const titleEl = document.getElementById('image-viewer-title');

  if (titleEl) titleEl.innerText = `ẢNH: ${currentModalImageTitle}`;
  if (imgEl) {
    imgEl.referrerPolicy = "no-referrer";
    imgEl.src = currentModalImageUrl;
  }

  if (modal) modal.classList.add('active');
};

const btnCloseImgViewer = document.getElementById('btn-close-image-viewer');
if (btnCloseImgViewer) {
  btnCloseImgViewer.onclick = () => {
    const modal = document.getElementById('image-viewer-modal');
    if (modal) modal.classList.remove('active');
  };
}

// Hàm ép tải ảnh về máy (hoạt động cho cả WebP, PNG, JPG, GIF trên iOS & PC)
window.downloadActiveImage = async function () {
  if (!currentModalImageUrl) return;

  const btn = document.getElementById('btn-download-hd-image');
  const oldHtml = btn ? btn.innerHTML : '';
  if (btn) btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ĐANG TẢI...`;

  try {
    // 1. Kéo dữ liệu ảnh dạng Blob để vượt rào cản Cross-Origin của iOS Safari
    const response = await fetch(currentModalImageUrl, { mode: 'cors' });
    if (!response.ok) throw new Error('Không thể fetch ảnh qua CORS');
    const blob = await response.blob();

    // 2. Tự nhận diện đuôi file thật (webp, png, jpg...)
    let ext = 'jpg';
    if (blob.type) {
      ext = blob.type.split('/')[1] || 'jpg';
      if (ext === 'jpeg') ext = 'jpg';
    } else {
      const match = currentModalImageUrl.match(/\.([a-zA-Z0-9]+)(\?|$)/);
      if (match) ext = match[1];
    }

    // 3. Kích hoạt lệnh tải trực tiếp vào thư viện máy
    const blobUrl = window.URL.createObjectURL(blob);
    const tempLink = document.createElement('a');
    tempLink.style.display = 'none';
    tempLink.href = blobUrl;
    tempLink.download = `${currentModalImageTitle.replace(/[^a-zA-Z0-9à-ỹÀ-Ỹ\s-_]/g, '')}.${ext}`;
    document.body.appendChild(tempLink);
    tempLink.click();

    setTimeout(() => {
      window.URL.revokeObjectURL(blobUrl);
      document.body.removeChild(tempLink);
    }, 1500);
  } catch (err) {
    console.warn('Tải Blob không thành công, mở trực tiếp để lưu thủ công:', err);
    // Fallback cho Safari: Mở thẳng file gốc sang tab riêng để người dùng đè ngón tay lưu
    window.open(currentModalImageUrl, '_blank');
  } finally {
    if (btn) btn.innerHTML = oldHtml;
  }
};

// document.getElementById('btn-close-image').onclick = () => {
//   document.getElementById('image-modal').classList.remove('active');
// };

// ==========================================
// HÀM COPY BẤT TỬ (HỖ TRỢ CẢ MOBILE, SAFARI & LOCAL DEV)
// ==========================================
window.copyToClipboard = async function (text) {
  if (!text) {
    alert("Không có nội dung để copy!");
    return false;
  }

  // Cách 1: Dùng Clipboard API hiện đại
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn("Clipboard API bị chặn, chuyển sang fallback:", err);
    }
  }

  // Cách 2: Fallback bằng Textarea ẩn (hoạt động 100% trên mọi trình duyệt/IP)
  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand("copy");
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error("Lỗi copy fallback:", err);
    return false;
  }
};

// ==========================================
// LOGIC COPY TOÀN BỘ BÀI VIẾT TRONG READER MODAL
// ==========================================
window.copyCurrentPostContent = async function () {
  if (!currentReadingPost || !currentReadingPost.content) {
    alert("Bài viết này không có nội dung văn bản để copy!");
    return;
  }

  const btn = document.getElementById("btn-copy-full-post");
  const originalHtml = btn ? btn.innerHTML : "";

  // Tạo nội dung format đầy đủ gồm Tiêu đề + Nội dung (hoặc chỉ nội dung tùy bạn)
  const fullTextToCopy = `${currentReadingPost.title}\n\n${currentReadingPost.content}`;

  const success = await window.copyToClipboard(fullTextToCopy);

  if (success) {
    if (btn) {
      btn.innerHTML = `<i class="fa-solid fa-check" style="color:var(--neo-green);"></i> ĐÃ COPY THÀNH CÔNG!`;
      btn.style.background = "#000";
      btn.style.color = "#fff";
      setTimeout(() => {
        btn.innerHTML = originalHtml;
        btn.style.background = "";
        btn.style.color = "";
      }, 1800);
    } else {
      alert("Đã copy toàn bộ bài viết vào clipboard!");
    }
  } else {
    alert("Không thể copy tự động, vui lòng bôi đen văn bản để copy thủ công!");
  }
};

// Form Đẩy bài mới
const addModal = document.getElementById('post-modal');
document.getElementById('btn-open-modal').onclick = () => addModal.classList.add('active');
document.getElementById('btn-close-modal').onclick = () => addModal.classList.remove('active');

// Xử lý gửi bài từ form thêm mới
const formAddPost = document.getElementById('form-add-post');
if (formAddPost) {
  formAddPost.onsubmit = async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.innerText = 'ĐANG ĐẨY LÊN...';
    submitBtn.disabled = true;

    try {
      // 1. Lấy link nhập tay (Google Drive hoặc URL ảnh)
      const inputUrlEl = document.getElementById('input-image-url');
      let finalImageUrl = inputUrlEl ? inputUrlEl.value.trim() : '';

      // 2. Nếu có đính kèm file ảnh từ máy thì tải lên Storage
      const fileInput = document.getElementById('input-image-file');
      const file = fileInput ? fileInput.files[0] : null;

      if (file) {
        const fileExt = file.name.split('.').pop().toLowerCase();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        // Nhận diện MIME type chuẩn xác cho WebP, PNG, JPG, GIF
        let mimeType = file.type;
        if (!mimeType) {
          if (fileExt === 'webp') mimeType = 'image/webp';
          else if (fileExt === 'png') mimeType = 'image/png';
          else if (fileExt === 'jpg' || fileExt === 'jpeg') mimeType = 'image/jpeg';
          else mimeType = 'image/*';
        }

        // Bổ sung contentType để Supabase trả về đúng header ảnh
        const { error: uploadError } = await window.sb.storage
          .from('stack-assets')
          .upload(fileName, file, {
            contentType: mimeType,
            upsert: true
          });

        if (!uploadError) {
          const { data } = window.sb.storage.from('stack-assets').getPublicUrl(fileName);
          finalImageUrl = data.publicUrl;
        } else {
          console.error("Lỗi upload ảnh:", uploadError.message);
        }
      }

      // 3. Đẩy vào bảng stack_posts
      const newPostData = {
        author: document.getElementById('input-author').value || localStorage.getItem('gl_current_user') || 'Vinci',
        designer: document.getElementById('input-designer').value.trim() || '--',
        title: document.getElementById('input-title').value.trim() || 'Không có tiêu đề',
        content: document.getElementById('input-full-content').value || '',
        img_url: finalImageUrl,
        note: document.getElementById('input-note').value.trim() || '--',
        schedule_note: document.getElementById('input-schedule-note').value.trim() || '--',
        status: 'unapproved'
      };

      const { error: insertErr } = await window.sb.from('stack_posts').insert([newPostData]);

      if (insertErr) {
        alert("Lỗi khi đẩy vào Stack: " + insertErr.message);
      } else {
        e.target.reset();
        document.getElementById('input-author').value = localStorage.getItem('gl_current_user') || 'Vinci';
        document.getElementById('post-modal').classList.remove('active');
        loadPostsFromDB();
      }
    } catch (err) {
      console.error(err);
      alert("Có lỗi xảy ra khi đẩy bài.");
    } finally {
      submitBtn.innerText = 'ĐẨY LÊN STACK CHO ANH EM CHECK';
      submitBtn.disabled = false;
    }
  };
}

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

loadPostsFromDB();