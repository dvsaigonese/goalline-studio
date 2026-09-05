/**
 * Lấy tọa độ chuột chính xác trên canvas, loại trừ viền (clientLeft/Top)
 * và chuẩn hóa theo tỷ lệ kích thước thực (devicePixelRatio / clientWidth)
 */
export function getMousePos(canvas, evt) {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    // Tọa độ logic thực của Canvas (do ctx.scale(dpr, dpr) xử lý)
    const logicalWidth = canvas.width / dpr;
    const logicalHeight = canvas.height / dpr;
    
    // Chiều rộng/cao hiển thị CSS hiện tại trên màn hình
    const renderedWidth = canvas.clientWidth || logicalWidth;
    const renderedHeight = canvas.clientHeight || logicalHeight;
    
    // Trừ chính xác viền DOM để chuột chạm pixel (0,0) luôn chuẩn xác
    const clientX = evt.clientX - rect.left - (canvas.clientLeft || 0);
    const clientY = evt.clientY - rect.top - (canvas.clientTop || 0);
    
    return {
        x: clientX * (logicalWidth / renderedWidth),
        y: clientY * (logicalHeight / renderedHeight)
    };
}

/**
 * Tạo ID ngẫu nhiên
 */
export function generateId() {
    return Math.random().toString(36).substr(2, 9);
}