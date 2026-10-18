/**
 * ==============================================================================
 * GOAL-LINE STUDIO - EDITORIAL & DESIGN SCHEDULE ENGINE (schedule.js)
 * ==============================================================================
 * Quản lý toàn bộ:
 * 1. Cấu hình Supabase & State ứng dụng
 * 2. Bảng mã màu độc quyền Ban Design
 * 3. Tải & đồng bộ dữ liệu từ Database (Schedules, Design Tasks, Leaves)
 * 4. Phân ca trực tuần (Content, Trực Page 5 ca, Des Ca)
 * 5. Bảng quản lý Task Design Backlog (Lọc, Checkbox, Xóa kèm dọn sạch Storage)
 * 6. Lightbox & Tải ảnh gốc (Hỗ trợ Save to Photos trên iOS qua Web Share API)
 * 7. Bảng theo dõi Nghỉ phép (Leaves)
 * 8. Đôn tuần mới (Promote Week - PIN 2026)
 * 9. Điều hướng Tab & Giao diện (Content / Design, Tuần này / Tuần sau)
 * 10. Cơ chế Realtime & Tự động phục hồi khi mở lại điện thoại (Deep-Sleep)
 * ==============================================================================
 */

// ==============================================================================
// PHẦN 1: CẤU HÌNH SUPABASE & KHỞI TẠO STATE
// ==============================================================================
const SUPABASE_URL = 'https://exutfqxfwurwyfyxzskj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4dXRmcXhmd3Vyd3lmeXh6c2tqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4NTM0MzksImV4cCI6MjEwNjQyOTQzOX0.e3DZMEaGqgEQjMbUrll718a0lWFjY011wzPPLqh9Ls8';

// Khởi tạo Supabase client toàn cục trên window
window.sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// State quản lý lịch phân ca
let currentTab = 'current'; // 'current' (Tuần này) hoặc 'next' (Tuần sau)
let scheduleCache = { current: null, next: null };

// State quản lý Task Design & Nghỉ phép
let designTasks = [];
let leavesList = [];
let activeTaskFilter = 'all'; // 'all', 'DESIGN', 'DONE'
let selectedTaskIds = new Set(); // Chứa các ID task được tick chọn

// State Modal xem ảnh
let currentTaskModalImageUrl = '';
let currentTaskModalImageTitle = '';

// ==============================================================================
// PHẦN 2: BẢNG MÃ MÀU ĐỘC QUYỀN BAN DESIGN (DICTIONARY)
// ==============================================================================
const DESIGNER_COLORS = {
  'Quýt':    { bg: '#FF9900', color: '#000000' }, // Cam sáng (chữ đen)
  'Kaiz':    { bg: '#FF0000', color: '#ffffff' }, // Đỏ tươi (chữ trắng)
  'Naruto':  { bg: '#980000', color: '#ffffff' }, // Đỏ đô đậm (chữ trắng)
  'Ruben':   { bg: '#B6D7A8', color: '#000000' }, // Xanh lá pastel (chữ đen)
  'Cakashi': { bg: '#D0E0E3', color: '#000000' }  // Xanh băng nhạt (chữ đen)
};

/**
 * Hàm lấy style màu cho thẻ slot-pill
 */
function getMemberPillStyle(member, columnKey, fallbackBg = '') {
  if (columnKey === 'design_shifts_data' && DESIGNER_COLORS[member]) {
    const config = DESIGNER_COLORS[member];
    return `background: ${config.bg}; color: ${config.color}; border: 2px solid #000;`;
  }
  
  if (columnKey === 'design_shifts_data') {
    return `background: #ff944d; color: #000; border: 2px solid #000;`;
  }
  
  return '';
}

// ==============================================================================
// PHẦN 3: TẢI DỮ LIỆU TỪ SUPABASE DATABASE & AUTO-MIGRATION 5 CA TRỰC PAGE
// ==============================================================================

// Cấu trúc chuẩn 5 ca trực Fanpage mỗi ngày
const DEFAULT_5_POSTING_SHIFTS = [
  { shift: "Sáng",  time: "6h - 10h",  slots: [[], [], [], [], [], [], []] },
  { shift: "Trưa",  time: "10h - 14h", slots: [[], [], [], [], [], [], []] },
  { shift: "Chiều", time: "14h - 18h", slots: [[], [], [], [], [], [], []] },
  { shift: "Tối",   time: "19h - 23h", slots: [[], [], [], [], [], [], []] },
  { shift: "Đêm",   time: "23h - 6h",  slots: [[], [], [], [], [], [], []] }
];

async function fetchScheduleData() {
  const { data, error } = await window.sb.from('schedules').select('*');
  if (error) return console.error('Lỗi lấy lịch ca trực:', error.message);

  for (const item of data) {
    // Tự động nâng cấp bảng trực Page từ bản 2 ca cũ lên chuẩn 5 ca mới
    if (item.posting_data && item.posting_data.length < 5 && (item.id === 'current' || item.id === 'next')) {
      item.posting_data = JSON.parse(JSON.stringify(DEFAULT_5_POSTING_SHIFTS));
      window.sb.from('schedules').update({ posting_data: item.posting_data }).eq('id', item.id).then();
    }
    scheduleCache[item.id] = item;
  }
  renderActiveSchedule();
}

async function fetchDesignTasks() {
  const { data, error } = await window.sb
    .from('design_tasks')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) return console.error('Lỗi lấy danh sách task:', error.message);
  designTasks = data || [];
  renderDesignTasks();
}

async function fetchLeavesData() {
  const { data, error } = await window.sb
    .from('leaves')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return console.error('Lỗi lấy danh sách nghỉ phép:', error.message);
  leavesList = data || [];
  renderLeavesTable();
}
// ==============================================================================
// TỰ ĐỘNG GOM SLOT T7/CN CŨ VÀO 2 Ô HỢP NHẤT (KHÔNG MẤT DỮ LIỆU ĐĂNG KÝ)
// ==============================================================================
function autoMigrateContentWeekends(weekObj, id) {
  if (!weekObj || !weekObj.writing_short_data) return;
  let changed = false;

  // Gom các slot T7 (idx 5) & CN (idx 6) từ dòng Trưa (1) & Chiều (2) về Ô 1 (dòng 0)
  [5, 6].forEach(colIdx => {
    for (let r = 1; r < weekObj.writing_short_data.length; r++) {
      const oldSlots = weekObj.writing_short_data[r].slots[colIdx];
      if (Array.isArray(oldSlots) && oldSlots.length > 0) {
        oldSlots.forEach(member => {
          if (!weekObj.writing_short_data[0].slots[colIdx].includes(member)) {
            weekObj.writing_short_data[0].slots[colIdx].push(member);
          }
        });
        weekObj.writing_short_data[r].slots[colIdx] = [];
        changed = true;
      }
    }
  });

  // Gom các slot T7 & CN từ dòng Tối 2 về Ô 2 (dòng 0 của writing_long_data)
  if (weekObj.writing_long_data && weekObj.writing_long_data.length > 1) {
    [5, 6].forEach(colIdx => {
      const oldSlots = weekObj.writing_long_data[1].slots[colIdx];
      if (Array.isArray(oldSlots) && oldSlots.length > 0) {
        oldSlots.forEach(member => {
          if (!weekObj.writing_long_data[0].slots[colIdx].includes(member)) {
            weekObj.writing_long_data[0].slots[colIdx].push(member);
          }
        });
        weekObj.writing_long_data[1].slots[colIdx] = [];
        changed = true;
      }
    });
  }

  if (changed) {
    window.sb.from('schedules').update({
      writing_short_data: weekObj.writing_short_data,
      writing_long_data: weekObj.writing_long_data,
      updated_at: new Date()
    }).eq('id', id).then();
  }
}

