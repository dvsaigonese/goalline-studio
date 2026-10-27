// js/board/shapes/Highlight.js
import { CONFIG } from '../config.js';
import { generateId } from '../utils.js';

export class Highlight {
    /**
     * @param {number} x - Tâm X
     * @param {number} y - Tâm Y
     * @param {number} size - Bán kính chuẩn (px)
     * @param {string} color - Mã màu Hex
     * @param {string} shapeStyle - 'circle' | 'ellipse' | 'ring'
     * @param {number} opacity - Độ đậm (0.1 -> 0.9)
     * @param {string|null} id - ID định danh
     * @param {number|null} pathCx - Quỹ đạo cong X
     * @param {number|null} pathCy - Quỹ đạo cong Y
     * @param {string} labelText - Chữ đánh dấu bên dưới Highlight
     * @param {number} labelSize - Cỡ chữ đánh dấu (mặc định 16)
     * @param {string} labelStyle - 'dark-pill' | 'yellow-pill' | 'color-pill' | 'plain'
     * @param {string} effectStyle - 'none' | 'spotlight' | 'pulse'
     */
    constructor(
        x, y, size = 32, color = "#b91c1c", shapeStyle = "circle",
        opacity = 0.48, id = null, pathCx = null, pathCy = null,
        labelText = "", labelSize = 16, labelStyle = "dark-pill", effectStyle = "none"
    ) {
        this.id = id || ('hl_' + generateId());
        this.x = x;
        this.y = y;
        this.size = parseFloat(size) || 32;
        this.color = color;
        this.shapeStyle = shapeStyle;
        this.opacity = parseFloat(opacity) || 0.48;
        this.pathCx = pathCx;
        this.pathCy = pathCy;

        // Thuộc tính Text & Hiệu ứng mới
        this.labelText = labelText || "";
        this.labelSize = parseFloat(labelSize) || 16;
        this.labelStyle = labelStyle || "dark-pill";
        this.effectStyle = effectStyle || "none";
    }

    clone() {
        return new Highlight(
            this.x, this.y, this.size, this.color,
            this.shapeStyle, this.opacity, this.id, null, null,
            this.labelText, this.labelSize, this.labelStyle, this.effectStyle
        );
    }

    getRadii(responsiveConstant = 1, userScale = 1.0) {
        const rx = this.size * responsiveConstant * userScale;
        const aspectY = this.shapeStyle === 'ellipse' ? 0.46 : 1.0;
        const ry = rx * aspectY;
        return { rx, ry };
    }

