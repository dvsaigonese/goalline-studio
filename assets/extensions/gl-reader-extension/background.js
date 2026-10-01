chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'ARTICLE_CAPTURED') {
    const articleData = request.payload;

    // 1. Lưu bài viết kèm timestamp để kích hoạt storage.onChanged
    chrome.storage.local.set({ 
      activeArticle: articleData,
      lastUpdated: Date.now() 
    }, () => {
      // 2. Tìm xem tab Goal-Line Reader có đang mở không
      chrome.tabs.query({}, (tabs) => {
        const readerTab = tabs.find(t => 
          t.url && (t.url.includes('reader.html') || t.url.includes('/reader.html'))
        );

        if (readerTab) {
          // Focus sang tab Reader đang mở sẵn
          chrome.tabs.update(readerTab.id, { active: true });
          
          // Gửi tin nhắn dự phòng và dập lỗi ngầm nếu tab chưa kịp nạp script
          chrome.tabs.sendMessage(readerTab.id, { 
            type: 'LOAD_ARTICLE', 
            payload: articleData 
          }).catch(() => {
            // Không làm gì, tab sẽ tự nhận qua storage.onChanged
          });
        } else {
          // Nếu chưa mở: Tạo tab Reader mới
          const targetUrl = (sender.url && (sender.url.includes('127.0.0.1') || sender.url.includes('localhost')))
            ? 'http://127.0.0.1:5500/reader.html?from_ext=1'
            : 'https://dvsaigonese.github.io/goalline-studio/reader.html?from_ext=1';

          chrome.tabs.create({ url: targetUrl });
        }

        sendResponse({ success: true });
      });
    });
    return true;
  }
});