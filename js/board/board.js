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
    lastMousePos: { x: 0, y: 0 },
    polygonDragIndex: -1,
    
    // Drawing Modes
    mode: 'select', // 'select', 'drawArrow', 'drawPolygon'
    drawingArrow: null,
    drawingPolygonPoints: [],
    
    arrowDragPoint: null, // 'from', 'to', 'control', 'body'
    
    // Global Scale (Mặc định 1.0)
    userScale: 1.0 
};

// --- LOGGING SYSTEM HELPER ---
const logEl = document.getElementById("editor-log");
function setLog(text) {
    if (logEl) logEl.textContent = text.toUpperCase();
}

// --- INITIALIZATION ---
async function init() {
    await loadImages();

    // Chờ font tùy chỉnh (Albula, Seriguela) tải xong để không bị văng font default
    if (document.fonts) {
        try {
            await document.fonts.ready;
        } catch (e) {
            console.warn("Fonts ready timeout:", e);
        }
    }
    
    // 1. Load dữ liệu object từ Storage
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

    startupModal.style.display = "flex";

    // Setup giá trị mặc định cho Slider & Number Input
    document.getElementById("global-scale").value = AppState.userScale;
    document.getElementById("scale-number").value = AppState.userScale;

    setLog("READY • SELECT WORKSPACE MODE");
}

// --- RENDER LOOP ---
function render() {
    clearCanvas();
    drawPitch(AppState.pitchType);
    const imgs = getImages();

    // 1. Draw Polygons
    AppState.polygons.forEach((p) => {
        const isSelected = (AppState.selectedObj === p);
        p.draw(ctx, isSelected, AppState.userScale);
    });
    if (AppState.drawingPolygonPoints.length > 0) {
        new Polygon(AppState.drawingPolygonPoints).draw(ctx, true, AppState.userScale);
    }

    // 2. Draw Arrows
    AppState.arrows.forEach((a) => {
        const isSelected = (AppState.selectedObj === a);
        a.draw(ctx, responsiveConstant, isSelected, AppState.userScale);
    });
    if (AppState.drawingArrow) {
        AppState.drawingArrow.draw(ctx, responsiveConstant, true, AppState.userScale);
    }

    // 3. Draw Circles
    AppState.circles.forEach((c) => {
        const isSelected = (AppState.selectedObj === c);
        c.draw(ctx, imgs.ball, responsiveConstant, isSelected, AppState.userScale);
    });

    // 4. Draw Texts
    AppState.texts.forEach((t) => {
        const isSelected = (AppState.selectedObj === t);
        t.draw(ctx, responsiveConstant, isSelected, AppState.userScale);
    });
    
    Storage.save(AppState.circles, AppState.arrows, AppState.texts, AppState.polygons, AppState.pitchType);
}

// --- EVENT HANDLERS ---