// ==============================================================================
// PHẦN 4: RENDER BẢNG PHÂN CA TRỰC TUẦN
// ==============================================================================
function renderActiveSchedule() {
  const weekObj = scheduleCache[currentTab];
  if (!weekObj) return;

  // Tự động bảo toàn dữ liệu T7 & CN
  autoMigrateContentWeekends(weekObj, currentTab);

  const labelEl = document.getElementById('current-week-label');
  if (labelEl) labelEl.innerText = weekObj.week_label;

  const myName = localStorage.getItem('gl_current_user') || 'Vinci';

  // Helper render ruột một ô slot
  const renderSlotCellContent = (slotsArr, columnKey, rIdx, cIdx, maxCapacity, customTag = '') => {
    const isFull = slotsArr.length >= maxCapacity;
    return `
      <div class="slot-container">
        ${customTag ? `<div class="weekend-group-tag ${customTag.includes('MATCHDAY') ? 'tag-matchday' : ''}">${customTag}</div>` : ''}
        ${slotsArr.map((member, sIdx) => {
          const pillStyle = getMemberPillStyle(member, columnKey, '');
          return `
            <div class="slot-pill" style="${pillStyle}" 
                 onclick="handleRemoveSlot('${columnKey}', ${rIdx},${cIdx}, ${sIdx}, '${member}')" 
                 title="Click để hủy ca">
              <strong>${member}</strong>${member === myName ? `<i class="fa-solid fa-xmark btn-del-mini" style="color: inherit;"></i>` : ''}
            </div>
          `;
        }).join('')}
        ${!isFull ? `
          <button class="btn-slot-join" onclick="handleAddSlot('${columnKey}',${rIdx}, ${cIdx},${maxCapacity})">
            + Nhận (${slotsArr.length}/${maxCapacity})
          </button>
        ` : `<span class="slot-full-tag">ĐÃ ĐỦ ${maxCapacity} NGƯỜI</span>`}
      </div>
    `;
  };

  // 1. RENDER BẢNG CONTENT DUY NHẤT (5 DÒNG, T7 & CN GỘP THÀNH 2 Ô LỚN)
  const bodyContent = document.getElementById('body-writing-content');
  if (bodyContent) {
    const shortRows = weekObj.writing_short_data || [];
    const longRows = weekObj.writing_long_data || [];

    let html = '';

    // DÒNG 0: Sáng (Trước 9h) - Chứa Ô lớn T7 & CN thứ nhất (rowspan=3)
    const r0 = shortRows[0] || { shift: "Sáng", time: "Trước 9h", slots: [[],[],[],[],[],[],[]] };
    html += `<tr>
      <td class="shift-title">${r0.shift || 'Sáng'}</td>
      <td class="shift-time">${r0.time || 'Trước 9h'}</td>`;
    for (let c = 0; c <= 4; c++) {
      const slots = Array.isArray(r0.slots[c]) ? r0.slots[c] : [];
      html += `<td>${renderSlotCellContent(slots, 'writing_short_data', 0, c, 5)}</td>`;
    }
    // Ô T7 (rowspan=3, max 5 slot bài ngắn)
    const t7Short = Array.isArray(r0.slots[5]) ? r0.slots[5] : [];
    html += `<td rowspan="3" class="weekend-slot-cell">
      ${renderSlotCellContent(t7Short, 'writing_short_data', 0, 5, 5, '⚡ BÀI NGẮN')}
    </td>`;
    // Ô CN (rowspan=3, max 5 slot bài ngắn)
    const cnShort = Array.isArray(r0.slots[6]) ? r0.slots[6] : [];
    html += `<td rowspan="3" class="weekend-slot-cell">
      ${renderSlotCellContent(cnShort, 'writing_short_data', 0, 6, 5, '⚡ BÀI NGẮN')}
    </td></tr>`;

    // DÒNG 1: Trưa (Trước 11h) - T7 & CN bị gộp nên chỉ render T2 -> T6
    const r1 = shortRows[1] || { shift: "Trưa", time: "Trước 11h", slots: [[],[],[],[],[],[],[]] };
    html += `<tr>
      <td class="shift-title">${r1.shift || 'Trưa'}</td>
      <td class="shift-time">${r1.time || 'Trước 11h'}</td>`;
    for (let c = 0; c <= 4; c++) {
      const slots = Array.isArray(r1.slots[c]) ? r1.slots[c] : [];
      html += `<td>${renderSlotCellContent(slots, 'writing_short_data', 1, c, 5)}</td>`;
    }
    html += `</tr>`;

    // DÒNG 2: Chiều (14h - 18h) - T2 -> T6
    const r2 = shortRows[2] || { shift: "Chiều", time: "14h - 18h", slots: [[],[],[],[],[],[],[]] };
    html += `<tr>
      <td class="shift-title">${r2.shift || 'Chiều'}</td>
      <td class="shift-time">${r2.time || '14h - 18h'}</td>`;
    for (let c = 0; c <= 4; c++) {
      const slots = Array.isArray(r2.slots[c]) ? r2.slots[c] : [];
      html += `<td>${renderSlotCellContent(slots, 'writing_short_data', 2, c, 5)}</td>`;
    }
    html += `</tr>`;

    // DÒNG 3: Tối 1 (19h) - Chứa Ô lớn T7 & CN thứ hai (rowspan=2)
    const r3 = longRows[0] || { shift: "Tối 1", time: "19h", slots: [[],[],[],[],[],[],[]] };
    html += `<tr>
      <td class="shift-title">${r3.shift || 'Tối 1'}</td>
      <td class="shift-time">${r3.time || '19h (Dài)'}</td>`;
    for (let c = 0; c <= 4; c++) {
      const slots = Array.isArray(r3.slots[c]) ? r3.slots[c] : [];
      html += `<td>${renderSlotCellContent(slots, 'writing_long_data', 0, c, 3)}</td>`;
    }
    // Ô T7 (rowspan=2, max 5 slot Matchday)
    const t7Match = Array.isArray(r3.slots[5]) ? r3.slots[5] : [];
    html += `<td rowspan="2" class="weekend-slot-cell weekend-matchday-cell">
      ${renderSlotCellContent(t7Match, 'writing_long_data', 0, 5, 5, '🔥 FULL-TIME')}
    </td>`;
    // Ô CN (rowspan=2, max 5 slot Matchday)
    const cnMatch = Array.isArray(r3.slots[6]) ? r3.slots[6] : [];
    html += `<td rowspan="2" class="weekend-slot-cell weekend-matchday-cell">
      ${renderSlotCellContent(cnMatch, 'writing_long_data', 0, 6, 5, '🔥 FULL-TIME')}
    </td></tr>`;

    // DÒNG 4: Tối 2 (21h) - T2 -> T6
    const r4 = longRows[1] || { shift: "Tối 2", time: "21h", slots: [[],[],[],[],[],[],[]] };
    html += `<tr>
      <td class="shift-title">${r4.shift || 'Tối 2'}</td>
      <td class="shift-time">${r4.time || '21h (Dài)'}</td>`;
    for (let c = 0; c <= 4; c++) {
      const slots = Array.isArray(r4.slots[c]) ? r4.slots[c] : [];
      html += `<td>${renderSlotCellContent(slots, 'writing_long_data', 1, c, 3)}</td>`;
    }
    html += `</tr>`;

    bodyContent.innerHTML = html;
  }

  // 2. Bảng Trực Page (5 ca/ngày) & Des Ca giữ nguyên logic
  const renderMultiSlotRows = (dataMatrix, columnKey, maxCapacity, customBg = '') => {
    if (!dataMatrix) return '';
    return dataMatrix.map((row, rIdx) => `
      <tr>
        <td class="shift-title">${row.shift}</td>
        <td class="shift-time">${row.time}</td>
        ${row.slots.map((cellSlots, cIdx) => {
          const slotsArr = Array.isArray(cellSlots) ? cellSlots : (cellSlots ? [cellSlots] : []);
          const isFull = slotsArr.length >= maxCapacity;
          return `
            <td>
              <div class="slot-container">
                ${slotsArr.map((member, sIdx) => {
                  const pillStyle = getMemberPillStyle(member, columnKey, customBg);
                  return `
                    <div class="slot-pill" style="${pillStyle}" 
                         onclick="handleRemoveSlot('${columnKey}', ${rIdx}, ${cIdx}, ${sIdx}, '${member}')" 
                         title="Click để hủy ca">
                      <strong>${member}</strong>
                      ${member === myName ? `<i class="fa-solid fa-xmark btn-del-mini" style="color: inherit;"></i>` : ''}
                    </div>
                  `;
                }).join('')}
                ${!isFull ? `
                  <button class="btn-slot-join" onclick="handleAddSlot('${columnKey}', ${rIdx}, ${cIdx}, ${maxCapacity})">
                    + Nhận (${slotsArr.length}/${maxCapacity})
                  </button>
                ` : `<span class="slot-full-tag">ĐÃ ĐỦ ${maxCapacity} NGƯỜI</span>`}
              </div>
            </td>
          `;
        }).join('')}
      </tr>
    `).join('');
  };

  const bodyPosting = document.getElementById('body-posting');
  if (bodyPosting) {
    bodyPosting.innerHTML = renderMultiSlotRows(weekObj.posting_data, 'posting_data', 2, 'var(--neo-blue)');
  }

  const bodyDesignShifts = document.getElementById('body-design-shifts');
  if (bodyDesignShifts) {
    bodyDesignShifts.innerHTML = renderMultiSlotRows(weekObj.design_shifts_data, 'design_shifts_data', 2, 'var(--neo-orange)');
  }
}

