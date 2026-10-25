// js/video/video.js
import { GLDatabase } from '../shared/gl-db.js';
import { generateId } from '../board/utils.js';

const canvas = document.getElementById("video-canvas");
const ctx = canvas.getContext("2d");

const VideoState = {
    project: null,          // { id, name, width, height, watermark, audioBlob, audioName, audioVolume, frames: [] }
    selectedFrameIdx: 0,

    // Cache các phần tử HTMLImageElement và HTMLVideoElement đã nạp vào RAM để vẽ thời gian thực
    mediaCache: new Map(),  // frame.id -> { type: 'image'|'video', el: Image|HTMLVideoElement }

    // Audio Preview & Recording
    audioEl: null,
    isPlaying: false,
    playStartTime: 0,
    playOffsetSec: 0,
    currentTimeSec: 0,
    animFrameId: null
};

function setStatus(text) {
    const el = document.getElementById("vid-status-log");
    if (el) el.textContent = text.toUpperCase();
}

function createDefaultFrame(title = "GOAL-LINE PRESENTATION", subtitle = "Phân tích chiến thuật & dữ liệu bóng đá chuyên sâu") {
    return {
        id: 'frame_' + generateId(),
        title: title,
        subtitle: subtitle,
        mediaType: 'title-card', // 'image' | 'video' | 'title-card'
        imageDataUrl: null,
        videoBlob: null,
        duration: 4.0,
        transition: 'fade',
        motion: 'kenburns-in',
        fitMode: 'contain',
        textPos: 'bottom',
        textSize: 1.0,
        boxStyle: 'neo-dark'
    };
}

function createNewVideoProject(name = "Video Chiến Thuật #01") {
    return {
        id: 'vproj_' + generateId(),
        name: name,
        width: 1920,
        height: 1080,
        watermark: true,
        audioBlob: null,
        audioName: "",
        audioVolume: 0.6,
        updatedAt: Date.now(),
        frames: [createDefaultFrame()]
    };
}

let saveTimeout = null;
function queueSaveVideoProject() {
    if (!VideoState.project) return;
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
        try {
            await GLDatabase.saveVideoProject(VideoState.project);
            localStorage.setItem('gl_last_video_project_id', VideoState.project.id);
        } catch (e) {
            console.warn("Save video project error:", e);
        }
    }, 300);
}

// --- NẠP MEDIA VÀO BỘ NHỚ ĐỆM (CACHE) ĐỂ VẼ CANVAS ---
async function prepareFrameMedia(frame) {
    if (VideoState.mediaCache.has(frame.id)) {
        return VideoState.mediaCache.get(frame.id);
    }

    if (frame.mediaType === 'video' && frame.videoBlob) {
        return new Promise((resolve) => {
            const vid = document.createElement("video");
            vid.muted = true;
            vid.playsInline = true;
            vid.loop = true;
            vid.src = URL.createObjectURL(frame.videoBlob);
            vid.onloadeddata = () => {
                const entry = { type: 'video', el: vid };
                VideoState.mediaCache.set(frame.id, entry);
                resolve(entry);
            };
            vid.onerror = () => resolve(null);
        });
    }

    if (frame.imageDataUrl) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const entry = { type: 'image', el: img };
                VideoState.mediaCache.set(frame.id, entry);
                resolve(entry);
            };
            img.onerror = () => resolve(null);
            img.src = frame.imageDataUrl;
        });
    }

    return null;
}

async function preloadAllProjectMedia() {
    if (!VideoState.project) return;
    for (const f of VideoState.project.frames) {
        await prepareFrameMedia(f);
    }
    if (VideoState.project.audioBlob) {
        setupAudioElement(VideoState.project.audioBlob, VideoState.project.audioName, VideoState.project.audioVolume);
    } else {
        clearAudioElement();
    }
}

function setupAudioElement(blob, name, volume = 0.6) {
    if (VideoState.audioEl) {
        VideoState.audioEl.pause();
    }
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.loop = true;
    audio.volume = volume;
    VideoState.audioEl = audio;

    const infoBox = document.getElementById("audio-info-box");
    const nameEl = document.getElementById("audio-filename");
    const volSlider = document.getElementById("audio-volume");
    const volLabel = document.getElementById("audio-vol-label");

    if (infoBox) infoBox.style.display = "block";
    if (nameEl) nameEl.textContent = name || "background_audio.mp3";
    if (volSlider) volSlider.value = volume;
    if (volLabel) volLabel.textContent = `${Math.round(volume * 100)}%`;
}

function clearAudioElement() {
    if (VideoState.audioEl) {
        VideoState.audioEl.pause();
        VideoState.audioEl = null;
    }
    const infoBox = document.getElementById("audio-info-box");
    if (infoBox) infoBox.style.display = "none";
}

// --- KHỞI ĐỘNG MODULE 07 & NHẬN DỮ LIỆU TỪ TACTICAL BOARD ---
async function initVideoStudio() {
    // 1. Kiểm tra xem có gói dữ liệu vừa được đẩy sang từ Tactical Board không
    const bridgeData = await GLDatabase.consumeVideoBridge();
    if (bridgeData && bridgeData.frames && bridgeData.frames.length > 0) {
        const importedProj = createNewVideoProject(`${bridgeData.projectName} (Video)`);
        importedProj.frames = bridgeData.frames.map(f => ({
            ...createDefaultFrame(f.title, f.subtitle),
            ...f
        }));
        await GLDatabase.saveVideoProject(importedProj);
        await loadVideoProject(importedProj);
        setStatus(`ĐÃ NHẬP ${importedProj.frames.length} FRAME TỪ TACTICAL BOARD!`);
        return;
    }

    // 2. Nếu không có Bridge, mở dự án Video gần nhất
    const allProjs = await GLDatabase.getAllVideoProjects();
    const lastId = localStorage.getItem('gl_last_video_project_id');
    const found = allProjs.find(p => p.id === lastId) || allProjs[0];

    if (found) {
        await loadVideoProject(found);
    } else {
        const fresh = createNewVideoProject("Video Chiến thuật #01");
        await GLDatabase.saveVideoProject(fresh);
        await loadVideoProject(fresh);
    }
}

