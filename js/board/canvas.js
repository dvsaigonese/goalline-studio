// js/board/canvas.js
import { ASSETS, CONFIG } from './config.js';

export const canvas = document.getElementById("canvas");
export const ctx = canvas.getContext("2d");

let customBgImage = null;

const images = {};
export const loadImages = () => {
    return new Promise((resolve) => {
        let loaded = 0;
        const total = Object.keys(ASSETS).length;
        Object.keys(ASSETS).forEach(key => {
            const img = new Image();
            img.src = ASSETS[key];
            img.onload = () => { loaded++; images[key] = img; if (loaded === total) resolve(images); };
            img.onerror = () => { loaded++; if (loaded === total) resolve(images); };
        });
    });
};
export const getImages = () => images;

export let responsiveConstant = 1;

export const setCustomBackground = (imgUrl) => {
    return new Promise((resolve) => {
        if (!imgUrl) {
            customBgImage = null;
            resolve(null);
            return;
        }
        const img = new Image();
        img.onload = () => {
            customBgImage = img;
            resolve(img);
        };
        img.onerror = () => {
            customBgImage = null;
            resolve(null);
        };
        img.src = imgUrl;
    });
};

export const clearCustomBackground = () => {
    customBgImage = null;
};

export const getCustomBackground = () => customBgImage;

export function resizeCanvas(pitchType) {
    const container = document.querySelector('.canvas-area');
    if (!container) return responsiveConstant;

    const kfBar = document.querySelector('.keyframe-bar');
    const zoomCtrl = document.querySelector('.zoom-controls');

    const kfHeight = kfBar ? kfBar.offsetHeight + 14 : 60;
    const zoomHeight = zoomCtrl ? zoomCtrl.offsetHeight + 12 : 34;

    const availWidth = Math.max(280, container.clientWidth - 36);
    const availHeight = Math.max(220, container.clientHeight - kfHeight - zoomHeight - 28);
    const dpr = window.devicePixelRatio || 1;

    let baseW, baseH;
    if (customBgImage) {
        baseW = customBgImage.naturalWidth || CONFIG.baseWidth;
        baseH = customBgImage.naturalHeight || CONFIG.baseHeight;
    } else {
        baseW = CONFIG.baseWidth;
        baseH = CONFIG.baseHeight;
        if (pitchType === "half") baseW = baseW * 0.82;
    }

    const scaleX = availWidth / baseW;
    const scaleY = availHeight / baseH;
    responsiveConstant = Math.min(scaleX, scaleY) * 0.96;

    const cssWidth = Math.floor(baseW * responsiveConstant);
    const cssHeight = Math.floor(baseH * responsiveConstant);

    canvas.width = Math.floor(cssWidth * dpr);
    canvas.height = Math.floor(cssHeight * dpr);
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    return responsiveConstant;
}

export function drawPitch(pitchType, gridOverlay = 'none') {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    if (customBgImage) {
        ctx.drawImage(customBgImage, 0, 0, w, h);
    } else {
        if (pitchType === "horizontal" && images.pitchHorizontal) {
            ctx.drawImage(images.pitchHorizontal, 0, 0, w, h);
        } else if (pitchType === "vertical" && images.pitchVertical) {
            ctx.drawImage(images.pitchVertical, 0, 0, w, h);
        } else if (pitchType === "half" && images.pitchHalf) {
            ctx.drawImage(images.pitchHalf, 0, 0, w, h);
        }
    }

    if (gridOverlay && gridOverlay !== 'none') {
        drawTacticalGridOverlay(w, h, pitchType, gridOverlay);
    }
}

