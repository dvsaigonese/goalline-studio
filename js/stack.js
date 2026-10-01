const SUPABASE_URL = 'https://exutfqxfwurwyfyxzskj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4dXRmcXhmd3Vyd3lmeXh6c2tqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4NTM0MzksImV4cCI6MjEwNjQyOTQzOX0.e3DZMEaGqgEQjMbUrll718a0lWFjY011wzPPLqh9Ls8';

// Khởi tạo Supabase client toàn cục trên window
window.sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const GL_TEAM = [
  'Maztermind',
  'Vinci',
  'Voet',
  'Quýt',
  'Tiryth',
  'Tizzy',
  'Nikolaj',
  'Cakashi',
  'Nedu',
  'Terry',
  'Naruto',
  'Ruben',
  'Dante',
  'Daugust',
  'Draco',
  'Harif',
  'Giáo 5ư',
  'Tom',
  'Brunson',
  'Vate',
  'Zenriot',
  'Kaiz',
  'Metis',
  'Genie',
  'Dmoney'
];

function checkIdentity() {
  let currentUser = localStorage.getItem('gl_current_user');
  if (!currentUser) {
    const chosen = prompt(`CHÀO MỪNG ĐẾN VỚI GOAL-LINE STUDIO!\nBạn là ai trong team?\n(${GL_TEAM.join(', ')})`, 'HaRif');
    currentUser = chosen ? chosen.trim() : 'HaRif';
    localStorage.setItem('gl_current_user', currentUser);
  }
  
  const displayEl = document.getElementById('current-user-display');
  if (displayEl) displayEl.innerText = `ADMIN: ${currentUser.toUpperCase()}`;
  
  const authorInput = document.getElementById('input-author');
  if (authorInput) authorInput.value = currentUser;
  
  return currentUser;
}

document.getElementById('btn-change-identity').onclick = () => {
  const chosen = prompt(`Chọn lại tên của bạn:\n(${GL_TEAM.join(', ')})`, localStorage.getItem('gl_current_user') || 'HaRif');
  if (chosen) {
    localStorage.setItem('gl_current_user', chosen.trim());
    checkIdentity();
  }
};

// ==========================================
// 3. QUẢN LÝ DỮ LIỆU & RENDER BẢNG
// ==========================================
let posts = [];
let activeFilter = 'all';
let currentReadingPost = null;