async function loadVideoProject(proj) {
    stopMasterPlayback();
    VideoState.project = proj;
    VideoState.selectedFrameIdx = 0;
    VideoState.currentTimeSec = 0;
    VideoState.mediaCache.clear();

    // Đồng bộ kích thước Canvas
    canvas.width = proj.width || 1920;
    canvas.height = proj.height || 1080;

    const projLabel = document.getElementById("vid-active-proj-name");
    if (projLabel) projLabel.textContent = `PROJECT: ${proj.name.toUpperCase()}`;

    const wmCheck = document.getElementById("toggle-watermark");
    if (wmCheck) wmCheck.checked = proj.watermark !== false;

    syncAspectUI();
    await preloadAllProjectMedia();
    renderTimeline();
    syncInspectorUI();
    renderAtTime(0);
    updateTimecodeUI();
}

function syncAspectUI() {
    if (!VideoState.project) return;
    const key = `${VideoState.project.width}x${VideoState.project.height}`;
    const select = document.getElementById("aspect-preset");
    const customRow = document.getElementById("custom-res-row");
    const wInput = document.getElementById("custom-width");
    const hInput = document.getElementById("custom-height");

    if (wInput) wInput.value = VideoState.project.width;
    if (hInput) hInput.value = VideoState.project.height;

    const presets = ["1920x1080", "1080x1920", "1080x1080", "1080x1350"];
    if (presets.includes(key)) {
        select.value = key;
        customRow.style.display = "none";
    } else {
        select.value = "custom";
        customRow.style.display = "flex";
    }
}

// --- TÍNH TOÁN THỜI LƯỢNG TIMELINE ---
function getTotalDuration() {
    if (!VideoState.project || !VideoState.project.frames.length) return 0;
    return VideoState.project.frames.reduce((acc, f) => acc + (parseFloat(f.duration) || 4.0), 0);
}

function getFrameAtTime(sec) {
    const frames = VideoState.project?.frames || [];
    if (frames.length === 0) return null;

    let acc = 0;
    for (let i = 0; i < frames.length; i++) {
        const dur = parseFloat(frames[i].duration) || 4.0;
        if (sec <= acc + dur || i === frames.length - 1) {
            const localSec = Math.max(0, Math.min(dur, sec - acc));
            return {
                index: i,
                frame: frames[i],
                prevFrame: i > 0 ? frames[i - 1] : null,
                localSec,
                progress: dur > 0 ? localSec / dur : 1
            };
        }
        acc += dur;
    }
    return null;
}

function getStartTimeOfFrame(index) {
    const frames = VideoState.project?.frames || [];
    let sum = 0;
    for (let i = 0; i < index && i < frames.length; i++) {
        sum += parseFloat(frames[i].duration) || 4.0;
    }
    return sum;
}

// --- ENGINE VẼ FRAME, CHUYỂN CẢNH, KEN BURNS & SUBTITLE LÊN CANVAS ---
function drawSingleFrameContent(frame, localSec, progress) {
    const W = canvas.width;
    const H = canvas.height;
    const entry = VideoState.mediaCache.get(frame.id);

    ctx.save();
    // Nền mặc định tối
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, W, H);

    if (entry && entry.el) {
        const srcW = entry.type === 'video' ? (entry.el.videoWidth || 1280) : entry.el.naturalWidth;
        const srcH = entry.type === 'video' ? (entry.el.videoHeight || 720) : entry.el.naturalHeight;

        // Nếu là Video clip, đồng bộ thời gian phát của thẻ <video>
        if (entry.type === 'video') {
            const vidDur = entry.el.duration || 5;
            const targetTime = localSec % vidDur;
            if (!VideoState.isPlaying && Math.abs(entry.el.currentTime - targetTime) > 0.15) {
                entry.el.currentTime = targetTime;
            }
        }

        // Nếu ở chế độ Contain, vẽ lớp nền phóng to làm mờ (Blurred Backdrop) phía sau cho đẹp mắt
        if (frame.fitMode === 'contain') {
            ctx.save();
            ctx.filter = "blur(28px) brightness(0.45)";
            const bgScale = Math.max(W / srcW, H / srcH) * 1.1;
            const bgW = srcW * bgScale;
            const bgH = srcH * bgScale;
            ctx.drawImage(entry.el, (W - bgW) / 2, (H - bgH) / 2, bgW, bgH);
            ctx.restore();
        }

        // Tính toán hiệu ứng Zoom nhẹ Ken Burns
        let zoom = 1.0;
        if (frame.motion === 'kenburns-in') {
            zoom = 1.0 + 0.08 * progress;
        } else if (frame.motion === 'kenburns-out') {
            zoom = 1.08 - 0.08 * progress;
        }

        const baseScale = frame.fitMode === 'cover'
            ? Math.max(W / srcW, H / srcH)
            : Math.min(W / srcW, H / srcH) * 0.94;

        const drawW = srcW * baseScale * zoom;
        const drawH = srcH * baseScale * zoom;
        const drawX = (W - drawW) / 2;
        const drawY = (H - drawH) / 2;

        // Đổ bóng khung ảnh nếu ở chế độ contain
        if (frame.fitMode === 'contain') {
            ctx.fillStyle = "#000000";
            ctx.fillRect(drawX + 10, drawY + 10, drawW, drawH);
            ctx.strokeStyle = "#000000";
            ctx.lineWidth = 6;
            ctx.strokeRect(drawX, drawY, drawW, drawH);
        }

        ctx.drawImage(entry.el, drawX, drawY, drawW, drawH);
    } else {
        // Slide Tiêu đề (Title Card) họa tiết lưới chiến thuật Goal-Line
        ctx.fillStyle = "#121318";
        ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = "rgba(255, 230, 0, 0.12)";
        ctx.lineWidth = 2;
        const step = Math.round(W / 24);
        for (let x = 0; x < W; x += step) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
        }
        for (let y = 0; y < H; y += step) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
        }
    }

    // Vẽ Hộp Tiêu đề & Phụ đề (Subtitles)
    drawFrameTypography(frame, W, H);

    // Vẽ Watermark Goal-Line Studio ở góc trên phải
    if (VideoState.project?.watermark !== false) {
        drawStudioWatermark(W, H);
    }

    ctx.restore();
}

