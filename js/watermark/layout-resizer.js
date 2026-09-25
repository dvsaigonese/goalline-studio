export class LayoutResizer {
  constructor(canvas, collageState, onRatioChange) {
    this.canvas = canvas;
    this.collageState = collageState;
    this.onRatioChange = onRatioChange;
    this.isDragging = false;
    this.dragMode = null; 
    this.dividerThreshold = 25; 

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

    ctx.save();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#000000';

    if (mode === 'v') {
      const splitX = slots[0].w * W;
      const p1 = Math.round(slots[0].w * 100);
      const p2 = 100 - p1;

      ctx.beginPath();
      ctx.moveTo(splitX, 0);
      ctx.lineTo(splitX, H);
      ctx.stroke();

      const bW = 120;
      const bH = 36;
      const bX = splitX - bW / 2;
      const bY = H / 2 - bH / 2;

      ctx.fillStyle = '#000000';
      ctx.fillRect(bX + 4, bY + 4, bW, bH);
      ctx.fillStyle = '#ffe600';
      ctx.fillRect(bX, bY, bW, bH);
      ctx.strokeRect(bX, bY, bW, bH);

      ctx.fillStyle = '#000000';
      ctx.font = '900 16px "JetBrains Mono", monospace';
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

      const bW = 120;
      const bH = 36;
      const bX = W / 2 - bW / 2;
      const bY = splitY - bH / 2;

      ctx.fillStyle = '#000000';
      ctx.fillRect(bX + 4, bY + 4, bW, bH);
      ctx.fillStyle = '#ffe600';
      ctx.fillRect(bX, bY, bW, bH);
      ctx.strokeRect(bX, bY, bW, bH);

      ctx.fillStyle = '#000000';
      ctx.font = '900 16px "JetBrains Mono", monospace';
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
      if (mode === 'v') {
        const splitX = slots[0].w * this.canvas.width;
        if (Math.abs(pos.x - splitX) < this.dividerThreshold) return 'v';
      } else if (mode === 'h') {
        const splitY = slots[0].h * this.canvas.height;
        if (Math.abs(pos.y - splitY) < this.dividerThreshold) return 'h';
      }
      return null;
    };

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