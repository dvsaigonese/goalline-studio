// js/board/shapes/TextObj.js
import { CONFIG } from '../config.js';
import { generateId } from '../utils.js';

export class TextObj {
    constructor(x, y, text, fontSize = 20, rotate = 0, id = null) {
        this.id = id || ('txt_' + generateId());
        this.x = x;
        this.y = y;
        this.text = text;
        this.fontSize = fontSize;
        this.rotate = rotate;
    }

    clone() {
        return new TextObj(this.x, this.y, this.text, this.fontSize, this.rotate, this.id);
    }

    draw(ctx, responsiveConstant = 1, isSelected = false, userScale = 1.0) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotate * (Math.PI / 180));

        const currentFontSize = this.fontSize * responsiveConstant * userScale;
        ctx.font = `bold ${currentFontSize}px ${CONFIG.fonts.name}`;
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
            ctx.strokeStyle = "#ffe600";
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
            t2.id
        );
    }
}