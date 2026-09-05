/**
 * Lấy tọa độ chuột chính xác trên canvas, loại trừ viền (clientLeft/Top)
 * và chuẩn hóa theo tỷ lệ kích thước thực (devicePixelRatio / clientWidth)
 */
export function getMousePos(canvas, evt) {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    const logicalWidth = canvas.width / dpr;
    const logicalHeight = canvas.height / dpr;
    
    const renderedWidth = canvas.clientWidth || logicalWidth;
    const renderedHeight = canvas.clientHeight || logicalHeight;
    
    // Tự động bóc tách tọa độ: Nếu là Touch (Mobile) thì lấy ngón đầu tiên, nếu là Mouse (PC) thì lấy clientX/Y
    let clientX = evt.clientX;
    let clientY = evt.clientY;

    if (evt.touches && evt.touches.length > 0) {
        clientX = evt.touches[0].clientX;
        clientY = evt.touches[0].clientY;
    } else if (evt.changedTouches && evt.changedTouches.length > 0) {
        clientX = evt.changedTouches[0].clientX;
        clientY = evt.changedTouches[0].clientY;
    }
    
    const x = clientX - rect.left - (canvas.clientLeft || 0);
    const y = clientY - rect.top - (canvas.clientTop || 0);
    
    return {
        x: x * (logicalWidth / renderedWidth),
        y: y * (logicalHeight / renderedHeight)
    };
}

/**
 * Tạo ID ngẫu nhiên
 */
export function generateId() {
    return Math.random().toString(36).substr(2, 9);
}