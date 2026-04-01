// ==========================================
// js/messages.js - 終極功能補完版 (維持穩定連線邏輯)
// ==========================================

window.activeRoomId = null;
window.activeChatTarget = null;
window.roomChannel = null;     
window.globalChannel = null;   
let selectedImageFile = null;

// 1. 初始化使用者與樣式
let myChatName = localStorage.getItem('myChatName');
if (!myChatName) {
    let name = prompt("【Sexify】請輸入你的專屬帳號：", "User_" + Math.floor(Math.random() * 10000));
    localStorage.setItem('myChatName', name || "神秘使用者");
    myChatName = localStorage.getItem('myChatName');
}

// 注入紅點與通知 CSS
document.head.insertAdjacentHTML('beforeend', `
<style>
    .unread-badge { background: #ff2442; color: white; border-radius: 99px; min-width: 18px; height: 18px; font-size: 10px; display: flex; align-items: center; justify-content: center; padding: 0 4px; border: 2px solid white; font-weight: bold; }
    .toast-enter { animation: slideDownFade 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
    .toast-leave { animation: slideUpFade 0.3s ease-in forwards; }
    @keyframes slideDownFade { from { transform: translateY(-100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    @keyframes slideUpFade { from { transform: translateY(0); opacity: 1; } to { transform: translateY(-100%); opacity: 0; } }
    #chat-messages::-webkit-scrollbar { width: 4px; }
    #chat-messages::-webkit-scrollbar-thumb { background: #eee; border-radius: 10px; }
</style>
`);

if(!document.getElementById('global-toast-container')){
    document.body.insertAdjacentHTML('beforeend', `<div id="global-toast-container" class="fixed top-4 left-0 w-full px-4 z-[9999] pointer-events-none flex flex-col gap-2"></div>`);
}

// 工具：ID 生成與資料存取
function generateRoomId(u1, u2) { return [u1, u2].sort().join('_'); }
function getFriends() { return JSON.parse(localStorage.getItem('myFriends')) || []; }
function getGroups() { return JSON.parse(localStorage.getItem('myGroups')) || []; }
function getLastRead(rid) { return localStorage.getItem(`lastRead_${rid}`) || 0; }
function setLastRead(rid) { localStorage.setItem(`lastRead_${rid}`, Date.now()); }

// 2. 好友與群組管理
window.addFriend = function() {
    const friendName = prompt("請輸入你想添加的好友帳號：");
    if (!friendName || friendName.trim() === "" || friendName.trim() === myChatName) return;
    let friends = getFriends();
    if (!friends.includes(friendName.trim())) {
        friends.push(friendName.trim());
        localStorage.setItem('myFriends', JSON.stringify(friends));
        renderMessages(); 
    }
};

window.createGroupChat = function() {
    const gName = prompt("請輸入群組名稱：");
    if (!gName || gName.trim() === "") return;
    const gId = "GROUP_" + gName.trim() + "_" + Date.now();
    let groups = getGroups();
    groups.push({ id: gId, name: gName.trim() });
    localStorage.setItem('myGroups', JSON.stringify(groups));
    alert("群組已建立，點擊列表可邀請成員！");
    renderMessages();
};

window.inviteToGroup = async function(gId) {
    const target = prompt("請輸入要加入此群組的使用者帳號：");
    if (!target || target.trim() === "") return;
    // 發送一則邀請訊息，讓對方能看到這個群組
    await window.supabaseClient.from('messages').insert([{
        room_id: gId,
        sender_name: myChatName,
        receiver: target.trim(),
        content: `👋 我把你加入了群組`,
    }]);
    alert(`已向 ${target} 發出群組邀請`);
};

