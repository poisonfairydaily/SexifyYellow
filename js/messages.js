// ==========================================
// messages.js - 完整全替換式 (歷史紀錄 + 即時監聽)
// ==========================================

// 1. 全域模擬數據 (保留用來顯示左側的聊天對象列表)
window.chatList = [
    { id: 1, user: 'Mina_米娜', avatar: 'https://i.pravatar.cc/100?u=mina', lastMsg: '點擊進入開始我們的連網測試吧！', time: '剛剛', unread: 1 },
    { id: 2, user: '官方小助手', avatar: 'https://i.pravatar.cc/100?u=admin', lastMsg: '歡迎加入 Sexify，開啟你的專屬美好。', time: '昨天', unread: 0 },
    { id: 3, user: 'Xaiver_Fitness', avatar: 'https://i.pravatar.cc/100?u=xaiver', lastMsg: '下次一起出來喝一杯？', time: '週三', unread: 0 }
];

let activeChatId = null;
let realtimeSubscription = null;

// 🔥 取得或設定目前的測試使用者名稱 (讓你跟朋友測試時能區分是誰傳的)
let myChatName = localStorage.getItem('myChatName');
if (!myChatName) {
    myChatName = prompt("【系統提示】請輸入你的測試暱稱\n（這將會顯示在私訊中，用來區分你跟朋友）：", "你的暱稱");
    if(myChatName) {
        localStorage.setItem('myChatName', myChatName);
    } else {
        myChatName = "神秘訪客"; // 預設值
    }
}

// 2. 渲染左側訊息列表
function renderMessages() {
    const container = document.getElementById('messages-list');
    if (!container) return;

    container.innerHTML = window.chatList.map(chat => `
        <div class="flex items-center gap-4 p-4 active:bg-gray-50 transition border-b border-gray-50 cursor-pointer" onclick="openChat('${chat.user}', '${chat.avatar}', ${chat.id})">
            <div class="relative flex-shrink-0">
                <img src="${chat.avatar}" class="w-12 h-12 rounded-full border border-gray-100 object-cover">
                ${chat.unread > 0 ? `<span class="absolute -top-1 -right-1 bg-sexify text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border-2 border-white">${chat.unread}</span>` : ''}
            </div>
            <div class="flex-1 min-w-0">
                <div class="flex justify-between items-center mb-1">
                    <h3 class="font-bold text-gray-900 text-sm truncate">${chat.user}</h3>
                    <span class="text-xs text-gray-400 flex-shrink-0">${chat.time}</span>
                </div>
                <p class="text-sm text-gray-500 truncate">${chat.lastMsg}</p>
            </div>
        </div>
    `).join('');
}

// 3. 打開聊天室 (核心：載入歷史訊息 + 啟動即時監聽)
function openChat(userName, avatar, chatId) {
    activeChatId = chatId;

    // 清空當前的對話框並顯示連線中
    const chatContainer = document.getElementById('chat-messages');
    chatContainer.innerHTML = '<div class="text-center text-gray-400 text-xs py-4">連線中...</div>';

    // 顯示聊天視窗
    document.getElementById('chat-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('chat-modal').classList.remove('translate-x-full'), 10);

    // 呼叫 Supabase 抓取資料與監聽
    loadChatHistory();
    startRealtimeListener();
}

// 4. 關閉聊天室 (核心：斷開監聽，節省效能)
function closeChat() {
    document.getElementById('chat-modal').classList.add('translate-x-full');
    setTimeout(() => document.getElementById('chat-modal').classList.add('hidden'), 300);
    activeChatId = null;
    
    // 離開聊天室時，切斷監聽器
    if (realtimeSubscription && window.supabaseClient) {
        window.supabaseClient.removeChannel(realtimeSubscription);
        realtimeSubscription = null;
    }
}

// 5. 從 Supabase 載入歷史訊息
async function loadChatHistory() {
    if (!window.supabaseClient) return;

    // 依照建立時間 (created_at) 由舊到新排序讀取
    const { data, error } = await window.supabaseClient
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true }); 

    const chatContainer = document.getElementById('chat-messages');
    
    if (error) {
        console.error("讀取歷史訊息失敗:", error);
        chatContainer.innerHTML = '<div class="text-center text-red-400 text-xs py-4">讀取失敗，請檢查網路</div>';
        return;
    }

    chatContainer.innerHTML = ''; // 清空「連線中...」

    if (data && data.length > 0) {
        data.forEach(msg => {
            appendMessageToUI(msg);
        });
    } else {
        chatContainer.innerHTML = '<div class="text-center text-gray-400 text-xs py-4">這裡是聊天室的開端...</div>';
    }
}

