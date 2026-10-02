const SUPABASE_URL = 'https://exutfqxfwurwyfyxzskj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4dXRmcXhmd3Vyd3lmeXh6c2tqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4NTM0MzksImV4cCI6MjEwNjQyOTQzOX0.e3DZMEaGqgEQjMbUrll718a0lWFjY011wzPPLqh9Ls8';

// Khởi tạo Supabase client toàn cục trên window
window.sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentTab = 'current';
let scheduleCache = { current: null, next: null };
let designTasks = [];
let leavesList = [];

// ==========================================
// TẢI DỮ LIỆU
// ==========================================
async function fetchScheduleData() {
  const { data, error } = await window.sb.from('schedules').select('*');
  if (error) return console.error('Lỗi lấy lịch:', error.message);
  data.forEach(item => { scheduleCache[item.id] = item; });
  renderActiveSchedule();
}

async function fetchDesignTasks() {
  const { data, error } = await window.sb
    .from('design_tasks')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) return console.error('Lỗi lấy tasks:', error.message);
  designTasks = data || [];
  renderDesignTasks();
}

async function fetchLeavesData() {
  const { data, error } = await window.sb.from('leaves').select('*').order('created_at', { ascending: false });
  if (error) return console.error('Lỗi lấy leaves:', error.message);
  leavesList = data || [];
  renderLeavesTable();
}

