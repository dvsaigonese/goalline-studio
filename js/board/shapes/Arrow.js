// js/board/shapes/Arrow.js
import { generateId } from '../utils.js';

export class Arrow {
    constructor(fromX, fromY, toX, toY, color, type = "solid", isArrow = true, cx, cy, id = null) {
        this.id = id || ('arr_' + generateId());
        this.fromX = fromX;
        this.fromY = fromY;
        this.toX = toX;
        this.toY = toY;
        this.cx = cx !== undefined ? cx : (fromX + toX) / 2;
        this.cy = cy !== undefined ? cy : (fromY + toY) / 2;
        this.color = color;
        this.type = type;
        this.isArrow = isArrow;
    }

    clone() {
        return new Arrow(
            this.fromX, this.fromY, this.toX, this.toY,
            this.color, this.type, this.isArrow, this.cx, this.cy, this.id
        );
    }

    draw(ctx, responsiveConstant = 1, isSelected = false, userScale = 1.0, progress = 1.0) {
        if (progress <= 0.01) return;

        const headlen = 13 * responsiveConstant * userScale;
        const lineWidth = 3 * responsiveConstant * userScale;

        // Chia nhỏ đường cong Bezier theo progress (0 -> 1) bằng thuật toán De Casteljau
        const p0x = this.fromX, p0y = this.fromY;
        const p1x = p0x + (this.cx - p0x) * progress;
        const p1y = p0y + (this.cy - p0y) * progress;

        const q1x = this.cx + (this.toX - this.cx) * progress;
        const q1y = this.cy + (this.toY - this.cy) * progress;

        const endX = p1x + (q1x - p1x) * progress;
        const endY = p1y + (q1y - p1y) * progress;

        const angle = Math.atan2(endY - p1y, endX - p1x);

        ctx.save();
        ctx.beginPath();

        if (this.type === "dash") {
            ctx.setLineDash([15 * responsiveConstant * userScale, 15 * responsiveConstant * userScale]);
        } else {
            ctx.setLineDash([]);
        }

        ctx.moveTo(p0x, p0y);
        ctx.quadraticCurveTo(p1x, p1y, endX, endY);

        ctx.strokeStyle = this.color;
        ctx.fillStyle = this.color;
        ctx.lineWidth = lineWidth;
        ctx.stroke();

        if (this.isArrow) {
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.moveTo(endX, endY);
            ctx.lineTo(
                endX - headlen * Math.cos(angle - Math.PI / 6),
                endY - headlen * Math.sin(angle - Math.PI / 6)
            );
            ctx.lineTo(
                endX - headlen * Math.cos(angle + Math.PI / 6),
                endY - headlen * Math.sin(angle + Math.PI / 6)
            );
            ctx.closePath();
            ctx.stroke();
            ctx.fill();
        }

        if (isSelected && progress >= 0.99) {
            this.drawHandle(ctx, this.fromX, this.fromY, responsiveConstant, userScale);
            this.drawHandle(ctx, this.toX, this.toY, responsiveConstant, userScale);
            this.drawHandle(ctx, this.cx, this.cy, responsiveConstant, userScale, 'gold');

            ctx.beginPath();
            ctx.setLineDash([5, 5]);
            ctx.lineWidth = 1;
            ctx.strokeStyle = "rgba(150, 150, 150, 0.6)";
            ctx.moveTo(this.fromX, this.fromY);
            ctx.lineTo(this.cx, this.cy);
            ctx.lineTo(this.toX, this.toY);
            ctx.stroke();
        }
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
        const threshold = 10 * userScale;
        const steps = 20;
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
            a2.id
        );
    }
}