canvas.addEventListener("mousedown", (e) => {
    const pos = getMousePos(canvas, e);
    
    // Mode: Draw Arrow
    if (document.getElementById("draw-arrow-input").checked) {
        AppState.mode = 'drawArrow';
        const color = document.getElementById("arrow-color").value;
        const type = document.getElementById("arrow-type").value;
        const isArrow = document.getElementById("is-arrow").checked;
        AppState.drawingArrow = new Arrow(pos.x, pos.y, pos.x, pos.y, color, type, isArrow);
        setLog("DRAWING ARROW • DRAG TO AIM");
        return;
    }

    // Mode: Draw Polygon
    if (document.getElementById("draw-polygon-input").checked) {
        AppState.mode = 'drawPolygon';
        AppState.drawingPolygonPoints.push({x: pos.x, y: pos.y});
        setLog(`ZONE POINT ADDED (${AppState.drawingPolygonPoints.length} POINTS)`);
        render();
        return;
    }

    // Mode: Select (Mặc định)
    AppState.mode = 'select';
    AppState.selectedObj = null;
    AppState.isDragging = false;
    AppState.polygonDragIndex = -1;

    // 1. Check Text
    for (let i = AppState.texts.length - 1; i >= 0; i--) {
        if (AppState.texts[i].isHit(pos.x, pos.y, ctx, responsiveConstant, AppState.userScale)) {
            AppState.selectedObj = AppState.texts[i];
            AppState.selectedType = 'text';
            AppState.isDragging = true;
            AppState.dragOffset = { x: pos.x - AppState.texts[i].x, y: pos.y - AppState.texts[i].y };
            setLog(`SELECTED TEXT "${AppState.texts[i].text}" • DRAG TO MOVE | SHIFT+WHEEL ROTATE`);
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
            const name = AppState.circles[i].detailsText || (AppState.circles[i].text ? `#${AppState.circles[i].text}` : 'PLAYER');
            setLog(`SELECTED ${name} • DRAG TO REPOSITION`);
            render(); return;
        }
    }

    // 3. Check Arrow
    for (let i = AppState.arrows.length - 1; i >= 0; i--) {
        const arr = AppState.arrows[i];
        if (arr.isHitHandle(pos.x, pos.y, 'control', responsiveConstant, AppState.userScale)) {
            AppState.selectedObj = arr;
            AppState.selectedType = 'arrow';
            AppState.isDragging = true;
            AppState.arrowDragPoint = 'control';
            setLog("BENDING ARROW CURVE HANDLE");
            render(); return;
        }
        if (arr.isHitHandle(pos.x, pos.y, 'from', responsiveConstant, AppState.userScale)) {
            AppState.selectedObj = arr;
            AppState.selectedType = 'arrow';
            AppState.isDragging = true;
            AppState.arrowDragPoint = 'from';
            setLog("REPOSITIONING ARROW START POINT");
            render(); return;
        }
        if (arr.isHitHandle(pos.x, pos.y, 'to', responsiveConstant, AppState.userScale)) {
            AppState.selectedObj = arr;
            AppState.selectedType = 'arrow';
            AppState.isDragging = true;
            AppState.arrowDragPoint = 'to';
            setLog("REPOSITIONING ARROW HEAD POINT");
            render(); return;
        }
        if (arr.isHitBody(pos.x, pos.y, AppState.userScale)) {
            AppState.selectedObj = arr;
            AppState.selectedType = 'arrow';
            AppState.isDragging = true;
            AppState.arrowDragPoint = 'body';
            AppState.dragOffset = { 
                fromX: pos.x - arr.fromX, fromY: pos.y - arr.fromY, 
                toX: pos.x - arr.toX, toY: pos.y - arr.toY,
                cx: pos.x - arr.cx, cy: pos.y - arr.cy
            };
            setLog("MOVING ARROW OBJECT");
            render(); return;
        }
    }

    // 4. Check Polygon
    for (let i = AppState.polygons.length - 1; i >= 0; i--) {
        const poly = AppState.polygons[i];
        const vertexIndex = poly.getHitVertexIndex(pos.x, pos.y, AppState.userScale);
        
        if (vertexIndex !== -1) {
            AppState.selectedObj = poly;
            AppState.selectedType = 'polygon';
            AppState.isDragging = true;
            AppState.polygonDragIndex = vertexIndex;
            setLog(`EDITING ZONE VERTEX #${vertexIndex + 1}`);
            render(); return;
        }

        if (poly.isHit(pos.x, pos.y)) {
            AppState.selectedObj = poly;
            AppState.selectedType = 'polygon';
            AppState.isDragging = true;
            AppState.lastMousePos = { x: pos.x, y: pos.y };
            AppState.polygonDragIndex = -1;
            setLog("MOVING TACTICAL ZONE BODY");
            render(); return;
        }
    }
    
    setLog("READY • SELECT & DRAG OBJECTS");
    render();
});

