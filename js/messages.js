// ==========================================
// js/messages.js - 嚴謹閉環版 (維持命名、修復空狀態與群組加入)
// ==========================================

window.activeRoomId = null;
window.activeChatTarget = null;
window.roomChannel = null;
window.globalChannel = null;
let selectedImageFile = null;

// 初始化使用者
let myChatName = localStorage.getItem('myChatName');
if (!myChatName) {
    let name = prompt("【Sexify】請輸入你的專屬帳號：", "User_" + Math.floor(Math.random() * 10000));
    localStorage.setItem('myChatName', name || "神秘使用者");
    myChatName = localStorage.getItem('myChatName');
}

// 注入必要的 CSS
document.head.insertAdjacentHTML('beforeend', `
<style>
    .unread-badge { background: #ff2442; color: white; border-radius: 99px; min-width: 20px; height: 20px; font-size: 10px; display: flex; align-items: center; justify-content: center; padding: 0 6px; }
    .chat-bubble { max-width: 75%; padding: 10px 14px; border-radius: 18px; margin-bottom: 8px; position: relative; font-size: 14px; line-height: 1.5; }
    .bubble-me { background: #ff2442; color: white; border-bottom-right-radius: 4px; }
    .bubble-other { background: #f1f1f1; color: #1a1a1a; border-bottom-left-radius: 4px; }
    .delete-btn { color: #ccc; transition: color 0.2s; }
    .delete-btn:hover { color: #ff2442; }
</style>
`);

if(!document.getElementById('global-toast-container')){
    document.body.insertAdjacentHTML('beforeend', `<div id="global-toast-container" class="fixed top-4 left-0 w-full px-4 z-[9999] pointer-events-none flex flex-col gap-2"></div>`);
}

function generateRoomId(user1, user2) {
    return [user1, user2].sort().join('_');
}

// ==========================================
// 好友與群組資料管理 (LocalStorage)
// ==========================================
function getFriends() { return JSON.parse(localStorage.getItem('myFriends')) || []; }
function getGroups() { return JSON.parse(localStorage.getItem('myGroups')) || []; }

window.addFriend = function() {
    const friendName = prompt("請輸入好友帳號以新增：");
    if (!friendName || friendName.trim() === "" || friendName === myChatName) return;
    let friends = getFriends();
    if (!friends.includes(friendName.trim())) {
        friends.push(friendName.trim());
        localStorage.setItem('myFriends', JSON.stringify(friends));
        renderMessages(); // 立刻重新渲染，解決新增後看不見的問題
    }
};

window.joinOrCreateGroup = function() {
    const groupName = prompt("請輸入【群組名稱】\\n(若群組不存在將自動建立，若已存在則會加入)：");
    if (!groupName || groupName.trim() === "") return;
    const cleanName = groupName.trim();
    
    let groups = getGroups();
    if (!groups.includes(cleanName)) {
        groups.push(cleanName);
        localStorage.setItem('myGroups', JSON.stringify(groups));
    }
    // 加入後直接開啟該群組聊天室
    openChat(cleanName, "GROUP_" + cleanName);
};

