import { debounce } from './utils.js';
import { getTemplate } from './templates/TemplateManager.js';

// Import Các Module chức năng
import { CONFIG, globalAssets, collageState, hasAnyImage } from './state.js';
import { initLeagueManager, getSelectedLeague } from './league.js';
import { initLayoutManager } from './layout.js';
import { initCanvasEvents } from './canvas-events.js';

// Khai báo DOM Elements chính
const canvas = document.getElementById('wm-canvas');
const ctx = canvas.getContext('2d');
const titleInput = document.getElementById('wm-title');
const exportBtn = document.getElementById('export-wm-btn');
const emptyState = document.getElementById('empty-state');
const templateMode = document.getElementById('template-mode');
const leagueSection = document.getElementById('league-section');
const collageInstructions = document.getElementById('collage-instructions');

// Khai báo DOM Slider & Filter
const patternOpacityInput = document.getElementById('pattern-opacity');
const patternValDisplay = document.getElementById('pattern-val');
const grainIntensityInput = document.getElementById('grain-intensity');
const grainValDisplay = document.getElementById('grain-val');
const overallBrightnessInput = document.getElementById('overall-brightness');
const brightnessValDisplay = document.getElementById('brightness-val');

// SETUP KÍCH THƯỚC CANVAS
canvas.width = CONFIG.TARGET_WIDTH;
canvas.height = CONFIG.TARGET_HEIGHT;

// ==========================================
// --- HÀM RENDER CHÍNH ---
// ==========================================
const renderAll = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.filter = 'none'; 
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    emptyState.style.display = hasAnyImage() ? 'none' : 'block';

    drawCollageBackground();
    applyGlobalFilters();

    if (hasAnyImage()) {
        const currentTemplateId = templateMode.value;
        const template = getTemplate(currentTemplateId);

        const canvasInfo = { width: canvas.width, height: canvas.height };
        const globalState = {
            assets: globalAssets,
            settings: {
                title: titleInput.value,
                patternOpacity: patternOpacityInput ? (parseFloat(patternOpacityInput.value) / 100) * 0.15 : 0.15,
                grainIntensity: grainIntensityInput ? (parseFloat(grainIntensityInput.value) / 100) * 0.08 : 0.08,
                leagueName: getSelectedLeague() 
            }
        };

        template.render(ctx, canvasInfo, globalState);
    }
};

function drawCollageBackground() {
    ctx.save();
    collageState.slots.forEach((slot, index) => {
        const slotX = slot.x * canvas.width;
        const slotY = slot.y * canvas.height;
        const slotW = slot.w * canvas.width;
        const slotH = slot.h * canvas.height;

        ctx.save();
        ctx.beginPath();
        ctx.rect(slotX, slotY, slotW, slotH);
        ctx.clip(); 

        if (slot.img) {
            const imgW = slot.img.naturalWidth * slot.scale;
            const imgH = slot.img.naturalHeight * slot.scale;
            const centerX = slotX + slotW / 2;
            const centerY = slotY + slotH / 2;
            ctx.drawImage(
                slot.img,
                centerX - imgW / 2 + (slot.offsetX * slot.scale),
                centerY - imgH / 2 + (slot.offsetY * slot.scale),
                imgW,
                imgH
            );
        } else {
            ctx.fillStyle = '#222';
            ctx.fillRect(slotX, slotY, slotW, slotH);
            ctx.fillStyle = '#444';
            ctx.font = 'bold 80px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(index + 1, slotX + slotW / 2, slotY + slotH / 2);
        }
        ctx.restore();

        if (index === collageState.activeSlotIndex) {
            ctx.strokeStyle = '#e2f90e'; 
            ctx.lineWidth = 10;
            ctx.strokeRect(slotX + 5, slotY + 5, slotW - 10, slotH - 10);
        }

        if (collageState.slots.length > 1) {
            ctx.strokeStyle = 'rgba(0,0,0,0.8)'; 
            ctx.lineWidth = 4;
            ctx.strokeRect(slotX, slotY, slotW, slotH);
        }
    });
    ctx.restore();
}

