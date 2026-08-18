import { debounce } from './utils.js';
import { getTemplate } from './templates/TemplateManager.js';

// DOM Elements
const canvas = document.getElementById('wm-canvas');
const ctx = canvas.getContext('2d');
const titleInput = document.getElementById('wm-title');
const exportBtn = document.getElementById('export-wm-btn');
const emptyState = document.getElementById('empty-state');
const fileInputsContainer = document.getElementById('file-inputs-container');
const collageInstructions = document.getElementById('collage-instructions');

//pick league
const leagueSection = document.getElementById('league-section');
const leagueInput = document.getElementById('league-search-input');
const leagueResults = document.getElementById('league-search-results');

// chia ảnh
const layoutMode = document.getElementById('layout-mode');
const collageOptions = document.getElementById('collage-options');
const splitDirection = document.getElementById('split-direction');
const splitCount = document.getElementById('split-count');
const templateMode = document.getElementById('template-mode');

//chỉnh sáng tối ảnh
const patternOpacityInput = document.getElementById('pattern-opacity');
const patternValDisplay = document.getElementById('pattern-val');
const grainIntensityInput = document.getElementById('grain-intensity');
const grainValDisplay = document.getElementById('grain-val');
const overallBrightnessInput = document.getElementById('overall-brightness');
const brightnessValDisplay = document.getElementById('brightness-val');

// CẤU HÌNH CỐ ĐỊNH TARGET
const TARGET_WIDTH = 1200; 
const TARGET_HEIGHT = 1500; 
canvas.width = TARGET_WIDTH;
canvas.height = TARGET_HEIGHT;

// Quản lý tài nguyên chung
let globalAssets = {}; 

let collageState = {
    slots: [], 
    activeSlotIndex: null, 
    isDragging: false,
    lastMouseX: 0,
    lastMouseY: 0,
    isPinching: false,
    initialPinchDistance: 0
};

let LEAGUES_DATA = []; 
let selectedLeagueName = '';

fetch('assets/data/leagues_clubs.json')
    .then(response => {
        if (!response.ok) throw new Error("Chưa có file JSON");
        return response.json();
    })
    .then(data => {
        LEAGUES_DATA = data;
    })
    .catch(() => {
        console.warn("Chưa tải được danh sách giải đấu. Vui lòng chờ GitHub Actions chạy xong.");
    });

// ==========================================
// --- LAYOUT & GRID ---
// ==========================================

function generateLayoutConfig() {
    const mode = layoutMode.value;
    const config = [];
    const isWC26 = templateMode.value === 'wc26';
    const visibleRatio = isWC26 ? 0.87 : 1.0; 

    if (mode === 'single') {
        config.push({ x: 0, y: 0, w: 1, h: 1 });
    } else {
        const direction = splitDirection.value;
        const count = parseInt(splitCount.value) || 2;

        for (let i = 0; i < count; i++) {
            if (direction === 'vertical') {
                config.push({ x: i / count, y: 0, w: 1 / count, h: 1 });
            } else {
                let startY = i * (visibleRatio / count);
                let slotH = visibleRatio / count;
                if (i === count - 1) slotH = 1.0 - startY; 
                config.push({ x: 0, y: startY, w: 1, h: slotH });
            }
        }
    }
    return config;
}

function applyLayout(keepImages = true) {
    const newConfig = generateLayoutConfig();
    const oldSlots = collageState.slots;

    const newSlots = newConfig.map((rect, i) => {
        const slotAspectRatio = rect.w * TARGET_WIDTH / (rect.h * TARGET_HEIGHT);
        let imgToKeep = null;
        if (keepImages && oldSlots[i] && oldSlots[i].img) imgToKeep = oldSlots[i].img;

        const slot = {
            ...rect,
            img: imgToKeep,
            scale: 1,  
            offsetX: 0, 
            offsetY: 0,
            aspectRatio: slotAspectRatio
        };

        if (imgToKeep) {
            const imgAR = imgToKeep.naturalWidth / imgToKeep.naturalHeight;
            if (imgAR > slotAspectRatio) {
                slot.scale = (rect.h * TARGET_HEIGHT) / imgToKeep.naturalHeight;
            } else {
                slot.scale = (rect.w * TARGET_WIDTH) / imgToKeep.naturalWidth;
            }
        }
        return slot;
    });

    collageState.slots = newSlots;
    collageState.activeSlotIndex = null;
    generateFileInputs();
    renderAll();
}

layoutMode.addEventListener('change', (e) => {
    collageOptions.style.display = e.target.value === 'collage' ? 'block' : 'none';
    applyLayout(true);
});
splitDirection.addEventListener('change', () => applyLayout(true));
splitCount.addEventListener('input', () => {
    let val = parseInt(splitCount.value);
    if (val < 2) splitCount.value = 2; 
    if (val > 10) splitCount.value = 10; 
    applyLayout(true);
});


