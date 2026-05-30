import { DATA_PROVIDERS, GROUP_COLORS } from './config/chartProviders.js';
import { ChartEngine, hexToRgba } from './modules/chartEngine.js';

const API_URL = "https://dvsaigonese-goalline-api.hf.space/api"; 
const engine = new ChartEngine('radarChart');

let playersData = [null, null, null]; 
let colorPalette = ['#6366f1', '#ef4444', '#10b981']; 
let currentMode = 'p90'; 
let currentProvider = 'understat'; 
let currentChartType = 'radar';
let userSelectedKeys = [...DATA_PROVIDERS[currentProvider].defaultKeys];

// ==========================================
// 1. TÌM KIẾM & API (Debounce 800ms)
// ==========================================
function setupSearchSlots() {
    const inputs = document.querySelectorAll('.player-search');
    let timeout = null;

    inputs.forEach(input => {
        input.addEventListener('input', (e) => {
            clearTimeout(timeout);
            const slotIdx = e.target.getAttribute('data-slot');
            const listDiv = document.getElementById(`autocomplete-${slotIdx}`);
            const query = e.target.value.trim();

            if (query.length < 2) { listDiv.style.display = 'none'; return; }

            timeout = setTimeout(async () => {
                try {
                    const res = await fetch(`${API_URL}/search?q=${query}`);
                    const results = await res.json();
                    listDiv.innerHTML = '';
                    results.forEach(p => {
                        const div = document.createElement('div');
                        div.className = 'ac-item';
                        div.innerHTML = `<strong>${p.name}</strong> <span class="ac-team">${p.team}</span>`;
                        div.addEventListener('click', () => {
                            input.value = p.name;
                            listDiv.style.display = 'none';
                            fetchPlayerSeasons(slotIdx, p.id); 
                        });
                        listDiv.appendChild(div);
                    });
                    listDiv.style.display = 'block';
                } catch(e) {}
            }, 800); 
        });
    });
}

async function fetchPlayerSeasons(slotIdx, playerId) {
    const select = document.querySelector(`.season-select[data-slot="${slotIdx}"]`);
    select.innerHTML = '<option>Đang cào dữ liệu...</option>';
    select.disabled = true;

    try {
        const res = await fetch(`${API_URL}/player/${playerId}`);
        let data = await res.json();
        let seasonsArray = data.season ? data.season : data;
        const reversedSeasons = [...seasonsArray].reverse(); 
        
        select.innerHTML = '';
        reversedSeasons.forEach((s, idx) => {
            const opt = document.createElement('option');
            opt.value = idx; 
            opt.textContent = `${s.season}/${parseInt(s.season)+1} - ${s.team}`;
            select.appendChild(opt);
        });
        
        select.disabled = false;
        select.dataset.fullSeasons = JSON.stringify(reversedSeasons);
        updateSlotData(slotIdx, reversedSeasons[0]);

        select.onchange = (e) => {
            const arr = JSON.parse(select.dataset.fullSeasons);
            updateSlotData(slotIdx, arr[e.target.value]);
        };
    } catch(e) { console.error(e); }
}

function updateSlotData(slotIdx, seasonData) {
    playersData[slotIdx] = seasonData;
    document.getElementById(`info-${slotIdx}`).innerText = `${seasonData.games} Trận (${seasonData.time} phút)`;
    if (slotIdx == 0) renderMetricsGrouped(); 
    buildAndUpdateChart();
}

