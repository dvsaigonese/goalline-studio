// js/watermark/layout-resizer.js
export class LayoutResizer {
  constructor(canvas, collageState, onRatioChange) {
    this.canvas = canvas;
    this.collageState = collageState;
    this.onRatioChange = onRatioChange;
    this.isDragging = false;
    this.dragAxis = null; // 'x' | 'y'

    this.initEvents();
  }

  /**
   * Trả về thông tin các trục chia hiện tại trên Canvas
   */
  getSplitAxes() {
    const slots = this.collageState?.slots;
    if (!slots || slots.length < 2) return { xSplit: null, ySplit: null };

    const layoutMode = document.getElementById('layout-mode')?.value || 'single';

    if (slots.length === 2) {
      if (Math.abs(slots[0].y - slots[1].y) < 0.01 && Math.abs(slots[0].h - 1) < 0.01) {
        return { xSplit: slots[0].w, ySplit: null, mode: '2v' };
      }
      if (Math.abs(slots[0].x - slots[1].x) < 0.01 && Math.abs(slots[0].w - 1) < 0.01) {
        return { xSplit: null, ySplit: slots[0].h, mode: '2h' };
      }
    } else if (slots.length === 3) {
      if (layoutMode === 't-top') {
        return { xSplit: slots[1].w, ySplit: slots[0].h, mode: 't-top' };
      }
      if (layoutMode === 't-bottom') {
        return { xSplit: slots[0].w, ySplit: slots[0].h, mode: 't-bottom' };
      }
      if (layoutMode === 'hero-left') {
        return { xSplit: slots[0].w, ySplit: slots[1].h, mode: 'hero-left' };
      }
    } else if (slots.length === 4 && layoutMode === 'quad') {
      return { xSplit: slots[0].w, ySplit: slots[0].h, mode: 'quad' };
    }

    return { xSplit: null, ySplit: null, mode: null };
  }

  /**
   * Vẽ đường kẻ ngăn cách sạch sẽ giữa các ô ảnh (hiển thị cả trên bản Export nếu dividerLineWidth > 0)
   */
  drawCleanDividers(ctx) {
    const lineW = parseFloat(this.collageState?.dividerLineWidth) || 0;
    const slots = this.collageState?.slots;
    if (lineW <= 0 || !slots || slots.length < 2) return;

    const W = this.canvas.width;
    const H = this.canvas.height;

    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = lineW;

    slots.forEach(s => {
      const sx = s.x * W;
      const sy = s.y * H;
      const sw = s.w * W;
      const sh = s.h * H;
      ctx.strokeRect(sx, sy, sw, sh);
    });
    ctx.restore();
  }

