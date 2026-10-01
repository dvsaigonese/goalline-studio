const STORAGE_KEY = 'gl_personal_drafts';
const ACTIVE_ID_KEY = 'gl_active_draft_id';

const SUPABASE_URL = 'https://exutfqxfwurwyfyxzskj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4dXRmcXhmd3Vyd3lmeXh6c2tqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4NTM0MzksImV4cCI6MjEwNjQyOTQzOX0.e3DZMEaGqgEQjMbUrll718a0lWFjY011wzPPLqh9Ls8';

// Khởi tạo Supabase client toàn cục trên window
window.sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let sbClient = null;
if (window.supabase) {
  sbClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// 1. Quản lý danh sách bài viết
let drafts = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
let activeDraftId = localStorage.getItem(ACTIVE_ID_KEY) || null;

// Khởi tạo bài mẫu ban đầu nếu máy chưa có bài nào
if (drafts.length === 0) {
  const initialDoc = {
    id: 'draft_' + Date.now(),
    title: 'Bài viết nháp đầu tiên',
    content: 'Viết bài tại đây. Chữ sẽ được tự động lưu liên tục vào máy của bạn, không lo mất khi tắt app hay tải lại trang!',
    updatedAt: new Date().toISOString()
  };
  drafts.push(initialDoc);
  activeDraftId = initialDoc.id;
  saveDraftsToStorage();
}

// Đảm bảo activeDraftId luôn hợp lệ
if (!drafts.some(d => d.id === activeDraftId)) {
  activeDraftId = drafts[0].id;
}

function saveDraftsToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
  localStorage.setItem(ACTIVE_ID_KEY, activeDraftId);
}

// 2. DOM Elements
const titleInput = document.getElementById('editor-title');
const contentArea = document.getElementById('editor-content');
const statWords = document.getElementById('stat-words');
const statChars = document.getElementById('stat-chars');
const statReadTime = document.getElementById('stat-read-time');
const saveIndicator = document.getElementById('save-indicator');
const docsListEl = document.getElementById('docs-list');
const mobileDocCount = document.getElementById('mobile-doc-count');

// 3. Render danh sách bài trong Sidebar
function renderSidebarList() {
  docsListEl.innerHTML = '';
  mobileDocCount.innerText = drafts.length;

  drafts.forEach(doc => {
    const card = document.createElement('div');
    card.className = `doc-card ${doc.id === activeDraftId ? 'active' : ''}`;
    
    // Đếm số từ nhanh của từng bài
    const words = doc.content.trim() ? doc.content.trim().split(/\s+/).filter(Boolean).length : 0;
    const dateStr = new Date(doc.updatedAt).toLocaleDateString('vi-VN');

    card.innerHTML = `
      <div class="doc-card-title">${doc.title || 'Không có tiêu đề'}</div>
      <div class="doc-card-meta">
        <span>${words} từ</span>
        <span>${dateStr}</span>
      </div>
      <button class="btn-del-doc" title="Xóa bài này" onclick="deleteDraft(event, '${doc.id}')">
        <i class="fa-solid fa-trash-can"></i>
      </button>
    `;

    card.onclick = () => switchDraft(doc.id);
    docsListEl.appendChild(card);
  });
}

// 4. Mở bài viết lên màn hình
function loadActiveDraft() {
  const current = drafts.find(d => d.id === activeDraftId);
  if (!current) return;

  titleInput.value = current.title;
  contentArea.value = current.content;
  updateStats();
  renderSidebarList();
}

// Chuyển sang bài khác
function switchDraft(id) {
  activeDraftId = id;
  saveDraftsToStorage();
  loadActiveDraft();
  closeMobileSidebar();
}

// Tạo bài viết mới
document.getElementById('btn-new-doc').onclick = () => {
  const newDoc = {
    id: 'draft_' + Date.now(),
    title: '',
    content: '',
    updatedAt: new Date().toISOString()
  };
  drafts.unshift(newDoc);
  activeDraftId = newDoc.id;
  saveDraftsToStorage();
  loadActiveDraft();
  titleInput.focus();
  closeMobileSidebar();
};

// Xóa bài viết
window.deleteDraft = (e, id) => {
  e.stopPropagation();
  if (drafts.length <= 1) {
    alert("Phải giữ lại ít nhất 1 bài viết!");
    return;
  }
  if (!confirm("Bạn có chắc chắn muốn xóa bài viết này không?")) return;

  drafts = drafts.filter(d => d.id !== id);
  if (activeDraftId === id) {
    activeDraftId = drafts[0].id;
  }
  saveDraftsToStorage();
  loadActiveDraft();
};

// 5. AUTO-SAVE & ĐẾM TỪ LIÊN TỤC
function updateStats() {
  const text = contentArea.value.trim();
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
  const chars = contentArea.value.length;

  statWords.innerText = words.toLocaleString('vi-VN');
  statChars.innerText = chars.toLocaleString('vi-VN');

  // Ước tính thời gian đọc (trung bình 200 từ/phút)
  const readMin = Math.ceil(words / 200);
  statReadTime.innerText = `~${readMin} phút đọc`;
}

