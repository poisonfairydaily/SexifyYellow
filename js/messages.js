// ==========================================
// js/messages.js - 修正對齊版 (維持 sender_name 與 message-images)
// ==========================================

window.activeRoomId = null;
window.activeChatTarget = null;
window.roomChannel = null;     
window.globalChannel = null;   
let selectedImageFile = null;

// 1. 初始化使用者與全局 UI
let myChatName = localStorage.getItem('myChatName');
if (!myChatName) {
    let name = prompt("【IG風格聊天室】請輸入你的專屬帳號：", "User_" + Math.floor(Math.random() * 10000));
    localStorage.setItem('myChatName', name || "神秘使用者");
    myChatName = localStorage.getItem('myChatName');
}

// 注入通知彈窗 CSS
document.head.insertAdjacentHTML('beforeend', `
<style>
    .toast-enter { animation: slideDownFade 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
    .toast-leave { animation: slideUpFade 0.3s ease-in forwards; }
    @keyframes slideDownFade { from { transform: translateY(-100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    @keyframes slideUpFade { from { transform: translateY(0); opacity: 1; } to { transform: translateY(-100%); opacity: 0; } }
</style>
`);
if(!document.getElementById('global-toast-container')){
    document.body.insertAdjacentHTML('beforeend', `<div id="global-toast-container" class="fixed top-4 left-0 w-full px-4 z-[9999] pointer-events-none flex flex-col gap-2"></div>`);
}

function generateRoomId(user1, user2) {
    return [user1, user2].sort().join('_');
}

// 2. 好友系統
function getFriends() {
    return JSON.parse(localStorage.getItem('myFriends')) || [];
}
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

// 3. 渲染收件匣 (修正查詢欄位為 sender_name)
window.renderMessages = async function() {
    const container = document.getElementById('messages-list');
    if (!container) return;

    container.innerHTML = `<div class="text-center py-10"><i class="fa-solid fa-circle-notch fa-spin text-sexify text-2xl"></i><p class="mt-2 text-gray-400 text-sm">載入收件匣中...</p></div>`;

    try {
        const { data: inboxData, error } = await window.supabaseClient
            .from('messages')
            .select('*')
            .or(`sender_name.eq.${myChatName},receiver.eq.${myChatName}`) // 使用 sender_name
            .order('created_at', { ascending: false });

        if (error) throw error;

        let roomsMap = {};
        (inboxData || []).forEach(msg => {
            if (!roomsMap[msg.room_id]) {
                const targetUser = msg.sender_name === myChatName ? msg.receiver : msg.sender_name;
                roomsMap[msg.room_id] = {
                    targetUser: targetUser,
                    lastMsg: msg.content || (msg.image_url ? '傳送了一張圖片' : ''),
                    time: new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
                    timestamp: new Date(msg.created_at).getTime(),
                    isUnread: msg.receiver === myChatName
                };
            }
        });

        let inboxArray = Object.values(roomsMap);
        let friends = getFriends();
        friends.forEach(f => {
            if (!inboxArray.find(r => r.targetUser === f)) {
                inboxArray.push({ targetUser: f, lastMsg: '點擊開始對話', time: '', timestamp: 0, isUnread: false });
            }
        });
        inboxArray.sort((a, b) => b.timestamp - a.timestamp);

        let html = `
            <div class="p-4 bg-white border-b border-gray-100 sticky top-0 z-10 flex justify-between items-center">
                <h2 class="font-black text-xl text-gray-800">${myChatName}</h2>
                <button onclick="addFriend()" class="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-800 active:scale-90 transition">
                    <i class="fa-solid fa-user-plus"></i>
                </button>
            </div>
        `;

        if (inboxArray.length === 0) {
            html += `<div class="text-center text-gray-400 py-20"><p>目前沒有訊息，快去添加好友！</p></div>`;
        } else {
            html += `<div class="pb-20">` + inboxArray.map(chat => `
                <div class="flex items-center gap-4 p-4 transition border-b border-gray-50 cursor-pointer" onclick="openChat('${chat.targetUser}')">
                    <img src="https://i.pravatar.cc/150?u=${chat.targetUser}" class="w-14 h-14 rounded-full border border-gray-100">
                    <div class="flex-1 min-w-0">
                        <h3 class="font-bold text-gray-900">${chat.targetUser}</h3>
                        <p class="text-sm truncate text-gray-500">${chat.lastMsg}</p>
                    </div>
                </div>
            `).join('') + `</div>`;
        }
        container.innerHTML = html;
    } catch (err) {
        console.error("連線錯誤:", err);
        container.innerHTML = `<div class="text-center text-red-400 py-10">連線失敗，請確認資料表有 receiver 欄位</div>`;
    }
};