    static hexToRgba(hex, alpha = 0.5) {
        if (!hex) return `rgba(185, 28, 28, ${alpha})`;
        let c = hex.replace('#', '').trim();
        if (c.length === 3) {
            c = c.split('').map(ch => ch + ch).join('');
        }
        const num = parseInt(c, 16);
        if (isNaN(num)) return `rgba(185, 28, 28, ${alpha})`;
        const r = (num >> 16) & 255;
        const g = (num >> 8) & 255;
        const b = num & 255;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    draw(ctx, responsiveConstant = 1, isSelected = false, userScale = 1.0, alphaMultiplier = 1.0, isLinkSource = false) {
        const { rx, ry } = this.getRadii(responsiveConstant, userScale);

        ctx.save();
        ctx.globalAlpha = alphaMultiplier;

        // 1. Vẽ hiệu ứng Spotlight Beam (cột sáng chiếu từ trên xuống) nếu bật
        if (this.effectStyle === 'spotlight') {
            const beamHeight = Math.max(120, rx * 3.8);
            const grad = ctx.createLinearGradient(this.x, this.y - beamHeight, this.x, this.y);
            grad.addColorStop(0, Highlight.hexToRgba(this.color, 0.0));
            grad.addColorStop(0.6, Highlight.hexToRgba('#ffffff', 0.14));
            grad.addColorStop(1, Highlight.hexToRgba(this.color, 0.42));

            ctx.beginPath();
            ctx.moveTo(this.x - rx * 0.65, this.y - beamHeight);
            ctx.lineTo(this.x + rx * 0.65, this.y - beamHeight);
            ctx.lineTo(this.x + rx, this.y);
            ctx.lineTo(this.x - rx, this.y);
            ctx.closePath();
            ctx.fillStyle = grad;
            ctx.fill();
        }

        // 2. Vẽ hiệu ứng Double Pulse (vòng sóng lan tỏa bên ngoài) nếu bật
        if (this.effectStyle === 'pulse') {
            ctx.beginPath();
            ctx.ellipse(this.x, this.y, rx * 1.25, ry * 1.25, 0, 0, Math.PI * 2);
            ctx.lineWidth = 2 * responsiveConstant * userScale;
            ctx.strokeStyle = Highlight.hexToRgba(this.color, 0.45);
            ctx.stroke();

            ctx.beginPath();
            ctx.ellipse(this.x, this.y, rx * 1.48, ry * 1.48, 0, 0, Math.PI * 2);
            ctx.lineWidth = 1.2 * responsiveConstant * userScale;
            ctx.strokeStyle = Highlight.hexToRgba(this.color, 0.22);
            ctx.stroke();
        }

        // 3. Vẽ hình tròn hoặc đĩa elip chính
        ctx.beginPath();
        ctx.ellipse(this.x, this.y, rx, ry, 0, 0, Math.PI * 2);

        if (this.shapeStyle !== 'ring') {
            ctx.fillStyle = Highlight.hexToRgba(this.color, this.opacity);
            ctx.fill();
        }

        ctx.lineWidth = (this.shapeStyle === 'ring' ? 4 : 2.5) * responsiveConstant * userScale;
        ctx.strokeStyle = this.color;
        ctx.stroke();

        // Viền phụ bên trong tạo độ khối
        if (rx > 12) {
            ctx.beginPath();
            ctx.ellipse(this.x, this.y, rx * 0.82, ry * 0.82, 0, 0, Math.PI * 2);
            ctx.lineWidth = 1 * responsiveConstant * userScale;
            ctx.strokeStyle = Highlight.hexToRgba('#ffffff', 0.35);
            ctx.stroke();
        }

        // 4. Khi đang là điểm gốc nối dây
        if (isLinkSource) {
            ctx.beginPath();
            ctx.ellipse(this.x, this.y, rx + 6 * responsiveConstant, ry + 6 * responsiveConstant, 0, 0, Math.PI * 2);
            ctx.setLineDash([6, 4]);
            ctx.lineWidth = 3 * responsiveConstant;
            ctx.strokeStyle = "#00f076";
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // 5. Khi được chọn: Hiện viền chọn & Nút kéo chỉnh Size
        if (isSelected) {
            ctx.beginPath();
            ctx.ellipse(this.x, this.y, rx + 4 * responsiveConstant, ry + 4 * responsiveConstant, 0, 0, Math.PI * 2);
            ctx.setLineDash([5, 5]);
            ctx.lineWidth = 2 * responsiveConstant;
            ctx.strokeStyle = "#ffe600";
            ctx.stroke();
            ctx.setLineDash([]);

            const handleX = this.x + rx;
            const handleY = this.y;
            const hSize = 7 * responsiveConstant * Math.max(0.8, Math.min(1.4, userScale));

            ctx.beginPath();
            ctx.arc(handleX, handleY, hSize, 0, Math.PI * 2);
            ctx.fillStyle = "#ffe600";
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = "#000000";
            ctx.stroke();
        }

        // 6. VẼ TEXT ĐÁNH DẤU CẦU THỦ BÊN DƯỚI HIGHLIGHT
        if (this.labelText && this.labelText.trim().length > 0) {
            this.drawLabel(ctx, rx, ry, responsiveConstant, userScale);
        }

        ctx.restore();
    }

    drawLabel(ctx, rx, ry, responsiveConstant, userScale) {
        const text = this.labelText.trim();
        const fontSize = Math.max(9, this.labelSize * responsiveConstant * userScale);
        ctx.save();
        ctx.font = `bold ${fontSize}px ${CONFIG.fonts.name}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        const textWidth = ctx.measureText(text).width;
        const padX = 10 * responsiveConstant * userScale;
        const padY = 5 * responsiveConstant * userScale;
        const boxW = textWidth + padX * 2;
        const boxH = fontSize + padY * 2;
        const boxX = this.x - boxW / 2;
        const boxY = this.y + ry + (6 * responsiveConstant * userScale);
        const centerY = boxY + boxH / 2;

        if (this.labelStyle === 'plain') {
            ctx.lineWidth = 3.5 * responsiveConstant * userScale;
            ctx.strokeStyle = "rgba(0, 0, 0, 0.9)";
            ctx.strokeText(text, this.x, centerY);
            ctx.fillStyle = "#ffffff";
            ctx.fillText(text, this.x, centerY);
        } else {
            // Hộp nhãn (Pill/Tag) phong cách Broadcast Neobrutalism
            let bg = "rgba(16, 17, 20, 0.92)";
            let border = "#ffe600";
            let fg = "#ffffff";

            if (this.labelStyle === 'yellow-pill') {
                bg = "#ffe600";
                border = "#000000";
                fg = "#000000";
            } else if (this.labelStyle === 'color-pill') {
                bg = this.color || "#b91c1c";
                border = "#ffffff";
                fg = "#ffffff";
            }

            // Đổ bóng cứng nhỏ
            ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
            ctx.fillRect(boxX + 3 * responsiveConstant, boxY + 3 * responsiveConstant, boxW, boxH);

            // Hộp chính
            ctx.fillStyle = bg;
            ctx.fillRect(boxX, boxY, boxW, boxH);
            ctx.lineWidth = 1.8 * responsiveConstant * userScale;
            ctx.strokeStyle = border;
            ctx.strokeRect(boxX, boxY, boxW, boxH);

            // Chữ
            ctx.fillStyle = fg;
            ctx.fillText(text, this.x, centerY + 1);
        }
        ctx.restore();
    }

    drawMovementPath(ctx, prevHl, responsiveConstant = 1, userScale = 1.0, isSelected = false) {
        if (!prevHl) return;
        const dist = Math.hypot(this.x - prevHl.x, this.y - prevHl.y);
        if (dist < 3) return;

        const cx = this.pathCx !== null && this.pathCx !== undefined ? this.pathCx : (prevHl.x + this.x) / 2;
        const cy = this.pathCy !== null && this.pathCy !== undefined ? this.pathCy : (prevHl.y + this.y) / 2;

        ctx.save();
        ctx.beginPath();
        ctx.setLineDash([6 * responsiveConstant, 5 * responsiveConstant]);
        ctx.moveTo(prevHl.x, prevHl.y);
        ctx.quadraticCurveTo(cx, cy, this.x, this.y);
        ctx.strokeStyle = isSelected ? "#00f076" : "rgba(255, 230, 0, 0.7)";
        ctx.lineWidth = 2 * responsiveConstant;
        ctx.stroke();

        if (isSelected) {
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.arc(cx, cy, 6 * responsiveConstant * userScale, 0, Math.PI * 2);
            ctx.fillStyle = "#00f076";
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = "#000";
            ctx.stroke();
        }
        ctx.restore();
    }

    isHitResizeHandle(mx, my, responsiveConstant = 1, userScale = 1.0) {
        const { rx } = this.getRadii(responsiveConstant, userScale);
        const handleX = this.x + rx;
        const handleY = this.y;
        const hitRadius = 11 * responsiveConstant * Math.max(0.8, Math.min(1.5, userScale));
        return Math.hypot(mx - handleX, my - handleY) <= hitRadius;
    }

    isHitPathHandle(mx, my, prevHl, responsiveConstant = 1, userScale = 1.0) {
        if (!prevHl) return false;
        const cx = this.pathCx !== null && this.pathCx !== undefined ? this.pathCx : (prevHl.x + this.x) / 2;
        const cy = this.pathCy !== null && this.pathCy !== undefined ? this.pathCy : (prevHl.y + this.y) / 2;
        const r = 10 * responsiveConstant * userScale;
        return Math.hypot(mx - cx, my - cy) <= r;
    }

    isHit(mx, my, responsiveConstant = 1, userScale = 1.0) {
        const { rx, ry } = this.getRadii(responsiveConstant, userScale);
        if (rx <= 0 || ry <= 0) return false;
        const normX = (mx - this.x) / rx;
        const normY = (my - this.y) / ry;
        if ((normX * normX + normY * normY) <= 1.08) return true;

        // Cho phép click trúng vào cả nhãn chữ bên dưới Highlight
        if (this.labelText && this.labelText.trim()) {
            const fontSize = Math.max(9, this.labelSize * responsiveConstant * userScale);
            const approxW = Math.max(60, this.labelText.length * fontSize * 0.65);
            const boxH = fontSize + 14 * responsiveConstant * userScale;
            const boxY = this.y + ry + 4 * responsiveConstant * userScale;
            if (mx >= this.x - approxW / 2 && mx <= this.x + approxW / 2 && my >= boxY && my <= boxY + boxH) {
                return true;
            }
        }
        return false;
    }

    getPerimeterPointTowards(targetX, targetY, responsiveConstant = 1, userScale = 1.0) {
        const { rx, ry } = this.getRadii(responsiveConstant, userScale);
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const angle = Math.atan2(dy / ry, dx / rx);
        return {
            x: this.x + rx * Math.cos(angle),
            y: this.y + ry * Math.sin(angle)
        };
    }

    static drawLink(ctx, hl1, hl2, linkObj, responsiveConstant = 1, userScale = 1.0, isSelected = false) {
        if (!hl1 || !hl2) return;

        const r1 = hl1.getRadii(responsiveConstant, userScale);
        const r2 = hl2.getRadii(responsiveConstant, userScale);
        const centerDist = Math.hypot(hl2.x - hl1.x, hl2.y - hl1.y);

        if (centerDist <= (r1.rx + r2.rx) * 0.65) return;

        const p1 = hl1.getPerimeterPointTowards(hl2.x, hl2.y, responsiveConstant, userScale);
        const p2 = hl2.getPerimeterPointTowards(hl1.x, hl1.y, responsiveConstant, userScale);

        const color = linkObj.color || hl1.color || "#b91c1c";
        const width = (parseFloat(linkObj.lineWidth) || 3) * responsiveConstant * userScale;

        ctx.save();
        ctx.beginPath();
        if (linkObj.lineType === 'dash') {
            ctx.setLineDash([12 * responsiveConstant * userScale, 8 * responsiveConstant * userScale]);
        } else {
            ctx.setLineDash([]);
        }

        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = isSelected ? "#ffe600" : color;
        ctx.lineWidth = isSelected ? width + 2 : width;
        ctx.lineCap = "round";
        ctx.stroke();
        ctx.restore();
    }

    static isHitLink(mx, my, hl1, hl2, responsiveConstant = 1, userScale = 1.0) {
        if (!hl1 || !hl2) return false;
        const p1 = hl1.getPerimeterPointTowards(hl2.x, hl2.y, responsiveConstant, userScale);
        const p2 = hl2.getPerimeterPointTowards(hl1.x, hl1.y, responsiveConstant, userScale);

        const A = mx - p1.x;
        const B = my - p1.y;
        const C = p2.x - p1.x;
        const D = p2.y - p1.y;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        if (lenSq === 0) return false;

        const param = Math.max(0, Math.min(1, dot / lenSq));
        const xx = p1.x + param * C;
        const yy = p1.y + param * D;

        const dist = Math.hypot(mx - xx, my - yy);
        return dist <= 8 * responsiveConstant * userScale;
    }

    static interpolate(h1, h2, t) {
        const cx = h2.pathCx !== null && h2.pathCx !== undefined ? h2.pathCx : (h1.x + h2.x) / 2;
        const cy = h2.pathCy !== null && h2.pathCy !== undefined ? h2.pathCy : (h1.y + h2.y) / 2;

        const invT = 1 - t;
        const x = invT * invT * h1.x + 2 * invT * t * cx + t * t * h2.x;
        const y = invT * invT * h1.y + 2 * invT * t * cy + t * t * h2.y;
        const size = h1.size + (h2.size - h1.size) * t;
        const opacity = h1.opacity + (h2.opacity - h1.opacity) * t;
        const labelSize = (h1.labelSize || 16) + ((h2.labelSize || 16) - (h1.labelSize || 16)) * t;

        return new Highlight(
            x, y, size, h2.color, h2.shapeStyle, opacity, h2.id, null, null,
            h2.labelText || h1.labelText, labelSize, h2.labelStyle || h1.labelStyle, h2.effectStyle || h1.effectStyle
        );
    }
}