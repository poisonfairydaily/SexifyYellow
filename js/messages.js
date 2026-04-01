// ==========================================
// js/messages.js - 終極穩定強化版 (解決手機連線失敗與崩潰問題)
// ==========================================

window.activeRoomId = null;
window.activeChatTarget = null;
window.roomChannel = null;     
window.globalChannel = null;   
let selectedImageFile = null;

// 1. 初始化使用者資訊
let myChatName = localStorage.getItem('myChatName');
if (!myChatName) {
    let name = prompt("請輸入你的帳號名稱：", "User_" + Math.floor(Math.random() * 1000));
    localStorage.setItem('myChatName', name || "Guest");
    myChatName = localStorage.getItem('myChatName');
}

// 2. 注入必要的 CSS (紅點與動畫)
if (!document.getElementById('sexify-chat-css')) {
    const style = document.createElement('style');
    style.id = 'sexify-chat-css';
    style.innerHTML = `
        .unread-badge { background: #ff2442; color: white; border-radius: 99px; min-width: 18px; height: 18px; font-size: 10px; display: flex; align-items: center; justify-content: center; padding: 0 4px; border: 2px solid white; font-weight: bold; position: absolute; -top: 2px; -right: 2px; }
        .msg-container { scroll-behavior: smooth; -webkit-overflow-scrolling: touch; }
    `;
    document.head.appendChild(style);
}

// 工具：本地儲存與 ID 生成
const getFriends = () => JSON.parse(localStorage.getItem('myFriends')) || [];
const getGroups = () => JSON.parse(localStorage.getItem('myGroups')) || [];
const getLastRead = (rid) => parseInt(localStorage.getItem(`lastRead_${rid}`) || '0');
const setLastRead = (rid) => localStorage.setItem(`lastRead_${rid}`, Date.now().toString());

// 3. 好友與群組管理
window.addFriend = function() {
    const f = prompt("請輸入好友帳號：");
    if (!f || f.trim() === "" || f.trim() === myChatName) return;
    let friends = getFriends();
    if (!friends.includes(f.trim())) {
        friends.push(f.trim());
        localStorage.setItem('myFriends', JSON.stringify(friends));
        renderMessages();
    }
};

window.joinGroup = function() {
    const gName = prompt("輸入群組名稱 (相同名稱即為同一群組)：");
    if (!gName || gName.trim() === "") return;
    const gId = "GROUP_" + gName.trim();
    let groups = getGroups();
    if (!groups.find(g => g.id === gId)) {
        groups.push({ id: gId, name: gName.trim() });
        localStorage.setItem('myGroups', JSON.stringify(groups));
    }
    openChat(gName.trim(), gId);
};

// 4. 渲染訊息列表 (包含未讀數與最新預覽)
window.renderMessages = async function() {
    const container = document.getElementById('messages-list');
    if (!container) return;

    container.innerHTML = `<div class="text-center py-10 opacity-50"><i class="fa-solid fa-circle-notch fa-spin"></i></div>`;

    try {
        // 使用最穩定的查詢方式
        const { data: rawMsgs, error } = await window.supabaseClient.from('messages')
            .select('*').or(`sender_name.eq.${myChatName},receiver.eq.${myChatName},receiver.eq.GROUP`)
            .order('created_at', { ascending: false });

        if (error) throw error;

        let rooms = {};
        
        // 初始化已知的好友與群組 (確保沒說過話的也能顯示)
        getFriends().forEach(f => {
            const rid = [myChatName, f].sort().join('_');
            rooms[rid] = { target: f, last: '點擊開始對話', ts: 0, count: 0, isG: false };
        });
        getGroups().forEach(g => {
            rooms[g.id] = { target: g.name, last: '群組大廳', ts: 0, count: 0, isG: true };
        });

        // 整理訊息數據
        (rawMsgs || []).forEach(m => {
            if (!rooms[m.room_id]) {
                const isGroup = m.room_id.startsWith('GROUP_');
                const target = isGroup ? m.room_id.replace('GROUP_', '') : (m.sender_name === myChatName ? m.receiver : m.sender_name);
                rooms[m.room_id] = { target, last: '', ts: 0, count: 0, isG: isGroup };
            }
            const r = rooms[m.room_id];
            const msgTs = new Date(m.created_at).getTime();

            // 計算未讀：非本人發送且晚於上次讀取時間
            if (m.sender_name !== myChatName && msgTs > getLastRead(m.room_id)) {
                r.count++;
            }
            // 更新最新訊息預覽
            if (msgTs > r.ts) {
                r.ts = msgTs;
                r.last = m.image_url ? '🖼️ 傳送了圖片' : (m.content || '');
            }
        });

        const sortedRooms = Object.keys(rooms).map(id => ({ id, ...rooms[id] })).sort((a, b) => b.ts - a.ts);

        let html = `
            <div class="p-4 bg-white border-b sticky top-0 z-10 flex justify-between items-center">
                <span class="font-black text-xl">${myChatName}</span>
                <div class="flex gap-2">
                    <button onclick="joinGroup()" class="w-9 h-9 bg-gray-50 rounded-full flex items-center justify-center"><i class="fa-solid fa-users text-sm"></i></button>
                    <button onclick="addFriend()" class="w-9 h-9 bg-gray-50 rounded-full flex items-center justify-center"><i class="fa-solid fa-user-plus text-sm"></i></button>
                </div>
            </div>
        `;

        html += sortedRooms.map(room => `
            <div class="flex items-center gap-4 p-4 border-b border-gray-50 active:bg-gray-50 cursor-pointer" onclick="openChat('${room.target}', '${room.id}')">
                <div class="relative flex-shrink-0">
                    <img src="https://i.pravatar.cc/100?u=${room.target}" class="w-14 h-14 rounded-full border">
                    ${room.count > 0 ? `<div class="unread-badge">${room.count}</div>` : ''}
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex justify-between items-center">
                        <span class="font-bold text-gray-900 truncate">${room.isG ? '👥 ' : ''}${room.target}</span>
                    </div>
                    <p class="text-sm ${room.count > 0 ? 'text-gray-900 font-bold' : 'text-gray-400'} truncate">${room.last}</p>
                </div>
            </div>
        `).join('');

        container.innerHTML = html;
    } catch (err) {
        console.error("List Error:", err);
        container.innerHTML = `<div class="p-10 text-center text-gray-400">連線暫時不穩定，請重新整理</div>`;
    }
};

