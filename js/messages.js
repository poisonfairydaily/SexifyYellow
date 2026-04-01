// ==========================================
// js/messages.js - 穩定閉環版 (修復無法開啟聊天室、新訊息置底、群組功能)
// ==========================================

window.activeRoomId = null;
window.activeChatTarget = null;
window.roomChannel = null;     
window.globalChannel = null;   
let selectedImageFile = null;

// 1. 初始化使用者與全局 UI
let myChatName = localStorage.getItem('myChatName');
if (!myChatName) {
    let name = prompt("【私密聊天室】請輸入你的專屬帳號：", "User_" + Math.floor(Math.random() * 10000));
    localStorage.setItem('myChatName', name || "神秘使用者");
    myChatName = localStorage.getItem('myChatName');
}

// 注入通知與未讀紅點 CSS
document.head.insertAdjacentHTML('beforeend', `
<style>
    .toast-enter { animation: slideDownFade 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
    .toast-leave { animation: slideUpFade 0.3s ease-in forwards; }
    @keyframes slideDownFade { from { transform: translateY(-100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    @keyframes slideUpFade { from { transform: translateY(0); opacity: 1; } to { transform: translateY(-100%); opacity: 0; } }
    .unread-badge { background: #ff2442; color: white; border-radius: 99px; min-width: 18px; height: 18px; font-size: 10px; display: flex; align-items: center; justify-content: center; padding: 0 4px; border: 2px solid white; font-weight: bold; }
    #chat-messages { scroll-behavior: smooth; }
</style>
`);

if(!document.getElementById('global-toast-container')){
    document.body.insertAdjacentHTML('beforeend', `<div id="global-toast-container" class="fixed top-4 left-0 w-full px-4 z-[9999] pointer-events-none flex flex-col gap-2"></div>`);
}

// 產生唯一的 1對1 房間 ID
function generateRoomId(user1, user2) {
    return [user1, user2].sort().join('_');
}

// ==========================================
// 核心數據管理 (好友、群組、未讀紀錄)
// ==========================================
function getFriends() { return JSON.parse(localStorage.getItem('myFriends')) || []; }
function getGroups() { return JSON.parse(localStorage.getItem('myGroups')) || []; }
function getLastRead(rid) { return parseInt(localStorage.getItem(`lastRead_${rid}`) || '0'); }
function setLastRead(rid) { localStorage.setItem(`lastRead_${rid}`, Date.now().toString()); }

// 加入好友
window.addFriend = function() {
    const friendName = prompt("請輸入你想添加的好友帳號：");
    if (!friendName || friendName.trim() === "") return;
    if (friendName.trim() === myChatName) return alert("不能添加自己為好友！");
    
    let friends = getFriends();
    if (!friends.includes(friendName.trim())) {
        friends.push(friendName.trim());
        localStorage.setItem('myFriends', JSON.stringify(friends));
        alert(`🎉 成功添加 ${friendName.trim()} 為好友！`);
        renderMessages(); 
    }
}

// 加入或建立群組 (輸入相同名字就會進入同一個群組)
window.joinGroup = function() {
    const groupName = prompt("請輸入【群組名稱】(輸入相同名稱即可進入同一群組)：");
    if (!groupName || groupName.trim() === "") return;
    
    const cleanName = groupName.trim();
    const gId = "GROUP_" + cleanName;
    
    let groups = getGroups();
    // 檢查是否已在名單中
    if (!groups.find(g => g.id === gId)) {
        groups.push({ id: gId, name: cleanName });
        localStorage.setItem('myGroups', JSON.stringify(groups));
    }
    // 直接開啟群組
    openChat(cleanName, gId);
}

