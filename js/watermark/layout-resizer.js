export class LayoutResizer {
  constructor(canvas, collageState, onRatioChange) {
    this.canvas = canvas;
    this.collageState = collageState;
    this.onRatioChange = onRatioChange;
    this.isDragging = false;
    this.dragMode = null; 

    this.initEvents();
  }

  detectSplitMode() {
    const slots = this.collageState?.slots;
    if (!slots || slots.length !== 2) return null;

    if (Math.abs(slots[0].y - slots[1].y) < 0.01 && Math.abs(slots[0].h - 1) < 0.01) {
      return 'v';
    }
    if (Math.abs(slots[0].x - slots[1].x) < 0.01 && Math.abs(slots[0].w - 1) < 0.01) {
      return 'h';
    }
    return null;
  }

  drawDivider(ctx) {
    const mode = this.detectSplitMode();
    if (!mode) return;

    const slots = this.collageState.slots;
    const W = this.canvas.width;
    const H = this.canvas.height;

    // Tự động scale kích thước theo độ phân giải thực của Canvas
    const baseScale = Math.max(1, W / 800);
    const bW = Math.round(200 * baseScale);
    const bH = Math.round(60 * baseScale);
    const fontSize = Math.round(26 * baseScale);
    const borderWidth = Math.round(4 * baseScale);
    const shadowOffset = Math.round(6 * baseScale);

    ctx.save();
    ctx.lineWidth = Math.max(4, Math.round(5 * baseScale));
    ctx.strokeStyle = '#000000';

    if (mode === 'v') {
      const splitX = slots[0].w * W;
      const p1 = Math.round(slots[0].w * 100);
      const p2 = 100 - p1;

      // Vạch chia
      ctx.beginPath();
      ctx.moveTo(splitX, 0);
      ctx.lineTo(splitX, H);
      ctx.stroke();

      // Vị trí Badge ở trung tâm vạch chia
      const bX = splitX - bW / 2;
      const bY = H / 2 - bH / 2;

      // 1. Đổ bóng cứng Neobrutalism
      ctx.fillStyle = '#000000';
      ctx.fillRect(bX + shadowOffset, bY + shadowOffset, bW, bH);

      // 2. Nền vàng và viền đen dày
      ctx.fillStyle = '#ffe600';
      ctx.fillRect(bX, bY, bW, bH);
      ctx.lineWidth = borderWidth;
      ctx.strokeRect(bX, bY, bW, bH);

      // 3. Chữ % to rõ
      ctx.fillStyle = '#000000';
      ctx.font = `900 ${fontSize}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${p1}% : ${p2}%`, splitX, H / 2);

    } else if (mode === 'h') {
      const splitY = slots[0].h * H;
      const p1 = Math.round(slots[0].h * 100);
      const p2 = 100 - p1;

      ctx.beginPath();
      ctx.moveTo(0, splitY);
      ctx.lineTo(W, splitY);
      ctx.stroke();

      const bX = W / 2 - bW / 2;
      const bY = splitY - bH / 2;

      ctx.fillStyle = '#000000';
      ctx.fillRect(bX + shadowOffset, bY + shadowOffset, bW, bH);

      ctx.fillStyle = '#ffe600';
      ctx.fillRect(bX, bY, bW, bH);
      ctx.lineWidth = borderWidth;
      ctx.strokeRect(bX, bY, bW, bH);

      ctx.fillStyle = '#000000';
      ctx.font = `900 ${fontSize}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${p1}% : ${p2}%`, W / 2, splitY);
    }

    ctx.restore();
  }

  initEvents() {
    const getPos = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
      };
    };

    const isNearDivider = (pos) => {
      const mode = this.detectSplitMode();
      if (!mode) return null;

      const slots = this.collageState.slots;
      const W = this.canvas.width;
      const H = this.canvas.height;
      const baseScale = Math.max(1, W / 800);
      const lineThreshold = Math.round(30 * baseScale);
      const bW = Math.round(200 * baseScale);
      const bH = Math.round(60 * baseScale);

      if (mode === 'v') {
        const splitX = slots[0].w * W;
        // Bắt chuột khi rê trúng vạch chia HOẶC trúng vào ô badge %
        const isOverBadge = Math.abs(pos.x - splitX) <= bW / 2 && Math.abs(pos.y - H / 2) <= bH / 2;
        if (Math.abs(pos.x - splitX) < lineThreshold || isOverBadge) return 'v';
      } else if (mode === 'h') {
        const splitY = slots[0].h * H;
        const isOverBadge = Math.abs(pos.y - splitY) <= bH / 2 && Math.abs(pos.x - W / 2) <= bW / 2;
        if (Math.abs(pos.y - splitY) < lineThreshold || isOverBadge) return 'h';
      }
      return null;
    };

    // Chặn pan ảnh khi đang tương tác kéo divider / badge
    this.canvas.addEventListener('mousedown', (e) => {
      const pos = getPos(e);
      const near = isNearDivider(pos);
      if (near) {
        this.isDragging = true;
        this.dragMode = near;
        e.stopImmediatePropagation();
      }
    }, true);

    window.addEventListener('mousemove', (e) => {
      const pos = getPos(e);
      if (!this.isDragging) {
        const near = isNearDivider(pos);
        if (near === 'v') {
          this.canvas.style.cursor = 'col-resize';
        } else if (near === 'h') {
          this.canvas.style.cursor = 'row-resize';
        } else if (!this.canvas.classList.contains('editing')) {
          this.canvas.style.cursor = '';
        }
        return;
      }

      const slots = this.collageState.slots;
      if (this.dragMode === 'v') {
        const ratio = Math.max(0.15, Math.min(0.85, pos.x / this.canvas.width));
        slots[0].w = ratio;
        slots[1].x = ratio;
        slots[1].w = 1 - ratio;
      } else if (this.dragMode === 'h') {
        const ratio = Math.max(0.15, Math.min(0.85, pos.y / this.canvas.height));
        slots[0].h = ratio;
        slots[1].y = ratio;
        slots[1].h = 1 - ratio;
      }

      if (this.onRatioChange) this.onRatioChange();
    });

    window.addEventListener('mouseup', () => {
      if (this.isDragging) {
        this.isDragging = false;
        this.dragMode = null;
        this.canvas.style.cursor = '';
      }
    });
  }
}