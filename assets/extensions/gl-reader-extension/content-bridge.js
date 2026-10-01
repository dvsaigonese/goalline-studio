(function () {
  // 1. Nhận bài ngay khi tab reader.html vừa mở hoặc reload
  chrome.storage.local.get(['activeArticle'], (res) => {
    if (res.activeArticle) {
      window.postMessage({ type: 'GL_EXTENSION_PAYLOAD', data: res.activeArticle }, '*');
    }
  });

  // 2. Tự động nhận bài tức thì khi background.js ghi dữ liệu mới vào storage
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.activeArticle && changes.activeArticle.newValue) {
      window.postMessage({ type: 'GL_EXTENSION_PAYLOAD', data: changes.activeArticle.newValue }, '*');
    }
  });

  // 3. Listener dự phòng qua direct message
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'LOAD_ARTICLE' && msg.payload) {
      window.postMessage({ type: 'GL_EXTENSION_PAYLOAD', data: msg.payload }, '*');
      sendResponse({ received: true });
    }
    return true;
  });
})();