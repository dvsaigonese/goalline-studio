// Đăng ký Plugin DataLabels để in số lên biểu đồ
Chart.register(ChartDataLabels);

const API_URL = "https://dvsaigonese-goalline-api.hf.space/api/player";
let myChart = null;
let currentPlayerRawData = null; // Lưu cache data để tính toán khi tick checkbox
let currentColor = '#6366f1';

// HỆ SỐ SCALE BENCHMARK (Đẳng cấp Thế Giới Per 90)
// Giúp quy chuẩn mọi số liệu về thang đo 0-100% để tạo dáng cho Radar
const BENCHMARK_P90 = {
    'goals': 1.0,      // 1 bàn/trận là đỉnh cao
    'shots': 4.5,      // 4.5 cú sút/trận
    'xG': 0.8,         // 0.8 xG/trận
    'assists': 0.6,    // 0.6 kiến tạo/trận
    'xA': 0.5,         // 0.5 xA/trận
    'key_passes': 3.5, // 3.5 Keypass/trận
    'xGChain': 1.5,    // Tùy theo scale của Understat
    'xGBuildup': 1.0,
    'npg': 0.8,
    'npxG': 0.8
};

// ==========================================
// MODULE 1: QUẢN LÝ UI (TAB & COLOR)
// ==========================================
function setupUI() {
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

    // Color Swatches Logic
    const swatches = document.querySelectorAll('.color-swatch');
    const nativePicker = document.getElementById('customColorPicker');

    swatches.forEach(sw => {
        sw.addEventListener('click', (e) => {
            swatches.forEach(s => s.classList.remove('active'));
            e.target.classList.add('active');
            currentColor = e.target.getAttribute('data-color');
            updateChartAppearance();
        });
    });

    nativePicker.addEventListener('input', (e) => {
        swatches.forEach(s => s.classList.remove('active'));
        currentColor = e.target.value;
        updateChartAppearance();
    });
}

// ==========================================
// MODULE 2: DỮ LIỆU & CHECKBOX ĐỘNG
// ==========================================
function renderMetricCheckboxes(seasonData) {
    const container = document.getElementById('dynamicMetrics');
    container.innerHTML = ''; // Clear loading text
    
    // Các trường dữ liệu sẽ bỏ qua không làm checkbox
    const excludeKeys = ['position', 'games', 'time', 'season', 'team', 'yellow', 'red'];
    
    // Mặc định tick sẵn 5 cái cơ bản này cho đẹp
    const defaultChecked = ['xG', 'xA', 'key_passes', 'shots', 'xGBuildup'];

    Object.keys(seasonData).forEach(key => {
        if (!excludeKeys.includes(key)) {
            const isChecked = defaultChecked.includes(key) ? 'checked' : '';
            const html = `
                <label class="metric-item">
                    <input type="checkbox" class="metric-checkbox" value="${key}" ${isChecked}>
                    <span>${key.toUpperCase()} (p90)</span>
                </label>
            `;
            container.insertAdjacentHTML('beforeend', html);
        }
    });

    // Lắng nghe sự kiện tick/bỏ tick để vẽ lại Chart
    document.querySelectorAll('.metric-checkbox').forEach(cb => {
        cb.addEventListener('change', buildChartData);
    });
}

// Hàm quy đổi số liệu sang chuẩn Per 90 (P90)
function calcP90(value, minutesPlayed) {
    if (!value || minutesPlayed == 0) return 0;
    const p90 = (parseFloat(value) / parseFloat(minutesPlayed)) * 90;
    return parseFloat(p90.toFixed(2)); // Lấy 2 chữ số thập phân
}

// ==========================================
// MODULE 3: RENDER CHART
// ==========================================
function initChart() {
    const ctx = document.getElementById('radarChart').getContext('2d');
    Chart.defaults.font.family = "'Inter', sans-serif";

    myChart = new Chart(ctx, {
        type: 'radar',
        data: { labels: [], datasets: [] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    angleLines: { color: 'rgba(0,0,0,0.1)' },
                    grid: { color: 'rgba(0,0,0,0.05)', circular: true },
                    pointLabels: { 
                        font: { size: 14, weight: '700' }, 
                        color: '#111827',
                        padding: 20
                    },
                    ticks: { display: false, min: 0, max: 100 } // Fix max 100%
                }
            },
            plugins: { 
                legend: { display: false },
                datalabels: {
                    // Plugin in số liệu thẳng lên các đỉnh Radar
                    color: '#fff',
                    backgroundColor: (context) => currentColor,
                    borderRadius: 4,
                    font: { weight: 'bold', size: 11 },
                    padding: 4,
                    formatter: function(value, context) {
                        // value ở đây là số Scale 0-100, ta phải moi số Real P90 ra để in
                        return context.dataset.realData[context.dataIndex];
                    }
                }
            }
        }
    });
}