// ==========================================
// 2. LOGIC TÍNH TOÁN DATA
// ==========================================
function renderMetricsGrouped() {
    const container = document.getElementById('dynamicMetrics');
    const dict = DATA_PROVIDERS[currentProvider].metrics;
    let groups = {};

    Object.keys(dict).forEach(key => {
        const conf = dict[key];
        if (!groups[conf.group]) groups[conf.group] = '';
        const isChecked = userSelectedKeys.includes(key) ? 'checked' : '';
        groups[conf.group] += `<label class="metric-item"><input type="checkbox" class="metric-checkbox" value="${key}" ${isChecked}> <span>${conf.label}</span></label>`;
    });

    let finalHtml = '';
    for (const [gKey, gHtml] of Object.entries(groups)) {
        finalHtml += `<div class="group-label group-${gKey}" style="color:${GROUP_COLORS[gKey]}">${gKey}</div> ${gHtml}`;
    }
    container.innerHTML = finalHtml;

    document.querySelectorAll('.metric-checkbox').forEach(cb => {
        cb.addEventListener('change', (e) => {
            if(e.target.checked && !userSelectedKeys.includes(e.target.value)) userSelectedKeys.push(e.target.value);
            else userSelectedKeys = userSelectedKeys.filter(k => k !== e.target.value);
            buildAndUpdateChart();
        });
    });
}

function calcData(rawVal, mins, benchmarkP90, benchmarkAbs) {
    let finalVal = 0, benchmark = 1;
    if (currentMode === 'p90') {
        finalVal = mins > 0 ? (parseFloat(rawVal) / mins) * 90 : 0;
        benchmark = benchmarkP90;
    } else {
        finalVal = parseFloat(rawVal);
        benchmark = benchmarkAbs;
    }
    
    // FIX BUG TRÀN SỐ THẬP PHÂN: Làm tròn 2 chữ số, xoá số 0 thừa
    const displayVal = Number.isInteger(finalVal) ? finalVal : parseFloat(finalVal.toFixed(2));
    const scaleVal = (finalVal / benchmark) * 100;
    
    return { displayVal, scaleVal };
}

// ==========================================
// 3. BUILD & RENDER
// ==========================================
function buildAndUpdateChart() {
    if (!playersData[0]) return; 

    const dict = DATA_PROVIDERS[currentProvider].metrics;
    const labels = [];
    const labelColors = []; // Dành cho trục Radar
    const barBgColors = []; // Dành cho cột Bar Chart

    userSelectedKeys.forEach(k => {
        labels.push(dict[k].label.toUpperCase());
        labelColors.push(GROUP_COLORS[dict[k].group] || '#111');
        barBgColors.push(GROUP_COLORS[dict[k].group] || '#6366f1');
    });

    let datasets = [];
    let globalMaxScale = 100; // Để làm Dynamic Radar Scale
    let realDataMatrix = [{}, {}, {}]; 
    let legendText = '';

    playersData.forEach((playerObj, idx) => {
        if (!playerObj) return;
        
        // NẾU LÀ BAR CHART, BỎ QUA PLAYER 2 VÀ 3
        if (currentChartType === 'bar' && idx > 0) return;

        const plottedData = [];
        const realData = [];
        const mins = parseFloat(playerObj.time);

        userSelectedKeys.forEach(key => {
            const rawVal = playerObj[key] || 0;
            const res = calcData(rawVal, mins, dict[key].p90Max, dict[key].absMax);
            
            realData.push(res.displayVal);
            plottedData.push(res.scaleVal);
            realDataMatrix[idx][key] = res.displayVal;

            if (res.scaleVal > globalMaxScale) globalMaxScale = res.scaleVal; // Theo dõi Scale kỷ lục
        });

        datasets.push({
            data: plottedData,
            realData: realData,
            labelColors: labelColors, // Truyền màu cho Plugin
            barColors: barBgColors,   // Truyền màu cho Bar
            backgroundColor: currentChartType === 'radar' ? hexToRgba(colorPalette[idx], 0.2) : barBgColors,
            borderColor: colorPalette[idx],
            borderWidth: currentChartType === 'radar' ? 2 : 0,
            pointBackgroundColor: colorPalette[idx],
            pointRadius: 2,
            fill: true
        });

        const pName = document.querySelector(`.player-search[data-slot="${idx}"]`).value || `Player ${idx+1}`;
        legendText += `<span style="color:${colorPalette[idx]}">● ${pName} (${playerObj.games} trận, ${playerObj.time}')</span> &nbsp;&nbsp;`;
    });

    // Render Canvas
    engine.render(currentChartType, labels, datasets, globalMaxScale);

    // Xử lý Table & Legend UI
    const tableContainer = document.getElementById('comparisonTableContainer');
    if (currentChartType === 'bar') {
        tableContainer.style.display = 'none'; // Ẩn Table khi dùng Bar
    } else {
        tableContainer.style.display = 'block';
        renderTable(realDataMatrix, dict);
    }

    document.getElementById('matchesLegend').innerHTML = legendText;
    document.getElementById('renderModeSource').innerText = currentMode === 'p90' ? "Per 90" : "Absolute";
    document.getElementById('renderDataSource').innerText = DATA_PROVIDERS[currentProvider].name;
}

