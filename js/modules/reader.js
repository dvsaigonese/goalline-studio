/* ─── State ──────────────────────────────────────── */
const STORE = 'gl_reader_v3';
let cfg = { server: '', user: '', pass: '', apiKey: '' };
let currentUrl = '';
let currentHtml = '';
let currentBlobUrl = null;
let corsOk = null;
let viewingTrans = false;
let cachedTranslations = {}; 

const TABS = {
  football: { url: 'https://www.nytimes.com/athletic/football/', page: 1, loaded: false, urls: new Set(), icon: '⚽' },
  nba: { url: 'https://www.nytimes.com/athletic/nba/', page: 1, loaded: false, urls: new Set(), icon: '🏀' },
  f1: { url: 'https://www.nytimes.com/athletic/formula-1/', page: 1, loaded: false, urls: new Set(), icon: '🏎️' },
  tennis: { url: 'https://www.nytimes.com/athletic/tennis/', page: 1, loaded: false, urls: new Set(), icon: '🎾' }
};
let currentTab = 'football';
let isLoadingMore = false;

/* ─── DOM ─────────────────────────────────────────── */
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

/* ─── Mobile Sidebar & Tabs Logic ─────────────────── */
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
    const tabId = btn.dataset.tab;
    if (currentTab === tabId) return;

    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    document.querySelectorAll('.hl-list').forEach(l => l.classList.remove('active'));
    const listEl = document.getElementById(`list-${tabId}`);
    if (listEl) listEl.classList.add('active');

    currentTab = tabId;

    if (!TABS[tabId].loaded) {
      loadHeadlines(tabId, 1);
    }
  });
});

/* ─── Init ────────────────────────────────────────── */
function init() {
  try { 
    const s = localStorage.getItem(STORE); 
    if (s) {
      cfg = { ...cfg, ...JSON.parse(s) }; 
    }
  } catch (e) {
    console.warn("Lỗi đọc config:", e);
  }
  fillSettings();
  syncUI();
  if (cfg.server) {
    pingCors().then(() => loadHeadlines(currentTab, 1));
  }
}

