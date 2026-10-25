// js/board/board.js
import { Circle } from './shapes/Circle.js';
import { Arrow } from './shapes/Arrow.js';
import { TextObj } from './shapes/TextObj.js';
import { Polygon } from './shapes/Polygon.js';
import { Storage } from './storage.js';
import { GLDatabase } from '../shared/gl-db.js';
import {
    canvas, ctx, loadImages, resizeCanvas, drawPitch, clearCanvas, getImages, responsiveConstant,
    setCustomBackground, clearCustomBackground
} from './canvas.js';
import { getMousePos, generateId } from './utils.js';

// --- CẤU TRÚC DỮ LIỆU DỰ ÁN & STATE ---
const AppState = {
    project: null,          // Dự án đang mở { id, name, pitchType, customBgData, slides: [] }
    currentSlideIdx: 0,     // Index của Trang (Slide) đang chọn
    currentKfIdx: 0,        // Index của Nhịp sa bàn (Keyframe) đang chọn trong Slide

    // Các mảng đối tượng đang hiển thị trên Canvas (tham chiếu tới Keyframe hiện tại)
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
    isDraggingPathHandle: false, // Kéo điểm uốn cong đường chạy cầu thủ (pathCx, pathCy)

    lastMousePos: { x: 0, y: 0 },
    polygonDragIndex: -1,

    // Drawing Modes
    mode: 'select', // 'select', 'drawArrow', 'drawPolygon'
    drawingArrow: null,
    drawingPolygonPoints: [],
    arrowDragPoint: null, // 'from', 'to', 'control', 'body'

    // Hiển thị vệt di chuyển từ Sa bàn trước
    showGhostPath: true,

    // Trạng thái chạy Animation
    isPlayingAnim: false,
    animReqId: null,

    // Global Scale
    userScale: 1.0
};

const logEl = document.getElementById("editor-log");
function setLog(text) {
    if (logEl) logEl.textContent = text.toUpperCase();
}

// --- HÀM TIỆN ÍCH KHỞI TẠO KEYFRAME & SLIDE ---
function createEmptyKeyframe() {
    return {
        id: 'kf_' + generateId(),
        circles: [],
        arrows: [],
        texts: [],
        polygons: []
    };
}

function createNewSlide(title = "Trang chiến thuật 1") {
    return {
        id: 'slide_' + generateId(),
        title: title,
        subtitle: "",
        stepDuration: 2.0, // Số giây di chuyển giữa mỗi nhịp sa bàn
        keyframes: [createEmptyKeyframe()]
    };
}

function createNewProject(name = "Dự án Chiến thuật Mới", pitchType = "horizontal", customBgData = null) {
    return {
        id: 'proj_' + generateId(),
        name: name,
        pitchType: pitchType,
        customBgData: customBgData,
        updatedAt: Date.now(),
        slides: [createNewSlide("Slide 1: Cấu trúc đội hình")]
    };
}

// Chuyển đổi dữ liệu thô từ IndexedDB sang các instance Class (Circle, Arrow, Polygon, TextObj)
function hydrateProject(rawProj) {
    if (!rawProj.slides || rawProj.slides.length === 0) {
        rawProj.slides = [createNewSlide("Slide 1")];
    }
    rawProj.slides.forEach((slide, sIdx) => {
        slide.title = slide.title || `Slide ${sIdx + 1}`;
        slide.subtitle = slide.subtitle || "";
        slide.stepDuration = parseFloat(slide.stepDuration) || 2.0;
        if (!slide.keyframes || slide.keyframes.length === 0) {
            slide.keyframes = [createEmptyKeyframe()];
        }
        slide.keyframes.forEach(kf => {
            kf.circles = (kf.circles || []).map(d => new Circle(
                d.x, d.y, d.radius, d.color, d.text, d.textColor, d.detailsText,
                d.id, d.pathCx ?? null, d.pathCy ?? null
            ));
            kf.arrows = (kf.arrows || []).map(d => new Arrow(
                d.fromX, d.fromY, d.toX, d.toY, d.color, d.type, d.isArrow, d.cx, d.cy, d.id
            ));
            kf.texts = (kf.texts || []).map(d => new TextObj(
                d.x, d.y, d.text, d.fontSize, d.rotate, d.id
            ));
            kf.polygons = (kf.polygons || []).map(d => new Polygon(
                d.points || d, d.id
            ));
        });
    });
    return rawProj;
}

// Đồng bộ tham chiếu mảng từ Keyframe hiện tại vào AppState
function syncActiveKeyframeRefs() {
    if (!AppState.project) return;
    const slides = AppState.project.slides;
    if (AppState.currentSlideIdx >= slides.length) AppState.currentSlideIdx = Math.max(0, slides.length - 1);
    const slide = slides[AppState.currentSlideIdx];

    if (AppState.currentKfIdx >= slide.keyframes.length) AppState.currentKfIdx = Math.max(0, slide.keyframes.length - 1);
    const kf = slide.keyframes[AppState.currentKfIdx];

    AppState.circles = kf.circles;
    AppState.arrows = kf.arrows;
    AppState.texts = kf.texts;
    AppState.polygons = kf.polygons;
    AppState.pitchType = AppState.project.pitchType || 'horizontal';

    // Cập nhật UI input của Slide
    const titleInput = document.getElementById("slide-title-input");
    const subInput = document.getElementById("slide-sub-input");
    const durInput = document.getElementById("kf-duration-input");
    const pitchSelect = document.getElementById("pitch-type");
    const projLabel = document.getElementById("active-project-label");

    if (titleInput) titleInput.value = slide.title || "";
    if (subInput) subInput.value = slide.subtitle || "";
    if (durInput) durInput.value = slide.stepDuration || 2.0;
    if (pitchSelect) pitchSelect.value = AppState.pitchType;
    if (projLabel) projLabel.textContent = `PROJECT: ${AppState.project.name.toUpperCase()}`;

    renderSlidesSidebar();
    renderKeyframeTabs();
    updateCounts();
    updateBottomIndicator();
}

function updateBottomIndicator() {
    const el = document.getElementById("canvas-step-indicator");
    if (!el || !AppState.project) return;
    const slide = AppState.project.slides[AppState.currentSlideIdx];
    const totalKf = slide.keyframes.length;
    el.textContent = `${slide.title.toUpperCase()} • SA BÀN ${AppState.currentKfIdx + 1}/${totalKf} ${totalKf > 1 ? '• BẤM PLAY ANIM ĐỂ XEM CHUYỂN ĐỘNG' : ''}`;
}