function drawFrameTypography(frame, W, H) {
    const hasTitle = frame.title && frame.title.trim().length > 0;
    const hasSub = frame.subtitle && frame.subtitle.trim().length > 0;
    if (!hasTitle && !hasSub) return;

    const scaleFactor = (Math.min(W, H) / 1080) * (parseFloat(frame.textSize) || 1.0);
    const titleSize = Math.round(44 * scaleFactor);
    const subSize = Math.round(28 * scaleFactor);
    const padX = Math.round(36 * scaleFactor);
    const padY = Math.round(22 * scaleFactor);
    const maxBoxW = Math.round(W * 0.86);

    ctx.save();
    const subLines = hasSub ? wrapTextLines(ctx, frame.subtitle.trim(), `700 ${subSize}px "Space Grotesk", sans-serif`, maxBoxW - padX * 2) : [];

    const titleH = hasTitle ? titleSize * 1.25 : 0;
    const subH = subLines.length * (subSize * 1.38);
    const gapH = (hasTitle && subLines.length > 0) ? Math.round(10 * scaleFactor) : 0;
    const boxH = padY * 2 + titleH + gapH + subH;
    const boxW = maxBoxW;
    const boxX = Math.round((W - boxW) / 2);

    let boxY = H - boxH - Math.round(H * 0.06);
    if (frame.textPos === 'top') boxY = Math.round(H * 0.06);
    else if (frame.textPos === 'center') boxY = Math.round((H - boxH) / 2);

    // Style nền hộp chữ
    if (frame.boxStyle === 'neo-yellow') {
        ctx.fillStyle = "#000000";
        ctx.fillRect(boxX + 8, boxY + 8, boxW, boxH);
        ctx.fillStyle = "#ffe600";
        ctx.fillRect(boxX, boxY, boxW, boxH);
        ctx.lineWidth = 4;
        ctx.strokeStyle = "#000000";
        ctx.strokeRect(boxX, boxY, boxW, boxH);
    } else if (frame.boxStyle === 'clean-sub') {
        ctx.fillStyle = "rgba(0, 0, 0, 0.68)";
        ctx.fillRect(boxX, boxY, boxW, boxH);
    } else {
        // Mặc định: neo-dark
        ctx.fillStyle = "#ffe600";
        ctx.fillRect(boxX + 8, boxY + 8, boxW, boxH);
        ctx.fillStyle = "rgba(16, 17, 20, 0.94)";
        ctx.fillRect(boxX, boxY, boxW, boxH);
        ctx.lineWidth = 4;
        ctx.strokeStyle = "#ffe600";
        ctx.strokeRect(boxX, boxY, boxW, boxH);
    }

    let curY = boxY + padY;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    if (hasTitle) {
        ctx.font = `900 ${titleSize}px "Barlow Condensed", sans-serif`;
        ctx.fillStyle = frame.boxStyle === 'neo-yellow' ? "#000000" : "#ffe600";
        ctx.fillText(frame.title.toUpperCase(), W / 2, curY);
        curY += titleH + gapH;
    }

    if (subLines.length > 0) {
        ctx.font = `700 ${subSize}px "Space Grotesk", sans-serif`;
        ctx.fillStyle = frame.boxStyle === 'neo-yellow' ? "#111111" : "#ffffff";
        subLines.forEach(line => {
            ctx.fillText(line, W / 2, curY);
            curY += subSize * 1.38;
        });
    }

    ctx.restore();
}

function drawStudioWatermark(W, H) {
    const scale = Math.min(W, H) / 1080;
    const pad = Math.round(28 * scale);
    const boxH = Math.round(44 * scale);
    const boxW = Math.round(230 * scale);
    const x = W - boxW - pad;
    const y = pad;

    ctx.save();
    ctx.fillStyle = "#000000";
    ctx.fillRect(x + 4, y + 4, boxW, boxH);
    ctx.fillStyle = "#ffe600";
    ctx.fillRect(x, y, boxW, boxH);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#000000";
    ctx.strokeRect(x, y, boxW, boxH);

    ctx.font = `900 ${Math.round(22 * scale)}px "Barlow Condensed", sans-serif`;
    ctx.fillStyle = "#000000";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("GOAL-LINE STUDIO", x + boxW / 2, y + boxH / 2 + 1);
    ctx.restore();
}

function wrapTextLines(context, text, font, maxWidth) {
    context.font = font;
    const words = text.split(/\s+/);
    const lines = [];
    let current = "";

    for (let i = 0; i < words.length; i++) {
        const testLine = current ? `${current} ${words[i]}` : words[i];
        if (context.measureText(testLine).width > maxWidth && current) {
            lines.push(current);
            current = words[i];
        } else {
            current = testLine;
        }
    }
    if (current) lines.push(current);
    return lines;
}

