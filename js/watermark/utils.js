// js/watermark/utils.js

export function debounce(func, timeout = 80) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => { func.apply(this, args); }, timeout);
    };
}

// --- 1. HỆ THỐNG CACHED FILM GRAIN SIÊU TỐC (60FPS KHÔNG GIẬT LAG KHI KÉO ẢNH) ---
let cachedNoiseCanvas = null;

function getNoisePatternCanvas() {
    if (cachedNoiseCanvas) return cachedNoiseCanvas;
    const size = 256;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const nCtx = c.getContext('2d');
    const imgData = nCtx.createImageData(size, size);
    const data = imgData.data;

    // Tạo hạt noise đơn sắc (Monochrome 35mm Film Grain) mịn và điện ảnh hơn noise màu
    for (let i = 0; i < data.length; i += 4) {
        const val = Math.floor(Math.random() * 255);
        data[i] = val;
        data[i + 1] = val;
        data[i + 2] = val;
        data[i + 3] = 255;
    }
    nCtx.putImageData(imgData, 0, 0);
    cachedNoiseCanvas = c;
    return c;
}

/**
 * Phủ hạt Film Grain tốc độ cao bằng GPU Pattern Blending
 */
export function addFilmGrain(ctx, width, height, intensity = 0.08) {
    if (!intensity || intensity <= 0) return;

    const noiseTile = getNoisePatternCanvas();
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = Math.min(0.65, intensity * 2.2);

    const pattern = ctx.createPattern(noiseTile, 'repeat');
    if (pattern) {
        // Dịch ngẫu nhiên nhẹ tọa độ pattern để hạt sống động
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, width, height);
    }
    ctx.restore();
}

// --- 2. UNIFIED TITLE ENGINE CHO MỌI TEMPLATE (TƯƠNG THÍCH NGƯỢC & MỞ RỘNG DỄ DÀNG) ---

/**
 * Vẽ lớp phủ tối dần ở đáy ảnh (Bottom Vignette) giúp chữ trắng/vàng luôn đọc rõ trên mọi nền áo sáng
 */
export function drawBottomVignette(ctx, width, height, shadowStrength = 0.35) {
    if (!shadowStrength || shadowStrength <= 0) return;
    ctx.save();
    const grad = ctx.createLinearGradient(0, height * 0.58, 0, height);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    grad.addColorStop(0.55, `rgba(0, 0, 0, ${(shadowStrength * 0.45).toFixed(2)})`);
    grad.addColorStop(1, `rgba(0, 0, 0, ${Math.min(0.95, shadowStrength * 1.15).toFixed(2)})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, height * 0.58, width, height * 0.42);
    ctx.restore();
}

/**
 * Engine vẽ Title dùng chung cho mọi Template (Original, Season26_27, UCL, UEL, WC26, và các Template tương lai)
 * @param {CanvasRenderingContext2D} ctx
 * @param {{width: number, height: number}} canvasInfo
 * @param {Object} settings - Chứa title, titleScale, titleOffsetY, highlightColor, bottomShadow
 * @param {Object} preset - Cấu hình mặc định của từng Template:
 *   - align: 'left' | 'center'
 *   - showLeftBar: boolean (vạch trắng đầu dòng như Original)
 *   - defaultHighlight: mã màu Hex mặc định của Template
 *   - baseFontRatio: tỉ lệ cỡ chữ so với width (mặc định 0.04)
 *   - centerYRatio: vị trí Y chuẩn theo % chiều cao
 */
export function drawStudioTitle(ctx, canvasInfo, settings = {}, preset = {}) {
    const { width, height } = canvasInfo;
    const rawTitle = settings.title || "Hãy nhập {title}";
    const lines = rawTitle.split('\n');

    const align = preset.align || 'left';
    const showLeftBar = Boolean(preset.showLeftBar);
    const highlightColor = settings.highlightColor || preset.defaultHighlight || '#eeff55';

    const userScale = (parseFloat(settings.titleScale) || 100) / 100;
    const userOffsetY = parseFloat(settings.titleOffsetY) || 0;

    const baseRatio = preset.baseFontRatio || (lines.length === 1 ? 0.04 : 0.041);
    const titleFontSize = Math.round(width * baseRatio * userScale);
    const lineHeight = Math.round(titleFontSize * (preset.lineHeightRatio || 1.38));

    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${titleFontSize}px Albula, Arial, sans-serif`;

    // Tính tọa độ Y dòng đầu tiên (startY)
    const baseCenterY = (height * (preset.centerYRatio || 0.92)) + userOffsetY;
    let startY;
    if (lines.length === 1) {
        startY = baseCenterY;
    } else if (lines.length === 2 && align === 'center') {
        startY = baseCenterY - (lineHeight / 2);
    } else {
        const baseBottomY = baseCenterY + (lineHeight / 2);
        startY = baseBottomY - (lines.length - 1) * lineHeight;
    }

    const spacingPx = Math.round(titleFontSize * (preset.kerningRatio ?? -0.06));

    // Nếu căn trái và có vạch đứng đầu dòng (như Original Template)
    const titlePaddingX = width * (preset.leftPaddingRatio || 0.05);
    const barWidth = showLeftBar ? titleFontSize * 0.18 : 0;

    if (showLeftBar && align === 'left') {
        let barY, barHeight;
        if (lines.length === 1) {
            barHeight = titleFontSize * 1.85;
            barY = startY - barHeight / 2;
        } else {
            const lastLineY = startY + (lines.length - 1) * lineHeight;
            const textBottom = lastLineY + (titleFontSize * 0.45);
            barY = startY - (titleFontSize * 0.45);
            barHeight = textBottom - barY;
        }
        ctx.fillStyle = 'white';
        ctx.fillRect(titlePaddingX, barY, barWidth, barHeight);
    }

    function drawTextTight(textStr, x, y) {
        let currX = x;
        const chars = Array.from(textStr.normalize('NFC'));
        for (let i = 0; i < chars.length; i++) {
            const char = chars[i];
            ctx.fillText(char, currX, y);
            currX += ctx.measureText(char).width + spacingPx;
        }
        return currX;
    }

    lines.forEach((line, index) => {
        const currentY = startY + (index * lineHeight);
        const textParts = line.split(/({[^}]+})/g);

        let currentX = showLeftBar
            ? titlePaddingX + barWidth + (titleFontSize * 0.4)
            : titlePaddingX;

        if (align === 'center') {
            let totalWidth = 0;
            textParts.forEach(part => {
                if (part.length > 0) {
                    const cleanText = (part.startsWith('{') && part.endsWith('}')) ? part.slice(1, -1) : part;
                    const chars = Array.from(cleanText.normalize('NFC'));
                    for (let i = 0; i < chars.length; i++) {
                        totalWidth += ctx.measureText(chars[i]).width + spacingPx;
                    }
                }
            });
            if (totalWidth > 0) totalWidth -= spacingPx;
            currentX = (width - totalWidth) / 2;
        }

        textParts.forEach(part => {
            if (!part) return;
            if (part.startsWith('{') && part.endsWith('}')) {
                ctx.fillStyle = highlightColor;
                currentX = drawTextTight(part.slice(1, -1), currentX, currentY);
            } else {
                ctx.fillStyle = 'white';
                currentX = drawTextTight(part, currentX, currentY);
            }
        });
    });

    ctx.restore();
}