// js/board/board.js
import { Circle } from './shapes/Circle.js';
import { Arrow } from './shapes/Arrow.js';
import { TextObj } from './shapes/TextObj.js';
import { Polygon } from './shapes/Polygon.js';
import { Highlight } from './shapes/Highlight.js';
import { Storage } from './storage.js';
import { GLDatabase } from '../shared/gl-db.js';
import {
    canvas, ctx, loadImages, resizeCanvas, drawPitch, clearCanvas, getImages, responsiveConstant,
    setCustomBackground, clearCustomBackground
} from './canvas.js';
import { getMousePos, generateId } from './utils.js';

// --- STATE MANAGEMENT ---
const AppState = {
    project: null,
    currentSlideIdx: 0,
    currentKfIdx: 0,

    circles: [],
    arrows: [],
    texts: [],
    polygons: [],
    highlights: [],
    highlightLinks: [],
    pitchType: 'horizontal',
    gridOverlay: 'none',

    // Selection & Dragging
    selectedObj: null,
    selectedType: null, // 'circle' | 'arrow' | 'text' | 'polygon' | 'highlight' | 'highlightLink'
    isDragging: false,
    hasMovedDuringDrag: false,
    dragOffset: { x: 0, y: 0 },
    isDraggingPathHandle: false,
    isResizingHighlight: false,

    lastMousePos: { x: 0, y: 0 },
    polygonDragIndex: -1,

    // Drawing & Linking Modes
    mode: 'select',
    drawingArrow: null,
    drawingPolygonPoints: [],
    arrowDragPoint: null,

    // Highlight Linker State
    linkSourceHighlight: null,
    lastPlacedHighlight: null,
    activeHighlightColor: '#b91c1c',

    // Undo / Redo History Stack
    undoStack: [],
    redoStack: [],

    showGhostPath: true,
    isPlayingAnim: false,
    animReqId: null,

    userScale: 1.0
};

const logEl = document.getElementById("editor-log");
function setLog(text) {
    if (logEl) logEl.textContent = text.toUpperCase();
}

function updateSelectedBadge() {
    const badge = document.getElementById("selected-obj-badge");
    if (!badge) return;
    if (!AppState.selectedObj) {
        badge.textContent = "MODE: SELECT";
        badge.style.background = "var(--neo-yellow)";
        return;
    }
    const map = {
        highlight: "EDIT: HIGHLIGHT",
        highlightLink: "EDIT: LINK LINE",
        circle: "EDIT: PLAYER",
        arrow: "EDIT: ARROW",
        polygon: "EDIT: ZONE",
        text: "EDIT: LABEL"
    };
    badge.textContent = map[AppState.selectedType] || "SELECTED";
    badge.style.background = "var(--neo-green)";
}

// --- KHỞI TẠO DỮ LIỆU & HYDRATION ---
function createEmptyKeyframe() {
    return {
        id: 'kf_' + generateId(),
        circles: [],
        arrows: [],
        texts: [],
        polygons: [],
        highlights: [],
        highlightLinks: []
    };
}

function createNewSlide(title = "Trang chiến thuật 1", pitchType = "horizontal", customBgData = null) {
    return {
        id: 'slide_' + generateId(),
        title: title,
        subtitle: "",
        pitchType: pitchType || 'horizontal',
        gridOverlay: 'none',
        customBgData: customBgData || null,
        stepDuration: 2.0,
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
        slides: [createNewSlide("Slide 1: Cấu trúc đội hình", pitchType, customBgData)]
    };
}

function hydrateKeyframeObjects(kf) {
    kf.circles = (kf.circles || []).map(d => new Circle(
        d.x, d.y, d.radius, d.color, d.text, d.textColor, d.detailsText,
        d.id, d.pathCx ?? null, d.pathCy ?? null, d.showVision ?? false, d.visionAngle ?? 0
    ));
    kf.arrows = (kf.arrows || []).map(d => new Arrow(
        d.fromX, d.fromY, d.toX, d.toY, d.color, d.type, d.isArrow, d.cx, d.cy, d.id, d.headType || null
    ));
    kf.texts = (kf.texts || []).map(d => new TextObj(
        d.x, d.y, d.text, d.fontSize, d.rotate, d.id, d.color || "#ffffff", d.bgStyle || "none"
    ));
    kf.polygons = (kf.polygons || []).map(d => new Polygon(
        d.points || d, d.id, d.color || "#ffffff", d.fillStyle || "solid", d.label || ""
    ));
    kf.highlights = (kf.highlights || []).map(d => new Highlight(
        d.x, d.y, d.size ?? 32, d.color || '#b91c1c', d.shapeStyle || 'circle',
        d.opacity ?? 0.48, d.id, d.pathCx ?? null, d.pathCy ?? null,
        d.labelText || "", d.labelSize ?? 15, d.labelStyle || "dark-pill", d.effectStyle || "none"
    ));
    kf.highlightLinks = (kf.highlightLinks || []).map(l => ({
        id: l.id || ('hlink_' + generateId()),
        fromId: l.fromId,
        toId: l.toId,
        color: l.color || '#b91c1c',
        lineType: l.lineType || 'solid',
        lineWidth: l.lineWidth || 3
    }));
}

function hydrateProject(rawProj) {
    if (!rawProj.slides || rawProj.slides.length === 0) {
        rawProj.slides = [createNewSlide("Slide 1", rawProj.pitchType, rawProj.customBgData)];
    }
    rawProj.slides.forEach((slide, sIdx) => {
        slide.title = slide.title || `Slide ${sIdx + 1}`;
        slide.subtitle = slide.subtitle || "";
        slide.stepDuration = parseFloat(slide.stepDuration) || 2.0;
        slide.pitchType = slide.pitchType || rawProj.pitchType || 'horizontal';
        slide.gridOverlay = slide.gridOverlay || 'none';
        slide.customBgData = slide.customBgData !== undefined ? slide.customBgData : (rawProj.customBgData || null);

        if (!slide.keyframes || slide.keyframes.length === 0) {
            slide.keyframes = [createEmptyKeyframe()];
        }
        slide.keyframes.forEach(kf => hydrateKeyframeObjects(kf));
    });
    return rawProj;
}

// --- UNDO / REDO SNAPSHOT SYSTEM ---
function pushHistorySnapshot() {
    if (!AppState.project) return;
    const kf = AppState.project.slides[AppState.currentSlideIdx]?.keyframes[AppState.currentKfIdx];
    if (!kf) return;
    const snap = JSON.stringify(kf);
    if (AppState.undoStack.length > 0 && AppState.undoStack[AppState.undoStack.length - 1] === snap) return;
    AppState.undoStack.push(snap);
    if (AppState.undoStack.length > 35) AppState.undoStack.shift();
    AppState.redoStack = [];
}

function performUndo() {
    if (!AppState.project || AppState.undoStack.length === 0) {
        setLog("KHÔNG CÓ THAO TÁC NÀO ĐỂ HOÀN TÁC (UNDO)");
        return;
    }
    const slide = AppState.project.slides[AppState.currentSlideIdx];
    const currentSnap = JSON.stringify(slide.keyframes[AppState.currentKfIdx]);
    AppState.redoStack.push(currentSnap);

    const prevSnap = JSON.parse(AppState.undoStack.pop());
    hydrateKeyframeObjects(prevSnap);
    slide.keyframes[AppState.currentKfIdx] = prevSnap;
    AppState.selectedObj = null;
    syncActiveKeyframeRefs();
    render();
    setLog("ĐÃ HOÀN TÁC (UNDO)");
}

function performRedo() {
    if (!AppState.project || AppState.redoStack.length === 0) {
        setLog("KHÔNG CÓ THAO TÁC NÀO ĐỂ LÀM LẠI (REDO)");
        return;
    }
    const slide = AppState.project.slides[AppState.currentSlideIdx];
    const currentSnap = JSON.stringify(slide.keyframes[AppState.currentKfIdx]);
    AppState.undoStack.push(currentSnap);

    const nextSnap = JSON.parse(AppState.redoStack.pop());
    hydrateKeyframeObjects(nextSnap);
    slide.keyframes[AppState.currentKfIdx] = nextSnap;
    AppState.selectedObj = null;
    syncActiveKeyframeRefs();
    render();
    setLog("ĐÃ LÀM LẠI (REDO)");
}

// --- QUẢN LÝ NỀN SÂN & ĐỒNG BỘ KEYFRAME ---
async function applySlideBackground(slide) {
    if (!slide) return;
    AppState.pitchType = slide.pitchType || 'horizontal';
    AppState.gridOverlay = slide.gridOverlay || 'none';

    if (slide.customBgData) {
        await setCustomBackground(slide.customBgData);
        document.getElementById("pitch-type").disabled = true;
        updatePitchCustomUI(true);
    } else {
        clearCustomBackground();
        document.getElementById("pitch-type").disabled = false;
        updatePitchCustomUI(false);
    }

    const pitchSelect = document.getElementById("pitch-type");
    const gridSelect = document.getElementById("pitch-grid-overlay");
    if (pitchSelect) pitchSelect.value = AppState.pitchType;
    if (gridSelect) gridSelect.value = AppState.gridOverlay;

    resizeCanvas(AppState.pitchType);
}

function updatePitchCustomUI(hasCustom) {
    const revertBtn = document.getElementById("btn-revert-pitch-inline");
    const changeBtn = document.getElementById("btn-change-bg-inline");
    if (revertBtn) revertBtn.style.display = hasCustom ? "block" : "none";
    if (changeBtn) {
        changeBtn.innerHTML = hasCustom
            ? `<i class="fa-solid fa-image"></i> ĐỔI ẢNH NỀN KHÁC (TRANG NÀY)`
            : `<i class="fa-solid fa-image"></i> ĐỔI ẢNH NỀN TRANG NÀY`;
    }
}

