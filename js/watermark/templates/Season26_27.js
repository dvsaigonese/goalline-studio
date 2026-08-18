import { addFilmGrain } from '../utils.js';

export default {
    id: 'Season26_27',
    name: 'Season 26/27',
    
    assetsToLoad: [
        { name: 'FrameImage2627', src: 'assets/img/watermarkFrame/Season26_27.png' }
    ],

    render: function(ctx, canvasInfo, globalState) {
        const { width, height } = canvasInfo;
        const { assets, settings } = globalState;

        // 1. Vẽ cái Frame có sẵn vạch line lên trước
        if (assets.FrameImage2627) {
            ctx.drawImage(assets.FrameImage2627, 0, 0, width, height);
        }

        // ==========================================
        // 2. VẼ TÊN GIẢI (GÓC PHẢI TRÊN) & LOGO (GÓC TRÁI)
        // ==========================================
        if (settings.leagueName) {
            // A. Vẽ Tên giải đối xứng với chữ 2026/27
            ctx.save();
            ctx.textAlign = 'right'; 
            ctx.textBaseline = 'middle';
            
            // Kích thước chữ và Toạ độ của Tên Giải (Có thể tinh chỉnh)
            let topFontSize = width * 0.016; 
            const topTextY = height * 0.050; // Chỉnh lên xuống (8.3% chiều cao)
            const topTextX = width * 0.915;  // Lề phải (cách lề 8.5%)

            ctx.font = `bold ${topFontSize}px Albula, Arial, sans-serif`;
            ctx.fillStyle = '#a4a1a1';
            ctx.fillText(settings.leagueName, topTextX, topTextY);
            ctx.restore();
        }

        if (assets.dynamicLeagueLogo) {
            // B. Vẽ Logo xuống dưới logo Goal-Line
            // Bạn thay đổi thông số này cho vừa khít với ô vuông màu tím trong ảnh của bạn
            const logoSize = width * 0.0875; // chiều rộng ảnh tính bằng %
            const logoX = 0;                // Nằm sát mép trái
            const logoY = height * 0.191;   // Chỉnh đẩy lên xuống dưới logo Goal-Line

            ctx.drawImage(assets.dynamicLeagueLogo, logoX, logoY, logoSize, logoSize);
        }

        // ==========================================

        // 3. Vẽ Text tiêu đề đè lên
        this.drawComplexTitle(ctx, canvasInfo, settings);

        // 4. Phủ Film Grain lên trên cùng
        if (settings.grainIntensity > 0) {
            addFilmGrain(ctx, width, height, settings.grainIntensity);
        }
    },

    drawComplexTitle: function(ctx, canvasInfo, settings) {
        const { width, height } = canvasInfo;
        const rawTitle = settings.title || "Hãy nhập {title}"; 
        const lines = rawTitle.split('\n');
        
        let titleFontSize = lines.length === 1 ? width * 0.04 : width * 0.042;
        
        // ĐIỂM CẦN CHÚ Ý: Toạ độ X bắt đầu viết chữ
        const textStartX = width * 0.05; 
        
        // Khoảng cách từ chữ tới đáy ảnh
        const bottomMargin = width * 0.07; 

        ctx.save();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.font = `bold ${titleFontSize}px Albula, Arial, sans-serif`;

        const lineHeight = titleFontSize * 1.3; 
        const baseCenterY = height - bottomMargin; // tâm vạch, chỗ căn giữa

        let startY;
        if (lines.length === 1) {
            // Nếu 1 dòng: Nằm đúng ngay tâm
            startY = baseCenterY;
        } else {
            // Nếu 2 dòng trở lên: 
            // 1. Tính đáy của khối 2-dòng căn giữa
            const baseBottomY = baseCenterY + (lineHeight / 2);
            // 2. Dùng đáy này làm neo, đẩy các dòng ngược lên trên
            startY = baseBottomY - (lines.length - 1) * lineHeight;
        }

        const spacingPx = Math.round(titleFontSize * -0.083); 

        // Hàm hỗ trợ vẽ text khít vào nhau
        function drawTextTight(textStr, x, y) {
            let currX = x;
            const chars = Array.from(textStr.normalize('NFC'));
            for (let i = 0; i < chars.length; i++) {
                const char = chars[i];
                ctx.fillText(char, currX, y);
                currX += ctx.measureText(char).width + spacingPx;
            }
            return currX;
        }

        // Vòng lặp in từng dòng text
        lines.forEach((line, index) => {
            let currentX = textStartX; 
            const currentY = startY + (index * lineHeight); 
            const textParts = line.split(/({[^}]+})/g); 

            textParts.forEach(part => {
                if (part.startsWith('{') && part.endsWith('}')) {
                    ctx.fillStyle = '#eeff55'; // Vàng highlight
                    currentX = drawTextTight(part.slice(1, -1), currentX, currentY); 
                } else if (part.length > 0) {
                    ctx.fillStyle = 'white'; // Trắng bình thường
                    currentX = drawTextTight(part, currentX, currentY);
                }
            });
        });
        
        ctx.restore();
    }
};