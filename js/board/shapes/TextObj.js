// js/board/shapes/TextObj.js
import { CONFIG } from '../config.js';
import { generateId } from '../utils.js';

export class TextObj {
    constructor(x, y, text, fontSize = 20, rotate = 0, id = null, color = "#ffffff", bgStyle = "none") {
        this.id = id || ('txt_' + generateId());
        this.x = x;
        this.y = y;
        this.text = text;
        this.fontSize = fontSize;
        this.rotate = rotate;
        this.color = color || "#ffffff";
        this.bgStyle = bgStyle || "none"; // 'none' | 'dark-box' | 'yellow-box'
    }

    clone() {
        return new TextObj(this.x, this.y, this.text, this.fontSize, this.rotate, this.id, this.color, this.bgStyle);
    }

    draw(ctx, responsiveConstant = 1, isSelected = false, userScale = 1.0) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotate * (Math.PI / 180));

        const currentFontSize = this.fontSize * responsiveConstant * userScale;
        ctx.font = `bold ${currentFontSize}px ${CONFIG.fonts.name}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        const textWidth = ctx.measureText(this.text).width;
        const padX = 12 * responsiveConstant * userScale;
        const padY = 6 * responsiveConstant * userScale;

        if (this.bgStyle === 'dark-box') {
            ctx.fillStyle = "rgba(16, 17, 20, 0.92)";
            ctx.fillRect(-textWidth / 2 - padX, -currentFontSize / 2 - padY, textWidth + padX * 2, currentFontSize + padY * 2);
            ctx.lineWidth = 2 * responsiveConstant * userScale;
            ctx.strokeStyle = this.color || "#ffe600";
            ctx.strokeRect(-textWidth / 2 - padX, -currentFontSize / 2 - padY, textWidth + padX * 2, currentFontSize + padY * 2);
            ctx.fillStyle = this.color || "#ffffff";
            ctx.fillText(this.text, 0, 1);
        } else if (this.bgStyle === 'yellow-box') {
            ctx.fillStyle = "#ffe600";
            ctx.fillRect(-textWidth / 2 - padX, -currentFontSize / 2 - padY, textWidth + padX * 2, currentFontSize + padY * 2);
            ctx.lineWidth = 2.5 * responsiveConstant * userScale;
            ctx.strokeStyle = "#000000";
            ctx.strokeRect(-textWidth / 2 - padX, -currentFontSize / 2 - padY, textWidth + padX * 2, currentFontSize + padY * 2);
            ctx.fillStyle = "#000000";
            ctx.fillText(this.text, 0, 1);
        } else {
            ctx.lineWidth = 3.5 * responsiveConstant * userScale;
            ctx.strokeStyle = "rgba(0,0,0,0.85)";
            ctx.strokeText(this.text, 0, 0);
            ctx.fillStyle = this.color || "white";
            ctx.fillText(this.text, 0, 0);
        }

        if (isSelected) {
            const lineY = currentFontSize / 2 + padY + 3;
            ctx.beginPath();
            ctx.moveTo(-textWidth / 2, lineY);
            ctx.lineTo(textWidth / 2, lineY);
            ctx.strokeStyle = "#ffe600";
            ctx.lineWidth = 2.5 * responsiveConstant * userScale;
            ctx.stroke();
        }
        ctx.restore();
    }

    isHit(mouseX, mouseY, ctx, responsiveConstant = 1, userScale = 1.0) {
        const currentFontSize = this.fontSize * responsiveConstant * userScale;
        ctx.font = `bold ${currentFontSize}px ${CONFIG.fonts.name}`;
        const textWidth = ctx.measureText(this.text).width + 20;
        const textHeight = currentFontSize + 14;
        return (
            mouseX >= this.x - textWidth / 2 &&
            mouseX <= this.x + textWidth / 2 &&
            mouseY >= this.y - textHeight / 2 &&
            mouseY <= this.y + textHeight / 2
        );
    }

    static interpolate(t1, t2, t) {
        return new TextObj(
            t1.x + (t2.x - t1.x) * t,
            t1.y + (t2.y - t1.y) * t,
            t2.text,
            t1.fontSize + (t2.fontSize - t1.fontSize) * t,
            t1.rotate + (t2.rotate - t1.rotate) * t,
            t2.id,
            t2.color,
            t2.bgStyle
        );
    }
}