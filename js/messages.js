// ==========================================
// js/messages.js - 終極修正版 (強化手機端相容性與錯誤偵測)
// ==========================================

window.activeRoomId = null;
window.activeChatTarget = null;
window.roomChannel = null;
let selectedImageFile = null;

// 初始化使用者
let myChatName = localStorage.getItem('myChatName');
if (!myChatName) {
    let name = prompt("【Sexify】請輸入你的專屬帳號：", "User_" + Math.floor(Math.random() * 10000));
    myChatName = name ? name.trim() : "神秘使用者";
    localStorage.setItem('myChatName', myChatName);
}

// 注入 UI 樣式
document.head.insertAdjacentHTML('beforeend', `
<style>
    .unread-badge { background: #ff2442; color: white; border-radius: 99px; min-width: 18px; height: 18px; font-size: 10px; display: flex; align-items: center; justify-content: center; padding: 0 4px; border: 2px solid white; }
    .chat-bubble { max-width: 78%; padding: 10px 14px; border-radius: 18px; margin-bottom: 8px; font-size: 14px; word-break: break-all; }
    .bubble-me { background: #ff2442; color: white; border-bottom-right-radius: 4px; }
    .bubble-other { background: #f1f1f1; color: #1a1a1a; border-bottom-left-radius: 4px; }
    .delete-btn { color: #ddd; transition: all 0.2s; padding: 10px; }
    .delete-btn:hover { color: #ff2442; }
    .msg-preview { color: #999; font-size: 12px; margin-top: 2px; }
</style>
`);

// 工具：生成唯一 ID
function generateRoomId(u1, u2) { return [u1, u2].sort().join('_'); }

// 工具：取得本地清單
function getFriends() { return JSON.parse(localStorage.getItem('myFriends')) || []; }
function getGroups() { return JSON.parse(localStorage.getItem('myGroups')) || []; }

// 1. 新增功能
window.addFriend = function() {
    const name = prompt("請輸入好友帳號：");
    if (!name || name.trim() === "" || name.trim() === myChatName) return;
    let friends = getFriends();
    if (!friends.includes(name.trim())) {
        friends.push(name.trim());
        localStorage.setItem('myFriends', JSON.stringify(friends));
        renderMessages();
    }
};

window.joinOrCreateGroup = function() {
    const groupName = prompt("請輸入大型聊天室名稱：\n(輸入相同名稱即可進入同一空間)");
    if (!groupName || groupName.trim() === "") return;
    const gName = groupName.trim();
    let groups = getGroups();
    if (!groups.includes(gName)) {
        groups.push(gName);
        localStorage.setItem('myGroups', JSON.stringify(groups));
    }
    openChat(gName, "GROUP_" + gName);
};