// Lưu tự động vào IndexedDB (kèm debounce nhẹ để mượt khi kéo chuột)
let saveTimer = null;
function queueAutoSave() {
    if (!AppState.project) return;
    // Giữ tương thích ngược với localStorage cho 1 sa bàn đơn lẻ
    try {
        Storage.save(AppState.circles, AppState.arrows, AppState.texts, AppState.polygons, AppState.pitchType);
    } catch (e) { /* Bỏ qua nếu vượt quota localStorage */ }

    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
        try {
            await GLDatabase.saveTacticalProject(AppState.project);
            localStorage.setItem('gl_last_tactical_project_id', AppState.project.id);
        } catch (err) {
            console.warn("AutoSave IndexedDB error:", err);
        }
    }, 250);
}

// --- KHỞI ĐỘNG ỨNG DỤNG ---
async function init() {
    await loadImages();

    if (document.fonts) {
        try { await document.fonts.ready; } catch (e) { console.warn(e); }
    }

    document.getElementById("global-scale").value = AppState.userScale;
    document.getElementById("scale-number").value = AppState.userScale;

    // Kiểm tra xem có dữ liệu cũ ở localStorage chưa được migrate sang IndexedDB không
    let projects = await GLDatabase.getAllTacticalProjects();
    if (projects.length === 0) {
        const legacy = Storage.load();
        const hasLegacy = legacy.circles.length > 0 || legacy.arrows.length > 0 || legacy.texts.length > 0 || legacy.polygons.length > 0;
        const legacyBg = localStorage.getItem('customBgData') || null;
        if (hasLegacy || legacyBg) {
            const migrated = createNewProject("Dự án Khôi phục (Legacy)", legacy.pitchType || 'horizontal', legacyBg);
            migrated.slides[0].keyframes[0] = {
                id: 'kf_' + generateId(),
                circles: legacy.circles,
                arrows: legacy.arrows,
                texts: legacy.texts,
                polygons: legacy.polygons
            };
            await GLDatabase.saveTacticalProject(migrated);
            projects = await GLDatabase.getAllTacticalProjects();
        }
    }

    // Nếu đã có dự án gần nhất, mở luôn để làm việc tiếp nhưng vẫn cho phép mở Modal Quản lý dự án
    const lastId = localStorage.getItem('gl_last_tactical_project_id');
    const found = projects.find(p => p.id === lastId) || projects[0];

    if (found) {
        await loadProjectIntoWorkspace(found);
        await refreshProjectModalList();
        // Mở modal lúc đầu để người dùng chọn tiếp tục hoặc tạo dự án mới
        document.getElementById("startup-modal").style.display = "flex";
    } else {
        const defaultProj = createNewProject("Phân tích Chiến thuật #01", "horizontal", null);
        await GLDatabase.saveTacticalProject(defaultProj);
        await loadProjectIntoWorkspace(defaultProj);
        await refreshProjectModalList();
        document.getElementById("startup-modal").style.display = "flex";
    }

    setLog("READY • CHỌN DỰ ÁN HOẶC BẮT ĐẦU SÁNG TẠO");
}

async function loadProjectIntoWorkspace(rawProj) {
    stopAnimationPreview();
    AppState.project = hydrateProject(rawProj);
    AppState.currentSlideIdx = 0;
    AppState.currentKfIdx = 0;
    AppState.selectedObj = null;

    if (AppState.project.customBgData) {
        await setCustomBackground(AppState.project.customBgData);
        document.getElementById("pitch-type").disabled = true;
    } else {
        clearCustomBackground();
        document.getElementById("pitch-type").disabled = false;
    }

    syncActiveKeyframeRefs();
    resizeCanvas(AppState.pitchType);
    render();
}

