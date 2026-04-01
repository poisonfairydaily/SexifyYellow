// ==========================================
// js/messages.js - 終極穩定強化版 (專門修正手機連線問題)
// ==========================================

window.activeRoomId = null;
window.activeChatTarget = null;
window.roomChannel = null;     
window.globalChannel = null;   
let selectedImageFile = null;

// 1. 初始化使用者與樣式 (新增紅點 CSS)
let myChatName = localStorage.getItem('myChatName');
if (!myChatName) {
    let name = prompt("請輸入帳號：", "User_" + Math.floor(Math.random() * 1000));
    localStorage.setItem('myChatName', name || "新用戶");
    myChatName = localStorage.getItem('myChatName');
}

// 注入 UI 修正
const styleId = 'sexify-fix-style';
if (!document.getElementById(styleId)) {
    document.head.insertAdjacentHTML('beforeend', `
    <style id="${styleId}">
        .unread-badge { background: #ff2442; color: white; border-radius: 50%; min-width: 18px; height: 18px; font-size: 10px; display: flex; align-items: center; justify-content: center; padding: 0 4px; border: 2px solid white; font-weight: bold; }
        .msg-list-item:active { background-color: #f9f9f9; }
        #chat-messages { display: flex; flex-direction: column; }
    </style>
    `);
}

// 功能函式
const getFriends = () => JSON.parse(localStorage.getItem('myFriends')) || [];
const getGroups = () => JSON.parse(localStorage.getItem('myGroups')) || [];
const getLastRead = (rid) => parseInt(localStorage.getItem(`lastRead_${rid}`) || '0');
const setLastRead = (rid) => localStorage.setItem(`lastRead_${rid}`, Date.now().toString());

// ==========================================
// 核心管理：添加好友與群組
// ==========================================
window.addFriend = function() {
    const f = prompt("輸入好友 ID：");
    if (!f || f.trim() === "" || f.trim() === myChatName) return;
    let friends = getFriends();
    if (!friends.includes(f.trim())) {
        friends.push(f.trim());
        localStorage.setItem('myFriends', JSON.stringify(friends));
        renderMessages();
    }
};

window.joinGroup = function() {
    const gName = prompt("輸入群組名稱 (相同名稱即為同一群)：");
    if (!gName || gName.trim() === "") return;
    const gId = "GROUP_" + gName.trim();
    let groups = getGroups();
    if (!groups.find(g => g.id === gId)) {
        groups.push({ id: gId, name: gName.trim() });
        localStorage.setItem('myGroups', JSON.stringify(groups));
    }
    openChat(gName.trim(), gId);
};

