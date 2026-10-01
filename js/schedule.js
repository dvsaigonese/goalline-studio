const SUPABASE_URL = 'https://exutfqxfwurwyfyxzskj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4dXRmcXhmd3Vyd3lmeXh6c2tqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4NTM0MzksImV4cCI6MjEwNjQyOTQzOX0.e3DZMEaGqgEQjMbUrll718a0lWFjY011wzPPLqh9Ls8';

// Khởi tạo Supabase client toàn cục trên window
window.sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const GL_TEAM = [
  'Maztermind', 'Vinci', 'Voet', 'Quýt', 'Tiryth', 'Tizzy', 'Nikolaj', 
  'Cakashi', 'Nedu', 'Terry', 'Naruto', 'Ruben', 'Dante', 'Daugust', 
  'Draco', 'Harif', 'Giáo 5ư', 'Tom', 'Brunson', 'Vate', 'Zenriot', 
  'Kaiz', 'Metis', 'Genie', 'Dmoney'
];

function checkIdentity() {
  let currentUser = localStorage.getItem('gl_current_user');
  if (!currentUser) {
    const chosen = prompt(`CHÀO MỪNG ĐẾN VỚI LỊCH GOAL-LINE!\nBạn là ai trong team?\n(${GL_TEAM.join(', ')})`, 'Harif');
    currentUser = chosen ? chosen.trim() : 'Harif';
    localStorage.setItem('gl_current_user', currentUser);
  }
  const displayEl = document.getElementById('current-user-display');
  if (displayEl) displayEl.innerText = `ADMIN: ${currentUser.toUpperCase()}`;
  return currentUser;
}

document.getElementById('btn-change-identity').onclick = () => {
  const chosen = prompt(`Chọn lại tên của bạn:\n(${GL_TEAM.join(', ')})`, localStorage.getItem('gl_current_user') || 'Harif');
  if (chosen) {
    localStorage.setItem('gl_current_user', chosen.trim());
    checkIdentity();
  }
};

let currentTab = 'current'; // 'current' hoặc 'next'
let scheduleCache = { current: null, next: null };
let leavesList = [];

async function fetchScheduleData() {
  const { data, error } = await window.sb.from('schedules').select('*');
  if (error) return console.error('Lỗi lấy lịch:', error.message);

  data.forEach(item => { scheduleCache[item.id] = item; });
  renderActiveSchedule();
}

async function fetchLeavesData() {
  const { data, error } = await window.sb.from('leaves').select('*').order('created_at', { ascending: false });
  if (error) return console.error('Lỗi lấy danh sách nghỉ:', error.message);

  leavesList = data || [];
  renderLeavesTable();
}

// ==========================================
// KHUNG GIỜ MẶC ĐỊNH (TỰ ĐỘNG CHỮA LỖI NẾU DB TRỐNG)
// ==========================================
const DEFAULT_SHORT_MATRIX = [
  { shift: "Sáng", time: "Trước 9h", slots: [[], [], [], [], [], [], []] },
  { shift: "Trưa", time: "Trước 11h00", slots: [[], [], [], [], [], [], []] },
  { shift: "Chiều", time: "14-18h", slots: [[], [], [], [], [], [], []] }
];

const DEFAULT_LONG_MATRIX = [
  { shift: "Sáng", time: "19h", slots: [[], [], [], [], [], [], []] },
  { shift: "Trưa", time: "21h", slots: [[], [], [], [], [], [], []] }
];

