import { ASSETS, CONFIG } from './config.js';

export const canvas = document.getElementById("canvas");
export const ctx = canvas.getContext("2d");

// Biến lưu ảnh Custom (nếu có)
let customBgImage = null;

// Preload Images (Giữ nguyên)
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

/**
 * Hàm set ảnh custom từ input file
 * @param {string} imgUrl - URL của ảnh (blob url hoặc data base64)
 */
export const setCustomBackground = (imgUrl) => {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            customBgImage = img; // Lưu vào biến toàn cục
            resolve(img);
        };
        img.src = imgUrl;
    });
};

/**
 * Hàm xóa custom background (để quay về mode template)
 */
export const clearCustomBackground = () => {
    customBgImage = null;
};

export function resizeCanvas(pitchType) {
    const container = document.querySelector('.canvas-area'); 
    const containerWidth = container ? container.clientWidth : window.innerWidth;
    const containerHeight = container ? container.clientHeight : window.innerHeight;
    const dpr = window.devicePixelRatio || 1;

    // --- LOGIC MỚI: Xác định Base Size ---
    let baseW, baseH;

    if (customBgImage) {
        // Nếu đang dùng ảnh custom: Base size = Kích thước thật của ảnh
        baseW = customBgImage.naturalWidth;
        baseH = customBgImage.naturalHeight;
    } else {
        // Nếu dùng Template: Base size lấy từ Config
        baseW = CONFIG.baseWidth;
        baseH = CONFIG.baseHeight;
        if (pitchType === "half") baseW = baseW * 0.82;
    }
    // -------------------------------------

    // Tính toán tỉ lệ scale để lấp đầy 95% vùng chứa (Logic Fit)
    const scaleX = containerWidth / baseW;
    const scaleY = containerHeight / baseH;
    responsiveConstant = Math.min(scaleX, scaleY) * 0.95; 

    const cssWidth = baseW * responsiveConstant;
    const cssHeight = baseH * responsiveConstant;

    canvas.width = Math.floor(cssWidth * dpr);
    canvas.height = Math.floor(cssHeight * dpr);
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;

    ctx.setTransform(1, 0, 0, 1, 0, 0); 
    ctx.scale(dpr, dpr);

    return responsiveConstant;
}

/**
 * Lưu ảnh custom vào LocalStorage (có nén để giảm dung lượng)
 */
export const saveCustomBackgroundToStorage = () => {
    if (!customBgImage) {
        localStorage.removeItem('customBgData');
        return;
    }
    
    // Tạo canvas tạm để vẽ và nén ảnh
    const tempCanvas = document.createElement('canvas');
    const ctxTemp = tempCanvas.getContext('2d');
    
    // Giới hạn kích thước tối đa (ví dụ 1280px) để không quá nặng
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
    
    // Chuyển thành Base64 (JPEG quality 0.7)
    try {
        const dataURL = tempCanvas.toDataURL('image/jpeg', 0.7);
        localStorage.setItem('customBgData', dataURL);
    } catch (e) {
        console.warn("Image too large to save to LocalStorage");
        alert("Warning: This image is too large to be saved for next time. Please use a smaller image.");
    }
};

/**
 * Load ảnh từ LocalStorage khi khởi động lại
 */
export const loadCustomBackgroundFromStorage = () => {
    return new Promise((resolve) => {
        const dataURL = localStorage.getItem('customBgData');
        if (dataURL) {
            const img = new Image();
            img.onload = () => {
                customBgImage = img;
                resolve(true); // Có ảnh custom
            };
            img.onerror = () => {
                localStorage.removeItem('customBgData'); // Ảnh lỗi thì xóa
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

    // --- LOGIC MỚI: Ưu tiên vẽ ảnh Custom ---
    if (customBgImage) {
        // Vẽ ảnh custom full canvas
        ctx.drawImage(customBgImage, 0, 0, w, h);
    } else {
        // Logic vẽ template cũ
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