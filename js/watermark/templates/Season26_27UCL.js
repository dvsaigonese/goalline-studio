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
        let titleFontSize = width * 0.04; 

        ctx.save();
        ctx.textAlign = 'left'; 
        ctx.textBaseline = 'middle';
        ctx.font = `bold ${titleFontSize}px Albula, Arial, sans-serif`;

        const lineHeight = titleFontSize * 1.3; 
        const centerY = height * 0.85; 
        const startY = centerY - ((lines.length - 1) * lineHeight) / 2;

        const spacingPx = Math.round(titleFontSize * -0.05); 

        lines.forEach((line, index) => {
            const currentY = startY + (index * lineHeight); 
            const textParts = line.split(/({[^}]+})/g); 

            let totalWidth = 0;
            textParts.forEach(part => {
                if (part.length > 0) {
                    const cleanText = part.startsWith('{') && part.endsWith('}') ? part.slice(1, -1) : part;
                    const chars = Array.from(cleanText.normalize('NFC'));
                    for (let i = 0; i < chars.length; i++) {
                        totalWidth += ctx.measureText(chars[i]).width + spacingPx;
                    }
                }
            });
            if (totalWidth > 0) totalWidth -= spacingPx; 

            let currentX = (width - totalWidth) / 2;

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