async function refreshProjectModalList() {
    const projects = await GLDatabase.getAllTacticalProjects();
    const listEl = document.getElementById("saved-projects-list");
    const countEl = document.getElementById("saved-projects-count");
    const sectionEl = document.getElementById("saved-projects-section");

    if (countEl) countEl.textContent = `${projects.length} PROJECTS`;
    if (!listEl) return;

    if (projects.length === 0) {
        sectionEl.style.display = "none";
        return;
    }
    sectionEl.style.display = "block";
    listEl.innerHTML = "";

    projects.forEach(p => {
        const isCurrent = AppState.project && AppState.project.id === p.id;
        const dateStr = new Date(p.updatedAt || Date.now()).toLocaleString('vi-VN');
        const slideCount = (p.slides || []).length;

        const row = document.createElement("div");
        row.className = "saved-project-item";
        if (isCurrent) row.style.borderLeft = "6px solid var(--neo-green)";

        row.innerHTML = `
            <div class="saved-project-info">
                <strong>${p.name} ${isCurrent ? '<span style="color:#059669;font-size:0.72rem;">(ĐANG MỞ)</span>' : ''}</strong>
                <small>${slideCount} trang sa bàn • Cập nhật: ${dateStr}</small>
            </div>
            <div class="saved-project-actions">
                <button class="neo-btn-xs btn-action-green btn-open-proj"><i class="fa-solid fa-play"></i> MỞ</button>
                <button class="neo-btn-xs btn-action-pink btn-del-proj" title="Xóa dự án"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;

        row.querySelector(".btn-open-proj").addEventListener("click", async () => {
            await loadProjectIntoWorkspace(p);
            document.getElementById("startup-modal").style.display = "none";
            setLog(`ĐÃ MỞ DỰ ÁN: ${p.name}`);
        });

        row.querySelector(".btn-del-proj").addEventListener("click", async (e) => {
            e.stopPropagation();
            if (!confirm(`Xóa vĩnh viễn dự án "${p.name}"?`)) return;
            await GLDatabase.deleteTacticalProject(p.id);
            const remaining = await GLDatabase.getAllTacticalProjects();
            if (AppState.project && AppState.project.id === p.id) {
                if (remaining.length > 0) {
                    await loadProjectIntoWorkspace(remaining[0]);
                } else {
                    const fresh = createNewProject("Dự án Chiến thuật Mới");
                    await GLDatabase.saveTacticalProject(fresh);
                    await loadProjectIntoWorkspace(fresh);
                }
            }
            await refreshProjectModalList();
        });

        listEl.appendChild(row);
    });
}

// --- RENDER SIDEBAR TRANG (SLIDES) & THANH NHỊP SA BÀN (KEYFRAMES) ---
function renderSlidesSidebar() {
    const listEl = document.getElementById("slides-list");
    const countEl = document.getElementById("slide-total-count");
    if (!listEl || !AppState.project) return;

    const slides = AppState.project.slides;
    if (countEl) countEl.textContent = slides.length;
    listEl.innerHTML = "";

    slides.forEach((slide, idx) => {
        const card = document.createElement("div");
        card.className = `slide-card ${idx === AppState.currentSlideIdx ? 'active' : ''}`;
        const kfCount = slide.keyframes.length;

        card.innerHTML = `
            <div class="slide-card-top">
                <span>TRANG #${idx + 1}</span>
                <span class="slide-kf-pill">${kfCount > 1 ? `🎬 ${kfCount} SA BÀN (ANIM)` : '🖼️ 1 SA BÀN (TĨNH)'}</span>
            </div>
            <div class="slide-card-title">${slide.title || `Trang ${idx + 1}`}</div>
            <div class="slide-card-actions">
                <button class="btn-slide-up" title="Đẩy lên" ${idx === 0 ? 'disabled' : ''}><i class="fa-solid fa-arrow-up"></i></button>
                <button class="btn-slide-down" title="Đẩy xuống" ${idx === slides.length - 1 ? 'disabled' : ''}><i class="fa-solid fa-arrow-down"></i></button>
                <button class="btn-slide-dup" title="Nhân bản trang"><i class="fa-regular fa-copy"></i></button>
                <button class="btn-slide-del" title="Xóa trang"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;

        card.addEventListener("click", (e) => {
            if (e.target.closest("button")) return;
            stopAnimationPreview();
            AppState.currentSlideIdx = idx;
            AppState.currentKfIdx = 0;
            AppState.selectedObj = null;
            syncActiveKeyframeRefs();
            render();
            setLog(`ĐANG CHỌN TRANG #${idx + 1}: ${slide.title}`);
        });

        card.querySelector(".btn-slide-up").addEventListener("click", () => {
            if (idx === 0) return;
            const tmp = slides[idx - 1];
            slides[idx - 1] = slides[idx];
            slides[idx] = tmp;
            AppState.currentSlideIdx = idx - 1;
            syncActiveKeyframeRefs();
            queueAutoSave();
        });

        card.querySelector(".btn-slide-down").addEventListener("click", () => {
            if (idx >= slides.length - 1) return;
            const tmp = slides[idx + 1];
            slides[idx + 1] = slides[idx];
            slides[idx] = tmp;
            AppState.currentSlideIdx = idx + 1;
            syncActiveKeyframeRefs();
            queueAutoSave();
        });

        card.querySelector(".btn-slide-dup").addEventListener("click", () => {
            const cloneRaw = JSON.parse(JSON.stringify(slide));
            cloneRaw.id = 'slide_' + generateId();
            cloneRaw.title = `${slide.title} (Copy)`;
            slides.splice(idx + 1, 0, cloneRaw);
            hydrateProject(AppState.project);
            AppState.currentSlideIdx = idx + 1;
            AppState.currentKfIdx = 0;
            syncActiveKeyframeRefs();
            render();
            queueAutoSave();
            setLog(`ĐÃ NHÂN BẢN TRANG #${idx + 1}`);
        });

        card.querySelector(".btn-slide-del").addEventListener("click", () => {
            if (slides.length <= 1) {
                alert("Dự án cần có ít nhất 1 trang sa bàn!");
                return;
            }
            if (!confirm(`Xóa "${slide.title}"?`)) return;
            slides.splice(idx, 1);
            if (AppState.currentSlideIdx >= slides.length) AppState.currentSlideIdx = slides.length - 1;
            AppState.currentKfIdx = 0;
            syncActiveKeyframeRefs();
            render();
            queueAutoSave();
        });

        listEl.appendChild(card);
    });
}

function renderKeyframeTabs() {
    const container = document.getElementById("keyframe-tabs");
    if (!container || !AppState.project) return;

    const slide = AppState.project.slides[AppState.currentSlideIdx];
    container.innerHTML = "";

    slide.keyframes.forEach((kf, kIdx) => {
        const btn = document.createElement("button");
        btn.className = `kf-tab-btn ${kIdx === AppState.currentKfIdx ? 'active' : ''}`;
        btn.innerHTML = `SA BÀN ${kIdx + 1}`;
        btn.addEventListener("click", () => {
            stopAnimationPreview();
            AppState.currentKfIdx = kIdx;
            AppState.selectedObj = null;
            syncActiveKeyframeRefs();
            render();
            setLog(`CHUYỂN SANG SA BÀN ${kIdx + 1}`);
        });
        container.appendChild(btn);
    });
}

// --- VÒNG LẶP VẼ CHÍNH (RENDER LOOP) ---
function render() {
    clearCanvas();
    drawPitch(AppState.pitchType);
    const imgs = getImages();

    // 1. Vẽ Polygons
    AppState.polygons.forEach((p) => {
        const isSelected = (AppState.selectedObj === p);
        p.draw(ctx, isSelected, AppState.userScale);
    });
    if (AppState.drawingPolygonPoints.length > 0) {
        new Polygon(AppState.drawingPolygonPoints).draw(ctx, true, AppState.userScale);
    }

    // 2. Vẽ vệt di chuyển (Ghost Path) từ Sa bàn trước (nếu đang ở Sa bàn >= 2 và không trong lúc chạy Animation)
    if (AppState.showGhostPath && !AppState.isPlayingAnim && AppState.currentKfIdx > 0 && AppState.project) {
        const prevKf = AppState.project.slides[AppState.currentSlideIdx].keyframes[AppState.currentKfIdx - 1];
        if (prevKf) {
            AppState.circles.forEach(c => {
                const prevCircle = prevKf.circles.find(pc => pc.id === c.id);
                if (prevCircle) {
                    const isSelected = (AppState.selectedObj === c);
                    c.drawMovementPath(ctx, prevCircle, responsiveConstant, AppState.userScale, isSelected);
                }
            });
        }
    }

    // 3. Vẽ Arrows
    AppState.arrows.forEach((a) => {
        const isSelected = (AppState.selectedObj === a);
        a.draw(ctx, responsiveConstant, isSelected, AppState.userScale, 1.0);
    });
    if (AppState.drawingArrow) {
        AppState.drawingArrow.draw(ctx, responsiveConstant, true, AppState.userScale, 1.0);
    }

    // 4. Vẽ Circles (Cầu thủ & Bóng)
    AppState.circles.forEach((c) => {
        const isSelected = (AppState.selectedObj === c);
        c.draw(ctx, imgs.ball, responsiveConstant, isSelected, AppState.userScale);
    });

    // 5. Vẽ Texts
    AppState.texts.forEach((t) => {
        const isSelected = (AppState.selectedObj === t);
        t.draw(ctx, responsiveConstant, isSelected, AppState.userScale);
    });

    queueAutoSave();
}

