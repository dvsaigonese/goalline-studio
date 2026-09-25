export class CoverageGuard {
  constructor(canvas) {
    this.canvas = canvas;
    this.hudElement = null;
    this.initHUD();
  }

  initHUD() {
    let hud = document.getElementById('coverage-warning-hud');
    if (!hud) {
      hud = document.createElement('div');
      hud.id = 'coverage-warning-hud';
      hud.className = 'coverage-hud hidden';
      document.body.appendChild(hud);
    }
    this.hudElement = hud;
  }

  // Hàm kiểm tra chính
  checkAndRender(ctx, slots) {
    if (!slots || !slots.length) {
      if (this.hudElement) this.hudElement.classList.add('hidden');
      return;
    }

    let hasAnyGap = false;
    const warningLabels = [];

    slots.forEach((slot, index) => {
      if (!slot.img) return;

      const slotX = slot.x * this.canvas.width;
      const slotY = slot.y * this.canvas.height;
      const slotW = slot.w * this.canvas.width;
      const slotH = slot.h * this.canvas.height;

      const scale = slot.scale || 1;
      const offsetX = slot.offsetX || 0;
      const offsetY = slot.offsetY || 0;

      const imgW = slot.img.naturalWidth * scale;
      const imgH = slot.img.naturalHeight * scale;
      const centerX = slotX + slotW / 2;
      const centerY = slotY + slotH / 2;

      const drawX = centerX - imgW / 2 + (offsetX * scale);
      const drawY = centerY - imgH / 2 + (offsetY * scale);

      const tolerance = 1.0;
      const gaps = {
        left: drawX > slotX + tolerance,
        right: (drawX + imgW) < (slotX + slotW) - tolerance,
        top: drawY > slotY + tolerance,
        bottom: (drawY + imgH) < (slotY + slotH) - tolerance
      };

      const isCovered = !gaps.left && !gaps.right && !gaps.top && !gaps.bottom;

      if (!isCovered) {
        hasAnyGap = true;
        const slotName = slots.length > 1 ? `SLOT ${index + 1}` : 'FRAME';
        const sides = [];
        if (gaps.left) sides.push('LEFT');
        if (gaps.right) sides.push('RIGHT');
        if (gaps.top) sides.push('TOP');
        if (gaps.bottom) sides.push('BOTTOM');

        warningLabels.push(`${slotName}: UNCOVERED [${sides.join(' & ')}]`);

        // Vẽ viền nét đứt cảnh báo màu đỏ Neobrutalism
        ctx.save();
        ctx.lineWidth = 8;
        ctx.strokeStyle = '#ef4444';
        ctx.setLineDash([16, 10]);

        if (gaps.left) {
          ctx.beginPath(); ctx.moveTo(slotX + 4, slotY); ctx.lineTo(slotX + 4, slotY + slotH); ctx.stroke();
        }
        if (gaps.right) {
          ctx.beginPath(); ctx.moveTo(slotX + slotW - 4, slotY); ctx.lineTo(slotX + slotW - 4, slotY + slotH); ctx.stroke();
        }
        if (gaps.top) {
          ctx.beginPath(); ctx.moveTo(slotX, slotY + 4); ctx.lineTo(slotX + slotW, slotY + 4); ctx.stroke();
        }
        if (gaps.bottom) {
          ctx.beginPath(); ctx.moveTo(slotX, slotY + slotH - 4); ctx.lineTo(slotX + slotW, slotY + slotH - 4); ctx.stroke();
        }
        ctx.restore();
      }
    });

    if (hasAnyGap && this.hudElement) {
      this.hudElement.innerHTML = `
        <div class="hud-alert-box">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <div>
            <strong>IMAGE NOT COVERING CANVAS:</strong>
            <span>${warningLabels.join(' | ')}</span>
          </div>
        </div>
      `;
      this.hudElement.classList.remove('hidden');
    } else if (this.hudElement) {
      this.hudElement.classList.add('hidden');
    }
  }

  // Alias dự phòng nếu code cũ gọi renderWarnings
  renderWarnings(ctx, slots) {
    return this.checkAndRender(ctx, slots);
  }
}