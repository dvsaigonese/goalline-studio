const KEYS = {
    CIRCLES: 'circleObj',
    ARROWS: 'arrowObj',
    TEXTS: 'textObj',
    POLYGONS: 'polygonObj',
    PITCH_TYPE: 'canvasObj' // Giữ key cũ để tương thích
};

export const Storage = {
    save(circles, arrows, texts, polygons, pitchType) {
        localStorage.setItem(KEYS.CIRCLES, JSON.stringify(circles));
        localStorage.setItem(KEYS.ARROWS, JSON.stringify(arrows));
        localStorage.setItem(KEYS.TEXTS, JSON.stringify(texts));
        localStorage.setItem(KEYS.POLYGONS, JSON.stringify(polygons));
        localStorage.setItem(KEYS.PITCH_TYPE, JSON.stringify([pitchType]));
    },

    load() {
        return {
            circles: JSON.parse(localStorage.getItem(KEYS.CIRCLES)) || [],
            arrows: JSON.parse(localStorage.getItem(KEYS.ARROWS)) || [],
            texts: JSON.parse(localStorage.getItem(KEYS.TEXTS)) || [],
            polygons: JSON.parse(localStorage.getItem(KEYS.POLYGONS)) || [],
            pitchType: (JSON.parse(localStorage.getItem(KEYS.PITCH_TYPE)) || [])[0] || 'horizontal'
        };
    },

    clear() {
        localStorage.removeItem(KEYS.CIRCLES);
        localStorage.removeItem(KEYS.ARROWS);
        localStorage.removeItem(KEYS.TEXTS);
        localStorage.removeItem(KEYS.POLYGONS);
        // Không xóa pitchType để giữ setting của user
    }
};