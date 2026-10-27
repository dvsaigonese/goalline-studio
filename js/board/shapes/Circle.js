// js/board/shapes/Circle.js
import { CONFIG } from '../config.js';
import { generateId } from '../utils.js';

export class Circle {
    constructor(
        x, y, radius, color, text = "", textColor = "white", detailsText = "",
        id = null, pathCx = null, pathCy = null, showVision = false, visionAngle = 0
    ) {
        this.id = id || ('cir_' + generateId());
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.text = text;
        this.textColor = textColor;
        this.detailsText = detailsText;

        this.pathCx = pathCx;
        this.pathCy = pathCy;

        // Hướng mặt / Chùm tầm nhìn chiến thuật của cầu thủ (Scanning / Body Orientation)
        this.showVision = Boolean(showVision);
        this.visionAngle = parseFloat(visionAngle) || 0;
    }

    clone() {
        return new Circle(
            this.x, this.y, this.radius, this.color,
            this.text, this.textColor, this.detailsText,
            this.id, null, null, this.showVision, this.visionAngle
        );
    }

    draw(ctx, ballImg, responsiveConstant = 1, isSelected = false, userScale = 1.0, alpha = 1.0) {
        const currentRadius = this.radius * userScale;
        ctx.save();
        ctx.globalAlpha = alpha;

        // 1. Vẽ chùm sáng hướng nhìn / hướng xoay người (Vision Cone) nếu cầu thủ bật showVision
        if (this.color !== "ball" && this.showVision) {
            const rad = (this.visionAngle * Math.PI) / 180;
            const spread = Math.PI / 3.4; // Góc mở ~53 độ
            const coneLen = currentRadius * 3.4;

            const grad = ctx.createRadialGradient(this.x, this.y, currentRadius * 0.8, this.x, this.y, coneLen);
            grad.addColorStop(0, "rgba(255, 230, 0, 0.45)");
            grad.addColorStop(1, "rgba(255, 230, 0, 0.0)");

            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.arc(this.x, this.y, coneLen, rad - spread / 2, rad + spread / 2);
            ctx.closePath();
            ctx.fillStyle = grad;
            ctx.fill();

            // Vành chỉ hướng thân người (Body Orientation Arc) ngay sát lưng/mặt cầu thủ
            ctx.beginPath();
            ctx.arc(this.x, this.y, currentRadius * 1.25, rad - spread / 2, rad + spread / 2);
            ctx.lineWidth = 3 * responsiveConstant * userScale;
            ctx.strokeStyle = "#ffe600";
            ctx.stroke();
        }

        // 2. Vẽ Bóng hoặc Token Cầu thủ
        if (this.color === "ball") {
            ctx.beginPath();
            ctx.arc(this.x, this.y, currentRadius / 2, 0, Math.PI * 2);
            ctx.closePath();

            if (ballImg && ballImg.complete && ballImg.naturalHeight !== 0) {
                ctx.save();
                ctx.clip();
                ctx.drawImage(ballImg, this.x - currentRadius, this.y - currentRadius, currentRadius * 2, currentRadius * 2);
                ctx.restore();
            } else {
                ctx.fillStyle = "white";
                ctx.fill();
                ctx.strokeStyle = "black";
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        } else {
            ctx.beginPath();
            ctx.arc(this.x, this.y, currentRadius, 0, Math.PI * 2);
            ctx.fillStyle = this.color;
            ctx.fill();
            ctx.lineWidth = 2.5 * responsiveConstant * userScale;
            ctx.strokeStyle = "#000000";
            ctx.stroke();
        }

        // 3. Viền chọn vàng
        if (isSelected) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, currentRadius + 4 * responsiveConstant * userScale, 0, Math.PI * 2);
            ctx.lineWidth = 3 * responsiveConstant * userScale;
            ctx.strokeStyle = "#ffe600";
            ctx.stroke();
        }

        // 4. Số áo
        if (this.color !== "ball" && this.text) {
            const fontSize = 28 * responsiveConstant * userScale;
            ctx.font = `bold ${fontSize}px ${CONFIG.fonts.number}`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = this.textColor;
            ctx.fillText(this.text, this.x, this.y + (responsiveConstant * userScale));
        }

