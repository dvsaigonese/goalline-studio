document.addEventListener('DOMContentLoaded', () => {
  // 1. Đồng bộ 2 chiều giữa Range Slider và Ô nhập số của Scale
  const rangeScale = document.getElementById('global-scale');
  const numScale = document.getElementById('scale-number');

  if (rangeScale && numScale) {
    rangeScale.addEventListener('input', (e) => {
      numScale.value = e.target.value;
    });

    numScale.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (!isNaN(val)) {
        rangeScale.value = val;
        // Bắn sự kiện input để canvas re-scale theo handler của board.js
        rangeScale.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
  }

  // 2. Hiệu ứng active visual cho nút vẽ mũi tên & polygon
  const arrowToggle = document.getElementById('draw-arrow-input');
  const polygonToggle = document.getElementById('draw-polygon-input');

  const updateToolState = () => {
    const arrowLabel = document.querySelector('label[for="draw-arrow-input"]');
    const polygonLabel = document.querySelector('label[for="draw-polygon-input"]');

    if (arrowLabel) {
      arrowLabel.style.background = arrowToggle?.checked ? '#00f076' : '';
    }
    if (polygonLabel) {
      polygonLabel.style.background = polygonToggle?.checked ? '#00f076' : '';
    }
  };

  arrowToggle?.addEventListener('change', updateToolState);
  polygonToggle?.addEventListener('change', updateToolState);

  // 3. Tự động đóng modal sau khi click tùy chọn (nếu board.js chưa đóng)
  const templateBtn = document.getElementById('btn-template-mode');
  const customInput = document.getElementById('custom-img-input');
  const startupModal = document.getElementById('startup-modal');

  templateBtn?.addEventListener('click', () => {
    if (startupModal) startupModal.style.display = 'none';
  });

  customInput?.addEventListener('change', () => {
    if (startupModal) startupModal.style.display = 'none';
  });
});

/**
 * Bảng màu Neobrutalism tương thích Canvas rendering (nếu cần import vào file vẽ hình)
 */
export const NEO_CANVAS_THEME = {
  playerBorderColor: '#000000',
  playerBorderWidth: 4,
  arrowStrokeWidth: 5,
  arrowColors: {
    white: '#ffffff',
    red: '#ff608b',
    yellow: '#ffe600'
  },
  pitchGrassDark: '#1d8348',
  pitchGrassLight: '#229954',
  pitchLineColor: '#ffffff'
};