/**
 * Render toàn bộ khung hình tại mốc thời gian `sec` (bao gồm hiệu ứng chuyển cảnh giữa 2 frame)
 */
function renderAtTime(sec) {
    const info = getFrameAtTime(sec);
    if (!info) {
        ctx.fillStyle = "#0f172a";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        return;
    }

    const { frame, prevFrame, localSec, progress } = info;
    const transDur = Math.min(0.45, (parseFloat(frame.duration) || 4) * 0.25);

    // Kiểm tra xem có đang trong vùng chuyển cảnh (Transition) từ prevFrame sang frame hiện tại không
    if (prevFrame && frame.transition !== 'none' && localSec < transDur) {
        const t = localSec / transDur; // 0 -> 1
        const W = canvas.width;
        const H = canvas.height;

        if (frame.transition === 'fade') {
            drawSingleFrameContent(prevFrame, parseFloat(prevFrame.duration) || 4, 1.0);
            ctx.save();
            ctx.globalAlpha = t;
            drawSingleFrameContent(frame, localSec, progress);
            ctx.restore();
            return;
        } else if (frame.transition === 'slide') {
            ctx.save();
            ctx.translate(-W * t, 0);
            drawSingleFrameContent(prevFrame, parseFloat(prevFrame.duration) || 4, 1.0);
            ctx.restore();

            ctx.save();
            ctx.translate(W * (1 - t), 0);
            drawSingleFrameContent(frame, localSec, progress);
            ctx.restore();
            return;
        } else if (frame.transition === 'wipe') {
            drawSingleFrameContent(prevFrame, parseFloat(prevFrame.duration) || 4, 1.0);
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, 0, W * t, H);
            ctx.clip();
            drawSingleFrameContent(frame, localSec, progress);
            ctx.restore();

            // Thanh quét màu vàng phong cách truyền hình bóng đá
            ctx.fillStyle = "#ffe600";
            ctx.fillRect(W * t - 4, 0, 8, H);
            return;
        }
    }

    drawSingleFrameContent(frame, localSec, progress);
}

// --- ĐIỀU KHIỂN PLAYBACK & TIMELINE UI ---
function formatTimecode(sec) {
    const m = Math.floor(sec / 60);
    const s = (sec % 60).toFixed(1);
    return `${String(m).padStart(2, '0')}:${s.padStart(4, '0')}`;
}

function updateTimecodeUI() {
    const total = getTotalDuration();
    const curEl = document.getElementById("current-timecode");
    const totEl = document.getElementById("total-timecode");
    const scrubber = document.getElementById("master-scrubber");

    if (curEl) curEl.textContent = formatTimecode(VideoState.currentTimeSec);
    if (totEl) totEl.textContent = formatTimecode(total);
    if (scrubber) {
        scrubber.max = Math.max(0.1, total);
        scrubber.value = VideoState.currentTimeSec;
    }
}

function startMasterPlayback(fromStart = false, onEndedCallback = null) {
    const total = getTotalDuration();
    if (total <= 0) return;

    stopMasterPlayback();
    if (fromStart || VideoState.currentTimeSec >= total - 0.05) {
        VideoState.currentTimeSec = 0;
    }

    VideoState.isPlaying = true;
    VideoState.playOffsetSec = VideoState.currentTimeSec;
    VideoState.playStartTime = performance.now();

    // Kích hoạt các thẻ <video> trong cache
    VideoState.mediaCache.forEach(entry => {
        if (entry.type === 'video') {
            entry.el.currentTime = 0;
            entry.el.play().catch(() => {});
        }
    });

    // Kích hoạt nhạc nền
    if (VideoState.audioEl) {
        VideoState.audioEl.currentTime = VideoState.currentTimeSec % (VideoState.audioEl.duration || 100);
        VideoState.audioEl.play().catch(() => {});
    }

    const playBtn = document.getElementById("btn-play-master");
    if (playBtn) {
        playBtn.innerHTML = `<i class="fa-solid fa-pause"></i> PAUSE`;
        playBtn.classList.remove("btn-action-green");
        playBtn.classList.add("btn-action-pink");
    }

    function loop(now) {
        if (!VideoState.isPlaying) return;
        const elapsed = (now - VideoState.playStartTime) / 1000;
        VideoState.currentTimeSec = VideoState.playOffsetSec + elapsed;

        if (VideoState.currentTimeSec >= total) {
            VideoState.currentTimeSec = total;
            renderAtTime(total);
            updateTimecodeUI();
            stopMasterPlayback();
            if (onEndedCallback) onEndedCallback();
            return;
        }

        const activeInfo = getFrameAtTime(VideoState.currentTimeSec);
        if (activeInfo && activeInfo.index !== VideoState.selectedFrameIdx) {
            VideoState.selectedFrameIdx = activeInfo.index;
            highlightActiveTimelineCard();
            syncInspectorUI();
        }

        renderAtTime(VideoState.currentTimeSec);
        updateTimecodeUI();
        VideoState.animFrameId = requestAnimationFrame(loop);
    }

    setStatus("PLAYING MASTER TIMELINE");
    VideoState.animFrameId = requestAnimationFrame(loop);
}

function stopMasterPlayback() {
    if (VideoState.animFrameId) {
        cancelAnimationFrame(VideoState.animFrameId);
        VideoState.animFrameId = null;
    }
    VideoState.isPlaying = false;

    VideoState.mediaCache.forEach(entry => {
        if (entry.type === 'video') entry.el.pause();
    });
    if (VideoState.audioEl) VideoState.audioEl.pause();

    const playBtn = document.getElementById("btn-play-master");
    if (playBtn) {
        playBtn.innerHTML = `<i class="fa-solid fa-play"></i> PLAY PREVIEW`;
        playBtn.classList.remove("btn-action-pink");
        playBtn.classList.add("btn-action-green");
    }
    setStatus("READY");
}

