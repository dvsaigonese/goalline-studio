// js/board/shapes/Arrow.js
import { generateId } from '../utils.js';

export class Arrow {
    /**
     * @param {string} type - 'solid' (Chuyền) | 'dash' (Chạy chỗ) | 'wavy' (Dẫn bóng rê dắt) | 'double' (Xuyên tuyến)
     * @param {boolean|string} isArrow - true/'arrow' | 't-bar' (Chặn) | 'circle' (Điểm đích) | 'swap' (2 đầu) | false/'none'
     */
    constructor(fromX, fromY, toX, toY, color = "white", type = "solid", isArrow = "arrow", cx, cy, id = null, headType = null) {
        this.id = id || ('arr_' + generateId());
        this.fromX = fromX;
        this.fromY = fromY;
        this.toX = toX;
        this.toY = toY;
        this.cx = cx !== undefined ? cx : (fromX + toX) / 2;
        this.cy = cy !== undefined ? cy : (fromY + toY) / 2;
        this.color = color;
        this.type = type || "solid";

        // Tương thích ngược với biến boolean isArrow cũ
        if (headType) {
            this.headType = headType;
        } else if (typeof isArrow === 'string') {
            this.headType = isArrow;
        } else {
            this.headType = isArrow === false ? 'none' : 'arrow';
        }
        this.isArrow = this.headType !== 'none';
    }

    clone() {
        return new Arrow(
            this.fromX, this.fromY, this.toX, this.toY,
            this.color, this.type, this.isArrow, this.cx, this.cy, this.id, this.headType
        );
    }

    draw(ctx, responsiveConstant = 1, isSelected = false, userScale = 1.0, progress = 1.0) {
        if (progress <= 0.01) return;

        const headlen = 14 * responsiveConstant * userScale;
        const lineWidth = 3.2 * responsiveConstant * userScale;

        // Chia đường cong Bezier theo progress (De Casteljau)
        const p0x = this.fromX, p0y = this.fromY;
        const p1x = p0x + (this.cx - p0x) * progress;
        const p1y = p0y + (this.cy - p0y) * progress;
        const q1x = this.cx + (this.toX - this.cx) * progress;
        const q1y = this.cy + (this.toY - this.cy) * progress;
        const endX = p1x + (q1x - p1x) * progress;
        const endY = p1y + (q1y - p1y) * progress;

        const endAngle = Math.atan2(endY - p1y, endX - p1x);
        const startAngle = Math.atan2(p0y - p1y, p0x - p1x);

        ctx.save();
        ctx.strokeStyle = this.color;
        ctx.fillStyle = this.color;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        // 1. VẼ THÂN MŨI TÊN THEO KIỂU (SOLID / DASH / WAVY DRIBBLE / DOUBLE PASS)
        if (this.type === "wavy") {
            this.drawWavyBezier(ctx, p0x, p0y, p1x, p1y, endX, endY, responsiveConstant, userScale);
        } else if (this.type === "double") {
            this.drawDoubleBezier(ctx, p0x, p0y, p1x, p1y, endX, endY, responsiveConstant, userScale);
        } else {
            ctx.beginPath();
            if (this.type === "dash") {
                ctx.setLineDash([14 * responsiveConstant * userScale, 10 * responsiveConstant * userScale]);
            } else {
                ctx.setLineDash([]);
            }
            ctx.moveTo(p0x, p0y);
            ctx.quadraticCurveTo(p1x, p1y, endX, endY);
            ctx.stroke();
        }

        // 2. VẼ ĐẦU MÚT CHIẾN THUẬT (ARROW / T-BAR BLOCK / CIRCLE / SWAP 2 ĐẦU)
        ctx.setLineDash([]);
        const hType = this.headType || (this.isArrow ? 'arrow' : 'none');

        if (hType === 'arrow' || hType === 'swap') {
            this.drawTriangleHead(ctx, endX, endY, endAngle, headlen);
            if (hType === 'swap') {
                this.drawTriangleHead(ctx, p0x, p0y, startAngle, headlen);
            }
        } else if (hType === 't-bar') {
            // Chốt chặn Pressing / Rào cản (──|)
            const barLen = headlen * 0.95;
            const perpX = -Math.sin(endAngle) * barLen;
            const perpY = Math.cos(endAngle) * barLen;
            ctx.beginPath();
            ctx.lineWidth = lineWidth * 1.35;
            ctx.moveTo(endX - perpX, endY - perpY);
            ctx.lineTo(endX + perpX, endY + perpY);
            ctx.stroke();
        } else if (hType === 'circle') {
            // Điểm đích tròn (──●)
            ctx.beginPath();
            ctx.arc(endX, endY, headlen * 0.45, 0, Math.PI * 2);
            ctx.fill();
            ctx.lineWidth = 2 * responsiveConstant;
            ctx.strokeStyle = "#000";
            ctx.stroke();
        }

        // 3. VẼ ĐIỂM KÉO THẢ KHI ĐƯỢC CHỌN
        if (isSelected && progress >= 0.99) {
            this.drawHandle(ctx, this.fromX, this.fromY, responsiveConstant, userScale);
            this.drawHandle(ctx, this.toX, this.toY, responsiveConstant, userScale);
            this.drawHandle(ctx, this.cx, this.cy, responsiveConstant, userScale, 'gold');

            ctx.beginPath();
            ctx.setLineDash([5, 5]);
            ctx.lineWidth = 1;
            ctx.strokeStyle = "rgba(255, 230, 0, 0.7)";
            ctx.moveTo(this.fromX, this.fromY);
            ctx.lineTo(this.cx, this.cy);
            ctx.lineTo(this.toX, this.toY);
            ctx.stroke();
        }
        ctx.restore();
    }

