// js/watermark/layout.js
import { CONFIG, collageState } from './state.js';

export function initLayoutManager(onRenderCallback, onSlotSelectCallback) {
    const layoutMode = document.getElementById('layout-mode');
    const collageOptions = document.getElementById('collage-options');
    const splitDirection = document.getElementById('split-direction');
    const splitCount = document.getElementById('split-count');
    const templateMode = document.getElementById('template-mode');
    const fileInputsContainer = document.getElementById('file-inputs-container');

    function generateLayoutConfig() {
        const mode = layoutMode ? layoutMode.value : 'single';
        const config = [];
        const isWC26 = templateMode && templateMode.value === 'wc26';
        const visibleRatio = isWC26 ? 0.87 : 1.0;

        if (mode === 'single') {
            config.push({ x: 0, y: 0, w: 1, h: 1 });
        } else if (mode === 't-top') {
            // 1 Ô lớn phía trên + 2 Ô nhỏ phía dưới
            const splitY = 0.55 * visibleRatio;
            config.push({ x: 0, y: 0, w: 1, h: splitY });
            config.push({ x: 0, y: splitY, w: 0.5, h: 1 - splitY });
            config.push({ x: 0.5, y: splitY, w: 0.5, h: 1 - splitY });
        } else if (mode === 't-bottom') {
            // 2 Ô nhỏ phía trên + 1 Ô lớn phía dưới
            const splitY = 0.45 * visibleRatio;
            config.push({ x: 0, y: 0, w: 0.5, h: splitY });
            config.push({ x: 0.5, y: 0, w: 0.5, h: splitY });
            config.push({ x: 0, y: splitY, w: 1, h: 1 - splitY });
        } else if (mode === 'hero-left') {
            // 1 Ô lớn bên trái + 2 Ô nhỏ xếp chồng bên phải
            const splitX = 0.55;
            const splitY = 0.5 * visibleRatio;
            config.push({ x: 0, y: 0, w: splitX, h: 1 });
            config.push({ x: splitX, y: 0, w: 1 - splitX, h: splitY });
            config.push({ x: splitX, y: splitY, w: 1 - splitX, h: 1 - splitY });
        } else if (mode === 'quad') {
            // 4 Ô góc 2x2
            const splitY = 0.5 * visibleRatio;
            config.push({ x: 0, y: 0, w: 0.5, h: splitY });
            config.push({ x: 0.5, y: 0, w: 0.5, h: splitY });
            config.push({ x: 0, y: splitY, w: 0.5, h: 1 - splitY });
            config.push({ x: 0.5, y: splitY, w: 0.5, h: 1 - splitY });
        } else {
            // Chế độ Collage (Split Linear truyền thống)
            const direction = splitDirection ? splitDirection.value : 'vertical';
            const count = parseInt(splitCount ? splitCount.value : 2) || 2;

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

    /**
     * Tính toán lại tỷ lệ Scale chuẩn để ảnh vừa khít (Cover) ô chứa
     */
    function fitSlotImage(slotIndex) {
        const slot = collageState.slots[slotIndex];
        if (!slot || !slot.img) return;

        slot.aspectRatio = (slot.w * CONFIG.TARGET_WIDTH) / (slot.h * CONFIG.TARGET_HEIGHT);
        const imgAR = slot.img.naturalWidth / slot.img.naturalHeight;

        if (imgAR > slot.aspectRatio) {
            slot.scale = (slot.h * CONFIG.TARGET_HEIGHT) / slot.img.naturalHeight;
        } else {
            slot.scale = (slot.w * CONFIG.TARGET_WIDTH) / slot.img.naturalWidth;
        }
        slot.offsetX = 0;
        slot.offsetY = 0;
        updateQualityBadge(slotIndex, slot.img, slot);
    }

    function applyLayout(keepImages = true) {
        const newConfig = generateLayoutConfig();
        const oldSlots = collageState.slots;

        const newSlots = newConfig.map((rect, i) => {
            const slotAspectRatio = (rect.w * CONFIG.TARGET_WIDTH) / (rect.h * CONFIG.TARGET_HEIGHT);
            let prev = (keepImages && oldSlots[i]) ? oldSlots[i] : null;

            const slot = {
                ...rect,
                img: prev ? prev.img : null,
                scale: 1,
                offsetX: 0,
                offsetY: 0,
                aspectRatio: slotAspectRatio,
                flipX: prev ? Boolean(prev.flipX) : false,
                bw: prev ? Boolean(prev.bw) : false
            };

            if (slot.img) {
                const imgAR = slot.img.naturalWidth / slot.img.naturalHeight;
                if (imgAR > slotAspectRatio) {
                    slot.scale = (rect.h * CONFIG.TARGET_HEIGHT) / slot.img.naturalHeight;
                } else {
                    slot.scale = (rect.w * CONFIG.TARGET_WIDTH) / slot.img.naturalWidth;
                }
            }
            return slot;
        });

        collageState.slots = newSlots;
        if (collageState.activeSlotIndex !== null && collageState.activeSlotIndex >= newSlots.length) {
            collageState.activeSlotIndex = newSlots.length - 1;
        }
        generateFileInputs();
        onRenderCallback();
    }

    function updateQualityBadge(slotIndex, img, slot) {
        const badgeEl = document.getElementById(`quality-badge-slot-${slotIndex}`);
        if (!badgeEl) return;

        if (!img) {
            badgeEl.innerHTML = '';
            badgeEl.style.display = 'none';
            return;
        }

        const w = img.naturalWidth;
        const h = img.naturalHeight;
        const scale = slot.scale || 1;

        let statusClass = 'res-sharp';
        let statusText = '✅ NÉT CĂNG';

        if (scale > 1.35) {
            statusClass = 'res-blur';
            statusText = `❌ MỜ (ZOOM ${(scale * 100).toFixed(0)}%)`;
        } else if (scale > 1.05) {
            statusClass = 'res-warn';
            statusText = `⚠️ TẠM ĐƯỢC (ZOOM ${(scale * 100).toFixed(0)}%)`;
        } else {
            statusClass = 'res-sharp';
            statusText = `✅ NÉT CĂNG (${(scale * 100).toFixed(0)}%)`;
        }

        badgeEl.className = `resolution-inspector-badge ${statusClass}`;
        badgeEl.style.display = 'flex';
        badgeEl.innerHTML = `
            <span><i class="fa-solid fa-expand"></i> ${w}×${h}px</span>
            <span>${statusText}</span>
        `;
    }

    function refreshAllQualityBadges() {
        collageState.slots.forEach((slot, idx) => {
            if (slot.img) updateQualityBadge(idx, slot.img, slot);
        });
        document.querySelectorAll('.slot-upload-item').forEach((el, idx) => {
            el.classList.toggle('active-slot', idx === collageState.activeSlotIndex);
        });
    }

    function generateFileInputs() {
        if (!fileInputsContainer) return;
        fileInputsContainer.innerHTML = '';
        const numSlots = collageState.slots.length;

        for (let i = 0; i < numSlots; i++) {
            const currentSlot = collageState.slots[i];
            const slotItem = document.createElement('div');
            slotItem.className = `slot-upload-item ${i === collageState.activeSlotIndex ? 'active-slot' : ''}`;

            const header = document.createElement('div');
            header.className = 'slot-item-header';
            header.innerHTML = `
                <span><i class="fa-solid fa-image"></i> Ô ẢNH #${i + 1}</span>
                <div class="slot-quick-btns">
                    <button type="button" class="btn-s-flip" title="Lật ngang ảnh ô #${i + 1}">⇄ LẬT</button>
                    <button type="button" class="btn-s-fit" title="Căn vừa khít khung">⛶ FIT</button>
                    <button type="button" class="btn-s-bw" title="Đen trắng ô #${i + 1}">◐ B&W</button>
                </div>
            `;

            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.className = 'form-control';
            input.addEventListener('change', (e) => {
                if (e.target.files && e.target.files[0]) {
                    loadImageIntoSlot(i, e.target.files[0]);
                }
            });

            const badgeBox = document.createElement('div');
            badgeBox.id = `quality-badge-slot-${i}`;
            badgeBox.style.display = 'none';

            slotItem.appendChild(header);
            slotItem.appendChild(input);
            slotItem.appendChild(badgeBox);

            // Click vào thẻ ở cột phải cũng chọn luôn Slot đó
            slotItem.addEventListener('click', (e) => {
                if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
                collageState.activeSlotIndex = i;
                refreshAllQualityBadges();
                if (onSlotSelectCallback) onSlotSelectCallback(i);
                onRenderCallback();
            });

            header.querySelector('.btn-s-flip').addEventListener('click', () => {
                if (!currentSlot.img) return;
                currentSlot.flipX = !currentSlot.flipX;
                collageState.activeSlotIndex = i;
                refreshAllQualityBadges();
                if (onSlotSelectCallback) onSlotSelectCallback(i);
                onRenderCallback();
            });

            header.querySelector('.btn-s-fit').addEventListener('click', () => {
                if (!currentSlot.img) return;
                fitSlotImage(i);
                collageState.activeSlotIndex = i;
                refreshAllQualityBadges();
                if (onSlotSelectCallback) onSlotSelectCallback(i);
                onRenderCallback();
            });

            header.querySelector('.btn-s-bw').addEventListener('click', () => {
                if (!currentSlot.img) return;
                currentSlot.bw = !currentSlot.bw;
                collageState.activeSlotIndex = i;
                refreshAllQualityBadges();
                if (onSlotSelectCallback) onSlotSelectCallback(i);
                onRenderCallback();
            });

            fileInputsContainer.appendChild(slotItem);

            if (currentSlot && currentSlot.img) {
                updateQualityBadge(i, currentSlot.img, currentSlot);
            }
        }
    }

    /**
     * Nạp ảnh từ File hoặc Blob (hỗ trợ cả Upload, Drag-and-Drop và Ctrl+V Paste)
     */
    function loadImageIntoSlot(slotIndex, fileOrBlob) {
        if (!fileOrBlob) return;
        const targetIdx = (slotIndex >= 0 && slotIndex < collageState.slots.length) ? slotIndex : 0;

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const slot = collageState.slots[targetIdx];
                if (!slot) return;
                slot.img = img;
                fitSlotImage(targetIdx);
                collageState.activeSlotIndex = targetIdx;
                refreshAllQualityBadges();
                if (onSlotSelectCallback) onSlotSelectCallback(targetIdx);
                onRenderCallback();
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(fileOrBlob);
    }

    layoutMode?.addEventListener('change', (e) => {
        if (collageOptions) {
            collageOptions.style.display = e.target.value === 'collage' ? 'block' : 'none';
        }
        applyLayout(true);
    });

    splitDirection?.addEventListener('change', () => applyLayout(true));
    splitCount?.addEventListener('input', () => {
        let val = parseInt(splitCount.value);
        if (val < 2) splitCount.value = 2;
        if (val > 10) splitCount.value = 10;
        applyLayout(true);
    });

    return {
        applyLayout,
        loadImageIntoSlot,
        fitSlotImage,
        refreshAllQualityBadges
    };
}