// Xử lý nhận ca trực
window.handleAddSlot = async (columnKey, rIdx, cIdx, maxCapacity) => {
  const myName = localStorage.getItem('gl_current_user') || 'Vinci';
  const targetWeek = scheduleCache[currentTab];
  if (!targetWeek) return;

  const currentSlots = Array.isArray(targetWeek[columnKey][rIdx].slots[cIdx])
    ? targetWeek[columnKey][rIdx].slots[cIdx] : [];

  if (currentSlots.length >= maxCapacity) return alert(`Ca này đã đủ ${maxCapacity} thành viên!`);
  if (currentSlots.includes(myName)) return alert(`Bạn (${myName}) đã nhận slot này rồi!`);

  if (!confirm(`Nhận 1 slot ca này cho [${myName}]?`)) return;

  const updatedMatrix = JSON.parse(JSON.stringify(targetWeek[columnKey]));
  if (!Array.isArray(updatedMatrix[rIdx].slots[cIdx])) updatedMatrix[rIdx].slots[cIdx] = [];
  updatedMatrix[rIdx].slots[cIdx].push(myName);

  await window.sb.from('schedules').update({ 
    [columnKey]: updatedMatrix, 
    updated_at: new Date() 
  }).eq('id', currentTab);
};

// Xử lý hủy ca trực
window.handleRemoveSlot = async (columnKey, rIdx, cIdx, sIdx, memberName) => {
  const myName = localStorage.getItem('gl_current_user') || 'Vinci';
  const targetWeek = scheduleCache[currentTab];
  if (!targetWeek) return;

  if (memberName === myName) {
    if (!confirm(`Hủy ca của bạn (${myName})?`)) return;
  } else {
    const pin = prompt(`Slot của [${memberName}]. Nhập PIN Admin để xóa:`);
    if (pin !== '2026') return pin !== null && alert('Sai mã PIN Admin!');
  }

  const updatedMatrix = JSON.parse(JSON.stringify(targetWeek[columnKey]));
  updatedMatrix[rIdx].slots[cIdx].splice(sIdx, 1);

  await window.sb.from('schedules').update({ 
    [columnKey]: updatedMatrix, 
    updated_at: new Date() 
  }).eq('id', currentTab);
};

