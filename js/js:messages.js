// ==========================
// 🔥 資料
// ==========================
const chatList = [
    { id: 1, user: 'Mina_米娜', avatar: 'https://i.pravatar.cc/100?u=a2', lastMsg: '收到了嗎？那張照片...', time: '14:20', unread: 2 },
    { id: 2, user: '官方小助手', avatar: 'https://i.pravatar.cc/100?u=admin', lastMsg: '歡迎加入 Sexify，開啟你的專屬美好。', time: '昨天', unread: 0 },
    { id: 3, user: 'Xaiver', avatar: 'https://i.pravatar.cc/100?u=a1', lastMsg: '下次一起出來喝一杯？', time: '週三', unread: 0 }
];

const messagesDB = {
    1: [
        { id: 1, sender: 'them', text: 'Hi～', time: '14:00', read: true, reactions: [] },
        { id: 2, sender: 'me', text: 'Hey 👋', time: '14:01', read: true, reactions: [] },
        { id: 3, sender: 'them', text: '收到了嗎？那張照片...', time: '14:20', read: false, reactions: [] }
    ]
};

let currentChatId = null;
let typingState = {};
let chatRoomInitialized = false;

// ==========================
// 🔥 Render Chat List（安全版）
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
// 🔥 Chat Room（穩定版）
// ==========================
function initChatRoom() {
    if (chatRoomInitialized) return;

    const div = document.createElement('div');
    div.id = 'chat-room';
    div.style.position = 'fixed';
    div.style.top = '0';
    div.style.left = '0';
    div.style.right = '0';
    div.style.bottom = '0';
    div.style.zIndex = '9999';
    div.style.display = 'none';
    div.style.background = 'white';
    div.className = 'flex flex-col';

    div.innerHTML = `
        <div class="flex items-center gap-3 p-4 border-b border-gray-100">
            <button onclick="closeChat()" type="button" class="text-gray-500 text-lg">←</button>
            <img id="chat-avatar" class="w-10 h-10 rounded-full object-cover">
            <div class="flex-1">
                <h3 id="chat-name" class="font-bold text-sm text-gray-800"></h3>
                <p class="text-xs text-gray-400">Online</p>
            </div>
        </div>

        <div id="chat-messages" class="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50"></div>

        <div id="ice-breaker" class="px-4 pb-2 hidden"></div>

        <div class="p-3 border-t border-gray-100 flex items-center gap-2">
            <input id="chat-input" type="text"
                placeholder="輸入訊息..."
                class="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm outline-none">

            <button onclick="sendText(event)" type="button"
                class="text-sexify font-bold text-sm">送出</button>
        </div>
    `;

    document.body.appendChild(div);
    chatRoomInitialized = true;

    // 🔥 Enter 發送（穩定版）
    document.addEventListener('keydown', function(e) {
        const input = document.getElementById('chat-input');
        if (!input) return;

        if (currentChatId && e.key === 'Enter' && document.activeElement === input) {
            e.preventDefault();
            sendText();
        }
    });
}

// ==========================
// 🔥 打開 Chat
// ==========================
function openChat(chatId) {
    initChatRoom();

    const chat = chatList.find(c => c.id === chatId);
    if (!chat) return;

    currentChatId = chatId;

    const room = document.getElementById('chat-room');
    room.style.display = 'flex';

    document.getElementById('chat-name').innerText = chat.user;
    document.getElementById('chat-avatar').src = chat.avatar;

    chat.unread = 0;

    if (messagesDB[chatId]) {
        messagesDB[chatId].forEach(m => {
            if (m.sender === 'them') m.read = true;
        });
    }

    renderMessages();
    renderChatMessages();

    if (!messagesDB[chatId] || messagesDB[chatId].length === 0) {
        renderIceBreaker();
    }

    simulateTyping(chatId);
}

// ==========================
function closeChat() {
    document.getElementById('chat-room').style.display = 'none';
}

// ==========================
// 🔥 Render Chat Messages
// ==========================
function renderChatMessages() {
    const container = document.getElementById('chat-messages');
    const msgs = messagesDB[currentChatId] || [];

    container.innerHTML = msgs.map(msg => `
        <div class="flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}">
            <div class="max-w-[70%] px-3 py-2 rounded-2xl text-sm
                ${msg.sender === 'me'
                    ? 'bg-sexify text-white'
                    : 'bg-white text-gray-800 border border-gray-100'}">

                ${msg.text}

                ${msg.reactions.length ? `
                    <div class="text-xs mt-1 opacity-70">
                        ${msg.reactions.map(r => r.emoji).join(' ')}
                    </div>` : ''}

                ${msg.sender === 'me' ? `
                    <div class="text-[10px] mt-1 opacity-60 text-right">
                        ${msg.read ? '✔✔' : '✔'}
                    </div>` : ''}
            </div>
        </div>
    `).join('');

    container.scrollTop = container.scrollHeight;
}

// ==========================
// 🔥 發送訊息
// ==========================
function sendText(e) {
    if (e) e.preventDefault();

    const input = document.getElementById('chat-input');
    if (!input) return;

    const text = input.value.trim();
    if (!text) return;

    addMessage(currentChatId, {
        sender: 'me',
        text,
        time: getNowTime(),
        read: true,
        reactions: []
    });

    input.value = '';

    renderChatMessages();
    renderMessages();
}

// ==========================
function addMessage(chatId, msg) {
    if (!messagesDB[chatId]) messagesDB[chatId] = [];

    msg.id = Date.now();
    messagesDB[chatId].push(msg);

    const chat = chatList.find(c => c.id === chatId);
    if (chat) {
        chat.lastMsg = msg.text;
        chat.time = '現在';
        if (msg.sender === 'them') chat.unread++;
    }
}

// ==========================
function simulateTyping(chatId) {
    typingState[chatId] = true;
    renderMessages();

    setTimeout(() => {
        typingState[chatId] = false;

        addMessage(chatId, {
            sender: 'them',
            text: '剛剛在忙 😆',
            time: getNowTime(),
            read: false,
            reactions: []
        });

        renderMessages();
        renderChatMessages();
    }, 2000);
}

// ==========================
function renderIceBreaker() {
    const container = document.getElementById('ice-breaker');
    const prompts = [
        "你最近聽咩音樂？",
        "你平時放假做咩？",
        "最鍾意邊套電影？"
    ];

    container.classList.remove('hidden');

    container.innerHTML = `
        <div class="flex gap-2 overflow-x-auto">
            ${prompts.map(p => `
                <button onclick="useIceBreaker('${p}')"
                    class="text-xs bg-gray-100 px-3 py-1 rounded-full whitespace-nowrap">
                    ${p}
                </button>
            `).join('')}
        </div>
    `;
}

function useIceBreaker(text) {
    document.getElementById('chat-input').value = text;
}

// ==========================
function getNowTime() {
    const d = new Date();
    return `${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
}

// ==========================
// 初始化
// ==========================
document.addEventListener('DOMContentLoaded', () => {
    renderMessages();
    initChatRoom(); // 🔥 預先建立，避免動態問題
});