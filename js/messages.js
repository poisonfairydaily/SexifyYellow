// 1. 全域模擬數據 (保留用來顯示左側的聊天對象列表)
window.chatList = [
    { id: 1, user: 'Mina_米娜', avatar: 'https://i.pravatar.cc/100?u=mina', lastMsg: '點擊進入開始我們的連網測試吧！', time: '剛剛', unread: 1 },
    { id: 2, user: '官方小助手', avatar: 'https://i.pravatar.cc/100?u=admin', lastMsg: '歡迎加入 Sexify，開啟你的專屬美好。', time: '昨天', unread: 0 },
    { id: 3, user: 'Xaiver_Fitness', avatar: 'https://i.pravatar.cc/100?u=xaiver', lastMsg: '下次一起出來喝一杯？', time: '週三', unread: 0 }
];

let activeChatId = null;
let realtimeSubscription = null;

// 🔥 新增：取得或設定目前的測試使用者名稱（為了區分你跟朋友）
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

function openChatFromProfile() {
    const name = document.getElementById('other-name').innerText;
    const avatar = document.getElementById('other-avatar').src;
    openChat(name, avatar, null);
}

// 🔥 新增：打開對話框時，去 Supabase 讀取雲端資料
async function openChat(username, avatarUrl, id) {
    activeChatId = id;
    document.getElementById('chat-name').innerText = username;
    document.getElementById('chat-avatar').src = avatarUrl;
    
    const chatContainer = document.getElementById('chat-messages');
    chatContainer.innerHTML = '<div class="text-center text-xs text-gray-400 my-4">連線至雲端資料庫中...</div>';

    document.getElementById('chat-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('chat-modal').classList.remove('translate-x-full'), 10);

    // 檢查是否有連線
    if (!window.supabaseClient) {
        chatContainer.innerHTML = '<div class="text-center text-xs text-red-500 my-4">找不到資料庫連線！請確認 index.html 有引入套件。</div>';
        return;
    }

    // 1. 抓取歷史訊息
    const { data, error } = await window.supabaseClient
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true });

    if (error) {
        console.error("讀取失敗:", error);
        chatContainer.innerHTML = `<div class="text-center text-xs text-red-500 my-4">讀取訊息失敗！<br>請確認 Supabase 是否有開啟表格的權限。</div>`;
        return;
    }

    chatContainer.innerHTML = '<div class="text-center text-xs text-gray-400 my-4">今天 (全服測試大廳)</div>';

    // 畫出歷史訊息
    if (data && data.length > 0) {
        data.forEach(msg => { appendMessageToUI(msg, avatarUrl); });
    } else {
        chatContainer.innerHTML += '<div class="text-center text-xs text-gray-300 my-4" id="empty-msg">還沒有人說話，當第一個發言的人吧！</div>';
    }

    chatContainer.scrollTop = chatContainer.scrollHeight;

    // 2. 訂閱新訊息 (即時通訊核心)
    if (realtimeSubscription) {
        window.supabaseClient.removeChannel(realtimeSubscription);
    }

    realtimeSubscription = window.supabaseClient
        .channel('public:messages')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
            const emptyMsg = document.getElementById('empty-msg');
            if(emptyMsg) emptyMsg.remove();
            
            appendMessageToUI(payload.new, avatarUrl);
            chatContainer.scrollTop = chatContainer.scrollHeight;
        })
        .subscribe();
}

// 將訊息畫到介面上的工具函數
function appendMessageToUI(msg, otherAvatar) {
    const chatContainer = document.getElementById('chat-messages');
    
    // 判斷是不是自己發的
    const isMe = (msg.sender_name === myChatName);
    
    // 如果是自己，用設定的頭像；如果不是，用朋友的頭像
    const avatar = isMe ? (typeof currentUser !== 'undefined' ? currentUser.avatar : 'https://i.pravatar.cc/150?u=me') : 'https://i.pravatar.cc/150?u='+msg.sender_name;

    const alignClass = isMe ? "justify-end self-end ml-auto flex-row-reverse" : "max-w-[85%]";
    const bgClass = isMe ? "bg-sexify text-white rounded-tr-sm" : "bg-white text-gray-800 rounded-tl-sm border border-gray-100";

    chatContainer.innerHTML += `
        <div class="flex gap-2 mt-4 ${alignClass} animate-fade-in">
            <img src="${avatar}" class="w-8 h-8 rounded-full flex-shrink-0 object-cover shadow-sm">
            <div class="${bgClass} p-3 rounded-2xl text-sm shadow-sm leading-relaxed">
                ${msg.content}
                <div class="text-[9px] ${isMe ? 'text-pink-200' : 'text-gray-400'} mt-1 font-bold">${msg.sender_name}</div>
            </div>
        </div>
    `;
}

function closeChat() {
    document.getElementById('chat-modal').classList.add('translate-x-full');
    setTimeout(() => document.getElementById('chat-modal').classList.add('hidden'), 300);
    activeChatId = null;
    
    // 關閉視窗時斷開訂閱，節省資源
    if (realtimeSubscription) {
        window.supabaseClient.removeChannel(realtimeSubscription);
        realtimeSubscription = null;
    }
}

// 🔥 新增：發送訊息到 Supabase 雲端
async function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;

    // 先清空輸入框，增加使用者體驗
    input.value = '';

    if (window.supabaseClient) {
        const { error } = await window.supabaseClient
            .from('messages')
            .insert([
                { content: text, sender_name: myChatName }
            ]);

        if (error) {
            console.error("發送失敗:", error);
            alert("發送失敗！請檢查資料庫連線。");
        }
        // 成功後不需要手動畫上畫面，因為上方的即時訂閱 (realtimeSubscription) 會自動偵測並畫出來！
    } else {
        alert("資料庫尚未連線！");
    }
}