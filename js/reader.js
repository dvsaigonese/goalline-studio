/**
 * GOAL-LINE STUDIO - READER ENGINE (EXTENSION-DRIVEN ARCHITECTURE)
 * Bỏ hoàn toàn Ladder Proxy server - Chạy qua Chrome Extension Bridge
 */

/* ─── State ──────────────────────────────────────── */
const STORE = 'gl_reader_v3';
let cfg = { apiKey: '' };
let currentUrl = '';
let currentHtml = '';
let currentBlobUrl = null;
let viewingTrans = false;
let cachedTranslations = {};

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

/* ─── Mobile Detection Helper ─────────────────────── */
function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
}

/* ─── Init & Setup ────────────────────────────────── */
function init() {
  try {
    const s = localStorage.getItem(STORE);
    if (s) {
      const parsed = JSON.parse(s);
      cfg.apiKey = parsed.apiKey || '';
    }
  } catch (e) {}

  fillSettings();
  syncUI();

  // Kiểm tra thiết bị di động
  if (isMobileDevice()) {
    showMobileDisabledNotice();
  } else {
    showExtensionGuideNotice();
  }
}

function syncUI() {
  if (notCfg) notCfg.style.display = 'none'; // Ẩn banner cấu hình server cũ
  if (urlWrap) urlWrap.style.display = 'flex';
  [btnRead, btnTranslate, btnNewTab, sepTab].forEach(el => { if (el) el.classList.remove('hidden'); });
  
  if (btnTranslate) btnTranslate.disabled = !currentUrl || !cfg.apiKey;
  if (statusDot) statusDot.className = 'status-dot on';
  if (statusLabel) statusLabel.textContent = 'EXTENSION READY';
}

function fillSettings() {
  if ($('cfgApiKey'))$('cfgApiKey').value = cfg.apiKey || '';
}

window.openSettings = function() {
  fillSettings();
  if ($('settingsPanel'))$('settingsPanel').classList.add('on');
  if ($('backdrop'))$('backdrop').classList.add('on');
};

window.closeSettings = function() {
  if ($('settingsPanel'))$('settingsPanel').classList.remove('on');
  if ($('backdrop'))$('backdrop').classList.remove('on');
};

window.saveSettings = function() {
  cfg = { apiKey: $('cfgApiKey') ?$('cfgApiKey').value.trim() : '' };
  localStorage.setItem(STORE, JSON.stringify(cfg));
  syncUI();
  closeSettings();
};

/* ─── Mobile Disabled Notice (English) ────────────── */
function showMobileDisabledNotice() {
  if (loadOvl) loadOvl.classList.remove('on');
  if (frame) frame.classList.remove('on');
  if (transPanel) transPanel.classList.remove('on');
  if (btnTranslate) btnTranslate.disabled = true;

  if (emptyState) {
    emptyState.style.display = 'flex';
    emptyState.innerHTML = `
      <div class="empty-box">
        <div class="empty-icon-box" style="background:var(--pink); color:#fff;">
          <i class="fa-solid fa-mobile-screen-button"></i>
        </div>
        <p class="empty-title" style="color:var(--pink);">READER DISABLED ON MOBILE</p>
        
        <div class="empty-guide-card" style="background:#fff;">
          <div class="guide-tag" style="background:var(--pink); color:#fff;">RESTRICTION NOTICE</div>
          <p style="margin-bottom: 10px; font-weight:600;">
            Due to strict anti-bot shields protecting The Athletic's servers, content extraction now exclusively relies on our desktop <strong>Chrome Extension Bridge</strong>.
          </p>
          <div style="background:var(--yellow); color:#000; padding:10px 12px; border:2px solid #000; box-shadow:2px 2px 0 #000; font-weight:800; font-size:12px;">
            ⚠️ Mobile browsers cannot run desktop unpacked extensions. Mobile reading mode is therefore disabled.
          </div>
        </div>

        <div class="empty-footer-note">
          👉 Please access Goal-Line Studio on a <strong>PC / Mac</strong>.<br/>
          👉 DM <strong>Vinci</strong> to receive the extension setup files.
        </div>
      </div>
    `;
  }
}

