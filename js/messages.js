// ==========================
// 🔥 1. 原有資料（升級版）
// ==========================
const chatList = [
    { id: 1, user: 'Mina_米娜', avatar: 'https://i.pravatar.cc/100?u=a2', lastMsg: '收到了嗎？那張照片...', time: '14:20', unread: 2 },
    { id: 2, user: '官方小助手', avatar: 'https://i.pravatar.cc/100?u=admin', lastMsg: '歡迎加入 Sexify，開啟你的專屬美好。', time: '昨天', unread: 0 },
    { id: 3, user: 'Xaiver', avatar: 'https://i.pravatar.cc/100?u=a1', lastMsg: '下次一起出來喝一杯？', time: '週三', unread: 0 }
];

// 👉 每個 chat 對應 messages
const messagesDB = {
    1: [
        { id: 1, sender: 'them', text: 'Hi～', time: '14:00', read: true },
        { id: 2, sender: 'me', text: 'Hey 👋', time: '14:01', read: true },
        { id: 3, sender: 'them', text: '收到了嗎？那張照片...', time: '14:20', read: false }
    ]
};

// typing 狀態
let typingState = {};

// ==========================
// 🔥 2. Render Chat List（保持原樣）
// ==========================
function renderMessages() {
    const container = document.getElementById('messages-content');
    if (!container) return;

    container.innerHTML = chatList.map(chat => `
        <div class="flex items-center gap-4 p-4 active:bg-gray-50 transition border-b border-gray-50"
             onclick="openChat(${chat.id})">

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
                <p class="text-xs text-gray-400 truncate leading-relaxed">
                    ${chat.lastMsg}
                    ${typingState[chat.id] ? ' · typing...' : ''}
                </p>
            </div>
        </div>
    `).join('');
}

// ==========================
// 🔥 3. 打開 Chat（升級版）
// ==========================
function openChat(chatId) {
    const chat = chatList.find(c => c.id === chatId);
    if (!chat) return;

    // 清除未讀
    chat.unread = 0;

    // 模擬已讀
    if (messagesDB[chatId]) {
        messagesDB[chatId].forEach(msg => {
            if (msg.sender === 'them') msg.read = true;
        });
    }

    renderMessages();

    // 👉 模擬 typing
    simulateTyping(chatId);

    alert(`已進入與 ${chat.user} 的聊天室（已讀✔✔ + typing 模擬）`);
}

// ==========================
// 🔥 4. Typing Indicator（模擬）
// ==========================
function simulateTyping(chatId) {
    typingState[chatId] = true;
    renderMessages();

    setTimeout(() => {
        typingState[chatId] = false;

        // 模擬對方回覆
        addMessage(chatId, {
            sender: 'them',
            text: '剛剛在忙 😆',
            time: getNowTime(),
            read: false
        });

        renderMessages();
    }, 2000);
}

// ==========================
// 🔥 5. 新增訊息（支援 read / emoji）
// ==========================
function addMessage(chatId, msg) {
    if (!messagesDB[chatId]) messagesDB[chatId] = [];

    msg.id = Date.now();
    msg.reactions = [];

    messagesDB[chatId].push(msg);

    // 更新 chat list
    const chat = chatList.find(c => c.id === chatId);
    if (chat) {
        chat.lastMsg = msg.text;
        chat.time = '現在';
        if (msg.sender === 'them') chat.unread++;
    }
}

// ==========================
// 🔥 6. Emoji Reaction（核心）
// ==========================
function addReaction(chatId, messageId, emoji) {
    const msgs = messagesDB[chatId];
    const msg = msgs.find(m => m.id === messageId);
    if (!msg) return;

    msg.reactions.push({
        user: 'me',
        emoji
    });

    console.log('Reaction added:', emoji);
}

// ==========================
// 🔥 7. 圖片 / Voice（預留）
// ==========================
function sendImage(chatId, imageUrl) {
    addMessage(chatId, {
        sender: 'me',
        text: '[圖片]',
        image: imageUrl,
        time: getNowTime(),
        read: true
    });
}

function sendVoice(chatId, audioUrl) {
    addMessage(chatId, {
        sender: 'me',
        text: '[語音]',
        audio: audioUrl,
        time: getNowTime(),
        read: true
    });
}

// ==========================
// 🔥 8. Ice Breaker（開場）
// ==========================
function getIceBreakers() {
    return [
        "你最近聽咩音樂？",
        "你平時放假做咩？",
        "最鍾意邊套電影？"
    ];
}

// ==========================
// 🔥 工具
// ==========================
function getNowTime() {
    const d = new Date();
    return `${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
}
