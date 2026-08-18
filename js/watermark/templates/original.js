import { addFilmGrain } from '../utils.js';

export default {
    id: 'original',
    name: 'Original Standard',
    
    assetsToLoad: [
        { name: 'logoImage', src: 'assets/img/GL_logo.jpg' }, 
        { name: 'logoTxtImage', src: 'assets/img/GL_text_logo.png' },
        { name: 'patternImage', src: 'assets/img/pattern.png' }
    ],

    render: function(ctx, canvasInfo, globalState) {
        const { width, height } = canvasInfo;
        const { assets, settings } = globalState;

        const gradient = ctx.createLinearGradient(0, height * 0.8, 0, height);
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');    
        gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.3)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.65)');  
        ctx.fillStyle = gradient;
        ctx.fillRect(0, height * 0.5, width, height * 0.5); 

        if (assets.patternImage) {
            ctx.save();
            ctx.globalAlpha = settings.patternOpacity;
            ctx.globalCompositeOperation = 'multiply'; 
            const pattern = ctx.createPattern(assets.patternImage, 'repeat');
            ctx.fillStyle = pattern;
            ctx.fillRect(0, 0, width, height);
            ctx.restore();
        }

        if (assets.logoImage) {
            ctx.save();
            ctx.globalAlpha = 0.06;
            ctx.globalCompositeOperation = 'screen'; 
            const giantSize = width * 1.1; 
            ctx.drawImage(assets.logoImage, width - giantSize * 0.49, height - giantSize * 0.55, giantSize, giantSize);
            ctx.restore();

            const smallSize = width * 0.08; 
            const padding = width * 0.03;
            ctx.drawImage(assets.logoImage, padding, padding, smallSize, smallSize);
        }

        if (assets.logoTxtImage) {
            const logoHeight = width * 0.06;
            const logoWidth = logoHeight * (assets.logoTxtImage.naturalWidth / assets.logoTxtImage.naturalHeight);
            const padding = width * 0.035;
            ctx.drawImage(assets.logoTxtImage, width - padding - logoWidth, padding, logoWidth, logoHeight);
        }

        this.drawComplexTitle(ctx, canvasInfo, settings);

        if (settings.grainIntensity > 0) {
            addFilmGrain(ctx, width, height, settings.grainIntensity);
        }
    },

    drawComplexTitle: function(ctx, canvasInfo, settings) {
        const { width, height } = canvasInfo;
        const rawTitle = settings.title || "Hãy nhập {title}"; 
        const lines = rawTitle.split('\n');
        let titleFontSize = lines.length === 1 ? width * 0.04 : width * 0.042;
        const titlePaddingX = width * 0.025; 
        const bottomMargin = width * 0.06; 

        ctx.save();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.font = `bold ${titleFontSize}px Albula, Arial, sans-serif`;

        const lineHeight = titleFontSize * 1.3; 
        const startY = height - bottomMargin - (lines.length - 1) * lineHeight;

        const barWidth = titleFontSize * 0.18;
        let barY, barHeight;

        if (lines.length === 1) {
            barHeight = titleFontSize * 1.85; 
            barY = startY - barHeight / 2;    
        } else {
            const lastLineY = startY + (lines.length - 1) * lineHeight;
            const textBottom = lastLineY + (titleFontSize * 0.45);
            barY = startY - (titleFontSize * 0.1);
            barHeight = textBottom - barY;
        }

        ctx.fillStyle = 'white';
        ctx.fillRect(titlePaddingX, barY, barWidth, barHeight);

        const spacingPx = Math.round(titleFontSize * -0.083); 

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

        lines.forEach((line, index) => {
            let currentX = titlePaddingX + barWidth + (titleFontSize * 0.4); 
            const currentY = startY + (index * lineHeight); 
            const textParts = line.split(/({[^}]+})/g); 

            textParts.forEach(part => {
                if (part.startsWith('{') && part.endsWith('}')) {
                    ctx.fillStyle = '#e2f90e'; 
                    currentX = drawTextTight(part.slice(1, -1), currentX, currentY); 
                } else if (part.length > 0) {
                    ctx.fillStyle = 'white'; 
                    currentX = drawTextTight(part, currentX, currentY);
                }
            });
        });
        ctx.restore();
    }
};