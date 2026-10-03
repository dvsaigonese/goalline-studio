/**
 * ==============================================================================
 * GOAL-LINE STUDIO - CONTENT STACK PIPELINE ENGINE (stack.js)
 * ==============================================================================
 * Quản lý toàn bộ:
 * 1. Cấu hình Supabase & State ứng dụng
 * 2. Tải & đồng bộ dữ liệu bài viết (Database & Deep-Sleep Recovery)
 * 3. Tiện ích Storage: Dọn rác tự động & Upload XHR đo tiến trình (MB/%)
 * 4. Render bảng Content Stack (An toàn ký tự đặc biệt, Checkbox chọn lọc)
 * 5. Reader Desk - Đọc duyệt bài, đếm từ & Copy toàn văn bản
 * 6. Modal Đẩy bài mới vào Stack (Kèm Progress Bar trực quan)
 * 7. Modal Chỉnh sửa bài viết toàn diện (Admin & Designer)
 * 8. Xóa bài viết (Đơn lẻ & Hàng loạt kèm mã PIN 2026 + Tự dọn sạch file Storage)
 * 9. Lightbox Viewer & Tải ảnh gốc (Hỗ trợ Save to Photos trên iOS)
 * 10. Tiện ích Clipboard toàn năng & Bộ lọc trạng thái
 * ==============================================================================
 */

// ==============================================================================
// PHẦN 1: CẤU HÌNH SUPABASE & KHỞI TẠO STATE
// ==============================================================================
const SUPABASE_URL = 'https://exutfqxfwurwyfyxzskj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4dXRmcXhmd3Vyd3lmeXh6c2tqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4NTM0MzksImV4cCI6MjEwNjQyOTQzOX0.e3DZMEaGqgEQjMbUrll718a0lWFjY011wzPPLqh9Ls8';

// Khởi tạo Supabase client toàn cục trên window
window.sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// State quản lý danh sách bài viết & bộ lọc
let posts = [];
let activeFilter = 'all'; // 'all', 'unapproved', 'approved'
let currentReadingPost = null;
let selectedPostIds = new Set(); // Tập hợp ID các bài được tích chọn xóa

// State Lightbox xem ảnh
let currentModalImageUrl = '';
let currentModalImageTitle = '';

// ==============================================================================
// PHẦN 2: TẢI DỮ LIỆU TỪ DATABASE & ĐỒNG BỘ REALTIME
// ==============================================================================
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
    console.error('Lỗi nạp bài viết:', err);
  }
}

// Lắng nghe thay đổi Realtime từ bảng stack_posts
window.sb.channel('realtime_stack')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'stack_posts' }, loadPostsFromDB)
  .subscribe();

// Cơ chế Deep-Sleep Recovery: Tự động kéo bài mới khi mở lại điện thoại / chuyển tab
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') loadPostsFromDB();
});
window.addEventListener('focus', () => {
  loadPostsFromDB();
});

// ==============================================================================
// PHẦN 3: TIỆN ÍCH STORAGE (DỌN RÁC CHỐNG TRÀN 500MB & UPLOAD TIẾN TRÌNH)
// ==============================================================================

/**
 * Trích xuất tên file thực tế nằm trong Storage bucket stack-assets
 * Bắt được cả link public, link có token hoặc link chứa ký tự mã hóa URL
 */
