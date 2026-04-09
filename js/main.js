import { Circle } from './shapes/Circle.js';
import { Arrow } from './shapes/Arrow.js';
import { TextObj } from './shapes/TextObj.js';
import { Polygon } from './shapes/Polygon.js';
import { Storage } from './storage.js';
import { 
    canvas, ctx, loadImages, resizeCanvas, drawPitch, clearCanvas, getImages, responsiveConstant, 
    setCustomBackground, clearCustomBackground, saveCustomBackgroundToStorage, loadCustomBackgroundFromStorage 
} from './canvas.js';
import { getMousePos } from './utils.js';

// --- STATE MANAGEMENT ---
const AppState = {
    circles: [],
    arrows: [],
    texts: [],
    polygons: [],
    pitchType: 'horizontal',
    
    // Selection & Dragging
    selectedObj: null,
    selectedType: null, // 'circle', 'arrow', 'text', 'polygon'
    isDragging: false,
    dragOffset: { x: 0, y: 0 },

    // Polygon Dragging Logic
    lastMousePos: { x: 0, y: 0 }, // Dùng để tính delta di chuyển cả khối polygon
    polygonDragIndex: -1,         // Index của đỉnh đang được kéo (-1 là không kéo đỉnh nào)
    
    // Drawing Modes
    mode: 'select', // 'select', 'drawArrow', 'drawPolygon'
    drawingArrow: null,
    drawingPolygonPoints: [],
    
    arrowDragPoint: null, // 'from', 'to', 'body'
    
    // Global Scale (Mặc định 1.0)
    userScale: 1.0 
};

// --- INITIALIZATION ---
async function init() {
    await loadImages();
    
    // 1. Load dữ liệu object từ Storage (Load vào AppState nhưng chưa render ngay)
    const data = Storage.load();
    const hasObjectData = data.circles.length > 0 || data.arrows.length > 0 || data.texts.length > 0 || data.polygons.length > 0;
    
    // 2. Load ảnh nền Custom từ Storage (nếu có)
    const hasCustomBg = await loadCustomBackgroundFromStorage();
    
    // 3. Logic hiển thị nút Continue
    const continueSection = document.getElementById("continue-section");
    const startupModal = document.getElementById("startup-modal");
    
    if (hasObjectData || hasCustomBg) {
        continueSection.style.display = "block";
    } else {
        continueSection.style.display = "none";
    }

    // Hiển thị modal khi mới vào
    startupModal.style.display = "flex";

    // Setup giá trị mặc định cho Slider & Number Input
    document.getElementById("global-scale").value = AppState.userScale;
    document.getElementById("scale-number").value = AppState.userScale;
}

// --- RENDER LOOP ---
function render() {
    clearCanvas();
    drawPitch(AppState.pitchType);
    const imgs = getImages();

    // 1. Draw Polygons (Vẽ vùng trước để nằm dưới)
    AppState.polygons.forEach((p) => {
        const isSelected = (AppState.selectedObj === p);
        // Lưu ý: Đảm bảo Polygon.js của bạn có hàm draw nhận userScale
        p.draw(ctx, isSelected, AppState.userScale);
    });
    // Draw polygon đang vẽ dở
    if (AppState.drawingPolygonPoints.length > 0) {
        new Polygon(AppState.drawingPolygonPoints).draw(ctx, true, AppState.userScale);
    }

    // 2. Draw Arrows
    AppState.arrows.forEach((a) => {
        const isSelected = (AppState.selectedObj === a);
        a.draw(ctx, responsiveConstant, isSelected, AppState.userScale);
    });
    // Draw arrow đang vẽ dở
    if (AppState.drawingArrow) {
        AppState.drawingArrow.draw(ctx, responsiveConstant, true, AppState.userScale);
    }

    // 3. Draw Circles (Cầu thủ)
    AppState.circles.forEach((c) => {
        const isSelected = (AppState.selectedObj === c);
        c.draw(ctx, imgs.ball, responsiveConstant, isSelected, AppState.userScale);
    });

    // 4. Draw Texts (Chữ nằm trên cùng)
    AppState.texts.forEach((t) => {
        const isSelected = (AppState.selectedObj === t);
        t.draw(ctx, responsiveConstant, isSelected, AppState.userScale);
    });
    
    // Save state objects automatically
    Storage.save(AppState.circles, AppState.arrows, AppState.texts, AppState.polygons, AppState.pitchType);
}

