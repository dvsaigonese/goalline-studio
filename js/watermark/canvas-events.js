import { collageState, hasAnyImage } from './state.js';

export function initCanvasEvents(canvas, onRenderCallback) {
    const collageInstructions = document.getElementById('collage-instructions');

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
                if (slot.img) {
                    const distanceDiff = currentDistance - collageState.initialPinchDistance;
                    const delta = distanceDiff * 0.008;
                    slot.scale = Math.min(Math.max(0.1, slot.scale + delta), 10);
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
        if (collageState.activeSlotIndex === null) return;
        const slot = collageState.slots[collageState.activeSlotIndex];
        if (!slot.img) return;

        e.preventDefault(); 
        const delta = e.deltaY > 0 ? -0.05 : 0.05; 
        slot.scale = Math.min(Math.max(0.1, slot.scale + delta), 10);
        onRenderCallback();
    }

    function handleOutsideClick(e) {
        if (e.target !== canvas && collageState.activeSlotIndex !== null) {
            collageState.activeSlotIndex = null;
            canvas.classList.remove('editing');
            if (collageInstructions) collageInstructions.style.display = 'none';
            onRenderCallback();
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
}