function extractStorageFileName(url) {
  if (!url || typeof url !== 'string') return null;
  // Bắt chính xác tên file sau cụm /stack-assets/
  const match = url.match(/\/stack-assets\/([^?#]+)/);
  if (match && match[1]) {
    try {
      return decodeURIComponent(match[1]);
    } catch (e) {
      return match[1];
    }
  }
  return null;
}

/**
 * Xóa vĩnh viễn danh sách file ảnh khỏi Storage bucket stack-assets
 */
async function deleteFilesFromStorage(fileNames) {
  const validFiles = fileNames.filter(Boolean);
  if (validFiles.length === 0) return;

  try {
    const { data, error } = await window.sb.storage
      .from('stack-assets')
      .remove(validFiles);

    if (error) {
      console.error('Lỗi khi xóa file khỏi Storage:', error.message);
    } else {
      console.log(`ĐÃ XÓA THÀNH CÔNG ${validFiles.length} FILE KHỎI STORAGE:`, validFiles, data);
    }
  } catch (err) {
    console.error('Lỗi kết nối khi dọn file Storage:', err);
  }
}

// ==============================================================================
// PHẦN 4: RENDER BẢNG CONTENT STACK & CHỌN HÀNG LOẠT
// ==============================================================================
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

    // Khởi tạo HTML cho cột ảnh (Nhận diện Google Drive hoặc Thumbnail ảnh)
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
      <td>${imageCellMarkup}</td>
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

    // GẮN SỰ KIỆN QUA JS TRÁNH HOÀN TOÀN LỖI INVALID TOKEN KHI TIÊU ĐỀ XUỐNG DÒNG
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
      copyBtn.onclick = () => window.copyToClipboard(post.title || '');
    }

    const deleteBtn = tr.querySelector('.btn-action-delete');
    if (deleteBtn) {
      deleteBtn.onclick = () => deleteSinglePost(post.id);
    }

    tbody.appendChild(tr);
  });

  // Gắn sự kiện Checkbox từng dòng
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

// Cập nhật trạng thái hiển thị của nút XÓA ĐÃ CHỌN và CHECK ALL
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

// Sự kiện Check All
const checkAllBox = document.getElementById('check-all');
if (checkAllBox) {
  checkAllBox.onchange = (e) => {
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
}

// ==============================================================================
// PHẦN 5: READER DESK - ĐỌC DUYỆT BÀI & COPY TOÀN BỘ BÀI VIẾT
// ==============================================================================
window.openReader = (id) => {
  const post = posts.find(p => String(p.id) === String(id));
  if (!post) return;
  currentReadingPost = post;

  const authorEl = document.getElementById('reader-modal-author');
  const titleEl = document.getElementById('reader-modal-title');
  const textEl = document.getElementById('reader-modal-text');
  const wordCountEl = document.getElementById('reader-word-count');
  const statusLabel = document.getElementById('reader-status-label');
  const btnToggle = document.getElementById('btn-toggle-approval');

  if (authorEl) authorEl.innerText = `TÁC GIẢ: ${post.author.toUpperCase()}`;
  if (titleEl) titleEl.innerText = post.title;
  if (textEl) textEl.innerText = post.content || '(Bài viết chưa có nội dung chi tiết)';

  const wordCount = post.content ? post.content.trim().split(/\s+/).filter(Boolean).length : 0;
  if (wordCountEl) wordCountEl.innerText = `${wordCount} từ`;

  if (statusLabel && btnToggle) {
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
  }

  const readerModal = document.getElementById('reader-modal');
  if (readerModal) readerModal.classList.add('active');
};

const btnCloseReader = document.getElementById('btn-close-reader');
if (btnCloseReader) {
  btnCloseReader.onclick = () => {
    const readerModal = document.getElementById('reader-modal');
    if (readerModal) readerModal.classList.remove('active');
  };
}

// Bật/tắt trạng thái Duyệt bài từ Reader Modal
const btnToggleApproval = document.getElementById('btn-toggle-approval');
if (btnToggleApproval) {
  btnToggleApproval.onclick = async () => {
    if (!currentReadingPost) return;
    const nextStatus = currentReadingPost.status === 'approved' ? 'unapproved' : 'approved';

    const { error } = await window.sb
      .from('stack_posts')
      .update({ status: nextStatus })
      .eq('id', currentReadingPost.id);

    if (!error) {
      const readerModal = document.getElementById('reader-modal');
      if (readerModal) readerModal.classList.remove('active');
      loadPostsFromDB();
    } else {
      alert('Lỗi cập nhật duyệt bài: ' + error.message);
    }
  };
}

// Copy toàn bộ Tiêu đề + Nội dung bài viết
window.copyCurrentPostContent = async function () {
  if (!currentReadingPost || !currentReadingPost.content) {
    alert("Bài viết này không có nội dung văn bản để copy!");
    return;
  }

  const btn = document.getElementById("btn-copy-full-post");
  const originalHtml = btn ? btn.innerHTML : "";
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
    }
  } else {
    alert("Không thể tự động copy, vui lòng bôi đen văn bản để copy thủ công!");
  }
};