// --- EVENT HANDLERS ---

// 1. Mouse Events on Canvas
canvas.addEventListener("mousedown", (e) => {
    const pos = getMousePos(canvas, e);
    
    // Mode: Draw Arrow
    if (document.getElementById("draw-arrow-input").checked) {
        AppState.mode = 'drawArrow';
        const color = document.getElementById("arrow-color").value;
        const type = document.getElementById("arrow-type").value;
        const isArrow = document.getElementById("is-arrow").checked;
        AppState.drawingArrow = new Arrow(pos.x, pos.y, pos.x, pos.y, color, type, isArrow);
        return;
    }

    // Mode: Draw Polygon
    if (document.getElementById("draw-polygon-input").checked) {
        AppState.mode = 'drawPolygon';
        AppState.drawingPolygonPoints.push({x: pos.x, y: pos.y});
        render(); // Render điểm mới
        return;
    }

    // Mode: Select (Mặc định)
    AppState.mode = 'select';
    AppState.selectedObj = null;
    AppState.isDragging = false;
    AppState.polygonDragIndex = -1; // Reset polygon vertex drag

    // Check Hit (Thứ tự check ngược với thứ tự vẽ: Text -> Circle -> Arrow -> Polygon)
    // Để click trúng cái nằm trên cùng trước
    
    // 1. Check Text
    for (let i = AppState.texts.length - 1; i >= 0; i--) {
        if (AppState.texts[i].isHit(pos.x, pos.y, ctx, responsiveConstant, AppState.userScale)) {
            AppState.selectedObj = AppState.texts[i];
            AppState.selectedType = 'text';
            AppState.isDragging = true;
            AppState.dragOffset = { x: pos.x - AppState.texts[i].x, y: pos.y - AppState.texts[i].y };
            render(); return;
        }
    }

    // 2. Check Circle
    for (let i = AppState.circles.length - 1; i >= 0; i--) {
        if (AppState.circles[i].isHit(pos.x, pos.y, AppState.userScale)) {
            AppState.selectedObj = AppState.circles[i];
            AppState.selectedType = 'circle';
            AppState.isDragging = true;
            AppState.dragOffset = { x: pos.x - AppState.circles[i].x, y: pos.y - AppState.circles[i].y };
            render(); return;
        }
    }

    // 3. Check Arrow
    for (let i = AppState.arrows.length - 1; i >= 0; i--) {
        const arr = AppState.arrows[i];
        
        // Check handle uốn cong (Ưu tiên check cái này trước)
        if (arr.isHitHandle(pos.x, pos.y, 'control', responsiveConstant, AppState.userScale)) {
            AppState.selectedObj = arr;
            AppState.selectedType = 'arrow';
            AppState.isDragging = true;
            AppState.arrowDragPoint = 'control'; // Điểm mới
            render(); return;
        }
        if (arr.isHitHandle(pos.x, pos.y, 'from', responsiveConstant, AppState.userScale)) {
            AppState.selectedObj = arr;
            AppState.selectedType = 'arrow';
            AppState.isDragging = true;
            AppState.arrowDragPoint = 'from';
            render(); return;
        }
        if (arr.isHitHandle(pos.x, pos.y, 'to', responsiveConstant, AppState.userScale)) {
            AppState.selectedObj = arr;
            AppState.selectedType = 'arrow';
            AppState.isDragging = true;
            AppState.arrowDragPoint = 'to';
            render(); return;
        }
        if (arr.isHitBody(pos.x, pos.y, AppState.userScale)) {
            AppState.selectedObj = arr;
            AppState.selectedType = 'arrow';
            AppState.isDragging = true;
            AppState.arrowDragPoint = 'body';
            // Bổ sung lưu thêm offset của cx, cy để khi kéo thân mũi tên nó bê nguyên hình dạng cong đi theo
            AppState.dragOffset = { 
                fromX: pos.x - arr.fromX, fromY: pos.y - arr.fromY, 
                toX: pos.x - arr.toX, toY: pos.y - arr.toY,
                cx: pos.x - arr.cx, cy: pos.y - arr.cy
            };
            render(); return;
        }
    }

    // 4. Check Polygon
    for (let i = AppState.polygons.length - 1; i >= 0; i--) {
        const poly = AppState.polygons[i];

        // A. Ưu tiên kiểm tra: Có click trúng ĐỈNH (Vertex) không?
        const vertexIndex = poly.getHitVertexIndex(pos.x, pos.y, AppState.userScale);
        
        if (vertexIndex !== -1) {
            // TRÚNG ĐỈNH -> Chế độ chỉnh sửa hình dáng
            AppState.selectedObj = poly;
            AppState.selectedType = 'polygon';
            AppState.isDragging = true;
            AppState.polygonDragIndex = vertexIndex; // Lưu index đỉnh
            render();
            return;
        }

        // B. Nếu không trúng đỉnh, kiểm tra trúng THÂN
        if (poly.isHit(pos.x, pos.y)) {
            // TRÚNG THÂN -> Chế độ di chuyển cả khối
            AppState.selectedObj = poly;
            AppState.selectedType = 'polygon';
            AppState.isDragging = true;
            AppState.lastMousePos = { x: pos.x, y: pos.y }; // Lưu vị trí bắt đầu kéo
            AppState.polygonDragIndex = -1; // Không kéo đỉnh
            render();
            return;
        }
    }
    
    // Nếu không click trúng gì -> Deselect
    render();
});

