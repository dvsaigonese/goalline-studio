// 1. CẤU HÌNH API
const API_URL = "https://dvsaigonese-goalline-api.hf.space/api/player";
let myChart = null;

// ==========================================
// MODULE 1: QUẢN LÝ TAB (GIAO DIỆN)
// ==========================================
function setupTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Xóa active cũ
            tabBtns.forEach(b => b.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));

            // Bật active mới
            btn.classList.add('active');
            const targetId = btn.getAttribute('data-target');
            document.getElementById(targetId).classList.add('active');
        });
    });
}

// ==========================================
// MODULE 2: RENDER BIỂU ĐỒ (CHART.JS)
// ==========================================
function initChart() {
    const ctx = document.getElementById('radarChart').getContext('2d');
    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.color = '#6b7280'; // Màu text-muted

    myChart = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['xG (Kỳ vọng ghi bàn)', 'xA (Kỳ vọng kiến tạo)', 'Key Passes', 'Shots', 'xG BuildUp'],
            datasets: [] 
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    angleLines: { color: 'rgba(0,0,0,0.05)' },
                    grid: { color: 'rgba(0,0,0,0.05)', circular: true },
                    pointLabels: { font: { size: 13, weight: '600' }, color: '#111827' },
                    ticks: { display: false, min: 0 }
                }
            },
            plugins: { legend: { display: false } }
        }
    });
}

async function fetchAndRenderData() {
    const playerId = document.getElementById('selectPlayer').value;
    const colorInput = document.getElementById('inputColor').value;
    
    // Cập nhật text UI (Từ Tab 3)
    document.getElementById('renderTitle').innerText = document.getElementById('inputTitle').value;
    document.getElementById('renderSubtitle').innerText = document.getElementById('inputSubtitle').value;

    try {
        console.log(`⏳ Đang cào data cho ID: ${playerId}...`);
        const response = await fetch(`${API_URL}/${playerId}`); 
        if (!response.ok) throw new Error("Lỗi API");
        
        const data = await response.json(); 
        
        // TỰ ĐỘNG BẮT BỆNH VÀ SỬA LỖI MẢNG DATA:
        let latestSeason;
        if (Array.isArray(data)) {
            // Understat trả về mùa mới nhất ở vị trí ĐẦU TIÊN (index 0)
            latestSeason = data[0]; 
            console.log(0)
        } else {
            latestSeason = data.season[0];
            console.log(data)
        }

        console.log("⚽ MÙA GIẢI LẤY ĐƯỢC:", latestSeason.season);

        // Parse số liệu (kèm fallback = 0 nếu lỡ data bị thiếu để tránh chart trắng bóc)
        const xG = parseFloat(latestSeason.xG || 0) * 5; 
        const xA = parseFloat(latestSeason.xA || 0) * 5;
        const kp = parseFloat(latestSeason.key_passes || 0) * 1.5;
        const shots = parseFloat(latestSeason.shots || 0) * 1;
        
        // Understat đôi khi dùng xGBuildup, đôi khi dùng xGChain
        const xGB = parseFloat(latestSeason.xGBuildup || latestSeason.xGChain || 0) * 1.5; 

        // Bơm data
        myChart.data.datasets = [{
            data: [xG, xA, kp, shots, xGB],
            backgroundColor: colorInput.replace('1)', '0.2)'), // Nền trong suốt 20%
            borderColor: colorInput,
            borderWidth: 2,
            pointBackgroundColor: colorInput,
            pointRadius: 4,
            fill: true
        }];
        
        // Tắt animation để web phản hồi tức thì giống app FBPlot
        myChart.update('none'); 

    } catch (error) {
        console.error(error);
        alert("Lỗi tải dữ liệu. Bật F12 lên xem lỗi gì nhé!");
    }
}

// ==========================================
// MODULE 3: EXPORT (TẢI ẢNH)
// ==========================================
function downloadArtboard() {
    const artboard = document.getElementById('artboard-target');
    const title = document.getElementById('inputTitle').value.replace(/\s+/g, '_'); 

    // Bo tròn góc lúc preview thôi, lúc xuất ảnh phải vuông góc
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
        
        // Trả lại bo góc cho UI
        artboard.style.borderRadius = "8px"; 
    });
}

// ==========================================
// KHỞI CHẠY HỆ THỐNG KHI LOAD TRANG
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    setupTabs();
    initChart();
    fetchAndRenderData(); 

    // Lắng nghe thay đổi từ các Tab
    document.getElementById('selectPlayer').addEventListener('change', fetchAndRenderData);
    document.getElementById('inputTitle').addEventListener('input', fetchAndRenderData);
    document.getElementById('inputSubtitle').addEventListener('input', fetchAndRenderData);
    document.getElementById('inputColor').addEventListener('input', fetchAndRenderData);
    
    // Nút tải ảnh ở Tab 4
    document.getElementById('btnDownload').addEventListener('click', downloadArtboard);
});