// ==============================================================================
// PHẦN 6: MODAL ĐẨY BÀI MỚI VÀO STACK (TIẾN TRÌNH UPLOAD THỜI GIAN THỰC)
// ==============================================================================
const addModal = document.getElementById('post-modal');
const btnOpenAddModal = document.getElementById('btn-open-modal');
const btnCloseAddModal = document.getElementById('btn-close-modal');

if (btnOpenAddModal && addModal) {
  btnOpenAddModal.onclick = () => {
    const authorInput = document.getElementById('input-author');
    if (authorInput) {
      authorInput.value = localStorage.getItem('gl_current_user') || 'Vinci';
    }
    addModal.classList.add('active');
  };
}

if (btnCloseAddModal && addModal) {
  btnCloseAddModal.onclick = () => addModal.classList.remove('active');
}

const formAddPost = document.getElementById('form-add-post');
if (formAddPost) {
  formAddPost.onsubmit = async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('btn-submit-post') || e.target.querySelector('button[type="submit"]');
    const progressBox = document.getElementById('upload-progress-box');
    const progressText = document.getElementById('upload-progress-text');
    const progressPercent = document.getElementById('upload-progress-percent');
    const progressBar = document.getElementById('upload-progress-bar');

    const fileInput = document.getElementById('input-image-file');
    const file = fileInput ? fileInput.files[0] : null;
    let finalImageUrl = document.getElementById('input-image-url')?.value.trim() || '';

    try {
      // 1. Nếu có đính kèm file ảnh thì tải lên kèm thanh tiến trình
      if (file) {
        if (progressBox) progressBox.style.display = 'block';
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerText = 'ĐANG TẢI ẢNH LÊN CLOUD...';
        }

        finalImageUrl = await uploadImageWithProgress(file, (loadedMB, totalMB, percent) => {
          if (progressText) progressText.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> Đang tải: <strong>${loadedMB} MB</strong> / <strong>${totalMB} MB</strong>`;
          if (progressPercent) progressPercent.innerText = `${percent}%`;
          if (progressBar) progressBar.style.width = `${percent}%`;
        });
      }

      if (submitBtn) submitBtn.innerText = 'ĐANG LƯU DỮ LIỆU...';

      // 2. Lưu bài viết vào Database Supabase
      const newPostData = {
        author: document.getElementById('input-author')?.value.trim() || localStorage.getItem('gl_current_user') || 'Vinci',
        designer: document.getElementById('input-designer')?.value.trim() || '--',
        title: document.getElementById('input-title')?.value.trim() || 'Không có tiêu đề',
        content: document.getElementById('input-full-content')?.value || '',
        img_url: finalImageUrl,
        note: document.getElementById('input-note')?.value.trim() || '--',
        schedule_note: document.getElementById('input-schedule-note')?.value.trim() || '--',
        status: 'unapproved'
      };

      const { error: insertErr } = await window.sb.from('stack_posts').insert([newPostData]);
      if (insertErr) throw insertErr;

      // 3. Reset form và đóng modal
      e.target.reset();
      if (progressBox) progressBox.style.display = 'none';
      if (progressBar) progressBar.style.width = '0%';
      if (addModal) addModal.classList.remove('active');
      loadPostsFromDB();

    } catch (err) {
      console.error(err);
      alert('Có lỗi xảy ra: ' + err.message);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerText = 'ĐẨY LÊN STACK CHO ANH EM CHECK';
      }
      if (progressBox) progressBox.style.display = 'none';
    }
  };
}

// ==============================================================================
// PHẦN 7: MODAL CHỈNH SỬA BÀI VIẾT (ADMIN & DESIGNER)
// ==============================================================================
const editModal = document.getElementById('edit-modal');
const btnCloseEditModal = document.getElementById('btn-close-edit-modal');

window.openEditModal = (id) => {
  const post = posts.find(p => String(p.id) === String(id));
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
  
  const fileInput = document.getElementById('edit-image-file');
  if (fileInput) fileInput.value = '';

  if (editModal) editModal.classList.add('active');
};

if (btnCloseEditModal && editModal) {
  btnCloseEditModal.onclick = () => editModal.classList.remove('active');
}

const formEditPost = document.getElementById('form-edit-post');
if (formEditPost) {
  formEditPost.onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-id').value;
    const submitBtn = document.getElementById('btn-submit-edit');
    const progressBox = document.getElementById('edit-upload-progress-box');
    const progressText = document.getElementById('edit-upload-progress-text');
    const progressPercent = document.getElementById('edit-upload-progress-percent');
    const progressBar = document.getElementById('edit-upload-progress-bar');

    let finalImageUrl = document.getElementById('edit-image-url')?.value.trim() || '';
    const fileInput = document.getElementById('edit-image-file');
    const file = fileInput ? fileInput.files[0] : null;

    try {
      // Nếu có tải file ảnh mới từ máy
      if (file) {
        if (progressBox) progressBox.style.display = 'block';
        if (submitBtn) {
          submitBtn.innerText = 'ĐANG TẢI ẢNH MỚI LÊN CLOUD...';
          submitBtn.disabled = true;
        }

        // Bắt sự kiện cập nhật số MB và % thời gian thực
        finalImageUrl = await uploadImageWithProgress(file, (loadedMB, totalMB, percent) => {
          if (progressText) progressText.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> Đang tải: <strong>${loadedMB} MB</strong> / <strong>${totalMB} MB</strong>`;
          if (progressPercent) progressPercent.innerText = `${percent}%`;
          if (progressBar) progressBar.style.width = `${percent}%`;
        });
      }

      if (submitBtn) submitBtn.innerText = 'ĐANG LƯU DỮ LIỆU...';

      const updatedData = {
        author: document.getElementById('edit-author').value.trim() || 'Vinci',
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
        alert("Lỗi cập nhật bài: " + updateError.message);
      } else {
        if (editModal) editModal.classList.remove('active');
        if (progressBox) progressBox.style.display = 'none';
        if (progressBar) progressBar.style.width = '0%';
        alert("Đã cập nhật bài viết thành công!");
        loadPostsFromDB();
      }
    } catch (err) {
      console.error(err);
      alert('Có lỗi khi lưu cập nhật: ' + err.message);
    } finally {
      if (submitBtn) {
        submitBtn.innerText = 'LƯU CẬP NHẬT';
        submitBtn.disabled = false;
      }
      if (progressBox) progressBox.style.display = 'none';
    }
  };
}