// --- RENDER THANH TIMELINE SEQUENCER ---
function renderTimeline() {
    const track = document.getElementById("timeline-track");
    const countEl = document.getElementById("timeline-count");
    if (!track || !VideoState.project) return;

    const frames = VideoState.project.frames;
    if (countEl) countEl.textContent = frames.length;
    track.innerHTML = "";

    frames.forEach((f, idx) => {
        const card = document.createElement("div");
        card.className = `timeline-frame-card ${idx === VideoState.selectedFrameIdx ? 'active' : ''}`;
        card.dataset.idx = idx;

        const thumbHtml = f.imageDataUrl
            ? `<img src="${f.imageDataUrl}" alt="thumb" />`
            : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#ffe600;font-family:var(--font-cond);font-weight:900;font-size:0.9rem;">TITLE SLIDE</div>`;

        const typeIcon = f.mediaType === 'video' ? '🎬' : (f.mediaType === 'image' ? '🖼️' : '🔤');

        card.innerHTML = `
            <div class="tf-thumb">
                ${thumbHtml}
                <span class="tf-badge-index">${typeIcon} #${idx + 1}</span>
                <span class="tf-badge-duration">${parseFloat(f.duration).toFixed(1)}s</span>
            </div>
            <div class="tf-meta">
                <span class="tf-title">${f.title || `Frame ${idx + 1}`}</span>
                <div class="tf-actions">
                    <button class="btn-tf-left" title="Dịch sang trái" ${idx === 0 ? 'disabled' : ''}>◀</button>
                    <button class="btn-tf-right" title="Dịch sang phải" ${idx === frames.length - 1 ? 'disabled' : ''}>▶</button>
                    <button class="btn-tf-dup" title="Nhân bản">⧉</button>
                    <button class="btn-tf-del" title="Xóa frame">✕</button>
                </div>
            </div>
        `;

        card.addEventListener("click", (e) => {
            if (e.target.closest("button")) return;
            stopMasterPlayback();
            VideoState.selectedFrameIdx = idx;
            VideoState.currentTimeSec = getStartTimeOfFrame(idx) + 0.05;
            highlightActiveTimelineCard();
            syncInspectorUI();
            renderAtTime(VideoState.currentTimeSec);
            updateTimecodeUI();
        });

        card.querySelector(".btn-tf-left").addEventListener("click", () => {
            if (idx === 0) return;
            const tmp = frames[idx - 1];
            frames[idx - 1] = frames[idx];
            frames[idx] = tmp;
            VideoState.selectedFrameIdx = idx - 1;
            renderTimeline();
            queueSaveVideoProject();
        });

        card.querySelector(".btn-tf-right").addEventListener("click", () => {
            if (idx >= frames.length - 1) return;
            const tmp = frames[idx + 1];
            frames[idx + 1] = frames[idx];
            frames[idx] = tmp;
            VideoState.selectedFrameIdx = idx + 1;
            renderTimeline();
            queueSaveVideoProject();
        });

        card.querySelector(".btn-tf-dup").addEventListener("click", async () => {
            const copy = {
                ...f,
                id: 'frame_' + generateId(),
                title: `${f.title || 'Frame'} (Copy)`
            };
            frames.splice(idx + 1, 0, copy);
            await prepareFrameMedia(copy);
            VideoState.selectedFrameIdx = idx + 1;
            renderTimeline();
            syncInspectorUI();
            updateTimecodeUI();
            queueSaveVideoProject();
        });

        card.querySelector(".btn-tf-del").addEventListener("click", () => {
            if (frames.length <= 1) {
                alert("Timeline cần giữ ít nhất 1 Frame!");
                return;
            }
            frames.splice(idx, 1);
            if (VideoState.selectedFrameIdx >= frames.length) {
                VideoState.selectedFrameIdx = frames.length - 1;
            }
            renderTimeline();
            syncInspectorUI();
            VideoState.currentTimeSec = getStartTimeOfFrame(VideoState.selectedFrameIdx);
            renderAtTime(VideoState.currentTimeSec);
            updateTimecodeUI();
            queueSaveVideoProject();
        });

        track.appendChild(card);
    });
}

function highlightActiveTimelineCard() {
    document.querySelectorAll(".timeline-frame-card").forEach((el, i) => {
        el.classList.toggle("active", i === VideoState.selectedFrameIdx);
    });
}

// --- ĐỒNG BỘ CỘT INSPECTOR BÊN PHẢI ---
function syncInspectorUI() {
    const frames = VideoState.project?.frames || [];
    const emptyEl = document.getElementById("inspector-empty");
    const ctrlEl = document.getElementById("inspector-controls");
    const badgeEl = document.getElementById("inspector-frame-badge");

    if (frames.length === 0) {
        emptyEl.style.display = "block";
        ctrlEl.style.display = "none";
        return;
    }

    emptyEl.style.display = "none";
    ctrlEl.style.display = "block";

    const f = frames[VideoState.selectedFrameIdx] || frames[0];
    if (badgeEl) badgeEl.textContent = `FRAME #${VideoState.selectedFrameIdx + 1}`;

    document.getElementById("frame-duration-range").value = f.duration || 4;
    document.getElementById("frame-duration-num").value = f.duration || 4;
    document.getElementById("frame-transition").value = f.transition || 'fade';
    document.getElementById("frame-motion").value = f.motion || 'none';
    document.getElementById("frame-fit").value = f.fitMode || 'contain';
    document.getElementById("frame-title-input").value = f.title || "";
    document.getElementById("frame-sub-input").value = f.subtitle || "";
    document.getElementById("frame-text-pos").value = f.textPos || 'bottom';
    document.getElementById("frame-text-size").value = String(f.textSize || "1.0");
    document.getElementById("frame-box-style").value = f.boxStyle || 'neo-dark';
}

