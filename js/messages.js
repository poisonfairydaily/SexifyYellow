// ==========================================
// js/messages.js - Instagram 風格成熟版 (含即時通知與好友系統)
// ==========================================

window.activeRoomId = null;
window.activeChatTarget = null;
window.roomChannel = null;     // 專屬房間的監聽
window.globalChannel = null;   // 全局通知的監聽
let selectedImageFile = null;

// 1. 初始化使用者與全局 UI
let myChatName = localStorage.getItem('myChatName');
if (!myChatName) {
    let name = prompt("【IG風格聊天室】請輸入你的專屬帳號 (這將是你的唯一識別)：", "User_" + Math.floor(Math.random() * 10000));
    localStorage.setItem('myChatName', name || "神秘使用者");
    myChatName = localStorage.getItem('myChatName');
}

// 動態注入通知彈窗 (Toast) 的 CSS 與 HTML 容器
document.head.insertAdjacentHTML('beforeend', `
<style>
    .toast-enter { animation: slideDownFade 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
    .toast-leave { animation: slideUpFade 0.3s ease-in forwards; }
    @keyframes slideDownFade { from { transform: translateY(-100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    @keyframes slideUpFade { from { transform: translateY(0); opacity: 1; } to { transform: translateY(-100%); opacity: 0; } }
    .ig-inbox-item:active { background-color: #f3f4f6; }
</style>
`);
document.body.insertAdjacentHTML('beforeend', `<div id="global-toast-container" class="fixed top-4 left-0 w-full px-4 z-[9999] pointer-events-none flex flex-col gap-2"></div>`);

// 核心演算法：產生唯一的房間 ID
function generateRoomId(user1, user2) {
    return [user1, user2].sort().join('_');
}

// 2. 本地好友/聯絡人系統 (Add Friend)
function getFriends() {
    return JSON.parse(localStorage.getItem('myFriends')) || [];
}
function addFriend() {
    const friendName = prompt("請輸入你想添加的好友帳號：");
    if (!friendName || friendName.trim() === "") return;
    if (friendName.trim() === myChatName) return alert("不能添加自己為好友！");
    
    let friends = getFriends();
    if (!friends.includes(friendName.trim())) {
        friends.push(friendName.trim());
        localStorage.setItem('myFriends', JSON.stringify(friends));
        alert(`🎉 成功添加 ${friendName.trim()} 為好友！`);
        renderMessages(); // 重新渲染畫面
    } else {
        alert("這個人已經在你的好友名單中囉！");
    }
}