// ==========================================
// 渲染收件匣 (穩定抓取、顯示最新預覽與紅點)
// ==========================================
window.renderMessages = async function() {
    const container = document.getElementById('messages-list');
    if (!container) return;

    container.innerHTML = `<div class="text-center py-10"><i class="fa-solid fa-circle-notch fa-spin text-sexify text-2xl"></i><p class="mt-2 text-gray-400 text-sm">載入收件匣中...</p></div>`;

    try {
        // 1. 抓取個人的 1對1 訊息 (使用穩定的 eq)
        const { data: inboxData, error } = await window.supabaseClient
            .from('messages')
            .select('*')
            .or(`sender_name.eq.${myChatName},receiver.eq.${myChatName}`)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // 2. 獨立抓取已加入的群組訊息 (避開手機可能阻擋的 ilike 語法)
        let groupData = [];
        const myGroups = getGroups();
        if (myGroups.length > 0) {
            const groupIds = myGroups.map(g => g.id);
            const { data: gData } = await window.supabaseClient
                .from('messages')
                .select('*')
                .in('room_id', groupIds)
                .order('created_at', { ascending: false });
            if (gData) groupData = gData;
        }

        // 合併所有訊息
        const allData = [...(inboxData || []), ...groupData];
        let roomsMap = {};

        // 優先將好友清單放入 (確保 0 訊息也能顯示)
        getFriends().forEach(f => {
            const rid = generateRoomId(myChatName, f);
            roomsMap[rid] = { roomId: rid, target: f, lastMsg: '點擊開始對話', time: '', ts: 0, count: 0, isGroup: false };
        });

        // 優先將群組清單放入
        myGroups.forEach(g => {
            roomsMap[g.id] = { roomId: g.id, target: g.name, lastMsg: '進入群組大廳', time: '', ts: 0, count: 0, isGroup: true };
        });

        // 處理所有歷史訊息，抓出「最新一則」與「未讀數量」
        allData.forEach(msg => {
            const isGroup = msg.room_id.startsWith('GROUP_');
            
            if (!roomsMap[msg.room_id]) {
                const targetUser = isGroup ? msg.room_id.replace('GROUP_', '') : (msg.sender_name === myChatName ? msg.receiver : msg.sender_name);
                roomsMap[msg.room_id] = { roomId: msg.room_id, target: targetUser, lastMsg: '', time: '', ts: 0, count: 0, isGroup: isGroup };
            }

            const room = roomsMap[msg.room_id];
            const msgTime = new Date(msg.created_at).getTime();

            // 如果是別人發的，且時間大於我最後一次閱讀的時間，未讀數 +1
            if (msg.sender_name !== myChatName && msgTime > getLastRead(msg.room_id)) {
                room.count++;
            }

            // 更新預覽畫面為最新一則訊息
            if (msgTime > room.ts) {
                room.ts = msgTime;
                room.time = new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                room.lastMsg = msg.image_url ? '🖼️ 傳送了一張圖片' : (msg.content || '傳送了訊息');
            }
        });

        // 依據最後對話時間排序
        let inboxArray = Object.values(roomsMap).sort((a, b) => b.ts - a.ts);

        let html = `
            <div class="p-4 bg-white border-b border-gray-100 sticky top-0 z-10 flex justify-between items-center">
                <h2 class="font-black text-xl text-gray-800">${myChatName}</h2>
                <div class="flex gap-2">
                    <button onclick="joinGroup()" class="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center text-gray-800 active:scale-90 transition" title="群組">
                        <i class="fa-solid fa-users"></i>
                    </button>
                    <button onclick="addFriend()" class="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center text-gray-800 active:scale-90 transition" title="加好友">
                        <i class="fa-solid fa-user-plus"></i>
                    </button>
                </div>
            </div>
        `;

        if (inboxArray.length === 0) {
            html += `<div class="text-center text-gray-400 py-20"><p>目前沒有訊息，點擊上方按鈕開始！</p></div>`;
        } else {
            html += `<div class="pb-20">` + inboxArray.map(chat => `
                <div class="flex items-center gap-4 p-4 transition border-b border-gray-50 cursor-pointer" onclick="openChat('${chat.target}', '${chat.roomId}')">
                    <div class="relative">
                        <img src="https://i.pravatar.cc/150?u=${chat.target}" class="w-14 h-14 rounded-full border border-gray-100">
                        ${chat.count > 0 ? `<div class="absolute -top-1 -right-1 unread-badge">${chat.count}</div>` : ''}
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex justify-between items-center">
                            <h3 class="font-bold text-gray-900 truncate">${chat.isGroup ? '👥 ' : ''}${chat.target}</h3>
                            <span class="text-[10px] text-gray-400">${chat.time}</span>
                        </div>
                        <p class="text-sm truncate ${chat.count > 0 ? 'text-gray-900 font-bold' : 'text-gray-500'}">${chat.lastMsg}</p>
                    </div>
                </div>
            `).join('') + `</div>`;
        }
        container.innerHTML = html;
    } catch (err) {
        console.error("連線錯誤:", err);
        container.innerHTML = `<div class="text-center text-red-400 py-10">連線失敗，請重新整理頁面</div>`;
    }
};