// ==========================================
// --- TƯƠNG TÁC CANVAS (ZOOM/DRAG) ---
// ==========================================

function getCanvasCoordinates(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
}

function handleMouseDown(e) {
    if (!hasAnyImage()) return;

    if (e.touches && e.touches.length === 2) {
        collageState.isPinching = true;
        collageState.isDragging = false; 
        collageState.initialPinchDistance = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
        );
        return; 
    }

    if (e.touches && e.touches.length > 1) return;
    const coords = getCanvasCoordinates(e);

    let foundIndex = -1;
    for (let i = 0; i < collageState.slots.length; i++) {
        const slot = collageState.slots[i];
        const slotX = slot.x * canvas.width;
        const slotY = slot.y * canvas.height;
        const slotW = slot.w * canvas.width;
        const slotH = slot.h * canvas.height;

        if (coords.x >= slotX && coords.x <= slotX + slotW && 
            coords.y >= slotY && coords.y <= slotY + slotH) {
            foundIndex = i;
            break;
        }
    }

    if (foundIndex !== -1 && collageState.slots[foundIndex].img) {
        collageState.activeSlotIndex = foundIndex;
        collageState.isDragging = true;
        collageState.lastMouseX = coords.x;
        collageState.lastMouseY = coords.y;
        canvas.classList.add('editing');
        if (collageInstructions) collageInstructions.style.display = 'block';
        renderAll(); 
    }
}

function handleMouseMove(e) {
    if (e.touches && e.touches.length === 2 && collageState.isPinching) {
        e.preventDefault(); 
        const currentDistance = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
        );

        if (collageState.activeSlotIndex !== null) {
            const slot = collageState.slots[collageState.activeSlotIndex];
            if (slot.img) {
                const distanceDiff = currentDistance - collageState.initialPinchDistance;
                const delta = distanceDiff * 0.008;
                slot.scale = Math.min(Math.max(0.1, slot.scale + delta), 10);
                renderAll();
            }
        }
        collageState.initialPinchDistance = currentDistance;
        return;
    }

    if (!collageState.isDragging || collageState.activeSlotIndex === null) return;
    if (e.touches && e.touches.length > 1) return; 
    e.preventDefault(); 

    const coords = getCanvasCoordinates(e);
    const slot = collageState.slots[collageState.activeSlotIndex];
    const dx = coords.x - collageState.lastMouseX;
    const dy = coords.y - collageState.lastMouseY;

    slot.offsetX += dx / slot.scale;
    slot.offsetY += dy / slot.scale;
    collageState.lastMouseX = coords.x;
    collageState.lastMouseY = coords.y;
    renderAll(); 
}

function handleMouseUp(e) {
    if (!e || !e.touches || e.touches.length < 2) collageState.isPinching = false;
    if (!e || !e.touches || e.touches.length === 0) collageState.isDragging = false;
}

function handleWheel(e) {
    if (collageState.activeSlotIndex === null) return;
    const slot = collageState.slots[collageState.activeSlotIndex];
    if (!slot.img) return;

    e.preventDefault(); 
    const delta = e.deltaY > 0 ? -0.05 : 0.05; 
    slot.scale = Math.min(Math.max(0.1, slot.scale + delta), 10);
    renderAll();
}

function handleOutsideClick(e) {
    if (e.target !== canvas && collageState.activeSlotIndex !== null) {
        collageState.activeSlotIndex = null;
        canvas.classList.remove('editing');
        if (collageInstructions) collageInstructions.style.display = 'none';
        renderAll();
    }
}

window.addEventListener('mousedown', handleOutsideClick);
window.addEventListener('touchstart', handleOutsideClick, { passive: false });
canvas.addEventListener('mousedown', handleMouseDown);
window.addEventListener('mousemove', handleMouseMove);
window.addEventListener('mouseup', handleMouseUp);
canvas.addEventListener('wheel', handleWheel, { passive: false });
canvas.addEventListener('touchstart', handleMouseDown, { passive: false });
canvas.addEventListener('touchmove', handleMouseMove, { passive: false });
canvas.addEventListener('touchend', handleMouseUp);


// ==========================================
// --- TẢI ẢNH VÀO TỪNG SLOT ---
// ==========================================

function hasAnyImage() {
    return collageState.slots.some(slot => slot.img !== null);
}

