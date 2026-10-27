// js/watermark/watermark.js
import { debounce } from './utils.js';
import { getTemplate } from './templates/TemplateManager.js';
import { GLDatabase } from '../shared/gl-db.js';

import { CONFIG, globalAssets, collageState, hasAnyImage } from './state.js';
import { initLeagueManager, getSelectedLeague } from './league.js';
import { initLayoutManager } from './layout.js';
import { initCanvasEvents } from './canvas-events.js';
import { CoverageGuard } from './coverage-guard.js';
import { LayoutResizer } from './layout-resizer.js';

// DOM Elements chính
const canvas = document.getElementById('wm-canvas');
const ctx = canvas.getContext('2d');
const titleInput = document.getElementById('wm-title');
const exportBtn = document.getElementById('export-wm-btn');
const copyBtn = document.getElementById('copy-wm-btn');
const pushMod7Btn = document.getElementById('push-mod7-btn');
const emptyState = document.getElementById('empty-state');

const templateMode = document.getElementById('template-mode');
const activeSelect = document.getElementById('active-template');
const retroSelect = document.getElementById('retro-template');
const ratioSelect = document.getElementById('canvas-ratio-select');
const resBadge = document.getElementById('canvas-res-badge');

const leagueSection = document.getElementById('league-section');
const collageInstructions = document.getElementById('collage-instructions');

// Typography & FX Controls
const titleScaleInput = document.getElementById('title-scale-input');
const titleOffsetYInput = document.getElementById('title-offset-y');
const titleHighlightColorInput = document.getElementById('title-highlight-color');
const bottomShadowSlider = document.getElementById('bottom-shadow-slider');
const dividerWidthInput = document.getElementById('divider-line-width');

const patternOpacityInput = document.getElementById('pattern-opacity');
const grainIntensityInput = document.getElementById('grain-intensity');
const overallBrightnessInput = document.getElementById('overall-brightness');

const statusTextEl = document.getElementById('wm-status-text');
const activeSlotPill = document.getElementById('active-slot-pill');

function setStatus(msg) {
    if (statusTextEl) statusTextEl.textContent = msg.toUpperCase();
}

function updateSlotToolbarIndicator() {
    const idx = collageState.activeSlotIndex;
    if (activeSlotPill) {
        activeSlotPill.textContent = idx !== null && idx >= 0 ? `SLOT #${idx + 1}` : 'NO SLOT';
        activeSlotPill.style.background = idx !== null && idx >= 0 ? 'var(--neo-green)' : 'var(--neo-black)';
        activeSlotPill.style.color = idx !== null && idx >= 0 ? '#000' : 'var(--neo-yellow)';
    }
}

// SETUP KÍCH THƯỚC CANVAS
canvas.width = CONFIG.TARGET_WIDTH;
canvas.height = CONFIG.TARGET_HEIGHT;

const coverageGuard = new CoverageGuard(canvas);
const layoutResizer = new LayoutResizer(canvas, collageState, () => {
    refreshAllQualityBadges();
    renderAll();
});

// ==========================================
// --- HÀM RENDER CHÍNH ---
// ==========================================
const renderAll = (isExport = false) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.filter = 'none';
    ctx.fillStyle = '#0a0a0c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (emptyState) {
        emptyState.style.display = hasAnyImage() ? 'none' : 'block';
    }

    drawCollageBackground(isExport);
    layoutResizer.drawCleanDividers(ctx);
    applyGlobalFilters();

    if (hasAnyImage()) {
        const currentTemplateId = templateMode.value;
        const template = getTemplate(currentTemplateId);

        const canvasInfo = { width: canvas.width, height: canvas.height };
        const globalState = {
            assets: globalAssets,
            settings: {
                title: titleInput ? titleInput.value : '',
                titleScale: titleScaleInput ? parseFloat(titleScaleInput.value) || 100 : 100,
                titleOffsetY: titleOffsetYInput ? parseFloat(titleOffsetYInput.value) || 0 : 0,
                highlightColor: titleHighlightColorInput ? titleHighlightColorInput.value : '#eeff55',
                bottomShadow: bottomShadowSlider ? (parseFloat(bottomShadowSlider.value) || 0) / 100 : 0.35,
                patternOpacity: patternOpacityInput ? (parseFloat(patternOpacityInput.value) / 100) * 0.15 : 0.15,
                grainIntensity: grainIntensityInput ? (parseFloat(grainIntensityInput.value) / 100) * 0.08 : 0.08,
                leagueName: getSelectedLeague()
            }
        };

        template.render(ctx, canvasInfo, globalState);
    }

    if (!isExport) {
        layoutResizer.drawDivider(ctx);
        coverageGuard.checkAndRender(ctx, collageState.slots);
    }
};

