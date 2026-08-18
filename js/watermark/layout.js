import { CONFIG, collageState } from './state.js';

export function initLayoutManager(onRenderCallback) {
    const layoutMode = document.getElementById('layout-mode');
    const collageOptions = document.getElementById('collage-options');
    const splitDirection = document.getElementById('split-direction');
    const splitCount = document.getElementById('split-count');
    const templateMode = document.getElementById('template-mode');
    const fileInputsContainer = document.getElementById('file-inputs-container');

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
            const slotAspectRatio = rect.w * CONFIG.TARGET_WIDTH / (rect.h * CONFIG.TARGET_HEIGHT);
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
                    slot.scale = (rect.h * CONFIG.TARGET_HEIGHT) / imgToKeep.naturalHeight;
                } else {
                    slot.scale = (rect.w * CONFIG.TARGET_WIDTH) / imgToKeep.naturalWidth;
                }
            }
            return slot;
        });

        collageState.slots = newSlots;
        collageState.activeSlotIndex = null;
        generateFileInputs();
        onRenderCallback();
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
                        slot.scale = (slot.h * CONFIG.TARGET_HEIGHT) / img.naturalHeight;
                    } else {
                        slot.scale = (slot.w * CONFIG.TARGET_WIDTH) / img.naturalWidth;
                    }
                    slot.offsetX = 0;
                    slot.offsetY = 0;
                    onRenderCallback(); 
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }
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

    return { applyLayout }; // Mở API ra ngoài cho Core xài
}