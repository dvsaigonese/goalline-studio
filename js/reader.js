const STORE = 'gl_reader_v3';
let cfg = { server: '', user: '', pass: '', apiKey: '' };
let currentUrl = '';
let currentHtml = '';
let currentBlobUrl = null;
let corsOk = null;
let viewingTrans = false;
let cachedTranslations = {}; 

const TABS = {
  'football-all': { url: 'https://www.nytimes.com/athletic/football/', page: 1, loaded: false, urls: new Set(), icon: '⚽' },
  'football-epl': { url: 'https://www.nytimes.com/athletic/football/premier-league/', page: 1, loaded: false, urls: new Set(), icon: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  'football-ucl': { url: 'https://www.nytimes.com/athletic/football/champions-league/', page: 1, loaded: false, urls: new Set(), icon: '🏆' },
  'football-laliga': { url: 'https://www.nytimes.com/athletic/football/la-liga/', page: 1, loaded: false, urls: new Set(), icon: '🇪🇸' },
  'football-bundesliga': { url: 'https://www.nytimes.com/athletic/football/bundesliga/', page: 1, loaded: false, urls: new Set(), icon: '🇩🇪' },
  'football-seriea': { url: 'https://www.nytimes.com/athletic/football/serie-a/', page: 1, loaded: false, urls: new Set(), icon: '🇮🇹' },
  'football-wildcard': { url: 'https://www.nytimes.com/athletic/football/world-cup/', page: 1, loaded: false, urls: new Set(), icon: '🌍' },
  'nba': { url: 'https://www.nytimes.com/athletic/nba/', page: 1, loaded: false, urls: new Set(), icon: '🏀' },
  'f1': { url: 'https://www.nytimes.com/athletic/formula-1/', page: 1, loaded: false, urls: new Set(), icon: '🏎️' },
  'tennis': { url: 'https://www.nytimes.com/athletic/tennis/', page: 1, loaded: false, urls: new Set(), icon: '🎾' }
};

let currentMainTab = 'football';
let currentTab = 'football-all';
let isLoadingMore = false;

/* ─── DOM Helpers ─────────────────────────────────── */
const $ = id => document.getElementById(id);
const statusDot = $('statusDot');
const statusLabel = $('statusLabel');
const notCfg = $('notConfiguredBanner');
const urlWrap = $('urlWrap');
const urlInput = $('articleUrl');
const btnRead = $('btnRead');
const btnTranslate = $('btnTranslate');
const btnNewTab = $('btnNewTab');
const btnOriginal = $('btnOriginal');
const sepTab = $('sepTab');
const loadOvl = $('loadingOverlay');
const loadTxt = $('loadingText');
const emptyState = $('emptyState');
const frame = $('viewerFrame');
const transPanel = $('transPanel');
const transContent = $('transContent');
const btnRefreshHL = $('btnRefreshHL');

/* ─── Mobile Sidebar & TABS Logic ─────────────────── */
const btnToggleSidebar = $('btnToggleSidebar');
const sidebar = $('sidebar');
const sidebarBackdrop = $('sidebarBackdrop');

window.toggleSidebar = function() {
  if (sidebar) sidebar.classList.toggle('on');
  if (sidebarBackdrop) sidebarBackdrop.classList.toggle('on');
};

if (btnToggleSidebar) btnToggleSidebar.addEventListener('click', toggleSidebar);
if (sidebarBackdrop) sidebarBackdrop.addEventListener('click', toggleSidebar);

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const mainTab = btn.dataset.tab;
    if (currentMainTab === mainTab) return;
    currentMainTab = mainTab;

    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const subTabsContainer = $('subTabsFootball');
    if (mainTab === 'football') {
      subTabsContainer.classList.remove('hidden-sub-tabs');
      const activeSubBtn = subTabsContainer.querySelector('.sub-tab-btn.active');
      currentTab = activeSubBtn ? activeSubBtn.dataset.tab : 'football-all';
    } else {
      subTabsContainer.classList.add('hidden-sub-tabs');
      currentTab = mainTab;
    }

    switchList(currentTab);
  });
});

document.querySelectorAll('.sub-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const subTab = btn.dataset.tab;
    if (currentTab === subTab) return;
    
    document.querySelectorAll('.sub-tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    currentTab = subTab;
    switchList(currentTab);
  });
});