function drawCollageBackground(isExport = false) {
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
            const centerX = slotX + slotW / 2 + (slot.offsetX * slot.scale);
            const centerY = slotY + slotH / 2 + (slot.offsetY * slot.scale);

            ctx.save();
            if (slot.bw) {
                ctx.filter = 'grayscale(100%) contrast(108%)';
            }
            ctx.translate(centerX, centerY);
            if (slot.flipX) {
                ctx.scale(-1, 1);
            }
            ctx.drawImage(slot.img, -imgW / 2, -imgH / 2, imgW, imgH);
            ctx.restore();
        } else {
            ctx.fillStyle = '#111318';
            ctx.fillRect(slotX, slotY, slotW, slotH);
            ctx.fillStyle = 'rgba(255,255,255,0.22)';
            ctx.font = '900 72px "Space Grotesk", Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`#${index + 1}`, slotX + slotW / 2, slotY + slotH / 2);
        }
        ctx.restore();

        // Viền chọn vàng khi đang biên tập
        if (!isExport && index === collageState.activeSlotIndex) {
            ctx.save();
            ctx.strokeStyle = '#ffe600';
            ctx.lineWidth = 10;
            ctx.strokeRect(slotX + 5, slotY + 5, slotW - 10, slotH - 10);
            ctx.restore();
        }
    });
    ctx.restore();
}

function applyGlobalFilters() {
    const uiBrightness = overallBrightnessInput ? parseFloat(overallBrightnessInput.value) : 100;
    if (uiBrightness !== 100) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        tempCanvas.getContext('2d').drawImage(canvas, 0, 0);

        ctx.save();
        ctx.filter = `brightness(${uiBrightness}%)`;
        ctx.drawImage(tempCanvas, 0, 0);
        ctx.restore();
    }
}

function loadAssetsForCurrentTemplate() {
    const currentTemplateId = templateMode.value;
    const template = getTemplate(currentTemplateId);

    // Đồng bộ màu highlight mặc định của Template lên ô Color Picker
    if (titleHighlightColorInput && template.defaultHighlightColor) {
        titleHighlightColorInput.value = template.defaultHighlightColor;
    }

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
// --- KẾT NỐI CÁC MODULE ---
// ==========================================
const { applyLayout, loadImageIntoSlot, fitSlotImage, refreshAllQualityBadges } = initLayoutManager(
    renderAll,
    (slotIdx) => {
        updateSlotToolbarIndicator();
        setStatus(`ĐANG CHỌN Ô ẢNH #${slotIdx + 1} • CUỘN CHUỘT ĐỂ ZOOM HOẶC BẤM CTRL+V ĐỂ DÁN ẢNH MỚI`);
    }
);

initCanvasEvents(canvas, renderAll, {
    loadImageIntoSlot,
    fitSlotImage: (idx) => {
        fitSlotImage(idx);
        setStatus(`ĐÃ CĂN KHÍT LẠI ẢNH TRONG Ô #${idx + 1}`);
    },
    onSlotSelected: (idx) => {
        refreshAllQualityBadges();
        updateSlotToolbarIndicator();
    },
    onZoomChanged: () => {
        refreshAllQualityBadges();
    }
});

initLeagueManager(renderAll);

// ==========================================
// --- SỰ KIỆN GIAO DIỆN, CLIPBOARD PASTE & TOOLBAR ---
// ==========================================
const debouncedRender = debounce(() => renderAll(), 40);

[
    titleInput, titleScaleInput, titleOffsetYInput, titleHighlightColorInput,
    bottomShadowSlider, patternOpacityInput, grainIntensityInput, overallBrightnessInput
].forEach(el => {
    el?.addEventListener('input', debouncedRender);
});

dividerWidthInput?.addEventListener('input', (e) => {
    collageState.dividerLineWidth = Math.max(0, parseInt(e.target.value) || 0);
    renderAll();
});

// Nút Bôi vàng nhanh {từ khóa} trong ô Post Title
document.getElementById('btn-wrap-highlight')?.addEventListener('click', () => {
    if (!titleInput) return;
    const start = titleInput.selectionStart;
    const end = titleInput.selectionEnd;
    const val = titleInput.value;

    if (start !== end) {
        const selectedText = val.substring(start, end);
        // Nếu đã bọc { } rồi thì gỡ ra, chưa có thì bọc vào
        const wrapped = (selectedText.startsWith('{') && selectedText.endsWith('}'))
            ? selectedText.slice(1, -1)
            : `{${selectedText}}`;
        titleInput.value = val.substring(0, start) + wrapped + val.substring(end);
        titleInput.focus();
        titleInput.setSelectionRange(start, start + wrapped.length);
    } else {
        titleInput.value = val + (val.endsWith(' ') || !val ? '{từ khóa}' : ' {từ khóa}');
        titleInput.focus();
    }
    renderAll();
    setStatus("ĐÃ ĐÁNH DẤU {TỪ KHÓA} NỔI BẬT TRONG TIÊU ĐỀ");
});

// Đổi Tỷ lệ Khung hình (4:5, 9:16, 1:1, 16:9)
ratioSelect?.addEventListener('change', (e) => {
    const [w, h] = e.target.value.split('x').map(Number);
    if (!w || !h) return;
    CONFIG.TARGET_WIDTH = w;
    CONFIG.TARGET_HEIGHT = h;
    canvas.width = w;
    canvas.height = h;
    if (resBadge) resBadge.textContent = `${w}×${h}`;

    // Nếu chọn 9:16 Stories thì tự gợi ý sang frame Season26_27Stories
    if (w === 1080 && h === 1920 && activeSelect) {
        activeSelect.value = 'Season26_27Stories';
        handleTemplateSwitch('Season26_27Stories', retroSelect);
    } else {
        applyLayout(true);
        renderAll();
    }
    setStatus(`ĐÃ ĐỔI KÍCH THƯỚC KHUNG HÌNH: ${w}×${h}`);
});

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
        leagueSection.style.display = templateMode.value === 'Season26_27' ? 'flex' : 'none';
    }
    setStatus(`TEMPLATE ACTIVE: ${templateMode.value.toUpperCase()}`);
});