// ==========================================
// 全局推播通知 (維持不變)
// ==========================================
function setupGlobalRealtime() {
    if (window.globalChannel) return;
    window.globalChannel = window.supabaseClient.channel('global_notifications')
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `receiver=eq.${myChatName}`
        }, payload => {
            const msg = payload.new;
            if (window.activeRoomId === msg.room_id) return; 
            showToastNotification(msg.sender_name, msg.content || '傳送了圖片', `https://i.pravatar.cc/150?u=${msg.sender_name}`);
            renderMessages();
        }).subscribe();
}

function showToastNotification(sender, text, avatar) {
    const container = document.getElementById('global-toast-container');
    const toast = document.createElement('div');
    toast.className = `toast-enter pointer-events-auto w-full max-w-sm mx-auto bg-white shadow-xl rounded-2xl p-4 flex items-center gap-3 border border-gray-100 cursor-pointer`;
    toast.innerHTML = `
        <img src="${avatar}" class="w-10 h-10 rounded-full">
        <div class="flex-1 min-w-0"><p class="text-sm font-bold">${sender}</p><p class="text-sm text-gray-500 truncate">${text}</p></div>
    `;
    toast.onclick = () => { toast.remove(); openChat(sender, null); };
    container.appendChild(toast);
    setTimeout(() => { toast.classList.replace('toast-enter', 'toast-leave'); setTimeout(() => toast.remove(), 300); }, 4000);
}

// ==========================================
// 聊天室內部邏輯 (修正為安全開啟與新訊息置底)
// ==========================================
window.openChat = async function(targetName, optionalRoomId = null) {
    window.activeChatTarget = targetName;
    window.activeRoomId = optionalRoomId || generateRoomId(myChatName, targetName);

    const modal = document.getElementById('chat-modal');
    const chatMessages = document.getElementById('chat-messages');

    // 安全寫法：先確保有抓到標題欄位才修改，避免 null 錯誤導致無法開啟
    const titleElement = document.querySelector('#chat-modal h2') || document.querySelector('#chat-modal .chat-title');
    if (titleElement) {
        titleElement.innerText = window.activeRoomId.startsWith('GROUP_') ? `👥 ${targetName}` : targetName;
    }

    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.remove('translate-x-full'), 10);
    chatMessages.innerHTML = `<div class="text-center py-10 text-gray-400">載入中...</div>`;

    try {
        // 🔥 重要修正：加入 ascending: true 確保舊訊息在上面，新訊息在最下面
        const { data, error } = await window.supabaseClient.from('messages')
            .select('*').eq('room_id', window.activeRoomId).order('created_at', { ascending: true });
            
        if (error) throw error;
        
        chatMessages.innerHTML = '';
        if (data && data.length > 0) {
            drawMessages(data);
        } else {
            chatMessages.innerHTML = `<div class="text-center py-20 text-gray-300 text-sm">你們可以開始聊天了！</div>`;
        }
        
        scrollToBottom();
        setupRoomRealtime();
        setLastRead(window.activeRoomId); // 進入聊天室即代表已讀
        
    } catch (err) { 
        console.error(err); 
        chatMessages.innerHTML = `<div class="text-center py-10 text-red-400">讀取失敗</div>`;
    }
};

function drawMessages(messages) {
    const container = document.getElementById('chat-messages');
    container.innerHTML = messages.map(msg => createMessageHTML(msg)).join('');
}