// 3. 渲染收件匣 (新增未讀數與最新訊息)
window.renderMessages = async function() {
    const container = document.getElementById('messages-list');
    if (!container) return;

    container.innerHTML = `<div class="text-center py-10"><i class="fa-solid fa-circle-notch fa-spin text-sexify text-2xl"></i></div>`;

    try {
        const { data: inboxData, error } = await window.supabaseClient
            .from('messages')
            .select('*')
            .or(`sender_name.eq.${myChatName},receiver.eq.${myChatName},room_id.ilike.GROUP_%`)
            .order('created_at', { ascending: false });

        if (error) throw error;

        let roomsMap = {};
        
        // 優先填入好友名單
        getFriends().forEach(f => {
            const rid = generateRoomId(myChatName, f);
            roomsMap[rid] = { target: f, lastMsg: '點擊開始對話', time: '', ts: 0, count: 0, isGroup: false };
        });

        // 優先填入群組名單
        getGroups().forEach(g => {
            roomsMap[g.id] = { target: g.name, lastMsg: '群組已開啟', time: '', ts: 0, count: 0, isGroup: true };
        });

        // 整合訊息數據
        (inboxData || []).forEach(msg => {
            if (!roomsMap[msg.room_id]) {
                const isG = msg.room_id.startsWith('GROUP_');
                const target = isG ? (msg.room_id.split('_')[1]) : (msg.sender_name === myChatName ? msg.receiver : msg.sender_name);
                roomsMap[msg.room_id] = { target: target, lastMsg: '', time: '', ts: 0, count: 0, isGroup: isG };
            }

            const room = roomsMap[msg.room_id];
            const msgTs = new Date(msg.created_at).getTime();

            // 計算未讀 (如果是傳給我的，且訊息時間晚於我上次讀取的時間)
            if (msg.sender_name !== myChatName && msgTs > getLastRead(msg.room_id)) {
                room.count++;
            }

            // 更新最新訊息
            if (msgTs > room.ts) {
                room.ts = msgTs;
                room.time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                room.lastMsg = msg.image_url ? '🖼️ 傳送了圖片' : (msg.content || '');
            }
        });

        const sortedRooms = Object.values(roomsMap).sort((a, b) => b.ts - a.ts);

        let html = `
            <div class="p-4 bg-white sticky top-0 z-10 flex justify-between items-center border-b">
                <h2 class="font-black text-xl text-gray-800">${myChatName}</h2>
                <div class="flex gap-2">
                    <button onclick="createGroupChat()" class="w-9 h-9 bg-gray-50 rounded-full flex items-center justify-center text-gray-600"><i class="fa-solid fa-users-rectangle"></i></button>
                    <button onclick="addFriend()" class="w-9 h-9 bg-gray-50 rounded-full flex items-center justify-center text-gray-600"><i class="fa-solid fa-user-plus"></i></button>
                </div>
            </div>
        `;

        html += sortedRooms.map(chat => {
            const roomId = Object.keys(roomsMap).find(key => roomsMap[key] === chat);
            return `
                <div class="flex items-center gap-4 p-4 active:bg-gray-50 cursor-pointer border-b border-gray-50" onclick="openChat('${chat.target}', '${roomId}')">
                    <div class="relative flex-shrink-0">
                        <img src="https://i.pravatar.cc/150?u=${chat.target}" class="w-14 h-14 rounded-full border">
                        ${chat.count > 0 ? `<div class="absolute -top-1 -right-1 unread-badge">${chat.count}</div>` : ''}
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex justify-between items-center">
                            <span class="font-bold text-gray-900 truncate">${chat.isGroup ? '👥 ' : ''}${chat.target}</span>
                            <span class="text-[10px] text-gray-400">${chat.time}</span>
                        </div>
                        <p class="text-sm text-gray-500 truncate">${chat.lastMsg}</p>
                    </div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = html;
    } catch (err) {
        console.error(err);
        container.innerHTML = `<p class="text-center py-10 text-red-400">載入失敗</p>`;
    }
};

// 4. 全局通知
function setupGlobalRealtime() {
    if (window.globalChannel) return;
    window.globalChannel = window.supabaseClient.channel('global_notifications')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver=eq.${myChatName}` }, payload => {
            const msg = payload.new;
            if (window.activeRoomId === msg.room_id) return; 
            showToastNotification(msg.sender_name, msg.content || '傳送了圖片', `https://i.pravatar.cc/150?u=${msg.sender_name}`);
            renderMessages();
        }).subscribe();
}

function showToastNotification(sender, text, avatar) {
    const container = document.getElementById('global-toast-container');
    const toast = document.createElement('div');
    toast.className = `toast-enter pointer-events-auto w-full max-w-sm mx-auto bg-white shadow-xl rounded-2xl p-4 flex items-center gap-3 border border-gray-100`;
    toast.innerHTML = `
        <img src="${avatar}" class="w-10 h-10 rounded-full">
        <div class="flex-1 min-w-0"><p class="text-sm font-bold">${sender}</p><p class="text-sm text-gray-500 truncate">${text}</p></div>
    `;
    toast.onclick = () => { toast.remove(); openChat(sender); };
    container.appendChild(toast);
    setTimeout(() => { toast.classList.replace('toast-enter', 'toast-leave'); setTimeout(() => toast.remove(), 300); }, 4000);
}

// 5. 聊天室邏輯 (修正排序為新訊息在下)
window.openChat = async function(name, roomId) {
    window.activeChatTarget = name;
    window.activeRoomId = roomId || generateRoomId(myChatName, name);

    const modal = document.getElementById('chat-modal');
    const msgBox = document.getElementById('chat-messages');
    
    document.querySelector('#chat-modal h2').innerText = window.activeRoomId.startsWith('GROUP_') ? `👥 ${name}` : name;
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.remove('translate-x-full'), 10);

    msgBox.innerHTML = `<div class="text-center py-20 text-gray-200"><i class="fa-solid fa-spinner fa-spin"></i></div>`;

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
            msgBox.innerHTML = `<div class="text-center py-20 text-gray-300 text-xs">開始對話吧！</div>`;
        }
        scrollToBottom();
        startRealtime();
        setLastRead(window.activeRoomId); // 記錄讀取時間，清除未讀數字
    } catch (err) {
        msgBox.innerHTML = `<p class="text-center p-10 text-red-400 text-xs">載入失敗: ${err.message}</p>`;
    }
};