// ==============================================================================
// PHẦN 8: XÓA ĐƠN LẺ & XÓA HÀNG LOẠT (TỰ DỌN STORAGE & MÃ PIN 2026)
// ==============================================================================

// 1. Xóa đơn lẻ: Tự động xóa file ảnh trong Storage trước rồi mới xóa bài viết
window.deleteSinglePost = async function (id) {
  const post = posts.find(p => String(p.id) === String(id));
  if (!post) return;

  if (!confirm(`Xóa vĩnh viễn bài: "${post.title}"?`)) return;

  // 1. Dọn sạch file ảnh trong Storage
  const storageFileName = extractStorageFileName(post.imgUrl);
  if (storageFileName) {
    await deleteFilesFromStorage([storageFileName]);
  }

  // 2. Xóa hàng trong Database
  const { error } = await window.sb.from('stack_posts').delete().eq('id', id);
  if (error) {
    alert("Lỗi khi xóa bài: " + error.message);
  } else {
    selectedPostIds.delete(String(id));
    selectedPostIds.delete(Number(id));
    loadPostsFromDB();
  }
};

// 2. Xóa hàng loạt: Đã fix lỗi ép kiểu String(p.id) để gom sạch ảnh cần xóa
const btnBatchDelete = document.getElementById('btn-batch-delete');
if (btnBatchDelete) {
  btnBatchDelete.onclick = async () => {
    if (selectedPostIds.size === 0) return;

    const pin = prompt(`Bạn đang chọn xóa ${selectedPostIds.size} bài viết.\nNhập mã PIN Admin để xác nhận xóa sạch:`);
    if (pin !== '2026') {
      if (pin !== null) alert("Sai mã PIN Admin!");
      return;
    }

    // Ép toàn bộ Set về dạng chuỗi để so sánh chuẩn xác 100%
    const selectedStrings = new Set(Array.from(selectedPostIds).map(String));

    // Gom toàn bộ tên file ảnh của các bài được chọn
    const filesToDelete = posts
      .filter(p => selectedStrings.has(String(p.id)))
      .map(p => extractStorageFileName(p.imgUrl))
      .filter(Boolean);

    // 1. Xóa toàn bộ file trong Storage
    if (filesToDelete.length > 0) {
      await deleteFilesFromStorage(filesToDelete);
    }

    // 2. Xóa trong Database
    const idsArray = Array.from(selectedPostIds);
    const { error } = await window.sb.from('stack_posts').delete().in('id', idsArray);
    
    if (error) {
      alert("Lỗi khi xóa hàng loạt: " + error.message);
    } else {
      selectedPostIds.clear();
      alert(`Đã xóa sạch ${idsArray.length} bài viết và dọn toàn bộ ảnh liên quan trong Storage!`);
      loadPostsFromDB();
    }
  };
}