/* ─── Desktop Extension Guide Notice (English) ────── */
function showExtensionGuideNotice() {
  if (emptyState) {
    emptyState.style.display = 'flex';
    emptyState.innerHTML = `
      <div class="empty-box">
        <div class="empty-icon-box" style="background:var(--yellow); color:#000;">
          <i class="fa-solid fa-puzzle-piece"></i>
        </div>
        <p class="empty-title">NO ARTICLE DISPATCHED</p>

        <div class="empty-guide-card">
          <span class="guide-tag">⚡ EXTENSION DISPATCH WORKFLOW</span>
          <ol class="guide-steps">
            <li>Install <strong>Goal-Line Reader Bridge</strong> in Chrome (DM <strong>Vinci</strong> for files).</li>
            <li>Open any article on <strong>The Athletic</strong>.</li>
            <li>Click the yellow button <strong>[⚡ SEND TO GL READER]</strong> at the bottom-right corner.</li>
            <li>Content & full-res imagery will automatically sync here for reading & AI translation.</li>
          </ol>
        </div>

        <div class="empty-footer-note">
          * Desktop only: Reading engine is not supported on mobile browsers.
        </div>
      </div>
    `;
  }
}

/* ─── Action: Manual Read Button Handler ──────────── */
function loadArticle(url) {
  if (isMobileDevice()) {
    showMobileDisabledNotice();
    return;
  }

  const targetUrl = url || (urlInput ? urlInput.value.trim() : '');
  if (!targetUrl) return;

  alert(
    "Direct server scraping is permanently deprecated.\n\n" +
    "👉 Please open this article on Chrome desktop and click [⚡ SEND TO GL READER] via the extension.\n" +
    "(If you haven't installed the extension, DM Vinci to get the archive package!)"
  );

  window.open(targetUrl, '_blank');
} 

/* ─── Cầu nối nhận bài từ Chrome Extension ────────── */
window.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'GL_EXTENSION_PAYLOAD') {
    const article = event.data.data;
    if (!article || !article.html) return;

    currentUrl = article.url || '';
    if (urlInput) urlInput.value = currentUrl;
    viewingTrans = false;

    // Render HTML Neobrutalism đã xử lý bypass ảnh hotlink
    currentHtml = cleanAndStyleHTML(article.html);
    setBlobFrame(currentHtml);

    if (emptyState) emptyState.style.display = 'none';
    if (loadOvl) loadOvl.classList.remove('on');
    if (frame) frame.classList.add('on');
    if (transPanel) transPanel.classList.remove('on');
    if (btnOriginal) btnOriginal.classList.add('hidden');
    if (btnTranslate) {
      btnTranslate.classList.remove('active');
      btnTranslate.disabled = !cfg.apiKey;
    }
    if (btnNewTab) btnNewTab.classList.remove('hidden');
    if (sepTab) sepTab.classList.remove('hidden');
  }
});

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