function generateFileInputs() {
    fileInputsContainer.innerHTML = ''; 
    const numSlots = collageState.slots.length;
    for (let i = 0; i < numSlots; i++) {
        const group = document.createElement('div');
        group.className = 'row-input';
        group.style.marginBottom = '8px';
        group.style.alignItems = 'center';

        const label = document.createElement('small');
        label.style.width = '50px';
        label.style.color = 'var(--text-muted)';
        label.textContent = `Slot ${i + 1}:`;

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.className = 'form-control';
        input.style.padding = '3px';
        input.addEventListener('change', (e) => handleFileSelect(e, i));

        group.appendChild(label);
        group.appendChild(input);
        fileInputsContainer.appendChild(group);
    }
}

function handleFileSelect(e, slotIndex) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const slot = collageState.slots[slotIndex];
                slot.img = img;
                const imgAR = img.naturalWidth / img.naturalHeight;
                if (imgAR > slot.aspectRatio) {
                    slot.scale = (slot.h * TARGET_HEIGHT) / img.naturalHeight;
                } else {
                    slot.scale = (slot.w * TARGET_WIDTH) / img.naturalWidth;
                }
                slot.offsetX = 0;
                slot.offsetY = 0;
                renderAll(); 
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }
}


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

    // CHỈ VẼ LỚP PHỦ NẾU CÓ ẢNH
    if (hasAnyImage()) {
        const currentTemplateId = templateMode.value;
        const template = getTemplate(currentTemplateId);

        const canvasInfo = { width: canvas.width, height: canvas.height };
        const globalState = {
            assets: globalAssets,
            settings: {
                title: titleInput.value,
                patternOpacity: patternOpacityInput ? parseFloat(patternOpacityInput.value) : 0.15,
                grainIntensity: grainIntensityInput ? parseFloat(grainIntensityInput.value) : 0.08,
                leagueName: selectedLeagueName
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
    const brightness = overallBrightnessInput ? overallBrightnessInput.value : 120;
    if (brightness !== 100) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        tempCanvas.getContext('2d').drawImage(canvas, 0, 0);

        ctx.save();
        ctx.filter = `brightness(${brightness}%)`;
        ctx.drawImage(tempCanvas, 0, 0);
        ctx.restore();
    }
}


// ==========================================
// --- SMART ASSET LOADING ---
// ==========================================

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
// --- SỰ KIỆN UI & EXPORT ---
// ==========================================

const debouncedRender = debounce(() => renderAll(), 100);

titleInput.addEventListener('input', debouncedRender);

patternOpacityInput?.addEventListener('input', (e) => {
    patternValDisplay.textContent = Math.round(e.target.value * 100) + '%';
    debouncedRender();
});
overallBrightnessInput?.addEventListener('input', (e) => {
    brightnessValDisplay.textContent = e.target.value + '%';
    debouncedRender();
});
grainIntensityInput?.addEventListener('input', (e) => {
    grainValDisplay.textContent = Math.round(e.target.value * 100) + '%';
    debouncedRender();
});

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
// --- LOGIC SEARCH & CHỌN GIẢI ĐẤU ---
// ==========================================
leagueInput?.addEventListener('input', (e) => {
    const keyword = e.target.value.toUpperCase();
    leagueResults.innerHTML = ''; 

    if (keyword.length === 0) {
        leagueResults.style.display = 'none';
        return;
    }

    const filtered = LEAGUES_DATA.filter(league => league.includes(keyword));
    
    if (filtered.length > 0) {
        leagueResults.style.display = 'block';
        filtered.forEach(league => {
            const li = document.createElement('li');
            li.style.display = 'flex';
            li.style.alignItems = 'center';
            li.style.gap = '10px';

            // Tạo Thumbnail Logo siêu nhỏ
            const img = document.createElement('img');
            img.src = `assets/img/watermarkFrame/leagueLogo/${league}.png`;
            img.style.width = '24px';
            img.style.height = '24px';
            img.style.objectFit = 'contain';

            const span = document.createElement('span');
            span.textContent = league;

            li.appendChild(img);
            li.appendChild(span);
            
            li.addEventListener('click', () => selectLeague(league));
            leagueResults.appendChild(li);
        });
    } else {
        leagueResults.style.display = 'none';
    }
});

document.addEventListener('click', (e) => {
    if (e.target !== leagueInput && e.target !== leagueResults) {
        leagueResults.style.display = 'none';
    }
});

function selectLeague(leagueName) {
    leagueInput.value = leagueName;
    selectedLeagueName = leagueName;
    leagueResults.style.display = 'none';

    const img = new Image();
    img.onload = () => {
        globalAssets.dynamicLeagueLogo = img; 
        renderAll(); 
    };
    img.onerror = () => {
        globalAssets.dynamicLeagueLogo = null; 
        renderAll();
    };
    img.src = `assets/img/watermarkFrame/leagueLogo/${leagueName}.png`; 
}

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

selectLeague('LA LIGA');

applyLayout(false);