// 6. 啟動 Realtime 監聽器 (最重要的魔法)
function startRealtimeListener() {
    if (!window.supabaseClient) return;

    realtimeSubscription = window.supabaseClient
        .channel('public:messages')
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'messages' 
        }, payload => {
            // 只要資料庫有新增一筆資料，這個 Listener 就會立刻攔截到，並畫到畫面上
            appendMessageToUI(payload.new);
        })
        .subscribe();
}

// 7. 將單筆訊息畫到畫面上 (動態計算是對齊左邊還是右邊)
function appendMessageToUI(msg) {
    const chatContainer = document.getElementById('chat-messages');
    
    // 如果原本顯示「開端...」，先清空它
    if (chatContainer.innerHTML.includes('這裡是聊天室的開端')) {
        chatContainer.innerHTML = '';
    }

    // 判斷這則訊息是不是自己發的
    const isMe = (msg.sender_name === myChatName);

    // 根據身分設定 UI 樣式
    const alignClass = isMe ? "justify-end flex-row-reverse self-end ml-auto" : "justify-start self-start mr-auto";
    const bgClass = isMe ? "bg-sexify text-white rounded-tr-sm" : "bg-white text-gray-800 rounded-tl-sm";
    const avatarSrc = isMe ? `https://i.pravatar.cc/150?u=${myChatName}` : `https://i.pravatar.cc/150?u=${msg.sender_name}`;
    const displayName = isMe ? "我" : msg.sender_name;

    const msgHtml = `
        <div class="flex gap-2 mt-4 max-w-[85%] ${alignClass} animate-fade-in">
            <img src="${avatarSrc}" class="w-8 h-8 rounded-full flex-shrink-0 object-cover shadow-sm">
            <div class="${bgClass} p-3 rounded-2xl text-sm shadow-sm leading-relaxed relative">
                ${msg.content}
                <div class="text-[9px] ${isMe ? 'text-pink-200 text-right' : 'text-gray-400 text-left'} mt-1 font-bold">
                    ${displayName}
                </div>
            </div>
        </div>
    `;

    chatContainer.insertAdjacentHTML('beforeend', msgHtml);

    // 讓滾動條自動滑到最底下
    setTimeout(() => {
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }, 50);
}

// 8. 發送訊息到 Supabase 雲端
async function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;

    // 先清空輸入框，假裝已經發送出去，提升流暢感
    input.value = '';

    if (window.supabaseClient) {
        const { error } = await window.supabaseClient
            .from('messages')
            .insert([{ content: text, sender_name: myChatName }]);

        if (error) {
            console.error("發送失敗:", error);
            alert("發送失敗，請確認 Supabase 設定！");
        }
        // 💡 關鍵筆記：這裡我們「不寫」 appendMessageToUI。
        // 因為資料庫一旦 INSERT 成功，第 6 步的 Listener 就會馬上聽到並自動幫我們更新畫面。
        // 這樣可以避免同一句話在畫面上出現兩次的 Bug！
    }
}

// 支援鍵盤按 Enter 快速發送
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const chatInput = document.getElementById('chat-input');
        if(chatInput) {
            chatInput.addEventListener('keypress', function (e) {
                if (e.key === 'Enter') {
                    sendChatMessage();
                }
            });
        }
    }, 1000);
});