// ==========================================
// RENDER LỊCH PHÂN CA
// ==========================================
function renderActiveSchedule() {
  const weekObj = scheduleCache[currentTab];
  if (!weekObj) return;

  const labelEl = document.getElementById('current-week-label');
  if (labelEl) labelEl.innerText = weekObj.week_label;

  const myName = localStorage.getItem('gl_current_user') || 'Vinci';

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
                ${slotsArr.map((member, sIdx) => `
                  <div class="slot-pill" style="${customBg ? `background:${customBg};` : ''}" 
                       onclick="handleRemoveSlot('${columnKey}', ${rIdx}, ${cIdx}, ${sIdx}, '${member}')" 
                       title="Click để hủy ca">
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

  const bodyWritingShort = document.getElementById('body-writing-short');
  if (bodyWritingShort) bodyWritingShort.innerHTML = renderMultiSlotRows(weekObj.writing_short_data, 'writing_short_data', 5);

  const bodyWritingLong = document.getElementById('body-writing-long');
  if (bodyWritingLong) bodyWritingLong.innerHTML = renderMultiSlotRows(weekObj.writing_long_data, 'writing_long_data', 3);

  const bodyPosting = document.getElementById('body-posting');
  if (bodyPosting) bodyPosting.innerHTML = renderMultiSlotRows(weekObj.posting_data, 'posting_data', 2, 'var(--neo-blue)');

  const bodyDesignShifts = document.getElementById('body-design-shifts');
  if (bodyDesignShifts) bodyDesignShifts.innerHTML = renderMultiSlotRows(weekObj.design_shifts_data, 'design_shifts_data', 2, 'var(--neo-orange)');
}

// ==========================================
// QUẢN LÝ TASK DESIGN (SELECT, BATCH DELETE, FILTER)
// ==========================================
let activeTaskFilter = 'all';
let selectedTaskIds = new Set(); // Lưu danh sách ID task được tick chọn

function renderDesignTasks() {
  const tbody = document.getElementById('body-design-tasks');
  if (!tbody) return;

  // Lọc theo tab
  const filtered = designTasks.filter(t => {
    if (activeTaskFilter === 'all') return true;
    if (activeTaskFilter === 'DESIGN') return t.status === 'DESIGN' || t.status === 'PENDING';
    if (activeTaskFilter === 'DONE') return t.status === 'DONE';
    return true;
  });

  // Cập nhật số đếm trên các Tab
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

  tbody.innerHTML = filtered.map(t => {
    let typeClass = 'type-other';
    if (t.task_type && t.task_type.includes('SPECIAL')) typeClass = 'type-special';
    if (t.task_type && t.task_type.includes('THREADS')) typeClass = 'type-threads';

    const isChecked = selectedTaskIds.has(t.id) ? 'checked' : '';

    return `
      <tr>
        <td style="text-align: center;">
          <input type="checkbox" class="neo-checkbox task-row-checkbox" data-id="${t.id}" ${isChecked}>
        </td>
        <td><span class="tag-task-type ${typeClass}">${t.task_type}</span></td>
        <td><strong>${t.brief}</strong></td>
        <td><span class="tag-priority-badge">${t.priority}</span></td>
        <td style="font-size:0.85rem; color:#555;">${t.note || '--'}</td>
        <td>
          ${t.img_url ? `
            <button class="slot-pill" style="cursor:pointer;" onclick="openTaskImage('${t.img_url}', '${t.brief}')">
              <i class="fa-solid fa-image"></i> Xem file
            </button>
          ` : `<span style="color:#aaa; font-size:0.75rem;">(Chưa đính kèm)</span>`}
        </td>
        <td>
          <span class="tag-status-pill ${t.status === 'DONE' ? 'tag-status-done' : ''}" onclick="toggleTaskStatus('${t.id}', '${t.status}')" title="Click để chuyển trạng thái">
            ${t.status}
          </span>
        </td>
        <td>
          <div class="table-actions">
            <button class="btn-action-icon" onclick="openEditTaskModal('${t.id}')" style="color:#0984e3;" title="Chỉnh sửa task">
              <i class="fa-solid fa-pen-to-square"></i>
            </button>
            <button class="btn-action-icon" onclick="copyBrief('${t.brief}')" title="Copy tiêu đề / brief">
              <i class="fa-solid fa-copy"></i>
            </button>
            <button class="btn-action-icon" onclick="deleteDesignTask('${t.id}')" style="color:red;" title="Xóa task">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Gắn sự kiện Checkbox từng dòng
  document.querySelectorAll('.task-row-checkbox').forEach(cb => {
    cb.onchange = (e) => {
      const id = e.target.dataset.id;
      if (e.target.checked) {
        selectedTaskIds.add(id);
      } else {
        selectedTaskIds.delete(id);
      }
      updateTaskBatchUI();
    };
  });

  updateTaskBatchUI();
}

// Cập nhật trạng thái nút XÓA ĐÃ CHỌN và CHECK ALL
function updateTaskBatchUI() {
  const btnBatch = document.getElementById('btn-batch-del-tasks');
  const countEl = document.getElementById('selected-task-count');
  const checkAllBox = document.getElementById('check-all-tasks');

  const count = selectedTaskIds.size;
  if (countEl) countEl.innerText = count;

  if (btnBatch) {
    btnBatch.style.display = count > 0 ? 'inline-flex' : 'none';
  }

  const rowBoxes = document.querySelectorAll('.task-row-checkbox');
  if (checkAllBox) {
    checkAllBox.checked = rowBoxes.length > 0 && Array.from(rowBoxes).every(cb => cb.checked);
  }
}

// Check All
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
      if (isChecked) {
        selectedTaskIds.add(t.id);
      } else {
        selectedTaskIds.delete(t.id);
      }
    });

    document.querySelectorAll('.task-row-checkbox').forEach(cb => {
      cb.checked = isChecked;
    });

    updateTaskBatchUI();
  };
}

