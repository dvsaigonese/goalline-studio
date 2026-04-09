// js/watermark.js

const canvas = document.getElementById('wm-canvas');
const ctx = canvas.getContext('2d');
const imgInput = document.getElementById('upload-img');
const titleInput = document.getElementById('wm-title');
const exportBtn = document.getElementById('export-wm-btn');
const emptyState = document.getElementById('empty-state');

// Các phần tử UI mới cho tính năng Crop
const cropModeInput = document.getElementById('crop-mode-input');
const cropModeLabel = document.getElementById('crop-mode-label');
const cropperContainer = document.getElementById('cropper-container');
const imageToCrop = document.getElementById('image-to-crop');
const confirmCropBtn = document.getElementById('confirm-crop-btn');
const cancelCropBtn = document.getElementById('cancel-crop-btn');
const cropControls = document.getElementById('crop-controls');
const wtmSettingsPanel = document.getElementById('wtm-settings-panel');

let baseImage = null; // Ảnh gốc user upload
let processedImage = null; // Ảnh đã được crop và scale
let logoImage = null;
let logoTxtImage = null;
let cropper = null; // Biến lưu instance của Cropper.js

//pattern
const patternOpacityInput = document.getElementById('pattern-opacity');
const patternValDisplay = document.getElementById('pattern-val');
let patternImage = null;

//grain
const grainIntensityInput = document.getElementById('grain-intensity');
const grainValDisplay = document.getElementById('grain-val');

//brightness
const overallBrightnessInput = document.getElementById('overall-brightness');
const brightnessValDisplay = document.getElementById('brightness-val');

// CẤU HÌNH CỐ ĐỊNH TỈ LỆ VÀ ĐỘ PHÂN GIẢI
const TARGET_ASPECT_RATIO = 4 / 5; // Tỉ lệ 4:5
const MIN_WIDTH = 1200; // Chiều rộng HD tối thiểu
const MIN_HEIGHT = 1500; // Chiều cao HD tối thiểu

// Tải các Logo
const loadImages = () => {
    const imagesToLoad = [
        { name: 'logoImage', src: 'assets/img/GL_logo.jpg' }, 
        { name: 'logoTxtImage', src: 'assets/img/GL_text_logo.png' },
        { name: 'patternImage', src: 'assets/img/pattern.png' }
    ];

    let loadedCount = 0;

    imagesToLoad.forEach(imageData => {
        const img = new Image();
        img.onload = () => {
            loadedCount++;
            
            // Gán ảnh vào đúng biến
            if (imageData.name === 'logoImage') logoImage = img;
            if (imageData.name === 'logoTxtImage') logoTxtImage = img;
            if (imageData.name === 'patternImage') patternImage = img;

            if (loadedCount === imagesToLoad.length && processedImage) renderWatermark();
        };
        img.onerror = () => {
            console.error(`Failed to load image: ${imageData.src}`);
            loadedCount++;
            if (loadedCount === imagesToLoad.length && processedImage) renderWatermark();
        };
        img.src = imageData.src;
    });
};

// --- HÀM TẠO HIỆU ỨNG NHIỄU HẠT (GRAIN/NOISE) ---
function addFilmGrain(ctx, width, height, intensity = 0.08) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const pixels = imageData.data;
    for (let i = 0; i < pixels.length; i += 4) {
        // Cộng cùng 1 giá trị noise cho RGB để ra nhiễu hạt đơn sắc (monochrome grain) đẹp hơn
        const noise = (Math.random() - 0.5) * intensity * 255;
        pixels[i] = Math.min(255, Math.max(0, pixels[i] + noise));     // R
        pixels[i + 1] = Math.min(255, Math.max(0, pixels[i + 1] + noise)); // G
        pixels[i + 2] = Math.min(255, Math.max(0, pixels[i + 2] + noise)); // B
    }
    ctx.putImageData(imageData, 0, 0);
}

