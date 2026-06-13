// js/watermark.js

const canvas = document.getElementById('wm-canvas');
const ctx = canvas.getContext('2d');
const titleInput = document.getElementById('wm-title');
const exportBtn = document.getElementById('export-wm-btn');
const emptyState = document.getElementById('empty-state');
const fileInputsContainer = document.getElementById('file-inputs-container');
const collageInstructions = document.getElementById('collage-instructions');

// UI Controls Mới
const layoutMode = document.getElementById('layout-mode');
const collageOptions = document.getElementById('collage-options');
const splitDirection = document.getElementById('split-direction');
const splitCount = document.getElementById('split-count');

//Chỉnh template
const templateMode = document.getElementById('template-mode');
let wcFrameImage = null;

// Logo & Assets
let logoImage = null;
let logoTxtImage = null;
let patternImage = null;

// Settings UI Elements
const patternOpacityInput = document.getElementById('pattern-opacity');
const patternValDisplay = document.getElementById('pattern-val');
const grainIntensityInput = document.getElementById('grain-intensity');
const grainValDisplay = document.getElementById('grain-val');
const overallBrightnessInput = document.getElementById('overall-brightness');
const brightnessValDisplay = document.getElementById('brightness-val');

// --- CẤU HÌNH CỐ ĐỊNH TARGET ---
const TARGET_WIDTH = 1200; 
const TARGET_HEIGHT = 1500; 

canvas.width = TARGET_WIDTH;
canvas.height = TARGET_HEIGHT;


// ==========================================
// --- TRẠNG THÁI COLLAGE ---
// ==========================================

let collageState = {
    slots: [], 
    activeSlotIndex: null, 
    isDragging: false,
    lastMouseX: 0,
    lastMouseY: 0,
    //TÍNH NĂNG ZOOM 2 NGÓN (PINCH-TO-ZOOM)
    isPinching: false,
    initialPinchDistance: 0
};

// Hàm sinh ra Config bố cục động
function generateLayoutConfig() {
    const mode = layoutMode.value;
    const config = [];
    
    // Kiểm tra xem có đang ở mode WC26 không
    const isWC26 = templateMode.value === 'wc26';
    
    // Tỉ lệ vùng hiển thị: Original là 100% (1.0). 
    // WC26 do có phần đệm text che đáy nên vùng cắt lưới thực tế chỉ chiếm khoảng 80% (0.8)
    const visibleRatio = isWC26 ? 0.8 : 1.0; 

    if (mode === 'single') {
        config.push({ x: 0, y: 0, w: 1, h: 1 });
    } else {
        const direction = splitDirection.value;
        const count = parseInt(splitCount.value) || 2;
        
        for (let i = 0; i < count; i++) {
            if (direction === 'vertical') {
                // Chia dọc (|||) thì trục Y không bị ảnh hưởng, giữ nguyên 1.0
                config.push({ x: i / count, y: 0, w: 1 / count, h: 1 });
            } else {
                // Chia ngang (三) thì phải tính toán dựa trên visibleRatio
                let startY = i * (visibleRatio / count);
                let slotH = visibleRatio / count;
                
                // QUAN TRỌNG: Với slot ảnh cuối cùng (nằm dưới cùng), 
                // ta phải cho nó giãn thẳng kịch kim xuống 1.0 để không bị hụt đáy lòi viền đen.
                if (i === count - 1) {
                    slotH = 1.0 - startY; 
                }
                
                config.push({ x: 0, y: startY, w: 1, h: slotH });
            }
        }
    }
    return config;
}