function switchList(tabId) {
  document.querySelectorAll('.hl-list').forEach(l => l.classList.remove('active'));
  const listEl = document.getElementById(`list-${tabId}`);
  if (listEl) listEl.classList.add('active');

  if (!TABS[tabId].loaded) {
    loadHeadlines(tabId, 1);
  }
}

/* ─── Init & Setup ────────────────────────────────── */
function init() {
  try { const s = localStorage.getItem(STORE); if (s) cfg = { ...cfg, ...JSON.parse(s) }; } catch (e) {}
  fillSettings();
  syncUI();
  if (cfg.server) pingCors().then(() => loadHeadlines(currentTab, 1));
}

function syncUI() {
  const ok = !!cfg.server;
  if (notCfg) notCfg.style.display = ok ? 'none' : 'flex';
  if (urlWrap) urlWrap.style.display = ok ? 'flex' : 'none';
  [btnRead, btnTranslate, btnNewTab, sepTab].forEach(el => { if (el) el.classList.toggle('hidden', !ok); });
  if (btnRead && urlInput) btnRead.disabled = !urlInput.value.trim();
  if (btnTranslate) btnTranslate.disabled = !currentUrl || !cfg.apiKey;
  if (statusDot) statusDot.className = !ok ? 'status-dot' : (corsOk === false ? 'status-dot err' : 'status-dot on');
  if (statusLabel) statusLabel.textContent = ok ? cfg.server.replace(/^https?:\/\//, '').slice(0, 24).toUpperCase() : 'OFFLINE';
}

function fillSettings() {
  if ($('cfgServer')) $('cfgServer').value = cfg.server || '';
  if ($('cfgUser')) $('cfgUser').value = cfg.user || '';
  if ($('cfgPass')) $('cfgPass').value = cfg.pass || '';
  if ($('cfgApiKey')) $('cfgApiKey').value = cfg.apiKey || '';
}

window.openSettings = function() { fillSettings(); if ($('settingsPanel')) $('settingsPanel').classList.add('on'); if ($('backdrop')) $('backdrop').classList.add('on'); };
window.closeSettings = function() { if ($('settingsPanel')) $('settingsPanel').classList.remove('on'); if ($('backdrop')) $('backdrop').classList.remove('on'); };

window.saveSettings = function() {
  const server = $('cfgServer').value.trim().replace(/\/$/, '');
  if (!server) { alert('Vui lòng nhập URL Ladder server.'); return; }
  cfg = { server: server, user: $('cfgUser').value.trim(), pass: $('cfgPass').value, apiKey: $('cfgApiKey').value.trim() };
  localStorage.setItem(STORE, JSON.stringify(cfg));
  corsOk = null; syncUI(); closeSettings();
  
  Object.keys(TABS).forEach(k => {
    TABS[k].loaded = false; TABS[k].page = 1; TABS[k].urls.clear();
    const listEl = document.getElementById(`list-${k}`);
    if (listEl) listEl.innerHTML = '';
  });
  pingCors().then(() => loadHeadlines(currentTab, 1));
};

/* ─── Networking ──────────────────────────────────── */
function authHdr() { return (cfg.user && cfg.pass) ? { 'Authorization': 'Basic ' + btoa(`${cfg.user}:${cfg.pass}`) } : {}; }

async function fetchLadder(url) {
  const res = await fetch(`${cfg.server}/api/${url}`, { headers: authHdr(), signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  try { const data = JSON.parse(text); if (data && data.body) return data.body; } catch (e) {}
  return text;
}

async function pingCors() { 
  try { 
    await fetch(`${cfg.server}/ruleset`, { headers: authHdr(), signal: AbortSignal.timeout(6000) }); 
    corsOk = true; 
  } catch (e) { 
    corsOk = false; 
  } 
  syncUI(); 
}

window.testConn = async function() {
  const tr = $('testResult');
  tr.style.display = 'block';
  tr.className = 'test-result';
  tr.textContent = 'ĐANG KIỂM TRA…';
  const server = $('cfgServer').value.trim().replace(/\/$/, '');
  const u = $('cfgUser').value.trim();
  const p = $('cfgPass').value;
  const hdrs = (u && p) ? { 'Authorization': 'Basic ' + btoa(`${u}:${p}`) } : {};
  try {
    const res = await fetch(`${server}/ruleset`, { headers: hdrs, signal: AbortSignal.timeout(6000) });
    if (res.ok) { tr.className = 'test-result ok'; tr.textContent = '✓ KẾT NỐI SERVER THÀNH CÔNG!'; }
    else { tr.className = 'test-result err'; tr.textContent = `LỖI: HTTP ${res.status}`; }
  } catch(e) {
    tr.className = 'test-result err'; tr.textContent = `THẤT BẠI: ${e.message}`;
  }
};

/* ─── Headlines Parsing & Infinite Scroll ─────────── */
window.refreshCurrentTab = function() {
  TABS[currentTab].loaded = false;
  loadHeadlines(currentTab, 1);
};

window.loadHeadlines = async function(tabId, page = 1) {
  if (!cfg.server) return;
  const tabData = TABS[tabId];
  const listEl = document.getElementById(`list-${tabId}`);
  
  if (page === 1) {
    tabData.page = 1; tabData.urls.clear();
    if (listEl) listEl.innerHTML = `<div class="hl-empty"><div class="neo-spinner" style="width:28px;height:28px;margin:0 auto 12px"></div>FETCHING ${tabId.replace('football-','').toUpperCase()}…</div>`;
    if (btnRefreshHL) btnRefreshHL.classList.add('spin');
    if (corsOk === null) await pingCors();
    if (!corsOk) { 
      if (listEl) listEl.innerHTML = `<div class="hl-empty" style="background:var(--pink);color:#fff">⚠️ CORS BỊ CHẶN</div>`; 
      if (btnRefreshHL) btnRefreshHL.classList.remove('spin'); 
      return; 
    }
  } else {
    if (listEl) {
      const loader = document.createElement('div'); loader.id = `hlLoader-${tabId}`;
      loader.innerHTML = `<div class="neo-spinner" style="width:24px;height:24px;margin:15px auto"></div>`;
      listEl.appendChild(loader);
    }
  }
  
  try {
    const fetchUrl = page === 1 ? tabData.url : `${tabData.url}?page=${page}`;
    const html = await fetchLadder(fetchUrl);
    const items = parseAthletic(html, tabData);
    
    items.sort((a, b) => b.timestamp - a.timestamp);
    tabData.loaded = true;

    if (page === 1) {
      renderHeadlines(items, listEl, tabData.icon);
    } else {
      const loader = document.getElementById(`hlLoader-${tabId}`);
      if (loader) loader.remove();
      if (items.length > 0) appendHeadlines(items, listEl);
      else if (listEl) listEl.insertAdjacentHTML('beforeend', `<div style="text-align:center; padding:15px; font-weight:800; font-size:11px">HẾT DỮ LIỆU.</div>`);
    }
  } catch(e) {
    if (page === 1 && listEl) listEl.innerHTML = `<div class="hl-empty" style="background:var(--pink);color:#fff">❌ LỖI DỮ LIỆU<br/><span style="font-size:10px">${esc(e.message)}</span></div>`; 
    const loader = document.getElementById(`hlLoader-${tabId}`); if (loader) loader.remove(); 
  }
  if (page === 1 && btnRefreshHL) btnRefreshHL.classList.remove('spin');
  isLoadingMore = false;
};

Object.keys(TABS).forEach(tabId => {
  const listEl = document.getElementById(`list-${tabId}`);
  if (listEl) {
    listEl.addEventListener('scroll', () => {
      if (listEl.scrollTop + listEl.clientHeight >= listEl.scrollHeight - 50) {
        if (!isLoadingMore && corsOk && TABS[tabId].loaded) {
          isLoadingMore = true; TABS[tabId].page++; loadHeadlines(tabId, TABS[tabId].page);
        }
      }
    });
  }
});

function parseAthletic(html, tabData) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const items = [];

  function getOriginalUrl(href) {
    if (!href) return null;
    const match = decodeURIComponent(href).match(/\/athletic\/\d{6,}[^\s"']*/);
    if (match) return 'https://www.nytimes.com' + match[0].replace(/\/\/+/g, '/');
    return null;
  }

  doc.querySelectorAll('a[href]').forEach(a => {
    const orig = getOriginalUrl(a.getAttribute('href'));
    if (!orig || tabData.urls.has(orig)) return;

    const container = a.closest('article, [data-testid="story-card"]') || a;
    let finalDate = '';
    let timestamp = 0;
    
    const dateMatch = orig.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
    if (dateMatch) {
      finalDate = `${dateMatch[3]}/${dateMatch[2]}/${dateMatch[1]}`;
      timestamp = new Date(`${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}T00:00:00Z`).getTime();
    } else {
      const textContent = container.textContent.toLowerCase();
      if (textContent.match(/\d+\s*(h|m|hour|minute)s?\s*ago/)) {
        const now = new Date();
        finalDate = now.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
        timestamp = now.getTime();
      } else {
        const timeTag = container.querySelector('time');
        if (timeTag && timeTag.getAttribute('datetime')) {
          try {
            const d = new Date(timeTag.getAttribute('datetime'));
            if (!isNaN(d)) {
              finalDate = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
              timestamp = d.getTime();
            }
          } catch(e) {}
        }
      }
    }
    if (timestamp === 0) timestamp = Date.now() - Math.random() * 10000;

    const temp = container.cloneNode(true);
    temp.querySelectorAll('p, h1, h2, h3, h4, h5, div, br, li, ul, article, section').forEach(el => {
      el.prepend(doc.createTextNode('\n')); el.append(doc.createTextNode('\n'));
    });

    const rawText = temp.textContent || '';
    const chunks = rawText.split('\n').map(t => t.trim().replace(/\s+/g, ' ')).filter(t => t.length > 1);
    if (chunks.length === 0) return;
    const uniqueChunks = [...new Set(chunks)];

    const titleEl = container.querySelector('h2, h3, h4, h5, [class*="title"], [class*="headline"]');
    let title = titleEl ? titleEl.textContent.trim().replace(/\s+/g, ' ') : [...uniqueChunks].sort((x, y) => y.length - x.length)[0];
    if (!title || title.length < 15 || title.length > 250) return;
    
    tabData.urls.add(orig);

    let excerpt = '', author = '', comments = '';
    const remaining = uniqueChunks.filter(c => !title.includes(c) && !c.includes(title));

    remaining.forEach(txt => {
      const lower = txt.toLowerCase();
      if (lower.match(/read more|min read|share|save/) || lower === 'opinion' || lower === 'analysis') return;
      if (/^\d+$/.test(txt) || /^\d+[kKmMsS]$/.test(txt)) comments = txt;
      else if (txt.length > 45) { if (!excerpt) excerpt = txt; } 
      else if (txt.length > 3 && txt.length <= 45) {
        const isDate = lower.includes('ago') || lower.includes('202') || /^\w{3} \d{1,2}/.test(txt);
        if (!author && txt.split(' ').length <= 6 && !isDate) author = txt;
      }
    });

    if (author) {
      const match = author.match(/^(.*?[a-zA-Z\.'’])(\d+)$/);
      if (match) { author = match[1].trim(); if (!comments) comments = match[2]; }
    }

    items.push({ title, excerpt, author, comments, url: orig, date: finalDate, timestamp: timestamp });
  });

  return items;
}

function renderHeadlines(items, listEl, icon) {
  if (!listEl) return;
  if (!items.length) { listEl.innerHTML = `<div class="hl-empty">${icon} KHÔNG CÓ BÀI VIẾT</div>`; return; }
  listEl.innerHTML = ''; 
  appendHeadlines(items, listEl);
}

function appendHeadlines(items, listEl) {
  if (!listEl || !items.length) return;
  const currentCount = listEl.querySelectorAll('.hl-item').length;
  const html = items.map((a, i) => `
    <div class="hl-item" data-url="${esc(a.url)}" data-i="${currentCount + i}" onclick="pickHL(this)">
      <div class="hl-title">${esc(a.title)}</div>
      ${a.excerpt ? `<div class="hl-excerpt">${esc(a.excerpt)}</div>` : ''}
      <div class="hl-footer">
        ${a.author ? `<span class="hl-author">BY: ${esc(a.author)}</span>` : ''}
        <div class="hl-meta-row">
          ${a.date ? `<span class="hl-date">${a.date}</span>` : '<span></span>'}
          ${a.comments ? `<span class="hl-comments">💬 ${esc(a.comments)}</span>` : ''}
        </div>
      </div>
    </div>`).join('');
  listEl.insertAdjacentHTML('beforeend', html);
}

window.pickHL = function(el) {
  document.querySelectorAll('.hl-item').forEach(x => x.classList.remove('active'));
  el.classList.add('active');
  if (urlInput) urlInput.value = el.dataset.url;
  if (btnRead) btnRead.disabled = false;
  if (window.innerWidth <= 768) { 
    if (sidebar) sidebar.classList.remove('on'); 
    if (sidebarBackdrop) sidebarBackdrop.classList.remove('on'); 
  }
  loadArticle(el.dataset.url);
};

/* ─── Reader Engine & Neobrutalism Frame Styling ─── */
async function loadArticle(url) {
  if (!url) { url = urlInput ? urlInput.value.trim() : ''; }
  if (!url) return;
  try { new URL(url); } catch (e) { alert('URL không hợp lệ.'); return; }
  currentUrl = url; viewingTrans = false;
  if (emptyState) emptyState.style.display = 'none';
  if (loadTxt) loadTxt.textContent = 'FETCHING INTEL…';
  if (loadOvl) loadOvl.classList.add('on');
  if (frame) frame.classList.remove('on');
  if (transPanel) transPanel.classList.remove('on');
  if (btnOriginal) btnOriginal.classList.add('hidden');
  if (btnTranslate) btnTranslate.classList.remove('active');
  if (btnNewTab) btnNewTab.classList.remove('hidden');
  if (sepTab) sepTab.classList.remove('hidden');

  if (corsOk !== false) {
    try {
      if (loadTxt) loadTxt.textContent = 'BYPASSING VIA LADDER…';
      currentHtml = await fetchLadder(url);
      currentHtml = cleanAndStyleHTML(currentHtml);
      setBlobFrame(currentHtml);
      if (loadOvl) loadOvl.classList.remove('on');
      if (frame) frame.classList.add('on');
      if (btnTranslate) btnTranslate.disabled = !cfg.apiKey;
      return;
    } catch(e) { corsOk = false; syncUI(); }
  }

  if (loadTxt) loadTxt.textContent = 'PROXY FALLBACK…';
  currentHtml = ''; if (btnTranslate) btnTranslate.disabled = true;
  let proxyUrl = `${cfg.server}/${encodeURIComponent(url)}`;
  if (cfg.user && cfg.pass) { 
    try { 
      const u = new URL(cfg.server); 
      u.username = cfg.user; 
      u.password = cfg.pass; 
      proxyUrl = `${u.toString().replace(/\/$/, '')}/${encodeURIComponent(url)}`; 
    } catch (e) {} 
  }
  if (frame) { 
    frame.onload = () => { if (loadOvl) loadOvl.classList.remove('on'); frame.classList.add('on'); }; 
    frame.onerror = showFrameErr; 
    frame.src = proxyUrl; 
  }
  setTimeout(() => { if (loadOvl && loadOvl.classList.contains('on')) { loadOvl.classList.remove('on'); if (frame) frame.classList.add('on'); } }, 18000);
}

function setBlobFrame(html) { 
  if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl); 
  const blob = new Blob([html], { type: 'text/html' }); 
  currentBlobUrl = URL.createObjectURL(blob); 
  if (frame) { frame.onload = null; frame.onerror = null; frame.src = currentBlobUrl; } 
}

function showFrameErr() { 
  if (loadOvl) loadOvl.classList.remove('on'); 
  if (emptyState) { 
    emptyState.style.display = 'flex'; 
    const title = emptyState.querySelector('.empty-title'); 
    const desc = emptyState.querySelector('.empty-desc'); 
    if (title) title.textContent = 'X-FRAME BLOCKED'; 
    if (desc) desc.innerHTML = `Nguồn cấp dữ liệu chặn Iframe.<br/>Dùng nút <strong>↗ TAB MỚI</strong> để đọc trực tiếp.`; 
  } 
}

window.openNewTab = function() { if (currentUrl) window.open(`${cfg.server}/${encodeURIComponent(currentUrl)}`, '_blank'); };

/* ─── Gemini AI Translation ───────────────────────── */
async function translateArticle() {
  if (!cfg.apiKey) { openSettings(); return; }
  if (!currentUrl) return;
  if (cachedTranslations[currentUrl]) { 
    if (transContent) transContent.innerHTML = cachedTranslations[currentUrl]; 
    showTransPanel(); 
    return; 
  }

  let text = '';
  if (currentHtml) { text = extractText(currentHtml); } 
  else { 
    try { 
      const doc = frame.contentDocument || frame.contentWindow?.document; 
      if (doc) text = extractFromDoc(doc); 
    } catch (e) {} 
  }
  if (!text || text.length < 100) { 
    if (transContent) transContent.innerHTML = `<div class="alert alert-warn">❌ Không thể trích xuất nội dung văn bản.</div>`; 
    showTransPanel(); 
    return; 
  }

  if (btnTranslate) btnTranslate.disabled = true;
  if (transContent) transContent.innerHTML = `
    <div style="text-align:center; padding: 60px 0;">
      <div class="neo-spinner" style="margin: 0 auto 20px;"></div>
      <div style="font-family:var(--font-cond); font-weight:900; font-size:18px;">GEMINI AI ĐANG DỊCH BÀI VIẾT…</div>
    </div>`;
  showTransPanel();

  const maxC = 25000; 
  const input = text.slice(0, maxC) + (text.length > maxC ? '\n\n[...bài viết được rút gọn]' : '');
  
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${cfg.apiKey}`, {
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Bạn là biên tập viên thể thao của một tờ báo bóng đá Việt Nam chuyên nghiệp. Dịch bài báo The Athletic sau sang tiếng Việt.\nQuy tắc:\n- Văn phong tự nhiên, giữ nguyên tên riêng, số liệu.\n- Chuyển thẻ [IMAGE: url] thành thẻ HTML: <img src="url" alt="Ảnh minh họa">.\n- Trả về HTML thuần, có tiêu đề h1, byline, thẻ p. KHÔNG thêm giải thích ngoài.\nBài báo:\n${input}` }] }],
        generationConfig: { temperature: 0.3 }
      })
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (transContent) transContent.innerHTML = ''; 
    let fullHtml = '';
    const reader = res.body.getReader(); 
    const decoder = new TextDecoder("utf-8");

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ') && line.trim() !== 'data: [DONE]') {
          try {
            const data = JSON.parse(line.slice(6));
            const textPart = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            fullHtml += textPart;
            if (transContent) { 
              transContent.innerHTML = fullHtml.replace(/^```html\s*/i, '').replace(/```\s*$/, ''); 
            }
          } catch (e) {}
        }
      }
    }
    if (transContent) { cachedTranslations[currentUrl] = transContent.innerHTML; }
  } catch(e) { 
    if (transContent) transContent.innerHTML = `<div class="alert alert-warn">❌ LỖI DỊCH: ${esc(e.message)}</div>`; 
  }
  if (btnTranslate) btnTranslate.disabled = false;
}