// ==============================================================================
// PHẦN 5: QUẢN LÝ TASK DESIGN BACKLOG
// ==============================================================================
function renderDesignTasks() {
  const tbody = document.getElementById('body-design-tasks');
  if (!tbody) return;
  tbody.innerHTML = '';

  const filtered = designTasks.filter(t => {
    if (activeTaskFilter === 'all') return true;
    if (activeTaskFilter === 'DESIGN') return t.status === 'DESIGN' || t.status === 'PENDING';
    if (activeTaskFilter === 'DONE') return t.status === 'DONE';
    return true;
  });

  const countAll = document.getElementById('count-tasks-all');
  const countDesign = document.getElementById('count-tasks-design');
  const countDone = document.getElementById('count-tasks-done');

  if (countAll) countAll.innerText = designTasks.length;
  if (countDesign) countDesign.innerText = designTasks.filter(t => t.status === 'DESIGN' || t.status === 'PENDING').length;
  if (countDone) countDone.innerText = designTasks.filter(t => t.status === 'DONE').length;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:25px; font-weight:700;">CHƯA CÓ TASK DESIGN TRONG MỤC NÀY</td></tr>`;
    updateTaskBatchUI();
    return;
  }

  filtered.forEach(t => {
    const tr = document.createElement('tr');
    let typeClass = 'type-other';
    if (t.task_type && t.task_type.includes('SPECIAL')) typeClass = 'type-special';
    if (t.task_type && t.task_type.includes('THREADS')) typeClass = 'type-threads';

    const isChecked = selectedTaskIds.has(String(t.id)) ? 'checked' : '';

    let imageCellMarkup = `<span style="color:#aaa; font-size:0.75rem;">(Chưa đính kèm)</span>`;
    const cleanUrl = (t.img_url || '').trim();

    if (cleanUrl !== '') {
      if (cleanUrl.includes('drive.google.com')) {
        imageCellMarkup = `
          <a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" class="slot-pill" style="text-decoration:none; display:inline-flex; align-items:center; gap:6px; background:var(--neo-yellow); color:#000; font-size:0.75rem; font-weight:900;" title="Mở Google Drive">
            <i class="fa-brands fa-google-drive"></i> Link Drive
          </a>
        `;
      } else if (cleanUrl.startsWith('http')) {
        imageCellMarkup = `
          <div class="img-thumb-box img-thumb-clickable" title="Click để phóng to ảnh">
            <img src="${cleanUrl}" alt="Thumbnail" referrerpolicy="no-referrer" loading="lazy" onerror="this.onerror=null; this.src='assets/img/GL_logo.jpg';">
          </div>
        `;
      }
    }

    tr.innerHTML = `
      <td style="text-align: center;">
        <input type="checkbox" class="neo-checkbox task-row-checkbox" data-id="${t.id}" ${isChecked}>
      </td>
      <td><span class="tag-task-type ${typeClass}">${t.task_type}</span></td>
      <td><strong>${t.brief}</strong></td>
      <td><span class="tag-priority-badge">${t.priority}</span></td>
      <td style="font-size:0.85rem; color:#555;">${t.note || '--'}</td>
      <td>${imageCellMarkup}</td>
      <td style="text-align:center;">
        <span class="tag-status-pill ${t.status === 'DONE' ? 'tag-status-done' : ''}" title="Click để chuyển trạng thái">
          ${t.status}
        </span>
      </td>
      <td>
        <div class="table-actions">
          <button class="btn-action-icon btn-task-edit" style="color:#0984e3;" title="Chỉnh sửa task">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
          <button class="btn-action-icon btn-task-copy" title="Copy tiêu đề / brief">
            <i class="fa-solid fa-copy"></i>
          </button>
          <button class="btn-action-icon btn-task-del" style="color:red;" title="Xóa task">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </td>
    `;

    const thumbBox = tr.querySelector('.img-thumb-clickable');
    if (thumbBox) thumbBox.onclick = () => openTaskImage(cleanUrl, t.brief);

    const statusPill = tr.querySelector('.tag-status-pill');
    if (statusPill) statusPill.onclick = () => toggleTaskStatus(t.id, t.status);

    const btnEdit = tr.querySelector('.btn-task-edit');
    if (btnEdit) btnEdit.onclick = () => openEditTaskModal(t.id);

    const btnCopy = tr.querySelector('.btn-task-copy');
    if (btnCopy) btnCopy.onclick = () => copyBrief(t.brief);

    const btnDel = tr.querySelector('.btn-task-del');
    if (btnDel) btnDel.onclick = () => deleteDesignTask(t.id);

    tbody.appendChild(tr);
  });

  document.querySelectorAll('.task-row-checkbox').forEach(cb => {
    cb.onchange = (e) => {
      const id = String(e.target.dataset.id);
      if (e.target.checked) selectedTaskIds.add(id);
      else selectedTaskIds.delete(id);
      updateTaskBatchUI();
    };
  });

  updateTaskBatchUI();
}

function updateTaskBatchUI() {
  const btnBatch = document.getElementById('btn-batch-del-tasks');
  const countEl = document.getElementById('selected-task-count');
  const checkAllBox = document.getElementById('check-all-tasks');

  const count = selectedTaskIds.size;
  if (countEl) countEl.innerText = count;

  if (btnBatch) btnBatch.style.display = count > 0 ? 'inline-flex' : 'none';

  const rowBoxes = document.querySelectorAll('.task-row-checkbox');
  if (checkAllBox) {
    checkAllBox.checked = rowBoxes.length > 0 && Array.from(rowBoxes).every(cb => cb.checked);
  }
}

const checkAllTasksBox = document.getElementById('check-all-tasks');
if (checkAllTasksBox) {
  checkAllTasksBox.onchange = (e) => {
    const isChecked = e.target.checked;
    const filtered = designTasks.filter(t => {
      if (activeTaskFilter === 'all') return true;
      if (activeTaskFilter === 'DESIGN') return t.status === 'DESIGN' || t.status === 'PENDING';
      if (activeTaskFilter === 'DONE') return t.status === 'DONE';
      return true;
    });

    filtered.forEach(t => {
      const strId = String(t.id);
      if (isChecked) selectedTaskIds.add(strId);
      else selectedTaskIds.delete(strId);
    });

    document.querySelectorAll('.task-row-checkbox').forEach(cb => { cb.checked = isChecked; });
    updateTaskBatchUI();
  };
}