/* ─── Mở New Tab qua Archive Mirror ───────────────── */
window.openNewTab = function() {
  if (currentUrl) {
    window.open(`https://archive.is/newest/${currentUrl}`, '_blank');
  }
};

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
  if (currentHtml) {
    text = extractText(currentHtml);
  } else {
    try {
      const doc = frame.contentDocument || frame.contentWindow?.document;
      if (doc) text = extractFromDoc(doc);
    } catch (e) {}
  }

  if (!text || text.length < 100) {
    if (transContent) transContent.innerHTML = `<div class="alert alert-warn">❌ Không thể trích xuất nội dung văn bản. Hãy dùng Extension nạp bài trước khi dịch.</div>`;
    showTransPanel();
    return;
  }

  if (btnTranslate) btnTranslate.disabled = true;
  if (transContent) transContent.innerHTML = `
    <div style="text-align:center; padding: 60px 0;">
      <div class="neo-spinner" style="margin: 0 auto 20px;"></div>
      <div style="font-family:var(--font-cond); font-weight:900; font-size:18px;">GEMINI AI IS TRANSLATING…</div>
    </div>`;
  showTransPanel();

  const maxC = 25000;
  const input = text.slice(0, maxC) + (text.length > maxC ? '\n\n[...article truncated due to length]' : '');

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${cfg.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `You are a professional Vietnamese sports journalist. Translate the following The Athletic article into natural, engaging Vietnamese.\nRules:\n- Maintain professional football terminology, proper nouns, and stats accurately.\n- Convert [IMAGE: url] tags into HTML: <img src="url" alt="Illustration">.\n- Return clean HTML containing an h1 title, byline, and p tags. Do NOT add markdown code fences or conversational filler.\nArticle:\n${input}` }] }],
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
    if (transContent) transContent.innerHTML = `<div class="alert alert-warn">❌ TRANSLATION ERROR: ${esc(e.message)}</div>`;
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
  const junkSelectors = [
    'script','style','nav','header','footer','aside','button','svg','form','input',
    '.ad-container','.ad-unit','.paywall-container','.newsletter-wrapper',
    '[class*="audio"]','[class*="Audio"]','[class*="listen"]','[class*="Listen"]',
    '[class*="share"]','[class*="Share"]','[class*="social"]','[class*="Social"]',
    '[class*="bookmark"]','[class*="Bookmark"]','[data-testid*="audio"]','[data-testid*="share"]'
  ];
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
      if (t.length > 30 && !t.includes('Connections:') && !t.includes('Spot the pattern')) {
        paras.push(t);
      }
    }
  });
  return [title, byline, ...paras].filter(Boolean).join('\n\n');
}