window.showTransPanel = function() { 
  viewingTrans = true; 
  if (transPanel) transPanel.classList.add('on'); 
  if (frame) frame.classList.remove('on'); 
  if (btnOriginal) btnOriginal.classList.remove('hidden'); 
  if (btnTranslate) btnTranslate.classList.add('active'); 
};

window.showOriginal = function() { 
  viewingTrans = false; 
  if (transPanel) transPanel.classList.remove('on'); 
  if (currentUrl && frame) frame.classList.add('on'); 
  if (btnOriginal) btnOriginal.classList.add('hidden'); 
  if (btnTranslate) btnTranslate.classList.remove('active'); 
};

/* ─── Extraction & Brutalist Injector ─────────────── */
function extractText(html) { return extractFromDoc(new DOMParser().parseFromString(html, 'text/html')); }

function extractFromDoc(doc) {
  const junkSelectors = ['script','style','nav','header','footer','aside','.ad-container','.ad-unit','.paywall-container','.newsletter-wrapper'];
  junkSelectors.forEach(s => { try { doc.querySelectorAll(s).forEach(e => e.remove()); } catch (e) {} });
  const title = doc.querySelector('h1')?.textContent?.trim() || doc.title || ''; 
  const byline = doc.querySelector('[class*="byline"],[class*="author"]')?.textContent?.trim() || ''; 
  const body = doc.querySelector('article,[class*="article-body"],[class*="post-body"],main') || doc.body; 
  const paras = [];
  body.querySelectorAll('p,h2,h3,blockquote,img').forEach(el => {
    if (el.tagName.toLowerCase() === 'img') { 
      const src = el.src || el.getAttribute('data-src'); 
      if (src && !src.startsWith('data:image') && !src.includes('avatar')) paras.push(`[IMAGE: ${src}]`); 
    } else { 
      const t = el.textContent.trim(); 
      if (t.length > 30) paras.push(t); 
    }
  });
  return [title, byline, ...paras].filter(Boolean).join('\n\n');
}