// ==========================================
// 收件匣渲染邏輯 (修復轉圈圈與空訊息顯示問題)
// ==========================================
window.renderMessages = async function() {
    const container = document.getElementById('messages-list');
    if (!container) return;

    // 顯示載入動畫
    container.innerHTML = `<div class="text-center py-10"><i class="fa-solid fa-circle-notch fa-spin text-sexify text-2xl"></i><p class="text-sm text-gray-400 mt-2">載入對話中...</p></div>`;

    try {
        // 取得個人的 1對1 訊息
        const { data: userMsgs, error: err1 } = await window.supabaseClient.from('messages')
            .select('*').or(`sender_name.eq.${myChatName},receiver.eq.${myChatName}`);
        if (err1) throw err1;

        // 取得群組訊息 (僅限自己加入的群組)
        let myGroups = getGroups().map(g => `GROUP_${g}`);
        let groupMsgs = [];
        if (myGroups.length > 0) {
            const { data: gData, error: err2 } = await window.supabaseClient.from('messages')
                .select('*').in('room_id', myGroups);
            if (err2) throw err2;
            if (gData) groupMsgs = gData;
        }

        // 合併所有訊息
        const allData = [...(userMsgs || []), ...groupMsgs];

        let roomsMap = {};
        let friends = getFriends();
        let groups = getGroups();

        // 【關鍵修復】：先把所有好友跟群組放進去，確保 0 訊息也能顯示
        friends.forEach(f => {
            let rid = generateRoomId(myChatName, f);
            roomsMap[rid] = { roomId: rid, targetUser: f, lastMsg: '點擊開始對話', time: '', timestamp: 0, count: 0, isGroup: false };
        });
        groups.forEach(g => {
            let rid = 'GROUP_' + g;
            roomsMap[rid] = { roomId: rid, targetUser: g, lastMsg: '點擊進入群組', time: '', timestamp: 0, count: 0, isGroup: true };
        });

        // 覆蓋實際的最新訊息與未讀計數
        allData.forEach(msg => {
            let isGroup = msg.room_id.startsWith('GROUP_');
            let targetUser = isGroup ? msg.room_id.replace('GROUP_', '') : (msg.sender_name === myChatName ? msg.receiver : msg.sender_name);
            
            // 如果是陌生人發訊息來，也會自動產生列表
            if (!roomsMap[msg.room_id]) {
                roomsMap[msg.room_id] = { roomId: msg.room_id, targetUser: targetUser, lastMsg: '', time: '', timestamp: 0, count: 0, isGroup: isGroup };
            }

            let room = roomsMap[msg.room_id];
            let msgTime = new Date(msg.created_at).getTime();

            // 簡易未讀邏輯
            if (msg.receiver === myChatName && msg.sender_name !== myChatName) room.count++;

            // 取最新一則訊息顯示在預覽
            if (msgTime > room.timestamp) {
                room.timestamp = msgTime;
                room.time = new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                let textPreview = msg.image_url ? '🖼️ 圖片訊息' : (msg.content || '傳送了訊息');
                room.lastMsg = (isGroup && msg.sender_name) ? `${msg.sender_name}: ${textPreview}` : textPreview;
            }
        });

        // 依據時間排序
        let inboxArray = Object.values(roomsMap).sort((a, b) => b.timestamp - a.timestamp);

        let html = `
            <div class="p-4 bg-white border-b border-gray-100 sticky top-0 z-10 flex justify-between items-center">
                <h2 class="font-black text-xl text-gray-800">${myChatName}</h2>
                <div class="flex gap-2">
                    <button onclick="joinOrCreateGroup()" class="text-xs bg-gray-100 px-3 py-2 rounded-full font-bold active:scale-95 transition">＋ 群組</button>
                    <button onclick="addFriend()" class="text-xs bg-gray-100 px-3 py-2 rounded-full font-bold active:scale-95 transition">＋ 好友</button>
                </div>
            </div>
            <div class="pb-20">
        `;

        if (inboxArray.length === 0) {
            html += `<div class="text-center text-gray-400 py-20"><p>目前沒有任何聊天，請點右上角新增！</p></div>`;
        } else {
            html += inboxArray.map(chat => `
                <div class="flex items-center gap-4 p-4 hover:bg-gray-50 transition border-b border-gray-50 cursor-pointer group" onclick="openChat('${chat.targetUser}', '${chat.roomId}')">
                    <div class="relative">
                        <img src="https://i.pravatar.cc/150?u=${chat.targetUser}" class="w-14 h-14 rounded-full border border-gray-100">
                        ${chat.count > 0 ? `<div class="absolute -top-1 -right-1 unread-badge">${chat.count}</div>` : ''}
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex justify-between items-center">
                            <h3 class="font-bold text-gray-900 truncate">${chat.isGroup ? '👥 ' : ''}${chat.targetUser}</h3>
                            <span class="text-[10px] text-gray-400">${chat.time}</span>
                        </div>
                        <p class="text-sm truncate text-gray-500 mt-0.5">${chat.lastMsg}</p>
                    </div>
                    <button onclick="event.stopPropagation(); deleteChat('${chat.roomId}', '${chat.targetUser}', ${chat.isGroup})" class="delete-btn px-2 opacity-0 group-hover:opacity-100 transition">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            `).join('');
        }
        
        html += `</div>`;
        container.innerHTML = html;

    } catch (err) {
        // 【防呆修復】：如果出錯，印出紅字而不是一直轉圈圈
        console.error("載入失敗:", err);
        container.innerHTML = `
            <div class="p-6 text-center text-red-500">
                <i class="fa-solid fa-triangle-exclamation text-3xl mb-2"></i>
                <p class="font-bold">連線資料庫失敗</p>
                <p class="text-xs mt-2 text-gray-500">請確認 Supabase 內是否有完整的 receiver 與 room_id 欄位。<br>錯誤訊息：${err.message}</p>
            </div>`;
    }
};

// ==========================================
// 聊天室內部邏輯
// ==========================================
window.openChat = async function(targetName, existingRoomId = null) {
    window.activeChatTarget = targetName;
    window.activeRoomId = existingRoomId || generateRoomId(myChatName, targetName);

    const modal = document.getElementById('chat-modal');
    const chatMessages = document.getElementById('chat-messages');
    
    // 更新標題
    const headerTitle = modal.querySelector('h2');
    if(headerTitle) headerTitle.innerText = window.activeRoomId.startsWith('GROUP_') ? `👥 ${targetName}` : targetName;

    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.remove('translate-x-full'), 10);
    chatMessages.innerHTML = `<div class="text-center py-20 text-gray-300"><i class="fa-solid fa-spinner fa-spin text-2xl"></i></div>`;

    try {
        const { data, error } = await window.supabaseClient.from('messages')
            .select('*').eq('room_id', window.activeRoomId).order('created_at', { ascending: true });
        
        if (error) throw error;
        
        chatMessages.innerHTML = ''; 
        if(data && data.length > 0) {
            data.forEach(msg => appendMessageUI(msg));
        } else {
            chatMessages.innerHTML = `<div class="text-center py-10 text-gray-400 text-sm">這是你們的第一條訊息，打個招呼吧！</div>`;
        }
        
        scrollToBottom();
        setupRoomRealtime();
    } catch (err) { 
        chatMessages.innerHTML = `<div class="text-center py-20 text-red-400">無法讀取訊息<br><span class="text-xs">${err.message}</span></div>`;
    }
};