function appendUI(msg) {
    const box = document.getElementById('chat-messages');
    const isMe = msg.sender_name === myChatName;
    const align = isMe ? 'justify-end' : 'justify-start';
    const bg = isMe ? 'bg-[#ff2442] text-white' : 'bg-gray-100 text-gray-900';
    
    const div = document.createElement('div');
    div.className = `flex ${align} mb-4`;
    div.innerHTML = `
        <div class="${bg} px-4 py-2 rounded-2xl shadow-sm max-w-[75%]">
            ${!isMe && window.activeRoomId.startsWith('GROUP_') ? `<p class="text-[9px] font-bold opacity-60 mb-1">${msg.sender_name}</p>` : ''}
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
            if (document.getElementById('chat-messages').innerHTML.includes('開始對話')) document.getElementById('chat-messages').innerHTML = '';
            appendUI(payload.new);
            scrollToBottom();
            setLastRead(window.activeRoomId); // 即時清除讀取時間
        }).subscribe();
}

// 6. 發送動作 (維持 sender_name 與 message-images)
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

// 輔助功能
window.scrollToBottom = function() {
    const b = document.getElementById('chat-messages');
    b.scrollTo({ top: b.scrollHeight, behavior: 'smooth' });
};

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

window.closeChat = function() {
    document.getElementById('chat-modal').classList.add('translate-x-full');
    if (window.roomChannel) window.supabaseClient.removeChannel(window.roomChannel);
    setTimeout(() => {
        document.getElementById('chat-modal').classList.add('hidden');
        renderMessages();
    }, 300);
};

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        setupGlobalRealtime();
        renderMessages();
    }, 500);
});