// Xóa hàng loạt Task có mã PIN 2026
const btnBatchDelTasks = document.getElementById('btn-batch-del-tasks');
if (btnBatchDelTasks) {
  btnBatchDelTasks.onclick = async () => {
    if (selectedTaskIds.size === 0) return;

    const pin = prompt(`Bạn đang chọn xóa ${selectedTaskIds.size} task design.\nNhập mã PIN Admin để xác nhận xóa hàng loạt:`);
    if (pin !== '2026') {
      if (pin !== null) alert("Sai mã PIN Admin!");
      return;
    }

    const idsToDelete = Array.from(selectedTaskIds);
    const { error } = await window.sb
      .from('design_tasks')
      .delete()
      .in('id', idsToDelete);

    if (error) {
      alert("Lỗi khi xóa: " + error.message);
    } else {
      selectedTaskIds.clear();
      alert(`Đã xóa thành công ${idsToDelete.length} task design!`);
      fetchDesignTasks();
    }
  };
}

// Hàm Copy Brief nhanh
window.copyBrief = (text) => {
  navigator.clipboard.writeText(text).then(() => {
    alert(`Đã copy: "${text}"`);
  });
};

// Gắn sự kiện cho các nút Tab Filter
document.querySelectorAll('.task-filter-btn').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.task-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeTaskFilter = btn.dataset.taskFilter;
    renderDesignTasks();
  };
});

// GẮN CHẶT CÁC HÀM TÁC VỤ VÀO WINDOW ĐỂ GỌI ĐƯỢC TỪ ONCLICK
window.openTaskImage = (url, title) => {
  const prevEl = document.getElementById('image-modal-preview');
  const titleEl = document.getElementById('image-modal-title');
  const dlEl = document.getElementById('btn-download-hd');
  const modalEl = document.getElementById('image-modal');
  if (prevEl) prevEl.src = url;
  if (titleEl) titleEl.innerText = title;
  if (dlEl) dlEl.href = url;
  if (modalEl) modalEl.classList.add('active');
};

const btnCloseImg = document.getElementById('btn-close-image');
if (btnCloseImg) {
  btnCloseImg.onclick = () => {
    const modalEl = document.getElementById('image-modal');
    if (modalEl) modalEl.classList.remove('active');
  };
}

window.toggleTaskStatus = async (id, currentStatus) => {
  const nextStatus = currentStatus === 'DESIGN' ? 'DONE' : 'DESIGN';
  await window.sb.from('design_tasks').update({ status: nextStatus }).eq('id', id);
};

window.deleteDesignTask = async (id) => {
  if (confirm('Xóa task design này?')) {
    await window.sb.from('design_tasks').delete().eq('id', id);
  }
};