  /**
   * Vẽ thanh kéo & Badge % khi đang thiết kế trên Canvas (ẩn khi Export)
   */
  drawDivider(ctx) {
    const { xSplit, ySplit, mode } = this.getSplitAxes();
    if (!mode) return;

    const W = this.canvas.width;
    const H = this.canvas.height;
    const baseScale = Math.max(0.85, W / 1000);
    const bW = Math.round(165 * baseScale);
    const bH = Math.round(48 * baseScale);
    const fontSize = Math.round(21 * baseScale);
    const borderWidth = Math.round(3.5 * baseScale);
    const shadowOffset = Math.round(5 * baseScale);

    ctx.save();
    ctx.lineWidth = Math.max(3, Math.round(4 * baseScale));
    ctx.strokeStyle = '#000000';

    const drawBadge = (cx, cy, text) => {
      const bX = cx - bW / 2;
      const bY = cy - bH / 2;
      ctx.fillStyle = '#000000';
      ctx.fillRect(bX + shadowOffset, bY + shadowOffset, bW, bH);
      ctx.fillStyle = '#ffe600';
      ctx.fillRect(bX, bY, bW, bH);
      ctx.lineWidth = borderWidth;
      ctx.strokeStyle = '#000000';
      ctx.strokeRect(bX, bY, bW, bH);
      ctx.fillStyle = '#000000';
      ctx.font = `900 ${fontSize}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, cx, cy);
    };

    if (xSplit !== null) {
      const sx = xSplit * W;
      const p1 = Math.round(xSplit * 100);
      let yStart = 0, yEnd = H, badgeY = H * 0.5;

      if (mode === 't-top' && ySplit !== null) {
        yStart = ySplit * H;
        badgeY = yStart + (H - yStart) * 0.5;
      } else if (mode === 't-bottom' && ySplit !== null) {
        yEnd = ySplit * H;
        badgeY = yEnd * 0.5;
      } else if (mode === 'quad') {
        badgeY = H * 0.25;
      }

      ctx.beginPath();
      ctx.moveTo(sx, yStart);
      ctx.lineTo(sx, yEnd);
      ctx.stroke();
      drawBadge(sx, badgeY, `${p1}%:${100 - p1}%`);
    }

    if (ySplit !== null) {
      const sy = ySplit * H;
      const p1 = Math.round(ySplit * 100);
      let xStart = 0, xEnd = W, badgeX = W * 0.5;

      if (mode === 'hero-left' && xSplit !== null) {
        xStart = xSplit * W;
        badgeX = xStart + (W - xStart) * 0.5;
      } else if (mode === 'quad') {
        badgeX = W * 0.25;
      }

      ctx.beginPath();
      ctx.moveTo(xStart, sy);
      ctx.lineTo(xEnd, sy);
      ctx.stroke();
      drawBadge(badgeX, sy, `${p1}%:${100 - p1}%`);
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

    const hitTestAxis = (pos) => {
      const { xSplit, ySplit, mode } = this.getSplitAxes();
      if (!mode) return null;

      const W = this.canvas.width;
      const H = this.canvas.height;
      const threshold = Math.round(28 * Math.max(1, W / 900));

      if (xSplit !== null && Math.abs(pos.x - xSplit * W) <= threshold) {
        if (mode === 't-top' && pos.y < ySplit * H) return null;
        if (mode === 't-bottom' && pos.y > ySplit * H) return null;
        return 'x';
      }
      if (ySplit !== null && Math.abs(pos.y - ySplit * H) <= threshold) {
        if (mode === 'hero-left' && pos.x < xSplit * W) return null;
        return 'y';
      }
      return null;
    };

    this.canvas.addEventListener('mousedown', (e) => {
      const pos = getPos(e);
      const axis = hitTestAxis(pos);
      if (axis) {
        this.isDragging = true;
        this.dragAxis = axis;
        e.stopImmediatePropagation();
      }
    }, true);

    window.addEventListener('mousemove', (e) => {
      const pos = getPos(e);
      if (!this.isDragging) {
        const axis = hitTestAxis(pos);
        if (axis === 'x') this.canvas.style.cursor = 'col-resize';
        else if (axis === 'y') this.canvas.style.cursor = 'row-resize';
        else if (!this.canvas.classList.contains('editing')) this.canvas.style.cursor = '';
        return;
      }

      const { mode } = this.getSplitAxes();
      const slots = this.collageState.slots;
      const rx = Math.max(0.18, Math.min(0.82, pos.x / this.canvas.width));
      const ry = Math.max(0.18, Math.min(0.82, pos.y / this.canvas.height));

      if (mode === '2v' && this.dragAxis === 'x') {
        slots[0].w = rx;
        slots[1].x = rx;
        slots[1].w = 1 - rx;
      } else if (mode === '2h' && this.dragAxis === 'y') {
        slots[0].h = ry;
        slots[1].y = ry;
        slots[1].h = 1 - ry;
      } else if (mode === 't-top') {
        if (this.dragAxis === 'y') {
          slots[0].h = ry;
          slots[1].y = ry; slots[1].h = 1 - ry;
          slots[2].y = ry; slots[2].h = 1 - ry;
        } else if (this.dragAxis === 'x') {
          slots[1].w = rx;
          slots[2].x = rx; slots[2].w = 1 - rx;
        }
      } else if (mode === 't-bottom') {
        if (this.dragAxis === 'y') {
          slots[0].h = ry;
          slots[1].h = ry;
          slots[2].y = ry; slots[2].h = 1 - ry;
        } else if (this.dragAxis === 'x') {
          slots[0].w = rx;
          slots[1].x = rx; slots[1].w = 1 - rx;
        }
      } else if (mode === 'hero-left') {
        if (this.dragAxis === 'x') {
          slots[0].w = rx;
          slots[1].x = rx; slots[1].w = 1 - rx;
          slots[2].x = rx; slots[2].w = 1 - rx;
        } else if (this.dragAxis === 'y') {
          slots[1].h = ry;
          slots[2].y = ry; slots[2].h = 1 - ry;
        }
      } else if (mode === 'quad') {
        if (this.dragAxis === 'x') {
          slots[0].w = rx; slots[2].w = rx;
          slots[1].x = rx; slots[1].w = 1 - rx;
          slots[3].x = rx; slots[3].w = 1 - rx;
        } else if (this.dragAxis === 'y') {
          slots[0].h = ry; slots[1].h = ry;
          slots[2].y = ry; slots[2].h = 1 - ry;
          slots[3].y = ry; slots[3].h = 1 - ry;
        }
      }

      if (this.onRatioChange) this.onRatioChange();
    });

    window.addEventListener('mouseup', () => {
      if (this.isDragging) {
        this.isDragging = false;
        this.dragAxis = null;
        this.canvas.style.cursor = '';
      }
    });
  }
}