// 5. 進入聊天室 (修正：新訊息從底部向上排列)
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
        // 正確排序：ascending: true 代表舊的在上面，新的在下面
        const { data, error } = await window.supabaseClient.from('messages')
            .select('*').eq('room_id', window.activeRoomId).order('created_at', { ascending: true });

        if (error) throw error;

        msgBox.innerHTML = '';
        if (data && data.length > 0) {
            data.forEach(m => appendMessageUI(m));
        } else {
            msgBox.innerHTML = `<div class="py-20 text-center text-gray-300 text-sm">沒有對話紀錄</div>`;
        }

        scrollToBottom();
        setLastRead(window.activeRoomId); // 設為已讀
        listenThisRoom(); // 開啟即時監聽
    } catch (err) {
        msgBox.innerHTML = `<div class="p-10 text-center text-red-400">載入失敗</div>`;
    }
};

function appendMessageUI(m) {
    const box = document.getElementById('chat-messages');
    if (!box) return;
    const isMe = m.sender_name === myChatName;
    const align = isMe ? 'justify-end' : 'justify-start';
    const bg = isMe ? 'bg-[#ff2442] text-white' : 'bg-gray-100 text-gray-800';
    
    const div = document.createElement('div');
    div.className = `flex ${align} mb-4 px-4`;
    div.innerHTML = `
        <div class="${bg} px-4 py-2 rounded-2xl shadow-sm max-w-[80%]">
            ${!isMe && window.activeRoomId.startsWith('GROUP_') ? `<p class="text-[10px] font-bold opacity-50 mb-1">${m.sender_name}</p>` : ''}
            ${m.image_url ? `<img src="${m.image_url}" class="rounded-lg mb-1 max-w-full" onclick="window.open('${m.image_url}')">` : ''}
            ${m.content ? `<p class="text-sm">${m.content}</p>` : ''}
        </div>
    `;
    box.appendChild(div);
}

function listenThisRoom() {
    if (window.roomChannel) window.supabaseClient.removeChannel(window.roomChannel);
    window.roomChannel = window.supabaseClient.channel('room_' + window.activeRoomId)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${window.activeRoomId}` }, payload => {
            const msgBox = document.getElementById('chat-messages');
            if (msgBox.innerHTML.includes('沒有對話紀錄')) msgBox.innerHTML = '';
            appendMessageUI(payload.new);
            scrollToBottom();
            setLastRead(window.activeRoomId);
        }).subscribe();
}

// 6. 發送訊息 (支援圖片與文字)
window.handleSendAction = async function() {
    const input = document.getElementById('chat-input');
    const content = input.value.trim();
    if (!content && !selectedImageFile) return;

    input.value = ''; // 立即清空輸入框提升體驗
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
        renderMessages(); // 返回列表時重新整理，清除紅點
    }, 300);
};

// 全局監聽 (為了列表紅點即時更新)
function setupGlobalListen() {
    if (window.globalChannel) return;
    window.globalChannel = window.supabaseClient.channel('global_notif')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
            const m = payload.new;
            // 如果我不是發送者，且我不在該房間內，就刷列表顯示紅點
            if (m.sender_name !== myChatName && window.activeRoomId !== m.room_id) {
                renderMessages();
            }
        }).subscribe();
}

// 7. 啟動
document.addEventListener('DOMContentLoaded', () => {
    // 稍微延遲確保 Supabase 已載入
    setTimeout(() => {
        renderMessages();
        setupGlobalListen();
    }, 500);
});