// 3. 渲染首頁收件匣 (Inbox) 與好友列
window.renderMessages = async function() {
    const container = document.getElementById('messages-list');
    if (!container) return;

    container.innerHTML = `<div class="text-center py-10"><i class="fa-solid fa-circle-notch fa-spin text-sexify text-2xl"></i><p class="mt-2 text-gray-400 text-sm">載入收件匣中...</p></div>`;

    try {
        // 從資料庫抓取與我有關的訊息 (我是發送者或接收者)
        const { data: inboxData, error } = await window.supabaseClient
            .from('messages')
            .select('*')
            .or(`sender.eq.${myChatName},receiver.eq.${myChatName}`)
            .order('created_at', { ascending: false })
            .limit(500);

        if (error) throw error;

        // 整理最新的對話紀錄 (Group by room_id)
        let roomsMap = {};
        (inboxData || []).forEach(msg => {
            if (!roomsMap[msg.room_id]) {
                const targetUser = msg.sender === myChatName ? msg.receiver : msg.sender;
                roomsMap[msg.room_id] = {
                    targetUser: targetUser,
                    lastMsg: msg.content ? msg.content : (msg.image_url ? '傳送了一張圖片' : '傳送了附件'),
                    time: new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
                    timestamp: new Date(msg.created_at).getTime(),
                    isUnread: msg.receiver === myChatName // 簡單未讀邏輯
                };
            }
        });

        // 轉成陣列並加上手動添加的好友 (如果還沒聊過天)
        let inboxArray = Object.values(roomsMap);
        let friends = getFriends();
        friends.forEach(f => {
            if (!inboxArray.find(r => r.targetUser === f)) {
                inboxArray.push({ targetUser: f, lastMsg: '開始你們的第一次對話吧！', time: '', timestamp: 0, isUnread: false });
            }
        });
        inboxArray.sort((a, b) => b.timestamp - a.timestamp);

        // 渲染 UI (類似 IG 的橫向好友列 + 直向訊息列)
        let html = `
            <div class="p-4 bg-white border-b border-gray-100 sticky top-0 z-10 flex justify-between items-center">
                <h2 class="font-black text-xl text-gray-800">${myChatName} <i class="fa-solid fa-angle-down text-sm ml-1"></i></h2>
                <button onclick="addFriend()" class="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-800 active:scale-90 transition">
                    <i class="fa-solid fa-user-plus"></i>
                </button>
            </div>
        `;

        if (inboxArray.length === 0) {
            html += `<div class="text-center text-gray-400 py-20 flex flex-col items-center"><i class="fa-brands fa-instagram text-5xl mb-4 text-gray-200"></i><p>目前沒有訊息<br>點擊右上角添加好友開始聊天！</p></div>`;
        } else {
            html += `<div class="pb-20">` + inboxArray.map(chat => `
                <div class="ig-inbox-item flex items-center gap-4 p-4 transition border-b border-gray-50 cursor-pointer"
                     onclick="openChat('${chat.targetUser}')">
                    <div class="relative">
                        <img src="https://i.pravatar.cc/150?u=${chat.targetUser}" class="w-14 h-14 rounded-full object-cover border border-gray-100">
                        ${chat.isUnread ? `<div class="absolute right-0 bottom-0 w-3.5 h-3.5 bg-sexify border-2 border-white rounded-full"></div>` : ''}
                    </div>
                    <div class="flex-1 min-w-0">
                        <h3 class="font-bold text-gray-900 truncate ${chat.isUnread ? '' : 'text-gray-700'}">${chat.targetUser}</h3>
                        <div class="flex justify-between items-center mt-0.5">
                            <p class="text-sm truncate ${chat.isUnread ? 'text-gray-900 font-bold' : 'text-gray-500'}">${chat.lastMsg}</p>
                            <span class="text-xs text-gray-400 whitespace-nowrap ml-2">${chat.time}</span>
                        </div>
                    </div>
                </div>
            `).join('') + `</div>`;
        }
        container.innerHTML = html;

    } catch (err) {
        console.error("載入收件匣失敗", err);
        container.innerHTML = `<div class="text-center text-red-400 py-10">連線失敗，請重整頁面</div>`;
    }
};

// 4. 全局通知監聽器 (Global Notification) - 隨時接收別人發給我的訊息
function setupGlobalRealtime() {
    if (window.globalChannel) return; // 避免重複建立
    
    window.globalChannel = window.supabaseClient.channel('global_notifications')
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `receiver=eq.${myChatName}` // 🔥 關鍵：只監聽發給「我」的訊息
        }, payload => {
            const msg = payload.new;
            
            // 如果我正在跟這個人聊天，就不顯示頂部通知
            if (window.activeChatTarget === msg.sender && document.getElementById('chat-modal').classList.contains('hidden') === false) {
                return; 
            }

            // 顯示 IG 風格通知彈窗
            showToastNotification(msg.sender, msg.content || '傳送了一張圖片', `https://i.pravatar.cc/150?u=${msg.sender}`);
            
            // 重新整理收件匣，讓未讀狀態更新
            if (document.getElementById('messages-tab').classList.contains('active')) {
                renderMessages();
            }
        })
        .subscribe();
}