// Hàm khởi tạo và cập nhật Grid
function applyLayout(keepImages = true) {
    const newConfig = generateLayoutConfig();
    const oldSlots = collageState.slots;
    
    // Tạo slots mới dựa trên config
    const newSlots = newConfig.map((rect, i) => {
        const slotAspectRatio = rect.w * TARGET_WIDTH / (rect.h * TARGET_HEIGHT);
        let imgToKeep = null;

        if (keepImages && oldSlots[i] && oldSlots[i].img) {
            imgToKeep = oldSlots[i].img;
        }

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


// ==========================================
// --- XỬ LÝ SỰ KIỆN CHỌN LAYOUT ---
// ==========================================

layoutMode.addEventListener('change', (e) => {
    if (e.target.value === 'collage') {
        collageOptions.style.display = 'block';
    } else {
        collageOptions.style.display = 'none';
    }
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
// --- TƯƠNG TÁC CANVAS KÉO THẢ ---
// ==========================================

function getCanvasCoordinates(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
    };
}

function handleMouseDown(e) {
    if (!hasAnyImage()) return;

    // KÍCH HOẠT CHẾ ĐỘ ZOOM NẾU CHẠM 2 NGÓN CÙNG LÚC
    if (e.touches && e.touches.length === 2) {
        collageState.isPinching = true;
        collageState.isDragging = false; // Đang zoom thì cấm kéo
        collageState.initialPinchDistance = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
        );
        return; 
    }

    // Nếu chạm 1 ngón hoặc dùng chuột (Bắt đầu kéo)
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
        
        // Hiện text hướng dẫn an toàn
        const instructions = document.getElementById('collage-instructions');
        if (instructions) instructions.style.display = 'block';
        
        renderAll(); 
    }
}

function handleMouseMove(e) {
    // NẾU ĐANG CHẠM 2 NGÓN (XỬ LÝ ZOOM)
    if (e.touches && e.touches.length === 2 && collageState.isPinching) {
        e.preventDefault(); // Chống cuộn trang web của điện thoại
        
        const currentDistance = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
        );

        if (collageState.activeSlotIndex !== null) {
            const slot = collageState.slots[collageState.activeSlotIndex];
            if (slot.img) {
                // Tính độ chênh lệch khoảng cách (Hệ số 0.008 để zoom mượt)
                const distanceDiff = currentDistance - collageState.initialPinchDistance;
                const delta = distanceDiff * 0.008;
                
                // Giới hạn scale từ 0.1x đến 10x
                slot.scale = Math.min(Math.max(0.1, slot.scale + delta), 10);
                renderAll();
            }
        }
        
        // Cập nhật lại điểm neo để zoom liên tục mượt mà
        collageState.initialPinchDistance = currentDistance;
        return;
    }

    // NẾU ĐANG KÉO THẢ BÌNH THƯỜNG
    if (!collageState.isDragging || collageState.activeSlotIndex === null) return;
    if (e.touches && e.touches.length > 1) return; // Bỏ qua nếu lỡ quẹt > 1 ngón

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
    // Nếu buông 1 trong 2 ngón ra thì tắt chế độ Zoom
    if (!e || !e.touches || e.touches.length < 2) {
        collageState.isPinching = false;
    }
    // Nếu buông tay hoàn toàn thì tắt chế độ Kéo
    if (!e || !e.touches || e.touches.length === 0) {
        collageState.isDragging = false;
    }
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
        const instructions = document.getElementById('collage-instructions');
        if (instructions) instructions.style.display = 'none';
        renderAll();
    }
}

// Bắt sự kiện Window để bỏ chọn khi click ra ngoài
window.addEventListener('mousedown', handleOutsideClick);
window.addEventListener('touchstart', handleOutsideClick, { passive: false });

// Sự kiện Chuột PC
canvas.addEventListener('mousedown', handleMouseDown);
window.addEventListener('mousemove', handleMouseMove);
window.addEventListener('mouseup', handleMouseUp);
canvas.addEventListener('wheel', handleWheel, { passive: false });

// Sự kiện Cảm ứng Mobile
canvas.addEventListener('touchstart', handleMouseDown, { passive: false });
canvas.addEventListener('touchmove', handleMouseMove, { passive: false });
canvas.addEventListener('touchend', handleMouseUp);


// ==========================================
// --- LOGIC TẢI ẢNH VÀO TỪNG SLOT ---
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

    if (hasAnyImage()) {
        emptyState.style.display = 'none';
    } else {
        emptyState.style.display = 'block';
    }

    // 1. Vẽ ảnh gốc (và layout chia ô) ở lớp dưới cùng
    drawCollageBackground();
    
    // 2. Áp dụng filter sáng/tối cho ảnh gốc
    applyGlobalFilters();

    // 3. RẼ NHÁNH: Vẽ lớp phủ (Overlay) dựa trên Template được chọn
    if (templateMode.value === 'wc26') {
        drawWC26Template();
    } else {
        drawWatermarkLayers(); // Logic cũ của bạn
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

        // Vẽ Border Vàng nếu đang edit
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

function drawWatermarkLayers() {
    if (!hasAnyImage()) return; 

    const width = canvas.width;
    const height = canvas.height;

    const gradient = ctx.createLinearGradient(0, height * 0.8, 0, height);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');    
    gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.3)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.65)');  
    ctx.fillStyle = gradient;
    ctx.fillRect(0, height * 0.5, width, height * 0.5); 

    if (patternImage) {
        ctx.save();
        const patternOpacity = patternOpacityInput ? parseFloat(patternOpacityInput.value) : 0.15;
        ctx.globalAlpha = patternOpacity;
        ctx.globalCompositeOperation = 'multiply'; 
        const pattern = ctx.createPattern(patternImage, 'repeat');
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
    }

    if (logoImage) {
        ctx.save();
        ctx.globalAlpha = 0.06;
        ctx.globalCompositeOperation = 'screen'; 
        const giantSize = width * 1.1; 
        ctx.drawImage(logoImage, width - giantSize * 0.49, height - giantSize * 0.55, giantSize, giantSize);
        ctx.restore();

        const smallSize = width * 0.08; 
        const padding = width * 0.03;
        ctx.drawImage(logoImage, padding, padding, smallSize, smallSize);
    }

    if (logoTxtImage) {
        const logoHeight = width * 0.06;
        const logoWidth = logoHeight * (logoTxtImage.naturalWidth / logoTxtImage.naturalHeight);
        const padding = width * 0.035;
        ctx.drawImage(logoTxtImage, width - padding - logoWidth, padding, logoWidth, logoHeight);
    }

    drawComplexTitle(width, height);

    const grainIntensity = grainIntensityInput ? parseFloat(grainIntensityInput.value) : 0.08;
    if (grainIntensity > 0) {
        addFilmGrain(ctx, width, height, grainIntensity);
    }
}

