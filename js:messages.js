// 1. 模擬數據 (保留你原本的數據內容)
const chatList = [
    { id: 1, user: 'Mina_米娜', avatar: 'https://i.pravatar.cc/100?u=a2', lastMsg: '收到了嗎？那張照片...', time: '14:20', unread: 2 },
    { id: 2, user: '官方小助手', avatar: 'https://i.pravatar.cc/100?u=admin', lastMsg: '歡迎加入 Sexify，開啟你的專屬美好。', time: '昨天', unread: 0 },
    { id: 3, user: 'Xaiver', avatar: 'https://i.pravatar.cc/100?u=a1', lastMsg: '下次一起出來喝一杯？', time: '週三', unread: 0 }
];

// 預留通知數據 (未來擴充用)
const notificationList = [
    { type: 'like', user: '酷炫男孩', target: '你的深夜驚喜', time: '5分鐘前' },
    { type: 'follow', user: '小雨點', target: '關注了你', time: '1小時前' }
];

// 2. 渲染邏輯 (對應 index.html 裡的 messages-content)
function renderMessages() {
    // 確保 ID 是 index.html 裡面定義的那個
    const container = document.getElementById('messages-content');
    if (!container) return;

    // 將數據轉化為 HTML 結構
    container.innerHTML = chatList.map(chat => `
        <div class="flex items-center gap-4 p-4 active:bg-gray-50 transition border-b border-gray-50" onclick="openChat(${chat.id})">
            <div class="relative flex-shrink-0">
                <img src="${chat.avatar}" class="w-12 h-12 rounded-full border border-gray-100 object-cover">
                ${chat.unread > 0 ? `
                    <span class="absolute -top-1 -right-1 bg-sexify text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full border-2 border-white font-bold">
                        ${chat.unread}
                    </span>` : ''}
            </div>
            <div class="flex-1 min-w-0">
                <div class="flex justify-between items-center mb-0.5">
                    <h4 class="font-bold text-sm truncate text-gray-800">${chat.user}</h4>
                    <span class="text-[10px] text-gray-400 font-medium">${chat.time}</span>
                </div>
                <p class="text-xs text-gray-400 truncate leading-relaxed">${chat.lastMsg}</p>
            </div>
        </div>
    `).join('');
}

// 3. 模擬開啟聊天窗口
function openChat(chatId) {
    const chat = chatList.find(c => c.id === chatId);
    if (chat) {
        alert(`正在與 ${chat.user} 建立加密連線...`);
    }
}