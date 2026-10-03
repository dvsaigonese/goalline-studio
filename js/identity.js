// js/identity.js

const GL_TEAM_MEMBERS = [
  'Maztermind', 'Vinci', 'Voet', 'Quýt', 'Tiryth', 'Tizzy', 'Nikolaj', 
  'Cakashi', 'Nedu', 'Terry', 'Naruto', 'Ruben', 'Dante', 'Daugust', 
  'Draco', 'Harif', 'Giáo 5ư', 'Tom', 'Brunson', 'Vate', 'Zenriot', 
  'Kaiz', 'Metis', 'Genie', 'Dmoney'
];

function getStoredUser() {
  return localStorage.getItem('gl_current_user');
}

function setStoredUser(name) {
  localStorage.setItem('gl_current_user', name);
  updateIdentityUI(name);
  // Phát tín hiệu để các trang như schedule render lại ca trực ngay lập tức
  window.dispatchEvent(new CustomEvent('identityChanged', { detail: { user: name } }));
}

function updateIdentityUI(name) {
  if (!name) return;
  const displayEls = document.querySelectorAll('#current-user-display, .current-user-text');
  displayEls.forEach(el => {
    el.innerText = `ADMIN: ${name.toUpperCase()}`;
  });

  const inputAuthor = document.getElementById('input-author');
  if (inputAuthor) inputAuthor.value = name;
}

function injectIdentityModal() {
  if (document.getElementById('global-identity-modal')) return;

  const modalHtml = `
    <div class="neo-modal-overlay" id="global-identity-modal" style="z-index: 999999; display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.85); align-items: center; justify-content: center; padding: 16px;">
      <div class="neo-modal" style="max-width: 520px; background: #fff; border: 3px solid #000; box-shadow: 8px 8px 0 #000; width: 100%;">
        <div class="modal-header" style="background: var(--neo-yellow, #ffe600); display: flex; justify-content: space-between; align-items: center; padding: 14px 18px; border-bottom: 3px solid #000;">
          <h3 id="id-modal-title" style="margin: 0; font-family: var(--font-cond, sans-serif); font-weight: 900; font-size: 1.25rem;">
            <i class="fa-solid fa-id-card"></i> BẠN LÀ AI TRONG GOAL-LINE?
          </h3>
          <button type="button" id="btn-close-id-modal" style="background: none; border: none; font-size: 1.6rem; cursor: pointer; font-weight: 900; line-height: 1;">&times;</button>
        </div>
        <div class="modal-body" style="padding: 18px; max-height: 70vh; overflow-y: auto;">
          <p id="id-modal-desc" style="font-size: 0.88rem; font-weight: 700; color: #444; margin-bottom: 14px;">
            Chọn định danh của bạn để hệ thống tự điền khi duyệt bài, nhận ca trực và đồng bộ:
          </p>
          <div id="identity-chips-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 8px;">
            ${GL_TEAM_MEMBERS.map(m => `
              <button type="button" class="btn-select-member" data-name="${m}" style="
                background: #fff;
                border: 2px solid #000;
                box-shadow: 2px 2px 0 #000;
                padding: 8px 6px;
                font-family: var(--font-cond, sans-serif);
                font-weight: 900;
                font-size: 1rem;
                cursor: pointer;
                transition: all 0.1s;
                text-align: center;
              ">${m}</button>
            `).join('')}
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  document.getElementById('btn-close-id-modal').onclick = () => {
    // Nếu chưa từng có user trong máy thì không cho đóng bằng nút X
    if (!getStoredUser()) return;
    document.getElementById('global-identity-modal').style.display = 'none';
  };

  document.querySelectorAll('.btn-select-member').forEach(btn => {
    btn.onclick = () => {
      const selected = btn.dataset.name;
      setStoredUser(selected);
      document.getElementById('global-identity-modal').style.display = 'none';
    };
  });
}

// Hàm mở Modal (hỗ trợ cờ forced)
window.openIdentitySelector = function (forced = false) {
  injectIdentityModal();
  const current = getStoredUser();
  const modal = document.getElementById('global-identity-modal');
  const closeBtn = document.getElementById('btn-close-id-modal');
  const title = document.getElementById('id-modal-title');
  const desc = document.getElementById('id-modal-desc');

  if (forced) {
    // Ép buộc: Giấu nút đóng, đổi thông báo
    closeBtn.style.display = 'none';
    title.innerHTML = '<i class="fa-solid fa-lock"></i> XÁC NHẬN ĐỊNH DANH ĐỂ TIẾP TỤC';
    desc.innerText = 'Chào mừng bạn đến với Goal-Line Studio! Vui lòng chọn tài khoản của bạn để vào làm việc:';
  } else {
    // Đổi tên bình thường: Hiện nút đóng
    closeBtn.style.display = 'block';
    title.innerHTML = '<i class="fa-solid fa-id-card"></i> BẠN LÀ AI TRONG GOAL-LINE?';
    desc.innerText = 'Chọn định danh của bạn để hệ thống tự điền khi duyệt bài, nhận ca trực và đồng bộ:';
  }

  document.querySelectorAll('.btn-select-member').forEach(btn => {
    btn.style.background = (current && btn.dataset.name.toLowerCase() === current.toLowerCase())
      ? 'var(--neo-green, #00f076)' 
      : '#fff';
  });

  if (modal) modal.style.display = 'flex';
};

// Khởi chạy khi tải trang
document.addEventListener('DOMContentLoaded', () => {
  const user = getStoredUser();

  if (!user) {
    // THIẾT BỊ MỚI / CHƯA ĐỊNH DANH: Ép chọn ngay lập tức
    window.openIdentitySelector(true);
  } else {
    updateIdentityUI(user);
  }

  // Tự động gắn sự kiện cho mọi nút đổi tên nếu có sẵn trên giao diện
  const changeBtn = document.getElementById('btn-change-identity');
  if (changeBtn) {
    changeBtn.onclick = () => window.openIdentitySelector(false);
  }
});

// ==========================================
// ĐỒNG BỘ DARK MODE TOÀN HỆ THỐNG
// ==========================================
function applyCurrentTheme() {
  const isDark = localStorage.getItem('gl_theme') === 'dark';
  const icon = document.getElementById('theme-toggle-icon');

  if (isDark) {
    document.body.classList.add('dark-mode');
    if (icon) {
      icon.classList.remove('fa-moon');
      icon.classList.add('fa-sun');
      icon.style.color = '#ffe600';
    }
  } else {
    document.body.classList.remove('dark-mode');
    if (icon) {
      icon.classList.remove('fa-sun');
      icon.classList.add('fa-moon');
      icon.style.color = '';
    }
  }
}

window.toggleDarkMode = function () {
  const isCurrentlyDark = document.body.classList.contains('dark-mode');
  if (isCurrentlyDark) {
    localStorage.setItem('gl_theme', 'light');
  } else {
    localStorage.setItem('gl_theme', 'dark');
  }
  applyCurrentTheme();
};

// Khởi chạy ngay khi tải bất kỳ trang nào
applyCurrentTheme();