function cleanAndStyleHTML(htmlString) {
  const doc = new DOMParser().parseFromString(htmlString, 'text/html');

  // 1. Dọn rác
  const junkSelectors = [
    'script', 'noscript', 'nav', 'footer', 'button', 'svg', 'form', 'input', 'aside',
    '.ad-container', '.ad-unit', '.ad-slot', '.paywall-container', '.newsletter-wrapper',
    '.share-tools', '[data-testid*="Social"]', '[data-testid*="audio"]', '[data-testid*="Audio"]',
    '[class*="audio"]', '[class*="Audio"]', '[class*="listen"]', '[class*="Listen"]',
    '[class*="podcast"]', '[class*="Podcast"]', '[class*="player"]', '[class*="Player"]',
    '[class*="share"]', '[class*="Share"]', '[class*="social"]', '[class*="Social"]',
    '[class*="bookmark"]', '[class*="Bookmark"]', '[class*="tooltip"]', '[class*="Tooltip"]',
    '[class*="action-bar"]', '[class*="ActionBar"]', '[class*="byline-tools"]', '[class*="BylineTools"]',
    '[data-testid*="share"]', '[data-testid*="bookmark"]',
    '[class*="game"]', '[class*="Game"]', '[class*="puzzle"]', '[class*="Connections"]'
  ];
  junkSelectors.forEach(s => {
    try { doc.querySelectorAll(s).forEach(e => e.remove()); } catch(e) {}
  });

  // 2. Dọn ảnh & Thêm referrerpolicy vượt rào CDN Hotlink
  doc.querySelectorAll('img').forEach(img => {
    let src = img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || img.src || '';
    const lower = (src || '').toLowerCase();

    if (!src ||
        lower.startsWith('data:image') ||
        lower.includes('avatar') ||
        lower.includes('icon') ||
        lower.includes('logo') ||
        lower.includes('pixel') ||
        lower.includes('spacer') ||
        lower.endsWith('.svg') ||
        lower.endsWith('.gif')) {
      img.remove();
      return;
    }

    img.src = src;
    img.setAttribute('referrerpolicy', 'no-referrer');
    img.removeAttribute('srcset');
    img.removeAttribute('sizes');
    img.removeAttribute('loading');
    img.removeAttribute('style');
    img.onerror = null;
  });

  // 3. Inject thẻ meta no-referrer và Viewport
  let metaRef = doc.querySelector('meta[name="referrer"]');
  if (!metaRef) {
    metaRef = doc.createElement('meta');
    metaRef.name = 'referrer';
    metaRef.content = 'no-referrer';
    doc.head.appendChild(metaRef);
  }

  let metaViewport = doc.querySelector('meta[name="viewport"]');
  if (!metaViewport) {
    metaViewport = doc.createElement('meta');
    metaViewport.name = 'viewport';
    doc.head.appendChild(metaViewport);
  }
  metaViewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';

  // 4. Inject Neobrutalism CSS
  const style = doc.createElement('style');
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700;900&family=Barlow+Condensed:wght@800;900&display=swap');
    :root {
      --neo-black: #000000;
      --neo-bg: #fffdf5;
      --neo-yellow: #ffe600;
      --neo-border: 3px solid #000000;
    }
    *, *::before, *::after { box-sizing: border-box !important; }
    html {
      width: 100% !important;
      max-width: 100vw !important;
      overflow-x: hidden !important;
      margin: 0 !important;
      background: var(--neo-bg) !important;
    }
    body {
      background: var(--neo-bg) !important;
      color: var(--neo-black) !important;
      padding: 30px 20px !important;
      margin: 0 auto !important;
      max-width: 820px !important;
      width: 100% !important;
      font-family: 'Space Grotesk', system-ui, sans-serif !important;
    }
    h1 {
      font-size: 2.3rem !important;
      line-height: 1.15 !important;
      font-weight: 900 !important;
      text-transform: uppercase !important;
      letter-spacing: -0.02em !important;
      margin: 0 0 1.2rem 0 !important;
      background: var(--neo-yellow) !important;
      border: var(--neo-border) !important;
      box-shadow: 6px 6px 0px var(--neo-black) !important;
      padding: 18px 20px !important;
      color: var(--neo-black) !important;
      display: block !important;
      width: 100% !important;
    }
    h2, h3, h4 {
      font-weight: 900 !important;
      text-transform: uppercase !important;
      margin-top: 2rem !important;
      margin-bottom: 0.8rem !important;
    }
    p, li {
      font-size: 1.15rem !important;
      line-height: 1.8 !important;
      margin-bottom: 1.4rem !important;
      color: #111 !important;
    }
    figure {
      display: block !important;
      width: 100% !important;
      margin: 22px 0 !important;
    }
    img {
      width: 100% !important;
      height: auto !important;
      display: block !important;
      border: var(--neo-border) !important;
      box-shadow: 6px 6px 0px var(--neo-black) !important;
    }
    figcaption {
      font-size: 0.82rem !important;
      font-weight: 600 !important;
      color: #444 !important;
      margin-top: 6px !important;
      text-align: center !important;
    }
    blockquote {
      background: #fff !important;
      border: var(--neo-border) !important;
      border-left: 8px solid var(--neo-black) !important;
      box-shadow: 4px 4px 0px var(--neo-black) !important;
      padding: 16px 20px !important;
      margin: 1.8rem 0 !important;
      font-style: italic !important;
      font-weight: 700 !important;
    }
  `;
  doc.head.appendChild(style);
  return doc.documentElement.outerHTML;
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ─── Event Binding ───────────────────────────────── */
if ($('btnSettings'))$('btnSettings').addEventListener('click', openSettings);
if ($('btnRead'))$('btnRead').addEventListener('click', () => loadArticle());
if ($('btnTranslate'))$('btnTranslate').addEventListener('click', translateArticle);
if ($('btnNewTab'))$('btnNewTab').addEventListener('click', openNewTab);
if ($('btnOriginal'))$('btnOriginal').addEventListener('click', showOriginal);

if (urlInput) {
  urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') loadArticle(); });
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if ($('settingsPanel') &&$('settingsPanel').classList.contains('on')) closeSettings();
    else if (viewingTrans) showOriginal();
  }
});

// Khởi chạy
init();