function drawTacticalGridOverlay(w, h, pitchType, gridOverlay) {
    ctx.save();
    // Căn lề chuẩn theo đường biên trắng của mặt sân Goal-Line
    const padX = w * 0.065;
    const padY = h * 0.085;
    const pw = w - padX * 2;
    const ph = h - padY * 2;

    ctx.strokeStyle = "rgba(255, 230, 0, 0.42)";
    ctx.lineWidth = 1.6;
    ctx.setLineDash([8, 6]);
    ctx.font = `800 ${Math.round(12 * responsiveConstant)}px "JetBrains Mono", monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    if (gridOverlay === '5-lanes') {
        const isVert = (pitchType === 'vertical' || pitchType === 'half');
        const ratios = [0.2, 0.4, 0.6, 0.8];
        const labels = ["WIDE", "HALF-SPACE", "CENTER", "HALF-SPACE", "WIDE"];

        ctx.fillStyle = "rgba(255, 230, 0, 0.07)";
        if (!isVert) {
            ctx.fillRect(padX, padY + ph * 0.2, pw, ph * 0.2);
            ctx.fillRect(padX, padY + ph * 0.6, pw, ph * 0.2);
            ratios.forEach(r => {
                ctx.beginPath();
                ctx.moveTo(padX, padY + ph * r);
                ctx.lineTo(padX + pw, padY + ph * r);
                ctx.stroke();
            });
            ctx.fillStyle = "rgba(255, 230, 0, 0.75)";
            labels.forEach((lb, i) => {
                ctx.fillText(lb, padX + pw / 2, padY + ph * (i * 0.2 + 0.1));
            });
        } else {
            ctx.fillRect(padX + pw * 0.2, padY, pw * 0.2, ph);
            ctx.fillRect(padX + pw * 0.6, padY, pw * 0.2, ph);
            ratios.forEach(r => {
                ctx.beginPath();
                ctx.moveTo(padX + pw * r, padY);
                ctx.lineTo(padX + pw * r, padY + ph);
                ctx.stroke();
            });
            ctx.fillStyle = "rgba(255, 230, 0, 0.75)";
            labels.forEach((lb, i) => {
                ctx.fillText(lb, padX + pw * (i * 0.2 + 0.1), padY + ph * 0.5);
            });
        }
    } else if (gridOverlay === '18-zones') {
        if (pitchType === 'half') {
            // NỬA SÂN TẤN CÔNG (Hướng lên gôn trên): Lưới 3x3 lấy ZONE 14 làm tâm điểm tỏa ra Z10..Z18
            const cols = 3;
            const rows = 3;
            const cellW = pw / cols;
            const cellH = ph / rows;

            // Tô nổi bật ô trung tâm ZONE 14 (hàng giữa r=1, cột giữa c=1)
            ctx.fillStyle = "rgba(255, 230, 0, 0.16)";
            ctx.fillRect(padX + cellW, padY + cellH, cellW, cellH);
            ctx.save();
            ctx.setLineDash([]);
            ctx.strokeStyle = "#ffe600";
            ctx.lineWidth = 2.5;
            ctx.strokeRect(padX + cellW, padY + cellH, cellW, cellH);
            ctx.restore();

            for (let c = 1; c < cols; c++) {
                ctx.beginPath();
                ctx.moveTo(padX + cellW * c, padY);
                ctx.lineTo(padX + cellW * c, padY + ph);
                ctx.stroke();
            }
            for (let r = 1; r < rows; r++) {
                ctx.beginPath();
                ctx.moveTo(padX, padY + cellH * r);
                ctx.lineTo(padX + pw, padY + cellH * r);
                ctx.stroke();
            }

            // Ma trận 9 Zone nửa sân tấn công (Hàng trên cùng sát gôn là Z16-Z17-Z18, Tâm là Z14, Hàng dưới là Z10-Z11-Z12)
            const halfZones = [
                [16, 17, 18],
                [13, 14, 15],
                [10, 11, 12]
            ];

            for (let r = 0; r < 3; r++) {
                for (let c = 0; c < 3; c++) {
                    const zNum = halfZones[r][c];
                    const zx = padX + cellW * (c + 0.5);
                    const zy = padY + cellH * (r + 0.5);
                    if (zNum === 14) {
                        ctx.font = `900 ${Math.round(14 * responsiveConstant)}px "JetBrains Mono", monospace`;
                        ctx.fillStyle = "#ffe600";
                        ctx.fillText("ZONE 14 ★", zx, zy);
                    } else {
                        ctx.font = `800 ${Math.round(12 * responsiveConstant)}px "JetBrains Mono", monospace`;
                        ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
                        ctx.fillText(`Z${zNum}`, zx, zy);
                    }
                }
            }
        } else if (pitchType === 'horizontal') {
            // SÂN NGANG FULL (Tấn công từ Trái -> Phải: 1/3 Đầu sân -> 1/3 Giữa sân -> 1/3 Cuối sân)
            // 6 cột dọc (c = 0..5) x 3 hành lang ngang (r = 0..2: Trái, Trung lộ, Phải)
            const cols = 6;
            const rows = 3;
            const cellW = pw / cols;
            const cellH = ph / rows;

            // Tô nổi bật ZONE 14 (Cột thứ 5: c=4, Hành lang Trung lộ: r=1)
            ctx.fillStyle = "rgba(255, 230, 0, 0.16)";
            ctx.fillRect(padX + cellW * 4, padY + cellH * 1, cellW, cellH);
            ctx.save();
            ctx.setLineDash([]);
            ctx.strokeStyle = "#ffe600";
            ctx.lineWidth = 2.2;
            ctx.strokeRect(padX + cellW * 4, padY + cellH * 1, cellW, cellH);
            ctx.restore();

            for (let c = 1; c < cols; c++) {
                ctx.beginPath();
                ctx.moveTo(padX + cellW * c, padY);
                ctx.lineTo(padX + cellW * c, padY + ph);
                ctx.stroke();
            }
            for (let r = 1; r < rows; r++) {
                ctx.beginPath();
                ctx.moveTo(padX, padY + cellH * r);
                ctx.lineTo(padX + pw, padY + cellH * r);
                ctx.stroke();
            }

            // Đánh số chuẩn theo cột tấn công từ Trái sang Phải: Cột c có 3 zone (c*3 + 1, c*3 + 2, c*3 + 3)
            for (let c = 0; c < cols; c++) {
                for (let r = 0; r < rows; r++) {
                    const zNum = c * 3 + r + 1;
                    const zx = padX + cellW * (c + 0.5);
                    const zy = padY + cellH * (r + 0.5);
                    if (zNum === 14) {
                        ctx.font = `900 ${Math.round(13 * responsiveConstant)}px "JetBrains Mono", monospace`;
                        ctx.fillStyle = "#ffe600";
                        ctx.fillText("ZONE 14 ★", zx, zy);
                    } else {
                        ctx.font = `800 ${Math.round(11 * responsiveConstant)}px "JetBrains Mono", monospace`;
                        ctx.fillStyle = (zNum === 5) ? "rgba(0, 240, 118, 0.85)" : "rgba(255, 255, 255, 0.45)";
                        ctx.fillText(`Z${zNum}`, zx, zy);
                    }
                }
            }
        } else {
            // SÂN DỌC FULL (Tấn công từ Dưới -> Lên Trên)
            // 3 cột ngang (Trái - Trung lộ - Phải) x 6 hàng dọc (từ Dưới lên Trên)
            const cols = 3;
            const rows = 6;
            const cellW = pw / cols;
            const cellH = ph / rows;

            // ZONE 14 nằm ở Hàng thứ 2 từ trên xuống (r=1), Cột giữa (c=1)
            ctx.fillStyle = "rgba(255, 230, 0, 0.16)";
            ctx.fillRect(padX + cellW * 1, padY + cellH * 1, cellW, cellH);
            ctx.save();
            ctx.setLineDash([]);
            ctx.strokeStyle = "#ffe600";
            ctx.lineWidth = 2.2;
            ctx.strokeRect(padX + cellW * 1, padY + cellH * 1, cellW, cellH);
            ctx.restore();

            for (let c = 1; c < cols; c++) {
                ctx.beginPath();
                ctx.moveTo(padX + cellW * c, padY);
                ctx.lineTo(padX + cellW * c, padY + ph);
                ctx.stroke();
            }
            for (let r = 1; r < rows; r++) {
                ctx.beginPath();
                ctx.moveTo(padX, padY + cellH * r);
                ctx.lineTo(padX + pw, padY + cellH * r);
                ctx.stroke();
            }

            // Đánh số từ Dưới (sân nhà: Z1..Z3) lên Trên (sân khách: Z16..Z18)
            for (let r = 0; r < rows; r++) {
                const attackRow = (rows - 1) - r; // 0 ở đáy sân -> 5 ở đỉnh sân
                for (let c = 0; c < cols; c++) {
                    const zNum = attackRow * 3 + c + 1;
                    const zx = padX + cellW * (c + 0.5);
                    const zy = padY + cellH * (r + 0.5);
                    if (zNum === 14) {
                        ctx.font = `900 ${Math.round(13 * responsiveConstant)}px "JetBrains Mono", monospace`;
                        ctx.fillStyle = "#ffe600";
                        ctx.fillText("ZONE 14 ★", zx, zy);
                    } else {
                        ctx.font = `800 ${Math.round(11 * responsiveConstant)}px "JetBrains Mono", monospace`;
                        ctx.fillStyle = (zNum === 5) ? "rgba(0, 240, 118, 0.85)" : "rgba(255, 255, 255, 0.45)";
                        ctx.fillText(`Z${zNum}`, zx, zy);
                    }
                }
            }
        }
    } else if (gridOverlay === 'thirds') {
        const isVert = (pitchType === 'vertical' || pitchType === 'half');
        [1 / 3, 2 / 3].forEach(r => {
            ctx.beginPath();
            if (!isVert) {
                ctx.moveTo(padX + pw * r, padY);
                ctx.lineTo(padX + pw * r, padY + ph);
            } else {
                ctx.moveTo(padX, padY + ph * r);
                ctx.lineTo(padX + pw, padY + ph * r);
            }
            ctx.stroke();
        });
    }

    ctx.restore();
}

export function clearCanvas() {
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
}