// --- ENGINE NỘI SUY ANIMATION GIỮA CÁC NHỊP SA BÀN (ĐÃ FIX BUG UNDEFINED CIRCLES) ---
function easeInOutCubic(x) {
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/**
 * Vẽ 1 frame nội suy giữa Keyframe k1 và Keyframe k2 ở tiến trình t (0.0 -> 1.0)
 */
function renderInterpolatedStep(kf1, kf2, rawT) {
    if (!kf1 || !kf2) return;

    const t = easeInOutCubic(Math.max(0, Math.min(1, rawT)));
    clearCanvas();
    drawPitch(AppState.pitchType);
    const imgs = getImages();

    const polys1 = kf1.polygons || [];
    const polys2 = kf2.polygons || [];
    const arrows1 = kf1.arrows || [];
    const arrows2 = kf2.arrows || [];
    const circles1 = kf1.circles || [];
    const circles2 = kf2.circles || [];
    const texts1 = kf1.texts || [];
    const texts2 = kf2.texts || [];

    // 1. Nội suy Polygons
    polys2.forEach(p2 => {
        const p1 = polys1.find(p => p.id === p2.id);
        const polyToDraw = p1 ? Polygon.interpolate(p1, p2, t) : p2;
        polyToDraw.draw(ctx, false, AppState.userScale);
    });

    // 2. Nội suy Arrows
    arrows2.forEach(a2 => {
        const a1 = arrows1.find(a => a.id === a2.id);
        if (a1) {
            const arrInterp = Arrow.interpolate(a1, a2, t);
            arrInterp.draw(ctx, responsiveConstant, false, AppState.userScale, 1.0);
        } else {
            a2.draw(ctx, responsiveConstant, false, AppState.userScale, t);
        }
    });

    // 3. Nội suy Circles (Cầu thủ & Trái bóng)
    circles2.forEach(c2 => {
        const c1 = circles1.find(c => c.id === c2.id);
        if (c1) {
            const cirInterp = Circle.interpolate(c1, c2, t);
            cirInterp.draw(ctx, imgs.ball, responsiveConstant, false, AppState.userScale, 1.0);
        } else {
            c2.draw(ctx, imgs.ball, responsiveConstant, false, AppState.userScale, t);
        }
    });
    // Vẽ nốt các cầu thủ có ở Sa bàn 1 nhưng bị xóa ở Sa bàn 2 (mờ dần)
    circles1.forEach(c1 => {
        const stillExists = circles2.some(c2 => c2.id === c1.id);
        if (!stillExists) {
            c1.draw(ctx, imgs.ball, responsiveConstant, false, AppState.userScale, Math.max(0, 1 - t));
        }
    });

    // 4. Nội suy Texts
    texts2.forEach(txt2 => {
        const txt1 = texts1.find(tx => tx.id === txt2.id);
        const txtInterp = txt1 ? TextObj.interpolate(txt1, txt2, t) : txt2;
        txtInterp.draw(ctx, responsiveConstant, false, AppState.userScale);
    });
}

function stopAnimationPreview() {
    if (AppState.animReqId) {
        cancelAnimationFrame(AppState.animReqId);
        AppState.animReqId = null;
    }
    AppState.isPlayingAnim = false;
    const playBtn = document.getElementById("btn-play-anim");
    if (playBtn) {
        playBtn.innerHTML = `<i class="fa-solid fa-play"></i> PLAY ANIM`;
        playBtn.classList.remove("btn-action-pink");
        playBtn.classList.add("btn-action-green");
    }
}

function playSlideAnimation(onFinishCallback = null) {
    if (!AppState.project) return;
    const slide = AppState.project.slides[AppState.currentSlideIdx];
    if (!slide || !slide.keyframes || slide.keyframes.length < 2) {
        setLog("CẦN ÍT NHẤT 2 NHỊP SA BÀN ĐỂ CHẠY ANIMATION (BẤM '+ SA BÀN TIẾP THEO')");
        if (onFinishCallback) onFinishCallback();
        return;
    }

    stopAnimationPreview();
    AppState.isPlayingAnim = true;
    AppState.selectedObj = null;

    const playBtn = document.getElementById("btn-play-anim");
    if (playBtn) {
        playBtn.innerHTML = `<i class="fa-solid fa-stop"></i> STOP`;
        playBtn.classList.remove("btn-action-green");
        playBtn.classList.add("btn-action-pink");
    }

    const totalSteps = slide.keyframes.length - 1;
    const stepMs = Math.max(200, (parseFloat(slide.stepDuration) || 2.0) * 1000);
    const totalDurationMs = totalSteps * stepMs;

    // Khởi tạo startTime ngay trong tick đầu tiên của requestAnimationFrame để tránh elapsed bị âm
    let startTime = null;

    function stepLoop(now) {
        if (!AppState.isPlayingAnim) return;
        if (startTime === null) startTime = now;

        const elapsed = Math.max(0, now - startTime);

        if (elapsed >= totalDurationMs) {
            AppState.currentKfIdx = slide.keyframes.length - 1;
            stopAnimationPreview();
            syncActiveKeyframeRefs();
            render();
            setLog("HOÀN TẤT CHẠY ANIMATION");
            if (onFinishCallback) onFinishCallback();
            return;
        }

        const rawStep = elapsed / stepMs;
        const stepIdx = Math.max(0, Math.min(totalSteps - 1, Math.floor(rawStep)));
        const localT = Math.max(0, Math.min(1, rawStep - stepIdx));

        renderInterpolatedStep(slide.keyframes[stepIdx], slide.keyframes[stepIdx + 1], localT);
        AppState.animReqId = requestAnimationFrame(stepLoop);
    }

    setLog(`ĐANG CHẠY ANIMATION (${slide.keyframes.length} SA BÀN)...`);
    AppState.animReqId = requestAnimationFrame(stepLoop);
}

// --- SỰ KIỆN CHUỘT TRÊN CANVAS ---
canvas.addEventListener("mousedown", (e) => {
    if (AppState.isPlayingAnim) stopAnimationPreview();
    const pos = getMousePos(canvas, e);

    // Mode: Draw Arrow
    if (document.getElementById("draw-arrow-input").checked) {
        AppState.mode = 'drawArrow';
        const color = document.getElementById("arrow-color").value;
        const type = document.getElementById("arrow-type").value;
        const isArrow = document.getElementById("is-arrow").checked;
        AppState.drawingArrow = new Arrow(pos.x, pos.y, pos.x, pos.y, color, type, isArrow);
        setLog("DRAWING ARROW • KÉO CHUỘT ĐỂ ĐỊNH HƯỚNG");
        return;
    }

    // Mode: Draw Polygon
    if (document.getElementById("draw-polygon-input").checked) {
        AppState.mode = 'drawPolygon';
        AppState.drawingPolygonPoints.push({ x: pos.x, y: pos.y });
        setLog(`ĐÃ THÊM ĐỈNH VÙNG CHIẾN THUẬT (${AppState.drawingPolygonPoints.length} ĐIỂM)`);
        render();
        return;
    }

    // Mode: Select & Drag
    AppState.mode = 'select';

    // 0. Kiểm tra xem người dùng có click vào nút chỉnh độ cong đường chạy (Ghost Path Handle) của cầu thủ đang chọn không
    if (
        AppState.showGhostPath &&
        AppState.currentKfIdx > 0 &&
        AppState.selectedObj &&
        AppState.selectedType === 'circle'
    ) {
        const prevKf = AppState.project.slides[AppState.currentSlideIdx].keyframes[AppState.currentKfIdx - 1];
        const prevCircle = prevKf?.circles.find(pc => pc.id === AppState.selectedObj.id);
        if (prevCircle && AppState.selectedObj.isHitPathHandle(pos.x, pos.y, prevCircle, responsiveConstant, AppState.userScale)) {
            AppState.isDragging = true;
            AppState.isDraggingPathHandle = true;
            setLog("ĐANG UỐN CONG QUỸ ĐẠO DI CHUYỂN CỦA CẦU THỦ");
            render();
            return;
        }
    }

    AppState.selectedObj = null;
    AppState.isDragging = false;
    AppState.isDraggingPathHandle = false;
    AppState.polygonDragIndex = -1;

    // 1. Check Text
    for (let i = AppState.texts.length - 1; i >= 0; i--) {
        if (AppState.texts[i].isHit(pos.x, pos.y, ctx, responsiveConstant, AppState.userScale)) {
            AppState.selectedObj = AppState.texts[i];
            AppState.selectedType = 'text';
            AppState.isDragging = true;
            AppState.dragOffset = { x: pos.x - AppState.texts[i].x, y: pos.y - AppState.texts[i].y };
            setLog(`ĐÃ CHỌN NHÃN "${AppState.texts[i].text}" • KÉO ĐỂ DI CHUYỂN`);
            render();
            return;
        }
    }

    // 2. Check Circle
    for (let i = AppState.circles.length - 1; i >= 0; i--) {
        if (AppState.circles[i].isHit(pos.x, pos.y, AppState.userScale)) {
            AppState.selectedObj = AppState.circles[i];
            AppState.selectedType = 'circle';
            AppState.isDragging = true;
            AppState.dragOffset = { x: pos.x - AppState.circles[i].x, y: pos.y - AppState.circles[i].y };
            const name = AppState.circles[i].detailsText || (AppState.circles[i].text ? `#${AppState.circles[i].text}` : 'TOKEN');
            setLog(`ĐÃ CHỌN ${name} • KÉO ĐỂ ĐỔI VỊ TRÍ`);
            render();
            return;
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
            setLog("BẺ CONG ĐƯỜNG CHUYỀN / MŨI TÊN");
            render();
            return;
        }
        if (arr.isHitHandle(pos.x, pos.y, 'from', responsiveConstant, AppState.userScale)) {
            AppState.selectedObj = arr;
            AppState.selectedType = 'arrow';
            AppState.isDragging = true;
            AppState.arrowDragPoint = 'from';
            setLog("ĐIỀU CHỈNH ĐIỂM ĐẦU MŨI TÊN");
            render();
            return;
        }
        if (arr.isHitHandle(pos.x, pos.y, 'to', responsiveConstant, AppState.userScale)) {
            AppState.selectedObj = arr;
            AppState.selectedType = 'arrow';
            AppState.isDragging = true;
            AppState.arrowDragPoint = 'to';
            setLog("ĐIỀU CHỈNH ĐIỂM CUỐI MŨI TÊN");
            render();
            return;
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
            setLog("DI CHUYỂN MŨI TÊN");
            render();
            return;
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
            setLog(`ĐIỀU CHỈNH ĐỈNH VÙNG CHIẾN THUẬT #${vertexIndex + 1}`);
            render();
            return;
        }
        if (poly.isHit(pos.x, pos.y)) {
            AppState.selectedObj = poly;
            AppState.selectedType = 'polygon';
            AppState.isDragging = true;
            AppState.lastMousePos = { x: pos.x, y: pos.y };
            AppState.polygonDragIndex = -1;
            setLog("DI CHUYỂN VÙNG CHIẾN THUẬT");
            render();
            return;
        }
    }

    setLog("READY • CHỌN & KÉO CÁC PHẦN TỬ TRÊN SÂN");
    render();
});

canvas.addEventListener("mousemove", (e) => {
    const pos = getMousePos(canvas, e);

    if (AppState.mode === 'drawArrow' && AppState.drawingArrow) {
        AppState.drawingArrow.toX = pos.x;
        AppState.drawingArrow.toY = pos.y;
        AppState.drawingArrow.cx = (AppState.drawingArrow.fromX + pos.x) / 2;
        AppState.drawingArrow.cy = (AppState.drawingArrow.fromY + pos.y) / 2;
        render();
        return;
    }

    if (AppState.isDragging && AppState.selectedObj) {
        if (AppState.isDraggingPathHandle && AppState.selectedType === 'circle') {
            AppState.selectedObj.pathCx = pos.x;
            AppState.selectedObj.pathCy = pos.y;
            render();
            return;
        }

        if (AppState.selectedType === 'circle' || AppState.selectedType === 'text') {
            AppState.selectedObj.x = pos.x - AppState.dragOffset.x;
            AppState.selectedObj.y = pos.y - AppState.dragOffset.y;
        } else if (AppState.selectedType === 'arrow') {
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
        } else if (AppState.selectedType === 'polygon') {
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
        setLog("ĐÃ TẠO MŨI TÊN CHIẾN THUẬT");
    }

    AppState.isDragging = false;
    AppState.isDraggingPathHandle = false;
    AppState.arrowDragPoint = null;
    AppState.polygonDragIndex = -1;
    render();
});

// --- CÁC NÚT QUẢN LÝ KEYFRAME, SLIDE & DỰ ÁN ---

// Thêm Nhịp Sa bàn tiếp theo (Clone toàn bộ cầu thủ/bóng từ Sa bàn hiện tại sang Sa bàn mới)
document.getElementById("btn-add-keyframe").addEventListener("click", () => {
    if (!AppState.project) return;
    stopAnimationPreview();
    const slide = AppState.project.slides[AppState.currentSlideIdx];
    const currentKf = slide.keyframes[AppState.currentKfIdx];

    const nextKf = {
        id: 'kf_' + generateId(),
        circles: currentKf.circles.map(c => c.clone()),
        arrows: currentKf.arrows.map(a => a.clone()),
        texts: currentKf.texts.map(t => t.clone()),
        polygons: currentKf.polygons.map(p => p.clone())
    };

    slide.keyframes.splice(AppState.currentKfIdx + 1, 0, nextKf);
    AppState.currentKfIdx += 1;
    AppState.selectedObj = null;
    syncActiveKeyframeRefs();
    render();
    setLog(`ĐÃ TẠO SA BÀN ${AppState.currentKfIdx + 1} • HÃY KÉO CẦU THỦ TỚI VỊ TRÍ MỚI!`);
});

// Xóa Nhịp Sa bàn hiện tại
document.getElementById("btn-del-keyframe").addEventListener("click", () => {
    if (!AppState.project) return;
    const slide = AppState.project.slides[AppState.currentSlideIdx];
    if (slide.keyframes.length <= 1) {
        setLog("MỖI TRANG CẦN ÍT NHẤT 1 SA BÀN");
        return;
    }
    stopAnimationPreview();
    slide.keyframes.splice(AppState.currentKfIdx, 1);
    if (AppState.currentKfIdx >= slide.keyframes.length) {
        AppState.currentKfIdx = slide.keyframes.length - 1;
    }
    syncActiveKeyframeRefs();
    render();
    setLog("ĐÃ XÓA NHỊP SA BÀN");
});

// Bật/tắt Ghost Path
document.getElementById("toggle-ghost-path").addEventListener("change", (e) => {
    AppState.showGhostPath = e.target.checked;
    render();
});

// Đổi tốc độ giây/step
document.getElementById("kf-duration-input").addEventListener("input", (e) => {
    if (!AppState.project) return;
    const val = parseFloat(e.target.value);
    if (!isNaN(val) && val >= 0.5) {
        AppState.project.slides[AppState.currentSlideIdx].stepDuration = val;
        queueAutoSave();
    }
});

// Nút Play / Stop Animation
document.getElementById("btn-play-anim").addEventListener("click", () => {
    if (AppState.isPlayingAnim) {
        stopAnimationPreview();
        render();
    } else {
        playSlideAnimation();
    }
});

// Thêm Trang (Slide) mới vào dự án
document.getElementById("btn-add-slide").addEventListener("click", () => {
    if (!AppState.project) return;
    stopAnimationPreview();
    const newIndex = AppState.project.slides.length + 1;
    const slide = createNewSlide(`Slide ${newIndex}: Tình huống mới`);
    AppState.project.slides.push(slide);
    AppState.currentSlideIdx = AppState.project.slides.length - 1;
    AppState.currentKfIdx = 0;
    syncActiveKeyframeRefs();
    render();
    setLog(`ĐÃ THÊM TRANG #${newIndex}`);
});

// Cập nhật Tiêu đề & Phụ đề của Trang
document.getElementById("slide-title-input").addEventListener("input", (e) => {
    if (!AppState.project) return;
    AppState.project.slides[AppState.currentSlideIdx].title = e.target.value;
    renderSlidesSidebar();
    updateBottomIndicator();
    queueAutoSave();
});

document.getElementById("slide-sub-input").addEventListener("input", (e) => {
    if (!AppState.project) return;
    AppState.project.slides[AppState.currentSlideIdx].subtitle = e.target.value;
    queueAutoSave();
});

// Quản lý Modal Dự án
document.getElementById("btn-open-projects").addEventListener("click", async () => {
    await refreshProjectModalList();
    document.getElementById("startup-modal").style.display = "flex";
});

document.getElementById("btn-close-project-modal").addEventListener("click", () => {
    document.getElementById("startup-modal").style.display = "none";
});

document.getElementById("btn-rename-project").addEventListener("click", () => {
    if (!AppState.project) return;
    const newName = prompt("Nhập tên mới cho dự án:", AppState.project.name);
    if (newName && newName.trim()) {
        AppState.project.name = newName.trim();
        syncActiveKeyframeRefs();
        queueAutoSave();
    }
});

// Tạo Dự án mới với Sân chuẩn
document.getElementById("btn-template-mode").addEventListener("click", async () => {
    const nameInput = document.getElementById("new-project-name-input");
    const projName = (nameInput && nameInput.value.trim()) ? nameInput.value.trim() : `Dự án Chiến thuật #${Math.floor(Math.random() * 90 + 10)}`;
    const newProj = createNewProject(projName, "horizontal", null);
    await GLDatabase.saveTacticalProject(newProj);
    if (nameInput) nameInput.value = "";
    await loadProjectIntoWorkspace(newProj);
    document.getElementById("startup-modal").style.display = "none";
    setLog(`ĐÃ TẠO DỰ ÁN MỚI: ${projName}`);
});

// Tạo Dự án mới hoặc đổi nền với Ảnh Custom
document.getElementById("btn-custom-mode").addEventListener("click", () => {
    document.getElementById("custom-img-input").click();
});

document.getElementById("btn-change-bg-inline").addEventListener("click", () => {
    document.getElementById("custom-img-input").click();
});

document.getElementById("custom-img-input").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
        const imgUrl = event.target.result;
        const modalOpen = document.getElementById("startup-modal").style.display !== "none";
        const nameInput = document.getElementById("new-project-name-input");

        if (modalOpen && nameInput && nameInput.value.trim()) {
            const newProj = createNewProject(nameInput.value.trim(), "horizontal", imgUrl);
            await GLDatabase.saveTacticalProject(newProj);
            nameInput.value = "";
            await loadProjectIntoWorkspace(newProj);
        } else if (AppState.project) {
            AppState.project.customBgData = imgUrl;
            await setCustomBackground(imgUrl);
            document.getElementById("pitch-type").disabled = true;
            resizeCanvas(AppState.pitchType);
            render();
            queueAutoSave();
        }
        document.getElementById("startup-modal").style.display = "none";
        setLog("ĐÃ CẬP NHẬT ẢNH NỀN SÂN CUSTOM");
    };
    reader.readAsDataURL(file);
});

