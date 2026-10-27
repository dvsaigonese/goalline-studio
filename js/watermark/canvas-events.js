// js/watermark/canvas-events.js
import { collageState, hasAnyImage } from './state.js';

export function initCanvasEvents(canvas, onRenderCallback, helpers = {}) {
    const collageInstructions = document.getElementById('collage-instructions');
    const dropzone = document.getElementById('wm-dropzone');

    function getCanvasCoordinates(e) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
    }

    function findSlotIndexAtCoords(coords) {
        for (let i = 0; i < collageState.slots.length; i++) {
            const slot = collageState.slots[i];
            const slotX = slot.x * canvas.width;
            const slotY = slot.y * canvas.height;
            const slotW = slot.w * canvas.width;
            const slotH = slot.h * canvas.height;

            if (coords.x >= slotX && coords.x <= slotX + slotW &&
                coords.y >= slotY && coords.y <= slotY + slotH) {
                return i;
            }
        }
        return -1;
    }

    function handleMouseDown(e) {
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
        const foundIndex = findSlotIndexAtCoords(coords);

        if (foundIndex !== -1) {
            collageState.activeSlotIndex = foundIndex;
            if (helpers.onSlotSelected) helpers.onSlotSelected(foundIndex);

            if (collageState.slots[foundIndex].img) {
                collageState.isDragging = true;
                collageState.lastMouseX = coords.x;
                collageState.lastMouseY = coords.y;
                canvas.classList.add('editing');
                if (collageInstructions) collageInstructions.style.display = 'block';
            }
            onRenderCallback();
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
                if (slot && slot.img) {
                    const distanceDiff = currentDistance - collageState.initialPinchDistance;
                    const delta = distanceDiff * 0.008;
                    slot.scale = Math.min(Math.max(0.05, slot.scale + delta), 12);
                    if (helpers.onZoomChanged) helpers.onZoomChanged();
                    onRenderCallback();
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
        if (!slot || !slot.img) return;

        const dx = coords.x - collageState.lastMouseX;
        const dy = coords.y - collageState.lastMouseY;

        slot.offsetX += dx / slot.scale;
        slot.offsetY += dy / slot.scale;
        collageState.lastMouseX = coords.x;
        collageState.lastMouseY = coords.y;
        onRenderCallback();
    }

    function handleMouseUp(e) {
        if (!e || !e.touches || e.touches.length < 2) collageState.isPinching = false;
        if (!e || !e.touches || e.touches.length === 0) collageState.isDragging = false;
    }

    function handleWheel(e) {
        const coords = getCanvasCoordinates(e);
        const hoveredSlot = findSlotIndexAtCoords(coords);
        const targetIdx = hoveredSlot !== -1 ? hoveredSlot : collageState.activeSlotIndex;
        if (targetIdx === null || targetIdx === -1) return;

        const slot = collageState.slots[targetIdx];
        if (!slot || !slot.img) return;

        e.preventDefault();
        collageState.activeSlotIndex = targetIdx;
        if (helpers.onSlotSelected) helpers.onSlotSelected(targetIdx);

        const factor = e.deltaY > 0 ? 0.94 : 1.06;
        slot.scale = Math.min(Math.max(0.05, slot.scale * factor), 12);
        if (helpers.onZoomChanged) helpers.onZoomChanged();
        onRenderCallback();
    }

    // Double-Click vào ô ảnh để Auto-Fit khít lại khung
    canvas.addEventListener('dblclick', (e) => {
        const coords = getCanvasCoordinates(e);
        const idx = findSlotIndexAtCoords(coords);
        if (idx !== -1 && helpers.fitSlotImage) {
            helpers.fitSlotImage(idx);
            onRenderCallback();
        }
    });

    // KÉO-THẢ (DRAG & DROP) ẢNH TRỰC TIẾP VÀO CANVAS
    if (dropzone) {
        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('drag-over');
        });

        dropzone.addEventListener('dragleave', () => {
            dropzone.classList.remove('drag-over');
        });

        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('drag-over');

            const files = Array.from(e.dataTransfer?.files || []).filter(f => f.type.startsWith('image/'));
            if (!files.length || !helpers.loadImageIntoSlot) return;

            if (files.length === 1) {
                const coords = getCanvasCoordinates(e);
                let slotIdx = findSlotIndexAtCoords(coords);
                if (slotIdx === -1) slotIdx = collageState.activeSlotIndex ?? 0;
                helpers.loadImageIntoSlot(slotIdx, files[0]);
            } else {
                // Nếu kéo thả nhiều ảnh cùng lúc -> Lấp đầy lần lượt vào các ô Slot 1, 2, 3...
                files.forEach((file, idx) => {
                    if (idx < collageState.slots.length) {
                        helpers.loadImageIntoSlot(idx, file);
                    }
                });
            }
        });
    }

    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('touchstart', handleMouseDown, { passive: false });
    canvas.addEventListener('touchmove', handleMouseMove, { passive: false });
    canvas.addEventListener('touchend', handleMouseUp);
}