// ==========================================
// 渲染訊息列表 (修正：增加未讀數、最新預覽)
// ==========================================
window.renderMessages = async function() {
    const container = document.getElementById('messages-list');
    if (!container) return;

    container.innerHTML = `<div class="text-center py-10 opacity-30"><i class="fa-solid fa-spinner fa-spin"></i></div>`;

    try {
        // 使用最基礎的查詢以確保手機不崩潰
        const { data: messages, error } = await window.supabaseClient.from('messages')
            .select('*')
            .or(`sender_name.eq.${myChatName},receiver.eq.${myChatName},receiver.eq.GROUP`)
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) throw error;

        let rooms = {};
        // 先載入好友清單
        getFriends().forEach(f => {
            const rid = [myChatName, f].sort().join('_');
            rooms[rid] = { target: f, last: '點擊開始對話', ts: 0, count: 0, isG: false };
        });
        // 先載入群組清單
        getGroups().forEach(g => {
            rooms[g.id] = { target: g.name, last: '群組大廳', ts: 0, count: 0, isG: true };
        });

        // 整理最新訊息與未讀
        (messages || []).forEach(m => {
            if (!rooms[m.room_id]) {
                const isG = m.room_id.startsWith('GROUP_');
                const target = isG ? m.room_id.replace('GROUP_', '') : (m.sender_name === myChatName ? m.receiver : m.sender_name);
                rooms[m.room_id] = { target, last: '', ts: 0, count: 0, isG: isG };
            }
            const r = rooms[m.room_id];
            const msgTs = new Date(m.created_at).getTime();

            if (m.sender_name !== myChatName && msgTs > getLastRead(m.room_id)) r.count++;
            if (msgTs > r.ts) {
                r.ts = msgTs;
                r.last = m.image_url ? '🖼️ 傳送了圖片' : (m.content || '');
            }
        });

        const sortedRooms = Object.keys(rooms).map(id => ({ id, ...rooms[id] })).sort((a, b) => b.ts - a.ts);

        let html = `
            <div class="p-4 bg-white border-b flex justify-between items-center sticky top-0 z-10">
                <span class="font-black text-xl">${myChatName}</span>
                <div class="flex gap-2">
                    <button onclick="joinGroup()" class="w-9 h-9 bg-gray-50 rounded-full flex items-center justify-center"><i class="fa-solid fa-users text-sm"></i></button>
                    <button onclick="addFriend()" class="w-9 h-9 bg-gray-50 rounded-full flex items-center justify-center"><i class="fa-solid fa-user-plus text-sm"></i></button>
                </div>
            </div>
        `;

        html += sortedRooms.map(room => `
            <div class="flex items-center gap-4 p-4 border-b border-gray-50 msg-list-item cursor-pointer" onclick="openChat('${room.target}', '${room.id}')">
                <div class="relative flex-shrink-0">
                    <img src="https://i.pravatar.cc/100?u=${room.target}" class="w-14 h-14 rounded-full border">
                    ${room.count > 0 ? `<div class="absolute -top-1 -right-1 unread-badge">${room.count}</div>` : ''}
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex justify-between items-center">
                        <span class="font-bold text-gray-900 truncate">${room.isG ? '👥 ' : ''}${room.target}</span>
                    </div>
                    <p class="text-sm truncate ${room.count > 0 ? 'text-gray-900 font-bold' : 'text-gray-400'}">${room.last}</p>
                </div>
            </div>
        `).join('');

        container.innerHTML = html;
    } catch (err) {
        container.innerHTML = `<div class="p-10 text-center text-gray-400">連線失敗，請檢查網路或重新整理</div>`;
    }
};

// ==========================================
// 進入聊天室 (修正：新訊息在最下方)
// ==========================================
window.openChat = async function(name, roomId) {
    window.activeChatTarget = name;
    window.activeRoomId = roomId || [myChatName, name].sort().join('_');

    const modal = document.getElementById('chat-modal');
    if (!modal) return;

    // 安全更新標題
    const titleHeader = modal.querySelector('h2') || modal.querySelector('.chat-title');
    if (titleHeader) titleHeader.innerText = name;

    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.remove('translate-x-full'), 10);

    const msgBox = document.getElementById('chat-messages');
    msgBox.innerHTML = `<div class="py-20 text-center opacity-30"><i class="fa-solid fa-spinner fa-spin"></i></div>`;

    try {
        // 🔥 重要修正：ascending: true 讓新訊息在下面
        const { data, error } = await window.supabaseClient.from('messages')
            .select('*').eq('room_id', window.activeRoomId).order('created_at', { ascending: true });

        if (error) throw error;

        msgBox.innerHTML = '';
        if (data && data.length > 0) {
            data.forEach(m => appendMessageToUI(m));
        } else {
            msgBox.innerHTML = `<div class="py-20 text-center text-gray-300 text-sm">開始對話吧！</div>`;
        }

        scrollToBottom();
        setLastRead(window.activeRoomId); // 標記為已讀
        startRealtime(); // 開啟監聽
    } catch (err) {
        msgBox.innerHTML = `<div class="p-10 text-center text-red-400">無法開啟對話</div>`;
    }
};

