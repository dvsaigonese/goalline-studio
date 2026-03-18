// --- 1. SETUP AND STORE API KEY ---
const keyInput = document.getElementById('gemini-key');
const keySection = document.getElementById('api-key-section');
const aiResponseBox = document.getElementById('ai-response');

// Check if key is already stored
let currentApiKey = localStorage.getItem('gemini_api_key');
if (currentApiKey) {
    keyInput.value = currentApiKey;
    keySection.style.display = 'none'; // Hide if key exists
}

function saveApiKey() {
    const key = keyInput.value.trim();
    if (key) {
        localStorage.setItem('gemini_api_key', key);
        currentApiKey = key;
        keySection.style.display = 'none';
        alert('API Key saved! You can now ask the AI to write articles.');
    }
}

// --- 2. FETCH NEWS DATA (RSS FEEDS) ---
const RSS_FEEDS = [
    { name: 'VNExpress Sports', url: 'https://vnexpress.net/rss/the-thao.rss' },
    { name: 'SkySports Football', url: 'https://www.skysports.com/rss/12040' },
    { name: 'BBC Sport', url: 'https://feeds.bbci.co.uk/sport/football/rss.xml' },
    { name: 'The Guardian', url: 'https://www.theguardian.com/football/rss' },
    { name: 'TalkSport', url: 'https://talksport.com/football/feed/' }
];

