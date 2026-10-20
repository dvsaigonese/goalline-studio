import { addFilmGrain } from '../utils.js';

export default {
    id: 'Season26_27UCL',
    name: 'Season 26/27 UCL',
    
    assetsToLoad: [
        { name: 'FrameImage2627UCL', src: 'assets/img/watermarkFrame/Season26_27UCL.png' }
    ],

    render: function(ctx, canvasInfo, globalState) {
        const { width, height } = canvasInfo;
        const { assets, settings } = globalState;

        if (assets.FrameImage2627UCL) {
            ctx.drawImage(assets.FrameImage2627UCL, 0, 0, width, height);
        }

        if (settings.grainIntensity > 0) {
            addFilmGrain(ctx, width, height, settings.grainIntensity);
        }

        this.drawTitle(ctx, canvasInfo, settings);
    },

    drawTitle: function(ctx, canvasInfo, settings) {
        const { width, height } = canvasInfo;
        const rawTitle = settings.title || "Hãy nhập {title}"; 
        const lines = rawTitle.split('\n');
        
        // Cỡ chữ chuẩn tỉ lệ poster 1200x1500
        const titleFontSize = width * 0.04; // 48px

        ctx.save();
        ctx.textAlign = 'left'; 
        ctx.textBaseline = 'middle';
        ctx.font = `bold ${titleFontSize}px Albula, Arial, sans-serif`;

        // Giãn dòng thoáng đãng, chống dính dấu thanh tiếng Việt
        const lineHeight = Math.round(titleFontSize * 1.48); // ~70px

        // Tọa độ tâm chuẩn của 2 dòng theo ảnh mẫu ENZO (hạ thấp xuống 0.885)
        const sampleCenterY = height * 0.87; // ~1328px

        // LOGIC TỰ ĐỘNG TÍNH TOẠ ĐỘ DÒNG ĐẦU TIÊN (startY)
        let startY;
        if (lines.length <= 2) {
            // 1 dòng: rơi vào đúng tâm giữa 2 dòng mẫu
            // 2 dòng: đối xứng đúng vị trí dòng 1 & 2 của mẫu
            startY = sampleCenterY - ((lines.length - 1) * lineHeight) / 2;
        } else {
            // 3 dòng trở lên: cố định dòng cuối ở vị trí dòng 2 của mẫu, đôn các dòng trước lên trên
            const fixedBottomY = sampleCenterY + (lineHeight / 2);
            startY = fixedBottomY - ((lines.length - 1) * lineHeight);
        }

        // Kerning nhẹ giúp chữ liên kết chắc chắn
        const spacingPx = Math.round(titleFontSize * -0.04); 

        lines.forEach((line, index) => {
            const currentY = startY + (index * lineHeight); 
            const textParts = line.split(/({[^}]+})/g); 

            // 1. Đo tổng bề ngang của cả dòng để căn giữa Canvas
            let totalWidth = 0;
            textParts.forEach(part => {
                if (part.length > 0) {
                    const isHighlight = part.startsWith('{') && part.endsWith('}');
                    const cleanText = isHighlight ? part.slice(1, -1) : part;
                    const chars = Array.from(cleanText.normalize('NFC'));
                    for (let i = 0; i < chars.length; i++) {
                        totalWidth += ctx.measureText(chars[i]).width + spacingPx;
                    }
                }
            });
            if (totalWidth > 0) totalWidth -= spacingPx; 

            let currentX = (width - totalWidth) / 2;

            // 2. Vẽ từng ký tự & tô màu vàng highlight {từ khóa}
            textParts.forEach(part => {
                if (part.length === 0) return;
                const isHighlight = part.startsWith('{') && part.endsWith('}');
                const cleanText = isHighlight ? part.slice(1, -1) : part;

                ctx.fillStyle = isHighlight ? '#eeff55' : 'white';

                const chars = Array.from(cleanText.normalize('NFC'));
                for (let i = 0; i < chars.length; i++) {
                    const char = chars[i];
                    ctx.fillText(char, currentX, currentY);
                    currentX += ctx.measureText(char).width + spacingPx;
                }
            });
        });

        ctx.restore();
    }
};