import OriginalTemplate from './original.js';
import WC26Template from './wc26.js';
import Season26_27 from './Season26_27.js';
// Tương lai bạn tạo thêm file epl24.js thì import nó ở đây

// Đăng ký các template vào object này
const templates = {
    [OriginalTemplate.id]: OriginalTemplate,
    [WC26Template.id]: WC26Template,
    [Season26_27.id]: Season26_27,
};

export function getTemplate(id) {
    // Nếu không tìm thấy id template, tự động lấy original làm mặc định
    return templates[id] || OriginalTemplate; 
}

export function getAllTemplates() {
    return Object.values(templates);
}