// Thanh Tab lọc công cụ cột phải
document.querySelectorAll('.wm-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.wm-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.dataset.tab;

        document.querySelectorAll('.settings-panel [data-wm-cat]').forEach(card => {
            if (tab === 'all') {
                if (card.id === 'league-section') {
                    card.style.display = templateMode.value === 'Season26_27' ? 'flex' : 'none';
                } else if (card.id === 'collage-instructions') {
                    card.style.display = collageState.activeSlotIndex !== null ? 'block' : 'none';
                } else {
                    card.style.display = 'flex';
                }
            } else {
                card.style.display = card.dataset.wmCat === tab ? 'flex' : 'none';
            }
        });
    });
});

// Các nút trên Thanh Toolbar Đáy (Lật ngang, Fit khung, Đổi chỗ ô, B&W, Làm mới)
document.getElementById('btn-slot-flip')?.addEventListener('click', () => {
    const idx = collageState.activeSlotIndex ?? 0;
    const slot = collageState.slots[idx];
    if (!slot || !slot.img) return setStatus("CHƯA CÓ ẢNH TRONG Ô ĐỂ LẬT NGANG");
    slot.flipX = !slot.flipX;
    renderAll();
    setStatus(`ĐÃ LẬT NGANG ẢNH Ô #${idx + 1}`);
});

document.getElementById('btn-slot-fit')?.addEventListener('click', () => {
    const idx = collageState.activeSlotIndex ?? 0;
    const slot = collageState.slots[idx];
    if (!slot || !slot.img) return;
    fitSlotImage(idx);
    renderAll();
    setStatus(`ĐÃ CĂN KHÍT ẢNH Ô #${idx + 1}`);
});

document.getElementById('btn-slot-swap')?.addEventListener('click', () => {
    if (collageState.slots.length < 2) return setStatus("CẦN ÍT NHẤT 2 Ô ẢNH ĐỂ ĐỔI CHỖ");
    const idxA = collageState.activeSlotIndex ?? 0;
    const idxB = (idxA + 1) % collageState.slots.length;

    const sA = collageState.slots[idxA];
    const sB = collageState.slots[idxB];

    const tmpImg = sA.img; sA.img = sB.img; sB.img = tmpImg;
    const tmpFlip = sA.flipX; sA.flipX = sB.flipX; sB.flipX = tmpFlip;
    const tmpBw = sA.bw; sA.bw = sB.bw; sB.bw = tmpBw;

    fitSlotImage(idxA);
    fitSlotImage(idxB);
    collageState.activeSlotIndex = idxB;
    refreshAllQualityBadges();
    updateSlotToolbarIndicator();
    renderAll();
    setStatus(`ĐÃ ĐỔI CHỖ ẢNH Ô #${idxA + 1} ↔ Ô #${idxB + 1}`);
});

document.getElementById('btn-slot-bw')?.addEventListener('click', () => {
    const idx = collageState.activeSlotIndex ?? 0;
    const slot = collageState.slots[idx];
    if (!slot || !slot.img) return;
    slot.bw = !slot.bw;
    renderAll();
    setStatus(`CHẾ ĐỘ ĐEN TRẮNG Ô #${idx + 1}: ${slot.bw ? 'ON' : 'OFF'}`);
});

document.getElementById('btn-reset-all')?.addEventListener('click', () => {
    if (!hasAnyImage()) return;
    if (!confirm("Xóa toàn bộ ảnh trên khung làm việc để làm bài mới?")) return;
    applyLayout(false);
    collageState.activeSlotIndex = null;
    updateSlotToolbarIndicator();
    renderAll();
    setStatus("ĐÃ LÀM MỚI TOÀN BỘ KHUNG ẢNH");
});

