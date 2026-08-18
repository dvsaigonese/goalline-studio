export const CONFIG = {
    TARGET_WIDTH: 1200, 
    TARGET_HEIGHT: 1500
};

export const globalAssets = {}; 

export const collageState = {
    slots: [], 
    activeSlotIndex: null, 
    isDragging: false,
    lastMouseX: 0,
    lastMouseY: 0,
    isPinching: false,
    initialPinchDistance: 0
};

export function hasAnyImage() {
    return collageState.slots.some(slot => slot.img !== null);
}