function appendMessageUI(msg) {
    const container = document.getElementById('chat-messages');
    // 如果提示空狀態文字，先將其移除
    if(container.innerHTML.includes('這是你們的第一條訊息')) container.innerHTML = '';

    const isMe = msg.sender_name === myChatName;
    const align = isMe ? 'justify-end' : 'justify-start';
    const bubbleClass = isMe ? 'bubble-me' : 'bubble-other';
    
    const div = document.createElement('div');
    div.className = `flex ${align} w-full`;
    div.innerHTML = `
        <div class="chat-bubble ${bubbleClass}">
            ${!isMe && window.activeRoomId.startsWith('GROUP_') ? `<p class="text-[10px] opacity-60 mb-1 font-bold">${msg.sender_name}</p>` : ''}
            ${msg.image_url ? `<img src="${msg.image_url}" class="max-w-full rounded-lg mb-1 shadow-sm" onclick="window.open('${msg.image_url}')">` : ''}
            ${msg.content ? `<div>${msg.content}</div>` : ''}
            <div class="text-[9px] opacity-40 text-right mt-1">${new Date(msg.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
        </div>
    `;
    container.appendChild(div);
}

function scrollToBottom() {
    const container = document.getElementById('chat-messages');
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
}

function setupRoomRealtime() {
    if (window.roomChannel) window.supabaseClient.removeChannel(window.roomChannel);
    window.roomChannel = window.supabaseClient.channel('room_' + window.activeRoomId)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${window.activeRoomId}` }, payload => {
            appendMessageUI(payload.new);
            scrollToBottom();
        }).subscribe();
}

// ==========================================
// 發送訊息 (維持 sender_name 與 message-images)
// ==========================================
window.handleSendAction = async function() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text && !selectedImageFile) return;

    input.value = '';
    let uploadedImageUrl = null;

    if (selectedImageFile) {
        const fileName = `chat/${Date.now()}_${selectedImageFile.name}`;
        try {
            const { data: uploadData, error: uploadError } = await window.supabaseClient.storage
                .from('message-images')
                .upload(fileName, selectedImageFile);
            if (uploadError) throw uploadError;

            const { data: publicUrlData } = window.supabaseClient.storage
                .from('message-images').getPublicUrl(fileName);
            uploadedImageUrl = publicUrlData.publicUrl;
        } catch (err) {
            alert("圖片上傳失敗，請確認 Storage 名稱與權限");
            return;
        }
        cancelImageSelection();
    }

    await window.supabaseClient.from('messages').insert([{
        room_id: window.activeRoomId, 
        sender_name: myChatName,
        receiver: window.activeRoomId.startsWith('GROUP_') ? 'GROUP' : window.activeChatTarget,
        content: text || null,
        image_url: uploadedImageUrl
    }]);
};

// ==========================================
// 刪除對話與輔助功能
// ==========================================
window.deleteChat = async function(roomId, targetUser, isGroup) {
    if (!confirm("確定要刪除此聊天室嗎？這將清空資料庫紀錄並從列表中移除。")) return;
    try {
        // 從資料庫刪除訊息
        await window.supabaseClient.from('messages').delete().eq('room_id', roomId);
        
        // 從本地清單中移除，避免空殼依然出現
        if (isGroup) {
            let groups = getGroups().filter(g => g !== targetUser);
            localStorage.setItem('myGroups', JSON.stringify(groups));
        } else {
            let friends = getFriends().filter(f => f !== targetUser);
            localStorage.setItem('myFriends', JSON.stringify(friends));
        }
        
        renderMessages();
    } catch (err) {
        alert("刪除失敗：" + err.message);
    }
};

window.handleImageSelection = function(input) {
    const file = input.files[0];
    if (!file) return;
    selectedImageFile = file;
    const reader = new FileReader();
    reader.onload = e => {
        const preview = document.getElementById('chat-image-preview');
        const container = document.getElementById('chat-image-preview-container');
        if (preview && container) {
            preview.src = e.target.result;
            container.classList.replace('hidden', 'flex');
        }
    };
    reader.readAsDataURL(file);
};

window.cancelImageSelection = function() {
    selectedImageFile = null;
    document.getElementById('chat-image-input').value = '';
    const container = document.getElementById('chat-image-preview-container');
    if(container) container.classList.replace('flex', 'hidden');
};

window.closeChat = function() {
    document.getElementById('chat-modal').classList.add('translate-x-full');
    if (window.roomChannel) window.supabaseClient.removeChannel(window.roomChannel);
    setTimeout(() => {
        document.getElementById('chat-modal').classList.add('hidden');
        renderMessages(); // 回到列表刷新最新狀態
    }, 300);
};

// 初始化載入
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(renderMessages, 500);
});