// 2. 渲染收件匣 (修正手機端載入邏輯)
window.renderMessages = async function() {
    const container = document.getElementById('messages-list');
    if (!container) return;

    container.innerHTML = `<div class="text-center py-10"><i class="fa-solid fa-circle-notch fa-spin text-sexify text-2xl"></i><p class="text-xs text-gray-400 mt-2">連線中...</p></div>`;

    try {
        // 抓取 1對1 與 群組訊息
        const { data: allMsgs, error } = await window.supabaseClient
            .from('messages')
            .select('*')
            .or(`sender_name.eq.${myChatName},receiver.eq.${myChatName},room_id.ilike.GROUP_%`);

        if (error) throw error;

        let roomsMap = {};
        
        // 初始化已知好友與群組 (確保 0 訊息也能開啟)
        getFriends().forEach(f => {
            const rid = generateRoomId(myChatName, f);
            roomsMap[rid] = { id: rid, name: f, last: '點擊開始聊天', time: '', ts: 0, count: 0, isGroup: false };
        });
        getGroups().forEach(g => {
            const rid = "GROUP_" + g;
            roomsMap[rid] = { id: rid, name: g, last: '點擊進入大廳', time: '', ts: 0, count: 0, isGroup: true };
        });

        // 填入最新訊息預覽
        (allMsgs || []).forEach(msg => {
            const isGroup = msg.room_id.startsWith('GROUP_');
            if (isGroup && !getGroups().includes(msg.room_id.replace('GROUP_', ''))) return; // 沒加入的不顯示

            if (!roomsMap[msg.room_id]) {
                const target = isGroup ? msg.room_id.replace('GROUP_', '') : (msg.sender_name === myChatName ? msg.receiver : msg.sender_name);
                roomsMap[msg.room_id] = { id: msg.room_id, name: target, last: '', time: '', ts: 0, count: 0, isGroup: isGroup };
            }

            const room = roomsMap[msg.room_id];
            const msgTs = new Date(msg.created_at).getTime();

            // 計數 (如果是給我的未讀)
            if (msg.receiver === myChatName && msg.sender_name !== myChatName) room.count++;

            if (msgTs > room.ts) {
                room.ts = msgTs;
                room.time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                room.last = msg.image_url ? '🖼️ 圖片訊息' : (msg.content || '');
            }
        });

        const sortedRooms = Object.values(roomsMap).sort((a, b) => b.ts - a.ts);

        let html = `
            <div class="p-4 bg-white/80 backdrop-blur-md sticky top-0 z-10 flex justify-between items-center border-b border-gray-100">
                <h2 class="font-black text-xl">${myChatName}</h2>
                <div class="flex gap-2">
                    <button onclick="joinOrCreateGroup()" class="bg-gray-100 text-[11px] px-3 py-1.5 rounded-full font-bold">＋大廳</button>
                    <button onclick="addFriend()" class="bg-gray-100 text-[11px] px-3 py-1.5 rounded-full font-bold">＋好友</button>
                </div>
            </div>
        `;

        if (sortedRooms.length === 0) {
            html += `<div class="text-center py-20 text-gray-400 text-sm">點擊上方按鈕開始交友</div>`;
        } else {
            html += sortedRooms.map(chat => `
                <div class="flex items-center gap-4 p-4 active:bg-gray-50 cursor-pointer border-b border-gray-50 group" onclick="openChat('${chat.name}', '${chat.id}')">
                    <div class="relative flex-shrink-0">
                        <img src="https://i.pravatar.cc/150?u=${chat.name}" class="w-14 h-14 rounded-full bg-gray-100">
                        ${chat.count > 0 ? `<div class="absolute -top-1 -right-1 unread-badge">${chat.count}</div>` : ''}
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex justify-between items-center">
                            <span class="font-bold text-gray-900 truncate">${chat.isGroup ? '👥 ' : ''}${chat.name}</span>
                            <span class="text-[10px] text-gray-400">${chat.time}</span>
                        </div>
                        <p class="msg-preview truncate">${chat.last}</p>
                    </div>
                    <button onclick="event.stopPropagation(); deleteChat('${chat.id}', '${chat.name}', ${chat.isGroup})" class="delete-btn opacity-0 group-hover:opacity-100 transition">
                        <i class="fa-solid fa-trash-can text-sm"></i>
                    </button>
                </div>
            `).join('');
        }
        container.innerHTML = html;

    } catch (err) {
        container.innerHTML = `
            <div class="p-10 text-center text-red-500">
                <i class="fa-solid fa-triangle-exclamation text-2xl mb-2"></i>
                <p class="font-bold">連線失敗</p>
                <p class="text-[10px] text-gray-400 mt-2">Error: ${err.message || 'Unknown'}</p>
                <button onclick="location.reload()" class="mt-4 text-xs bg-gray-100 px-4 py-2 rounded-lg">重試</button>
            </div>`;
    }
};

// 3. 聊天室核心邏輯 (修正排序與即時通訊)
window.openChat = async function(name, roomId) {
    window.activeChatTarget = name;
    window.activeRoomId = roomId;

    const modal = document.getElementById('chat-modal');
    const msgBox = document.getElementById('chat-messages');
    
    document.querySelector('#chat-modal h2').innerText = roomId.startsWith('GROUP_') ? `👥 ${name}` : name;
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.remove('translate-x-full'), 10);

    msgBox.innerHTML = `<div class="text-center py-20"><i class="fa-solid fa-spinner fa-spin text-gray-200"></i></div>`;

    try {
        const { data, error } = await window.supabaseClient
            .from('messages')
            .select('*')
            .eq('room_id', window.activeRoomId)
            .order('created_at', { ascending: true }); // 由舊到新排序

        if (error) throw error;
        msgBox.innerHTML = '';
        if (data && data.length > 0) {
            data.forEach(m => appendUI(m));
        } else {
            msgBox.innerHTML = `<div class="text-center py-10 text-gray-300 text-xs">打個招呼吧！</div>`;
        }
        scrollToBottom();
        startRealtime();
    } catch (err) {
        msgBox.innerHTML = `<p class="text-center p-10 text-red-400 text-xs">載入失敗: ${err.message}</p>`;
    }
};