function syncActiveKeyframeRefs() {
    if (!AppState.project) return;
    const slides = AppState.project.slides;
    if (AppState.currentSlideIdx >= slides.length) AppState.currentSlideIdx = Math.max(0, slides.length - 1);
    const slide = slides[AppState.currentSlideIdx];

    if (AppState.currentKfIdx >= slide.keyframes.length) AppState.currentKfIdx = Math.max(0, slide.keyframes.length - 1);
    const kf = slide.keyframes[AppState.currentKfIdx];

    if (!kf.highlights) kf.highlights = [];
    if (!kf.highlightLinks) kf.highlightLinks = [];

    AppState.circles = kf.circles;
    AppState.arrows = kf.arrows;
    AppState.texts = kf.texts;
    AppState.polygons = kf.polygons;
    AppState.highlights = kf.highlights;
    AppState.highlightLinks = kf.highlightLinks;
    AppState.pitchType = slide.pitchType || 'horizontal';
    AppState.gridOverlay = slide.gridOverlay || 'none';

    AppState.linkSourceHighlight = null;
    AppState.lastPlacedHighlight = null;

    const titleInput = document.getElementById("slide-title-input");
    const subInput = document.getElementById("slide-sub-input");
    const durInput = document.getElementById("kf-duration-input");
    const pitchSelect = document.getElementById("pitch-type");
    const gridSelect = document.getElementById("pitch-grid-overlay");
    const projLabel = document.getElementById("active-project-label");

    if (titleInput) titleInput.value = slide.title || "";
    if (subInput) subInput.value = slide.subtitle || "";
    if (durInput) durInput.value = slide.stepDuration || 2.0;
    if (pitchSelect) pitchSelect.value = AppState.pitchType;
    if (gridSelect) gridSelect.value = AppState.gridOverlay;
    if (projLabel) projLabel.textContent = `PROJECT: ${AppState.project.name.toUpperCase()}`;

    renderSlidesSidebar();
    renderKeyframeTabs();
    updateCounts();
    updateBottomIndicator();
    updateSelectedBadge();
}

function updateBottomIndicator() {
    const el = document.getElementById("canvas-step-indicator");
    if (!el || !AppState.project) return;
    const slide = AppState.project.slides[AppState.currentSlideIdx];
    const totalKf = slide.keyframes.length;
    el.textContent = `${slide.title.toUpperCase()} • SA BÀN ${AppState.currentKfIdx + 1}/${totalKf} ${totalKf > 1 ? '• BẤM PLAY ANIM ĐỂ XEM CHUYỂN ĐỘNG' : ''}`;
}

let saveTimer = null;
function queueAutoSave() {
    if (!AppState.project) return;
    try {
        Storage.save(
            AppState.circles, AppState.arrows, AppState.texts,
            AppState.polygons, AppState.pitchType, AppState.highlights, AppState.highlightLinks
        );
    } catch (e) { /* Ignore quota */ }

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

    let projects = await GLDatabase.getAllTacticalProjects();
    const lastId = localStorage.getItem('gl_last_tactical_project_id');
    const found = projects.find(p => p.id === lastId) || projects[0];

    if (found) {
        await loadProjectIntoWorkspace(found);
        await refreshProjectModalList();
        document.getElementById("startup-modal").style.display = "flex";
    } else {
        const defaultProj = createNewProject("Phân tích Chiến thuật #01", "horizontal", null);
        await GLDatabase.saveTacticalProject(defaultProj);
        await loadProjectIntoWorkspace(defaultProj);
        await refreshProjectModalList();
        document.getElementById("startup-modal").style.display = "flex";
    }

    const kfTabsEl = document.getElementById("keyframe-tabs");
    if (kfTabsEl) {
        kfTabsEl.addEventListener("wheel", (e) => {
            if (e.deltaY !== 0) {
                e.preventDefault();
                kfTabsEl.scrollLeft += e.deltaY;
            }
        }, { passive: false });
    }

    // Khởi tạo Filter Tabs ở cột phải
    document.querySelectorAll(".panel-tab-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".panel-tab-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            const tab = btn.dataset.tab;
            document.querySelectorAll(".settings-panel .neo-card").forEach(card => {
                if (tab === "all" || card.dataset.cardCat === tab) {
                    card.style.display = "flex";
                } else {
                    card.style.display = "none";
                }
            });
        });
    });

    setLog("READY • TACTICAL BOARD PRO v4.0");
}

async function loadProjectIntoWorkspace(rawProj) {
    stopAnimationPreview();
    AppState.project = hydrateProject(rawProj);
    AppState.currentSlideIdx = 0;
    AppState.currentKfIdx = 0;
    AppState.selectedObj = null;
    AppState.undoStack = [];
    AppState.redoStack = [];

    const firstSlide = AppState.project.slides[0];
    await applySlideBackground(firstSlide);

    syncActiveKeyframeRefs();
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

// --- RENDER SIDEBAR SLIDES & KEYFRAME TABS ---
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
        const bgBadgeText = slide.customBgData ? '🖼️ ẢNH RIÊNG' : `⚽ SÂN ${slide.pitchType.toUpperCase()}`;

        card.innerHTML = `
            <div class="slide-card-top">
                <span>TRANG #${idx + 1}</span>
                <span class="slide-kf-pill">${kfCount > 1 ? `🎬 ${kfCount} SA BÀN` : '🖼️ 1 SA BÀN'}</span>
            </div>
            <div class="slide-card-title">${slide.title || `Trang ${idx + 1}`}</div>
            <div style="font-family:var(--font-mono); font-size:0.65rem; color:#444; margin-top:2px;">
                <span style="background:var(--neo-yellow); padding:1px 6px; border:1px solid #000; font-weight:800;">${bgBadgeText}</span>
            </div>
            <div class="slide-card-actions" style="margin-top:6px;">
                <button class="btn-slide-up" title="Đẩy lên" ${idx === 0 ? 'disabled' : ''}><i class="fa-solid fa-arrow-up"></i></button>
                <button class="btn-slide-down" title="Đẩy xuống" ${idx === slides.length - 1 ? 'disabled' : ''}><i class="fa-solid fa-arrow-down"></i></button>
                <button class="btn-slide-dup" title="Nhân bản trang"><i class="fa-regular fa-copy"></i></button>
                <button class="btn-slide-del" title="Xóa trang"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;

        card.addEventListener("click", async (e) => {
            if (e.target.closest("button")) return;
            stopAnimationPreview();
            AppState.currentSlideIdx = idx;
            AppState.currentKfIdx = 0;
            AppState.selectedObj = null;
            AppState.undoStack = [];
            AppState.redoStack = [];
            await applySlideBackground(slide);
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

        card.querySelector(".btn-slide-dup").addEventListener("click", async () => {
            const cloneRaw = JSON.parse(JSON.stringify(slide));
            cloneRaw.id = 'slide_' + generateId();
            cloneRaw.title = `${slide.title} (Copy)`;
            cloneRaw.pitchType = slide.pitchType;
            cloneRaw.gridOverlay = slide.gridOverlay;
            cloneRaw.customBgData = slide.customBgData;

            slides.splice(idx + 1, 0, cloneRaw);
            hydrateProject(AppState.project);
            AppState.currentSlideIdx = idx + 1;
            AppState.currentKfIdx = 0;
            AppState.selectedObj = null;

            await applySlideBackground(slides[AppState.currentSlideIdx]);
            syncActiveKeyframeRefs();
            render();
            queueAutoSave();
            setLog(`ĐÃ NHÂN BẢN TRANG #${idx + 1}`);
        });

        card.querySelector(".btn-slide-del").addEventListener("click", async () => {
            if (slides.length <= 1) {
                alert("Dự án cần có ít nhất 1 trang sa bàn!");
                return;
            }
            if (!confirm(`Xóa "${slide.title}"?`)) return;
            slides.splice(idx, 1);
            if (AppState.currentSlideIdx >= slides.length) AppState.currentSlideIdx = slides.length - 1;
            AppState.currentKfIdx = 0;
            await applySlideBackground(slides[AppState.currentSlideIdx]);
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
            AppState.undoStack = [];
            AppState.redoStack = [];
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
    drawPitch(AppState.pitchType, AppState.gridOverlay);
    const imgs = getImages();

    // 1. Polygons
    AppState.polygons.forEach((p) => {
        const isSelected = (AppState.selectedObj === p);
        p.draw(ctx, isSelected, AppState.userScale, responsiveConstant);
    });
    if (AppState.drawingPolygonPoints.length > 0) {
        const pColor = document.getElementById("poly-color")?.value || "#ffffff";
        const pFill = document.getElementById("poly-fill-style")?.value || "solid";
        const pLabel = document.getElementById("poly-label-input")?.value || "";
        new Polygon(AppState.drawingPolygonPoints, null, pColor, pFill, pLabel).draw(ctx, true, AppState.userScale, responsiveConstant);
    }

    // 2. Highlight Links
    AppState.highlightLinks.forEach((link) => {
        const h1 = AppState.highlights.find(h => h.id === link.fromId);
        const h2 = AppState.highlights.find(h => h.id === link.toId);
        if (h1 && h2) {
            const isLinkSelected = (AppState.selectedObj === link && AppState.selectedType === 'highlightLink');
            Highlight.drawLink(ctx, h1, h2, link, responsiveConstant, AppState.userScale, isLinkSelected);
        }
    });

    // 3. Highlights
    AppState.highlights.forEach((h) => {
        const isSelected = (AppState.selectedObj === h);
        const isLinkSource = (AppState.linkSourceHighlight === h);
        h.draw(ctx, responsiveConstant, isSelected, AppState.userScale, 1.0, isLinkSource);
    });

    // 4. Ghost Path (từ Sa bàn trước)
    if (AppState.showGhostPath && !AppState.isPlayingAnim && AppState.currentKfIdx > 0 && AppState.project) {
        const prevKf = AppState.project.slides[AppState.currentSlideIdx].keyframes[AppState.currentKfIdx - 1];
        if (prevKf) {
            AppState.highlights.forEach(h => {
                const prevHl = (prevKf.highlights || []).find(ph => ph.id === h.id);
                if (prevHl) {
                    const isSelected = (AppState.selectedObj === h);
                    h.drawMovementPath(ctx, prevHl, responsiveConstant, AppState.userScale, isSelected);
                }
            });

            AppState.circles.forEach(c => {
                const prevCircle = (prevKf.circles || []).find(pc => pc.id === c.id);
                if (prevCircle) {
                    const isSelected = (AppState.selectedObj === c);
                    c.drawMovementPath(ctx, prevCircle, responsiveConstant, AppState.userScale, isSelected);
                }
            });
        }
    }

    // 5. Arrows
    AppState.arrows.forEach((a) => {
        const isSelected = (AppState.selectedObj === a);
        a.draw(ctx, responsiveConstant, isSelected, AppState.userScale, 1.0);
    });
    if (AppState.drawingArrow) {
        AppState.drawingArrow.draw(ctx, responsiveConstant, true, AppState.userScale, 1.0);
    }

    // 6. Circles
    AppState.circles.forEach((c) => {
        const isSelected = (AppState.selectedObj === c);
        c.draw(ctx, imgs.ball, responsiveConstant, isSelected, AppState.userScale);
    });

    // 7. Texts
    AppState.texts.forEach((t) => {
        const isSelected = (AppState.selectedObj === t);
        t.draw(ctx, responsiveConstant, isSelected, AppState.userScale);
    });

    updateSelectedBadge();
    queueAutoSave();
}

// --- ENGINE NỘI SUY ANIMATION GIỮA CÁC NHỊP SA BÀN ---
function easeInOutCubic(x) {
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function renderInterpolatedStep(kf1, kf2, rawT) {
    if (!kf1 || !kf2) return;

    const t = easeInOutCubic(Math.max(0, Math.min(1, rawT)));
    clearCanvas();
    drawPitch(AppState.pitchType, AppState.gridOverlay);
    const imgs = getImages();

    const polys1 = kf1.polygons || [];
    const polys2 = kf2.polygons || [];
    const hls1 = kf1.highlights || [];
    const hls2 = kf2.highlights || [];
    const links2 = kf2.highlightLinks || [];
    const arrows1 = kf1.arrows || [];
    const arrows2 = kf2.arrows || [];
    const circles1 = kf1.circles || [];
    const circles2 = kf2.circles || [];
    const texts1 = kf1.texts || [];
    const texts2 = kf2.texts || [];

    polys2.forEach(p2 => {
        const p1 = polys1.find(p => p.id === p2.id);
        const polyToDraw = p1 ? Polygon.interpolate(p1, p2, t) : p2;
        polyToDraw.draw(ctx, false, AppState.userScale, responsiveConstant);
    });

    const interpHighlightsMap = new Map();
    hls2.forEach(h2 => {
        const h1 = hls1.find(h => h.id === h2.id);
        const hlInterp = h1 ? Highlight.interpolate(h1, h2, t) : h2;
        interpHighlightsMap.set(h2.id, { obj: hlInterp, alpha: h1 ? 1.0 : t });
    });

    links2.forEach(link => {
        const entry1 = interpHighlightsMap.get(link.fromId);
        const entry2 = interpHighlightsMap.get(link.toId);
        if (entry1 && entry2) {
            Highlight.drawLink(ctx, entry1.obj, entry2.obj, link, responsiveConstant, AppState.userScale, false);
        }
    });

    interpHighlightsMap.forEach(({ obj, alpha }) => {
        obj.draw(ctx, responsiveConstant, false, AppState.userScale, alpha, false);
    });

    arrows2.forEach(a2 => {
        const a1 = arrows1.find(a => a.id === a2.id);
        if (a1) {
            const arrInterp = Arrow.interpolate(a1, a2, t);
            arrInterp.draw(ctx, responsiveConstant, false, AppState.userScale, 1.0);
        } else {
            a2.draw(ctx, responsiveConstant, false, AppState.userScale, t);
        }
    });

    circles2.forEach(c2 => {
        const c1 = circles1.find(c => c.id === c2.id);
        if (c1) {
            const cirInterp = Circle.interpolate(c1, c2, t);
            cirInterp.draw(ctx, imgs.ball, responsiveConstant, false, AppState.userScale, 1.0);
        } else {
            c2.draw(ctx, imgs.ball, responsiveConstant, false, AppState.userScale, t);
        }
    });
    circles1.forEach(c1 => {
        const stillExists = circles2.some(c2 => c2.id === c1.id);
        if (!stillExists) {
            c1.draw(ctx, imgs.ball, responsiveConstant, false, AppState.userScale, Math.max(0, 1 - t));
        }
    });

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
        setLog("CẦN ÍT NHẤT 2 NHỊP SA BÀN ĐỂ CHẠY ANIMATION (BẤM '+ SA BÀN TIẾP')");
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

// --- LIVE INSPECTOR: ĐỒNG BỘ UI CỘT PHẢI KHI CLICK CHỌN BẤT KỲ PHẦN TỬ NÀO ---
function syncHighlightControlsFromSelection(hl) {
    if (!hl) return;
    document.getElementById("hl-size-slider").value = Math.round(hl.size);
    document.getElementById("hl-size-number").value = Math.round(hl.size);
    document.getElementById("hl-shape-style").value = hl.shapeStyle || 'circle';
    document.getElementById("hl-effect-style").value = hl.effectStyle || 'none';
    document.getElementById("hl-opacity-slider").value = hl.opacity || 0.48;
    document.getElementById("hl-custom-color").value = hl.color || '#b91c1c';
    document.getElementById("hl-label-text").value = hl.labelText || "";
    document.getElementById("hl-label-size").value = Math.round(hl.labelSize || 15);
    document.getElementById("hl-label-style").value = hl.labelStyle || "dark-pill";

    AppState.activeHighlightColor = hl.color || '#b91c1c';
    document.querySelectorAll(".hl-swatch").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.color?.toLowerCase() === AppState.activeHighlightColor.toLowerCase());
    });
}