function cleanAndStyleHTML(htmlString) {
  const doc = new DOMParser().parseFromString(htmlString, 'text/html');
  const junkSelectors = ['script','noscript','nav','footer','.ad-container','.ad-unit','.ad-slot','.paywall-container','.newsletter-wrapper','.share-tools','[data-testid*="Social"]'];
  junkSelectors.forEach(s => { try { doc.querySelectorAll(s).forEach(e => e.remove()); } catch (e) {} });
  doc.querySelectorAll('*').forEach(el => { if (el.tagName.toLowerCase() !== 'iframe') el.removeAttribute('style'); });
  
  let metaViewport = doc.querySelector('meta[name="viewport"]'); 
  if (!metaViewport) { 
    metaViewport = doc.createElement('meta'); 
    metaViewport.name = 'viewport'; 
    doc.head.appendChild(metaViewport); 
  }
  metaViewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';

  // Chích phong cách Neobrutalism vào trang đọc báo nội bộ
  const style = doc.createElement('style');
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700;900&family=Playfair+Display:wght@700;900&display=swap');
    :root { --neo-black: #000; --neo-bg: #fffdf5; --neo-yellow: #ffe600; }
    *, *::before, *::after { box-sizing: border-box !important; }
    html { width: 100% !important; background: var(--neo-bg) !important; }
    body { background: var(--neo-bg) !important; color: var(--neo-black) !important; padding: 40px 24px !important; margin: 0 auto !important; max-width: 820px !important; font-family: 'Space Grotesk', sans-serif !important; }
    h1 { font-family: 'Playfair Display', serif !important; font-size: 2.8rem !important; line-height: 1.15 !important; font-weight: 900 !important; margin-bottom: 1.5rem !important; border-bottom: 5px solid var(--neo-yellow) !important; padding-bottom: 15px !important; }
    h2, h3, h4 { font-family: 'Space Grotesk', sans-serif !important; font-weight: 900 !important; text-transform: uppercase !important; margin-top: 2.5rem !important; margin-bottom: 1rem !important; }
    p, li { font-size: 1.2rem !important; line-height: 1.75 !important; margin-bottom: 1.5rem !important; color: #111 !important; }
    img { max-width: 100% !important; height: auto !important; display: block !important; margin: 2rem auto !important; border: 3px solid var(--neo-black) !important; box-shadow: 6px 6px 0px var(--neo-black) !important; }
    blockquote, aside { background: #fff !important; border: 3px solid var(--neo-black) !important; box-shadow: 4px 4px 0px var(--neo-black) !important; padding: 20px !important; margin: 2rem 0 !important; font-style: italic !important; }
    a { color: var(--neo-black) !important; background: var(--neo-yellow) !important; padding: 1px 4px !important; text-decoration: none !important; border: 1px solid var(--neo-black) !important; font-weight: 700 !important; }
  `;
  doc.head.appendChild(style); 
  return doc.documentElement.outerHTML;
}

function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

/* ─── Event Binding ───────────────────────────────── */
if ($('btnSettings')) $('btnSettings').addEventListener('click', openSettings);
if ($('btnRead')) $('btnRead').addEventListener('click', () => loadArticle());
if ($('btnTranslate')) $('btnTranslate').addEventListener('click', translateArticle);
if ($('btnNewTab')) $('btnNewTab').addEventListener('click', openNewTab);
if ($('btnOriginal')) $('btnOriginal').addEventListener('click', showOriginal);
if (urlInput) { 
  urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') loadArticle(); }); 
  urlInput.addEventListener('input', () => { if (btnRead) btnRead.disabled = !urlInput.value.trim(); }); 
}
document.addEventListener('keydown', e => { 
  if (e.key === 'Escape') { 
    if ($('settingsPanel') && $('settingsPanel').classList.contains('on')) closeSettings(); 
    else if (viewingTrans) showOriginal(); 
  } 
});

init();