function getCurrentSelectedFrame() {
    if (!VideoState.project) return null;
    return VideoState.project.frames[VideoState.selectedFrameIdx] || null;
}

// Gắn sự kiện chỉnh sửa Inspector
const durRange = document.getElementById("frame-duration-range");
const durNum = document.getElementById("frame-duration-num");

function updateSelectedFrameDuration(val) {
    const f = getCurrentSelectedFrame();
    if (!f) return;
    const num = Math.max(0.5, Math.min(60, parseFloat(val) || 4));
    f.duration = num;
    durRange.value = Math.min(20, num);
    durNum.value = num;
    renderTimeline();
    updateTimecodeUI();
    queueSaveVideoProject();
}

durRange.addEventListener("input", (e) => updateSelectedFrameDuration(e.target.value));
durNum.addEventListener("input", (e) => updateSelectedFrameDuration(e.target.value));

document.getElementById("btn-apply-duration-all").addEventListener("click", () => {
    const f = getCurrentSelectedFrame();
    if (!f || !VideoState.project) return;
    VideoState.project.frames.forEach(item => { item.duration = f.duration; });
    renderTimeline();
    updateTimecodeUI();
    queueSaveVideoProject();
    setStatus(`ĐÃ ĐẶT ${f.duration}S CHO TẤT CẢ FRAME`);
});

["frame-transition", "frame-motion", "frame-fit", "frame-text-pos", "frame-text-size", "frame-box-style"].forEach(id => {
    document.getElementById(id).addEventListener("change", () => {
        const f = getCurrentSelectedFrame();
        if (!f) return;
        f.transition = document.getElementById("frame-transition").value;
        f.motion = document.getElementById("frame-motion").value;
        f.fitMode = document.getElementById("frame-fit").value;
        f.textPos = document.getElementById("frame-text-pos").value;
        f.textSize = parseFloat(document.getElementById("frame-text-size").value) || 1.0;
        f.boxStyle = document.getElementById("frame-box-style").value;
        renderAtTime(VideoState.currentTimeSec);
        queueSaveVideoProject();
    });
});

["frame-title-input", "frame-sub-input"].forEach(id => {
    document.getElementById(id).addEventListener("input", () => {
        const f = getCurrentSelectedFrame();
        if (!f) return;
        f.title = document.getElementById("frame-title-input").value;
        f.subtitle = document.getElementById("frame-sub-input").value;
        renderAtTime(VideoState.currentTimeSec);
        renderTimeline();
        queueSaveVideoProject();
    });
});

// --- UPLOAD ẢNH / VIDEO NGOÀI & NHẠC NỀN ---
document.getElementById("btn-upload-media").addEventListener("click", () => {
    document.getElementById("media-file-input").click();
});

document.getElementById("media-file-input").addEventListener("change", async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !VideoState.project) return;

    setStatus(`ĐANG NẠP ${files.length} FILE MEDIA...`);
    for (const file of files) {
        if (file.type.startsWith("video/")) {
            const thumbAndDur = await extractVideoThumbnailAndDuration(file);
            const newFrame = {
                ...createDefaultFrame(file.name.replace(/\.[^/.]+$/, ""), ""),
                mediaType: 'video',
                imageDataUrl: thumbAndDur.dataUrl,
                videoBlob: file,
                duration: thumbAndDur.duration,
                motion: 'none'
            };
            VideoState.project.frames.push(newFrame);
            await prepareFrameMedia(newFrame);
        } else if (file.type.startsWith("image/")) {
            const dataUrl = await readFileAsDataURL(file);
            const newFrame = {
                ...createDefaultFrame(file.name.replace(/\.[^/.]+$/, ""), ""),
                mediaType: 'image',
                imageDataUrl: dataUrl,
                duration: 4.0,
                motion: 'kenburns-in'
            };
            VideoState.project.frames.push(newFrame);
            await prepareFrameMedia(newFrame);
        }
    }

    e.target.value = "";
    VideoState.selectedFrameIdx = VideoState.project.frames.length - 1;
    renderTimeline();
    syncInspectorUI();
    VideoState.currentTimeSec = getStartTimeOfFrame(VideoState.selectedFrameIdx);
    renderAtTime(VideoState.currentTimeSec);
    updateTimecodeUI();
    queueSaveVideoProject();
    setStatus(`ĐÃ THÊM ${files.length} FRAME MỚI`);
});

function readFileAsDataURL(file) {
    return new Promise((resolve) => {
        const r = new FileReader();
        r.onload = (ev) => resolve(ev.target.result);
        r.readAsDataURL(file);
    });
}

function extractVideoThumbnailAndDuration(videoFile) {
    return new Promise((resolve) => {
        const vid = document.createElement("video");
        vid.muted = true;
        vid.src = URL.createObjectURL(videoFile);
        vid.onloadeddata = () => {
            vid.currentTime = Math.min(0.2, vid.duration / 2);
        };
        vid.onseeked = () => {
            const c = document.createElement("canvas");
            c.width = 480;
            c.height = 270;
            c.getContext("2d").drawImage(vid, 0, 0, c.width, c.height);
            resolve({
                dataUrl: c.toDataURL("image/jpeg", 0.75),
                duration: Math.max(1, Math.round((vid.duration || 5) * 10) / 10)
            });
        };
        vid.onerror = () => resolve({ dataUrl: null, duration: 5.0 });
    });
}