async function fetchNews() {
    const newsContainer = document.getElementById('news-container');
    const loadingObj = document.getElementById('news-loading');
    
    let allNews = [];

    try {
        for (const feed of RSS_FEEDS) {
            // TIP: Add timestamp to bypass cache and get the latest news
            const cacheBuster = feed.url.includes('?') ? '&t=' : '?t=';
            const freshUrl = feed.url + cacheBuster + new Date().getTime();

            // Convert RSS to JSON
            const response = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(freshUrl)}`);
            const data = await response.json();
            
            if (data.status === 'ok') {
                // Get top 5 latest news from each source
                const articles = data.items.slice(0, 5).map(item => {
                    const dateObj = new Date(item.pubDate.replace(' ', 'T') + 'Z');
                    
                    return {
                        source: feed.name,
                        title: item.title,
                        link: item.link,
                        description: item.description.replace(/<[^>]*>?/gm, ''), // Remove HTML tags
                        timestamp: dateObj.getTime(), 
                        pubDate: dateObj.toLocaleString('en-GB', { 
                            hour: '2-digit', minute: '2-digit', 
                            day: '2-digit', month: '2-digit', year: 'numeric' 
                        })
                    };
                });
                allNews = allNews.concat(articles);
            }
        }

        // Sort by newest first
        allNews.sort((a, b) => b.timestamp - a.timestamp);
        
        // Render to UI
        loadingObj.style.display = 'none';
        allNews.forEach(news => {
            const newsHtml = `
                <div class="news-item">
                    <div class="news-meta">🚀 Source: ${news.source} | 🕒 ${news.pubDate}</div>
                    <div class="news-title"><a href="${news.link}" target="_blank" style="color: white; text-decoration: none;">${news.title}</a></div>
                    <div class="news-desc">${news.description}</div>
                    <button class="btn-ai" onclick="askAiForContent('${news.title.replace(/'/g, "\\'")}')">
                        ✨ Ask AI to Write
                    </button>
                </div>
            `;
            newsContainer.innerHTML += newsHtml;
        });

    } catch (error) {
        loadingObj.innerText = 'Error fetching data: ' + error.message;
    }
}

// --- 3. ACTIVATE GOOGLE GEMINI AI ---
async function askAiForContent(newsTitle) {
    if (!currentApiKey) {
        alert("Boss, you need to enter the Gemini API Key first!");
        keySection.style.display = 'block';
        return;
    }

    aiResponseBox.innerHTML = `<span style="color: var(--accent);">⏳ Brainstorming angles for: <b>"${newsTitle}"</b>...</span>`;

    // ĐỌC XEM ĐANG CHỌN PHONG CÁCH NÀO TRÊN GIAO DIỆN
    const selectedTone = document.getElementById('ai-tone').value;
    
    // TẠO LUẬT RIÊNG CHO TỪNG PHONG CÁCH
    let toneRule = "";
    if (selectedTone === 'devil') {
        toneRule = `2. DEVIL'S ADVOCATE (CRITICAL THINKING): Do not follow the narrative of the Western journalist. If they praise, find the hidden flaw. If they criticize, find the bright spot to defend. Force a counter-narrative to spark heavy debate.`;
    } else {
        toneRule = `2. MULTI-DIMENSIONAL ANALYSIS (NUANCE): Avoid forced contrarianism, but never just echo the original article. Look at the bigger picture. If a team/player is praised, acknowledge the success but point out hidden risks or long-term challenges. If they are criticized, analyze the root systemic causes instead of just joining the hate train. Stay objective and balanced.`;
    }

    aiResponseBox.innerHTML = `<span style="color: var(--accent);">⏳ Brainstorming angles for: <b>"${newsTitle}"</b>...</span>`;

    // Mega-Prompt in English, Output in Vietnamese
    const promptText = `
        You are the Admin of the tactical analysis and in-depth commentary section of the football fanpage "Goal-Line".
        The page's specialty is Long-form posts (600 - 800 words), delving into the core of the issue rather than just surface-level news.

        YOUR MANDATORY "DNA" AND WRITING STYLE:
        1. Tone: Cold, sharp, objective, counter-narrative. Not superficial, no teen slang.
        2. Structure:
           - Intro (Hook): Always start with an open question or a counter-intuitive statement.
           - Body: Detailed breakdown. Must include reasonable hypothetical stats, tactical analysis, form, or upper-management issues. Use terms like xA, pressing, workload, rotation, system.
           - Outro: Make a final statement and END WITH AN OPEN QUESTION to stimulate follower debate.
        3. Formatting: Divide into many short paragraphs (3-4 sentences/paragraph). Absolutely NO bullet points when listing, write in prose. Capitalize only the first letter of player names. Use line breaks (enter) between paragraphs.

        PAGE'S SURVIVAL RULES (ANTI-PLAGIARISM & TRANSLATION):
        1. NO DIRECT TRANSLATION: Do not translate word-by-word, paraphrase, or summarize the original news article.
        ${toneRule}
        3. METHODOLOGY: Only extract the CORE FACT (match result, injury, ban, quote) from the news. Ignore all journalist commentary. Rebuild a brand new analysis from that core fact with your own perspective.

        SAMPLE POSTS TO LEARN FROM (MIMIC THIS EXACT VIETNAMESE WRITING STYLE):

        --- SAMPLE 1 ---
        Cơ hội nào cho Bruno Fernandes?

        Nói về cơ hội cho tiền vệ người Bồ ở thời điểm hiện tại, 100% chúng ta sẽ nghĩ ngay đến việc đào sâu kỷ lục kiến tạo của một cầu thủ Manchester United trong lịch sử Premier League, và cố gắng phá kỷ lục kiến tạo của giải đấu. Điều này rõ ràng là khả thi, khi anh vẫn nổi tiếng là một nhân tố sáng tạo quan trọng trên hàng công Quỷ Đỏ hiện tại, cùng với đà thăng hoa của hàng công Man Utd, cơ hội cho số 8 không phải là không thể.

        Nhưng liệu, Bruno Fernandes có thể trở thành cầu thủ xuất sắc nhất giải mùa này?

        Nhìn rộng hơn, kể từ khi anh đến nước Anh vào mùa 19/20, những người nhận danh hiệu cầu thủ xuất sắc nhất mùa Premier League lần lượt gồm Kevin De Bruyne (2 lần), Ruben Dias, Phil Foden, Erling Haaland và Mohamed Salah. Chúng ta sẽ lấy danh hiệu mùa 23/24 làm ví dụ, khi ấy Phil Foden vinh dự nhận sau một mùa giải phong độ cao tại EPL với 19 bàn 8 kiến tạo sau 35 lần ra sân. Hay như mùa 20/21 là đầu tàu hàng thủ Ruben Dias với 19 lần giữ sạch lưới cho Man City. Với Kevin, Erling hay Salah, đơn giản là họ có một phong độ hủy diệt.

        Như vậy, cờ có thể tới tay Bruno ở mùa 25/26 này không? Cùng phân tích khả năng đó.

        Có bốn tiêu chí lớn thường được hội đồng đặt lên hàng đầu, gồm hiệu suất và thông số cá nhân vượt trội, tầm ảnh hưởng lên thành tích chung của tập thể, sự ổn định xuyên suốt 38 vòng đấu, khả năng tỏa sáng trong các trận cầu lớn. Nếu xét trên các tiêu chí vừa rồi, rất khó tìm ra một cái tên phù hợp hơn Bruno. Erling Haaland dù thăng hoa đầu mùa nhưng giai đoạn lượt về chật vật khiến cho việc được đánh giá cao cũng là dấu hỏi, hay nếu nhìn qua Arsenal - một tập thể quá đồng đều tài năng khó có ai vượt trội lên hẳn ở các thống kê tấn công. Thì ở câu lạc bộ đứng thứ 3 trên BXH - Bruno Fernandes vô tình sở hữu cả 4 tiêu chí trên.

        7 bàn 16 kiến tạo đến thời điểm hiện tại, là cầu thủ có thông số sáng tạo cao vượt trội so với phần còn lại giải đấu từ số cơ hội tạo ra, xA cho đến số kiến tạo. Phong độ ổn định xuyên suốt và cứu nguy Man Utd khi cần dẫu có có giai đoạn anh phải chơi trái sở trường (vẫn có thông số sáng tạo cao). Cũng không ngoa lắm khi nếu tranh luận về danh hiệu cầu thủ xuất sắc nhất mùa, tiền vệ 31 tuổi là một ứng cử viên đầy sức nặng.

        Cái khó cho anh có lẽ là việc Man Utd khó có thể là nhà vô địch năm nay khi nhìn vào khoảng cách trên BXH. Ta đều biết ở nhũng mùa trước, cầu thủ thuộc đội bóng vô địch sẽ được ưu tiên hơn trong danh sách bầu chọn, nên nếu xét về tiêu chuẩn này, một cầu thủ Arsenal hay Man City sẽ xứng đáng được đặt lên bàn cân hơn Bruno - vốn chỉ là đầu tàu của một đội bóng tranh giành vị trí cho tấm vé dự cúp châu Âu.

        Dù cho rõ ràng không thể phủ nhận tầm ảnh hưởng của anh lên đội bóng, và lên vị trí hiện tại của đội bóng trên BXH, nhưng việc nằm ngoài cuộc đua vô địch rõ ràng là bất lợi lớn. Một cơ hội khả thi cho Bruno Fernandes nhằm chắc chắn hơn cho danh hiệu MVP này - có lẽ là phá luôn kỷ lục kiến tạo trong lịch sử Premier League (20 lần) trong 8 trận đấu còn lại, một thử thách không hề đơn giản, dù số kiến tạo của Bruno đã lên tới 16.

        Thế là nếu xét lại về tiêu chí "đội bóng vô địch" - ta phải nhắc đến nhân tố của Arsenal - đội bóng đang có lợi thế lớn trong cuộc đua vô địch. Đại diện cho đội bóng London không ai khác sẽ là David Raya, thủ môn người Tây Ban Nha đã giữ sạch lưới 15 trận đấu sau 31 trận, cùng với đó là vô số pha cứu thua đưa Pháo Thủ trở về từ cõi chết. Bên cạnh Erling Haaland và Bruno Fernandes, đây hẳn sẽ là ba cái tên được đặt lên bàn cân của hội đồng, đánh giá một cách công tâm và đầy khó khăn, cho danh hiệu cầu thủ xuất sắc nhất mùa.

        Vậy theo bạn, ai mới xứng đáng cho danh hiệu này, ai mới là "gương mặt đại diện cho sự xuất sắc" của Premier League mùa giải năm nay?

        --- SAMPLE 2 ---
        Đại Bàng đang bay rất cao, nhưng…

        Các cổ động viên Crystal Palace có lẽ đang sống trong những năm tháng vui vẻ nhất trong cuộc đời của họ, và có thể là cả lịch sử đội bóng họ yêu: The Eagles đang đứng ở vị trí thứ 4 trên BXH Premier League, họ giành được 2 chiếc cúp trong năm vừa qua, và họ đang có “chuyến đi lưu diễn” ở châu Âu lần đầu tiên kể từ khi CLB được thành lập.

        Về mặt kết quả, thật khó để có bất cứ điều gì tiêu cực để nói về Palace ở thời điểm hiện tại. Tuy nhiên, dạo gần đây, đội bóng phía Nam London đang cho chúng ta thấy một vài dấu hiệu khá đáng lo rằng những thành tích này có thể sụp đổ chỉ trong chợp mắt.

        Cụ thể hơn, hãy nói về Jean-Philippe Mateta. Tiền đạo người Pháp đã trở thành một nhân vật vô cùng quan trọng trong hệ thống của Oliver Glasner; việc anh ra sân thi đấu nhiều không phải là một điều quá ngạc nhiên. Chúng ta đang nói tới một thành viên trong đội hình ĐTQG Pháp đây mà. Trong 4 trên 5 trận đấu gần nhất của Crystal Palace, Mateta đều bị thay ra ở khoảng phút thứ 60, và mỗi lần số 9 của Bầy Đại Bàng rời sân, chúng ta nhìn thấy anh trong một bộ dạng vô cùng mệt mỏi, gần như rã rời.

        Với một vận động viên với một thể trạng đẳng cấp thế giới như JP, việc kiệt quệ chỉ sau 60 phút trên sân gần như là không thể xảy ra, trừ khi khối lượng công việc của anh là quá tải. Đó chính là vấn đề ở đây.

        Mateta, trước trận gặp Shelbourne ở Conference League, đã thi đấu tổng cộng 1930 phút trên mọi đấu trường. Anh đã thi đấu gần 60% số phút của mùa giải trước, và chúng ta trước đi qua một nửa tháng 12. Tiền đạo người Pháp không phải cầu thủ duy nhất với vấn đề này. Crystal Palace có 6 người đang tiệm cận gần 2000 phút thi đấu chỉ sau chưa đầy 4 tháng của mùa giải, nổi bật trong số đó là trung vệ Maxence Lacroix, người đã có 2160 phút trên sân và là cầu thủ duy nhất góp mặt trong cả 24 trận đấu của The Eagles.

        Tất nhiên, những cầu thủ thi đấu nhiều nhất thường là những trụ cột của một CLB, và nó là lý do khiến cho vinh quang đang có của Palace trở nên ngày một mỏng manh. Với việc thi đấu trong một hệ thống đòi hỏi nhiều về mặt thể lực như của Glasner, kết hợp với việc phải thi đấu 3 lần một tuần không ngừng nghỉ, các trụ cột của Palace sẽ rất dễ rơi vào trạng thái quá tải (như Mateta) hoặc gặp phải những chấn thương (như Ismaïla Sarr, người đã gặp phải 2 chấn thương khiến anh phải nghỉ thi đấu một vài tuần). Nếu như những cầu thủ như Guéhi, Wharton hay Muñoz gặp phải những chấn thương dài hạn, thì chất lượng đội hình Palace sẽ giảm đi đáng kể.

        Nhiều người hẳn sẽ đặt ra câu hỏi rằng tại sao chiến lược gia người Áo không xoay tua đội hình để tránh các cầu thủ làm việc quá sức. Câu trả lời đơn giản là: Glasner không thể làm vậy nếu ông muốn duy trì chất lượng trên sân của đội bóng. “Chúng tôi đang cố gắng hết sức để bảo vệ tất cả mọi người (khỏi kiệt sức và chấn thương)” - đây là một câu nói thường xuyên của vị thuyền trưởng của Crystal Palace. Đó là lý do mà Mateta hay Wharton thường bị thay ra vào phút thứ 60 mỗi trận.

        Tuy nhiên, những cái tên như Nketiah hay Will Hughes cũng chỉ có ảnh hưởng ở một mức độ nhất định; phải có lý do họ là những cái tên chỉ xuất phát trên băng ghế dự bị. Đơn giản là họ chưa đạt đến một cấp độ tương xứng với những gì Ollie Glasner và các học trò đang muốn hướng tới.

        Điều này đưa chúng ta đến một nơi quen thuộc: ban lãnh đạo. Sau trận thua Manchester United, HLV người Áo đã trả lời phỏng vấn với một câu nói đã khiến truyền thông phải xôn xao bàn tán:

        “Khi một đội bóng có lần đầu tiên tham dự cúp châu Âu trong lịch sự, họ nên đầu tư và không tiết kiệm. Và chúng tôi đã tiết kiệm tiền… Chúng tôi đã có một số cơ hội gia cố đội hình vào TTCN mùa hè nhưng đã bỏ lỡ nó… Việc mua sắm vào tháng Một sẽ là quá muộn vì lúc đó, đội bóng đã chơi 60% trận của mùa giải”

        Cuộc phỏng vấn đến sau thất bại trước Quỷ Đỏ, khi mà Bầy Đại Bàng tỏ rõ sự mệt mỏi trong hiệp thi đấu thứ 2. Chắc hẳn câu nói trên có pha lẫn một chút sự khó chịu và bực bội sau một trận thua, nhưng thật khó để phủ nhận những điều mà Glasner đã nhắc đến. Họ chiêu mộ Yéremy Pino để lấp đầy khoảng trống mà Eberechi Eze để lại; họ đem về Jaydee Canvot được đem về Selhurst Park trước những tin đồn về tương lai của Marc Guéhi tràn ngập các mặt báo. Ba tân binh còn lại có tổng cộng 63 phút thi đấu ở Premier League.

        Đội hình của Palace đang vô cùng mỏng manh. Chỉ một hay hai chấn thương là đủ để màn trình diễn của đội bóng này sụt giảm một cách đáng kể, và nó đã có dấu hiệu đi xuống khi đội hình này vẫn tương đối lành lặn. Bắt đầu với chuyến hành quân đến Dublin vào rạng sáng ngày 12/12 để đối đầu với Shelbourne ở Conference League, Crystal Palace sẽ có tổng cộng 5 trận đấu trong 12 ngày tới. Đây sẽ là một giai đoạn khó khăn thật sự với đội bóng phía Nam London, và sẽ thật may mắn nếu như họ có thể bước ra khỏi đêm Giáng Sinh với một đội hình hoàn toàn khoẻ mạnh.

        Đại Bàng đang bay rất cao, nhưng sự thăng hoa đó có thể bị dập tắt chỉ trong nháy mắt mà thôi…

        --- SAMPLE 3 ---
        Một đội bóng Anh lại thua một đội bóng "kiểu Anh” hơn.

        Nếu theo dõi trận đấu giữa Galatasaray và Liverpool sáng nay, bạn sẽ có cảm tưởng không khác gì một trận đấu vào cuối tuần tại Premier League.

        Liverpool nổi tiếng với kiểu chơi tốc độ đã đành, Galatasaray dù là một đội của Thổ Nhĩ Kỳ lại cũng đá theo kiểu y chang. Cả hai đều chơi thứ bóng đá nặng về thể chất, có chăng là Liverpool nhỉnh hơn về mặt kỹ thuật thôi. Nhưng trong một ngày đã không hay còn không may của mình, Liverpool lại đã phải nhận thất bại từ kiểu chơi rất “Anh” mà bình thường họ vẫn gặp.

        Họ để cho Galatasaray ghi bàn từ một pha phạt góc. Quả phạt xoáy hơi xa so với khung thành, nhưng Osimhen vẫn tìm được bóng để đánh đầu vào cho Lemina ghi bàn bên trong. Những phút tiếp theo cũng là cả tá những pha nhồi bóng vào vòng cấm từ sớm, chơi bóng dài của Galatasaray, nếu may mắn hơn thì có khi Liverpool đã thua thêm ở đây rồi.

        Và nhìn lại thì những cơ hội cuối trận của Liverpool cũng đến từ bóng bổng và phạt góc chứ đâu? Đáng tiếc là họ lại không tận dụng được bởi một ngày thảm họa của Konate.

        Mà thực ra không chỉ lối chơi, nhìn vào dàn nhân sự của Galatasaray thì có khác gì một đội bóng Anh đâu? Họ toàn những cựu binh Ngoại hạng cùng với một số tay có tố chất để chơi ở đây.

        Cặp tiền vệ trung tâm Torreira, Lemina đều từng có những năm tháng tại EPL. Thậm chí Lemina còn ghi bàn theo một kiểu rất “Anh” từ pha tạt cánh đánh đầu. Rồi Davinson Sanchez, người từng thi đấu cho Tottenham trong giai đoạn đỉnh cao nhất đến khi Gà trống bắt đầu suy yếu. Thêm 2 cựu cầu thủ MC là Gundogan và Sane nữa, đều quá hiểu bóng đá Anh. Và dù cho những người này đá chính, vào sân từ ghế dự bị hay thậm chí không thi đấu, điều này vẫn phần nào chứng minh được Galatasaray hiểu cách chơi của các đội tại EPL đến thế nào.

        Và thành quả cho đội chủ nhà là trận thắng trước đương kim vô địch EPL, mở toang cơ hội vào vòng trong.

        Suy cho cùng thì đây cũng là một bài học khá quen thuộc của bóng đá châu Âu. Khi hai đội chơi cùng một thứ bóng đá, khác biệt đôi khi chỉ nằm ở sự tỉnh táo trong khoảnh khắc quyết định. Galatasaray tận dụng được của họ, còn Liverpool thì không.

        Đêm nay, Galatasaray đã chơi như một đội bóng Anh thực thụ. Và họ thắng chính bằng thứ bóng đá đó.

        YOUR TASK:
        I just read this breaking news: "${newsTitle}"
        
        Step 1: Briefly list 3 counter-narrative, deep, and edgy angles from this news.
        Step 2: Choose 1 most controversial angle with the highest viral potential.
        Step 3: Based on that angle, WRITE 1 COMPLETE FACEBOOK POST IN VIETNAMESE.
        Post requirements:
        - Length: 600 - 800 words (Long-form).
        - Strictly adhere 100% to the Goal-Line style and ensure it doesn't sound like a translation.

        Using Vietnamese to answer 3 steps that I mentioned before.
    `;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${currentApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: promptText }] }]
            })
        });

        const data = await response.json();
        
        if (data.error) {
            aiResponseBox.innerHTML = `<span style="color: var(--danger);">API Error: ${data.error.message}</span>`;
            return;
        }

        const aiText = data.candidates[0].content.parts[0].text;
        aiResponseBox.innerHTML = marked.parse(aiText);

    } catch (error) {
        aiResponseBox.innerHTML = `<span style="color: var(--danger);">Connection Error: ${error.message}</span>`;
    }
}

// Initialize
fetchNews();