function syncCircleControlsFromSelection(cir) {
    if (!cir) return;
    document.getElementById("circle-color").value = cir.color || "red";
    document.getElementById("circle-text").value = cir.text || "";
    document.getElementById("circle-details-text").value = cir.detailsText || "";
    document.getElementById("circle-text-color").value = cir.textColor || "white";
    document.getElementById("circle-vision-check").checked = Boolean(cir.showVision);
    document.getElementById("circle-vision-angle").value = Math.round(cir.visionAngle || 0);
    document.getElementById("vision-angle-label").textContent = `${Math.round(cir.visionAngle || 0)}°`;
}

function syncArrowControlsFromSelection(arr) {
    if (!arr) return;
    document.getElementById("arrow-color").value = arr.color || "#ffffff";
    document.getElementById("arrow-type").value = arr.type || "solid";
    document.getElementById("arrow-head-type").value = arr.headType || "arrow";
}

function syncPolygonControlsFromSelection(poly) {
    if (!poly) return;
    document.getElementById("poly-color").value = poly.color || "#ffffff";
    document.getElementById("poly-fill-style").value = poly.fillStyle || "solid";
    document.getElementById("poly-label-input").value = poly.label || "";
}

function syncTextControlsFromSelection(txt) {
    if (!txt) return;
    document.getElementById("text-input").value = txt.text || "";
    document.getElementById("text-font-size").value = String(txt.fontSize || 20);
    document.getElementById("text-color-select").value = txt.color || "#ffffff";
    document.getElementById("text-bg-style").value = txt.bgStyle || "none";
}

function toggleHighlightLink(hlA, hlB) {
    if (!hlA || !hlB || hlA.id === hlB.id) return;
    pushHistorySnapshot();

    const existingIdx = AppState.highlightLinks.findIndex(
        l => (l.fromId === hlA.id && l.toId === hlB.id) || (l.fromId === hlB.id && l.toId === hlA.id)
    );

    if (existingIdx !== -1) {
        AppState.highlightLinks.splice(existingIdx, 1);
        setLog("ĐÃ NGẮT ĐƯỜNG THẲNG LIÊN KẾT GIỮA 2 VÒNG HIGHLIGHT");
    } else {
        const lineType = document.getElementById("hl-line-type")?.value || "solid";
        AppState.highlightLinks.push({
            id: 'hlink_' + generateId(),
            fromId: hlA.id,
            toId: hlB.id,
            color: AppState.activeHighlightColor || hlA.color,
            lineType: lineType,
            lineWidth: 3
        });
        setLog("ĐÃ NỐI ĐƯỜNG THẲNG LIÊN KẾT 2 VÒNG HIGHLIGHT");
    }
}