    drawTriangleHead(ctx, tipX, tipY, angle, headlen) {
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(
            tipX - headlen * Math.cos(angle - Math.PI / 6),
            tipY - headlen * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
            tipX - headlen * Math.cos(angle + Math.PI / 6),
            tipY - headlen * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }

    /**
     * Vẽ đường lượn sóng hình sin dọc theo đường cong Quadratic Bezier (biểu thị pha Rê bóng / Dribble)
     */
    drawWavyBezier(ctx, x0, y0, cx, cy, x1, y1, responsiveConstant, userScale) {
        const approxLen = Math.hypot(cx - x0, cy - y0) + Math.hypot(x1 - cx, y1 - cy);
        const steps = Math.max(24, Math.min(140, Math.floor(approxLen / 3)));
        const waveAmp = 5.5 * responsiveConstant * userScale;
        const waveFreq = 0.24 / Math.max(0.4, responsiveConstant * userScale);

        ctx.beginPath();
        let distAcc = 0;
        let prevX = x0, prevY = y0;

        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const invT = 1 - t;
            const bx = invT * invT * x0 + 2 * invT * t * cx + t * t * x1;
            const by = invT * invT * y0 + 2 * invT * t * cy + t * t * y1;

            if (i > 0) {
                distAcc += Math.hypot(bx - prevX, by - prevY);
            }
            prevX = bx;
            prevY = by;

            // Tiếp tuyến đạo hàm bậc 1 của Quadratic Bezier
            const tx = 2 * invT * (cx - x0) + 2 * t * (x1 - cx);
            const ty = 2 * invT * (cy - y0) + 2 * t * (y1 - cy);
            const tLen = Math.hypot(tx, ty) || 1;
            const nx = -ty / tLen;
            const ny = tx / tLen;

            // Giảm biên độ sóng ở 2 đầu mút để nối vào mũi tên thật mượt
            const taper = Math.sin(t * Math.PI);
            const offset = Math.sin(distAcc * waveFreq) * waveAmp * Math.min(1, taper * 2.5);

            const wx = bx + nx * offset;
            const wy = by + ny * offset;

            if (i === 0) ctx.moveTo(wx, wy);
            else ctx.lineTo(wx, wy);
        }
        ctx.stroke();
    }

    /**
     * Vẽ đường đôi song song dọc theo Bezier (biểu thị đường chuyền xuyên tuyến / nâng bóng)
     */
    drawDoubleBezier(ctx, x0, y0, cx, cy, x1, y1, responsiveConstant, userScale) {
        const gap = 3.2 * responsiveConstant * userScale;
        const dx = x1 - x0;
        const dy = y1 - y0;
        const len = Math.hypot(dx, dy) || 1;
        const nx = (-dy / len) * gap;
        const ny = (dx / len) * gap;

        ctx.save();
        ctx.lineWidth = 2.2 * responsiveConstant * userScale;
        ctx.beginPath();
        ctx.moveTo(x0 + nx, y0 + ny);
        ctx.quadraticCurveTo(cx + nx, cy + ny, x1 + nx, y1 + ny);
        ctx.moveTo(x0 - nx, y0 - ny);
        ctx.quadraticCurveTo(cx - nx, cy - ny, x1 - nx, y1 - ny);
        ctx.stroke();
        ctx.restore();
    }

    drawHandle(ctx, x, y, responsiveConstant, userScale, fillColor = null) {
        ctx.beginPath();
        ctx.arc(x, y, 8 * responsiveConstant * userScale, 0, Math.PI * 2);
        ctx.fillStyle = fillColor || this.color;
        ctx.fill();
        ctx.strokeStyle = "white";
        ctx.lineWidth = 2 * userScale;
        ctx.stroke();
        ctx.closePath();
    }

    isHitBody(mx, my, userScale = 1.0) {
        const threshold = 12 * userScale;
        const steps = 24;
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const px = Math.pow(1 - t, 2) * this.fromX + 2 * (1 - t) * t * this.cx + Math.pow(t, 2) * this.toX;
            const py = Math.pow(1 - t, 2) * this.fromY + 2 * (1 - t) * t * this.cy + Math.pow(t, 2) * this.toY;
            if (Math.hypot(mx - px, my - py) <= threshold) return true;
        }
        return false;
    }

    isHitHandle(mx, my, pointType = 'from', responsiveConstant = 1, userScale = 1.0) {
        let targetX, targetY;
        if (pointType === 'from') { targetX = this.fromX; targetY = this.fromY; }
        else if (pointType === 'to') { targetX = this.toX; targetY = this.toY; }
        else if (pointType === 'control') { targetX = this.cx; targetY = this.cy; }

        const radius = 10 * responsiveConstant * userScale;
        return Math.hypot(mx - targetX, my - targetY) <= radius;
    }

    static interpolate(a1, a2, t) {
        const lerp = (v1, v2) => v1 + (v2 - v1) * t;
        return new Arrow(
            lerp(a1.fromX, a2.fromX),
            lerp(a1.fromY, a2.fromY),
            lerp(a1.toX, a2.toX),
            lerp(a1.toY, a2.toY),
            a2.color,
            a2.type,
            a2.isArrow,
            lerp(a1.cx, a2.cx),
            lerp(a1.cy, a2.cy),
            a2.id,
            a2.headType
        );
    }
}