// --- XUẤT VIDEO ANIMATION LẺ CHO SLIDE HIỆN TẠI & BRIDGE SANG MODULE 07 ---

/**
 * Hàm quay lại quá trình chuyển động của một Slide thành Blob Video (.webm)
 */
async function recordSlideAnimationBlob(slideIndex) {
    const prevSlideIdx = AppState.currentSlideIdx;
    const prevKfIdx = AppState.currentKfIdx;

    AppState.currentSlideIdx = slideIndex;
    AppState.currentKfIdx = 0;
    AppState.selectedObj = null;
    syncActiveKeyframeRefs();
    render();

    const slide = AppState.project.slides[slideIndex];
    const snapshotDataUrl = canvas.toDataURL("image/png");

    // Nếu Slide chỉ có 1 Sa bàn tĩnh, trả về ảnh tĩnh ngay lập tức
    if (slide.keyframes.length < 2) {
        return {
            mediaType: 'image',
            dataUrl: snapshotDataUrl,
            videoBlob: null,
            duration: 4.0
        };
    }

    // Nếu Slide có >= 2 Sa bàn, tiến hành ghi hình Canvas ở 60fps
    const stream = canvas.captureStream(60);
    let mimeType = 'video/webm;codecs=vp9';
    if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm';

    const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 8000000
    });

    const chunks = [];
    recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    const totalSteps = slide.keyframes.length - 1;
    const stepSec = parseFloat(slide.stepDuration) || 2.0;

    return new Promise((resolve) => {
        recorder.onstop = () => {
            const blob = new Blob(chunks, { type: mimeType });
            AppState.currentSlideIdx = prevSlideIdx;
            AppState.currentKfIdx = prevKfIdx;
            syncActiveKeyframeRefs();
            render();
            resolve({
                mediaType: 'video',
                dataUrl: snapshotDataUrl,
                videoBlob: blob,
                duration: Math.max(2, Math.round(totalSteps * stepSec * 10) / 10)
            });
        };

        recorder.start();
        playSlideAnimation(() => {
            setTimeout(() => {
                if (recorder.state !== 'inactive') recorder.stop();
            }, 150);
        });
    });
}