// --- SỰ KIỆN CHUỘT TRÊN CANVAS ---
canvas.addEventListener("mousedown", (e) => {
    if (AppState.isPlayingAnim) stopAnimationPreview();
    const pos = getMousePos(canvas, e);
    AppState.hasMovedDuringDrag = false;

    const isDrawArrowMode = document.getElementById("draw-arrow-input")?.checked;
    const isDrawPolygonMode = document.getElementById("draw-polygon-input")?.checked;
    const isDrawHighlightMode = document.getElementById("draw-highlight-input")?.checked;
    const isLinkHighlightMode = document.getElementById("link-highlight-input")?.checked;

    // 0A. Mode: NỐI / NGẮT DÂY HIGHLIGHT (Hoặc giữ Shift + Click)
    if (isLinkHighlightMode || e.shiftKey) {
        for (let i = AppState.highlights.length - 1; i >= 0; i--) {
            if (AppState.highlights[i].isHit(pos.x, pos.y, responsiveConstant, AppState.userScale)) {
                const clickedHl = AppState.highlights[i];
                if (!AppState.linkSourceHighlight) {
                    AppState.linkSourceHighlight = clickedHl;
                    AppState.selectedObj = clickedHl;
                    AppState.selectedType = 'highlight';
                    syncHighlightControlsFromSelection(clickedHl);
                    setLog("ĐÃ CHỌN VÒNG #1 • CLICK VÀO VÒNG #2 ĐỂ NỐI HOẶC NGẮT DÂY!");
                } else if (AppState.linkSourceHighlight === clickedHl) {
                    AppState.linkSourceHighlight = null;
                    setLog("ĐÃ HỦY CHỌN ĐIỂM NỐI");
                } else {
                    toggleHighlightLink(AppState.linkSourceHighlight, clickedHl);
                    AppState.linkSourceHighlight = clickedHl;
                    AppState.selectedObj = clickedHl;
                    AppState.selectedType = 'highlight';
                }
                render();
                return;
            }
        }

        if (isLinkHighlightMode) {
            for (let i = AppState.highlightLinks.length - 1; i >= 0; i--) {
                const lnk = AppState.highlightLinks[i];
                const h1 = AppState.highlights.find(h => h.id === lnk.fromId);
                const h2 = AppState.highlights.find(h => h.id === lnk.toId);
                if (Highlight.isHitLink(pos.x, pos.y, h1, h2, responsiveConstant, AppState.userScale)) {
                    pushHistorySnapshot();
                    AppState.highlightLinks.splice(i, 1);
                    setLog("ĐÃ XÓA ĐƯỜNG NỐI");
                    render();
                    return;
                }
            }
            AppState.linkSourceHighlight = null;
            render();
            return;
        }
    }

    // 0B. Kiểm tra nút kéo chỉnh Size trực tiếp trên vành Highlight
    if (AppState.selectedObj && AppState.selectedType === 'highlight') {
        if (AppState.selectedObj.isHitResizeHandle(pos.x, pos.y, responsiveConstant, AppState.userScale)) {
            pushHistorySnapshot();
            AppState.isDragging = true;
            AppState.isResizingHighlight = true;
            setLog("KÉO CHUỘT ĐỂ CHỈNH TO / NHỎ VÒNG HIGHLIGHT");
            render();
            return;
        }
    }

    // 0C. Mode: CHẤM VÒNG HIGHLIGHT CẦU THỦ
    if (isDrawHighlightMode) {
        for (let i = AppState.highlights.length - 1; i >= 0; i--) {
            if (AppState.highlights[i].isHit(pos.x, pos.y, responsiveConstant, AppState.userScale)) {
                pushHistorySnapshot();
                AppState.selectedObj = AppState.highlights[i];
                AppState.selectedType = 'highlight';
                AppState.isDragging = true;
                AppState.dragOffset = { x: pos.x - AppState.highlights[i].x, y: pos.y - AppState.highlights[i].y };
                syncHighlightControlsFromSelection(AppState.highlights[i]);
                setLog("ĐÃ CHỌN HIGHLIGHT • GÕ VÀO Ô 'TEXT DƯỚI HIGHLIGHT' ĐỂ ĐẶT TÊN CẦU THỦ");
                render();
                return;
            }
        }

        pushHistorySnapshot();
        const sizeVal = parseFloat(document.getElementById("hl-size-number")?.value) || 32;
        const shapeStyle = document.getElementById("hl-shape-style")?.value || "circle";
        const effectStyle = document.getElementById("hl-effect-style")?.value || "none";
        const opacityVal = parseFloat(document.getElementById("hl-opacity-slider")?.value) || 0.48;
        const colorVal = AppState.activeHighlightColor || "#b91c1c";
        const labelSize = parseFloat(document.getElementById("hl-label-size")?.value) || 15;
        const labelStyle = document.getElementById("hl-label-style")?.value || "dark-pill";

        const newHl = new Highlight(
            pos.x, pos.y, sizeVal, colorVal, shapeStyle, opacityVal,
            null, null, null, "", labelSize, labelStyle, effectStyle
        );
        AppState.highlights.push(newHl);

        // Xóa trắng ô nhập chữ để người dùng gõ tên mới cho vòng vừa đặt
        const lbInput = document.getElementById("hl-label-text");
        if (lbInput) lbInput.value = "";

        const autoChain = document.getElementById("hl-auto-chain")?.checked;
        if (autoChain && AppState.lastPlacedHighlight && AppState.highlights.includes(AppState.lastPlacedHighlight)) {
            toggleHighlightLink(AppState.lastPlacedHighlight, newHl);
        }

        AppState.lastPlacedHighlight = newHl;
        AppState.selectedObj = newHl;
        AppState.selectedType = 'highlight';
        AppState.isDragging = true;
        AppState.dragOffset = { x: 0, y: 0 };

        updateCounts();
        setLog(`ĐÃ ĐẶT VÒNG HIGHLIGHT #${AppState.highlights.length} • GÕ TÊN CẦU THỦ Ở CỘT PHẢI NẾU CẦN`);
        render();
        return;
    }

    // Mode: Draw Arrow
    if (isDrawArrowMode) {
        pushHistorySnapshot();
        AppState.mode = 'drawArrow';
        const color = document.getElementById("arrow-color").value;
        const type = document.getElementById("arrow-type").value;
        const headType = document.getElementById("arrow-head-type").value;
        AppState.drawingArrow = new Arrow(pos.x, pos.y, pos.x, pos.y, color, type, headType !== 'none', pos.x, pos.y, null, headType);
        setLog("DRAWING ARROW • KÉO CHUỘT ĐỂ ĐỊNH HƯỚNG");
        return;
    }

    // Mode: Draw Polygon
    if (isDrawPolygonMode) {
        AppState.mode = 'drawPolygon';
        AppState.drawingPolygonPoints.push({ x: pos.x, y: pos.y });
        setLog(`ĐÃ THÊM ĐỈNH VÙNG CHIẾN THUẬT (${AppState.drawingPolygonPoints.length} ĐIỂM)`);
        render();
        return;
    }

    // Mode: Select & Drag
    AppState.mode = 'select';
    AppState.linkSourceHighlight = null;

    // Kiểm tra nút uốn cong quỹ đạo Ghost Path
    if (AppState.showGhostPath && AppState.currentKfIdx > 0 && AppState.selectedObj) {
        const prevKf = AppState.project.slides[AppState.currentSlideIdx].keyframes[AppState.currentKfIdx - 1];
        if (AppState.selectedType === 'circle') {
            const prevCircle = prevKf?.circles.find(pc => pc.id === AppState.selectedObj.id);
            if (prevCircle && AppState.selectedObj.isHitPathHandle(pos.x, pos.y, prevCircle, responsiveConstant, AppState.userScale)) {
                pushHistorySnapshot();
                AppState.isDragging = true;
                AppState.isDraggingPathHandle = true;
                setLog("ĐANG UỐN CONG QUỸ ĐẠO DI CHUYỂN CỦA CẦU THỦ");
                render();
                return;
            }
        } else if (AppState.selectedType === 'highlight') {
            const prevHl = (prevKf?.highlights || []).find(ph => ph.id === AppState.selectedObj.id);
            if (prevHl && AppState.selectedObj.isHitPathHandle(pos.x, pos.y, prevHl, responsiveConstant, AppState.userScale)) {
                pushHistorySnapshot();
                AppState.isDragging = true;
                AppState.isDraggingPathHandle = true;
                setLog("ĐANG UỐN CONG QUỸ ĐẠO DI CHUYỂN CỦA HIGHLIGHT");
                render();
                return;
            }
        }
    }

    AppState.selectedObj = null;
    AppState.selectedType = null;
    AppState.isDragging = false;
    AppState.isDraggingPathHandle = false;
    AppState.isResizingHighlight = false;
    AppState.polygonDragIndex = -1;

    // 1. Check Text
    for (let i = AppState.texts.length - 1; i >= 0; i--) {
        if (AppState.texts[i].isHit(pos.x, pos.y, ctx, responsiveConstant, AppState.userScale)) {
            pushHistorySnapshot();
            AppState.selectedObj = AppState.texts[i];
            AppState.selectedType = 'text';
            AppState.isDragging = true;
            AppState.dragOffset = { x: pos.x - AppState.texts[i].x, y: pos.y - AppState.texts[i].y };
            syncTextControlsFromSelection(AppState.texts[i]);
            setLog(`ĐÃ CHỌN NHÃN "${AppState.texts[i].text}" • CHỈNH SỬA TRỰC TIẾP Ở CỘT PHẢI`);
            render();
            return;
        }
    }

    // 2. Check Circle
    for (let i = AppState.circles.length - 1; i >= 0; i--) {
        if (AppState.circles[i].isHit(pos.x, pos.y, AppState.userScale)) {
            pushHistorySnapshot();
            AppState.selectedObj = AppState.circles[i];
            AppState.selectedType = 'circle';
            AppState.isDragging = true;
            AppState.dragOffset = { x: pos.x - AppState.circles[i].x, y: pos.y - AppState.circles[i].y };
            syncCircleControlsFromSelection(AppState.circles[i]);
            const name = AppState.circles[i].detailsText || (AppState.circles[i].text ? `#${AppState.circles[i].text}` : 'TOKEN');
            setLog(`ĐÃ CHỌN ${name} • SỬA SỐ ÁO/TÊN/HƯỚNG NHÌN TRỰC TIẾP Ở CỘT PHẢI`);
            render();
            return;
        }
    }

    // 3. Check Highlight
    for (let i = AppState.highlights.length - 1; i >= 0; i--) {
        if (AppState.highlights[i].isHit(pos.x, pos.y, responsiveConstant, AppState.userScale)) {
            pushHistorySnapshot();
            AppState.selectedObj = AppState.highlights[i];
            AppState.selectedType = 'highlight';
            AppState.isDragging = true;
            AppState.dragOffset = { x: pos.x - AppState.highlights[i].x, y: pos.y - AppState.highlights[i].y };
            syncHighlightControlsFromSelection(AppState.highlights[i]);
            setLog("ĐÃ CHỌN HIGHLIGHT • GÕ TÊN CẦU THỦ BÊN DƯỚI HOẶC SHIFT+CLICK ĐỂ NỐI DÂY");
            render();
            return;
        }
    }

    // 4. Check Highlight Link
    for (let i = AppState.highlightLinks.length - 1; i >= 0; i--) {
        const lnk = AppState.highlightLinks[i];
        const h1 = AppState.highlights.find(h => h.id === lnk.fromId);
        const h2 = AppState.highlights.find(h => h.id === lnk.toId);
        if (Highlight.isHitLink(pos.x, pos.y, h1, h2, responsiveConstant, AppState.userScale)) {
            AppState.selectedObj = lnk;
            AppState.selectedType = 'highlightLink';
            setLog("ĐÃ CHỌN DÂY LIÊN KẾT • BẤM DELETE ĐỂ XÓA HOẶC ĐỔI MÀU Ở BẢNG MÀU");
            render();
            return;
        }
    }

    // 5. Check Arrow
    for (let i = AppState.arrows.length - 1; i >= 0; i--) {
        const arr = AppState.arrows[i];
        if (arr.isHitHandle(pos.x, pos.y, 'control', responsiveConstant, AppState.userScale)) {
            pushHistorySnapshot();
            AppState.selectedObj = arr;
            AppState.selectedType = 'arrow';
            AppState.isDragging = true;
            AppState.arrowDragPoint = 'control';
            syncArrowControlsFromSelection(arr);
            setLog("BẺ CONG ĐƯỜNG CHUYỀN / MŨI TÊN");
            render();
            return;
        }
        if (arr.isHitHandle(pos.x, pos.y, 'from', responsiveConstant, AppState.userScale)) {
            pushHistorySnapshot();
            AppState.selectedObj = arr;
            AppState.selectedType = 'arrow';
            AppState.isDragging = true;
            AppState.arrowDragPoint = 'from';
            syncArrowControlsFromSelection(arr);
            render();
            return;
        }
        if (arr.isHitHandle(pos.x, pos.y, 'to', responsiveConstant, AppState.userScale)) {
            pushHistorySnapshot();
            AppState.selectedObj = arr;
            AppState.selectedType = 'arrow';
            AppState.isDragging = true;
            AppState.arrowDragPoint = 'to';
            syncArrowControlsFromSelection(arr);
            render();
            return;
        }
        if (arr.isHitBody(pos.x, pos.y, AppState.userScale)) {
            pushHistorySnapshot();
            AppState.selectedObj = arr;
            AppState.selectedType = 'arrow';
            AppState.isDragging = true;
            AppState.arrowDragPoint = 'body';
            AppState.dragOffset = {
                fromX: pos.x - arr.fromX, fromY: pos.y - arr.fromY,
                toX: pos.x - arr.toX, toY: pos.y - arr.toY,
                cx: pos.x - arr.cx, cy: pos.y - arr.cy
            };
            syncArrowControlsFromSelection(arr);
            setLog("ĐÃ CHỌN MŨI TÊN • ĐỔI KIỂU LƯỢN SÓNG/ĐẦU MÚT TRỰC TIẾP Ở CỘT PHẢI");
            render();
            return;
        }
    }

    // 6. Check Polygon
    for (let i = AppState.polygons.length - 1; i >= 0; i--) {
        const poly = AppState.polygons[i];
        const vertexIndex = poly.getHitVertexIndex(pos.x, pos.y, AppState.userScale);
        if (vertexIndex !== -1) {
            pushHistorySnapshot();
            AppState.selectedObj = poly;
            AppState.selectedType = 'polygon';
            AppState.isDragging = true;
            AppState.polygonDragIndex = vertexIndex;
            syncPolygonControlsFromSelection(poly);
            render();
            return;
        }
        if (poly.isHit(pos.x, pos.y)) {
            pushHistorySnapshot();
            AppState.selectedObj = poly;
            AppState.selectedType = 'polygon';
            AppState.isDragging = true;
            AppState.lastMousePos = { x: pos.x, y: pos.y };
            AppState.polygonDragIndex = -1;
            syncPolygonControlsFromSelection(poly);
            setLog("ĐÃ CHỌN VÙNG CHIẾN THUẬT • ĐỔI MÀU/KẺ SỌC/NHÃN VÙNG Ở CỘT PHẢI");
            render();
            return;
        }
    }

    setLog("READY • CLICK PHẦN TỬ ĐỂ CHỈNH SỬA TRỰC TIẾP");
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
        AppState.hasMovedDuringDrag = true;

        if (AppState.isResizingHighlight && AppState.selectedType === 'highlight') {
            const hl = AppState.selectedObj;
            const rawDist = Math.hypot(pos.x - hl.x, pos.y - hl.y);
            const newSize = Math.max(8, Math.min(200, Math.round(rawDist / (responsiveConstant * AppState.userScale))));
            applyHighlightSizeChange(newSize);
            return;
        }

        if (AppState.isDraggingPathHandle && (AppState.selectedType === 'circle' || AppState.selectedType === 'highlight')) {
            AppState.selectedObj.pathCx = pos.x;
            AppState.selectedObj.pathCy = pos.y;
            render();
            return;
        }

        if (AppState.selectedType === 'circle' || AppState.selectedType === 'text' || AppState.selectedType === 'highlight') {
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
        AppState.selectedObj = AppState.drawingArrow;
        AppState.selectedType = 'arrow';
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
    AppState.isResizingHighlight = false;
    AppState.arrowDragPoint = null;
    AppState.polygonDragIndex = -1;
    render();
});

// --- ĐIỀU KHIỂN HIGHLIGHT, TEXT DƯỚI HIGHLIGHT & HIỆU ỨNG ---
function applyHighlightSizeChange(newSize) {
    const val = Math.max(8, Math.min(200, parseFloat(newSize) || 32));
    const slider = document.getElementById("hl-size-slider");
    const numInput = document.getElementById("hl-size-number");
    const syncAll = document.getElementById("hl-sync-size")?.checked;

    if (slider) slider.value = Math.min(140, val);
    if (numInput) numInput.value = val;

    if (syncAll) {
        AppState.highlights.forEach(h => { h.size = val; });
        setLog(`ĐÃ ĐỒNG BỘ SIZE TẤT CẢ HIGHLIGHT: ${val}PX`);
    } else if (AppState.selectedObj && AppState.selectedType === 'highlight') {
        AppState.selectedObj.size = val;
        setLog(`SIZE HIGHLIGHT ĐANG CHỌN: ${val}PX`);
    }
    render();
}

document.getElementById("hl-size-slider")?.addEventListener("input", (e) => applyHighlightSizeChange(e.target.value));
document.getElementById("hl-size-number")?.addEventListener("input", (e) => applyHighlightSizeChange(e.target.value));

document.getElementById("hl-sync-size")?.addEventListener("change", (e) => {
    if (e.target.checked) {
        const currentVal = parseFloat(document.getElementById("hl-size-number")?.value) || 32;
        applyHighlightSizeChange(currentVal);
    } else {
        setLog("CHẾ ĐỘ SIZE RIÊNG LẺ TỪNG VÒNG HIGHLIGHT");
    }
});

document.getElementById("hl-shape-style")?.addEventListener("change", (e) => {
    const style = e.target.value;
    const syncAll = document.getElementById("hl-sync-size")?.checked;
    if (syncAll) AppState.highlights.forEach(h => { h.shapeStyle = style; });
    else if (AppState.selectedObj && AppState.selectedType === 'highlight') AppState.selectedObj.shapeStyle = style;
    render();
});

document.getElementById("hl-effect-style")?.addEventListener("change", (e) => {
    const eff = e.target.value;
    if (AppState.selectedObj && AppState.selectedType === 'highlight') {
        AppState.selectedObj.effectStyle = eff;
    } else {
        AppState.highlights.forEach(h => { h.effectStyle = eff; });
    }
    render();
});

// Nhập Text đánh dấu cầu thủ bên dưới Highlight (Live Edit)
document.getElementById("hl-label-text")?.addEventListener("input", (e) => {
    if (AppState.selectedObj && AppState.selectedType === 'highlight') {
        AppState.selectedObj.labelText = e.target.value;
        render();
    }
});

document.getElementById("hl-label-size")?.addEventListener("input", (e) => {
    const sz = Math.max(8, Math.min(48, parseFloat(e.target.value) || 15));
    const syncAll = document.getElementById("hl-sync-size")?.checked;
    if (syncAll) AppState.highlights.forEach(h => { h.labelSize = sz; });
    else if (AppState.selectedObj && AppState.selectedType === 'highlight') AppState.selectedObj.labelSize = sz;
    render();
});

document.getElementById("hl-label-style")?.addEventListener("change", (e) => {
    const st = e.target.value;
    const syncAll = document.getElementById("hl-sync-size")?.checked;
    if (syncAll) AppState.highlights.forEach(h => { h.labelStyle = st; });
    else if (AppState.selectedObj && AppState.selectedType === 'highlight') AppState.selectedObj.labelStyle = st;
    render();
});

document.getElementById("hl-opacity-slider")?.addEventListener("input", (e) => {
    const op = parseFloat(e.target.value) || 0.48;
    const syncAll = document.getElementById("hl-sync-size")?.checked;
    if (syncAll) AppState.highlights.forEach(h => { h.opacity = op; });
    else if (AppState.selectedObj && AppState.selectedType === 'highlight') AppState.selectedObj.opacity = op;
    render();
});

document.getElementById("hl-line-type")?.addEventListener("change", (e) => {
    const lt = e.target.value;
    if (AppState.selectedObj && AppState.selectedType === 'highlightLink') {
        AppState.selectedObj.lineType = lt;
    } else {
        AppState.highlightLinks.forEach(l => { l.lineType = lt; });
    }
    render();
});

function setHighlightColor(colorHex) {
    AppState.activeHighlightColor = colorHex;
    const picker = document.getElementById("hl-custom-color");
    if (picker) picker.value = colorHex;

    document.querySelectorAll(".hl-swatch").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.color?.toLowerCase() === colorHex.toLowerCase());
    });

    if (AppState.selectedObj && AppState.selectedType === 'highlight') {
        AppState.selectedObj.color = colorHex;
        AppState.highlightLinks.forEach(l => {
            if (l.fromId === AppState.selectedObj.id || l.toId === AppState.selectedObj.id) {
                l.color = colorHex;
            }
        });
        render();
    } else if (AppState.selectedObj && AppState.selectedType === 'highlightLink') {
        AppState.selectedObj.color = colorHex;
        render();
    }
}

