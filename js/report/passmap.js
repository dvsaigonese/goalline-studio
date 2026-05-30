// --- MODULE: PASSING NETWORK ---
document.addEventListener("DOMContentLoaded", () => {
    // 1. Core Logic Vẽ Sân (Canvas)
    const PITCH_X = 105; const PITCH_Y = 68;

    function drawVerticalPitch(ctx, cw, ch) {
        ctx.clearRect(0, 0, cw, ch);
        ctx.strokeStyle = "#c0c0c0"; ctx.lineWidth = 1.5;
        const sx = cw / PITCH_Y, sy = ch / PITCH_X;

        ctx.beginPath();
        ctx.rect(0, 0, cw, ch);
        ctx.moveTo(0, ch / 2); ctx.lineTo(cw, ch / 2);
        ctx.moveTo(cw / 2 + 9.15 * sx, ch / 2); ctx.arc(cw / 2, ch / 2, 9.15 * sy, 0, Math.PI * 2);
        
        const penW = 40.3 * sx, penH = 16.5 * sy;
        ctx.rect((cw - penW) / 2, ch - penH, penW, penH); ctx.rect((cw - penW) / 2, 0, penW, penH);
        const sixW = 18.3 * sx, sixH = 5.5 * sy;
        ctx.rect((cw - sixW) / 2, ch - sixH, sixW, sixH); ctx.rect((cw - sixW) / 2, 0, sixW, sixH);
        ctx.stroke();
    }

    function mapCoords(x, y, cw, ch) { 
        return { cx: (y / PITCH_Y) * cw, cy: ch - ((x / PITCH_X) * ch) }; 
    }

    function drawNetwork(canvasId, teamData, nodeColor) {
        const canvas = document.getElementById(canvasId);
        if(!canvas) return;
        const ctx = canvas.getContext('2d');
        const cw = canvas.width; const ch = canvas.height;

        drawVerticalPitch(ctx, cw, ch);
        if (!teamData || !teamData.nodes || !teamData.links) return;

        const maxPasses = Math.max(...teamData.links.map(l => l.pass_count));
        teamData.links.forEach(link => {
            if (link.pass_count < 3) return;
            const start = mapCoords(link.pass_avg_x, link.pass_avg_y, cw, ch);
            const end = mapCoords(link.pass_avg_x_end, link.pass_avg_y_end, cw, ch);
            
            const intensity = link.pass_count / maxPasses;
            ctx.beginPath(); ctx.moveTo(start.cx, start.cy); ctx.lineTo(end.cx, end.cy);
            ctx.lineWidth = intensity * 8; ctx.strokeStyle = nodeColor;
            ctx.globalAlpha = 0.2 + (intensity * 0.5); ctx.stroke();
        });

        ctx.globalAlpha = 1.0;
        const maxTouches = Math.max(...teamData.nodes.map(n => n.count));
        teamData.nodes.forEach(node => {
            if (!node.pass_avg_x) return;
            const pos = mapCoords(node.pass_avg_x, node.pass_avg_y, cw, ch);
            const radius = 8 + ((node.count / maxTouches) * 10);

            ctx.beginPath(); ctx.arc(pos.cx, pos.cy, radius + 2, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff'; ctx.fill();
            ctx.beginPath(); ctx.arc(pos.cx, pos.cy, radius, 0, Math.PI * 2);
            ctx.fillStyle = nodeColor; ctx.fill();

            const nameParts = node.name.split(' ');
            const shortName = nameParts.length > 1 ? nameParts.pop() : node.name;
            ctx.font = '600 12px Inter'; ctx.fillStyle = '#1a1a1a'; ctx.textAlign = 'center';
            ctx.fillText(shortName, pos.cx, pos.cy - radius - 6);
        });
    }

    // 2. DOM Elements & API Logic
    const API_URL = "https://dvsaigonese-goalline-api.hf.space/api/match-report";
    const fileInput = document.getElementById('htmlFile');
    const fileName = document.getElementById('fileName');
    const uploadForm = document.getElementById('uploadForm');
    const submitBtn = document.getElementById('submitBtn');
    const statusMsg = document.getElementById('statusMessage');
    const downloadBtn = document.getElementById('downloadBtn');
    const reportBox = document.getElementById('reportBox');

    if(fileInput) {
        fileInput.addEventListener('change', e => {
            fileName.textContent = e.target.files[0] ? e.target.files[0].name : "Chưa có file";
        });
    }

    if(uploadForm) {
        uploadForm.addEventListener('submit', async e => {
            e.preventDefault();
            const file = fileInput.files[0];
            if (!file) return;

            submitBtn.disabled = true;
            statusMsg.innerHTML = "⏳ Đang tính toán dữ liệu...";
            statusMsg.style.color = "var(--primary)";
            downloadBtn.style.display = "none";

            const formData = new FormData(); formData.append("file", file);

            try {
                const response = await fetch(API_URL, { method: 'POST', body: formData });
                if (!response.ok) throw new Error(await response.text());
                const reportData = await response.json();

                document.getElementById('homeName').innerText = reportData.home.teamName;
                document.getElementById('awayName').innerText = reportData.away.teamName;
                reportBox.style.display = "flex";

                drawNetwork('homePitch', reportData.home, '#da291c');
                drawNetwork('awayPitch', reportData.away, '#1a1a1a');

                statusMsg.innerHTML = "✅ Biểu đồ đã sẵn sàng!";
                statusMsg.style.color = "var(--success)";
                downloadBtn.style.display = "block";

            } catch (error) {
                statusMsg.innerHTML = "❌ Lỗi: " + error.message;
                statusMsg.style.color = "var(--danger)";
            } finally {
                submitBtn.disabled = false;
            }
        });
    }

    // 3. Export PNG
    // 3. Export PNG (Đã fix lỗi chồng chữ)
    if(downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            downloadBtn.innerHTML = "⏳ Đang xử lý ảnh...";
            
            // BƯỚC 1: Đợi font chữ (Inter) trên web load xong 100% để đo chính xác
            document.fonts.ready.then(() => {
                
                const exportWrapper = document.querySelector('.export-wrapper');
                
                // BƯỚC 2: Tạm thời tắt thuộc tính zoom đi để html2canvas không bị "lú"
                exportWrapper.style.zoom = '1'; 
                
                // Đợi 150ms để trình duyệt kịp update giao diện không zoom
                setTimeout(() => {
                    html2canvas(reportBox, {
                        scale: 2, 
                        backgroundColor: "#f7f6f2",
                        useCORS: true,
                        logging: false // Tắt log cho nhẹ trình duyệt
                    }).then(canvas => {
                        const link = document.createElement('a');
                        link.download = `GoalLine-PassMap-${Date.now()}.png`;
                        link.href = canvas.toDataURL('image/png');
                        link.click();
                        
                        // BƯỚC 3: Chụp xong rồi, bật lại zoom 0.75 cho giao diện gọn gàng như cũ
                        exportWrapper.style.zoom = '0.75';
                        downloadBtn.innerHTML = "⬇️ 3. Export PNG (4:5)";
                    }).catch(err => {
                        console.error("Lỗi xuất ảnh:", err);
                        exportWrapper.style.zoom = '0.75'; // Lỗi cũng phải trả lại giao diện
                        downloadBtn.innerHTML = "⬇️ 3. Export PNG (4:5)";
                    });
                }, 150); 
                
            });
        });
    }
});