function appendUI(msg) {
    const box = document.getElementById('chat-messages');
    const isMe = msg.sender_name === myChatName;
    const div = document.createElement('div');
    div.className = `flex ${isMe ? 'justify-end' : 'justify-start'} w-full`;
    div.innerHTML = `
        <div class="chat-bubble ${isMe ? 'bubble-me' : 'bubble-other'}">
            ${!isMe && window.activeRoomId.startsWith('GROUP_') ? `<p class="text-[10px] font-bold opacity-50 mb-1">${msg.sender_name}</p>` : ''}
            ${msg.image_url ? `<img src="${msg.image_url}" class="max-w-full rounded-lg mb-1 shadow-sm" onclick="window.open('${msg.image_url}')">` : ''}
            ${msg.content ? `<div>${msg.content}</div>` : ''}
            <p class="text-[8px] opacity-40 text-right mt-1">${new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
    `;
    box.appendChild(div);
}

function startRealtime() {
    if (window.roomChannel) window.supabaseClient.removeChannel(window.roomChannel);
    window.roomChannel = window.supabaseClient.channel('live_' + window.activeRoomId)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${window.activeRoomId}` }, payload => {
            if (document.getElementById('chat-messages').innerHTML.includes('打個招呼')) document.getElementById('chat-messages').innerHTML = '';
            appendUI(payload.new);
            scrollToBottom();
        }).subscribe();
}

// 4. 發送動作 (維持 sender_name 與 message-images)
window.handleSendAction = async function() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text && !selectedImageFile) return;

    input.value = '';
    let imgUrl = null;

    if (selectedImageFile) {
        const path = `chat/${Date.now()}_${selectedImageFile.name}`;
        const { error: upErr } = await window.supabaseClient.storage.from('message-images').upload(path, selectedImageFile);
        if (!upErr) {
            const { data: pUrl } = window.supabaseClient.storage.from('message-images').getPublicUrl(path);
            imgUrl = pUrl.publicUrl;
        }
        cancelImageSelection();
    }

    await window.supabaseClient.from('messages').insert([{
        room_id: window.activeRoomId,
        sender_name: myChatName,
        receiver: window.activeRoomId.startsWith('GROUP_') ? 'GROUP' : window.activeChatTarget,
        content: text || null,
        image_url: imgUrl
    }]);
};

// 5. 刪除與關閉
window.deleteChat = async function(rid, name, isGroup) {
    if (!confirm("確定要刪除聊天紀錄並從列表移除嗎？")) return;
    await window.supabaseClient.from('messages').delete().eq('room_id', rid);
    if (isGroup) {
        localStorage.setItem('myGroups', JSON.stringify(getGroups().filter(g => g !== name)));
    } else {
        localStorage.setItem('myFriends', JSON.stringify(getFriends().filter(f => f !== name)));
    }
    renderMessages();
};

window.scrollToBottom = function() {
    const b = document.getElementById('chat-messages');
    b.scrollTo({ top: b.scrollHeight, behavior: 'smooth' });
};

window.closeChat = function() {
    document.getElementById('chat-modal').classList.add('translate-x-full');
    if (window.roomChannel) window.supabaseClient.removeChannel(window.roomChannel);
    setTimeout(() => {
        document.getElementById('chat-modal').classList.add('hidden');
        renderMessages();
    }, 300);
};

// 圖片輔助
window.handleImageSelection = function(input) {
    const file = input.files[0];
    if (!file) return;
    selectedImageFile = file;
    const reader = new FileReader();
    reader.onload = e => {
        document.getElementById('chat-image-preview').src = e.target.result;
        document.getElementById('chat-image-preview-container').classList.replace('hidden', 'flex');
    };
    reader.readAsDataURL(file);
};

window.cancelImageSelection = function() {
    selectedImageFile = null;
    document.getElementById('chat-image-input').value = '';
    document.getElementById('chat-image-preview-container').classList.replace('flex', 'hidden');
};

document.addEventListener('DOMContentLoaded', () => setTimeout(renderMessages, 500));