// HÀM MỞ MODAL SỬA TASK (ĐÃ GẮN VÀO WINDOW)
window.openEditTaskModal = (id) => {
  const task = designTasks.find(t => t.id === id);
  if (!task) return;

  const idInput = document.getElementById('edit-task-id');
  const typeInput = document.getElementById('edit-task-type');
  const priInput = document.getElementById('edit-task-priority');
  const briefInput = document.getElementById('edit-task-brief');
  const imgInput = document.getElementById('edit-task-imgurl');
  const noteInput = document.getElementById('edit-task-note');
  const statInput = document.getElementById('edit-task-status');
  const fileInput = document.getElementById('edit-task-file');
  const modal = document.getElementById('edit-task-modal');

  if (idInput) idInput.value = task.id;
  if (typeInput) typeInput.value = task.task_type;
  if (priInput) priInput.value = task.priority;
  if (briefInput) briefInput.value = task.brief;
  if (imgInput) imgInput.value = task.img_url || '';
  if (noteInput) noteInput.value = task.note || '';
  if (statInput) statInput.value = task.status;
  if (fileInput) fileInput.value = '';

  if (modal) modal.classList.add('active');
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
    if (submitBtn) {
      submitBtn.innerText = 'ĐANG LƯU...';
      submitBtn.disabled = true;
    }

    try {
      let finalImgUrl = document.getElementById('edit-task-imgurl').value.trim();
      const fileInput = document.getElementById('edit-task-file');
      const file = fileInput ? fileInput.files[0] : null;

      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `task_${Date.now()}.${fileExt}`;
        const { error: upErr } = await window.sb.storage.from('stack-assets').upload(fileName, file);
        if (!upErr) {
          const { data } = window.sb.storage.from('stack-assets').getPublicUrl(fileName);
          finalImgUrl = data.publicUrl;
        }
      }

      await window.sb.from('design_tasks').update({
        task_type: document.getElementById('edit-task-type').value,
        priority: document.getElementById('edit-task-priority').value,
        brief: document.getElementById('edit-task-brief').value,
        note: document.getElementById('edit-task-note').value,
        img_url: finalImgUrl,
        status: document.getElementById('edit-task-status').value
      }).eq('id', id);

      const modal = document.getElementById('edit-task-modal');
      if (modal) modal.classList.remove('active');
      fetchDesignTasks();
    } catch (err) {
      console.error(err);
    } finally {
      if (submitBtn) {
        submitBtn.innerText = 'LƯU THAY ĐỔI';
        submitBtn.disabled = false;
      }
    }
  };
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
    let uploadedUrl = '';
    const fileInput = document.getElementById('task-image-file');
    const file = fileInput ? fileInput.files[0] : null;

    if (file) {
      const fileExt = file.name.split('.').pop();
      const fileName = `task_${Date.now()}.${fileExt}`;
      const { error: upErr } = await window.sb.storage.from('stack-assets').upload(fileName, file);
      if (!upErr) {
        const { data } = window.sb.storage.from('stack-assets').getPublicUrl(fileName);
        uploadedUrl = data.publicUrl;
      }
    }

    await window.sb.from('design_tasks').insert([{
      task_type: document.getElementById('task-type-select').value,
      priority: document.getElementById('task-priority-select').value,
      brief: document.getElementById('task-brief-input').value,
      note: document.getElementById('task-note-input').value,
      img_url: uploadedUrl,
      status: document.getElementById('task-status-select').value
    }]);

    e.target.reset();
    if (taskModal) taskModal.classList.remove('active');
  };
}

// ==========================================
// BẢNG NGHỈ PHÉP
// ==========================================
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

  await window.sb.from('schedules').update({ [columnKey]: updatedMatrix, updated_at: new Date() }).eq('id', currentTab);
};

window.handleRemoveSlot = async (columnKey, rIdx, cIdx, sIdx, memberName) => {
  const myName = localStorage.getItem('gl_current_user') || 'Vinci';
  const targetWeek = scheduleCache[currentTab];
  if (!targetWeek) return;

  if (memberName === myName) {
    if (!confirm(`Hủy ca của bạn (${myName})?`)) return;
  } else {
    const pin = prompt(`Slot của [${memberName}]. Nhập PIN Admin để xóa:`);
    if (pin !== '2026') return pin !== null && alert('Sai PIN!');
  }

  const updatedMatrix = JSON.parse(JSON.stringify(targetWeek[columnKey]));
  updatedMatrix[rIdx].slots[cIdx].splice(sIdx, 1);

  await window.sb.from('schedules').update({ [columnKey]: updatedMatrix, updated_at: new Date() }).eq('id', currentTab);
};

const btnAddLeave = document.getElementById('btn-add-leave');
if (btnAddLeave) {
  btnAddLeave.onclick = async () => {
    const myName = localStorage.getItem('gl_current_user') || 'Vinci';
    const name = prompt('Tên thành viên xin off:', myName);
    if (!name) return;
    const time = prompt('Thời gian nghỉ (ví dụ: 10/10 - 20/10):');
    if (!time) return;
    const reason = prompt('Ghi chú / lý do:', 'Đã báo Vinci');

    await window.sb.from('leaves').insert([{ admin_name: name.trim(), time_range: time.trim(), reason: reason ? reason.trim() : 'Đã báo Vinci' }]);
  };
}

window.deleteLeave = async (id) => {
  if (confirm('Xóa đơn xin nghỉ này?')) await window.sb.from('leaves').delete().eq('id', id);
};