document.querySelectorAll(".hl-swatch").forEach(btn => {
    btn.addEventListener("click", () => setHighlightColor(btn.dataset.color));
});

document.getElementById("hl-custom-color")?.addEventListener("input", (e) => setHighlightColor(e.target.value));

document.getElementById("btn-clear-hl-links")?.addEventListener("click", () => {
    pushHistorySnapshot();
    if (AppState.selectedObj && AppState.selectedType === 'highlight') {
        const id = AppState.selectedObj.id;
        const kf = AppState.project.slides[AppState.currentSlideIdx].keyframes[AppState.currentKfIdx];
        kf.highlightLinks = kf.highlightLinks.filter(l => l.fromId !== id && l.toId !== id);
        syncActiveKeyframeRefs();
        render();
        setLog("ĐÃ XÓA CÁC DÂY NỐI CỦA VÒNG HIGHLIGHT ĐANG CHỌN");
    } else if (AppState.highlightLinks.length > 0) {
        if (confirm("Xóa toàn bộ các đường thẳng nối giữa các vòng Highlight (giữ nguyên các vòng tròn)?")) {
            const kf = AppState.project.slides[AppState.currentSlideIdx].keyframes[AppState.currentKfIdx];
            kf.highlightLinks = [];
            syncActiveKeyframeRefs();
            render();
            setLog("ĐÃ XÓA TOÀN BỘ DÂY NỐI HIGHLIGHT");
        }
    }
});