function showToastNotification(sender, text, avatar) {
    const container = document.getElementById('global-toast-container');
    const toast = document.createElement('div');
    toast.className = `toast-enter pointer-events-auto w-full max-w-sm mx-auto bg-white/95 backdrop-blur-md shadow-xl rounded-2xl p-4 flex items-center gap-3 cursor-pointer border border-gray-100`;
    toast.innerHTML = `
        <img src="${avatar}" class="w-10 h-10 rounded-full object-cover">
        <div class="flex-1 min-w-0">
            <p class="text-sm font-bold text-gray-900">${sender}</p>
            <p class="text-sm text-gray-500 truncate">${text}</p>
        </div>
        <div class="w-2 h-2 bg-sexify rounded-full"></div>
    `;
    
    // 點擊通知直接開聊
    toast.onclick = () => {
        toast.style.display = 'none';
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        document.getElementById('messages-tab').classList.add('active');
        openChat(sender);
    };

    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.replace('toast-enter', 'toast-leave');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// 5. 開啟專屬聊天室
window.openChat = async function(targetName) {
    window.activeChatTarget = targetName;
    window.activeRoomId = generateRoomId(myChatName, targetName);

    const modal = document.getElementById('chat-modal');
    const headerTitle = modal.querySelector('h2');
    const chatMessages = document.getElementById('chat-messages');

    headerTitle.innerHTML = `<div class="flex items-center gap-2"><img src="https://i.pravatar.cc/150?u=${targetName}" class="w-8 h-8 rounded-full border border-gray-200"> ${targetName}</div>`;
    chatMessages.innerHTML = `<div class="text-center text-gray-400 py-10"><i class="fa-solid fa-circle-notch fa-spin text-2xl"></i></div>`;

    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.remove('translate-x-full'), 10);

    try {
        const { data, error } = await window.supabaseClient.from('messages')
            .select('*').eq('room_id', window.activeRoomId).order('created_at', { ascending: true });
        if (error) throw error;
        
        drawMessages(data || []);
        setupRoomRealtime();
    } catch (err) {
        console.error(err);
        chatMessages.innerHTML = "載入失敗";
    }
};

// 6. 渲染聊天氣泡
function drawMessages(messages) {
    const container = document.getElementById('chat-messages');
    if (messages.length === 0) {
        container.innerHTML = `<div class="text-center text-gray-400 py-10 mt-10 text-sm"><img src="https://i.pravatar.cc/150?u=${window.activeChatTarget}" class="w-24 h-24 mx-auto rounded-full mb-4 opacity-50"><p>你們已經互相加為好友<br>現在可以發送訊息了</p></div>`;
        return;
    }

    container.innerHTML = messages.map(msg => {
        const isMe = msg.sender === myChatName;
        const align = isMe ? 'justify-end' : 'justify-start';
        const bg = isMe ? 'bg-[#ff2442] text-white' : 'bg-gray-100 text-gray-900';
        const radius = isMe ? 'rounded-l-2xl rounded-tr-2xl rounded-br-sm' : 'rounded-r-2xl rounded-tl-2xl rounded-bl-sm';

        let mediaHtml = msg.image_url ? `<img src="${msg.image_url}" class="max-w-[200px] sm:max-w-xs rounded-xl mb-1 cursor-pointer border border-black/5" onclick="window.open('${msg.image_url}')">` : '';

        return `
            <div class="flex ${align} mb-4">
                <div class="max-w-[75%] flex flex-col ${isMe ? 'items-end' : 'items-start'}">
                    <div class="${bg} ${radius} px-4 py-2.5 shadow-sm inline-block break-words text-[15px]">
                        ${mediaHtml}
                        ${msg.content ? `<span>${msg.content}</span>` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
    container.scrollTop = container.scrollHeight;
}

// 7. 專屬房間即時監聽 (對方正在輸入 / 收到訊息)
function setupRoomRealtime() {
    if (window.roomChannel) window.supabaseClient.removeChannel(window.roomChannel);

    window.roomChannel = window.supabaseClient.channel('room_' + window.activeRoomId)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${window.activeRoomId}` }, payload => {
            const newMsg = payload.new;
            const container = document.getElementById('chat-messages');
            
            if (container.innerHTML.includes('現在可以發送訊息')) container.innerHTML = '';

            const isMe = newMsg.sender === myChatName;
            const align = isMe ? 'justify-end' : 'justify-start';
            const bg = isMe ? 'bg-[#ff2442] text-white' : 'bg-gray-100 text-gray-900';
            const radius = isMe ? 'rounded-l-2xl rounded-tr-2xl rounded-br-sm' : 'rounded-r-2xl rounded-tl-2xl rounded-bl-sm';
            
            let mediaHtml = newMsg.image_url ? `<img src="${newMsg.image_url}" class="max-w-[200px] rounded-xl mb-1">` : '';

            const msgDiv = document.createElement('div');
            msgDiv.className = `flex ${align} mb-4 toast-enter`;
            msgDiv.innerHTML = `<div class="max-w-[75%] flex flex-col ${isMe ? 'items-end' : 'items-start'}"><div class="${bg} ${radius} px-4 py-2.5 shadow-sm break-words text-[15px]">${mediaHtml}${newMsg.content || ''}</div></div>`;
            
            container.appendChild(msgDiv);
            container.scrollTop = container.scrollHeight;
        }).subscribe();
}

