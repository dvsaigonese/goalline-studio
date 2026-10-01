// js/theme.js
(function () {
  // 1. Kiểm tra trạng thái lưu trong máy
  const savedTheme = localStorage.getItem('gl_theme');
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-mode');
  }

  // 2. Hàm chuyển đổi theme
  window.toggleDarkMode = function () {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('gl_theme', isDark ? 'dark' : 'light');
    updateThemeIcon();
  };

  function updateThemeIcon() {
    const icon = document.getElementById('theme-toggle-icon');
    if (!icon) return;
    if (document.body.classList.contains('dark-mode')) {
      icon.className = 'fa-solid fa-sun';
      icon.style.color = '#ffe600';
    } else {
      icon.className = 'fa-solid fa-moon';
      icon.style.color = 'inherit';
    }
  }

  // Cập nhật icon khi trang tải xong
  window.addEventListener('DOMContentLoaded', updateThemeIcon);
})();