canvas.addEventListener("mousemove", (e) => {
    const pos = getMousePos(canvas, e);

    // Xử lý vẽ Arrow (kéo thả để tạo)
    if (AppState.mode === 'drawArrow' && AppState.drawingArrow) {
        AppState.drawingArrow.toX = pos.x;
        AppState.drawingArrow.toY = pos.y;
        render();
        return;
    }

    // Xử lý kéo thả Object
    if (AppState.isDragging && AppState.selectedObj) {
        
        // --- TEXT & CIRCLE ---
        if (AppState.selectedType === 'circle' || AppState.selectedType === 'text') {
            AppState.selectedObj.x = pos.x - AppState.dragOffset.x;
            AppState.selectedObj.y = pos.y - AppState.dragOffset.y;
        } 
        
        // --- ARROW ---
        else if (AppState.selectedType === 'arrow') {
            const arr = AppState.selectedObj;
            if (AppState.arrowDragPoint === 'from') {
                arr.fromX = pos.x; arr.fromY = pos.y;
            } else if (AppState.arrowDragPoint === 'to') {
                arr.toX = pos.x; arr.toY = pos.y;
            } else if (AppState.arrowDragPoint === 'control') { // <--- Xử lý khi kéo điểm cong
                arr.cx = pos.x; arr.cy = pos.y;
            } else if (AppState.arrowDragPoint === 'body') {
                arr.fromX = pos.x - AppState.dragOffset.fromX;
                arr.fromY = pos.y - AppState.dragOffset.fromY;
                arr.toX = pos.x - AppState.dragOffset.toX;
                arr.toY = pos.y - AppState.dragOffset.toY;
                arr.cx = pos.x - AppState.dragOffset.cx; // <--- Điểm cong trôi theo thân
                arr.cy = pos.y - AppState.dragOffset.cy;
            }
        }
        
        // --- POLYGON ---
        else if (AppState.selectedType === 'polygon') {
            if (AppState.polygonDragIndex !== -1) {
                // CASE 1: KÉO ĐỈNH -> Sửa hình dáng
                // Cập nhật tọa độ đỉnh đang kéo theo chuột
                AppState.selectedObj.points[AppState.polygonDragIndex].x = pos.x;
                AppState.selectedObj.points[AppState.polygonDragIndex].y = pos.y;
            } else {
                // CASE 2: KÉO THÂN -> Di chuyển cả khối
                const dx = pos.x - AppState.lastMousePos.x;
                const dy = pos.y - AppState.lastMousePos.y;
                AppState.selectedObj.move(dx, dy);
                AppState.lastMousePos = { x: pos.x, y: pos.y }; // Cập nhật vị trí chuột cũ
            }
        }
        render();
    }
});

