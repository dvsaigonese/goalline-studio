// js/board/shapes/Polygon.js
import { generateId } from '../utils.js';

export class Polygon {
    constructor(points = [], id = null) {
        this.id = id || ('poly_' + generateId());
        this.points = points.map(p => ({ x: p.x, y: p.y }));
    }

    clone() {
        return new Polygon(this.points.map(p => ({ x: p.x, y: p.y })), this.id);
    }

    draw(ctx, isSelected = false, userScale = 1.0) {
        if (this.points.length < 1) return;

        ctx.save();
        ctx.fillStyle = isSelected ? "rgba(255, 0, 0, 0.3)" : "rgba(255, 255, 255, 0.3)";
        ctx.strokeStyle = "white";
        ctx.lineWidth = 2 * userScale;

        ctx.beginPath();
        ctx.moveTo(this.points[0].x, this.points[0].y);
        for (let i = 1; i < this.points.length; i++) {
            ctx.lineTo(this.points[i].x, this.points[i].y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        if (isSelected) {
            ctx.fillStyle = "#facc15";
            ctx.strokeStyle = "black";
            for (let p of this.points) {
                ctx.beginPath();
                ctx.arc(p.x, p.y, 5 * userScale, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            }
        }
        ctx.restore();
    }

    move(dx, dy) {
        for (let i = 0; i < this.points.length; i++) {
            this.points[i].x += dx;
            this.points[i].y += dy;
        }
    }

    getHitVertexIndex(x, y, userScale = 1.0) {
        const hitRadius = 8 * userScale;
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
        return new Polygon(pts, p2.id);
    }
}