// --- LIVE EDIT & CONTROLS CHO PLAYER (CIRCLE), ARROW, POLYGON, TEXT ---

// Live edit cho Player Token khi đang được chọn
["circle-color", "circle-text-color"].forEach(id => {
    document.getElementById(id)?.addEventListener("change", () => {
        if (AppState.selectedObj && AppState.selectedType === 'circle') {
            AppState.selectedObj.color = document.getElementById("circle-color").value;
            AppState.selectedObj.textColor = document.getElementById("circle-text-color").value;
            render();
        }
    });
});

["circle-text", "circle-details-text"].forEach(id => {
    document.getElementById(id)?.addEventListener("input", () => {
        if (AppState.selectedObj && AppState.selectedType === 'circle') {
            AppState.selectedObj.text = document.getElementById("circle-text").value;
            AppState.selectedObj.detailsText = document.getElementById("circle-details-text").value;
            render();
        }
    });
});

document.getElementById("circle-vision-check")?.addEventListener("change", (e) => {
    if (AppState.selectedObj && AppState.selectedType === 'circle') {
        AppState.selectedObj.showVision = e.target.checked;
        render();
    }
});

document.getElementById("circle-vision-angle")?.addEventListener("input", (e) => {
    const deg = parseFloat(e.target.value) || 0;
    document.getElementById("vision-angle-label").textContent = `${deg}°`;
    if (AppState.selectedObj && AppState.selectedType === 'circle') {
        AppState.selectedObj.showVision = true;
        document.getElementById("circle-vision-check").checked = true;
        AppState.selectedObj.visionAngle = deg;
        render();
    }
});

// 1-Click Formation Spawner
const FORMATIONS = {
    "4-3-3": [
        { num: "1", role: "GK", x: 0.08, y: 0.50 },
        { num: "2", role: "RB", x: 0.25, y: 0.84 },
        { num: "4", role: "CB", x: 0.22, y: 0.62 },
        { num: "5", role: "CB", x: 0.22, y: 0.38 },
        { num: "3", role: "LB", x: 0.25, y: 0.16 },
        { num: "6", role: "DM", x: 0.38, y: 0.50 },
        { num: "8", role: "CM", x: 0.50, y: 0.68 },
        { num: "10", role: "CM", x: 0.50, y: 0.32 },
        { num: "7", role: "RW", x: 0.72, y: 0.82 },
        { num: "9", role: "ST", x: 0.76, y: 0.50 },
        { num: "11", role: "LW", x: 0.72, y: 0.18 }
    ],
    "4-2-3-1": [
        { num: "1", role: "GK", x: 0.08, y: 0.50 },
        { num: "2", role: "RB", x: 0.24, y: 0.84 },
        { num: "4", role: "CB", x: 0.21, y: 0.62 },
        { num: "5", role: "CB", x: 0.21, y: 0.38 },
        { num: "3", role: "LB", x: 0.24, y: 0.16 },
        { num: "6", role: "DM", x: 0.38, y: 0.62 },
        { num: "8", role: "DM", x: 0.38, y: 0.38 },
        { num: "7", role: "RAM", x: 0.58, y: 0.80 },
        { num: "10", role: "CAM", x: 0.56, y: 0.50 },
        { num: "11", role: "LAM", x: 0.58, y: 0.20 },
        { num: "9", role: "ST", x: 0.76, y: 0.50 }
    ],
    "3-2-5": [
        { num: "1", role: "GK", x: 0.08, y: 0.50 },
        { num: "2", role: "RCB", x: 0.24, y: 0.76 },
        { num: "4", role: "CCB", x: 0.22, y: 0.50 },
        { num: "5", role: "LCB", x: 0.24, y: 0.24 },
        { num: "6", role: "PIVOT", x: 0.40, y: 0.62 },
        { num: "3", role: "IWB", x: 0.40, y: 0.38 },
        { num: "7", role: "RW", x: 0.70, y: 0.88 },
        { num: "8", role: "RHS", x: 0.64, y: 0.66 },
        { num: "9", role: "ST", x: 0.74, y: 0.50 },
        { num: "10", role: "LHS", x: 0.64, y: 0.34 },
        { num: "11", role: "LW", x: 0.70, y: 0.12 }
    ],
    "4-4-2": [
        { num: "1", role: "GK", x: 0.08, y: 0.50 },
        { num: "2", role: "RB", x: 0.22, y: 0.82 },
        { num: "4", role: "CB", x: 0.20, y: 0.60 },
        { num: "5", role: "CB", x: 0.20, y: 0.40 },
        { num: "3", role: "LB", x: 0.22, y: 0.18 },
        { num: "7", role: "RM", x: 0.42, y: 0.82 },
        { num: "6", role: "CM", x: 0.40, y: 0.60 },
        { num: "8", role: "CM", x: 0.40, y: 0.40 },
        { num: "11", role: "LM", x: 0.42, y: 0.18 },
        { num: "9", role: "ST", x: 0.66, y: 0.60 },
        { num: "10", role: "ST", x: 0.66, y: 0.40 }
    ]
};

document.getElementById("btn-spawn-formation")?.addEventListener("click", () => {
    pushHistorySnapshot();
    const presetKey = document.getElementById("formation-preset")?.value || "4-3-3";
    let teamColor = document.getElementById("circle-color")?.value || "red";
    if (teamColor === "ball") teamColor = "red";
    const textColor = document.getElementById("circle-text-color")?.value || "white";

    const dpr = window.devicePixelRatio || 1;
    const W = canvas.width / dpr;
    const H = canvas.height / dpr;
    const isVert = AppState.pitchType === 'vertical';

    const template = FORMATIONS[presetKey] || FORMATIONS["4-3-3"];
    template.forEach(p => {
        const px = isVert ? (p.y * W) : (p.x * W);
        const py = isVert ? ((1 - p.x) * H) : (p.y * H);
        AppState.circles.push(new Circle(px, py, 20 * responsiveConstant, teamColor, p.num, textColor, p.role));
    });

    updateCounts();
    render();
    setLog(`ĐÃ THẢ ĐỘI HÌNH ${presetKey} (${teamColor.toUpperCase()})`);
});

// Live edit cho Arrow khi đang chọn
["arrow-color", "arrow-type", "arrow-head-type"].forEach(id => {
    document.getElementById(id)?.addEventListener("change", () => {
        if (AppState.selectedObj && AppState.selectedType === 'arrow') {
            AppState.selectedObj.color = document.getElementById("arrow-color").value;
            AppState.selectedObj.type = document.getElementById("arrow-type").value;
            AppState.selectedObj.headType = document.getElementById("arrow-head-type").value;
            AppState.selectedObj.isArrow = AppState.selectedObj.headType !== 'none';
            render();
        }
    });
});

// Live edit cho Polygon (Zone) khi đang chọn
["poly-color", "poly-fill-style"].forEach(id => {
    document.getElementById(id)?.addEventListener("change", () => {
        if (AppState.selectedObj && AppState.selectedType === 'polygon') {
            AppState.selectedObj.color = document.getElementById("poly-color").value;
            AppState.selectedObj.fillStyle = document.getElementById("poly-fill-style").value;
            render();
        }
    });
});

document.getElementById("poly-label-input")?.addEventListener("input", (e) => {
    if (AppState.selectedObj && AppState.selectedType === 'polygon') {
        AppState.selectedObj.label = e.target.value;
        render();
    }
});

// Live edit cho Text Label khi đang chọn
document.getElementById("text-input")?.addEventListener("input", (e) => {
    if (AppState.selectedObj && AppState.selectedType === 'text') {
        AppState.selectedObj.text = e.target.value;
        render();
    }
});

["text-font-size", "text-color-select", "text-bg-style"].forEach(id => {
    document.getElementById(id)?.addEventListener("change", () => {
        if (AppState.selectedObj && AppState.selectedType === 'text') {
            AppState.selectedObj.fontSize = parseInt(document.getElementById("text-font-size").value) || 20;
            AppState.selectedObj.color = document.getElementById("text-color-select").value;
            AppState.selectedObj.bgStyle = document.getElementById("text-bg-style").value;
            render();
        }
    });
});