document.getElementById("btn-add-title-card").addEventListener("click", () => {
    if (!VideoState.project) return;
    const f = createDefaultFrame("CHUYỂN TRẠNG THÁI TẤN CÔNG", "Phân tích cấu trúc đội hình và khoảng trống Half-Space");
    VideoState.project.frames.push(f);
    VideoState.selectedFrameIdx = VideoState.project.frames.length - 1;
    renderTimeline();
    syncInspectorUI();
    VideoState.currentTimeSec = getStartTimeOfFrame(VideoState.selectedFrameIdx);
    renderAtTime(VideoState.currentTimeSec);
    updateTimecodeUI();
    queueSaveVideoProject();
});

// Nhạc nền (Audio)
document.getElementById("btn-upload-audio").addEventListener("click", () => {
    document.getElementById("audio-file-input").click();
});

document.getElementById("audio-file-input").addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file || !VideoState.project) return;
    VideoState.project.audioBlob = file;
    VideoState.project.audioName = file.name;
    setupAudioElement(file, file.name, VideoState.project.audioVolume || 0.6);
    queueSaveVideoProject();
    setStatus(`ĐÃ GHÉP NHẠC NỀN: ${file.name}`);
});

document.getElementById("btn-remove-audio").addEventListener("click", () => {
    if (!VideoState.project) return;
    VideoState.project.audioBlob = null;
    VideoState.project.audioName = "";
    clearAudioElement();
    queueSaveVideoProject();
});

document.getElementById("audio-volume").addEventListener("input", (e) => {
    const v = parseFloat(e.target.value) || 0;
    if (VideoState.project) VideoState.project.audioVolume = v;
    if (VideoState.audioEl) VideoState.audioEl.volume = v;
    document.getElementById("audio-vol-label").textContent = `${Math.round(v * 100)}%`;
    queueSaveVideoProject();
});

// Đổi Tỷ lệ Khung hình (Aspect Ratio & Custom Size)
document.getElementById("aspect-preset").addEventListener("change", (e) => {
    const val = e.target.value;
    const customRow = document.getElementById("custom-res-row");
    if (val === "custom") {
        customRow.style.display = "flex";
        return;
    }
    customRow.style.display = "none";
    const [w, h] = val.split("x").map(Number);
    applyCanvasResolution(w, h);
});

["custom-width", "custom-height"].forEach(id => {
    document.getElementById(id).addEventListener("change", () => {
        const w = Math.max(320, Math.min(3840, parseInt(document.getElementById("custom-width").value) || 1920));
        const h = Math.max(320, Math.min(3840, parseInt(document.getElementById("custom-height").value) || 1080));
        applyCanvasResolution(w, h);
    });
});

function applyCanvasResolution(w, h) {
    if (!VideoState.project) return;
    VideoState.project.width = w;
    VideoState.project.height = h;
    canvas.width = w;
    canvas.height = h;
    renderAtTime(VideoState.currentTimeSec);
    queueSaveVideoProject();
    setStatus(`RESOLUTION: ${w}×${h}`);
}

document.getElementById("toggle-watermark").addEventListener("change", (e) => {
    if (!VideoState.project) return;
    VideoState.project.watermark = e.target.checked;
    renderAtTime(VideoState.currentTimeSec);
    queueSaveVideoProject();
});

// Thanh Playback & Scrubber
document.getElementById("btn-play-master").addEventListener("click", () => {
    if (VideoState.isPlaying) stopMasterPlayback();
    else startMasterPlayback(false);
});

document.getElementById("btn-prev-frame").addEventListener("click", () => {
    stopMasterPlayback();
    VideoState.selectedFrameIdx = Math.max(0, VideoState.selectedFrameIdx - 1);
    VideoState.currentTimeSec = getStartTimeOfFrame(VideoState.selectedFrameIdx);
    highlightActiveTimelineCard();
    syncInspectorUI();
    renderAtTime(VideoState.currentTimeSec);
    updateTimecodeUI();
});

document.getElementById("btn-next-frame").addEventListener("click", () => {
    if (!VideoState.project) return;
    stopMasterPlayback();
    VideoState.selectedFrameIdx = Math.min(VideoState.project.frames.length - 1, VideoState.selectedFrameIdx + 1);
    VideoState.currentTimeSec = getStartTimeOfFrame(VideoState.selectedFrameIdx);
    highlightActiveTimelineCard();
    syncInspectorUI();
    renderAtTime(VideoState.currentTimeSec);
    updateTimecodeUI();
});

document.getElementById("master-scrubber").addEventListener("input", (e) => {
    stopMasterPlayback();
    VideoState.currentTimeSec = parseFloat(e.target.value) || 0;
    const info = getFrameAtTime(VideoState.currentTimeSec);
    if (info) {
        VideoState.selectedFrameIdx = info.index;
        highlightActiveTimelineCard();
        syncInspectorUI();
    }
    renderAtTime(VideoState.currentTimeSec);
    updateTimecodeUI();
});

document.getElementById("btn-clear-timeline").addEventListener("click", () => {
    if (!VideoState.project) return;
    if (!confirm("Xóa toàn bộ các Frame hiện tại trên Timeline và tạo lại 1 Frame mặc định?")) return;
    VideoState.project.frames = [createDefaultFrame()];
    VideoState.selectedFrameIdx = 0;
    VideoState.currentTimeSec = 0;
    renderTimeline();
    syncInspectorUI();
    renderAtTime(0);
    updateTimecodeUI();
    queueSaveVideoProject();
});