function createMessageHTML(msg) {
    const isMe = msg.sender_name === myChatName;
    const isGroup = window.activeRoomId.startsWith('GROUP_');
    const align = isMe ? 'justify-end' : 'justify-start';
    const bg = isMe ? 'bg-[#ff2442] text-white' : 'bg-gray-100 text-gray-900';
    
    return `
        <div class="flex ${align} mb-4">
            <div class="${bg} px-4 py-2 rounded-2xl shadow-sm max-w-[75%]">
                ${!isMe && isGroup ? `<p class="text-[10px] font-bold opacity-60 mb-1">${msg.sender_name}</p>` : ''}
                ${msg.image_url ? `<img src="${msg.image_url}" class="max-w-full rounded-lg mb-1">` : ''}
                ${msg.content || ''}
            </div>
        </div>
    `;
}

function scrollToBottom() {
    const container = document.getElementById('chat-messages');
    if (container) container.scrollTop = container.scrollHeight;
}

function setupRoomRealtime() {
    if (window.roomChannel) window.supabaseClient.removeChannel(window.roomChannel);
    window.roomChannel = window.supabaseClient.channel('room_' + window.activeRoomId)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${window.activeRoomId}` }, payload => {
            const container = document.getElementById('chat-messages');
            // 清除預設文字
            if (container.innerHTML.includes('可以開始聊天')) container.innerHTML = '';
            
            const msgDiv = document.createElement('div');
            msgDiv.innerHTML = createMessageHTML(payload.new);
            container.appendChild(msgDiv.firstElementChild); // 直接插入最新訊息到底部
            
            scrollToBottom();
            setLastRead(window.activeRoomId); // 保持已讀狀態
        }).subscribe();
}

// ==========================================
// 發送動作 (維持 sender_name 與 message-images)
// ==========================================
window.handleSendAction = async function() {
    const input = document.getElementById('chat-input');
    const text = input.value;
    if (!text.trim() && !selectedImageFile) return;

    input.value = '';
    let uploadedImageUrl = null;

    if (selectedImageFile) {
        const fileName = `${Date.now()}_${selectedImageFile.name}`;
        try {
            const { error: uploadError } = await window.supabaseClient.storage
                .from('message-images') // 絕對維持你的名稱
                .upload(fileName, selectedImageFile);
            if (uploadError) throw uploadError;

            const { data: publicUrlData } = window.supabaseClient.storage
                .from('message-images')
                .getPublicUrl(fileName);
            uploadedImageUrl = publicUrlData.publicUrl;
        } catch (err) {
            alert("圖片上傳失敗，請確認網路連線或 Storage 權限");
            return;
        }
        cancelImageSelection();
    }

    await window.supabaseClient.from('messages').insert([{
        room_id: window.activeRoomId, 
        sender_name: myChatName, // 絕對維持你的名稱
        receiver: window.activeRoomId.startsWith('GROUP_') ? 'GROUP' : window.activeChatTarget,
        content: text.trim() || null,
        image_url: uploadedImageUrl
    }]);
};

// ==========================================
// 輔助功能
// ==========================================
window.handleImageSelection = function(input) {
    const file = input.files[0];
    if (!file) return;
    selectedImageFile = file;
    const reader = new FileReader();
    reader.onload = e => {
        document.getElementById('chat-image-preview').src = e.target.result;
        document.getElementById('chat-image-preview-container').classList.remove('hidden');
        document.getElementById('chat-image-preview-container').classList.add('flex');
    };
    reader.readAsDataURL(file);
};

window.cancelImageSelection = function() {
    selectedImageFile = null;
    document.getElementById('chat-image-input').value = '';
    document.getElementById('chat-image-preview-container').classList.remove('flex');
    document.getElementById('chat-image-preview-container').classList.add('hidden');
};

window.closeChat = function() {
    document.getElementById('chat-modal').classList.add('translate-x-full');
    if (window.roomChannel) {
        window.supabaseClient.removeChannel(window.roomChannel);
        window.roomChannel = null;
    }
    setTimeout(() => {
        document.getElementById('chat-modal').classList.add('hidden');
        renderMessages(); // 關閉聊天室時重新整理列表，更新預覽與紅點
    }, 300);
};

// 初始化啟動
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        setupGlobalRealtime();
        renderMessages();
    }, 500);
});