// Nút Xuất Video Lẻ ngay tại Tactical Board
document.getElementById("export-video-btn").addEventListener("click", async () => {
    if (!AppState.project) return;
    const slide = AppState.project.slides[AppState.currentSlideIdx];
    if (slide.keyframes.length < 2) {
        alert("Trang hiện tại chỉ có 1 Sa bàn tĩnh. Hãy bấm '+ SA BÀN TIẾP THEO' và kéo cầu thủ di chuyển để tạo Video Animation, hoặc dùng nút 'XUẤT ẢNH LẺ'!");
        return;
    }

    setLog("ĐANG RENDER VIDEO ANIMATION... VUI LÒNG ĐỢI");
    const result = await recordSlideAnimationBlob(AppState.currentSlideIdx);
    if (result && result.videoBlob) {
        const url = URL.createObjectURL(result.videoBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${slide.title.replace(/\s+/g, '_')}_anim.webm`;
        a.click();
        setLog("ĐÃ XUẤT VIDEO ANIMATION LẺ THÀNH CÔNG!");
    }
});

// Nút EXPORT SANG MODULE 07 (VIDEO STUDIO)
document.getElementById("btn-push-module7").addEventListener("click", async () => {
    if (!AppState.project) return;
    stopAnimationPreview();

    const slides = AppState.project.slides;
    const btn = document.getElementById("btn-push-module7");
    const originalHTML = btn.innerHTML;
    btn.disabled = true;

    const exportedFrames = [];
    for (let i = 0; i < slides.length; i++) {
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> RENDERING SLIDE ${i + 1}/${slides.length}...`;
        setLog(`ĐANG ĐÓNG GÓI SLIDE ${i + 1}/${slides.length} SANG MODULE 07...`);

        const s = slides[i];
        const mediaPack = await recordSlideAnimationBlob(i);

        exportedFrames.push({
            id: 'frame_' + generateId(),
            title: s.title || `Slide ${i + 1}`,
            subtitle: s.subtitle || "",
            mediaType: mediaPack.mediaType,
            imageDataUrl: mediaPack.dataUrl,
            videoBlob: mediaPack.videoBlob,
            duration: mediaPack.duration,
            transition: 'fade',
            motion: mediaPack.mediaType === 'image' ? 'kenburns-in' : 'none',
            fitMode: 'contain'
        });
    }

    await GLDatabase.pushToVideoBridge({
        projectName: AppState.project.name,
        sourceProjectId: AppState.project.id,
        frames: exportedFrames
    });

    btn.innerHTML = originalHTML;
    btn.disabled = false;
    window.location.href = "video.html";
});

// --- CÁC NÚT CÔNG CỤ CƠ BẢN (GIỮ NGUYÊN TƯƠNG THÍCH) ---
const scaleSlider = document.getElementById("global-scale");
const scaleNumber = document.getElementById("scale-number");

scaleSlider.addEventListener("input", (e) => {
    const val = parseFloat(e.target.value);
    AppState.userScale = val;
    scaleNumber.value = val;
    setLog(`OBJECT SCALE: ${val.toFixed(1)}X`);
    render();
});

scaleNumber.addEventListener("input", (e) => {
    let val = parseFloat(e.target.value);
    if (isNaN(val)) return;
    val = Math.max(0.1, Math.min(5.0, val));
    AppState.userScale = val;
    scaleSlider.value = val;
    setLog(`OBJECT SCALE: ${val.toFixed(1)}X`);
    render();
});

document.getElementById("pitch-type").addEventListener("change", (e) => {
    AppState.pitchType = e.target.value;
    if (AppState.project) AppState.project.pitchType = AppState.pitchType;
    resizeCanvas(AppState.pitchType);
    setLog(`PITCH ORIENTATION: ${e.target.value.toUpperCase()}`);
    render();
});

document.getElementById("circle-btn").addEventListener("click", () => {
    const color = document.getElementById("circle-color").value;
    const text = document.getElementById("circle-text").value;
    const details = document.getElementById("circle-details-text").value;
    const textColor = document.getElementById("circle-text-color").value || "white";

    const dpr = window.devicePixelRatio || 1;
    const cx = (canvas.width / dpr) / 2;
    const cy = (canvas.height / dpr) / 2;

    const newCircle = new Circle(cx, cy, 20 * responsiveConstant, color, text, textColor, details);
    AppState.circles.push(newCircle);
    document.getElementById("circle-text").value = "";
    document.getElementById("circle-details-text").value = "";
    updateCounts();
    render();
    setLog(`ADDED TOKEN ${details ? details : (text ? '#' + text : color)}`);
});

document.getElementById("text-btn").addEventListener("click", () => {
    const val = document.getElementById("text-input").value;
    if (!val) return;
    const fontSize = parseInt(document.getElementById("text-font-size").value) || 20;
    const dpr = window.devicePixelRatio || 1;
    AppState.texts.push(new TextObj((canvas.width / dpr) / 2, (canvas.height / dpr) / 2, val, fontSize));
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
        setLog("CẦN ÍT NHẤT 3 ĐIỂM ĐỂ KHÉP VÙNG CHIẾN THUẬT");
    }
});