// ==========================================
// ĐÔN TUẦN MỚI
// ==========================================
const btnPromoteWeek = document.getElementById('btn-promote-week');
if (btnPromoteWeek) {
  btnPromoteWeek.onclick = async () => {
    const pin = prompt('Nhập mã PIN Admin để ĐÔN TUẦN:');
    if (pin !== '2026') return pin !== null && alert('Sai PIN!');

    const nextWeek = scheduleCache['next'];
    if (!nextWeek) return alert('Chưa tải được dữ liệu tuần sau!');

    const newLabel = prompt('Tên hiển thị tuần sau mới:', 'ĐĂNG KÝ TUẦN MỚI');
    if (!newLabel) return;

    await window.sb.from('schedules').update({
      week_label: nextWeek.week_label.replace('ĐĂNG KÝ TUẦN SAU', 'TUẦN NÀY'),
      writing_short_data: nextWeek.writing_short_data,
      writing_long_data: nextWeek.writing_long_data,
      posting_data: nextWeek.posting_data,
      design_shifts_data: nextWeek.design_shifts_data,
      updated_at: new Date()
    }).eq('id', 'current');

    const blankShort = [
      { shift: "Sáng", time: "Trước 9h", slots: [[], [], [], [], [], [], []] },
      { shift: "Trưa", time: "Trước 11h00", slots: [[], [], [], [], [], [], []] },
      { shift: "Chiều", time: "14-18h", slots: [[], [], [], [], [], [], []] }
    ];
    const blankLong = [
      { shift: "Sáng", time: "19h", slots: [[], [], [], [], [], [], []] },
      { shift: "Trưa", time: "21h", slots: [[], [], [], [], [], [], []] }
    ];
    const blankPosting = [
      { shift: "Đêm/Sáng", time: "0h - 10h30", slots: [[], [], [], [], [], [], []] },
      { shift: "Trưa/Tối", time: "10h30 - 23h", slots: [[], [], [], [], [], [], []] }
    ];
    const blankDesignShifts = [
      { shift: "Fix ảnh Page", time: "Hằng ngày", slots: [[], [], [], [], [], [], []] }
    ];

    await window.sb.from('schedules').update({
      week_label: newLabel,
      writing_short_data: blankShort,
      writing_long_data: blankLong,
      posting_data: blankPosting,
      design_shifts_data: blankDesignShifts,
      updated_at: new Date()
    }).eq('id', 'next');

    alert('ĐÃ ĐÔN TUẦN THÀNH CÔNG!');
  };
}

// ==========================================
// CHUYỂN BAN & CHUYỂN TUẦN
// ==========================================
const sectionContent = document.getElementById('section-content-team');
const sectionDesign = document.getElementById('section-design-team');
const btnContentTab = document.getElementById('tab-btn-content');
const btnDesignTab = document.getElementById('tab-btn-design');

if (btnContentTab && btnDesignTab) {
  btnContentTab.onclick = () => {
    btnContentTab.classList.add('active');
    btnDesignTab.classList.remove('active');
    if (sectionContent) sectionContent.style.display = 'block';
    if (sectionDesign) sectionDesign.style.display = 'none';
  };

  btnDesignTab.onclick = () => {
    btnDesignTab.classList.add('active');
    btnContentTab.classList.remove('active');
    if (sectionDesign) sectionDesign.style.display = 'block';
    if (sectionContent) sectionContent.style.display = 'none';
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

// ==========================================
// TỰ ĐỘNG LÀM MỚI KHI BẬT ĐIỆN THOẠI
// ==========================================
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

// Realtime
window.sb.channel('realtime_schedules_all')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'schedules' }, fetchScheduleData)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'design_tasks' }, fetchDesignTasks)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'leaves' }, fetchLeavesData)
  .subscribe();

// Khởi chạy
fetchScheduleData();
fetchDesignTasks();
fetchLeavesData();