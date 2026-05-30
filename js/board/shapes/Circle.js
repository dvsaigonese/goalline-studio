import { CONFIG } from '../config.js';

export class Circle {
    constructor(x, y, radius, color, text = "", textColor = "white", detailsText = "") {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.text = text;
        this.textColor = textColor;
        this.detailsText = detailsText;
    }

    /**
     * @param {number} userScale - Tỉ lệ zoom từ thanh slider (Mặc định 1.0)
     */
    draw(ctx, ballImg, responsiveConstant = 1, isSelected = false, userScale = 1.0) {
        // Tính bán kính thực tế dựa trên scale
        const currentRadius = this.radius * userScale;

        if (this.color === "ball") {
            ctx.save();
            ctx.beginPath();
            ctx.arc(this.x, this.y, currentRadius / 2, 0, Math.PI * 2);
            ctx.closePath();
            
            // Vẽ ảnh hoặc fallback
            if (ballImg && ballImg.complete && ballImg.naturalHeight !== 0) {
                ctx.save();
                ctx.clip();
                ctx.drawImage(ballImg, this.x - currentRadius, this.y - currentRadius, currentRadius * 2, currentRadius * 2);
                ctx.restore();
            } else {
                ctx.fillStyle = "white";
                ctx.fill();
                ctx.strokeStyle = "black";
                ctx.stroke();
            }
        } else {
            ctx.save();
            ctx.beginPath();
            ctx.arc(this.x, this.y, currentRadius, 0, Math.PI * 2);
            ctx.fillStyle = this.color;
            ctx.fill();
        }

        // Viền khi chọn
        if (isSelected) {
            ctx.lineWidth = 3 * responsiveConstant * userScale; // Viền cũng to lên
            ctx.strokeStyle = "white";
            ctx.stroke();
        }

        // Vẽ Số Áo (Font to)
        let fontSize = 30 * responsiveConstant * userScale;
        ctx.font = `bold ${fontSize}px ${CONFIG.fonts.number}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = this.textColor;
        ctx.fillText(this.text, this.x, this.y + (responsiveConstant * userScale));

        // Vẽ Tên (Font nhỏ)
        if (this.detailsText) {
            let fontDetailsSize = 15 * responsiveConstant * userScale;
            ctx.font = `bold ${fontDetailsSize}px ${CONFIG.fonts.name}`;
            ctx.fillStyle = "white";
            ctx.fillText(this.detailsText, this.x, this.y + (35 * responsiveConstant * userScale));
        }

        ctx.closePath();
        ctx.restore();
    }

    isHit(mouseX, mouseY, userScale = 1.0) {
        // Vùng click cũng phải to ra theo scale
        const currentRadius = this.radius * userScale;
        const dx = mouseX - this.x;
        const dy = mouseY - this.y;
        return dx * dx + dy * dy <= currentRadius * currentRadius;
    }
}