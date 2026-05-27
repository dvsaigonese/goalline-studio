let myRadarChart = null;

function initChart() {
    const ctx = document.getElementById('radarChart').getContext('2d');
    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.color = '#555';

    myRadarChart = new Chart(ctx, {
        type: 'radar',
        data: {
            // Các chỉ số nâng cao, phục vụ phân tích chuyên sâu
            labels: ['xG (Kỳ vọng ghi bàn)', 'xA (Kỳ vọng kiến tạo)', 'Key Passes', 'Shots', 'xG BuildUp'],
            datasets: [] 
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    angleLines: { color: 'rgba(0,0,0,0.1)' },
                    grid: { color: 'rgba(0,0,0,0.08)', circular: true },
                    pointLabels: { font: { size: 14, weight: '700' }, color: '#111' },
                    ticks: { display: false, min: 0 }
                }
            },
            plugins: { legend: { display: false } }
        }
    });
}

async function loadPlayerData() {
    const playerId = document.getElementById('selectPlayer').value;
    const colorInput = document.getElementById('inputColor').value;
    
    // Cập nhật text UI
    document.getElementById('renderTitle').innerText = document.getElementById('inputTitle').value;
    document.getElementById('renderSubtitle').innerText = document.getElementById('inputSubtitle').value;

    try {
        // Đọc thẳng file JSON cùng cấp ở ngoài thư mục gốc
        const response = await fetch(`../../data_${playerId}.json`); 
        if (!response.ok) throw new Error("Chưa có data local, hãy chạy file python trước.");
        
        const data = await response.json();
        const latestSeason = data.season[data.season.length - 1]; // Lấy mùa gần nhất
        
        // Bóc tách & scale dữ liệu (nhân nhẹ lên để chart to đều ra)
        const xG = parseFloat(latestSeason.xG) * 5; 
        const xA = parseFloat(latestSeason.xA) * 5;
        const kp = parseFloat(latestSeason.key_passes) * 1.5;
        const shots = parseFloat(latestSeason.shots) * 1;
        const xGB = parseFloat(latestSeason.xGChain) * 1.5;

        // Vẽ mảng
        myRadarChart.data.datasets = [{
            data: [xG, xA, kp, shots, xGB],
            backgroundColor: colorInput.replace('1)', '0.3)'), // Làm trong suốt màu nền 30%
            borderColor: colorInput,
            borderWidth: 3,
            pointBackgroundColor: colorInput,
            pointRadius: 5,
            fill: true
        }];
        myRadarChart.update();

    } catch (error) {
        console.error(error);
        alert("Lỗi: Không tìm thấy file data. Vui lòng check lại Python.");
    }
}

function downloadArtboard() {
    const artboard = document.getElementById('artboard-target');
    const title = document.getElementById('inputTitle').value.replace(/\s+/g, '_'); 

    html2canvas(artboard, {
        scale: 2, // Export nét gấp đôi
        useCORS: true, 
        backgroundColor: '#FAF9F6' 
    }).then(canvas => {
        const link = document.createElement('a');
        link.download = `GoalLine_${title}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    });
}

// Lắng nghe sự kiện
document.addEventListener('DOMContentLoaded', () => {
    initChart();
    loadPlayerData(); 

    // Khi đổi cầu thủ / sửa title thì tự update biểu đồ ngay lập tức
    document.getElementById('selectPlayer').addEventListener('change', loadPlayerData);
    document.getElementById('inputTitle').addEventListener('input', loadPlayerData);
    document.getElementById('inputSubtitle').addEventListener('input', loadPlayerData);
    document.getElementById('inputColor').addEventListener('input', loadPlayerData);
    
    document.getElementById('btnDownload').addEventListener('click', downloadArtboard);
});