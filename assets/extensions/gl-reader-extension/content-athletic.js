(function () {
  // Chỉ chạy trên các trang bài viết (có mã ID bài báo)
  if (!window.location.pathname.match(/\/athletic\/\d+/)) return;

  // Tạo nút bấm Neobrutalism nổi ở góc phải dưới
  const btn = document.createElement('button');
  btn.id = 'gl-dispatch-btn';
  btn.innerHTML = `⚡ SEND TO GL READER`;
  btn.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 2147483647;
    background: #ffe600;
    color: #000000;
    border: 3px solid #000000;
    box-shadow: 5px 5px 0px #000000;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 13px;
    font-weight: 900;
    letter-spacing: 0.05em;
    padding: 12px 18px;
    cursor: pointer;
    transition: transform 0.1s, box-shadow 0.1s;
    outline: none;
  `;

  btn.onmouseenter = () => {
    btn.style.transform = 'translate(-2px, -2px)';
    btn.style.boxShadow = '7px 7px 0px #000000';
  };
  btn.onmouseleave = () => {
    btn.style.transform = 'none';
    btn.style.boxShadow = '5px 5px 0px #000000';
  };

  btn.onclick = () => {
    btn.innerHTML = `⏳ EXTRACTING...`;
    btn.style.background = '#4deeea';

    try {
      const data = extractArticle();
      chrome.runtime.sendMessage({ type: 'ARTICLE_CAPTURED', payload: data }, (res) => {
        btn.innerHTML = `✓ DISPATCHED!`;
        btn.style.background = '#00f076';
        setTimeout(() => {
          btn.innerHTML = `⚡ SEND TO GL READER`;
          btn.style.background = '#ffe600';
        }, 3000);
      });
    } catch (err) {
      alert('Không thể trích xuất bài: ' + err.message);
      btn.innerHTML = `❌ FAILED`;
      btn.style.background = '#ff608b';
    }
  };

  document.body.appendChild(btn);

  function extractArticle() {
    const title = document.querySelector('h1')?.innerText?.trim() || document.title;
    const bylineEl = document.querySelector('[data-testid="byline"], [class*="byline"], [class*="author"]');
    const byline = bylineEl ? bylineEl.innerText.trim() : '';

    const articleContainer = document.querySelector('article, [data-testid="article-body"], main') || document.body;
    const paragraphs = [];
    const processedImages = new Set();

    // 1. Quét cả thẻ p, h, blockquote VÀ trực tiếp thẻ img
    articleContainer.querySelectorAll('p, h2, h3, h4, blockquote, img').forEach(el => {
      // Xử lý thẻ ẢNH
      if (el.tagName.toLowerCase() === 'img') {
        // Lấy link ảnh thực tế đã được Chrome resolve (currentSrc) hoặc src/srcset
        const src = el.currentSrc || el.src || el.getAttribute('data-src');
        if (!src || src.startsWith('data:') || processedImages.has(src)) return;

        // Bỏ qua icon, logo, avatar nhỏ
        const w = el.naturalWidth || el.width || 0;
        const h = el.naturalHeight || el.height || 0;
        const lower = src.toLowerCase();
        if ((w > 0 && w < 120) || (h > 0 && h < 80) || lower.includes('avatar') || lower.includes('icon') || lower.includes('logo')) {
          return;
        }

        processedImages.add(src);

        // Lấy chú thích ảnh từ figcaption gần nhất hoặc thuộc tính alt
        const cap = el.closest('figure')?.querySelector('figcaption')?.innerText?.trim() || el.getAttribute('alt') || '';

        paragraphs.push(`
          <figure style="margin: 24px 0; display: block;">
            <img src="${src}" alt="The Athletic" referrerpolicy="no-referrer" loading="eager" style="width:100%; height:auto; display:block;" />
            ${cap ? `<figcaption style="margin-top:8px; font-size:13px; color:#555; text-align:center;">${cap}</figcaption>` : ''}
          </figure>
        `);
        return;
      }

      // Xử lý TEXT & ĐỀ MỤC
      const txt = el.innerText.trim();
      const lower = txt.toLowerCase();
      if (lower.includes('connections:') || lower.includes('spot the pattern') || lower.includes('share article') || lower.includes('read more')) return;

      if (el.tagName.toLowerCase().startsWith('h')) {
        paragraphs.push(`<h2>${txt}</h2>`);
      } else if (el.tagName.toLowerCase() === 'blockquote') {
        paragraphs.push(`<blockquote>${txt}</blockquote>`);
      } else if (txt.length > 25) {
        paragraphs.push(`<p>${txt}</p>`);
      }
    });

    const fullHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="referrer" content="no-referrer">
      </head>
      <body>
        <h1>${title}</h1>
        ${byline ? `<div class="article-byline" style="font-weight:800;margin-bottom:1.5rem;">BY: ${byline}</div>` : ''}
        <div class="article-body">
          ${paragraphs.join('\n')}
        </div>
      </body>
      </html>
    `;

    return {
      url: window.location.href,
      title: title,
      byline: byline,
      html: fullHtml
    };
  }
})();