canvas.addEventListener("mousemove", (e) => {
    const pos = getMousePos(canvas, e);

    if (AppState.mode === 'drawArrow' && AppState.drawingArrow) {
        AppState.drawingArrow.toX = pos.x;
        AppState.drawingArrow.toY = pos.y;
        render();
        return;
    }

    if (AppState.isDragging && AppState.selectedObj) {
        if (AppState.selectedType === 'circle' || AppState.selectedType === 'text') {
            AppState.selectedObj.x = pos.x - AppState.dragOffset.x;
            AppState.selectedObj.y = pos.y - AppState.dragOffset.y;
        } 
        else if (AppState.selectedType === 'arrow') {
            const arr = AppState.selectedObj;
            if (AppState.arrowDragPoint === 'from') {
                arr.fromX = pos.x; arr.fromY = pos.y;
            } else if (AppState.arrowDragPoint === 'to') {
                arr.toX = pos.x; arr.toY = pos.y;
            } else if (AppState.arrowDragPoint === 'control') {
                arr.cx = pos.x; arr.cy = pos.y;
            } else if (AppState.arrowDragPoint === 'body') {
                arr.fromX = pos.x - AppState.dragOffset.fromX;
                arr.fromY = pos.y - AppState.dragOffset.fromY;
                arr.toX = pos.x - AppState.dragOffset.toX;
                arr.toY = pos.y - AppState.dragOffset.toY;
                arr.cx = pos.x - AppState.dragOffset.cx;
                arr.cy = pos.y - AppState.dragOffset.cy;
            }
        } 
        else if (AppState.selectedType === 'polygon') {
            if (AppState.polygonDragIndex !== -1) {
                AppState.selectedObj.points[AppState.polygonDragIndex].x = pos.x;
                AppState.selectedObj.points[AppState.polygonDragIndex].y = pos.y;
            } else {
                const dx = pos.x - AppState.lastMousePos.x;
                const dy = pos.y - AppState.lastMousePos.y;
                AppState.selectedObj.move(dx, dy);
                AppState.lastMousePos = { x: pos.x, y: pos.y };
            }
        }
        render();
    }
});

canvas.addEventListener("mouseup", () => {
    if (AppState.mode === 'drawArrow' && AppState.drawingArrow) {
        AppState.arrows.push(AppState.drawingArrow);
        AppState.drawingArrow = null;
        AppState.mode = 'select';
        
        const arrowCheckbox = document.getElementById("draw-arrow-input");
        if (arrowCheckbox) arrowCheckbox.checked = false;
        
        updateToggleStatus();
        updateCounts();
        setLog("ARROW CREATED SUCCESSFULLY");
    }
    
    AppState.isDragging = false;
    AppState.arrowDragPoint = null;
    AppState.polygonDragIndex = -1;
    render();
});

// Nút Continue
document.getElementById("btn-continue").addEventListener("click", () => {
    document.getElementById("startup-modal").style.display = "none";
    if (localStorage.getItem('customBgData')) {
        document.getElementById("pitch-type").disabled = true;
    }
    
    const data = Storage.load();
    if(data) {
        AppState.circles = data.circles.map(d => new Circle(d.x, d.y, d.radius, d.color, d.text, d.textColor, d.detailsText));
        AppState.arrows = data.arrows.map(d => new Arrow(d.fromX, d.fromY, d.toX, d.toY, d.color, d.type, d.isArrow, d.cx, d.cy)); 
        AppState.texts = data.texts.map(d => new TextObj(d.x, d.y, d.text, d.fontSize, d.rotate));
        AppState.polygons = data.polygons.map(d => new Polygon(d.points || d));
        AppState.pitchType = data.pitchType || 'horizontal';
    }

    resizeCanvas(AppState.pitchType);
    updateCounts();
    render();
    setLog("RESTORED PREVIOUS SESSION");
});

// Nút Template Mode
document.getElementById("btn-template-mode").addEventListener("click", () => {
    document.getElementById("startup-modal").style.display = "none";
    clearCustomBackground();
    saveCustomBackgroundToStorage();
    document.getElementById("pitch-type").disabled = false;
    
    if(confirm("Start fresh workspace?")) {
        AppState.circles = []; AppState.arrows = []; AppState.texts = []; AppState.polygons = [];
        Storage.clear();
    }
    
    resizeCanvas(AppState.pitchType);
    updateCounts();
    render();
    setLog("TEMPLATE WORKSPACE INITIALIZED");
});

// Nút Custom Image Mode
document.getElementById("btn-custom-mode").addEventListener("click", () => {
    document.getElementById("custom-img-input").click();
});

document.getElementById("custom-img-input").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

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

        AppState.circles = []; AppState.arrows = []; AppState.texts = []; AppState.polygons = [];
        Storage.clear();
        
        resizeCanvas(AppState.pitchType);
        updateCounts();
        render();
        setLog("CUSTOM TACTICAL IMAGE LOADED");
    };
    reader.readAsDataURL(file);
});

// --- SCALE CONTROL LOGIC ---
const scaleSlider = document.getElementById("global-scale");
const scaleNumber = document.getElementById("scale-number");

