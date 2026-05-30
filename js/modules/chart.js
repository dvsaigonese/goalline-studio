Chart.register(ChartDataLabels);
const API_URL = "https://dvsaigonese-goalline-api.hf.space/api"; 

let playersData = [null, null, null]; 
let colorPalette = ['#6366f1', '#ef4444', '#10b981']; 
let currentMode = 'p90'; 
let currentProvider = 'understat'; // Nguồn data hiện tại

// KIẾN TRÚC MỞ RỘNG DATA SOURCES
const DATA_PROVIDERS = {
    'understat': {
        name: "Understat",
        metrics: {
            'goals': { group: 'shooting', label: 'Goals', p90Max: 1.0, absMax: 30 },
            'xG': { group: 'shooting', label: 'xG', p90Max: 0.8, absMax: 25 },
            'shots': { group: 'shooting', label: 'Shots', p90Max: 4.5, absMax: 120 },
            'assists': { group: 'passing', label: 'Assists', p90Max: 0.6, absMax: 15 },
            'xA': { group: 'passing', label: 'xA', p90Max: 0.5, absMax: 15 },
            'key_passes': { group: 'passing', label: 'Key Passes', p90Max: 3.5, absMax: 100 },
            'xGChain': { group: 'possession', label: 'xG Chain', p90Max: 1.5, absMax: 35 },
            'xGBuildup': { group: 'possession', label: 'xG Buildup', p90Max: 1.0, absMax: 25 }
        },
        defaultKeys: ['xG', 'xA', 'key_passes', 'shots', 'xGBuildup']
    },
    // Chuẩn bị sẵn đất diễn cho FotMob sau này
    'fotmob': {
        name: "FotMob API",
        metrics: {
            'accurate_passes': { group: 'passing', label: 'Acc. Passes', p90Max: 60, absMax: 2000 },
            'duel_won': { group: 'defending', label: 'Duels Won', p90Max: 8, absMax: 300 }
            // ... thêm sau
        },
        defaultKeys: ['accurate_passes', 'duel_won']
    }
};

const GROUP_COLORS = { 'shooting': '#ef4444', 'passing': '#3b82f6', 'possession': '#f59e0b', 'defending': '#10b981' };

let userSelectedKeys = [...DATA_PROVIDERS['understat'].defaultKeys];
let myChart = null;

// ==========================================
// 1. MODULE TÌM KIẾM (Tối ưu Performance)
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

            // Tăng Debounce lên 800ms (Chờ gõ xong hẳn mới fetch, cực mượt và đỡ tốn server)
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

    document.addEventListener('click', (e) => {
        if (!e.target.classList.contains('player-search')) {
            document.querySelectorAll('.autocomplete-list').forEach(l => l.style.display = 'none');
        }
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
    updateChart();
}

// ==========================================
// 2. RENDERING ĐỘNG DỰA THEO PROVIDER
// ==========================================
function renderMetricsGrouped() {
    const container = document.getElementById('dynamicMetrics');
    container.innerHTML = ''; 
    const currentDict = DATA_PROVIDERS[currentProvider].metrics;
    const groups = {};

    Object.keys(currentDict).forEach(key => {
        const conf = currentDict[key];
        if (!groups[conf.group]) groups[conf.group] = '';
        
        const isChecked = userSelectedKeys.includes(key) ? 'checked' : '';
        groups[conf.group] += `
            <label class="metric-item">
                <input type="checkbox" class="metric-checkbox" value="${key}" ${isChecked}>
                <span>${conf.label}</span>
            </label>
        `;
    });

    let finalHtml = '';
    for (const [gKey, gHtml] of Object.entries(groups)) {
        finalHtml += `<div class="group-label group-${gKey}">${gKey}</div> ${gHtml}`;
    }
    container.innerHTML = finalHtml;

    document.querySelectorAll('.metric-checkbox').forEach(cb => {
        cb.addEventListener('change', (e) => {
            if(e.target.checked && !userSelectedKeys.includes(e.target.value)) userSelectedKeys.push(e.target.value);
            else userSelectedKeys = userSelectedKeys.filter(k => k !== e.target.value);
            updateChart();
        });
    });
}

function calcP90(value, minutesPlayed) {
    if (!value || minutesPlayed == 0) return 0;
    return parseFloat(((parseFloat(value) / parseFloat(minutesPlayed)) * 90).toFixed(2)); 
}

// ==========================================
// 3. CHART & DATA TABLE RENDERING
// ==========================================
function initChart() {
    const ctx = document.getElementById('radarChart').getContext('2d');
    myChart = new Chart(ctx, {
        type: 'radar',
        data: { labels: [], datasets: [] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    min: 0, max: 100,
                    angleLines: { color: 'rgba(0,0,0,0.1)' },
                    grid: { color: 'rgba(0,0,0,0.05)', circular: true },
                    pointLabels: { 
                        font: { size: 11, weight: '700' },
                        padding: 10,
                        color: function(context) {
                            const dict = DATA_PROVIDERS[currentProvider].metrics;
                            const key = Object.keys(dict).find(k => dict[k].label.toUpperCase() === context.label);
                            return key ? GROUP_COLORS[dict[key].group] : '#111';
                        }
                    },
                    ticks: { display: false }
                }
            },
            plugins: { 
                legend: { display: false },
                // TẮT DATALABELS TRÊN RADAR ĐỂ NHƯỜNG CHỖ CHO BẢNG TABLE Ở DƯỚI
                datalabels: { display: false }
            }
        }
    });
}