// --- CÁC NÚT QUẢN LÝ KEYFRAME, SLIDE & TOOLBAR ---
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
        polygons: currentKf.polygons.map(p => p.clone()),
        highlights: (currentKf.highlights || []).map(h => h.clone()),
        highlightLinks: (currentKf.highlightLinks || []).map(l => ({ ...l }))
    };

    slide.keyframes.splice(AppState.currentKfIdx + 1, 0, nextKf);
    AppState.currentKfIdx += 1;
    AppState.selectedObj = null;
    AppState.undoStack = [];
    AppState.redoStack = [];
    syncActiveKeyframeRefs();
    render();
    setLog(`ĐÃ TẠO SA BÀN ${AppState.currentKfIdx + 1} • KÉO CẦU THỦ / HIGHLIGHT TỚI VỊ TRÍ MỚI!`);
});

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

document.getElementById("toggle-ghost-path").addEventListener("change", (e) => {
    AppState.showGhostPath = e.target.checked;
    render();
});

document.getElementById("kf-duration-input").addEventListener("input", (e) => {
    if (!AppState.project) return;
    const val = parseFloat(e.target.value);
    if (!isNaN(val) && val >= 0.5) {
        AppState.project.slides[AppState.currentSlideIdx].stepDuration = val;
        queueAutoSave();
    }
});

document.getElementById("btn-play-anim").addEventListener("click", () => {
    if (AppState.isPlayingAnim) {
        stopAnimationPreview();
        render();
    } else {
        playSlideAnimation();
    }
});

document.getElementById("btn-add-slide").addEventListener("click", async () => {
    if (!AppState.project) return;
    stopAnimationPreview();
    const newIndex = AppState.project.slides.length + 1;
    const slide = createNewSlide(`Slide ${newIndex}: Tình huống mới`, 'horizontal', null);
    AppState.project.slides.push(slide);
    AppState.currentSlideIdx = AppState.project.slides.length - 1;
    AppState.currentKfIdx = 0;
    AppState.selectedObj = null;

    await applySlideBackground(slide);
    syncActiveKeyframeRefs();
    render();
    queueAutoSave();
    setLog(`ĐÃ THÊM TRANG MỚI #${newIndex}`);
});

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

document.getElementById("btn-custom-mode").addEventListener("click", () => {
    document.getElementById("custom-img-input").click();
});

document.getElementById("btn-change-bg-inline").addEventListener("click", () => {
    document.getElementById("custom-img-input").click();
});

const revertBtn = document.getElementById("btn-revert-pitch-inline");
if (revertBtn) {
    revertBtn.addEventListener("click", async () => {
        const curSlide = AppState.project?.slides[AppState.currentSlideIdx];
        if (!curSlide) return;
        curSlide.customBgData = null;
        await applySlideBackground(curSlide);
        render();
        renderSlidesSidebar();
        queueAutoSave();
        setLog(`ĐÃ ĐƯA TRANG #${AppState.currentSlideIdx + 1} VỀ SÂN 2D CHUẨN`);
    });
}

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
            const curSlide = AppState.project.slides[AppState.currentSlideIdx];
            if (curSlide) {
                curSlide.customBgData = imgUrl;
                await applySlideBackground(curSlide);
                render();
                renderSlidesSidebar();
                queueAutoSave();
                setLog(`ĐÃ CẬP NHẬT ẢNH NỀN RIÊNG CHO TRANG #${AppState.currentSlideIdx + 1}`);
            }
        }
        document.getElementById("startup-modal").style.display = "none";
    };
    reader.readAsDataURL(file);
    e.target.value = "";
});

document.getElementById("pitch-type").addEventListener("change", (e) => {
    const newPitch = e.target.value;
    AppState.pitchType = newPitch;
    const curSlide = AppState.project?.slides[AppState.currentSlideIdx];
    if (curSlide) {
        curSlide.pitchType = newPitch;
        curSlide.customBgData = null;
    }
    resizeCanvas(AppState.pitchType);
    render();
    renderSlidesSidebar();
    queueAutoSave();
    setLog(`HƯỚNG SÂN TRANG #${AppState.currentSlideIdx + 1}: ${newPitch.toUpperCase()}`);
});

document.getElementById("pitch-grid-overlay")?.addEventListener("change", (e) => {
    AppState.gridOverlay = e.target.value;
    const curSlide = AppState.project?.slides[AppState.currentSlideIdx];
    if (curSlide) curSlide.gridOverlay = AppState.gridOverlay;
    render();
    queueAutoSave();
    setLog(`LƯỚI CHIẾN THUẬT: ${AppState.gridOverlay.toUpperCase()}`);
});

