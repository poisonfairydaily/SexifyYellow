// 1. 全域變數定義
window.chatList = [
    { id: 1, user: 'Mina_米娜', avatar: 'https://i.pravatar.cc/100?u=mina', lastMsg: '點擊進入開始我們的連網測試吧！', time: '剛剛', unread: 1 },
    { id: 2, user: '官方小助手', avatar: 'https://i.pravatar.cc/100?u=admin', lastMsg: '歡迎加入 Sexify。', time: '昨天', unread: 0 },
    { id: 3, user: 'Xaiver_Fitness', avatar: 'https://i.pravatar.cc/100?u=xaiver', lastMsg: '下次一起出來喝一杯？', time: '週三', unread: 0 }
];

let activeChatId = null;
let realtimeSubscription = null;

// 取得或設定使用者名稱
let myChatName = localStorage.getItem('myChatName');
if (!myChatName) {
    myChatName = prompt("請輸入你的測試暱稱：", "匿名使用者") || "神秘訪客";
    localStorage.setItem('myChatName', myChatName);
}

// 2. 渲染左側訊息列表
function renderMessages() {
    const container = document.getElementById('messages-list');
    if (!container) return;

    container.innerHTML = window.chatList.map(chat => `
        <div class="flex items-center gap-4 p-4 active:bg-gray-50 transition border-b border-gray-50 cursor-pointer" 
             onclick="openChat('${chat.user}', '${chat.avatar}', ${chat.id})">
            <div class="relative flex-shrink-0">
                <img src="${chat.avatar}" class="w-12 h-12 rounded-full border border-gray-100 object-cover">
                ${chat.unread > 0 ? `<span class="absolute -top-1 -right-1 bg-sexify text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border-2 border-white">${chat.unread}</span>` : ''}
            </div>
            <div class="flex-1 min-w-0">
                <div class="flex justify-between items-center mb-1">
                    <h3 class="font-bold text-gray-800 truncate text-sm">${chat.user}</h3>
                    <span class="text-[10px] text-gray-400">${chat.time}</span>
                </div>
                <p class="text-xs text-gray-500 truncate leading-tight">${chat.lastMsg}</p>
            </div>
        </div>
    `).join('');
}

// 3. 開啟聊天視窗並啟動 Realtime 監聽
async function openChat(userName, avatar, chatId) {
    activeChatId = chatId;
    document.getElementById('chat-user-name').innerText = userName;
    document.getElementById('chat-user-avatar').src = avatar;
    
    // 初始化聊天訊息容器
    const chatContainer = document.getElementById('chat-messages');
    chatContainer.innerHTML = ''; 

    // 先抓取舊訊息 (一次性讀取)
    const { data, error } = await window.supabaseClient
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(50);

    if (data) {
        data.forEach(msg => appendMessageUI(msg));
    }

    // 🔥 重要：啟動即時監聽器
    if (realtimeSubscription) {
        window.supabaseClient.removeChannel(realtimeSubscription);
    }

    realtimeSubscription = window.supabaseClient
        .channel('public:messages') // 設定頻道名稱
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
            console.log('收到新訊息通知!', payload);
            appendMessageUI(payload.new);
            
            // 自動滾動到底部
            chatContainer.scrollTop = chatContainer.scrollHeight;
        })
        .subscribe();

    // 顯示視窗動畫
    document.getElementById('chat-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('chat-modal').classList.remove('translate-x-full'), 10);
}

// 4. 將新訊息繪製到畫面上
function appendMessageUI(msg) {
    const chatContainer = document.getElementById('chat-messages');
    const isMe = msg.sender_name === myChatName;
    const alignClass = isMe ? 'justify-end ml-auto flex-row-reverse' : '';
    const bgClass = isMe ? 'bg-sexify text-white rounded-tr-sm' : 'bg-white text-gray-800 rounded-tl-sm border border-gray-100';
    const avatar = isMe ? 'https://i.pravatar.cc/100?u=me' : document.getElementById('chat-user-avatar').src;

    chatContainer.innerHTML += `
        <div class="flex gap-2 mt-4 max-w-[85%] ${alignClass} animate-fade-in">
            <img src="${avatar}" class="w-8 h-8 rounded-full flex-shrink-0 object-cover shadow-sm">
            <div class="${bgClass} p-3 rounded-2xl text-sm shadow-sm leading-relaxed">
                ${msg.content}
                <div class="text-[9px] ${isMe ? 'text-pink-200' : 'text-gray-400'} mt-1 font-bold">${msg.sender_name}</div>
            </div>
        </div>
    `;
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// 5. 關閉聊天室並移除監聽 (節省效能)
function closeChat() {
    document.getElementById('chat-modal').classList.add('translate-x-full');
    setTimeout(() => document.getElementById('chat-modal').classList.add('hidden'), 300);
    
    if (realtimeSubscription) {
        window.supabaseClient.removeChannel(realtimeSubscription);
        realtimeSubscription = null;
    }
    activeChatId = null;
}

// 6. 發送訊息
async function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text || !window.supabaseClient) return;

    input.value = ''; // 立即清空輸入框

    const { error } = await window.supabaseClient
        .from('messages')
        .insert([{ content: text, sender_name: myChatName }]);

    if (error) {
        console.error('發送失敗:', error.message);
        alert('連線不穩定，訊息發送失敗');
    }
}