import { CONFIG } from '../config.js';

export class TextObj {
    constructor(x, y, text, fontSize = 20, rotate = 0) {
        this.x = x;
        this.y = y;
        this.text = text;
        this.fontSize = fontSize;
        this.rotate = rotate;
    }

    draw(ctx, responsiveConstant = 1, isSelected = false, userScale = 1.0) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotate * (Math.PI / 180));
        
        // Scale font size
        const currentFontSize = this.fontSize * responsiveConstant * userScale;
        ctx.font = `bold ${currentFontSize}px ${CONFIG.fonts.name}`; // Dùng font name cho text thường
        ctx.fillStyle = "white";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle"; 
        ctx.fillText(this.text, 0, 0);

        if (isSelected) {
            const textWidth = ctx.measureText(this.text).width;
            const lineY = currentFontSize / 2 + 2;
            
            ctx.beginPath();
            ctx.moveTo(-textWidth / 2, lineY);
            ctx.lineTo(textWidth / 2, lineY);
            ctx.strokeStyle = "white";
            ctx.lineWidth = 2 * responsiveConstant * userScale;
            ctx.stroke();
        }
        ctx.restore();
    }

    isHit(mouseX, mouseY, ctx, responsiveConstant = 1, userScale = 1.0) {
        const currentFontSize = this.fontSize * responsiveConstant * userScale;
        ctx.font = `bold ${currentFontSize}px ${CONFIG.fonts.name}`;
        
        const textWidth = ctx.measureText(this.text).width;
        const textHeight = currentFontSize; 

        // Tính toán hitbox (chưa tính xoay để đơn giản hóa)
        return (
            mouseX >= this.x - textWidth / 2 &&
            mouseX <= this.x + textWidth / 2 &&
            mouseY >= this.y - textHeight / 2 &&
            mouseY <= this.y + textHeight / 2
        );
    }
}