function renderTable(realDataMatrix, dict) {
    let html = `<table class="compare-table"><thead><tr><th style="text-align:left;">CẦU THỦ</th>`;
    userSelectedKeys.forEach(k => html += `<th>${dict[k].label}</th>`);
    html += `</tr></thead><tbody>`;

    playersData.forEach((playerObj, idx) => {
        if (!playerObj) return;
        const pName = document.querySelector(`.player-search[data-slot="${idx}"]`).value || `Player ${idx+1}`;
        html += `<tr><td class="player-name-col"><span class="color-dot" style="background:${colorPalette[idx]}"></span>${pName}</td>`;
        userSelectedKeys.forEach(key => html += `<td>${realDataMatrix[idx][key]}</td>`);
        html += `</tr>`;
    });
    document.getElementById('comparisonTableContainer').innerHTML = html + `</tbody></table>`;
}

// ==========================================
// 4. LẮNG NGHE SỰ KIỆN GIAO DIỆN
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    setupSearchSlots();
    
    // Chọn Chart Type (Radar/Bar) - Ẩn hiện Slot 2 & 3
    document.getElementById('selectChartType').addEventListener('change', (e) => {
        currentChartType = e.target.value;
        const s1 = document.getElementById('slot-1');
        const s2 = document.getElementById('slot-2');
        if (currentChartType === 'bar') {
            s1.style.display = 'none'; s2.style.display = 'none';
        } else {
            s1.style.display = 'block'; s2.style.display = 'block';
        }
        buildAndUpdateChart();
    });

    document.getElementById('selectDataSource').addEventListener('change', (e) => {
        currentProvider = e.target.value;
        userSelectedKeys = [...DATA_PROVIDERS[currentProvider].defaultKeys];
        renderMetricsGrouped();
        buildAndUpdateChart();
    });

    document.getElementById('dataModeToggle').addEventListener('change', (e) => {
        currentMode = e.target.value;
        buildAndUpdateChart();
    });

    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.getAttribute('data-target')).classList.add('active');
        });
    });

    const swatches = document.querySelectorAll('.color-swatch');
    swatches.forEach(sw => {
        sw.addEventListener('click', (e) => {
            swatches.forEach(s => s.classList.remove('active'));
            e.target.classList.add('active');
            colorPalette[0] = e.target.getAttribute('data-color');
            updateChart();
        });
    });

    document.getElementById('inputTitle').addEventListener('input', (e) => { document.getElementById('renderTitle').innerText = e.target.value; });
    document.getElementById('inputSubtitle').addEventListener('input', (e) => { document.getElementById('renderSubtitle').innerText = e.target.value; });
    
    document.getElementById('btnDownload').addEventListener('click', () => {
        const artboard = document.getElementById('artboard-target');
        artboard.style.borderRadius = "0";
        html2canvas(artboard, { scale: 2, useCORS: true, backgroundColor: '#ffffff' }).then(canvas => {
            const link = document.createElement('a');
            link.download = `GoalLine_${Date.now()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            artboard.style.borderRadius = "8px";
        });
    });
});