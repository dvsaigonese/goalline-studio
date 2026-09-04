import OriginalTemplate from './original.js';
import WC26Template from './wc26.js';
import Season26_27 from './Season26_27.js';
import Season26_27Stories from './Season26_27Stories.js';
import Season26_27UCL from './Season26_27UCL.js';
import Season26_27UEL from './Season26_27UEL.js';
// Tương lai bạn tạo thêm file epl24.js thì import nó ở đây

// Đăng ký các template vào object này
const templates = {
    [OriginalTemplate.id]: OriginalTemplate,
    [WC26Template.id]: WC26Template,
    [Season26_27.id]: Season26_27,
    [Season26_27Stories.id]: Season26_27Stories,
    [Season26_27UCL.id]: Season26_27UCL,
    [Season26_27UEL.id]: Season26_27UEL
};

export function getTemplate(id) {
    // Nếu không tìm thấy id template, tự động lấy original làm mặc định
    return templates[id] || OriginalTemplate; 
}

export function getAllTemplates() {
    return Object.values(templates);
}