// 8. 發送訊息核心邏輯 (包含修復後的圖片上傳)
window.handleSendAction = async function() {
    const input = document.getElementById('chat-input');
    const text = input.value;

    if (!text.trim() && !selectedImageFile) return;

    input.value = '';
    let uploadedImageUrl = null;

    // 處理圖片上傳
    if (selectedImageFile) {
        const pg = document.getElementById('chat-upload-progress');
        if(pg) { pg.classList.remove('hidden'); pg.classList.add('flex'); }

        // 確保檔名安全
        const fileExt = selectedImageFile.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 5)}.${fileExt}`;
        
        try {
            const { data: uploadData, error: uploadError } = await window.supabaseClient.storage
                .from('chat-images')
                .upload(fileName, selectedImageFile, { cacheControl: '3600', upsert: false });

            if (uploadError) throw uploadError;

            const { data: publicUrlData } = window.supabaseClient.storage.from('chat-images').getPublicUrl(fileName);
            uploadedImageUrl = publicUrlData.publicUrl;
        } catch (err) {
            console.error("圖片上傳失敗詳細原因:", err);
            alert("圖片上傳失敗，請確認 Storage 權限 (RLS) 已開啟！");
            cancelImageSelection();
            return;
        }
        cancelImageSelection();
    }

    // 將資料寫入 Database (包含 receiver 欄位以觸發對方通知)
    const { error } = await window.supabaseClient.from('messages').insert([{
        room_id: window.activeRoomId, 
        sender: myChatName,
        receiver: window.activeChatTarget,  // 🔥 關鍵新增：指定接收者是誰
        content: text.trim() || null,
        image_url: uploadedImageUrl
    }]);

    if (error) {
        console.error("發送失敗", error);
        alert("發送失敗: " + error.message);
    }
};

// 圖片選擇與取消預覽 (保持原有)
window.handleImageSelection = function(input) {
    const file = input.files[0];
    if (!file) return;
    selectedImageFile = file;
    const reader = new FileReader();
    reader.onload = e => {
        const p = document.getElementById('chat-image-preview');
        const c = document.getElementById('chat-image-preview-container');
        if (p && c) { p.src = e.target.result; c.classList.remove('hidden'); c.classList.add('flex'); }
    };
    reader.readAsDataURL(file);
};
window.cancelImageSelection = function() {
    selectedImageFile = null;
    const i = document.getElementById('chat-image-input');
    const c = document.getElementById('chat-image-preview-container');
    const pg = document.getElementById('chat-upload-progress');
    if (i) i.value = '';
    if (c) { c.classList.add('hidden'); c.classList.remove('flex'); }
    if (pg) { pg.classList.add('hidden'); pg.classList.remove('flex'); }
};

window.closeChat = function() {
    const modal = document.getElementById('chat-modal');
    modal.classList.add('translate-x-full');
    setTimeout(() => {
        modal.classList.add('hidden');
        document.getElementById('chat-messages').innerHTML = ''; 
    }, 300);
    if (window.roomChannel) {
        window.supabaseClient.removeChannel(window.roomChannel);
        window.roomChannel = null;
    }
    window.activeRoomId = null;
    window.activeChatTarget = null;
    renderMessages(); // 退回列表時刷新最新對話
};

// 系統啟動時，初始化通知監聽
document.addEventListener('DOMContentLoaded', () => {
    // 延遲一點等 Supabase 準備好
    setTimeout(() => {
        setupGlobalRealtime();
        if (document.getElementById('messages-tab').classList.contains('active')) {
            renderMessages();
        }
    }, 1000);
});
