// ==========================================
// 🚀 訊息模組 (防衝突 & 即時同步版)
// ==========================================

// 使用 window 物件確保變數唯一，防止 "already declared" 錯誤
window.activeChatId = window.activeChatId || null;
window.realtimeChannel = window.realtimeChannel || null;

// 1. 取得測試暱稱 (用來在畫面上區分你跟朋友)
if (!localStorage.getItem('myChatName')) {
    let name = prompt("【首次測試】請輸入你的聊天暱稱：", "用戶" + Math.floor(Math.random()*1000));
    localStorage.setItem('myChatName', name || "匿名訪客");
}
const myChatName = localStorage.getItem('myChatName');

// 2. 渲染左側聊天列表
function renderMessages() {
    const container = document.getElementById('messages-list');
    if (!container) return;

    // 這裡我們只放一個測試對象，點擊它就會連到你的 Supabase
    const mockChats = [
        { id: 'global-test', user: '連網測試頻道', avatar: 'https://i.pravatar.cc/100?u=test', lastMsg: '點我開始即時聊天', time: '現在' }
    ];

    container.innerHTML = mockChats.map(chat => `
        <div class="flex items-center gap-4 p-4 active:bg-gray-50 transition border-b border-gray-50 cursor-pointer" 
             onclick="openChat('${chat.user}', '${chat.avatar}', '${chat.id}')">
            <img src="${chat.avatar}" class="w-12 h-12 rounded-full border border-gray-100 object-cover">
            <div class="flex-1">
                <h4 class="font-bold text-sm">${chat.user}</h4>
                <p class="text-xs text-gray-400">${chat.lastMsg}</p>
            </div>
        </div>
    `).join('');
}

// 3. 開啟對話框並啟動「即時監聽」
async function openChat(username, avatarUrl, id) {
    window.activeChatId = id;
    document.getElementById('chat-name').innerText = username;
    document.getElementById('chat-avatar').src = avatarUrl;
    
    // 顯示視窗與動畫
    const modal = document.getElementById('chat-modal');
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.remove('translate-x-full'), 10);
    
    const chatContainer = document.getElementById('chat-messages');
    chatContainer.innerHTML = '<p class="text-center text-gray-400 text-[10px] py-10">正在連線至雲端資料庫...</p>';

    if (!window.supabaseClient) {
        alert("Supabase 未連線，請檢查 supabase-config.js");
        return;
    }

    // A. 抓取舊訊息
    const { data, error } = await window.supabaseClient
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true });

    if (!error) {
        chatContainer.innerHTML = '';
        data.forEach(msg => appendMessageToUI(msg));
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    // B. 🔥 啟動 Realtime 即時監聽
    if (window.realtimeChannel) window.supabaseClient.removeChannel(window.realtimeChannel);

    window.realtimeChannel = window.supabaseClient
        .channel('any')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
            console.log('收到新訊息!', payload.new);
            appendMessageToUI(payload.new);
            chatContainer.scrollTop = chatContainer.scrollHeight;
        })
        .subscribe();
}

// 4. 將訊息畫在畫面上
function appendMessageToUI(msg) {
    const chatContainer = document.getElementById('chat-messages');
    const isMe = msg.sender_name === myChatName;
    
    const msgHTML = `
        <div class="flex ${isMe ? 'justify-end' : 'justify-start'} mb-4 px-2 animate-fade-in">
            <div class="${isMe ? 'bg-pink-500 text-white rounded-tr-none' : 'bg-gray-100 text-gray-800 rounded-tl-none'} p-3 rounded-2xl text-sm shadow-sm max-w-[80%]">
                <div class="text-[9px] ${isMe ? 'text-pink-100' : 'text-gray-400'} mb-1 font-bold">${msg.sender_name}</div>
                ${msg.content}
            </div>
        </div>
    `;
    chatContainer.insertAdjacentHTML('beforeend', msgHTML);
}

// 5. 發送訊息
async function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text || !window.supabaseClient) return;

    input.value = ''; // 發送後立刻清空

    const { error } = await window.supabaseClient
        .from('messages')
        .insert([{ content: text, sender_name: myChatName }]);
    
    if (error) alert("發送失敗: " + error.message);
}

// 6. 關閉對話
function closeChat() {
    const modal = document.getElementById('chat-modal');
    modal.classList.add('translate-x-full');
    setTimeout(() => modal.classList.add('hidden'), 300);
    
    if (window.realtimeChannel) {
        window.supabaseClient.removeChannel(window.realtimeChannel);
        window.realtimeChannel = null;
    }
}

// 初始化列表
document.addEventListener('DOMContentLoaded', renderMessages);