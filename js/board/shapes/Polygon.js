export class Polygon {
    constructor(points = []) {
        this.points = points; 
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
        
        // Vẽ các điểm neo (Handles) khi được chọn
        if (isSelected) {
            ctx.fillStyle = "#facc15"; // Màu vàng sáng cho dễ nhìn
            ctx.strokeStyle = "black";
            for (let p of this.points) {
                ctx.beginPath();
                // Vẽ to ra một chút để dễ click (radius = 5)
                ctx.arc(p.x, p.y, 5 * userScale, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            }
        }
        ctx.restore();
    }

    // Di chuyển cả khối
    move(dx, dy) {
        for (let i = 0; i < this.points.length; i++) {
            this.points[i].x += dx;
            this.points[i].y += dy;
        }
    }

    // --- LOGIC MỚI: Kiểm tra click trúng đỉnh nào ---
    // Trả về index của điểm trúng, hoặc -1 nếu không trúng
    getHitVertexIndex(x, y, userScale = 1.0) {
        // Bán kính vùng click (Hitbox) nên to hơn hình vẽ một chút cho dễ bấm
        const hitRadius = 8 * userScale; 

        for (let i = 0; i < this.points.length; i++) {
            const dx = x - this.points[i].x;
            const dy = y - this.points[i].y;
            // Kiểm tra khoảng cách
            if (dx*dx + dy*dy <= hitRadius*hitRadius) {
                return i;
            }
        }
        return -1;
    }

    // Kiểm tra click trúng thân (giữ nguyên)
    isHit(x, y) {
        let isInside = false;
        let minX = this.points[0].x, maxX = this.points[0].x;
        let minY = this.points[0].y, maxY = this.points[0].y;

        for (let n = 1; n < this.points.length; n++) {
            const q = this.points[n];
            minX = Math.min(q.x, minX);
            maxX = Math.max(q.x, maxX);
            minY = Math.min(q.y, minY);
            maxY = Math.max(q.y, maxY);
        }

        if (x < minX || x > maxX || y < minY || y > maxY) {
            return false;
        }

        let i = 0, j = this.points.length - 1;
        for (i, j; i < this.points.length; j = i++) {
            if (
                (this.points[i].y > y) !== (this.points[j].y > y) &&
                x <
                ((this.points[j].x - this.points[i].x) * (y - this.points[i].y)) /
                (this.points[j].y - this.points[i].y) +
                this.points[i].x
            ) {
                isInside = !isInside;
            }
        }
        return isInside;
    }
}