function renderComparisonTable(realDataMatrix) {
    const container = document.getElementById('comparisonTableContainer');
    const dict = DATA_PROVIDERS[currentProvider].metrics;
    
    // Nếu chỉ có 1 cầu thủ, có thể ẩn bảng đi cho sạch, hoặc cứ hiện (Tùy chọn: Ở đây tôi cho hiện luôn)
    
    let html = `<table class="compare-table"><thead><tr>`;
    html += `<th style="text-align:left;">CẦU THỦ</th>`;
    
    // Header chỉ số
    userSelectedKeys.forEach(k => {
        html += `<th>${dict[k].label}</th>`;
    });
    html += `</tr></thead><tbody>`;

    // Row từng cầu thủ
    playersData.forEach((playerObj, idx) => {
        if (!playerObj) return;
        const pName = document.querySelector(`.player-search[data-slot="${idx}"]`).value || `Player ${idx+1}`;
        const pColor = colorPalette[idx];
        
        html += `<tr>`;
        html += `<td class="player-name-col"><span class="color-dot" style="background:${pColor}"></span>${pName}</td>`;
        
        userSelectedKeys.forEach(key => {
            html += `<td>${realDataMatrix[idx][key]}</td>`;
        });
        html += `</tr>`;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
}

function updateChart() {
    if (!playersData[0]) return; 

    const dict = DATA_PROVIDERS[currentProvider].metrics;
    const labels = [];
    userSelectedKeys.forEach(k => labels.push(dict[k].label.toUpperCase()));
    myChart.data.labels = labels;
    myChart.data.datasets = [];

    let legendText = '';
    // Ma trận lưu data thật để đẩy xuống Table
    let realDataMatrix = [{}, {}, {}]; 

    playersData.forEach((playerObj, idx) => {
        if (!playerObj) return;
        const plottedData = [];
        const mins = parseFloat(playerObj.time);

        userSelectedKeys.forEach(key => {
            const rawVal = parseFloat(playerObj[key] || 0);
            const conf = dict[key];

            let finalVal = 0;
            let benchmark = 1;

            if (currentMode === 'p90') {
                finalVal = calcP90(rawVal, mins);
                benchmark = conf.p90Max;
            } else {
                finalVal = rawVal;
                benchmark = conf.absMax;
            }
            
            realDataMatrix[idx][key] = finalVal; // Lưu số thật
            
            // Tính %
            let scaleVal = (finalVal / benchmark) * 100;
            plottedData.push(scaleVal > 100 ? 100 : scaleVal);
        });

        myChart.data.datasets.push({
            data: plottedData,
            backgroundColor: hexToRgba(colorPalette[idx], 0.2),
            borderColor: colorPalette[idx],
            borderWidth: 2,
            pointBackgroundColor: colorPalette[idx],
            pointRadius: 2,
            fill: true
        });

        const pName = document.querySelector(`.player-search[data-slot="${idx}"]`).value;
        legendText += `<span style="color:${colorPalette[idx]}">● ${pName} (${playerObj.games} games)</span> &nbsp;&nbsp;`;
    });

    // Vẽ Bảng và cập nhật UI
    renderComparisonTable(realDataMatrix);
    document.getElementById('matchesLegend').innerHTML = legendText;
    document.getElementById('renderModeSource').innerText = currentMode === 'p90' ? "Per 90" : "Absolute";
    document.getElementById('renderDataSource').innerText = DATA_PROVIDERS[currentProvider].name;
    myChart.update('none');
}

// Hàm phụ trợ màu sắc
function hexToRgba(hex, alpha) {
    var c;
    if(/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)){
        c= hex.substring(1).split('');
        if(c.length== 3){ c= [c[0], c[0], c[1], c[1], c[2], c[2]]; }
        c= '0x'+c.join('');
        return 'rgba('+[(c>>16)&255, (c>>8)&255, c&255].join(',')+','+alpha+')';
    }
    return `rgba(99, 102, 241, ${alpha})`;
}

// Bắt sự kiện UI
document.addEventListener('DOMContentLoaded', () => {
    initChart();
    setupSearchSlots();
    
    // Đổi Source Data (Chuẩn bị cho Scale)
    document.getElementById('selectDataSource').addEventListener('change', (e) => {
        currentProvider = e.target.value;
        userSelectedKeys = [...DATA_PROVIDERS[currentProvider].defaultKeys];
        renderMetricsGrouped();
        updateChart();
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

    document.getElementById('dataModeToggle').addEventListener('change', (e) => {
        currentMode = e.target.value;
        updateChart();
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