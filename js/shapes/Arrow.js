export class Arrow {
    // Thêm tham số cx, cy vào constructor để lưu trữ điểm điều khiển uốn cong
    constructor(fromX, fromY, toX, toY, color, type = "solid", isArrow = true, cx, cy) {
        this.fromX = fromX;
        this.fromY = fromY;
        this.toX = toX;
        this.toY = toY;
        
        // Khởi tạo điểm control (cx, cy). Nếu không có data truyền vào thì lấy trung điểm của đoạn thẳng
        this.cx = cx !== undefined ? cx : (fromX + toX) / 2;
        this.cy = cy !== undefined ? cy : (fromY + toY) / 2;
        
        this.color = color;
        this.type = type;
        this.isArrow = isArrow;
    }

    draw(ctx, responsiveConstant = 1, isSelected = false, userScale = 1.0) {
        const headlen = 13 * responsiveConstant * userScale; 
        const lineWidth = 3 * responsiveConstant * userScale;
        
        // Tính góc của mũi tên dựa trên tiếp tuyến từ điểm control (cx, cy) đến điểm cuối (toX, toY)
        const angle = Math.atan2(this.toY - this.cy, this.toX - this.cx);

        ctx.save();
        ctx.beginPath();
        
        if (this.type === "dash") {
            ctx.setLineDash([15 * responsiveConstant * userScale, 15 * responsiveConstant * userScale]);
        } else {
            ctx.setLineDash([]);
        }

        ctx.moveTo(this.fromX, this.fromY);
        // Thay vì lineTo, dùng quadraticCurveTo để vẽ đường cong
        ctx.quadraticCurveTo(this.cx, this.cy, this.toX, this.toY);
        
        ctx.strokeStyle = this.color;
        ctx.fillStyle = this.color;
        ctx.lineWidth = lineWidth;
        ctx.stroke();

        // Vẽ đầu mũi tên
        if (this.isArrow) {
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.moveTo(this.toX, this.toY);
            ctx.lineTo(
                this.toX - headlen * Math.cos(angle - Math.PI / 6),
                this.toY - headlen * Math.sin(angle - Math.PI / 6)
            );
            ctx.lineTo(
                this.toX - headlen * Math.cos(angle + Math.PI / 6),
                this.toY - headlen * Math.sin(angle + Math.PI / 6)
            );
            ctx.lineTo(this.toX, this.toY);
            ctx.lineTo(
                this.toX - headlen * Math.cos(angle - Math.PI / 6),
                this.toY - headlen * Math.sin(angle - Math.PI / 6)
            );
            ctx.stroke();
            ctx.fill();
        }

        // Nếu đang được chọn, vẽ các điểm kéo thả (handles)
        if (isSelected) {
            // Vẽ 2 điểm đầu cuối
            this.drawHandle(ctx, this.fromX, this.fromY, responsiveConstant, userScale);
            this.drawHandle(ctx, this.toX, this.toY, responsiveConstant, userScale);
            
            // Vẽ điểm điều khiển uốn cong (Control Point) màu vàng để phân biệt
            this.drawHandle(ctx, this.cx, this.cy, responsiveConstant, userScale, 'gold');
            
            // Vẽ đường dẫn mờ mờ từ điểm đầu/cuối tới điểm control để user dễ hình dung cấu trúc cong
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
        // Thêm viền trắng/đen để nút handle nổi bật hơn trên các nền cỏ
        ctx.strokeStyle = "white";
        ctx.lineWidth = 2 * userScale;
        ctx.stroke();
        ctx.closePath();
    }

    isHitBody(mx, my, userScale = 1.0) {
        const threshold = 10 * userScale; 
        const steps = 20; // Chia đường cong thành 20 đoạn nhỏ để lấy mẫu kiểm tra điểm chạm

        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            
            // Công thức nội suy Quadratic Bezier
            const px = Math.pow(1 - t, 2) * this.fromX + 2 * (1 - t) * t * this.cx + Math.pow(t, 2) * this.toX;
            const py = Math.pow(1 - t, 2) * this.fromY + 2 * (1 - t) * t * this.cy + Math.pow(t, 2) * this.toY;

            const distance = Math.sqrt(Math.pow(mx - px, 2) + Math.pow(my - py, 2));
            if (distance <= threshold) {
                return true; // Click trúng thân đường cong
            }
        }
        return false;
    }

    isHitHandle(mx, my, pointType = 'from', responsiveConstant = 1, userScale = 1.0) {
        let targetX, targetY;
        
        if (pointType === 'from') { targetX = this.fromX; targetY = this.fromY; }
        else if (pointType === 'to') { targetX = this.toX; targetY = this.toY; }
        else if (pointType === 'control') { targetX = this.cx; targetY = this.cy; } // Bổ sung check điểm control
        
        const radius = 10 * responsiveConstant * userScale;
        const dx = mx - targetX;
        const dy = my - targetY;
        return dx * dx + dy * dy <= radius * radius;
    }
}