// --- RECORD VIDEO ANIMATION & BRIDGE SANG MODULE 07 ---
async function recordSlideAnimationBlob(slideIndex) {
    const prevSlideIdx = AppState.currentSlideIdx;
    const prevKfIdx = AppState.currentKfIdx;

    AppState.currentSlideIdx = slideIndex;
    AppState.currentKfIdx = 0;
    AppState.selectedObj = null;

    const targetSlide = AppState.project.slides[slideIndex];
    await applySlideBackground(targetSlide);

    syncActiveKeyframeRefs();
    render();

    const slide = AppState.project.slides[slideIndex];
    const snapshotDataUrl = canvas.toDataURL("image/png");

    if (slide.keyframes.length < 2) {
        await applySlideBackground(AppState.project.slides[prevSlideIdx]);
        AppState.currentSlideIdx = prevSlideIdx;
        AppState.currentKfIdx = prevKfIdx;
        syncActiveKeyframeRefs();
        render();
        return {
            mediaType: 'image',
            dataUrl: snapshotDataUrl,
            videoBlob: null,
            duration: 4.0
        };
    }

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
        recorder.onstop = async () => {
            const blob = new Blob(chunks, { type: mimeType });
            AppState.currentSlideIdx = prevSlideIdx;
            AppState.currentKfIdx = prevKfIdx;
            await applySlideBackground(AppState.project.slides[prevSlideIdx]);
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

document.getElementById("export-video-btn").addEventListener("click", async () => {
    if (!AppState.project) return;
    const slide = AppState.project.slides[AppState.currentSlideIdx];
    if (slide.keyframes.length < 2) {
        alert("Trang hiện tại chỉ có 1 Sa bàn tĩnh. Hãy bấm '+ SA BÀN TIẾP' và kéo cầu thủ/highlight di chuyển để tạo Video Animation, hoặc dùng nút 'XUẤT ẢNH'!");
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

// --- SCALE & THÊM OBJECT ---
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

document.getElementById("circle-btn").addEventListener("click", () => {
    pushHistorySnapshot();
    const color = document.getElementById("circle-color").value;
    const text = document.getElementById("circle-text").value;
    const details = document.getElementById("circle-details-text").value;
    const textColor = document.getElementById("circle-text-color").value || "white";
    const showVision = document.getElementById("circle-vision-check")?.checked || false;
    const visionAngle = parseFloat(document.getElementById("circle-vision-angle")?.value) || 0;

    const dpr = window.devicePixelRatio || 1;
    const cx = (canvas.width / dpr) / 2 + (Math.random() * 24 - 12);
    const cy = (canvas.height / dpr) / 2 + (Math.random() * 24 - 12);

    const newCircle = new Circle(cx, cy, 20 * responsiveConstant, color, text, textColor, details, null, null, null, showVision, visionAngle);
    AppState.circles.push(newCircle);
    AppState.selectedObj = newCircle;
    AppState.selectedType = 'circle';

    updateCounts();
    render();
    setLog(`ADDED TOKEN ${details ? details : (text ? '#' + text : color)}`);
});

document.getElementById("text-btn").addEventListener("click", () => {
    const val = document.getElementById("text-input").value;
    if (!val) return;
    pushHistorySnapshot();
    const fontSize = parseInt(document.getElementById("text-font-size").value) || 20;
    const color = document.getElementById("text-color-select")?.value || "#ffffff";
    const bgStyle = document.getElementById("text-bg-style")?.value || "none";
    const dpr = window.devicePixelRatio || 1;

    const newTxt = new TextObj((canvas.width / dpr) / 2, (canvas.height / dpr) / 2, val, fontSize, 0, null, color, bgStyle);
    AppState.texts.push(newTxt);
    AppState.selectedObj = newTxt;
    AppState.selectedType = 'text';

    updateCounts();
    render();
    setLog(`ADDED TEXT: "${val}"`);
});

document.getElementById("closePolygon").addEventListener("click", () => {
    if (AppState.drawingPolygonPoints.length > 2) {
        pushHistorySnapshot();
        const pColor = document.getElementById("poly-color")?.value || "#ffffff";
        const pFill = document.getElementById("poly-fill-style")?.value || "solid";
        const pLabel = document.getElementById("poly-label-input")?.value || "";

        const newPoly = new Polygon(AppState.drawingPolygonPoints, null, pColor, pFill, pLabel);
        AppState.polygons.push(newPoly);
        AppState.drawingPolygonPoints = [];
        AppState.selectedObj = newPoly;
        AppState.selectedType = 'polygon';

        const zoneCheckbox = document.getElementById("draw-polygon-input");
        if (zoneCheckbox) zoneCheckbox.checked = false;
        updateToggleStatus();
        updateCounts();
        render();
        setLog("TACTICAL ZONE CREATED");
    } else {
        setLog("CẦN ÍT NHẤT 3 ĐIỂM ĐỂ KHÉP VÙNG CHIẾN THUẬT");
    }
});

// Nhân bản nhanh phần tử đang chọn (CLONE / Ctrl+D)
function duplicateSelectedObject() {
    if (!AppState.selectedObj) {
        setLog("CHƯA CHỌN PHẦN TỬ NÀO ĐỂ NHÂN BẢN");
        return;
    }
    pushHistorySnapshot();
    const offset = 22 * responsiveConstant;

    if (AppState.selectedType === 'circle') {
        const c = AppState.selectedObj.clone();
        c.id = 'cir_' + generateId();
        c.x += offset; c.y += offset;
        AppState.circles.push(c);
        AppState.selectedObj = c;
    } else if (AppState.selectedType === 'highlight') {
        const h = AppState.selectedObj.clone();
        h.id = 'hl_' + generateId();
        h.x += offset; h.y += offset;
        AppState.highlights.push(h);
        AppState.selectedObj = h;
    } else if (AppState.selectedType === 'arrow') {
        const a = AppState.selectedObj.clone();
        a.id = 'arr_' + generateId();
        a.fromX += offset; a.fromY += offset;
        a.toX += offset; a.toY += offset;
        a.cx += offset; a.cy += offset;
        AppState.arrows.push(a);
        AppState.selectedObj = a;
    } else if (AppState.selectedType === 'text') {
        const t = AppState.selectedObj.clone();
        t.id = 'txt_' + generateId();
        t.x += offset; t.y += offset;
        AppState.texts.push(t);
        AppState.selectedObj = t;
    } else if (AppState.selectedType === 'polygon') {
        const p = AppState.selectedObj.clone();
        p.id = 'poly_' + generateId();
        p.move(offset, offset);
        AppState.polygons.push(p);
        AppState.selectedObj = p;
    }

    updateCounts();
    render();
    setLog("ĐÃ NHÂN BẢN PHẦN TỬ (CLONE)");
}

function deleteSelectedObject() {
    if (!AppState.selectedObj) {
        setLog("CHƯA CHỌN PHẦN TỬ NÀO ĐỂ XÓA");
        return;
    }
    pushHistorySnapshot();
    const targetId = AppState.selectedObj.id;
    const slide = AppState.project.slides[AppState.currentSlideIdx];
    const kf = slide.keyframes[AppState.currentKfIdx];

    if (AppState.selectedType === 'circle') {
        kf.circles = kf.circles.filter(o => o.id !== targetId);
    } else if (AppState.selectedType === 'arrow') {
        kf.arrows = kf.arrows.filter(o => o.id !== targetId);
    } else if (AppState.selectedType === 'text') {
        kf.texts = kf.texts.filter(o => o.id !== targetId);
    } else if (AppState.selectedType === 'polygon') {
        kf.polygons = kf.polygons.filter(o => o.id !== targetId);
    } else if (AppState.selectedType === 'highlight') {
        kf.highlights = kf.highlights.filter(o => o.id !== targetId);
        kf.highlightLinks = kf.highlightLinks.filter(l => l.fromId !== targetId && l.toId !== targetId);
    } else if (AppState.selectedType === 'highlightLink') {
        kf.highlightLinks = kf.highlightLinks.filter(l => l.id !== targetId);
    }

    AppState.selectedObj = null;
    AppState.linkSourceHighlight = null;
    syncActiveKeyframeRefs();
    render();
    setLog("ĐÃ XÓA PHẦN TỬ");
}

document.getElementById("undo-btn")?.addEventListener("click", performUndo);
document.getElementById("redo-btn")?.addEventListener("click", performRedo);
document.getElementById("dup-btn")?.addEventListener("click", duplicateSelectedObject);
document.getElementById("delete-btn")?.addEventListener("click", deleteSelectedObject);

document.getElementById("reset-btn").addEventListener("click", () => {
    if (confirm("Xóa toàn bộ phần tử trên nhịp sa bàn hiện tại?")) {
        pushHistorySnapshot();
        const kf = AppState.project.slides[AppState.currentSlideIdx].keyframes[AppState.currentKfIdx];
        kf.circles = [];
        kf.arrows = [];
        kf.texts = [];
        kf.polygons = [];
        kf.highlights = [];
        kf.highlightLinks = [];
        AppState.selectedObj = null;
        AppState.linkSourceHighlight = null;
        syncActiveKeyframeRefs();
        render();
        setLog("ĐÃ LÀM MỚI SA BÀN HIỆN TẠI");
    }
});

document.getElementById("export-btn").addEventListener("click", () => {
    AppState.selectedObj = null;
    AppState.linkSourceHighlight = null;
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
    const hlCnt = document.querySelector(".highlight-count");
    if (circleCnt) circleCnt.innerText = AppState.circles.length;
    if (arrowCnt) arrowCnt.innerText = AppState.arrows.length;
    if (textCnt) textCnt.innerText = AppState.texts.length;
    if (polyCnt) polyCnt.innerText = AppState.polygons.length;
    if (hlCnt) hlCnt.innerText = AppState.highlights.length;
}

function setExclusiveToolMode(activeCheckboxId) {
    const ids = ["draw-arrow-input", "draw-polygon-input", "draw-highlight-input", "link-highlight-input"];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el && id !== activeCheckboxId) el.checked = false;
    });
    updateToggleStatus();
}

function updateToggleStatus() {
    const arrowChecked = document.getElementById("draw-arrow-input")?.checked;
    const zoneChecked = document.getElementById("draw-polygon-input")?.checked;
    const hlChecked = document.getElementById("draw-highlight-input")?.checked;
    const linkChecked = document.getElementById("link-highlight-input")?.checked;

    const arrowPill = document.getElementById("arrow-status-pill");
    const zonePill = document.getElementById("zone-status-pill");
    const hlPill = document.getElementById("highlight-status-pill");
    const linkPill = document.getElementById("link-status-pill");

    if (arrowPill) arrowPill.textContent = arrowChecked ? "ON" : "OFF";
    if (zonePill) zonePill.textContent = zoneChecked ? "ON" : "OFF";
    if (hlPill) hlPill.textContent = hlChecked ? "ON" : "OFF";
    if (linkPill) linkPill.textContent = linkChecked ? "ON" : "OFF";
}

document.getElementById("draw-arrow-input")?.addEventListener("change", (e) => {
    if (e.target.checked) setExclusiveToolMode("draw-arrow-input");
    else updateToggleStatus();
    AppState.selectedObj = null;
    AppState.linkSourceHighlight = null;
    render();
    setLog(e.target.checked ? "MODE: DRAW ARROW • NHẤN & KÉO TRÊN SÂN" : "MODE: SELECT & DRAG");
});

document.getElementById("draw-polygon-input")?.addEventListener("change", (e) => {
    if (e.target.checked) setExclusiveToolMode("draw-polygon-input");
    else updateToggleStatus();
    AppState.selectedObj = null;
    AppState.linkSourceHighlight = null;
    render();
    setLog(e.target.checked ? "MODE: DRAW ZONE • CHẤM CÁC ĐIỂM TRÊN SÂN" : "MODE: SELECT & DRAG");
});

document.getElementById("draw-highlight-input")?.addEventListener("change", (e) => {
    if (e.target.checked) setExclusiveToolMode("draw-highlight-input");
    else updateToggleStatus();
    AppState.linkSourceHighlight = null;
    AppState.lastPlacedHighlight = null;
    render();
    setLog(e.target.checked ? "MODE: HIGHLIGHT • CLICK LÊN SÂN ĐỂ ĐẶT VÒNG HIGHLIGHT" : "MODE: SELECT & DRAG");
});

document.getElementById("link-highlight-input")?.addEventListener("change", (e) => {
    if (e.target.checked) setExclusiveToolMode("link-highlight-input");
    else updateToggleStatus();
    AppState.linkSourceHighlight = null;
    render();
    setLog(e.target.checked ? "MODE: LINK/UNLINK • CLICK 2 VÒNG HIGHLIGHT ĐỂ NỐI HOẶC NGẮT DÂY" : "MODE: SELECT & DRAG");
});

// Shift + Lăn chuột: Xoay chữ HOẶC xoay hướng nhìn (Vision Cone) của Cầu thủ
window.addEventListener("wheel", (e) => {
    if (!e.shiftKey || !AppState.selectedObj) return;
    if (AppState.selectedType === 'text') {
        AppState.selectedObj.rotate += (e.deltaY > 0 ? 5 : -5);
        setLog(`XOAY CHỮ: ${AppState.selectedObj.rotate}°`);
        render();
    } else if (AppState.selectedType === 'circle' && AppState.selectedObj.color !== 'ball') {
        AppState.selectedObj.showVision = true;
        AppState.selectedObj.visionAngle = ((AppState.selectedObj.visionAngle || 0) + (e.deltaY > 0 ? 10 : -10));
        syncCircleControlsFromSelection(AppState.selectedObj);
        setLog(`XOAY HƯỚNG NHÌN CẦU THỦ: ${AppState.selectedObj.visionAngle}°`);
        render();
    }
});

// Phím tắt bàn phím chuyên nghiệp (Ctrl+Z, Ctrl+Y, Ctrl+D, Delete, Esc)
window.addEventListener("keydown", (e) => {
    const tag = document.activeElement?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        performUndo();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        performRedo();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        duplicateSelectedObject();
    } else if (e.key === "Delete" || e.key === "Backspace") {
        if (AppState.selectedObj) {
            e.preventDefault();
            deleteSelectedObject();
        }
    } else if (e.key === "Escape") {
        setExclusiveToolMode(null);
        AppState.selectedObj = null;
        AppState.linkSourceHighlight = null;
        AppState.drawingPolygonPoints = [];
        render();
        setLog("ĐÃ BỎ CHỌN & VỀ CHẾ ĐỘ CON TRỎ CHUỘT");
    }
});

// Đóng / Mở cột Slide Deck bên trái để mở rộng diện tích mặt sân
    const toggleSlidesDeck = () => {
        const appContainer = document.querySelector(".app-container");
        if (!appContainer) return;
        const isCollapsed = appContainer.classList.toggle("slides-collapsed");
        const toggleBtn = document.getElementById("btn-toggle-slides");
        if (toggleBtn) {
            toggleBtn.style.background = isCollapsed ? "var(--neo-green)" : "var(--neo-yellow)";
        }
        // Tự động phóng to mặt sân ra phần diện tích vừa giải phóng
        setTimeout(() => {
            resizeCanvas(AppState.pitchType);
            render();
        }, 30);
        setLog(isCollapsed ? "ĐÃ THU GỌN SLIDE DECK • MỞ RỘNG MẶT SÂN" : "ĐÃ MỞ SLIDE DECK");
    };

    document.getElementById("btn-toggle-slides")?.addEventListener("click", toggleSlidesDeck);
    document.getElementById("btn-collapse-slides")?.addEventListener("click", toggleSlidesDeck);

window.addEventListener("resize", () => {
    resizeCanvas(AppState.pitchType);
    render();
});

init();