function renderActiveSchedule() {
  const weekObj = scheduleCache[currentTab];
  if (!weekObj) return;

  const labelEl = document.getElementById('current-week-label');
  if (labelEl) labelEl.innerText = weekObj.week_label;

  const myName = localStorage.getItem('gl_current_user') || 'Harif';

  // TỰ ĐỘNG LẤY MẶC ĐỊNH NẾU DỮ LIỆU ĐANG BỊ NULL
  if (!weekObj.writing_short_data || weekObj.writing_short_data.length === 0) {
    weekObj.writing_short_data = JSON.parse(JSON.stringify(DEFAULT_SHORT_MATRIX));
    // Tự động lưu khởi tạo lên Supabase
    window.sb.from('schedules').update({ writing_short_data: weekObj.writing_short_data }).eq('id', currentTab);
  }

  if (!weekObj.writing_long_data || weekObj.writing_long_data.length === 0) {
    weekObj.writing_long_data = JSON.parse(JSON.stringify(DEFAULT_LONG_MATRIX));
    // Tự động lưu khởi tạo lên Supabase
    window.sb.from('schedules').update({ writing_long_data: weekObj.writing_long_data }).eq('id', currentTab);
  }

  // Helper render ma trận ô nhiều slot
  const renderMultiSlotRows = (dataMatrix, columnKey, maxCapacity) => {
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
                ${slotsArr.map((member, sIdx) => `
                  <div class="slot-pill" onclick="handleRemoveSlot('${columnKey}', ${rIdx}, ${cIdx}, ${sIdx}, '${member}')" title="Click để hủy ca">
                    <span>${member}</span>
                    ${member === myName ? `<i class="fa-solid fa-xmark btn-del-mini"></i>` : ''}
                  </div>
                `).join('')}
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

  // 1. Render Bài Ngắn (5 slots)
  const bodyWritingShort = document.getElementById('body-writing-short');
  if (bodyWritingShort) {
    bodyWritingShort.innerHTML = renderMultiSlotRows(weekObj.writing_short_data, 'writing_short_data', 5);
  }

  // 2. Render Bài Dài (3 slots)
  const bodyWritingLong = document.getElementById('body-writing-long');
  if (bodyWritingLong) {
    bodyWritingLong.innerHTML = renderMultiSlotRows(weekObj.writing_long_data, 'writing_long_data', 3);
  }

  // 3. Render Trực Fanpage
  const bodyPosting = document.getElementById('body-posting');
  if (bodyPosting && weekObj.posting_data) {
    bodyPosting.innerHTML = weekObj.posting_data.map((row, rIdx) => `
      <tr>
        <td class="shift-title">${row.shift}</td>
        <td class="shift-time">${row.time}</td>
        ${row.slots.map((cellVal, cIdx) => {
          const name = typeof cellVal === 'string' ? cellVal : (cellVal[0] || '');
          return `
            <td>
              ${name ? `
                <span class="slot-pill" style="background:var(--neo-blue);" onclick="handlePostingClick(${rIdx}, ${cIdx}, '${name}')">
                  ${name}
                </span>
              ` : `
                <button class="btn-slot-join" onclick="handlePostingClick(${rIdx}, ${cIdx}, '')">
                  + Nhận ca
                </button>
              `}
            </td>
          `;
        }).join('')}
      </tr>
    `).join('');
  }
}

// Render Bảng Xin Nghỉ
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

// ==========================================
// THAO TÁC NHẬN VÀ HỦY SLOT
// ==========================================

// Nhận thêm slot vào 1 ô (Bài ngắn tối đa 5, bài dài tối đa 3)
window.handleAddSlot = async (columnKey, rIdx, cIdx, maxCapacity) => {
  const myName = localStorage.getItem('gl_current_user') || 'Harif';
  const targetWeek = scheduleCache[currentTab];
  if (!targetWeek) return;

  const currentSlots = Array.isArray(targetWeek[columnKey][rIdx].slots[cIdx])
    ? targetWeek[columnKey][rIdx].slots[cIdx]
    : [];

  if (currentSlots.length >= maxCapacity) {
    return alert(`Ca này đã đủ ${maxCapacity} thành viên!`);
  }

  if (currentSlots.includes(myName)) {
    return alert(`Bạn (${myName}) đã nhận 1 slot trong ca này rồi!`);
  }

  const confirmJoin = confirm(`Nhận 1 slot ca này cho [${myName}]?`);
  if (!confirmJoin) return;

  // Cập nhật mảng
  const updatedMatrix = JSON.parse(JSON.stringify(targetWeek[columnKey]));
  if (!Array.isArray(updatedMatrix[rIdx].slots[cIdx])) {
    updatedMatrix[rIdx].slots[cIdx] = [];
  }
  updatedMatrix[rIdx].slots[cIdx].push(myName);

  // Bắn lên Supabase
  const { error } = await window.sb
    .from('schedules')
    .update({ [columnKey]: updatedMatrix, updated_at: new Date() })
    .eq('id', currentTab);

  if (error) alert('Lỗi cập nhật: ' + error.message);
};

// Hủy hoặc đổi tên slot
window.handleRemoveSlot = async (columnKey, rIdx, cIdx, sIdx, memberName) => {
  const myName = localStorage.getItem('gl_current_user') || 'Harif';
  const targetWeek = scheduleCache[currentTab];
  if (!targetWeek) return;

  if (memberName === myName) {
    const confirmCancel = confirm(`Hủy ca của bạn (${myName})?`);
    if (!confirmCancel) return;
  } else {
    const pin = prompt(`Slot này của [${memberName}]. Nhập mã PIN Admin để xóa:`);
    if (pin !== '2026') {
      if (pin !== null) alert('Sai mã PIN Admin!');
      return;
    }
  }

  const updatedMatrix = JSON.parse(JSON.stringify(targetWeek[columnKey]));
  updatedMatrix[rIdx].slots[cIdx].splice(sIdx, 1);

  const { error } = await window.sb
    .from('schedules')
    .update({ [columnKey]: updatedMatrix, updated_at: new Date() })
    .eq('id', currentTab);

  if (error) alert('Lỗi cập nhật: ' + error.message);
};

// Xử lý trực Fanpage
window.handlePostingClick = async (rIdx, cIdx, currentVal) => {
  const myName = localStorage.getItem('gl_current_user') || 'Harif';
  const targetWeek = scheduleCache[currentTab];
  if (!targetWeek) return;

  let newVal = '';
  if (!currentVal) {
    if (!confirm(`Nhận ca trực page cho [${myName}]?`)) return;
    newVal = myName;
  } else if (currentVal === myName) {
    if (!confirm(`Hủy ca trực page này?`)) return;
    newVal = '';
  } else {
    const pin = prompt(`Ca này của [${currentVal}]. Nhập PIN Admin:`);
    if (pin !== '2026') return pin !== null && alert('Sai PIN!');
    newVal = '';
  }

  const updatedMatrix = JSON.parse(JSON.stringify(targetWeek.posting_data));
  updatedMatrix[rIdx].slots[cIdx] = newVal;

  await window.sb
    .from('schedules')
    .update({ posting_data: updatedMatrix, updated_at: new Date() })
    .eq('id', currentTab);
};

// ==========================================
// ĐÔN TUẦN MỚI & XIN NGHỈ
// ==========================================
document.getElementById('btn-promote-week').onclick = async () => {
  const pin = prompt('Nhập mã PIN Admin để ĐÔN TUẦN:');
  if (pin !== '2026') return pin !== null && alert('Sai mã PIN!');

  const nextWeek = scheduleCache['next'];
  if (!nextWeek) return alert('Chưa tải được dữ liệu tuần sau!');

  const newLabel = prompt('Tên hiển thị tuần sau mới:', 'ĐĂNG KÝ TUẦN MỚI');
  if (!newLabel) return;

  // Đôn dữ liệu
  await window.sb.from('schedules').update({
    week_label: nextWeek.week_label.replace('ĐĂNG KÝ TUẦN SAU', 'TUẦN NÀY'),
    writing_short_data: nextWeek.writing_short_data,
    writing_long_data: nextWeek.writing_long_data,
    posting_data: nextWeek.posting_data,
    updated_at: new Date()
  }).eq('id', 'current');

  // Reset tuần sau
  const blankShort = [
    { shift: "Sáng", time: "Trước 9h", slots: [[], [], [], [], [], [], []] },
    { shift: "Trưa", time: "Trước 11h00", slots: [[], [], [], [], [], [], []] },
    { shift: "Chiều", time: "14-18h", slots: [[], [], [], [], [], [], []] }
  ];
  const blankLong = [
    { shift: "Tối", time: "19h", slots: [[], [], [], [], [], [], []] },
    { shift: "Đêm", time: "21h", slots: [[], [], [], [], [], [], []] }
  ];
  const blankPosting = [
    { shift: "Đêm/Sáng", time: "0h - 10h30", slots: ["", "", "", "", "", "", ""] },
    { shift: "Trưa/Tối", time: "10h30 - 23h", slots: ["", "", "", "", "", "", ""] }
  ];

  await window.sb.from('schedules').update({
    week_label: newLabel,
    writing_short_data: blankShort,
    writing_long_data: blankLong,
    posting_data: blankPosting,
    updated_at: new Date()
  }).eq('id', 'next');

  alert('ĐÃ ĐÔN TUẦN THÀNH CÔNG!');
};

document.getElementById('btn-add-leave').onclick = async () => {
  const myName = localStorage.getItem('gl_current_user') || 'Harif';
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
};

window.deleteLeave = async (id) => {
  if (confirm('Xóa đơn xin nghỉ này?')) {
    await window.sb.from('leaves').delete().eq('id', id);
  }
};

document.getElementById('btn-this-week').onclick = () => {
  currentTab = 'current';
  document.getElementById('btn-this-week').classList.add('active');
  document.getElementById('btn-next-week').classList.remove('active');
  renderActiveSchedule();
};

document.getElementById('btn-next-week').onclick = () => {
  currentTab = 'next';
  document.getElementById('btn-next-week').classList.add('active');
  document.getElementById('btn-this-week').classList.remove('active');
  renderActiveSchedule();
};

// WebSocket Realtime
window.sb.channel('realtime_schedules_channel')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'schedules' }, fetchScheduleData)
  .subscribe();

window.sb.channel('realtime_leaves_channel')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'leaves' }, fetchLeavesData)
  .subscribe();

checkIdentity();
fetchScheduleData();
fetchLeavesData();