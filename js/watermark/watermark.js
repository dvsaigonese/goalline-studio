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

// Các select elements (Dual-select pattern bảo toàn layout.js)
const templateMode = document.getElementById('template-mode');
const activeSelect = document.getElementById('active-template');
const retroSelect = document.getElementById('retro-template');

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

    if (emptyState) {
        emptyState.style.display = hasAnyImage() ? 'none' : 'block';
    }

    drawCollageBackground();
    applyGlobalFilters();

    if (hasAnyImage()) {
        const currentTemplateId = templateMode.value;
        const template = getTemplate(currentTemplateId);

        const canvasInfo = { width: canvas.width, height: canvas.height };
        const globalState = {
            assets: globalAssets,
            settings: {
                title: titleInput ? titleInput.value : '',
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
            ctx.fillStyle = '#111';
            ctx.fillRect(slotX, slotY, slotW, slotH);
            ctx.fillStyle = '#fff';
            ctx.font = '900 80px "Space Grotesk", Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(index + 1, slotX + slotW / 2, slotY + slotH / 2);
        }
        ctx.restore();

        // Viền theo phong cách Neobrutalism cho slot đang active
        if (index === collageState.activeSlotIndex) {
            ctx.strokeStyle = '#ffe600'; 
            ctx.lineWidth = 12;
            ctx.strokeRect(slotX + 6, slotY + 6, slotW - 12, slotH - 12);
        }

        if (collageState.slots.length > 1) {
            ctx.strokeStyle = '#000000'; 
            ctx.lineWidth = 6;
            ctx.strokeRect(slotX, slotY, slotW, slotH);
        }
    });
    ctx.restore();
}

function applyGlobalFilters() {
    const uiBrightness = overallBrightnessInput ? parseFloat(overallBrightnessInput.value) : 100;
    const realBrightness = uiBrightness * 1.2; 

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
initCanvasEvents(canvas, renderAll);
const { applyLayout } = initLayoutManager(renderAll);
initLeagueManager(renderAll);

// ==========================================
// --- SỰ KIỆN GIAO DIỆN CHUNG & EXPORT ---
// ==========================================
const debouncedRender = debounce(() => renderAll(), 100);

if (titleInput) titleInput.addEventListener('input', debouncedRender);
patternOpacityInput?.addEventListener('input', debouncedRender);
overallBrightnessInput?.addEventListener('input', debouncedRender);
grainIntensityInput?.addEventListener('input', debouncedRender);

function handleTemplateSwitch(val, otherSelect) {
    if (otherSelect) otherSelect.value = '';
    templateMode.value = val;
    templateMode.dispatchEvent(new Event('change'));
}

activeSelect?.addEventListener('change', (e) => handleTemplateSwitch(e.target.value, retroSelect));
retroSelect?.addEventListener('change', (e) => handleTemplateSwitch(e.target.value, activeSelect));

templateMode.addEventListener('change', () => {
    applyLayout(true); 
    loadAssetsForCurrentTemplate();

    if (leagueSection) {
        leagueSection.style.display = templateMode.value === 'Season26_27' ? 'block' : 'none';
    }
});

exportBtn.addEventListener('click', async () => {
    if (!hasAnyImage()) { 
        alert("PLEASE UPLOAD AT LEAST ONE IMAGE!"); 
        return; 
    }

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