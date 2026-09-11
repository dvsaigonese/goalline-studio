document.addEventListener('DOMContentLoaded', () => {
  // 1. Phím tắt số: 1 -> Watermark | 2 -> Board | 3 -> Reader | 4 -> Roster
  window.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

    if (e.key === '1') {
      window.location.href = 'watermark.html';
    } else if (e.key === '2') {
      window.location.href = 'board.html';
    } else if (e.key === '3') {
      window.location.href = 'reader.html';
    } else if (e.key === '4') {
      window.location.href = 'roster.html';
    }
  });

  // 2. Đồng hồ số thời gian thực
  const clockEl = document.getElementById('live-clock');
  function updateLiveClock() {
    if (!clockEl) return;
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    clockEl.textContent = `SYSTEM ONLINE [${hours}:${minutes}:${seconds}]`;
  }
  updateLiveClock();
  setInterval(updateLiveClock, 1000);

  // 3. Tự động đồng bộ số liệu Squad Banner từ file JSON
  async function syncRosterBannerStats() {
    const totalTag = document.getElementById('banner-total-tag');
    const statMgmt = document.getElementById('banner-stat-mgmt');
    const statProd = document.getElementById('banner-stat-prod');
    const statHubs = document.getElementById('banner-stat-hubs');
    const statGens = document.getElementById('banner-stat-gens');

    if (!totalTag && !statMgmt) return;

    try {
      const res = await fetch('./assets/data/roster.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const raw = await res.json();
      const roster = Array.isArray(raw) ? raw : (raw.roster || raw.data || []);
      if (!roster.length) return;

      // 1. Tổng số creator
      if (totalTag) {
        totalTag.textContent = `${roster.length} CREATORS ENLISTED`;
      }

      // 2. Ban quản lý (Executive + Management)
      if (statMgmt) {
        const mgmtCount = roster.filter(m => m.team === 'Management' || m.team === 'Executive').length;
        statMgmt.textContent = mgmtCount;
      }

      // 3. Khối sản xuất (Production)
      if (statProd) {
        const prodCount = roster.filter(m => m.team === 'Production').length;
        statProd.textContent = `${prodCount}+`;
      }

      // 4. Số lượng Hub / Địa phương
      if (statHubs) {
        const locations = Array.from(new Set(roster.map(m => (m.location || '').trim()).filter(Boolean)));
        if (locations.includes('HCM') && locations.includes('Hanoi')) {
          const othersCount = locations.length - 2;
          statHubs.textContent = othersCount > 0 ? `HCM, HANOI +${othersCount}` : 'HCM & HANOI';
        } else {
          statHubs.textContent = `${locations.length} HUBS`;
        }
      }

      // 5. Khoảng thế hệ (Gen min -> Gen max)
      if (statGens) {
        const genNumbers = roster
          .map(m => parseInt(m.gen))
          .filter(n => !isNaN(n));

        if (genNumbers.length) {
          const minGen = Math.min(...genNumbers);
          const maxGen = Math.max(...genNumbers);
          statGens.textContent = `${minGen} → ${maxGen}`;
        }
      }
    } catch (err) {
      console.warn("Could not sync roster banner stats:", err);
      if (totalTag) totalTag.textContent = "ROSTER ACTIVE";
    }
  }

  syncRosterBannerStats();

  // 4. Hiệu ứng xúc giác cho các thẻ card khi click
  const cards = document.querySelectorAll('.tool-card');
  cards.forEach(card => {
    card.addEventListener('mousedown', () => {
      card.style.transform = 'translate(3px, 3px)';
      card.style.boxShadow = '1px 1px 0px #000';
    });
    card.addEventListener('mouseup', () => {
      card.style.transform = '';
      card.style.boxShadow = '';
    });
  });
});