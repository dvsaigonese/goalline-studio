// js/board/shapes/Polygon.js
import { CONFIG } from '../config.js';
import { generateId } from '../utils.js';
import { Highlight } from './Highlight.js';

export class Polygon {
    /**
     * @param {Array} points - Mảng tọa độ [{x, y}]
     * @param {string|null} id - ID định danh
     * @param {string} color - Mã màu Hex của vùng (VD: '#ffffff', '#ff2a5f', '#ffe600', '#00f076', '#00d2ff')
     * @param {string} fillStyle - 'solid' (Tô màu mờ) | 'hatched' (Kẻ sọc chéo chiến thuật) | 'outline' (Chỉ viền nét đứt)
     * @param {string} label - Nhãn chữ hiển thị ở trọng tâm đa giác (VD: 'ZONE 14', 'OVERLOAD')
     */
    constructor(points = [], id = null, color = "#ffffff", fillStyle = "solid", label = "") {
        this.id = id || ('poly_' + generateId());
        this.points = (points || []).map(p => ({ x: p.x, y: p.y }));
        this.color = color || "#ffffff";
        this.fillStyle = fillStyle || "solid";
        this.label = label || "";
    }

    clone() {
        return new Polygon(
            this.points.map(p => ({ x: p.x, y: p.y })),
            this.id,
            this.color,
            this.fillStyle,
            this.label
        );
    }

    draw(ctx, isSelected = false, userScale = 1.0, responsiveConstant = 1.0) {
        if (this.points.length < 1) return;

        ctx.save();

        // Tạo đường bao đa giác
        ctx.beginPath();
        ctx.moveTo(this.points[0].x, this.points[0].y);
        for (let i = 1; i < this.points.length; i++) {
            ctx.lineTo(this.points[i].x, this.points[i].y);
        }
        ctx.closePath();

        // 1. Tô nền vùng theo kiểu (Solid / Hatched Stripes / Outline)
        if (this.fillStyle === 'solid') {
            ctx.fillStyle = Highlight.hexToRgba(this.color, isSelected ? 0.38 : 0.26);
            ctx.fill();
        } else if (this.fillStyle === 'hatched' && this.points.length >= 3) {
            ctx.fillStyle = Highlight.hexToRgba(this.color, 0.12);
            ctx.fill();

            // Clip đa giác để vẽ các đường sọc chéo 45 độ bên trong
            ctx.save();
            ctx.clip();
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            this.points.forEach(p => {
                if (p.x < minX) minX = p.x;
                if (p.x > maxX) maxX = p.x;
                if (p.y < minY) minY = p.y;
                if (p.y > maxY) maxY = p.y;
            });

            const step = 14 * Math.max(0.6, userScale);
            const h = maxY - minY;
            ctx.beginPath();
            for (let x = minX - h; x <= maxX + h; x += step) {
                ctx.moveTo(x, minY);
                ctx.lineTo(x + h, maxY);
            }
            ctx.strokeStyle = Highlight.hexToRgba(this.color, 0.55);
            ctx.lineWidth = 2 * userScale;
            ctx.stroke();
            ctx.restore();
        }

        // 2. Vẽ viền đa giác
        ctx.beginPath();
        ctx.moveTo(this.points[0].x, this.points[0].y);
        for (let i = 1; i < this.points.length; i++) {
            ctx.lineTo(this.points[i].x, this.points[i].y);
        }
        ctx.closePath();
        if (this.fillStyle === 'outline') {
            ctx.setLineDash([8 * userScale, 6 * userScale]);
        }
        ctx.strokeStyle = isSelected ? "#ffe600" : this.color;
        ctx.lineWidth = (isSelected ? 3 : 2) * userScale;
        ctx.stroke();
        ctx.setLineDash([]);

        // 3. Vẽ nhãn chữ ở trọng tâm vùng chiến thuật (nếu có)
        if (this.label && this.label.trim() && this.points.length >= 3) {
            const center = this.getCentroid();
            const fontSize = Math.max(11, 16 * responsiveConstant * userScale);
            ctx.font = `bold ${fontSize}px ${CONFIG.fonts.name}`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.lineWidth = 3.5 * userScale;
            ctx.strokeStyle = "rgba(0,0,0,0.85)";
            ctx.strokeText(this.label.toUpperCase(), center.x, center.y);
            ctx.fillStyle = "#ffffff";
            ctx.fillText(this.label.toUpperCase(), center.x, center.y);
        }

        // 4. Vẽ các đỉnh kéo thả (Handles) khi được chọn
        if (isSelected) {
            ctx.fillStyle = "#ffe600";
            ctx.strokeStyle = "#000000";
            ctx.lineWidth = 2;
            for (let p of this.points) {
                ctx.beginPath();
                ctx.arc(p.x, p.y, 6 * userScale, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            }
        }
        ctx.restore();
    }

    getCentroid() {
        let sx = 0, sy = 0;
        const n = this.points.length || 1;
        this.points.forEach(p => { sx += p.x; sy += p.y; });
        return { x: sx / n, y: sy / n };
    }

    move(dx, dy) {
        for (let i = 0; i < this.points.length; i++) {
            this.points[i].x += dx;
            this.points[i].y += dy;
        }
    }

    getHitVertexIndex(x, y, userScale = 1.0) {
        const hitRadius = 9 * userScale;
        for (let i = 0; i < this.points.length; i++) {
            if (Math.hypot(x - this.points[i].x, y - this.points[i].y) <= hitRadius) {
                return i;
            }
        }
        return -1;
    }

    isHit(x, y) {
        if (this.points.length < 3) return false;
        let isInside = false;
        for (let i = 0, j = this.points.length - 1; i < this.points.length; j = i++) {
            const xi = this.points[i].x, yi = this.points[i].y;
            const xj = this.points[j].x, yj = this.points[j].y;
            const intersect = ((yi > y) !== (yj > y)) &&
                (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) isInside = !isInside;
        }
        return isInside;
    }

    static interpolate(p1, p2, t) {
        if (!p1 || !p2 || p1.points.length !== p2.points.length) return p2;
        const pts = p2.points.map((pt, idx) => ({
            x: p1.points[idx].x + (pt.x - p1.points[idx].x) * t,
            y: p1.points[idx].y + (pt.y - p1.points[idx].y) * t
        }));
        return new Polygon(pts, p2.id, p2.color, p2.fillStyle, p2.label || p1.label);
    }
}