// ==============================================================================
// PHẦN 9: LIGHTBOX VIEWER & TẢI ẢNH GỐC (SAVE TO PHOTOS TRÊN IOS)
// ==============================================================================
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

// Tải ảnh gốc: Gọi Share Sheet trên iOS/Android để lưu thẳng vào Cuộn Camera
window.downloadActiveImage = async function () {
  if (!currentModalImageUrl) return;

  const btn = document.getElementById('btn-download-hd-image');
  const oldHtml = btn ? btn.innerHTML : '';
  if (btn) btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ĐANG XỬ LÝ...`;

  try {
    // Kéo dữ liệu ảnh dạng Blob để vượt rào cản Cross-Origin
    const response = await fetch(currentModalImageUrl, { mode: 'cors' });
    if (!response.ok) throw new Error('Không thể fetch ảnh qua CORS');
    const blob = await response.blob();

    // Nhận diện đuôi file và MIME type
    let ext = 'jpg';
    let mimeType = blob.type || 'image/jpeg';
    
    if (mimeType.includes('png')) {
      ext = 'png';
    } else if (mimeType.includes('webp')) {
      ext = 'webp';
    } else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) {
      ext = 'jpg';
      mimeType = 'image/jpeg';
    } else {
      const match = currentModalImageUrl.match(/\.([a-zA-Z0-9]+)(\?|$)/);
      if (match) ext = match[1].toLowerCase();
    }

    const cleanTitle = (currentModalImageTitle || 'Goal-Line-Asset')
      .replace(/[^a-zA-Z0-9à-ỹÀ-Ỹ\s-_]/g, '')
      .trim() || 'Goal-Line-Asset';
    const fileName = `${cleanTitle}.${ext}`;

    // ĐẶC TRỊ CHO IPHONE/ANDROID: DÙNG NATIVE SHARE SHEET LƯU VÀO PHOTOS
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile && navigator.canShare) {
      const file = new File([blob], fileName, { type: mimeType });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: cleanTitle
        });
        return; // Đã lưu vào Photos thành công
      }
    }

    // TẢI VỀ TRÊN PC / LAPTOP
    const blobUrl = window.URL.createObjectURL(blob);
    const tempLink = document.createElement('a');
    tempLink.style.display = 'none';
    tempLink.href = blobUrl;
    tempLink.download = fileName;
    document.body.appendChild(tempLink);
    tempLink.click();

    setTimeout(() => {
      window.URL.revokeObjectURL(blobUrl);
      document.body.removeChild(tempLink);
    }, 1500);

  } catch (err) {
    if (err.name === 'AbortError') return; // Người dùng ấn Hủy trên iOS Share Sheet
    console.warn('Lỗi tải/share ảnh:', err);
    window.open(currentModalImageUrl, '_blank');
  } finally {
    if (btn) btn.innerHTML = oldHtml;
  }
};

// ==============================================================================
// PHẦN 10: TIỆN ÍCH CLIPBOARD & BỘ LỌC TRẠNG THÁI
// ==============================================================================

// Hàm copy đa nền tảng (Hoạt động tốt cả trên Safari iOS & HTTP LAN)
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

  // Cách 2: Fallback bằng Textarea ẩn (hoạt động 100% trên mọi trình duyệt)
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

// Xử lý chuyển đổi các Tab bộ lọc bài viết
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilter = btn.dataset.filter;
    renderTable();
  };
});

// ==============================================================================
// KHỞI CHẠY LẦN ĐẦU KHI TẢI TRANG
// ==============================================================================
loadPostsFromDB();