// DÁN ẢNH TRỰC TIẾP BẰNG CTRL + V TỪ CLIPBOARD
window.addEventListener('paste', (e) => {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    const items = Array.from(e.clipboardData?.items || []);
    const imgItem = items.find(it => it.type.startsWith('image/'));
    if (!imgItem) return;

    const blob = imgItem.getAsFile();
    if (!blob) return;

    // Ưu tiên nạp vào ô đang chọn, nếu chưa chọn ô nào thì nạp vào ô trống đầu tiên
    let targetIdx = collageState.activeSlotIndex;
    if (targetIdx === null || targetIdx < 0) {
        const emptyIdx = collageState.slots.findIndex(s => !s.img);
        targetIdx = emptyIdx !== -1 ? emptyIdx : 0;
    }

    loadImageIntoSlot(targetIdx, blob);
    setStatus(`ĐÃ DÁN ẢNH TỪ CLIPBOARD VÀO Ô #${targetIdx + 1}`);
});

// ==========================================
// --- COPY CLIPBOARD, EXPORT FILE & ĐẨY SANG MODULE 07 ---
// ==========================================

// 1. Nút COPY ẢNH thẳng vào Clipboard (để Ctrl+V lên Facebook/Messenger/Zalo)
copyBtn?.addEventListener('click', async () => {
    if (!hasAnyImage()) return alert("Vui lòng thêm ít nhất 1 ảnh trước khi Copy!");

    collageState.activeSlotIndex = null;
    canvas.classList.remove('editing');
    renderAll(true);

    try {
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        const origHtml = copyBtn.innerHTML;
        copyBtn.innerHTML = `<i class="fa-solid fa-check"></i> ĐÃ COPY!`;
        setStatus("ĐÃ COPY ẢNH VÀO CLIPBOARD • BẤM CTRL+V ĐỂ DÁN LÊN FACEBOOK / MESSENGER!");
        setTimeout(() => { copyBtn.innerHTML = origHtml; }, 2000);
    } catch (err) {
        alert("Trình duyệt không cấp quyền Copy Clipboard tự động, vui lòng dùng nút TẢI ẢNH VỀ!");
    }
    renderAll(false);
});

// 2. Nút TẢI ẢNH VỀ MÁY (Export JPG 100%)
exportBtn?.addEventListener('click', async () => {
    if (!hasAnyImage()) {
        alert("Vui lòng thêm ít nhất 1 ảnh trước khi Xuất file!");
        return;
    }

    collageState.activeSlotIndex = null;
    canvas.classList.remove('editing');
    if (collageInstructions) collageInstructions.style.display = 'none';

    renderAll(true);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.98);

    if (navigator.canShare && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
        try {
            const response = await fetch(dataUrl);
            const blob = await response.blob();
            const file = new File([blob], 'Goal-Line_Poster.jpg', { type: 'image/jpeg' });
            if (navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file], title: 'Goal-Line Poster' });
                renderAll(false);
                return;
            }
        } catch (error) {
            renderAll(false);
            return;
        }
    }

    const cleanTitle = (titleInput?.value || 'Goal-Line_Poster')
        .replace(/[{}]/g, '')
        .trim()
        .slice(0, 32)
        .replace(/\s+/g, '_');

    const link = document.createElement('a');
    link.download = `${cleanTitle || 'Goal-Line_Poster'}.jpg`;
    link.href = dataUrl;
    link.click();

    renderAll(false);
    setStatus("ĐÃ TẢI ẢNH THÀNH PHẨM VỀ MÁY!");
});

// 3. Nút ĐẨY SANG MODULE 07 (VIDEO STUDIO)
pushMod7Btn?.addEventListener('click', async () => {
    if (!hasAnyImage()) {
        alert("Vui lòng tạo ảnh trước khi đẩy sang Module 07!");
        return;
    }

    renderAll(true);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
    renderAll(false);

    const rawTitle = (titleInput?.value || 'Poster Goal-Line').replace(/[{}]/g, '');

    await GLDatabase.pushToVideoBridge({
        projectName: rawTitle.slice(0, 40) || "Goal-Line Poster Video",
        sourceProjectId: 'wm_' + Date.now(),
        frames: [{
            id: 'frame_' + Date.now(),
            title: "", // Để trống vì trên ảnh Poster đã có sẵn Title đẹp
            subtitle: "",
            mediaType: 'image',
            imageDataUrl: dataUrl,
            videoBlob: null,
            duration: 4.5,
            transition: 'fade',
            motion: 'kenburns-in',
            fitMode: 'contain'
        }]
    });

    window.location.href = "video.html";
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