document.getElementById("delete-btn").addEventListener("click", () => {
    if (!AppState.selectedObj) {
        setLog("CHƯA CHỌN PHẦN TỬ NÀO ĐỂ XÓA");
        return;
    }
    const targetId = AppState.selectedObj.id;
    const slide = AppState.project.slides[AppState.currentSlideIdx];
    const kf = slide.keyframes[AppState.currentKfIdx];

    if (AppState.selectedType === 'circle') kf.circles = kf.circles.filter(o => o.id !== targetId);
    else if (AppState.selectedType === 'arrow') kf.arrows = kf.arrows.filter(o => o.id !== targetId);
    else if (AppState.selectedType === 'text') kf.texts = kf.texts.filter(o => o.id !== targetId);
    else if (AppState.selectedType === 'polygon') kf.polygons = kf.polygons.filter(o => o.id !== targetId);

    AppState.selectedObj = null;
    syncActiveKeyframeRefs();
    render();
    setLog("ĐÃ XÓA PHẦN TỬ");
});

document.getElementById("reset-btn").addEventListener("click", () => {
    if (confirm("Xóa toàn bộ phần tử trên nhịp sa bàn hiện tại?")) {
        const kf = AppState.project.slides[AppState.currentSlideIdx].keyframes[AppState.currentKfIdx];
        kf.circles = []; kf.arrows = []; kf.texts = []; kf.polygons = [];
        AppState.selectedObj = null;
        syncActiveKeyframeRefs();
        render();
        setLog("ĐÃ LÀM MỚI SA BÀN HIỆN TẠI");
    }
});

