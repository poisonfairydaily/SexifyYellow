// ==========================================
// js/messages.js - 增強版 (功能全開且維持命名規範)
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

// 1. 初始化 CSS 與容器
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

// 生成 1對1 ID (字母排序確保唯一性)
function generateRoomId(user1, user2) {
    return [user1, user2].sort().join('_');
}

// 2. 好友與群組管理
function getFriends() { return JSON.parse(localStorage.getItem('myFriends')) || []; }

window.addFriend = function() {
    const friendName = prompt("請輸入好友帳號：");
    if (!friendName || friendName.trim() === "" || friendName === myChatName) return;
    let friends = getFriends();
    if (!friends.includes(friendName.trim())) {
        friends.push(friendName.trim());
        localStorage.setItem('myFriends', JSON.stringify(friends));
        renderMessages();
    }
};

window.createGroupChat = function() {
    const groupName = prompt("請輸入大型聊天室名稱：");
    if (!groupName) return;
    const groupId = "GROUP_" + groupName;
    openChat(groupName, groupId);
};

// 3. 渲染收件匣 (新增預覽、計數、刪除)
window.renderMessages = async function() {
    const container = document.getElementById('messages-list');
    if (!container) return;

    container.innerHTML = `<div class="text-center py-10"><i class="fa-solid fa-circle-notch fa-spin text-sexify text-2xl"></i></div>`;

    try {
        const { data: allData, error } = await window.supabaseClient
            .from('messages')
            .select('*')
            .or(`sender_name.eq.${myChatName},receiver.eq.${myChatName},room_id.ilike.GROUP_%`)
            .order('created_at', { ascending: false });

        if (error) throw error;

        let roomsMap = {};
        (allData || []).forEach(msg => {
            if (!roomsMap[msg.room_id]) {
                const isGroup = msg.room_id.startsWith('GROUP_');
                const targetUser = isGroup ? msg.room_id.replace('GROUP_', '') : (msg.sender_name === myChatName ? msg.receiver : msg.sender_name);
                
                roomsMap[msg.room_id] = {
                    roomId: msg.room_id,
                    targetUser: targetUser,
                    lastMsg: msg.image_url ? '🖼️ 圖片訊息' : (msg.content || ''),
                    time: new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
                    timestamp: new Date(msg.created_at).getTime(),
                    count: 0,
                    isGroup: isGroup
                };
            }
            // 簡易未讀邏輯：如果是發給我的且時間晚於上次讀取 (此處簡化為計數)
            if (msg.receiver === myChatName && msg.sender_name !== myChatName) {
                roomsMap[msg.room_id].count++;
            }
        });

        let inboxArray = Object.values(roomsMap).sort((a, b) => b.timestamp - a.timestamp);

        let html = `
            <div class="p-4 bg-white border-b border-gray-100 sticky top-0 z-10 flex justify-between items-center">
                <h2 class="font-black text-xl text-gray-800">${myChatName}</h2>
                <div class="flex gap-2">
                    <button onclick="createGroupChat()" class="text-xs bg-gray-100 px-3 py-1 rounded-full">＋群組</button>
                    <button onclick="addFriend()" class="text-xs bg-gray-100 px-3 py-1 rounded-full">＋好友</button>
                </div>
            </div>
        `;

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
                <button onclick="event.stopPropagation(); deleteChat('${chat.roomId}')" class="delete-btn px-2 opacity-0 group-hover:opacity-100 transition">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>
        `).join('');

        container.innerHTML = html;
    } catch (err) {
        console.error("載入失敗:", err);
    }
};

// 4. 聊天室主邏輯 (修正排序為由上至下)
window.openChat = async function(targetName, existingRoomId = null) {
    window.activeChatTarget = targetName;
    window.activeRoomId = existingRoomId || generateRoomId(myChatName, targetName);

    const modal = document.getElementById('chat-modal');
    const chatMessages = document.getElementById('chat-messages');
    const headerTitle = modal.querySelector('h2');
    if(headerTitle) headerTitle.innerText = targetName;

    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.remove('translate-x-full'), 10);
    chatMessages.innerHTML = `<div class="text-center py-20 text-gray-300"><i class="fa-solid fa-spinner fa-spin"></i></div>`;

    try {
        // 重要：使用 ascending: true 確保舊訊息在上，新訊息在下
        const { data, error } = await window.supabaseClient.from('messages')
            .select('*').eq('room_id', window.activeRoomId).order('created_at', { ascending: true });
        if (error) throw error;
        
        chatMessages.innerHTML = ''; // 清空加載圖示
        (data || []).forEach(msg => appendMessageUI(msg));
        scrollToBottom();
        setupRoomRealtime();
    } catch (err) { console.error(err); }
};

function appendMessageUI(msg) {
    const container = document.getElementById('chat-messages');
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

// 5. 即時更新
function setupRoomRealtime() {
    if (window.roomChannel) window.supabaseClient.removeChannel(window.roomChannel);
    window.roomChannel = window.supabaseClient.channel('room_' + window.activeRoomId)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${window.activeRoomId}` }, payload => {
            appendMessageUI(payload.new);
            scrollToBottom();
        }).subscribe();
}

// 6. 發送動作 (維持 sender_name 與 message-images)
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
            alert("圖片上傳失敗");
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

// 7. 刪除聊天功能
window.deleteChat = async function(roomId) {
    if (!confirm("確定要刪除此聊天室的所有訊息嗎？此動作無法復原。")) return;
    try {
        const { error } = await window.supabaseClient
            .from('messages')
            .delete()
            .eq('room_id', roomId);
        
        if (error) throw error;
        alert("已清空聊天紀錄");
        renderMessages();
    } catch (err) {
        alert("刪除失敗：" + err.message);
    }
};

// 圖片選擇輔助
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
    document.getElementById('chat-image-preview-container').classList.replace('flex', 'hidden');
};

window.closeChat = function() {
    document.getElementById('chat-modal').classList.add('translate-x-full');
    if (window.roomChannel) window.supabaseClient.removeChannel(window.roomChannel);
    setTimeout(() => {
        document.getElementById('chat-modal').classList.add('hidden');
        renderMessages(); // 回到列表時重新刷新預覽
    }, 300);
};

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(renderMessages, 500);
});