// Tiện ích Storage cho Task Design
function extractStorageFileName(url) {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(/\/stack-assets\/([^?#]+)/);
  if (match && match[1]) {
    try {
      return decodeURIComponent(match[1]);
    } catch (e) {
      return match[1];
    }
  }
  return null;
}

async function deleteFilesFromStorage(fileNames) {
  const validFiles = fileNames.filter(Boolean);
  if (validFiles.length === 0) return;

  try {
    const { data, error } = await window.sb.storage.from('stack-assets').remove(validFiles);
    if (error) console.error('Lỗi khi xóa file Task khỏi Storage:', error.message);
    else console.log(`Đã xóa sạch ${validFiles.length} file Task khỏi Storage:`, validFiles, data);
  } catch (err) {
    console.error('Lỗi kết nối khi dọn file Task:', err);
  }
}

// Xóa 1 task đơn lẻ
window.deleteDesignTask = async (id) => {
  const task = designTasks.find(t => String(t.id) === String(id));
  if (!task) return;

  if (!confirm(`Bạn có chắc chắn muốn xóa task: "${task.brief}"?`)) return;

  const storageFileName = extractStorageFileName(task.img_url);
  if (storageFileName) await deleteFilesFromStorage([storageFileName]);

  const { error } = await window.sb.from('design_tasks').delete().eq('id', id);
  if (error) {
    alert("Lỗi khi xóa task: " + error.message);
  } else {
    selectedTaskIds.delete(String(id));
    selectedTaskIds.delete(Number(id));
    fetchDesignTasks();
  }
};

// Xóa hàng loạt Task Design
const btnBatchDelTasks = document.getElementById('btn-batch-del-tasks');
if (btnBatchDelTasks) {
  btnBatchDelTasks.onclick = async () => {
    if (selectedTaskIds.size === 0) return;

    const pin = prompt(`Bạn đang chọn xóa ${selectedTaskIds.size} task design.\nNhập mã PIN Admin để xác nhận:`);
    if (pin !== '2026') {
      if (pin !== null) alert("Sai mã PIN Admin!");
      return;
    }

    const selectedStrings = new Set(Array.from(selectedTaskIds).map(String));
    const filesToDelete = designTasks
      .filter(t => selectedStrings.has(String(t.id)))
      .map(t => extractStorageFileName(t.img_url))
      .filter(Boolean);

    if (filesToDelete.length > 0) await deleteFilesFromStorage(filesToDelete);

    const idsToDelete = Array.from(selectedTaskIds);
    const { error } = await window.sb.from('design_tasks').delete().in('id', idsToDelete);

    if (error) {
      alert("Lỗi khi xóa: " + error.message);
    } else {
      selectedTaskIds.clear();
      alert(`Đã xóa thành công ${idsToDelete.length} task và dọn sạch các file ảnh liên quan!`);
      fetchDesignTasks();
    }
  };
}

window.toggleTaskStatus = async (id, currentStatus) => {
  const nextStatus = currentStatus === 'DESIGN' ? 'DONE' : 'DESIGN';
  await window.sb.from('design_tasks').update({ status: nextStatus }).eq('id', id);
  fetchDesignTasks();
};

window.copyBrief = (text) => {
  navigator.clipboard.writeText(text).then(() => alert(`Đã copy brief: "${text}"`));
};

document.querySelectorAll('.task-filter-btn').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.task-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeTaskFilter = btn.dataset.taskFilter;
    renderDesignTasks();
  };
});

// Upload XHR đo tiến trình cho Task
function uploadTaskImageWithProgress(file, onProgress) {
  return new Promise((resolve, reject) => {
    const fileExt = file.name.split('.').pop().toLowerCase();
    const fileName = `task_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

    let mimeType = file.type;
    if (!mimeType) {
      if (fileExt === 'webp') mimeType = 'image/webp';
      else if (fileExt === 'png') mimeType = 'image/png';
      else if (fileExt === 'jpg' || fileExt === 'jpeg') mimeType = 'image/jpeg';
      else mimeType = 'application/octet-stream';
    }

    const uploadUrl = `${SUPABASE_URL}/storage/v1/object/stack-assets/${fileName}`;
    const xhr = new XMLHttpRequest();
    xhr.open('POST', uploadUrl, true);

    xhr.setRequestHeader('apikey', SUPABASE_ANON_KEY);
    xhr.setRequestHeader('Authorization', `Bearer ${SUPABASE_ANON_KEY}`);
    xhr.setRequestHeader('Content-Type', mimeType);
    xhr.setRequestHeader('x-upsert', 'true');

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        const loadedMB = (e.loaded / (1024 * 1024)).toFixed(1);
        const totalMB = (e.total / (1024 * 1024)).toFixed(1);
        const percent = Math.round((e.loaded / e.total) * 100);
        onProgress(loadedMB, totalMB, percent);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(`${SUPABASE_URL}/storage/v1/object/public/stack-assets/${fileName}`);
      } else {
        reject(new Error(`Lỗi upload ảnh: HTTP ${xhr.status} - ${xhr.responseText}`));
      }
    };

    xhr.onerror = () => reject(new Error('Lỗi kết nối khi tải ảnh lên Cloud!'));
    xhr.send(file);
  });
}

// Modal Thêm Task
const taskModal = document.getElementById('task-modal');
const btnOpenTaskModal = document.getElementById('btn-open-task-modal');
const btnCloseTaskModal = document.getElementById('btn-close-task-modal');
if (btnOpenTaskModal && taskModal) btnOpenTaskModal.onclick = () => taskModal.classList.add('active');
if (btnCloseTaskModal && taskModal) btnCloseTaskModal.onclick = () => taskModal.classList.remove('active');

const formAddTask = document.getElementById('form-add-task');
if (formAddTask) {
  formAddTask.onsubmit = async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('btn-submit-add-task') || e.target.querySelector('button[type="submit"]');
    const progressBox = document.getElementById('task-upload-progress-box');
    const progressText = document.getElementById('task-upload-progress-text');
    const progressPercent = document.getElementById('task-upload-progress-percent');
    const progressBar = document.getElementById('task-upload-progress-bar');

    let finalImgUrl = document.getElementById('task-image-url')?.value.trim() || '';
    const fileInput = document.getElementById('task-image-file');
    const file = fileInput ? fileInput.files[0] : null;

    try {
      if (file) {
        if (progressBox) progressBox.style.display = 'block';
        if (submitBtn) {
          submitBtn.innerText = 'ĐANG TẢI ẢNH LÊN...';
          submitBtn.disabled = true;
        }

        finalImgUrl = await uploadTaskImageWithProgress(file, (loadedMB, totalMB, percent) => {
          if (progressText) progressText.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> Đang tải: <strong>${loadedMB} MB</strong> / <strong>${totalMB} MB</strong>`;
          if (progressPercent) progressPercent.innerText = `${percent}%`;
          if (progressBar) progressBar.style.width = `${percent}%`;
        });
      }

      if (submitBtn) submitBtn.innerText = 'ĐANG LƯU DỮ LIỆU...';

      await window.sb.from('design_tasks').insert([{
        task_type: document.getElementById('task-type-select').value,
        priority: document.getElementById('task-priority-select').value,
        brief: document.getElementById('task-brief-input').value.trim(),
        note: document.getElementById('task-note-input').value.trim(),
        img_url: finalImgUrl,
        status: document.getElementById('task-status-select').value
      }]);

      e.target.reset();
      if (progressBox) progressBox.style.display = 'none';
      if (progressBar) progressBar.style.width = '0%';
      if (taskModal) taskModal.classList.remove('active');
      fetchDesignTasks();

    } catch (err) {
      console.error(err);
      alert('Có lỗi xảy ra khi thêm task: ' + err.message);
    } finally {
      if (submitBtn) {
        submitBtn.innerText = 'LƯU TASK DESIGN';
        submitBtn.disabled = false;
      }
      if (progressBox) progressBox.style.display = 'none';
    }
  };
}

// Modal Sửa Task
window.openEditTaskModal = (id) => {
  const task = designTasks.find(t => String(t.id) === String(id));
  if (!task) return;

  document.getElementById('edit-task-id').value = task.id;
  document.getElementById('edit-task-type').value = task.task_type;
  document.getElementById('edit-task-priority').value = task.priority;
  document.getElementById('edit-task-brief').value = task.brief;
  document.getElementById('edit-task-imgurl').value = task.img_url || '';
  document.getElementById('edit-task-note').value = task.note || '';
  document.getElementById('edit-task-status').value = task.status;
  
  const fileInput = document.getElementById('edit-task-file');
  if (fileInput) fileInput.value = '';

  const editModal = document.getElementById('edit-task-modal');
  if (editModal) editModal.classList.add('active');
};