scaleSlider.addEventListener("input", (e) => {
    const val = parseFloat(e.target.value);
    AppState.userScale = val;
    scaleNumber.value = val;
    setLog(`OBJECT SCALE SET TO ${val.toFixed(1)}X`);
    render();
});

scaleNumber.addEventListener("input", (e) => {
    let val = parseFloat(e.target.value);
    if (isNaN(val)) return;
    if (val < 0.1) val = 0.1;
    if (val > 5.0) val = 5.0;

    AppState.userScale = val;
    scaleSlider.value = val;
    setLog(`OBJECT SCALE SET TO ${val.toFixed(1)}X`);
    render();
});

// --- FORM CONTROLS & LOGS ---
document.getElementById("pitch-type").addEventListener("change", (e) => {
    AppState.pitchType = e.target.value;
    resizeCanvas(AppState.pitchType);
    setLog(`PITCH ORIENTATION: ${e.target.value.toUpperCase()}`);
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
    setLog(`ADDED TOKEN ${details ? details : (text ? '#' + text : color)}`);
});

document.getElementById("text-btn").addEventListener("click", () => {
    const val = document.getElementById("text-input").value;
    if(!val) return;
    const fontSize = parseInt(document.getElementById("text-font-size").value) || 20;
    AppState.texts.push(new TextObj(canvas.width/2, canvas.height/2, val, fontSize));
    document.getElementById("text-input").value = "";
    updateCounts();
    render();
    setLog(`ADDED TEXT: "${val}"`);
});

document.getElementById("closePolygon").addEventListener("click", () => {
    if (AppState.drawingPolygonPoints.length > 2) {
        AppState.polygons.push(new Polygon(AppState.drawingPolygonPoints));
        AppState.drawingPolygonPoints = [];
        const zoneCheckbox = document.getElementById("draw-polygon-input");
        if (zoneCheckbox) zoneCheckbox.checked = false;
        updateToggleStatus();
        updateCounts();
        render();
        setLog("TACTICAL ZONE CLOSED & CREATED");
    } else {
        setLog("NEED AT LEAST 3 POINTS TO FINISH ZONE");
    }
});

document.getElementById("delete-btn").addEventListener("click", () => {
    if (!AppState.selectedObj) {
        setLog("NO OBJECT SELECTED TO DELETE");
        return;
    }
    if (AppState.selectedType === 'circle') AppState.circles = AppState.circles.filter(o => o !== AppState.selectedObj);
    else if (AppState.selectedType === 'arrow') AppState.arrows = AppState.arrows.filter(o => o !== AppState.selectedObj);
    else if (AppState.selectedType === 'text') AppState.texts = AppState.texts.filter(o => o !== AppState.selectedObj);
    else if (AppState.selectedType === 'polygon') AppState.polygons = AppState.polygons.filter(o => o !== AppState.selectedObj);
    
    AppState.selectedObj = null;
    updateCounts();
    render();
    setLog("OBJECT DELETED");
});

document.getElementById("reset-btn").addEventListener("click", () => {
    if(confirm("Reset all tactical objects?")) {
        AppState.circles = []; AppState.arrows = []; AppState.texts = []; AppState.polygons = [];
        Storage.clear();
        updateCounts();
        render();
        setLog("ALL TACTICS RESET");
    }
});

// --- XUẤT ẢNH (HỖ TRỢ LƯU VÀO ALBUM ẢNH TRÊN IOS / ANDROID) ---
document.getElementById("export-btn").addEventListener("click", async () => {
    setLog("PREPARING EXPORT...");
    const dataUrl = canvas.toDataURL("image/jpeg", 1.0);

    // Kiểm tra nếu là thiết bị di động hỗ trợ Web Share API
    if (navigator.canShare && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
        try {
            const response = await fetch(dataUrl);
            const blob = await response.blob();
            const file = new File([blob], 'goal-line-tactic.jpg', { type: 'image/jpeg' });

            if (navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: 'Goal-Line Tactical Board',
                    text: 'Goal-Line Studio Tactic'
                });
                setLog("EXPORTED TO SHARE SHEET");
                return;
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.warn("Share failed, falling back to download", error);
            } else {
                setLog("EXPORT CANCELLED");
                return;
            }
        }
    }

    // Fallback tải file thông thường cho PC
    const link = document.createElement('a');
    link.download = 'goal-line-tactic.jpg';
    link.href = dataUrl;
    link.click();
    setLog("IMAGE EXPORTED SUCCESSFULLY");
});