canvas.addEventListener("mouseup", () => {
    // Kết thúc vẽ Arrow
    if (AppState.mode === 'drawArrow' && AppState.drawingArrow) {
        AppState.arrows.push(AppState.drawingArrow);
        AppState.drawingArrow = null;
        AppState.mode = 'select'; // Quay về mode select
        document.getElementById("draw-arrow-input").checked = false; // Bỏ check UI
        updateCounts();
    }
    
    // Kết thúc kéo thả
    AppState.isDragging = false;
    AppState.arrowDragPoint = null;
    AppState.polygonDragIndex = -1;
    render();
});

// 2. UI & Startup Logic

// Nút Home
document.getElementById("home-btn").addEventListener("click", () => {
    const hasData = AppState.circles.length > 0 || AppState.arrows.length > 0 || AppState.texts.length > 0 || AppState.polygons.length > 0;
    document.getElementById("continue-section").style.display = hasData ? "block" : "none";
    document.getElementById("startup-modal").style.display = "flex";
});

// Nút Continue
document.getElementById("btn-continue").addEventListener("click", () => {
    document.getElementById("startup-modal").style.display = "none";
    
    // Nếu có custom bg thì khóa select
    if (localStorage.getItem('customBgData')) {
         document.getElementById("pitch-type").disabled = true;
    }
    
    // Re-hydrate objects từ Storage vào AppState
    const data = Storage.load();
    if(data) {
        AppState.circles = data.circles.map(d => new Circle(d.x, d.y, d.radius, d.color, d.text, d.textColor, d.detailsText));
        AppState.arrows = data.arrows.map(d => new Arrow(d.fromX, d.fromY, d.toX, d.toY, d.color, d.type, d.isArrow, d.cx, d.cy)); 
        AppState.texts = data.texts.map(d => new TextObj(d.x, d.y, d.text, d.fontSize, d.rotate));
        // Lưu ý: Polygon constructor nhận array points
        AppState.polygons = data.polygons.map(d => new Polygon(d.points || d)); // Fallback cho data cũ nếu có
        AppState.pitchType = data.pitchType || 'horizontal';
    }

    resizeCanvas(AppState.pitchType);
    updateCounts();
    render();
});

// Nút Template Mode
document.getElementById("btn-template-mode").addEventListener("click", () => {
    document.getElementById("startup-modal").style.display = "none";
    clearCustomBackground();
    saveCustomBackgroundToStorage(); // Save null -> Xóa
    document.getElementById("pitch-type").disabled = false;
    
    // Reset workspace
    if(confirm("Start fresh workspace?")) {
        AppState.circles = []; AppState.arrows = []; AppState.texts = []; AppState.polygons = [];
        Storage.clear();
    }
    
    resizeCanvas(AppState.pitchType);
    updateCounts();
    render();
});

// Nút Custom Image Mode
document.getElementById("btn-custom-mode").addEventListener("click", () => {
    document.getElementById("custom-img-input").click();
});

// Input File Change Logic
document.getElementById("custom-img-input").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Warning
    if (AppState.circles.length > 0) {
        if (!confirm("This will clear your current tactics. Continue?")) {
            e.target.value = ''; return;
        }
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
        const imgUrl = event.target.result;
        await setCustomBackground(imgUrl);
        saveCustomBackgroundToStorage();

        document.getElementById("startup-modal").style.display = "none";
        document.getElementById("pitch-type").disabled = true;

        // Clear objects
        AppState.circles = []; AppState.arrows = []; AppState.texts = []; AppState.polygons = [];
        Storage.clear();
        
        resizeCanvas(AppState.pitchType);
        updateCounts();
        render();
    };
    reader.readAsDataURL(file);
});

// --- SCALE CONTROL LOGIC (Slider + Input) ---
const scaleSlider = document.getElementById("global-scale");
const scaleNumber = document.getElementById("scale-number");

// 1. Slider Change
scaleSlider.addEventListener("input", (e) => {
    const val = parseFloat(e.target.value);
    AppState.userScale = val;
    scaleNumber.value = val;
    render();
});

// 2. Number Input Change
scaleNumber.addEventListener("input", (e) => {
    let val = parseFloat(e.target.value);
    if (isNaN(val)) return;

    if (val < 0.1) val = 0.1;
    if (val > 5.0) val = 5.0;

    AppState.userScale = val;
    scaleSlider.value = val;
    render();
});