const btnCloseEditModal = document.getElementById('btn-close-edit-task-modal');
if (btnCloseEditModal) {
  btnCloseEditModal.onclick = () => {
    const modal = document.getElementById('edit-task-modal');
    if (modal) modal.classList.remove('active');
  };
}

const formEditTask = document.getElementById('form-edit-task');
if (formEditTask) {
  formEditTask.onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-task-id').value;
    const submitBtn = document.getElementById('btn-submit-edit-task');
    const progressBox = document.getElementById('edit-task-upload-progress-box');
    const progressText = document.getElementById('edit-task-upload-progress-text');
    const progressPercent = document.getElementById('edit-task-upload-progress-percent');
    const progressBar = document.getElementById('edit-task-upload-progress-bar');

    const currentTask = designTasks.find(t => String(t.id) === String(id));
    const oldImgUrl = currentTask ? (currentTask.img_url || '') : '';
    const oldStorageFileName = extractStorageFileName(oldImgUrl);

    let finalImgUrl = document.getElementById('edit-task-imgurl')?.value.trim() || '';
    const fileInput = document.getElementById('edit-task-file');
    const file = fileInput ? fileInput.files[0] : null;

    try {
      if (file) {
        if (progressBox) progressBox.style.display = 'block';
        if (submitBtn) {
          submitBtn.innerText = 'ĐANG TẢI ẢNH MỚI...';
          submitBtn.disabled = true;
        }

        finalImgUrl = await uploadTaskImageWithProgress(file, (loadedMB, totalMB, percent) => {
          if (progressText) progressText.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> Đang tải: <strong>${loadedMB} MB</strong> / <strong>${totalMB} MB</strong>`;
          if (progressPercent) progressPercent.innerText = `${percent}%`;
          if (progressBar) progressBar.style.width = `${percent}%`;
        });

        // Xóa ảnh mẫu task cũ trong Storage khi Des tải ảnh mới lên
        if (oldStorageFileName && oldStorageFileName !== extractStorageFileName(finalImgUrl)) {
          console.log("Xóa ảnh mẫu task cũ khỏi Storage:", oldStorageFileName);
          await deleteFilesFromStorage([oldStorageFileName]);
        }
      } else if (oldStorageFileName && finalImgUrl !== oldImgUrl) {
        console.log("URL ảnh task thay đổi, dọn ảnh cũ khỏi Storage:", oldStorageFileName);
        await deleteFilesFromStorage([oldStorageFileName]);
      }

      if (submitBtn) submitBtn.innerText = 'ĐANG LƯU DỮ LIỆU...';

      await window.sb.from('design_tasks').update({
        task_type: document.getElementById('edit-task-type').value,
        priority: document.getElementById('edit-task-priority').value,
        brief: document.getElementById('edit-task-brief').value.trim(),
        note: document.getElementById('edit-task-note').value.trim(),
        img_url: finalImgUrl,
        status: document.getElementById('edit-task-status').value
      }).eq('id', id);

      const modal = document.getElementById('edit-task-modal');
      if (modal) modal.classList.remove('active');
      if (progressBox) progressBox.style.display = 'none';
      if (progressBar) progressBar.style.width = '0%';
      alert("Đã cập nhật task thành công!");
      fetchDesignTasks();

    } catch (err) {
      console.error(err);
      alert('Có lỗi khi cập nhật task: ' + err.message);
    } finally {
      if (submitBtn) {
        submitBtn.innerText = 'LƯU THAY ĐỔI';
        submitBtn.disabled = false;
      }
      if (progressBox) progressBox.style.display = 'none';
    }
  };
}

// ==============================================================================
// PHẦN 6: LIGHTBOX & TẢI ẢNH GỐC CHO TASK (SAVE TO PHOTOS TRÊN IOS)
// ==============================================================================
window.openTaskImage = (url, title) => {
  if (!url) return;
  currentTaskModalImageUrl = url;
  currentTaskModalImageTitle = title || 'Task-Design';

  const prevEl = document.getElementById('image-modal-preview');
  const titleEl = document.getElementById('image-modal-title');
  const modalEl = document.getElementById('image-modal');

  if (prevEl) {
    prevEl.referrerPolicy = "no-referrer";
    prevEl.src = url;
  }
  if (titleEl) titleEl.innerText = `ẢNH TASK: ${title}`;
  if (modalEl) modalEl.classList.add('active');
};

const btnCloseImg = document.getElementById('btn-close-image');
if (btnCloseImg) {
  btnCloseImg.onclick = () => {
    const modalEl = document.getElementById('image-modal');
    if (modalEl) modalEl.classList.remove('active');
  };
}

window.downloadActiveTaskImage = async function () {
  if (!currentTaskModalImageUrl) return;

  const btn = document.getElementById('btn-download-hd-task');
  const oldHtml = btn ? btn.innerHTML : '';
  if (btn) btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ĐANG TẢI...`;

  try {
    const response = await fetch(currentTaskModalImageUrl, { mode: 'cors' });
    if (!response.ok) throw new Error('CORS error');
    const blob = await response.blob();

    let ext = 'jpg';
    let mimeType = blob.type || 'image/jpeg';
    if (mimeType.includes('png')) ext = 'png';
    else if (mimeType.includes('webp')) ext = 'webp';

    const cleanTitle = (currentTaskModalImageTitle || 'Goal-Line-Task')
      .replace(/[^a-zA-Z0-9à-ỹÀ-Ỹ\s-_]/g, '')
      .trim() || 'Goal-Line-Task';
    const fileName = `${cleanTitle}.${ext}`;

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile && navigator.canShare) {
      const file = new File([blob], fileName, { type: mimeType });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: cleanTitle });
        return;
      }
    }

    const blobUrl = window.URL.createObjectURL(blob);
    const tempLink = document.createElement('a');
    tempLink.style.display = 'none';
    tempLink.href = blobUrl;
    tempLink.download = fileName;
    document.body.appendChild(tempLink);
    tempLink.click();

    setTimeout(() => {
      window.URL.revokeObjectURL(blobUrl);
      document.body.removeChild(tempLink);
    }, 1500);
  } catch (err) {
    if (err.name === 'AbortError') return;
    window.open(currentTaskModalImageUrl, '_blank');
  } finally {
    if (btn) btn.innerHTML = oldHtml;
  }
};

