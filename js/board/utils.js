/**
 * Lấy tọa độ chuột chính xác trên canvas đã scale
 */
export function getMousePos(canvas, evt) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: evt.clientX - rect.left,
        y: evt.clientY - rect.top
    };
}

/**
 * Tạo ID ngẫu nhiên (nếu cần sau này để quản lý object)
 */
export function generateId() {
    return Math.random().toString(36).substr(2, 9);
}