// --- MODAL QUẢN LÝ NHIỀU DỰ ÁN VIDEO ---
document.getElementById("btn-open-vid-projects").addEventListener("click", async () => {
    await renderVideoProjectsModalList();
    document.getElementById("video-project-modal").classList.add("active");
});

document.getElementById("btn-close-vid-modal").addEventListener("click", () => {
    document.getElementById("video-project-modal").classList.remove("active");
});

document.getElementById("btn-create-vid-proj").addEventListener("click", async () => {
    const inp = document.getElementById("new-vid-proj-name");
    const name = (inp && inp.value.trim()) ? inp.value.trim() : `Video Project #${Math.floor(Math.random() * 90 + 10)}`;
    const newP = createNewVideoProject(name);
    await GLDatabase.saveVideoProject(newP);
    if (inp) inp.value = "";
    await loadVideoProject(newP);
    document.getElementById("video-project-modal").classList.remove("active");
});

async function renderVideoProjectsModalList() {
    const list = await GLDatabase.getAllVideoProjects();
    const container = document.getElementById("vid-projects-list");
    if (!container) return;
    container.innerHTML = "";

    list.forEach(p => {
        const isCurrent = VideoState.project && VideoState.project.id === p.id;
        const div = document.createElement("div");
        div.style.cssText = "display:flex;justify-content:space-between;align-items:center;padding:10px;border:2px solid #000;background:#fff;";
        if (isCurrent) div.style.borderLeft = "6px solid var(--neo-green)";

        div.innerHTML = `
            <div>
                <strong style="color:#000;">${p.name} ${isCurrent ? '(ĐANG MỞ)' : ''}</strong>
                <div style="font-family:var(--font-mono);font-size:0.72rem;color:#555;">
                    ${(p.frames || []).length} frames • ${p.width}×${p.height}
                </div>
            </div>
            <div style="display:flex;gap:6px;">
                <button class="neo-btn-xs btn-action-green btn-open-vp">MỞ</button>
                <button class="neo-btn-xs btn-action-pink btn-del-vp"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;

        div.querySelector(".btn-open-vp").addEventListener("click", async () => {
            await loadVideoProject(p);
            document.getElementById("video-project-modal").classList.remove("active");
        });

        div.querySelector(".btn-del-vp").addEventListener("click", async () => {
            if (!confirm(`Xóa dự án video "${p.name}"?`)) return;
            await GLDatabase.deleteVideoProject(p.id);
            await renderVideoProjectsModalList();
        });

        container.appendChild(div);
    });
}

// --- ENGINE EXPORT FULL VIDEO (GHÉP FRAME + TRỘN NHẠC NỀN WEBAUDIO API) ---
document.getElementById("btn-export-master").addEventListener("click", async () => {
    if (!VideoState.project || VideoState.project.frames.length === 0) return;

    stopMasterPlayback();
    const overlay = document.getElementById("export-progress-overlay");
    const progFill = document.getElementById("export-progress-fill");
    const descEl = document.getElementById("export-status-desc");

    overlay.style.display = "flex";
    progFill.style.width = "0%";

    const totalSec = getTotalDuration();
    const canvasStream = canvas.captureStream(60);
    const combinedTracks = [...canvasStream.getVideoTracks()];

    // Nếu dự án có nhạc nền, trộn luồng Audio vào MediaStream bằng WebAudio API
    let audioCtx = null;
    let exportAudioEl = null;

    if (VideoState.project.audioBlob) {
        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            exportAudioEl = new Audio(URL.createObjectURL(VideoState.project.audioBlob));
            exportAudioEl.loop = true;
            const sourceNode = audioCtx.createMediaElementSource(exportAudioEl);
            const gainNode = audioCtx.createGain();
            gainNode.gain.value = VideoState.project.audioVolume ?? 0.6;
            const destNode = audioCtx.createMediaStreamDestination();

            sourceNode.connect(gainNode);
            gainNode.connect(destNode);
            gainNode.connect(audioCtx.destination); // Phát nhẹ ra loa để người dùng nghe tiến trình

            const audioTracks = destNode.stream.getAudioTracks();
            if (audioTracks.length > 0) combinedTracks.push(audioTracks[0]);
        } catch (err) {
            console.warn("WebAudio mix fallback:", err);
        }
    }

    const finalStream = new MediaStream(combinedTracks);
    let mimeType = 'video/webm;codecs=vp9,opus';
    if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm';

    const recorder = new MediaRecorder(finalStream, {
        mimeType,
        videoBitsPerSecond: 12000000 // 12 Mbps sắc nét
    });

    const chunks = [];
    recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
        if (exportAudioEl) exportAudioEl.pause();
        if (audioCtx) audioCtx.close().catch(() => {});

        const blob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${VideoState.project.name.replace(/\s+/g, '_')}_${VideoState.project.width}x${VideoState.project.height}.webm`;
        a.click();

        overlay.style.display = "none";
        setStatus("XUẤT VIDEO HOÀN TẤT!");
    };

    recorder.start();
    if (exportAudioEl) exportAudioEl.play().catch(() => {});

    // Chạy vòng lặp render chính xác từ 0s đến hết video và cập nhật thanh % tiến trình
    const progressTimer = setInterval(() => {
        const pct = Math.min(100, Math.round((VideoState.currentTimeSec / totalSec) * 100));
        progFill.style.width = `${pct}%`;
        descEl.textContent = `Đang kết xuất: ${formatTimecode(VideoState.currentTimeSec)} / ${formatTimecode(totalSec)} (${pct}%)`;
    }, 100);

    startMasterPlayback(true, () => {
        clearInterval(progressTimer);
        progFill.style.width = "100%";
        setTimeout(() => {
            if (recorder.state !== 'inactive') recorder.stop();
        }, 200);
    });
});

initVideoStudio();