function buildChartData() {
    if (!currentPlayerRawData) return;
    
    // Thu thập các checkbox được tick
    const selectedCheckboxes = document.querySelectorAll('.metric-checkbox:checked');
    const labels = [];
    const plottedData = []; // Số scale 0-100 để vẽ hình
    const realDataP90 = []; // Số P90 thật để in Text
    
    const minutes = currentPlayerRawData.time;

    selectedCheckboxes.forEach(cb => {
        const key = cb.value;
        labels.push(key.toUpperCase());
        
        // 1. Tính toán P90 thực tế
        const rawValue = currentPlayerRawData[key];
        const p90Value = calcP90(rawValue, minutes);
        realDataP90.push(p90Value);

        // 2. Scale thành phần trăm dựa trên Benchmark (để vẽ hình cân đối)
        const benchmark = BENCHMARK_P90[key] || 1.0; 
        let scaleVal = (p90Value / benchmark) * 100;
        if (scaleVal > 100) scaleVal = 100; // Tránh biểu đồ đâm thủng viền
        
        plottedData.push(scaleVal);
    });

    // Cập nhật Chart
    myChart.data.labels = labels;
    myChart.data.datasets = [{
        data: plottedData,
        realData: realDataP90, // Mảng ẩn chứa data thật cho Datalabels đọc
        backgroundColor: hexToRgba(currentColor, 0.2), // Màu trong suốt 20%
        borderColor: currentColor,
        borderWidth: 2,
        pointBackgroundColor: currentColor,
        pointRadius: 4,
        fill: true
    }];
    myChart.update('none'); // Update không có animation
}

function updateChartAppearance() {
    document.getElementById('renderTitle').innerText = document.getElementById('inputTitle').value;
    document.getElementById('renderSubtitle').innerText = document.getElementById('inputSubtitle').value;
    
    if(myChart && myChart.data.datasets.length > 0) {
        myChart.data.datasets[0].borderColor = currentColor;
        myChart.data.datasets[0].backgroundColor = hexToRgba(currentColor, 0.2);
        myChart.data.datasets[0].pointBackgroundColor = currentColor;
        myChart.update('none');
    }
}

// Hàm phụ trợ chuyển Hex sang RGBA để làm nền mờ
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

// ==========================================
// CORE: FETCH API
// ==========================================
async function fetchPlayerData() {
    const playerId = document.getElementById('selectPlayer').value;
    try {
        console.log(`⏳ Calling API for ID: ${playerId}...`);
        const response = await fetch(`${API_URL}/${playerId}`); 
        if (!response.ok) throw new Error("Lỗi API");
        
        const data = await response.json(); 
        
        // Trích xuất mùa mới nhất từ JSON phức tạp
        let latestSeason;
        if (data.season && Array.isArray(data.season)) {
            latestSeason = data.season[0]; // Understat thường để season mới nhất ở index 0
        } else if (Array.isArray(data)) {
            latestSeason = data[0];
        } else {
            latestSeason = data;
        }

        currentPlayerRawData = latestSeason; // Lưu Cache
        
        // 1. Tạo Checkbox (Chỉ tạo lần đầu hoặc khi đổi cầu thủ)
        renderMetricCheckboxes(currentPlayerRawData);
        
        // 2. Cập nhật diện mạo chữ Text
        updateChartAppearance();

        // 3. Vẽ Chart
        buildChartData();

    } catch (error) {
        console.error(error);
        alert("Lỗi tải dữ liệu. Bật F12 xem chi tiết.");
    }
}

// ==========================================
// EXPORT (TẢI ẢNH)
// ==========================================
function downloadArtboard() {
    const artboard = document.getElementById('artboard-target');
    const title = document.getElementById('inputTitle').value.replace(/\s+/g, '_'); 

    artboard.style.borderRadius = "0"; 

    html2canvas(artboard, {
        scale: 2, 
        useCORS: true, 
        backgroundColor: '#ffffff' 
    }).then(canvas => {
        const link = document.createElement('a');
        link.download = `GoalLine_${title}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        artboard.style.borderRadius = "8px"; 
    });
}

document.addEventListener('DOMContentLoaded', () => {
    setupUI();
    initChart();
    fetchPlayerData(); 

    document.getElementById('selectPlayer').addEventListener('change', fetchPlayerData);
    document.getElementById('inputTitle').addEventListener('input', updateChartAppearance);
    document.getElementById('inputSubtitle').addEventListener('input', updateChartAppearance);
    document.getElementById('btnDownload').addEventListener('click', downloadArtboard);
});