function drawComplexTitle(width, height) {
    const rawTitle = titleInput.value || "Hãy nhập {title}"; 
    const lines = rawTitle.split('\n');
    let titleFontSize = lines.length === 1 ? width * 0.04 : width * 0.042;
    const titlePaddingX = width * 0.025; 
    const bottomMargin = width * 0.06; 

    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${titleFontSize}px Albula, Arial, sans-serif`;
    
    const lineHeight = titleFontSize * 1.3; 
    const startY = height - bottomMargin - (lines.length - 1) * lineHeight;

    const barWidth = titleFontSize * 0.18;
    let barY, barHeight;

    if (lines.length === 1) {
        barHeight = titleFontSize * 1.85; 
        barY = startY - barHeight / 2;    
    } else {
        const lastLineY = startY + (lines.length - 1) * lineHeight;
        const textBottom = lastLineY + (titleFontSize * 0.45);
        barY = startY - (titleFontSize * 0.1);
        barHeight = textBottom - barY;
    }

    ctx.fillStyle = 'white';
    ctx.fillRect(titlePaddingX, barY, barWidth, barHeight);

    const spacingPx = Math.round(titleFontSize * -0.083); 

    function drawTextTight(textStr, x, y) {
        let currX = x;
        const chars = Array.from(textStr.normalize('NFC'));
        for (let i = 0; i < chars.length; i++) {
            const char = chars[i];
            ctx.fillText(char, currX, y);
            currX += ctx.measureText(char).width + spacingPx;
        }
        return currX;
    }

    lines.forEach((line, index) => {
        let currentX = titlePaddingX + barWidth + (titleFontSize * 0.4); 
        const currentY = startY + (index * lineHeight); 
        const textParts = line.split(/({[^}]+})/g); 

        textParts.forEach(part => {
            if (part.startsWith('{') && part.endsWith('}')) {
                ctx.fillStyle = '#e2f90e'; 
                currentX = drawTextTight(part.slice(1, -1), currentX, currentY); 
            } else if (part.length > 0) {
                ctx.fillStyle = 'white'; 
                currentX = drawTextTight(part, currentX, currentY);
            }
        });
    });
    ctx.restore();
}

// ==========================================
// --- BẮT ĐẦU CÁC HÀM CHO WC26 ---
// ==========================================
function drawWC26Template() {
    if (!hasAnyImage()) return; 

    const width = canvas.width;
    const height = canvas.height;

    // 1. Vẽ thẳng khung PNG trong suốt đè lên ảnh
    if (wcFrameImage) {
        ctx.drawImage(wcFrameImage, 0, 0, width, height);
    }

    // 2. Thêm hiệu ứng hạt nhiễu (nếu muốn áp dụng lên cả khung)
    const grainIntensity = grainIntensityInput ? parseFloat(grainIntensityInput.value) : 0.08;
    if (grainIntensity > 0) {
        addFilmGrain(ctx, width, height, grainIntensity);
    }

    // 3. Vẽ Text căn giữa ở vùng xanh đậm
    drawWC26Title(width, height);
}

// HÀM VẼ TEXT CĂN GIỮA ĐẶC TRỊ CHO WC26 
function drawWC26Title(width, height) {
    const rawTitle = titleInput.value || "Hãy nhập {title}"; 
    const lines = rawTitle.split('\n');
    let titleFontSize = width * 0.045; 

    ctx.save();
    ctx.textAlign = 'left'; 
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${titleFontSize}px Albula, Arial, sans-serif`;
    
    const lineHeight = titleFontSize * 1.3; 
    
    // ĐIỂM SỬA 1: Đẩy tâm Y xuống 88.5% chiều cao để lọt thỏm vào giữa vùng xanh đậm
    // Bạn có thể tinh chỉnh con số 0.885 này (ví dụ 0.88 hoặc 0.89) nếu thấy chưa ưng mắt
    const centerY = height * 0.885; 
    const startY = centerY - ((lines.length - 1) * lineHeight) / 2;

    const spacingPx = Math.round(titleFontSize * -0.05); // Kerning chữ

    lines.forEach((line, index) => {
        const currentY = startY + (index * lineHeight); 
        const textParts = line.split(/({[^}]+})/g); 

        // Tính tổng chiều dài của dòng text
        let totalWidth = 0;
        textParts.forEach(part => {
            if (part.length > 0) {
                const cleanText = part.startsWith('{') && part.endsWith('}') ? part.slice(1, -1) : part;
                const chars = Array.from(cleanText.normalize('NFC'));
                for (let i = 0; i < chars.length; i++) {
                    totalWidth += ctx.measureText(chars[i]).width + spacingPx;
                }
            }
        });
        if (totalWidth > 0) totalWidth -= spacingPx; 

        // Tọa độ X để đẩy text vào giữa Canvas (ngang)
        let currentX = (width - totalWidth) / 2;

        textParts.forEach(part => {
            if (part.length === 0) return;
            const isHighlight = part.startsWith('{') && part.endsWith('}');
            const cleanText = isHighlight ? part.slice(1, -1) : part;
            
            // ĐIỂM SỬA 2: Đổi màu chữ highlight thành Cyan #4dd0e2
            ctx.fillStyle = isHighlight ? '#4dd0e2' : 'white';

            const chars = Array.from(cleanText.normalize('NFC'));
            for (let i = 0; i < chars.length; i++) {
                const char = chars[i];
                ctx.fillText(char, currentX, currentY);
                currentX += ctx.measureText(char).width + spacingPx;
            }
        });
    });
    ctx.restore();
}


