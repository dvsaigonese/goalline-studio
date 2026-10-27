// js/watermark/templates/TemplateManager.js
import OriginalTemplate from './original.js';
import WC26Template from './wc26.js';
import Season26_27 from './Season26_27.js';
import Season26_27Stories from './Season26_27Stories.js';
import Season26_27UCL from './Season26_27UCL.js';
import Season26_27UEL from './Season26_27UEL.js';
import { drawStudioTitle, drawBottomVignette } from '../utils.js';

// Cấu hình chuẩn của từng Template để kết nối với Unified Title Engine
const TEMPLATE_TITLE_PRESETS = {
    original: {
        align: 'left',
        showLeftBar: true,
        defaultHighlight: '#e2f90e',
        leftPaddingRatio: 0.025,
        centerYRatio: 0.945,
        kerningRatio: -0.083
    },
    Season26_27: {
        align: 'left',
        showLeftBar: false,
        defaultHighlight: '#eeff55',
        leftPaddingRatio: 0.05,
        centerYRatio: 0.945,
        kerningRatio: -0.083
    },
    Season26_27Stories: {
        align: 'left',
        showLeftBar: false,
        defaultHighlight: '#eeff55',
        leftPaddingRatio: 0.05,
        centerYRatio: 0.93,
        kerningRatio: -0.083
    },
    Season26_27UCL: {
        align: 'center',
        showLeftBar: false,
        defaultHighlight: '#eeff55',
        lineHeightRatio: 1.48,
        centerYRatio: 0.87,
        kerningRatio: -0.04
    },
    Season26_27UEL: {
        align: 'center',
        showLeftBar: false,
        defaultHighlight: '#eeff55',
        lineHeightRatio: 1.48,
        centerYRatio: 0.87,
        kerningRatio: -0.04
    },
    wc26: {
        align: 'center',
        showLeftBar: false,
        defaultHighlight: '#4dd0e2',
        baseFontRatio: 0.045,
        centerYRatio: 0.885,
        kerningRatio: -0.05
    }
};

function enhanceTemplateWithProTitleEngine(tpl) {
    if (!tpl || tpl._proEnhanced) return tpl;
    const preset = tpl.titlePreset || TEMPLATE_TITLE_PRESETS[tpl.id] || {
        align: 'left',
        defaultHighlight: '#eeff55',
        centerYRatio: 0.92
    };

    tpl.defaultHighlightColor = preset.defaultHighlight;

    const unifiedTitleFn = function(ctx, canvasInfo, settings) {
        if (settings.bottomShadow > 0) {
            drawBottomVignette(ctx, canvasInfo.width, canvasInfo.height, settings.bottomShadow);
        }
        drawStudioTitle(ctx, canvasInfo, settings, preset);
    };

    if (typeof tpl.drawComplexTitle === 'function') {
        tpl.drawComplexTitle = unifiedTitleFn;
    }
    if (typeof tpl.drawTitle === 'function') {
        tpl.drawTitle = unifiedTitleFn;
    }
    tpl._proEnhanced = true;
    return tpl;
}

const templates = {
    [OriginalTemplate.id]: enhanceTemplateWithProTitleEngine(OriginalTemplate),
    [WC26Template.id]: enhanceTemplateWithProTitleEngine(WC26Template),
    [Season26_27.id]: enhanceTemplateWithProTitleEngine(Season26_27),
    [Season26_27Stories.id]: enhanceTemplateWithProTitleEngine(Season26_27Stories),
    [Season26_27UCL.id]: enhanceTemplateWithProTitleEngine(Season26_27UCL),
    [Season26_27UEL.id]: enhanceTemplateWithProTitleEngine(Season26_27UEL)
};

export function getTemplate(id) {
    return templates[id] || templates[OriginalTemplate.id];
}

export function getAllTemplates() {
    return Object.values(templates);
}