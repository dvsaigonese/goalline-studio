// js/board/storage.js
const KEYS = {
    CIRCLES: 'circleObj',
    ARROWS: 'arrowObj',
    TEXTS: 'textObj',
    POLYGONS: 'polygonObj',
    HIGHLIGHTS: 'highlightObj',
    HIGHLIGHT_LINKS: 'highlightLinkObj',
    PITCH_TYPE: 'canvasObj'
};

export const Storage = {
    save(circles, arrows, texts, polygons, pitchType, highlights = [], highlightLinks = []) {
        localStorage.setItem(KEYS.CIRCLES, JSON.stringify(circles));
        localStorage.setItem(KEYS.ARROWS, JSON.stringify(arrows));
        localStorage.setItem(KEYS.TEXTS, JSON.stringify(texts));
        localStorage.setItem(KEYS.POLYGONS, JSON.stringify(polygons));
        localStorage.setItem(KEYS.HIGHLIGHTS, JSON.stringify(highlights));
        localStorage.setItem(KEYS.HIGHLIGHT_LINKS, JSON.stringify(highlightLinks));
        localStorage.setItem(KEYS.PITCH_TYPE, JSON.stringify([pitchType]));
    },

    load() {
        return {
            circles: JSON.parse(localStorage.getItem(KEYS.CIRCLES)) || [],
            arrows: JSON.parse(localStorage.getItem(KEYS.ARROWS)) || [],
            texts: JSON.parse(localStorage.getItem(KEYS.TEXTS)) || [],
            polygons: JSON.parse(localStorage.getItem(KEYS.POLYGONS)) || [],
            highlights: JSON.parse(localStorage.getItem(KEYS.HIGHLIGHTS)) || [],
            highlightLinks: JSON.parse(localStorage.getItem(KEYS.HIGHLIGHT_LINKS)) || [],
            pitchType: (JSON.parse(localStorage.getItem(KEYS.PITCH_TYPE)) || [])[0] || 'horizontal'
        };
    },

    clear() {
        localStorage.removeItem(KEYS.CIRCLES);
        localStorage.removeItem(KEYS.ARROWS);
        localStorage.removeItem(KEYS.TEXTS);
        localStorage.removeItem(KEYS.POLYGONS);
        localStorage.removeItem(KEYS.HIGHLIGHTS);
        localStorage.removeItem(KEYS.HIGHLIGHT_LINKS);
    }
};