function applyGlobalFilters() {
    // Lấy số UI (mặc định 100)
    const uiBrightness = overallBrightnessInput ? parseFloat(overallBrightnessInput.value) : 100;
    
    // Mốc 100 = 120% độ sáng thực tế | Ví dụ gõ 150 -> 150 * 1.2 = 180%
    const realBrightness = uiBrightness * 1.2; 

    // Nếu độ sáng thực tế khác 100% (nghĩa là có filter) thì áp dụng
    if (realBrightness !== 100) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        tempCanvas.getContext('2d').drawImage(canvas, 0, 0);

        ctx.save();
        ctx.filter = `brightness(${realBrightness}%)`;
        ctx.drawImage(tempCanvas, 0, 0);
        ctx.restore();
    }
}

function loadAssetsForCurrentTemplate() {
    const currentTemplateId = templateMode.value;
    const template = getTemplate(currentTemplateId);
    const imagesToLoad = template.assetsToLoad || [];

    let loadedCount = 0;
    if (imagesToLoad.length === 0) return renderAll();

    imagesToLoad.forEach(imageData => {
        if (globalAssets[imageData.name]) {
            loadedCount++;
            if (loadedCount === imagesToLoad.length) renderAll();
            return;
        }

        const img = new Image();
        img.onload = () => {
            globalAssets[imageData.name] = img; 
            loadedCount++;
            if (loadedCount === imagesToLoad.length) renderAll();
        };
        img.onerror = () => { 
            loadedCount++; 
            if (loadedCount === imagesToLoad.length) renderAll(); 
        };
        img.src = imageData.src;
    });
}

// ==========================================
// --- KẾT NỐI (WIRING) CÁC MODULE LẠI ---
// ==========================================

// Nhúng hàm renderAll vào các module để mỗi khi thao tác, canvas sẽ tự vẽ lại
initCanvasEvents(canvas, renderAll);
const { applyLayout } = initLayoutManager(renderAll);
initLeagueManager(renderAll);


// ==========================================
// --- SỰ KIỆN GIAO DIỆN CHUNG & EXPORT ---
// ==========================================
const debouncedRender = debounce(() => renderAll(), 100);

titleInput.addEventListener('input', debouncedRender);

patternOpacityInput?.addEventListener('input', debouncedRender);
overallBrightnessInput?.addEventListener('input', debouncedRender);
grainIntensityInput?.addEventListener('input', debouncedRender);

templateMode.addEventListener('change', () => {
    applyLayout(true); 
    loadAssetsForCurrentTemplate();

    if(templateMode.value === 'Season26_27') {
        leagueSection.style.display = 'block';
    } else {
        leagueSection.style.display = 'none';
    }
});

exportBtn.addEventListener('click', async () => {
    if (!hasAnyImage()) { alert("Please upload at least one image!"); return; }

    collageState.activeSlotIndex = null;
    canvas.classList.remove('editing');
    if (collageInstructions) collageInstructions.style.display = 'none';
    renderAll();

    const dataUrl = canvas.toDataURL("image/jpeg", 1.0);

    if (navigator.canShare && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
        try {
            const response = await fetch(dataUrl);
            const blob = await response.blob();
            const file = new File([blob], 'Goal-Line_Collage.jpg', { type: 'image/jpeg' });
            if (navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file], title: 'Goal-Line Image' });
                return; 
            }
        } catch (error) { return; }
    }
    const link = document.createElement('a');
    link.download = 'Goal-Line_Collage.jpg';
    link.href = dataUrl;
    link.click();
});

// ==========================================
// --- KHỞI CHẠY APP ---
// ==========================================
if (document.fonts) {
    document.fonts.load('bold 16px "Albula"').then(() => {
        loadAssetsForCurrentTemplate();
    }).catch(() => {
        loadAssetsForCurrentTemplate();
    });
} else {
    loadAssetsForCurrentTemplate();
}

applyLayout(false);