function syncUI() {
  const ok = !!cfg.server;
  if (notCfg) notCfg.style.display = ok ? 'none' : 'flex';
  if (urlWrap) urlWrap.style.display = ok ? 'flex' : 'none';
  
  const buttons = [btnRead, btnTranslate, btnNewTab, sepTab];
  buttons.forEach(el => {
    if (el) el.classList.toggle('hidden', !ok);
  });
  
  if (btnRead && urlInput) {
    btnRead.disabled = !urlInput.value.trim();
  }
  if (btnTranslate) {
    btnTranslate.disabled = !currentUrl || !cfg.apiKey;
  }
  if (statusDot) {
    statusDot.className = !ok ? 'status-dot' : (corsOk === false ? 'status-dot err' : 'status-dot on');
  }
  if (statusLabel) {
    statusLabel.textContent = ok ? cfg.server.replace(/^https?:\/\//, '').slice(0, 38) : 'Chưa cấu hình';
  }
}

function fillSettings() {
  if ($('cfgServer')) $('cfgServer').value = cfg.server || '';
  if ($('cfgUser')) $('cfgUser').value = cfg.user || '';
  if ($('cfgPass')) $('cfgPass').value = cfg.pass || '';
  if ($('cfgApiKey')) $('cfgApiKey').value = cfg.apiKey || '';
}

window.openSettings = function() { 
  fillSettings(); 
  if ($('settingsPanel')) $('settingsPanel').classList.add('on'); 
  if ($('backdrop')) $('backdrop').classList.add('on'); 
};

window.closeSettings = function() { 
  if ($('settingsPanel')) $('settingsPanel').classList.remove('on'); 
  if ($('backdrop')) $('backdrop').classList.remove('on'); 
};

window.saveSettings = function() {
  const server = $('cfgServer').value.trim().replace(/\/$/, '');
  if (!server) { 
    alert('Nhập URL Ladder server.'); 
    return; 
  }
  cfg = { 
    server: server, 
    user: $('cfgUser').value.trim(), 
    pass: $('cfgPass').value, 
    apiKey: $('cfgApiKey').value.trim() 
  };
  localStorage.setItem(STORE, JSON.stringify(cfg));
  corsOk = null;
  syncUI();
  closeSettings();
  
  Object.keys(TABS).forEach(k => {
    TABS[k].loaded = false; 
    TABS[k].page = 1; 
    TABS[k].urls.clear();
    const listEl = document.getElementById(`list-${k}`);
    if (listEl) listEl.innerHTML = '';
  });
  pingCors().then(() => loadHeadlines(currentTab, 1));
};

/* ─── Networking ──────────────────────────────────── */
function authHdr() { 
  if (cfg.user && cfg.pass) {
    return { 'Authorization': 'Basic ' + btoa(`${cfg.user}:${cfg.pass}`) };
  }
  return {}; 
}

async function fetchLadder(url) {
  const res = await fetch(`${cfg.server}/api/${url}`, { 
    headers: authHdr(), 
    signal: AbortSignal.timeout(20000) 
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const text = await res.text();
  try { 
    const data = JSON.parse(text); 
    if (data && data.body) {
      return data.body; 
    }
  } catch (e) {
    // Không phải JSON thì trả về text gốc
  }
  return text;
}

async function pingCors() {
  try { 
    await fetch(`${cfg.server}/ruleset`, { 
      headers: authHdr(), 
      signal: AbortSignal.timeout(6000) 
    }); 
    corsOk = true; 
  } catch (e) { 
    corsOk = false; 
  }
  syncUI();
}

window.testConn = async function() {
  const server = $('cfgServer').value.trim().replace(/\/$/, '');
  const user   = $('cfgUser').value.trim();
  const pass   = $('cfgPass').value;
  const el     = $('testResult');
  if (!el) return;
  
  el.className = 'test-result'; 
  el.textContent = '⏳ Đang kiểm tra…'; 
  el.style.display = 'block';
  
  try {
    const hdr = (user && pass) ? { Authorization: 'Basic ' + btoa(`${user}:${pass}`) } : {};
    const r   = await fetch(`${server}/ruleset`, { headers: hdr, signal: AbortSignal.timeout(8000) });
    if (r.status === 401) { 
      el.className = 'test-result err'; 
      el.textContent = '❌ Sai username/password (401)'; 
    } else { 
      el.className = 'test-result ok'; 
      el.textContent = `✅ Kết nối thành công (${r.status})`; 
    }
  } catch(e) { 
    el.className = 'test-result err'; 
    el.textContent = `❌ ${e.message}`; 
  }
};

/* ─── Headlines & Infinite Scroll ─────────────────── */
window.refreshCurrentTab = function() {
  TABS[currentTab].loaded = false;
  loadHeadlines(currentTab, 1);
};

window.loadHeadlines = async function(tabId, page = 1) {
  if (!cfg.server) return;
  
  const tabData = TABS[tabId];
  const listEl = document.getElementById(`list-${tabId}`);
  
  if (page === 1) {
    tabData.page = 1;
    tabData.urls.clear();
    if (listEl) {
      listEl.innerHTML = `<div class="hl-empty"><div class="spinner" style="width:20px;height:20px;margin:0 auto 10px"></div>Đang tải ${tabId.toUpperCase()}…</div>`;
    }
    if (btnRefreshHL) {
      btnRefreshHL.classList.add('spin');
    }
    
    if (corsOk === null) {
      await pingCors();
    }
    if (!corsOk) {
      if (listEl) {
        listEl.innerHTML = `<div class="cors-notice"><strong>⚠️ CORS bị chặn</strong></div>`;
      }
      if (btnRefreshHL) {
        btnRefreshHL.classList.remove('spin');
      }
      return;
    }
  } else {
    if (listEl) {
      const loader = document.createElement('div');
      loader.id = `hlLoader-${tabId}`;
      loader.innerHTML = `<div class="spinner" style="width:20px;height:20px;margin:15px auto"></div>`;
      listEl.appendChild(loader);
    }
  }
  
  try {
    const fetchUrl = page === 1 ? tabData.url : `${tabData.url}?page=${page}`;
    const html = await fetchLadder(fetchUrl);
    const items = parseAthletic(html, tabData);
    
    tabData.loaded = true;

    if (page === 1) {
      renderHeadlines(items, listEl, tabData.icon);
    } else {
      const loader = document.getElementById(`hlLoader-${tabId}`);
      if (loader) loader.remove();
      
      if (items.length > 0) {
        appendHeadlines(items, listEl);
      } else {
        if (listEl) {
          listEl.insertAdjacentHTML('beforeend', `<div style="text-align:center; padding:15px; color:#6e7681; font-size:11px">Đã hết bài viết!</div>`);
        }
      }
    }
  } catch(e) {
    if (page === 1) { 
      if (listEl) {
        listEl.innerHTML = `<div class="hl-empty">❌ Lỗi tải<br/><span style="font-size:11px">${esc(e.message)}</span></div>`; 
      }
    } else { 
      const loader = document.getElementById(`hlLoader-${tabId}`); 
      if (loader) loader.remove(); 
    }
  }
  if (page === 1 && btnRefreshHL) {
    btnRefreshHL.classList.remove('spin');
  }
  isLoadingMore = false;
};

Object.keys(TABS).forEach(tabId => {
  const listEl = document.getElementById(`list-${tabId}`);
  if (listEl) {
    listEl.addEventListener('scroll', () => {
      if (listEl.scrollTop + listEl.clientHeight >= listEl.scrollHeight - 50) {
        if (!isLoadingMore && corsOk && TABS[tabId].loaded) {
          isLoadingMore = true;
          TABS[tabId].page++;
          loadHeadlines(tabId, TABS[tabId].page);
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
    const decoded = decodeURIComponent(href);
    const match = decoded.match(/\/athletic\/\d{6,}[^\s"']*/);
    if (match) return 'https://www.nytimes.com' + match[0].replace(/\/\/+/g, '/');
    return null;
  }

  doc.querySelectorAll('a[href]').forEach(a => {
    const orig = getOriginalUrl(a.getAttribute('href'));
    if (!orig || tabData.urls.has(orig)) return;

    const container = a.closest('article, [data-testid="story-card"]') || a;
    let finalDate = '';
    
    const dateMatch = orig.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
    if (dateMatch) {
      finalDate = `${dateMatch[3]}/${dateMatch[2]}/${dateMatch[1]}`;
    } else {
      const textContent = container.textContent.toLowerCase();
      if (textContent.match(/\d+\s*(h|m|hour|minute)s?\s*ago/)) {
        finalDate = new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
      } else {
        const timeTag = container.querySelector('time');
        if (timeTag && timeTag.getAttribute('datetime')) {
          try {
            const d = new Date(timeTag.getAttribute('datetime'));
            if (!isNaN(d)) {
              finalDate = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
            }
          } catch(e) {}
        }
      }
    }

    const temp = container.cloneNode(true);
    temp.querySelectorAll('p, h1, h2, h3, h4, h5, div, br, li, ul, article, section').forEach(el => {
      el.prepend(doc.createTextNode('\n'));
      el.append(doc.createTextNode('\n'));
    });

    const rawText = temp.textContent || '';
    const chunks = rawText.split('\n').map(t => t.trim().replace(/\s+/g, ' ')).filter(t => t.length > 1);

    if (chunks.length === 0) return;
    const uniqueChunks = [...new Set(chunks)];

    const titleEl = container.querySelector('h2, h3, h4, h5, [class*="title"], [class*="headline"]');
    let title = '';
    if (titleEl) {
      title = titleEl.textContent.trim().replace(/\s+/g, ' ');
    } else {
      title = [...uniqueChunks].sort((x, y) => y.length - x.length)[0];
    }

    if (!title || title.length < 15 || title.length > 250) return;
    tabData.urls.add(orig);

    let excerpt = '';
    let author = '';
    let comments = '';
    
    const remaining = uniqueChunks.filter(c => !title.includes(c) && !c.includes(title));

    remaining.forEach(txt => {
      const lower = txt.toLowerCase();
      if (lower.match(/read more|min read|share|save/) || lower === 'opinion' || lower === 'analysis') return;
      if (/^\d+$/.test(txt) || /^\d+[kKmMsS]$/.test(txt)) {
        comments = txt;
      } else if (txt.length > 45) { 
        if (!excerpt) excerpt = txt; 
      } else if (txt.length > 3 && txt.length <= 45) {
        const isDate = lower.includes('ago') || lower.includes('202') || /^\w{3} \d{1,2}/.test(txt);
        if (!author && txt.split(' ').length <= 6 && !isDate) {
          author = txt;
        }
      }
    });

    if (author) {
      const match = author.match(/^(.*?[a-zA-Z\.'’])(\d+)$/);
      if (match) { 
        author = match[1].trim(); 
        if (!comments) comments = match[2]; 
      }
    }

    items.push({ title, excerpt, author, comments, url: orig, date: finalDate });
  });

  return items.slice(0, 30);
}

function renderHeadlines(items, listEl, icon) {
  if (!listEl) return;
  if (!items.length) {
    listEl.innerHTML = `<div class="hl-empty"><div class="hl-empty-icon">${icon}</div>Không tìm thấy bài viết.</div>`;
    return;
  }
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
      <div class="hl-footer" style="display: flex; flex-direction: column; align-items: flex-start; gap: 8px; margin-top: 8px;">
        ${a.author ? `<span class="hl-author">✍️ ${esc(a.author)}</span>` : '<span style="display:none"></span>'}
        <div style="display: flex; justify-content: space-between; width: 100%; align-items: center; border-top: 1px dashed rgba(255,255,255,0.06); padding-top: 6px;">
          ${a.date ? `<span style="font-size:10px; color:#8b949e;">📅 ${a.date}</span>` : '<span></span>'}
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

/* ─── Article loader ──────────────────────────────── */
async function loadArticle(url) {
  if (!url) {
    url = urlInput ? urlInput.value.trim() : '';
  }
  if (!url) return;
  
  try { 
    new URL(url); 
  } catch (e) { 
    alert('URL không hợp lệ.'); 
    return; 
  }

  currentUrl = url;
  viewingTrans = false;
  
  if (emptyState) emptyState.style.display = 'none';
  if (loadTxt) loadTxt.textContent = 'Đang tải bài viết…';
  if (loadOvl) loadOvl.classList.add('on');
  if (frame) frame.classList.remove('on');
  if (transPanel) transPanel.classList.remove('on');
  if (btnOriginal) btnOriginal.classList.add('hidden');
  if (btnTranslate) btnTranslate.classList.remove('active');
  if (btnNewTab) btnNewTab.classList.remove('hidden');
  if (sepTab) sepTab.classList.remove('hidden');

  if (corsOk !== false) {
    try {
      if (loadTxt) loadTxt.textContent = 'Đang fetch qua Ladder…';
      currentHtml = await fetchLadder(url);
      currentHtml = cleanAndStyleHTML(currentHtml);
      setBlobFrame(currentHtml);
      if (loadOvl) loadOvl.classList.remove('on');
      if (frame) frame.classList.add('on');
      if (btnTranslate) btnTranslate.disabled = !cfg.apiKey;
      return;
    } catch(e) { 
      corsOk = false; 
      syncUI(); 
    }
  }

  if (loadTxt) loadTxt.textContent = 'Đang mở qua proxy…';
  currentHtml = '';
  if (btnTranslate) btnTranslate.disabled = true;
  
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
    frame.onload = () => { 
      if (loadOvl) loadOvl.classList.remove('on'); 
      frame.classList.add('on'); 
    };
    frame.onerror = showFrameErr;
    frame.src = proxyUrl;
  }
  
  setTimeout(() => { 
    if (loadOvl && loadOvl.classList.contains('on')) { 
      loadOvl.classList.remove('on'); 
      if (frame) frame.classList.add('on'); 
    } 
  }, 18000);
}

function setBlobFrame(html) {
  if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl);
  const blob = new Blob([html], { type: 'text/html' });
  currentBlobUrl = URL.createObjectURL(blob);
  if (frame) { 
    frame.onload = null; 
    frame.onerror = null; 
    frame.src = currentBlobUrl; 
  }
}

function showFrameErr() {
  if (loadOvl) loadOvl.classList.remove('on');
  if (emptyState) {
    emptyState.style.display = 'flex';
    const title = emptyState.querySelector('.empty-title');
    const desc = emptyState.querySelector('.empty-desc');
    if (title) title.textContent = 'Không hiển thị được';
    if (desc) desc.innerHTML = `X-Frame-Options đang chặn iframe.<br/>Dùng <strong>↗ Tab mới</strong> để đọc.`;
  }
}

window.openNewTab = function() { 
  if (currentUrl) window.open(`${cfg.server}/${encodeURIComponent(currentUrl)}`, '_blank'); 
};

/* ─── Translation ─────────────────────────────────── */
async function translateArticle() {
  if (!cfg.apiKey) { 
    openSettings(); 
    return; 
  }
  if (!currentUrl) return;

  if (cachedTranslations[currentUrl]) {
    if (transContent) transContent.innerHTML = cachedTranslations[currentUrl];
    showTransPanel();
    return;
  }

  let text = '';
  if (currentHtml) {
    text = extractText(currentHtml);
  } else { 
    try { 
      const doc = frame.contentDocument || frame.contentWindow?.document; 
      if (doc) text = extractFromDoc(doc); 
    } catch (e) {} 
  }

  if (!text || text.length < 100) {
    if (transContent) transContent.innerHTML = `<div class="trans-error">❌ Không đọc được nội dung bài.</div>`;
    showTransPanel();
    return;
  }

  if (btnTranslate) btnTranslate.disabled = true;
  if (transContent) transContent.innerHTML = `<div class="trans-loading"><div class="spinner"></div><p>Gemini đang chuẩn bị dịch...</p></div>`;
  showTransPanel();

  const maxC = 25000;
  const input = text.slice(0, maxC) + (text.length > maxC ? '\n\n[...bài viết được rút gọn]' : '');

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${cfg.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ 
          parts: [{ 
            text: `Bạn là biên tập viên thể thao của một tờ báo bóng đá Việt Nam chuyên nghiệp. Dịch bài báo The Athletic sau sang tiếng Việt.\nQuy tắc:\n- Văn phong tự nhiên, giữ nguyên tên riêng, số liệu.\n- Chuyển thẻ [IMAGE: url] thành thẻ HTML: <img src="url" alt="Ảnh minh họa">.\n- Trả về HTML thuần, có tiêu đề h1, byline, thẻ p. KHÔNG thêm giải thích ngoài.\nBài báo:\n${input}` 
          }] 
        }],
        generationConfig: { temperature: 0.3 },
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" }, 
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" }, 
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" }, 
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
        ]
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
    
    if (transContent) {
      cachedTranslations[currentUrl] = transContent.innerHTML;
    }
  } catch(e) {
    if (transContent) transContent.innerHTML = `<div class="trans-error">❌ Lỗi dịch: ${esc(e.message)}</div>`;
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

/* ─── Text extraction ─────────────────────────────── */
function extractText(html) { 
  return extractFromDoc(new DOMParser().parseFromString(html, 'text/html')); 
}

function extractFromDoc(doc) {
  const junkSelectors = ['script','style','nav','header','footer','aside','.ad-container','.ad-unit','.paywall-container','.newsletter-wrapper'];
  junkSelectors.forEach(s => { 
    try { 
      doc.querySelectorAll(s).forEach(e => e.remove()); 
    } catch (e) {} 
  });
  
  const title = doc.querySelector('h1')?.textContent?.trim() || doc.title || '';
  const byline = doc.querySelector('[class*="byline"],[class*="author"]')?.textContent?.trim() || '';
  const body = doc.querySelector('article,[class*="article-body"],[class*="post-body"],main') || doc.body;
  const paras = [];
  
  body.querySelectorAll('p,h2,h3,blockquote,img').forEach(el => {
    if (el.tagName.toLowerCase() === 'img') {
      const src = el.src || el.getAttribute('data-src');
      if (src && !src.startsWith('data:image') && !src.includes('avatar')) {
        paras.push(`[IMAGE: ${src}]`);
      }
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
  
  junkSelectors.forEach(s => {
    try { 
      doc.querySelectorAll(s).forEach(e => e.remove()); 
    } catch (e) {}
  });

  doc.querySelectorAll('*').forEach(el => {
    if (el.tagName.toLowerCase() !== 'iframe') {
      el.removeAttribute('style');
    } else {
      el.setAttribute('scrolling', 'yes');
    }
  });

  let metaViewport = doc.querySelector('meta[name="viewport"]');
  if (!metaViewport) { 
    metaViewport = doc.createElement('meta'); 
    metaViewport.name = 'viewport'; 
    doc.head.appendChild(metaViewport); 
  }
  metaViewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';

  const style = doc.createElement('style');
  style.textContent = `
    :root { --bg: #ffffff; --text: #1a1a1a; --link: #205b31; --border: #e2e8f0; }
    *, *::before, *::after { box-sizing: border-box !important; }
    html { width: 100% !important; max-width: 100vw !important; overflow-x: hidden !important; margin: 0 !important; background: var(--bg) !important; }
    body { background: var(--bg) !important; color: var(--text) !important; padding: 30px 20px !important; margin: 0 auto !important; max-width: 740px !important; width: 100% !important;}
    @media (max-width: 768px) { body { padding: 20px 15px !important; } }
    #__next, #site-content, main, article, header, section, [class*="Grid"], [class*="Container"], [class*="Wrapper"], [class*="Hero"] { display: block !important; position: static !important; height: auto !important; min-height: 0 !important; max-height: none !important; width: 100% !important; max-width: 100% !important; transform: none !important; margin: 0 !important; padding: 0 !important; }
    img[src^="data:image"] { display: none !important; }
    img:not([src^="data:image"]), figure, picture { max-width: 100% !important; height: auto !important; display: block !important; margin: 2rem auto !important; position: static !important; }
    [class*="Article_ContentContainer"], .article-body, p, li, h1, h2, h3, h4 { position: relative !important; z-index: 9999 !important; opacity: 1 !important; visibility: visible !important; background: transparent !important; word-wrap: break-word !important; overflow-wrap: break-word !important; max-width: 100% !important; }
    table { width: 100% !important; border-collapse: collapse !important; margin: 2rem 0 !important; font-family: -apple-system, sans-serif !important; font-size: 0.95rem !important; background: #fff !important; }
    th, td { border-bottom: 1px solid var(--border) !important; padding: 12px 8px !important; text-align: left; }
    th { font-weight: 700 !important; background: #f8f9fa !important; color: #333 !important;}
    tr:hover { background: #f1f5f9 !important; }
    iframe { width: 100% !important; max-width: 100% !important; min-height: 600px !important; border: 1px solid var(--border) !important; border-radius: 6px !important; margin: 2rem 0 !important; display: block !important; resize: vertical !important; background: #f8f9fa !important; }
    aside { display: block !important; background: #f8f9fa !important; padding: 20px !important; margin: 2rem 0 !important; border-left: 4px solid var(--link) !important; font-style: italic; max-width: 100% !important; }
    h1 { font-family: "Playfair Display", Georgia, serif !important; font-size: 2.4rem !important; line-height: 1.2 !important; margin-bottom: 1.5rem !important; font-weight: 700 !important; }
    h2, h3, h4 { font-family: -apple-system, sans-serif !important; margin-top: 2.5rem !important; margin-bottom: 1rem !important; line-height: 1.3 !important; }
    p, li { font-family: Georgia, serif !important; font-size: 1.15rem !important; line-height: 1.7 !important; margin-bottom: 1.4rem !important; color: #333 !important; }
    a { color: var(--link) !important; text-decoration: underline !important; text-underline-offset: 3px; word-break: break-all !important; }
  `;
  doc.head.appendChild(style);
  return doc.documentElement.outerHTML;
}

function esc(s) { 
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); 
}

/* ─── Events ──────────────────────────────────────── */
if ($('btnSettings')) $('btnSettings').addEventListener('click', openSettings);
if ($('btnRead')) $('btnRead').addEventListener('click', () => loadArticle());
if ($('btnTranslate')) $('btnTranslate').addEventListener('click', translateArticle);
if ($('btnNewTab')) $('btnNewTab').addEventListener('click', openNewTab);
if ($('btnOriginal')) $('btnOriginal').addEventListener('click', showOriginal);

if (urlInput) { 
  urlInput.addEventListener('keydown', e => { 
    if (e.key === 'Enter') loadArticle(); 
  }); 
  urlInput.addEventListener('input', () => { 
    if (btnRead) btnRead.disabled = !urlInput.value.trim(); 
  }); 
}

document.addEventListener('keydown', e => { 
  if (e.key === 'Escape') { 
    if ($('settingsPanel') && $('settingsPanel').classList.contains('on')) {
      closeSettings(); 
    } else if (viewingTrans) {
      showOriginal(); 
    }
  } 
});

init();