function updateCounts() {
    const circleCnt = document.querySelector(".circle-count");
    const arrowCnt = document.querySelector(".arrow-count");
    const textCnt = document.querySelector(".text-count");
    const polyCnt = document.querySelector(".polygon-count");
    if (circleCnt) circleCnt.innerText = AppState.circles.length;
    if (arrowCnt) arrowCnt.innerText = AppState.arrows.length;
    if (textCnt) textCnt.innerText = AppState.texts.length;
    if (polyCnt) polyCnt.innerText = AppState.polygons.length;
}

// TOGGLE STATUS SYNC FOR SIDEBAR PILLS
function updateToggleStatus() {
    const arrowChecked = document.getElementById("draw-arrow-input").checked;
    const zoneChecked = document.getElementById("draw-polygon-input").checked;

    const arrowPill = document.getElementById("arrow-status-pill");
    const zonePill = document.getElementById("zone-status-pill");

    if (arrowPill) arrowPill.textContent = arrowChecked ? "ON" : "OFF";
    if (zonePill) zonePill.textContent = zoneChecked ? "ON" : "OFF";
}

document.getElementById("draw-arrow-input").addEventListener("change", (e) => {
    const zoneInput = document.getElementById("draw-polygon-input");
    if (e.target.checked && zoneInput) zoneInput.checked = false;
    updateToggleStatus();
    if(e.target.checked) {
        AppState.selectedObj = null;
        setLog("MODE: DRAW ARROW ACTIVATED • DRAG ON PITCH");
    } else {
        setLog("MODE: SELECT & DRAG");
    }
});

document.getElementById("draw-polygon-input").addEventListener("change", (e) => {
    const arrowInput = document.getElementById("draw-arrow-input");
    if (e.target.checked && arrowInput) arrowInput.checked = false;
    updateToggleStatus();
    if(e.target.checked) {
        AppState.selectedObj = null;
        setLog("MODE: DRAW ZONE ACTIVATED • CLICK PITCH TO ADD POINTS");
    } else {
        setLog("MODE: SELECT & DRAG");
    }
});

// Text Rotation
window.addEventListener("wheel", (e) => {
    if (e.shiftKey && AppState.selectedObj && AppState.selectedType === 'text') {
        AppState.selectedObj.rotate += (e.deltaY > 0 ? 5 : -5);
        setLog(`ROTATING TEXT: ${AppState.selectedObj.rotate}°`);
        render();
    }
});

// =========================================================================
// --- MOBILE TOUCH BRIDGE (KHÔNG LÀM ẢNH HƯỞNG CODE CHUỘT PC) ---
// =========================================================================

// 1. Chạm ngón tay xuống sân (Tương đương Mousedown)
canvas.addEventListener("touchstart", (e) => {
    if (e.touches.length > 1) return; // Bỏ qua nếu chạm 2 ngón cùng lúc
    e.preventDefault(); // Ngăn zoom / giật màn hình trên Safari iOS
    
    // Kích hoạt lại toàn bộ logic mousedown sẵn có
    const fakeEvent = {
        clientX: e.touches[0].clientX,
        clientY: e.touches[0].clientY,
        preventDefault: () => {}
    };
    canvas.dispatchEvent(new MouseEvent("mousedown", fakeEvent));
}, { passive: false });

// 2. Kéo ngón tay di chuyển (Tương đương Mousemove)
canvas.addEventListener("touchmove", (e) => {
    if (e.touches.length > 1) return;
    e.preventDefault();
    
    const fakeEvent = {
        clientX: e.touches[0].clientX,
        clientY: e.touches[0].clientY,
        preventDefault: () => {}
    };
    canvas.dispatchEvent(new MouseEvent("mousemove", fakeEvent));
}, { passive: false });

// 3. Nhấc ngón tay lên (Tương đương Mouseup)
canvas.addEventListener("touchend", (e) => {
    e.preventDefault();
    canvas.dispatchEvent(new MouseEvent("mouseup", {}));
}, { passive: false });


// Start App
init();