// 4. 全局通知監聽
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
            if (window.activeChatTarget === msg.sender_name) return; 
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

// 5. 聊天室邏輯
window.openChat = async function(targetName) {
    window.activeChatTarget = targetName;
    window.activeRoomId = generateRoomId(myChatName, targetName);

    const modal = document.getElementById('chat-modal');
    const chatMessages = document.getElementById('chat-messages');

    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.remove('translate-x-full'), 10);
    chatMessages.innerHTML = `<div class="text-center py-10 text-gray-400">載入中...</div>`;

    try {
        const { data, error } = await window.supabaseClient.from('messages')
            .select('*').eq('room_id', window.activeRoomId).order('created_at', { ascending: true });
        if (error) throw error;
        drawMessages(data || []);
        setupRoomRealtime();
    } catch (err) { console.error(err); }
};

function drawMessages(messages) {
    const container = document.getElementById('chat-messages');
    container.innerHTML = messages.map(msg => {
        const isMe = msg.sender_name === myChatName;
        const align = isMe ? 'justify-end' : 'justify-start';
        const bg = isMe ? 'bg-[#ff2442] text-white' : 'bg-gray-100 text-gray-900';
        return `
            <div class="flex ${align} mb-4">
                <div class="${bg} px-4 py-2 rounded-2xl shadow-sm max-w-[75%]">
                    ${msg.image_url ? `<img src="${msg.image_url}" class="max-w-full rounded-lg mb-1">` : ''}
                    ${msg.content || ''}
                </div>
            </div>
        `;
    }).join('');
    container.scrollTop = container.scrollHeight;
}

function setupRoomRealtime() {
    if (window.roomChannel) window.supabaseClient.removeChannel(window.roomChannel);
    window.roomChannel = window.supabaseClient.channel('room_' + window.activeRoomId)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${window.activeRoomId}` }, payload => {
            const newMsg = payload.new;
            const container = document.getElementById('chat-messages');
            const isMe = newMsg.sender_name === myChatName;
            const align = isMe ? 'justify-end' : 'justify-start';
            const bg = isMe ? 'bg-[#ff2442] text-white' : 'bg-gray-100 text-gray-900';
            
            const msgDiv = document.createElement('div');
            msgDiv.className = `flex ${align} mb-4`;
            msgDiv.innerHTML = `<div class="${bg} px-4 py-2 rounded-2xl shadow-sm max-w-[75%]">${newMsg.image_url ? `<img src="${newMsg.image_url}" class="max-w-full rounded-lg mb-1">`:''}${newMsg.content || ''}</div>`;
            container.appendChild(msgDiv);
            container.scrollTop = container.scrollHeight;
        }).subscribe();
}

// 6. 發送動作 (維持 sender_name 與 message-images)
window.handleSendAction = async function() {
    const input = document.getElementById('chat-input');
    const text = input.value;
    if (!text.trim() && !selectedImageFile) return;

    input.value = '';
    let uploadedImageUrl = null;

    if (selectedImageFile) {
        const fileName = `${Date.now()}_${selectedImageFile.name}`;
        try {
            const { data: uploadData, error: uploadError } = await window.supabaseClient.storage
                .from('message-images') // 修正回你的名稱
                .upload(fileName, selectedImageFile);
            if (uploadError) throw uploadError;

            const { data: publicUrlData } = window.supabaseClient.storage
                .from('message-images')
                .getPublicUrl(fileName);
            uploadedImageUrl = publicUrlData.publicUrl;
        } catch (err) {
            alert("圖片上傳失敗，請確認 Storage 名稱為 message-images 且 RLS 已開放");
            return;
        }
        cancelImageSelection();
    }

    await window.supabaseClient.from('messages').insert([{
        room_id: window.activeRoomId, 
        sender_name: myChatName, // 修正回你的名稱
        receiver: window.activeChatTarget,
        content: text.trim() || null,
        image_url: uploadedImageUrl
    }]);
};

// 輔助功能
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
    document.getElementById('chat-image-preview-container').classList.add('hidden');
};
window.closeChat = function() {
    document.getElementById('chat-modal').classList.add('translate-x-full');
    setTimeout(() => document.getElementById('chat-modal').classList.add('hidden'), 300);
};

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        setupGlobalRealtime();
        renderMessages();
    }, 500);
});