// ==============================================================================
// PHẦN 7: BẢNG THEO DÕI NGHỈ PHÉP (LEAVES)
// ==============================================================================
function renderLeavesTable() {
  const bodyLeave = document.getElementById('body-leave');
  if (!bodyLeave) return;

  if (leavesList.length === 0) {
    bodyLeave.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:18px; font-weight:700;">CHƯA CÓ THÀNH VIÊN NÀO XIN OFF</td></tr>`;
    return;
  }

  bodyLeave.innerHTML = leavesList.map(l => `
    <tr>
      <td><strong>${l.admin_name}</strong></td>
      <td style="font-family:var(--font-mono); font-weight:800; color:#d63031;">${l.time_range}</td>
      <td style="display:flex; justify-content:space-between; align-items:center;">
        <span>${l.reason}</span>
        <button onclick="deleteLeave('${l.id}')" style="background:none; border:none; cursor:pointer; color:red;" title="Xóa đơn">
          <i class="fa-solid fa-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

const btnAddLeave = document.getElementById('btn-add-leave');
if (btnAddLeave) {
  btnAddLeave.onclick = async () => {
    const myName = localStorage.getItem('gl_current_user') || 'Vinci';
    const name = prompt('Tên thành viên xin off:', myName);
    if (!name) return;
    const time = prompt('Thời gian nghỉ (ví dụ: 10/10 - 20/10):');
    if (!time) return;
    const reason = prompt('Ghi chú / lý do:', 'Đã báo Vinci');

    await window.sb.from('leaves').insert([{ 
      admin_name: name.trim(), 
      time_range: time.trim(), 
      reason: reason ? reason.trim() : 'Đã báo Vinci' 
    }]);
    fetchLeavesData();
  };
}

window.deleteLeave = async (id) => {
  if (confirm('Xóa đơn xin nghỉ này?')) {
    await window.sb.from('leaves').delete().eq('id', id);
    fetchLeavesData();
  }
};

// ==============================================================================
// PHẦN 8: ĐÔN TUẦN & ROLLBACK ĐỘC LẬP (ROW backup_content & backup_design)
// ==============================================================================
let currentActiveTeam = 'content';

const btnPromoteWeek = document.getElementById('btn-promote-week');
const promoteBtnText = document.getElementById('promote-btn-text');
const btnRollbackWeek = document.getElementById('btn-rollback-week');
const rollbackBtnText = document.getElementById('rollback-btn-text');

// BAN CONTENT: ĐÔN TUẦN & ROLLBACK
async function promoteContentWeek() {
  const pin = prompt('Nhập mã PIN Admin để ĐÔN TUẦN CONTENT:');
  if (pin !== '2026') return pin !== null && alert('Sai mã PIN Admin!');

  const currentWeek = scheduleCache['current'];
  const nextWeek = scheduleCache['next'];
  if (!currentWeek || !nextWeek) return alert('Chưa tải được dữ liệu lịch!');

  const { error: backupErr } = await window.sb.from('schedules').upsert({
    id: 'backup_content',
    week_label: 'BACKUP CONTENT ' + new Date().toLocaleTimeString('vi-VN'),
    writing_short_data: currentWeek.writing_short_data,
    writing_long_data: currentWeek.writing_long_data,
    posting_data: currentWeek.posting_data,
    updated_at: new Date()
  });

  if (backupErr) {
    if (!confirm('Không thể ghi backup vào database (' + backupErr.message + '). Tiếp tục đôn?')) return;
  }

  await window.sb.from('schedules').update({
    writing_short_data: nextWeek.writing_short_data,
    writing_long_data: nextWeek.writing_long_data,
    posting_data: nextWeek.posting_data,
    updated_at: new Date()
  }).eq('id', 'current');

  // Đôn tuần sau: Khởi tạo trắng 5 ca trực Page
  const blankShort = [
    { shift: "Sáng", time: "8h", slots: [[], [], [], [], [], [], []] },
    { shift: "Trưa", time: "11h", slots: [[], [], [], [], [], [], []] },
    { shift: "Chiều", time: "16h", slots: [[], [], [], [], [], [], []] }
  ];
  const blankLong = [
    { shift: "Sáng", time: "19h", slots: [[], [], [], [], [], [], []] },
    { shift: "Trưa", time: "21h", slots: [[], [], [], [], [], [], []] }
  ];
  const blankPosting = JSON.parse(JSON.stringify(DEFAULT_5_POSTING_SHIFTS));

  await window.sb.from('schedules').update({
    writing_short_data: blankShort,
    writing_long_data: blankLong,
    posting_data: blankPosting,
    updated_at: new Date()
  }).eq('id', 'next');

  alert('ĐÃ ĐÔN TUẦN CONTENT THÀNH CÔNG!\n(Đã cất lịch cũ vào row backup_content)');
  fetchScheduleData();
}

async function rollbackContentWeek() {
  const pin = prompt('KHÔI PHỤC LỊCH CONTENT\nNhập mã PIN Admin để ROLLBACK:');
  if (pin !== '2026') return pin !== null && alert('Sai mã PIN Admin!');

  const { data: backupRow, error } = await window.sb
    .from('schedules')
    .select('*')
    .eq('id', 'backup_content')
    .single();

  if (error || !backupRow || !backupRow.writing_short_data) {
    return alert('Không tìm thấy bản backup nào của Content (hoặc bạn đã rollback rồi)!');
  }

  const currentWeek = scheduleCache['current'];
  const confirmMsg = `XÁC NHẬN ROLLBACK LỊCH BAN CONTENT?\n\n- Toàn bộ ca Content tuần trước sẽ trả về 'Tuần Này'.\n- Ca đang có ở 'Tuần Này' sẽ chuyển về 'Tuần Sau'.\n(Lịch Design hoàn toàn không bị ảnh hưởng)`;
  if (!confirm(confirmMsg)) return;

  await window.sb.from('schedules').update({
    writing_short_data: backupRow.writing_short_data,
    writing_long_data: backupRow.writing_long_data,
    posting_data: backupRow.posting_data,
    updated_at: new Date()
  }).eq('id', 'current');

  if (currentWeek) {
    await window.sb.from('schedules').update({
      writing_short_data: currentWeek.writing_short_data,
      writing_long_data: currentWeek.writing_long_data,
      posting_data: currentWeek.posting_data,
      updated_at: new Date()
    }).eq('id', 'next');
  }

  await window.sb.from('schedules').update({
    writing_short_data: null,
    writing_long_data: null,
    posting_data: null,
    updated_at: new Date()
  }).eq('id', 'backup_content');

  alert('ROLLBACK CONTENT THÀNH CÔNG!');
  fetchScheduleData();
}

// BAN DESIGN: ĐÔN TUẦN & ROLLBACK
async function promoteDesignWeek() {
  const pin = prompt('Nhập mã PIN Admin để ĐÔN TUẦN DESIGN:');
  if (pin !== '2026') return pin !== null && alert('Sai mã PIN Admin!');

  const currentWeek = scheduleCache['current'];
  const nextWeek = scheduleCache['next'];
  if (!currentWeek || !nextWeek) return alert('Chưa tải được dữ liệu lịch!');

  const { error: backupErr } = await window.sb.from('schedules').upsert({
    id: 'backup_design',
    week_label: 'BACKUP DESIGN ' + new Date().toLocaleTimeString('vi-VN'),
    design_shifts_data: currentWeek.design_shifts_data,
    updated_at: new Date()
  });

  if (backupErr) {
    if (!confirm('Không thể ghi backup Design vào database (' + backupErr.message + '). Tiếp tục đôn?')) return;
  }

  await window.sb.from('schedules').update({
    design_shifts_data: nextWeek.design_shifts_data,
    updated_at: new Date()
  }).eq('id', 'current');

  const blankDesignShifts = [
    { shift: "Fix ảnh Page", time: "Hằng ngày", slots: [[], [], [], [], [], [], []] }
  ];

  await window.sb.from('schedules').update({
    design_shifts_data: blankDesignShifts,
    updated_at: new Date()
  }).eq('id', 'next');

  alert('ĐÃ ĐÔN TUẦN DESIGN THÀNH CÔNG!\n(Đã cất lịch cũ vào row backup_design)');
  fetchScheduleData();
}

async function rollbackDesignWeek() {
  const pin = prompt('KHÔI PHỤC LỊCH DESIGN\nNhập mã PIN Admin để ROLLBACK:');
  if (pin !== '2026') return pin !== null && alert('Sai mã PIN Admin!');

  const { data: backupRow, error } = await window.sb
    .from('schedules')
    .select('*')
    .eq('id', 'backup_design')
    .single();

  if (error || !backupRow || !backupRow.design_shifts_data) {
    return alert('Không tìm thấy bản backup nào của Design (hoặc bạn đã rollback rồi)!');
  }

  const currentWeek = scheduleCache['current'];
  const confirmMsg = `XÁC NHẬN ROLLBACK LỊCH BAN DESIGN?\n\n- Ca trực Design tuần trước sẽ trả về 'Tuần Này'.\n- Ca đang có ở 'Tuần Này' sẽ chuyển về 'Tuần Sau'.\n(Lịch Content hoàn toàn không bị ảnh hưởng)`;
  if (!confirm(confirmMsg)) return;

  await window.sb.from('schedules').update({
    design_shifts_data: backupRow.design_shifts_data,
    updated_at: new Date()
  }).eq('id', 'current');

  if (currentWeek) {
    await window.sb.from('schedules').update({
      design_shifts_data: currentWeek.design_shifts_data,
      updated_at: new Date()
    }).eq('id', 'next');
  }

  await window.sb.from('schedules').update({
    design_shifts_data: null,
    updated_at: new Date()
  }).eq('id', 'backup_design');

  alert('ROLLBACK DESIGN THÀNH CÔNG!');
  fetchScheduleData();
}

if (btnPromoteWeek) {
  btnPromoteWeek.onclick = () => {
    if (currentActiveTeam === 'design') promoteDesignWeek();
    else promoteContentWeek();
  };
}

if (btnRollbackWeek) {
  btnRollbackWeek.onclick = () => {
    if (currentActiveTeam === 'design') rollbackDesignWeek();
    else rollbackContentWeek();
  };
}

// ==============================================================================
// PHẦN 9: ĐIỀU HƯỚNG TAB BAN & CHUYỂN TUẦN
// ==============================================================================
const sectionContent = document.getElementById('section-content-team');
const sectionDesign = document.getElementById('section-design-team');
const btnContentTab = document.getElementById('tab-btn-content');
const btnDesignTab = document.getElementById('tab-btn-design');

if (btnContentTab && btnDesignTab) {
  btnContentTab.onclick = () => {
    currentActiveTeam = 'content';
    btnContentTab.classList.add('active');
    btnDesignTab.classList.remove('active');
    if (sectionContent) sectionContent.style.display = 'block';
    if (sectionDesign) sectionDesign.style.display = 'none';

    if (promoteBtnText) promoteBtnText.innerText = 'ĐÔN TUẦN CONTENT';
    else if (btnPromoteWeek) btnPromoteWeek.innerHTML = '<i class="fa-solid fa-forward-step"></i> ĐÔN TUẦN CONTENT';
    if (btnPromoteWeek) btnPromoteWeek.style.background = 'var(--neo-yellow)';

    if (rollbackBtnText) rollbackBtnText.innerText = 'ROLLBACK CONTENT';
    else if (btnRollbackWeek) btnRollbackWeek.innerHTML = '<i class="fa-solid fa-rotate-left"></i> ROLLBACK CONTENT';
  };

  btnDesignTab.onclick = () => {
    currentActiveTeam = 'design';
    btnDesignTab.classList.add('active');
    btnContentTab.classList.remove('active');
    if (sectionDesign) sectionDesign.style.display = 'block';
    if (sectionContent) sectionContent.style.display = 'none';

    if (promoteBtnText) promoteBtnText.innerText = 'ĐÔN TUẦN DESIGN';
    else if (btnPromoteWeek) btnPromoteWeek.innerHTML = '<i class="fa-solid fa-forward-step"></i> ĐÔN TUẦN DESIGN';
    if (btnPromoteWeek) btnPromoteWeek.style.background = 'var(--neo-purple)';

    if (rollbackBtnText) rollbackBtnText.innerText = 'ROLLBACK DESIGN';
    else if (btnRollbackWeek) btnRollbackWeek.innerHTML = '<i class="fa-solid fa-rotate-left"></i> ROLLBACK DESIGN';

    fetchDesignTasks();
  };
}

const btnThisWeek = document.getElementById('btn-this-week');
const btnNextWeek = document.getElementById('btn-next-week');

if (btnThisWeek && btnNextWeek) {
  btnThisWeek.onclick = () => {
    currentTab = 'current';
    btnThisWeek.classList.add('active');
    btnNextWeek.classList.remove('active');
    renderActiveSchedule();
  };

  btnNextWeek.onclick = () => {
    currentTab = 'next';
    btnNextWeek.classList.add('active');
    btnThisWeek.classList.remove('active');
    renderActiveSchedule();
  };
}

window.addEventListener('identityChanged', () => {
  renderActiveSchedule();
});

// ==============================================================================
// PHẦN 10: TỰ ĐỘNG PHỤC HỒI DỮ LIỆU & REALTIME SYNC
// ==============================================================================
async function refreshAllData() {
  const icon = document.getElementById('refresh-icon');
  if (icon) icon.classList.add('fa-spin');
  try {
    await Promise.all([fetchScheduleData(), fetchDesignTasks(), fetchLeavesData()]);
  } catch (err) {
    console.error(err);
  } finally {
    if (icon) setTimeout(() => icon.classList.remove('fa-spin'), 400);
  }
}

const btnRefreshAll = document.getElementById('btn-refresh-all');
if (btnRefreshAll) btnRefreshAll.onclick = refreshAllData;

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') refreshAllData();
});
window.addEventListener('focus', refreshAllData);

window.sb.channel('realtime_schedules_all')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'schedules' }, fetchScheduleData)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'design_tasks' }, fetchDesignTasks)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'leaves' }, fetchLeavesData)
  .subscribe();

// Khởi chạy khi tải trang
fetchScheduleData();
fetchDesignTasks();
fetchLeavesData();