// Tải dữ liệu từ database Supabase
async function loadPostsFromDB() {
  try {
    const { data, error } = await sb
      .from('stack_posts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Lỗi kết nối Supabase:', error.message);
      alert('Không thể kết nối Supabase: ' + error.message);
      return;
    }

    posts = data.map(item => {
      const isApproved = item.status === 'approved' || item.status === 'ready';
      return {
        id: item.id,
        author: item.author,
        title: item.title,
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
    console.error('Lỗi ngoại lệ:', err);
  }
}

// Render dữ liệu ra bảng HTML
function renderTable() {
  const tbody = document.getElementById('stack-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  const filtered = posts.filter(p => activeFilter === 'all' || p.status === activeFilter);

  // Cập nhật số đếm các tab
  document.getElementById('count-all').innerText = posts.length;
  document.getElementById('count-unapproved').innerText = posts.filter(p => p.status === 'unapproved').length;
  document.getElementById('count-approved').innerText = posts.filter(p => p.status === 'approved').length;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:30px; font-weight:700;">CHƯA CÓ BÀI VIẾT NÀO TRONG MỤC NÀY</td></tr>`;
    return;
  }

  filtered.forEach(post => {
    const tr = document.createElement('tr');
    
    // Chỉ render thẻ <img> khi có URL hợp lệ bắt đầu bằng http
    const hasValidImage = post.imgUrl && post.imgUrl.startsWith('http');

    const isApproved = post.status === 'approved';
    const statusBadge = isApproved 
      ? `<span class="badge-status badge-approved">ĐÃ DUYỆT</span>`
      : `<span class="badge-status badge-unapproved">CHƯA DUYỆT</span>`;

    tr.innerHTML = `
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
          <div class="img-thumb-box img-thumb-clickable" onclick="openImageViewer('${post.imgUrl}', '${post.title}')" title="Click để xem ảnh to">
            <img src="${post.imgUrl}" alt="Thumbnail" onerror="this.parentElement.innerHTML='(Lỗi ảnh)'">
          </div>
        ` : `<span style="font-size:0.75rem; color:#888;">(Chưa có ảnh)</span>`}
      </td>
      <td><strong>${post.designer}</strong></td>
      <td style="font-size:0.85rem; max-width:200px;">${post.note}</td>
      <td><span style="font-family:var(--font-mono); font-size:0.8rem; font-weight:700;">${post.scheduleNote}</span></td>
      <td>
        <div class="table-actions">
          <button class="btn-action-icon" title="Đọc bài" onclick="openReader('${post.id}')">
            <i class="fa-solid fa-eye"></i>
          </button>
          <button class="btn-action-icon" title="Copy nhanh tiêu đề" onclick="copyText('${post.title}')">
            <i class="fa-solid fa-copy"></i>
          </button>
          <button class="btn-action-icon" style="color:red;" title="Xóa bài" onclick="deletePost('${post.id}')">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ==========================================
// 4. THAO TÁC THÊM, SỬA, XÓA DỮ LIỆU
// ==========================================

// Đẩy bài mới vào Supabase
document.getElementById('form-add-post').onsubmit = async (e) => {
  e.preventDefault();

  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.innerText = 'ĐANG ĐẨY LÊN...';
  submitBtn.disabled = true;

  try {
    let finalImageUrl = '';
    const fileInput = document.getElementById('input-image-file');
    const file = fileInput.files[0];

    // 1. Nếu có đính kèm file ảnh từ máy -> Tự động upload lên Supabase Storage
    if (file) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await window.sb.storage
        .from('stack-assets')
        .upload(fileName, file);

      if (uploadError) {
        console.error('Lỗi upload file ảnh:', uploadError.message);
      } else {
        // Lấy link ảnh trực tiếp
        const { data: publicUrlData } = window.sb.storage
          .from('stack-assets')
          .getPublicUrl(fileName);

        finalImageUrl = publicUrlData.publicUrl;
      }
    }

    // 2. Gom dữ liệu form đưa vào Database
    const newPostData = {
      author: document.getElementById('input-author').value || 'HaRif',
      designer: document.getElementById('input-designer').value || '--',
      title: document.getElementById('input-title').value || 'Không có tiêu đề',
      content: document.getElementById('input-full-content').value || '',
      img_url: finalImageUrl,
      note: document.getElementById('input-note').value || '--',
      schedule_note: document.getElementById('input-schedule-note').value || '--',
      status: 'unapproved'
    };

    const { error: insertError } = await window.sb
      .from('stack_posts')
      .insert([newPostData]);

    if (insertError) {
      alert('Lỗi lưu bài: ' + insertError.message);
    } else {
      e.target.reset();
      document.getElementById('input-author').value = localStorage.getItem('gl_current_user') || 'HaRif';
      document.getElementById('post-modal').classList.remove('active');
    }
  } catch (err) {
    console.error('Lỗi:', err);
    alert('Có lỗi xảy ra khi tải bài lên.');
  } finally {
    submitBtn.innerText = 'ĐẨY LÊN STACK CHO ANH EM CHECK';
    submitBtn.disabled = false;
  }
};

// Xóa bài có mã PIN bảo vệ
window.deletePost = async (id) => {
  const pin = prompt("Nhập mã PIN Admin để xóa bài:");
  if (pin === "2026") {
    const { error } = await sb.from('stack_posts').delete().eq('id', id);
    if (error) {
      alert("Lỗi khi xóa bài: " + error.message);
    }
  } else if (pin !== null) {
    alert("Sai mã PIN Admin!");
  }
};

// ==========================================
// 5. MODAL & CÁC NÚT TIỆN ÍCH
// ==========================================
// Cập nhật khi mở Modal đọc bài
window.openReader = (id) => {
  const post = posts.find(p => p.id === id);
  if (!post) return;
  currentReadingPost = post;

  document.getElementById('reader-modal-author').innerText = `TÁC GIẢ: ${post.author.toUpperCase()}`;
  document.getElementById('reader-modal-title').innerText = post.title;
  document.getElementById('reader-modal-text').innerText = post.content || '(Bài viết chưa có nội dung)';
  
  const wordCount = post.content ? post.content.trim().split(/\s+/).filter(Boolean).length : 0;
  document.getElementById('reader-word-count').innerText = `${wordCount} từ`;

  // Cập nhật trạng thái hiển thị và nút duyệt
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

// Sự kiện bấm nút Toggle Duyệt / Hủy duyệt
document.getElementById('btn-toggle-approval').onclick = async () => {
  if (!currentReadingPost) return;

  const nextStatus = currentReadingPost.status === 'approved' ? 'unapproved' : 'approved';

  const { error } = await window.sb
    .from('stack_posts')
    .update({ status: nextStatus })
    .eq('id', currentReadingPost.id);

  if (error) {
    alert('Lỗi cập nhật: ' + error.message);
  } else {
    currentReadingPost.status = nextStatus;
    document.getElementById('reader-modal').classList.remove('active');
    loadPostsFromDB();
  }
};

document.getElementById('btn-close-reader').onclick = () => {
  document.getElementById('reader-modal').classList.remove('active');
};

document.getElementById('btn-copy-reader-content').onclick = () => {
  if (!currentReadingPost) return;
  const fullText = `${currentReadingPost.title}\n\n${currentReadingPost.content}`;
  navigator.clipboard.writeText(fullText).then(() => {
    alert("ĐÃ COPY TOÀN BỘ NỘI DUNG VÀO CLIPBOARD!");
  });
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

// Modal Thêm bài
const addModal = document.getElementById('post-modal');
document.getElementById('btn-open-modal').onclick = () => addModal.classList.add('active');
document.getElementById('btn-close-modal').onclick = () => addModal.classList.remove('active');

// Filter Tab Buttons
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilter = btn.dataset.filter;
    renderTable();
  };
});

// ==========================================
// 6. REALTIME LISTENER & KHỞI CHẠY
// ==========================================
sb.channel('realtime_stack')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'stack_posts' }, () => {
    // Tự động tải lại bảng khi có bất kỳ ai thêm / sửa / xóa
    loadPostsFromDB();
  })
  .subscribe();

// Chạy khởi tạo khi tải trang
checkIdentity();
loadPostsFromDB();