// 3. Blur Input (Fix format)
scaleNumber.addEventListener("blur", (e) => {
    let val = parseFloat(e.target.value);
    if (isNaN(val) || val < 0.1) val = 0.1;
    if (val > 5.0) val = 5.0;
    
    scaleNumber.value = val;
    scaleSlider.value = val;
    AppState.userScale = val;
    render();
});

// --- OTHER CONTROLS ---

document.getElementById("pitch-type").addEventListener("change", (e) => {
    AppState.pitchType = e.target.value;
    resizeCanvas(AppState.pitchType);
    render();
});

document.getElementById("circle-btn").addEventListener("click", () => {
    const color = document.getElementById("circle-color").value;
    const text = document.getElementById("circle-text").value;
    const details = document.getElementById("circle-details-text").value;
    const textColor = document.getElementById("circle-text-color").value || "white";
    
    const newCircle = new Circle(canvas.width/2, canvas.height/2, 20 * responsiveConstant, color, text, textColor, details);
    AppState.circles.push(newCircle);
    document.getElementById("circle-text").value = "";
    document.getElementById("circle-details-text").value = "";
    updateCounts();
    render();
});

document.getElementById("text-btn").addEventListener("click", () => {
    const val = document.getElementById("text-input").value;
    if(!val) return;
    const fontSize = parseInt(document.getElementById("text-font-size").value) || 20;
    AppState.texts.push(new TextObj(canvas.width/2, canvas.height/2, val, fontSize));
    document.getElementById("text-input").value = "";
    updateCounts();
    render();
});

document.getElementById("closePolygon").addEventListener("click", () => {
    if (AppState.drawingPolygonPoints.length > 2) {
        AppState.polygons.push(new Polygon(AppState.drawingPolygonPoints));
        AppState.drawingPolygonPoints = [];
        document.getElementById("draw-polygon-input").checked = false;
        updateCounts();
        render();
    }
});

document.getElementById("delete-btn").addEventListener("click", () => {
    if (!AppState.selectedObj) return;
    if (AppState.selectedType === 'circle') AppState.circles = AppState.circles.filter(o => o !== AppState.selectedObj);
    else if (AppState.selectedType === 'arrow') AppState.arrows = AppState.arrows.filter(o => o !== AppState.selectedObj);
    else if (AppState.selectedType === 'text') AppState.texts = AppState.texts.filter(o => o !== AppState.selectedObj);
    else if (AppState.selectedType === 'polygon') AppState.polygons = AppState.polygons.filter(o => o !== AppState.selectedObj);
    
    AppState.selectedObj = null;
    updateCounts();
    render();
});

document.getElementById("reset-btn").addEventListener("click", () => {
    if(confirm("Reset pitch objects?")) {
        AppState.circles = []; AppState.arrows = []; AppState.texts = []; AppState.polygons = [];
        Storage.clear();
        updateCounts();
        render();
    }
});

document.getElementById("export-btn").addEventListener("click", () => {
    const link = document.createElement('a');
    link.download = 'goal-line-tactic.jpg';
    link.href = canvas.toDataURL("image/jpeg", 1.0);
    link.click();
});

// Update Counters
function updateCounts() {
    document.querySelector(".circle-count").innerText = AppState.circles.length;
    document.querySelector(".arrow-count").innerText = AppState.arrows.length;
    document.querySelector(".text-count").innerText = AppState.texts.length;
    // Polygon count nếu cần
    // document.querySelector(".polygon-count").innerText = AppState.polygons.length;
}

// Checkbox Logic
document.getElementById("draw-arrow-input").addEventListener("change", (e) => {
    document.getElementById("draw-polygon-input").disabled = e.target.checked;
    if(e.target.checked) AppState.selectedObj = null;
});
document.getElementById("draw-polygon-input").addEventListener("change", (e) => {
    document.getElementById("draw-arrow-input").disabled = e.target.checked;
    if(e.target.checked) AppState.selectedObj = null;
});

// Text Rotation
window.addEventListener("wheel", (e) => {
    if (e.shiftKey && AppState.selectedObj && AppState.selectedType === 'text') {
        AppState.selectedObj.rotate += (e.deltaY > 0 ? 5 : -5);
        render();
    }
});

// Start App
init();