// --- HÀM RENDER CHÍNH ---
const renderWatermark = () => {
    if (!processedImage) return;

    const width = processedImage.naturalWidth;
    const height = processedImage.naturalHeight;
    canvas.width = width;
    canvas.height = height;

    // Lấy giá trị độ sáng từ thanh trượt
    const brightness = overallBrightnessInput ? overallBrightnessInput.value : 100;
    // Áp dụng bộ lọc độ sáng cho Canvas
    ctx.filter = `brightness(${brightness}%)`;

    canvas.style.display = 'block';
    emptyState.style.display = 'none';
    cropperContainer.style.display = 'none'; 

    // 2. Vẽ nền
    ctx.drawImage(processedImage, 0, 0, width, height);

    // 3. Phủ Gradient (Chỉ làm tối nhẹ 20% dưới đáy để làm nền cho chữ)
    const gradient = ctx.createLinearGradient(0, height * 0.8, 0, height);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');    
    gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.3)'); // Mờ hơn, không nuốt mất mặt cỏ
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.65)');  // Đủ độ tương phản cho chữ trắng
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    //3.1. Vẽ pattern
    if (patternImage) {
        ctx.save();
        
        // Lấy giá trị Opacity từ thanh trượt
        const patternOpacity = patternOpacityInput ? parseFloat(patternOpacityInput.value) : 0.5;
        ctx.globalAlpha = patternOpacity;
        
        // Chế độ Blend Mode: 'multiply' giúp pattern hòa quyện làm tối ảnh giống Photoshop
        // Nếu pattern của bạn là màu trắng sáng, hãy đổi 'multiply' thành 'overlay'
        ctx.globalCompositeOperation = 'multiply'; 

        // Lặp pattern lấp đầy toàn bộ Canvas
        const pattern = ctx.createPattern(patternImage, 'repeat');
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, width, height);
        
        ctx.restore();
    }

    // 4. Logo chìm khổng lồ
    if (logoImage) {
        ctx.save();
        ctx.globalAlpha = 0.06; // Tăng opacity lên 0.06 cho rõ hơn
        ctx.globalCompositeOperation = 'screen'; 
        const giantSize = width * 1.1; 
        ctx.drawImage(
            logoImage, 
            width - giantSize * 0.49, 
            height - giantSize * 0.55, 
            giantSize, 
            giantSize
        );
        ctx.restore();
    }

    // 5. Logo nhỏ trái 
    if (logoImage) {
        const smallSize = width * 0.08; 
        const padding = width * 0.03;
        ctx.drawImage(logoImage, padding, padding, smallSize, smallSize);
    }

    // 6. Logo text phải 
    if (logoTxtImage) {
        const logoHeight = width * 0.06;
        const logoWidth = logoHeight * (logoTxtImage.naturalWidth / logoTxtImage.naturalHeight);
        const padding = width * 0.035;
        ctx.drawImage(logoTxtImage, width - padding - logoWidth, padding, logoWidth, logoHeight);
    }

    // 7. Vẽ Title 
    const rawTitle = titleInput.value || "Hãy nhập {title}"; 

    // Tách các dòng dựa vào phím Enter (\n)
    const lines = rawTitle.split('\n');
    let titleFontSize = null;

    if (lines.length === 1) {
        titleFontSize = width * 0.04; 
    } else {
        titleFontSize = width * 0.042; 
    }

    const titlePaddingX = width * 0.025; 
    const bottomMargin = width * 0.06; // Lề dưới cùng

    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${titleFontSize}px Albula, Arial, sans-serif`;

    
    const lineHeight = titleFontSize * 1.3; // Khoảng cách giữa các dòng
    
    // Thuật toán: Dòng cuối cùng luôn neo ở bottomMargin. Đẩy các dòng trên lên cao dần.
    const startY = height - bottomMargin - (lines.length - 1) * lineHeight;

    // A. Vẽ thanh dọc (Vertical bar) tự động dài ra theo số dòng

    const barWidth = titleFontSize * 0.18; // Bề ngang thanh bar
    let barY, barHeight;

    if (lines.length === 1) {
        // TRƯỜNG HỢP 1 DÒNG: Bar dài hơn chữ, chữ nằm chính giữa Bar
        barHeight = titleFontSize * 1.85; // Dài hơn font size một chút
        barY = startY - barHeight / 2;    // Đẩy lên một nửa để căn giữa với chữ
    } else {
        // TRƯỜNG HỢP NHIỀU DÒNG: Đáy bar ngang đáy chữ cuối, đỉnh bar thấp hơn chữ đầu
        const lastLineY = startY + (lines.length - 1) * lineHeight; // Y của dòng chữ cuối
        const textBottom = lastLineY + (titleFontSize * 0.45);      // Tọa độ đáy của dòng cuối

        barY = startY - (titleFontSize * 0.1); // Đỉnh bar bắt đầu thấp hơn đỉnh chữ dòng đầu một chút
        barHeight = textBottom - barY;         // Chiều dài kéo từ đỉnh bar đến bằng đáy chữ
    }


    ctx.fillStyle = 'white';
    
    ctx.fillRect(titlePaddingX, barY, barWidth, barHeight);

    // Tính toán độ dính chữ (khoảng -4px) và làm tròn số
    const spacingPx = Math.round(titleFontSize * -0.083); 

    // Hàm "thợ xây": Tự tay cầm từng chữ cái xếp lên hình
    function drawTextTight(textStr, x, y) {
        let currX = x;
        // normalize('NFC'): Gộp dấu Tiếng Việt để không bị vỡ chữ
        // Array.from: Tách chuỗi thành mảng từng ký tự an toàn
        const chars = Array.from(textStr.normalize('NFC'));
        
        for (let i = 0; i < chars.length; i++) {
            const char = chars[i];
            ctx.fillText(char, currX, y); // Đặt chữ xuống
            // Đo bề ngang chữ vừa đặt, rồi trừ đi spacingPx để ép chữ sau lùi lại
            currX += ctx.measureText(char).width + spacingPx;
        }
        return currX; // Trả về tọa độ X mới để đoạn text màu khác nối vào
    }

    // Quét và vẽ từng dòng
    lines.forEach((line, index) => {
        let currentX = titlePaddingX + barWidth + (titleFontSize * 0.4); 
        const currentY = startY + (index * lineHeight); 
        
        const textParts = line.split(/({[^}]+})/g); 

        textParts.forEach(part => {
            if (part.startsWith('{') && part.endsWith('}')) {
                ctx.fillStyle = '#e2f90e'; // Màu vàng
                const text = part.slice(1, -1); 
                // Gọi hàm thợ xây vẽ chữ vàng
                currentX = drawTextTight(text, currentX, currentY); 
            } else if (part.length > 0) {
                ctx.fillStyle = 'white'; // Màu trắng
                // Gọi hàm thợ xây vẽ chữ trắng
                currentX = drawTextTight(part, currentX, currentY);
            }
        });
    });
    ctx.restore();

    // 8. Grain
    addFilmGrain(ctx, width, height, 0.08); //Không trượt thì 0.08 mặc định
    const grainIntensity = grainIntensityInput ? parseFloat(grainIntensityInput.value) : 0.08;
    addFilmGrain(ctx, width, height, grainIntensity);
};

// --- QUẢN LÝ WORKFLOW CROP VÀ SCALE ---

function enterCropMode() {
    if (!baseImage) return;

    // UI
    canvas.style.display = 'none';
    wtmSettingsPanel.style.display = 'none';
    cropperContainer.style.display = 'flex'; 
    cropControls.style.display = 'block';
    
    // Tắt các nút (Dùng ?. để tránh lỗi Crash JS nếu thiếu ID)
    exportBtn.disabled = true;
    exportBtn.classList.add('disabled');
    document.getElementById("home-btn")?.classList.add('disabled');

    // Khởi tạo Cropper (Dùng setTimeout để đảm bảo container đã hiện ra)
    imageToCrop.src = baseImage.src;
    
    setTimeout(() => {
        if (cropper) cropper.destroy();
        cropper = new Cropper(imageToCrop, {
            aspectRatio: TARGET_ASPECT_RATIO, 
            viewMode: 1, 
            dragMode: 'crop', 
            autoCropArea: 0.9, 
            restore: false,
            zoomable: true, 
            cropBoxResizable: true, 
            cropBoxMovable: true, 
        });
    }, 50);
}

function applyCropAndContinue() {
    if (!cropper) return;

    const croppedCanvas = cropper.getCroppedCanvas({
        width: MIN_WIDTH,
        height: MIN_HEIGHT,
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high',
    });

    processedImage = new Image();
    processedImage.onload = () => {
        exitCropMode();
        renderWatermark();
    };
    processedImage.src = croppedCanvas.toDataURL("image/png", 1.0);
}

function cancelCrop() {
    if (!processedImage) {
        window.location.reload(); 
    } else {
        exitCropMode();
        renderWatermark(); 
    }
}

function exitCropMode() {
    cropperContainer.style.display = 'none';
    cropControls.style.display = 'none';
    wtmSettingsPanel.style.display = 'block';
    
    canvas.style.display = 'block';

    exportBtn.disabled = false;
    exportBtn.classList.remove('disabled');
    document.getElementById("home-btn")?.classList.remove('disabled');
    
    cropModeInput.checked = false;

    if (cropper) {
        cropper.destroy();
        cropper = null;
    }
}

// --- XỬ LÝ SỰ KIỆN ---

imgInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                baseImage = img; 
                cropModeLabel.classList.remove('disabled');
                cropModeInput.disabled = false;
                cropModeInput.checked = true; 
                enterCropMode(); 

                emptyState.style.display = 'none'; // Ẩn div "Upload image to start"
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }
});

cropModeLabel.addEventListener('click', (e) => {
    if (cropModeLabel.classList.contains('disabled')) {
        alert("Please upload an image first!");
        return;
    }
    if (!cropModeInput.checked) {
        enterCropMode();
    } else {
        cancelCrop();
    }
});

confirmCropBtn.addEventListener('click', applyCropAndContinue);
cancelCropBtn.addEventListener('click', cancelCrop);

//debouce để bớt lag khi render
let typingTimer; // Biến lưu trữ đồng hồ đếm ngược
const doneTypingInterval = 150; // Thời gian chờ (0.15 giây)

titleInput.addEventListener('input', () => {
    clearTimeout(typingTimer); // Xóa đồng hồ cũ nếu user vẫn đang gõ
    
    if (processedImage) {
        // Đặt lại đồng hồ mới
        typingTimer = setTimeout(() => {
            renderWatermark(); // Chỉ render khi đã ngừng gõ sau 0.15 giây
        }, doneTypingInterval);
    }
});

// Nút Xuất File (Đã nâng cấp hỗ trợ Share thẳng vào Photos trên iOS)
exportBtn.addEventListener('click', async () => {
    if (!processedImage) {
        alert("Please upload and crop an image first!");
        return;
    }

    // Lấy ảnh chất lượng cao từ Canvas
    const dataUrl = canvas.toDataURL("image/jpeg", 1.0);

    // KIỂM TRA: Nếu là thiết bị di động và hỗ trợ Web Share API
    if (navigator.canShare && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
        try {
            // Chuyển ảnh từ DataURL sang dạng File để Share
            const response = await fetch(dataUrl);
            const blob = await response.blob();
            const file = new File([blob], 'Goal-Line_Watermark.jpg', { type: 'image/jpeg' });

            // Mở bảng Share mặc định của iPhone/Android
            if (navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: 'Goal-Line Image'
                });
                return; // Nếu share thành công thì dừng ở đây, không tải file nữa
            }
        } catch (error) {
            console.log("User cancelled share or share failed", error);
            // Nếu user bấm hủy share thì không làm gì cả
            return;
        }
    }

    // FALLBACK: Dành cho Laptop/PC hoặc trình duyệt không hỗ trợ Share
    const link = document.createElement('a');
    link.download = 'Goal-Line_Watermark.jpg';
    link.href = dataUrl;
    link.click();
});

// Cập nhật số % và render lại ảnh ngay lập tức khi kéo thanh trượt
let sliderTimer; // Đồng hồ riêng cho các thanh trượt
const sliderInterval = 100; // Chờ 100ms (0.1 giây) là con số hoàn hảo cho thanh trượt

// 1. Thanh trượt Pattern
patternOpacityInput?.addEventListener('input', (e) => {
    // 1. Cập nhật con số % NGAY LẬP TỨC để UI không bị sượng
    if (patternValDisplay) {
        patternValDisplay.textContent = Math.round(e.target.value * 100) + '%';
    }
    
    // 2. Tạm hoãn Render Canvas
    clearTimeout(sliderTimer);
    if (processedImage) {
        sliderTimer = setTimeout(() => {
            renderWatermark();
        }, sliderInterval);
    }
});

// 2. Thanh trượt Độ sáng (Brightness)
overallBrightnessInput?.addEventListener('input', (e) => {
    // 1. Cập nhật con số % NGAY LẬP TỨC
    if (brightnessValDisplay) {
        brightnessValDisplay.textContent = e.target.value + '%';
    }
    
    // 2. Tạm hoãn Render Canvas
    clearTimeout(sliderTimer);
    if (processedImage) {
        sliderTimer = setTimeout(() => {
            renderWatermark();
        }, sliderInterval);
    }
});

// 3. Thanh trượt Độ nhiễu hạt (Grain)
grainIntensityInput?.addEventListener('input', (e) => {
    // 1. Cập nhật con số % NGAY LẬP TỨC
    if (grainValDisplay) {
        grainValDisplay.textContent = Math.round(e.target.value * 100) + '%';
    }
    
    // 2. Tạm hoãn Render Canvas
    clearTimeout(sliderTimer);
    if (processedImage) {
        sliderTimer = setTimeout(() => {
            renderWatermark();
        }, sliderInterval);
    }
});

// Start
if (document.fonts) {
    document.fonts.load('bold 16px "Albula"').then(() => {
        console.log("Font Albula loaded!");
        loadImages(); // Đợi font tải xong mới bắt đầu tải logo và render
    }).catch((err) => {
        console.log("Font load error, fallback running...", err);
        loadImages(); // Lỡ có lỗi gì thì tool vẫn chạy tiếp chứ không chết
    });
} else {
    // Nếu trình duyệt quá cũ không hỗ trợ document.fonts
    loadImages();
}