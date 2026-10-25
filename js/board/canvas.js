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
        const img = new Image();
        img.onload = () => {
            customBgImage = img;
            resolve(img);
        };
        img.src = imgUrl;
    });
};

export const clearCustomBackground = () => {
    customBgImage = null;
};

export function resizeCanvas(pitchType) {
    const container = document.querySelector('.canvas-area');
    if (!container) return responsiveConstant;

    const kfBar = document.querySelector('.keyframe-bar');
    const zoomCtrl = document.querySelector('.zoom-controls');

    const kfHeight = kfBar ? kfBar.offsetHeight + 14 : 60;
    const zoomHeight = zoomCtrl ? zoomCtrl.offsetHeight + 12 : 34;

    // Diện tích thực tế còn lại dành riêng cho mặt sân
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

export const saveCustomBackgroundToStorage = () => {
    if (!customBgImage) {
        localStorage.removeItem('customBgData');
        return;
    }

    const tempCanvas = document.createElement('canvas');
    const ctxTemp = tempCanvas.getContext('2d');

    const maxWidth = 1280;
    let w = customBgImage.naturalWidth;
    let h = customBgImage.naturalHeight;

    if (w > maxWidth) {
        h = Math.round(h * (maxWidth / w));
        w = maxWidth;
    }

    tempCanvas.width = w;
    tempCanvas.height = h;
    ctxTemp.drawImage(customBgImage, 0, 0, w, h);

    try {
        const dataURL = tempCanvas.toDataURL('image/jpeg', 0.7);
        localStorage.setItem('customBgData', dataURL);
    } catch (e) {
        console.warn("Image too large to save to LocalStorage");
    }
};

export const loadCustomBackgroundFromStorage = () => {
    return new Promise((resolve) => {
        const dataURL = localStorage.getItem('customBgData');
        if (dataURL) {
            const img = new Image();
            img.onload = () => {
                customBgImage = img;
                resolve(true);
            };
            img.onerror = () => {
                localStorage.removeItem('customBgData');
                resolve(false);
            };
            img.src = dataURL;
        } else {
            resolve(false);
        }
    });
};

export function drawPitch(pitchType) {
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
}

export function clearCanvas() {
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
}