function handleInput() {
  const current = drafts.find(d => d.id === activeDraftId);
  if (!current) return;

  current.title = titleInput.value;
  current.content = contentArea.value;
  current.updatedAt = new Date().toISOString();

  saveDraftsToStorage();
  updateStats();

  // Hiệu ứng "Đã lưu"
  saveIndicator.innerHTML = '<i class="fa-solid fa-check"></i> Đã lưu';
  saveIndicator.style.opacity = '1';

  // Cập nhật lại tiêu đề ở sidebar
  const activeCardTitle = document.querySelector('.doc-card.active .doc-card-title');
  if (activeCardTitle) {
    activeCardTitle.innerText = current.title || 'Không có tiêu đề';
  }
}

titleInput.addEventListener('input', handleInput);
contentArea.addEventListener('input', handleInput);

// ==================================================
// 6. LOGIC MODAL ĐẨY BÀI VÀO STACK
// ==================================================
const pushModal = document.getElementById('writer-push-modal');
const btnClosePushModal = document.getElementById('btn-close-push-modal');
const formPushToStack = document.getElementById('form-push-to-stack');

// Bấm nút "ĐẨY LÊN STACK" ở header -> Mở Modal và điền sẵn dữ liệu bài đang chọn
document.getElementById('btn-push-to-stack').onclick = () => {
  const current = drafts.find(d => d.id === activeDraftId);
  if (!current) return;

  const currentAdmin = localStorage.getItem('gl_current_user') || 'HaRif';
  document.getElementById('modal-author').value = currentAdmin;
  document.getElementById('modal-title').value = current.title || '';
  document.getElementById('modal-content').value = current.content || '';
  document.getElementById('modal-designer').value = '';
  document.getElementById('modal-note').value = '';
  document.getElementById('modal-schedule-note').value = '';
  document.getElementById('modal-image-file').value = '';

  pushModal.classList.add('active');
};

btnClosePushModal.onclick = () => pushModal.classList.remove('active');

// Xử lý gửi bài từ Modal
formPushToStack.onsubmit = async (e) => {
  e.preventDefault();

  const submitBtn = document.getElementById('btn-submit-push');
  submitBtn.innerText = 'ĐANG TẢI LÊN...';
  submitBtn.disabled = true;

  try {
    let uploadedImageUrl = '';
    const fileInput = document.getElementById('modal-image-file');
    const file = fileInput.files[0];

    // 1. Upload ảnh trực tiếp nếu có
    if (file && sbClient) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { data, error: uploadErr } = await sbClient.storage
        .from('stack-assets')
        .upload(fileName, file);

      if (!uploadErr) {
        const { data: publicUrlData } = sbClient.storage
          .from('stack-assets')
          .getPublicUrl(fileName);
        uploadedImageUrl = publicUrlData.publicUrl;
      } else {
        console.error("Lỗi upload ảnh:", uploadErr.message);
      }
    }

    // 2. Insert vào bảng stack_posts
    const postPayload = {
      author: document.getElementById('modal-author').value || 'HaRif',
      designer: document.getElementById('modal-designer').value || '--',
      title: document.getElementById('modal-title').value || 'Không có tiêu đề',
      content: document.getElementById('modal-content').value || '',
      img_url: uploadedImageUrl,
      note: document.getElementById('modal-note').value || '--',
      schedule_note: document.getElementById('modal-schedule-note').value || '--',
      status: 'unapproved'
    };

    const { error: insertErr } = await sbClient.from('stack_posts').insert([postPayload]);

    if (insertErr) {
      alert("Lỗi khi đẩy vào Stack: " + insertErr.message);
    } else {
      pushModal.classList.remove('active');
      alert(`ĐÃ ĐẨY BÀI "${postPayload.title}" VÀO STACK THÀNH CÔNG!`);
    }
  } catch (err) {
    console.error(err);
    alert("Có lỗi xảy ra khi đẩy bài.");
  } finally {
    submitBtn.innerText = 'XÁC NHẬN ĐẨY VÀO STACK';
    submitBtn.disabled = false;
  }
};

// 7. XỬ LÝ GIAO DIỆN MOBILE SIDEBAR
const sidebar = document.getElementById('docs-sidebar');
const backdrop = document.getElementById('sidebar-backdrop');

function openMobileSidebar() {
  sidebar.classList.add('open');
  backdrop.classList.add('active');
}

function closeMobileSidebar() {
  sidebar.classList.remove('open');
  backdrop.classList.remove('active');
}

document.getElementById('btn-toggle-sidebar').onclick = openMobileSidebar;
document.getElementById('btn-close-sidebar').onclick = closeMobileSidebar;
backdrop.onclick = closeMobileSidebar;

// Khởi chạy khi vào trang
loadActiveDraft();