function appendMessageToUI(m) {
    const box = document.getElementById('chat-messages');
    if (!box) return;
    const isMe = m.sender_name === myChatName;
    const isG = window.activeRoomId.startsWith('GROUP_');
    
    const div = document.createElement('div');
    div.className = `flex ${isMe ? 'justify-end' : 'justify-start'} mb-4 px-4`;
    div.innerHTML = `
        <div class="${isMe ? 'bg-[#ff2442] text-white' : 'bg-gray-100 text-gray-800'} px-4 py-2 rounded-2xl shadow-sm max-w-[80%]">
            ${!isMe && isG ? `<p class="text-[9px] font-bold opacity-50 mb-1">${m.sender_name}</p>` : ''}
            ${m.image_url ? `<img src="${m.image_url}" class="rounded-lg mb-1 max-w-full" onclick="window.open('${m.image_url}')">` : ''}
            <p class="text-sm">${m.content || ''}</p>
        </div>
    `;
    box.appendChild(div);
}

function startRealtime() {
    if (window.roomChannel) window.supabaseClient.removeChannel(window.roomChannel);
    window.roomChannel = window.supabaseClient.channel('room_' + window.activeRoomId)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${window.activeRoomId}` }, payload => {
            const msgBox = document.getElementById('chat-messages');
            if (msgBox.innerHTML.includes('開始對話')) msgBox.innerHTML = '';
            appendMessageToUI(payload.new);
            scrollToBottom();
            setLastRead(window.activeRoomId);
        }).subscribe();
}

// ==========================================
// 發送功能 (維持 sender_name 與 message-images)
// ==========================================
window.handleSendAction = async function() {
    const input = document.getElementById('chat-input');
    const content = input.value.trim();
    if (!content && !selectedImageFile) return;

    input.value = ''; // 先清空，提升速度感
    let imgUrl = null;

    if (selectedImageFile) {
        const path = `${Date.now()}_${selectedImageFile.name}`;
        const { data, error } = await window.supabaseClient.storage.from('message-images').upload(path, selectedImageFile);
        if (!error) {
            const { data: pUrl } = window.supabaseClient.storage.from('message-images').getPublicUrl(path);
            imgUrl = pUrl.publicUrl;
        }
        cancelImageSelection();
    }

    await window.supabaseClient.from('messages').insert([{
        room_id: window.activeRoomId,
        sender_name: myChatName,
        receiver: window.activeRoomId.startsWith('GROUP_') ? 'GROUP' : window.activeChatTarget,
        content: content || null,
        image_url: imgUrl
    }]);
};

// 輔助功能
window.scrollToBottom = function() {
    const b = document.getElementById('chat-messages');
    if (b) b.scrollTop = b.scrollHeight;
};

window.handleImageSelection = function(input) {
    const file = input.files[0];
    if (!file) return;
    selectedImageFile = file;
    const reader = new FileReader();
    reader.onload = e => {
        const prev = document.getElementById('chat-image-preview');
        const cont = document.getElementById('chat-image-preview-container');
        if (prev) prev.src = e.target.result;
        if (cont) { cont.classList.remove('hidden'); cont.classList.add('flex'); }
    };
    reader.readAsDataURL(file);
};

window.cancelImageSelection = function() {
    selectedImageFile = null;
    const input = document.getElementById('chat-image-input');
    const cont = document.getElementById('chat-image-preview-container');
    if (input) input.value = '';
    if (cont) { cont.classList.remove('flex'); cont.classList.add('hidden'); }
};

window.closeChat = function() {
    const modal = document.getElementById('chat-modal');
    if (modal) modal.classList.add('translate-x-full');
    if (window.roomChannel) window.supabaseClient.removeChannel(window.roomChannel);
    setTimeout(() => {
        if (modal) modal.classList.add('hidden');
        renderMessages(); // 關閉後刷列表，清除紅點數字
    }, 300);
};

// 初始化啟動 (增加延遲以應對手機端加載)
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        renderMessages();
        // 全局通知監聽 (為了列表即時紅點)
        window.supabaseClient.channel('global_updates')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
                if (payload.new.room_id !== window.activeRoomId) renderMessages();
            }).subscribe();
    }, 800);
});