document.getElementById("export-btn").addEventListener("click", () => {
    AppState.selectedObj = null;
    render();
    const link = document.createElement('a');
    link.download = `${(AppState.project?.name || 'goal-line')}-slide-${AppState.currentSlideIdx + 1}.jpg`;
    link.href = canvas.toDataURL("image/jpeg", 0.95);
    link.click();
    setLog("ĐÃ XUẤT ẢNH LẺ THÀNH CÔNG");
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
    if (e.target.checked) {
        AppState.selectedObj = null;
        setLog("MODE: DRAW ARROW • NHẤN & KÉO TRÊN SÂN");
    } else {
        setLog("MODE: SELECT & DRAG");
    }
});

document.getElementById("draw-polygon-input").addEventListener("change", (e) => {
    const arrowInput = document.getElementById("draw-arrow-input");
    if (e.target.checked && arrowInput) arrowInput.checked = false;
    updateToggleStatus();
    if (e.target.checked) {
        AppState.selectedObj = null;
        setLog("MODE: DRAW ZONE • CHẤM CÁC ĐIỂM TRÊN SÂN");
    } else {
        setLog("MODE: SELECT & DRAG");
    }
});

window.addEventListener("wheel", (e) => {
    if (e.shiftKey && AppState.selectedObj && AppState.selectedType === 'text') {
        AppState.selectedObj.rotate += (e.deltaY > 0 ? 5 : -5);
        setLog(`ROTATING TEXT: ${AppState.selectedObj.rotate}°`);
        render();
    }
});

window.addEventListener("resize", () => {
    resizeCanvas(AppState.pitchType);
    render();
});

// Cho phép lăn con lăn chuột để cuộn ngang danh sách Sa bàn siêu tiện lợi
const kfTabsEl = document.getElementById("keyframe-tabs");
if (kfTabsEl) {
    kfTabsEl.addEventListener("wheel", (e) => {
        if (e.deltaY !== 0) {
            e.preventDefault();
            kfTabsEl.scrollLeft += e.deltaY;
        }
    }, { passive: false });
}

init();