// ==========================================
// --- KẾT THÚC CÁC HÀM CHO WC26 ---
// ==========================================


// ==========================================
// --- CÁC HÀM BỔ TRỢ & SỰ KIỆN KHÁC ---
// ==========================================

const loadImages = () => {
    const imagesToLoad = [
        { name: 'logoImage', src: 'assets/img/GL_logo.jpg' }, 
        { name: 'logoTxtImage', src: 'assets/img/GL_text_logo.png' },
        { name: 'patternImage', src: 'assets/img/pattern.png' },
        { name: 'wcFrameImage', src: 'assets/img/wc26_frame.png' }
    ];
    let loadedCount = 0;
    imagesToLoad.forEach(imageData => {
        const img = new Image();
        img.onload = () => {
            loadedCount++;
            if (imageData.name === 'logoImage') logoImage = img;
            if (imageData.name === 'logoTxtImage') logoTxtImage = img;
            if (imageData.name === 'patternImage') patternImage = img;
            if (imageData.name === 'wcFrameImage') wcFrameImage = img;
            if (loadedCount === imagesToLoad.length) renderAll();
        };
        img.onerror = () => { loadedCount++; if (loadedCount === imagesToLoad.length) renderAll(); };
        img.src = imageData.src;
    });
};

function addFilmGrain(ctx, width, height, intensity = 0.08) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const pixels = imageData.data;
    for (let i = 0; i < pixels.length; i += 4) {
        const noise = (Math.random() - 0.5) * intensity * 255;
        pixels[i] = Math.min(255, Math.max(0, pixels[i] + noise));     
        pixels[i + 1] = Math.min(255, Math.max(0, pixels[i + 1] + noise)); 
        pixels[i + 2] = Math.min(255, Math.max(0, pixels[i + 2] + noise)); 
    }
    ctx.putImageData(imageData, 0, 0);
}

function debounce(func, timeout = 150) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => { func.apply(this, args); }, timeout);
    };
}

titleInput.addEventListener('input', debounce(() => renderAll()));

exportBtn.addEventListener('click', async () => {
    if (!hasAnyImage()) { alert("Please upload at least one image!"); return; }

    // FIX CHỐT HẠ: ÉP XÓA VIỀN VÀNG TRƯỚC KHI LƯU ẢNH
    collageState.activeSlotIndex = null;
    canvas.classList.remove('editing');
    if (collageInstructions) collageInstructions.style.display = 'none';
    renderAll();

    // Render xong xuôi mới xuất data
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

const debouncedRender = debounce(() => renderAll(), 100);

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
    renderAll();
    applyLayout(true); 
});


// KHỞI CHẠY APP
if (document.fonts) {
    document.fonts.load('bold 16px "Albula"').then(() => loadImages()).catch(() => loadImages());
} else {
    loadImages();
}

applyLayout(false);