        // 5. Tên cầu thủ
        if (this.detailsText) {
            const fontDetailsSize = 15 * responsiveConstant * userScale;
            ctx.font = `bold ${fontDetailsSize}px ${CONFIG.fonts.name}`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.lineWidth = 3.5 * responsiveConstant * userScale;
            ctx.strokeStyle = "rgba(0,0,0,0.85)";
            ctx.strokeText(this.detailsText, this.x, this.y + (34 * responsiveConstant * userScale));
            ctx.fillStyle = "white";
            ctx.fillText(this.detailsText, this.x, this.y + (34 * responsiveConstant * userScale));
        }

        ctx.restore();
    }

    drawMovementPath(ctx, prevCircle, responsiveConstant = 1, userScale = 1.0, isSelected = false) {
        if (!prevCircle) return;
        const dist = Math.hypot(this.x - prevCircle.x, this.y - prevCircle.y);
        if (dist < 3) return;

        const cx = this.pathCx !== null && this.pathCx !== undefined ? this.pathCx : (prevCircle.x + this.x) / 2;
        const cy = this.pathCy !== null && this.pathCy !== undefined ? this.pathCy : (prevCircle.y + this.y) / 2;

        ctx.save();
        ctx.beginPath();
        ctx.arc(prevCircle.x, prevCircle.y, (this.radius * userScale) * 0.75, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 230, 0, 0.22)";
        ctx.fill();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = "rgba(255, 230, 0, 0.75)";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.setLineDash([8 * responsiveConstant, 6 * responsiveConstant]);
        ctx.moveTo(prevCircle.x, prevCircle.y);
        ctx.quadraticCurveTo(cx, cy, this.x, this.y);
        ctx.strokeStyle = isSelected ? "#00f076" : "rgba(255, 230, 0, 0.85)";
        ctx.lineWidth = (isSelected ? 3.5 : 2.5) * responsiveConstant;
        ctx.stroke();

        const angle = Math.atan2(this.y - cy, this.x - cx);
        const headLen = 10 * responsiveConstant * userScale;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x - headLen * Math.cos(angle - Math.PI / 6), this.y - headLen * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(this.x - headLen * Math.cos(angle + Math.PI / 6), this.y - headLen * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fillStyle = isSelected ? "#00f076" : "#ffe600";
        ctx.fill();

        if (isSelected) {
            ctx.beginPath();
            ctx.arc(cx, cy, 7 * responsiveConstant * userScale, 0, Math.PI * 2);
            ctx.fillStyle = "#00f076";
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = "#000";
            ctx.stroke();
        }
        ctx.restore();
    }

    isHitPathHandle(mx, my, prevCircle, responsiveConstant = 1, userScale = 1.0) {
        if (!prevCircle) return false;
        const cx = this.pathCx !== null && this.pathCx !== undefined ? this.pathCx : (prevCircle.x + this.x) / 2;
        const cy = this.pathCy !== null && this.pathCy !== undefined ? this.pathCy : (prevCircle.y + this.y) / 2;
        const r = 10 * responsiveConstant * userScale;
        return Math.hypot(mx - cx, my - cy) <= r;
    }

    isHit(mouseX, mouseY, userScale = 1.0) {
        const currentRadius = this.radius * userScale;
        return Math.hypot(mouseX - this.x, mouseY - this.y) <= currentRadius;
    }

    static interpolate(c1, c2, t) {
        const cx = c2.pathCx !== null && c2.pathCx !== undefined ? c2.pathCx : (c1.x + c2.x) / 2;
        const cy = c2.pathCy !== null && c2.pathCy !== undefined ? c2.pathCy : (c1.y + c2.y) / 2;

        const invT = 1 - t;
        const x = invT * invT * c1.x + 2 * invT * t * cx + t * t * c2.x;
        const y = invT * invT * c1.y + 2 * invT * t * cy + t * t * c2.y;
        const radius = c1.radius + (c2.radius - c1.radius) * t;
        const vAngle = (c1.visionAngle || 0) + ((c2.visionAngle || 0) - (c1.visionAngle || 0)) * t;

        return new Circle(
            x, y, radius, c2.color, c2.text, c2.textColor, c2.detailsText,
            c2.id, null, null, c2.showVision || c1.showVision, vAngle
        );
    }
}