// ==========================================
// js/messages.js - 終極功能增強版
// ==========================================

window.activeRoomId = null;
window.activeChatTarget = null;
window.isGroup = false;        // 新增：判斷是否為群組
window.roomChannel = null;     
window.globalChannel = null;   
let selectedImageFile = null;
let currentChatMessages = [];  // 新增：快取當前聊天內容供搜尋使用

// 1. 初始化使用者
let myChatName = localStorage.getItem('myChatName');
if (!myChatName) {
    let name = prompt("【IG風格聊天室】請輸入你的專屬帳號：", "User_" + Math.floor(Math.random() * 10000));
    localStorage.setItem('myChatName', name || "神秘使用者");
    myChatName = localStorage.getItem('myChatName');
}

// 注入通知與新功能 UI 的 CSS
if(!document.getElementById('enhanced-ui-style')){
    document.head.insertAdjacentHTML('beforeend', `
    <style id="enhanced-ui-style">
        .toast-enter { animation: slideDownFade 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
        .toast-leave { animation: slideUpFade 0.3s ease-in forwards; }
        @keyframes slideDownFade { from { transform: translateY(-100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes slideUpFade { from { transform: translateY(0); opacity: 1; } to { transform: translateY(-100%); opacity: 0; } }
        .unsend-btn { opacity: 0; transition: opacity 0.2s; }
        .msg-bubble:hover .unsend-btn { opacity: 1; }
        .search-highlight { background: #ffeb3b; color: #000; border-radius: 2px; }
    </style>
    `);
    document.body.insertAdjacentHTML('beforeend', `<div id="global-toast-container" class="fixed top-4 left-0 w-full px-4 z-[9999] pointer-events-none flex flex-col gap-2"></div>`);
}

function generateRoomId(user1, user2) {
    return [user1, user2].sort().join('_');
}

function getLastReadTimes() {
    return JSON.parse(localStorage.getItem(`lastRead_${myChatName}`) || '{}');
}
function updateLastRead(targetUser) {
    const times = getLastReadTimes();
    times[targetUser] = Date.now();
    localStorage.setItem(`lastRead_${myChatName}`, JSON.stringify(times));
}

// 2. 好友與群組系統
function getFriends() { return JSON.parse(localStorage.getItem('myFriends')) || []; }
function getGroups() { return JSON.parse(localStorage.getItem('myGroups')) || []; }

window.addFriend = function() {
    const friendName = prompt("請輸入你想添加的好友帳號：");
    if (!friendName || friendName.trim() === "" || friendName.trim() === myChatName) return;
    let friends = getFriends();
    if (!friends.includes(friendName.trim())) {
        friends.push(friendName.trim());
        localStorage.setItem('myFriends', JSON.stringify(friends));
        alert(`🎉 成功添加 ${friendName.trim()}！`);
        renderMessages(); 
    }
};

// 新增：建立群組功能
window.createGroup = function() {
    const groupName = prompt("請輸入群組名稱：");
    if (!groupName) return;
    const membersStr = prompt("請輸入成員帳號 (用逗號隔開，例如: UserA,UserB)：");
    const members = membersStr ? membersStr.split(',').map(m => m.trim()) : [];
    members.push(myChatName); // 把自己加入

    const groupId = 'GROUP_' + Date.now();
    let groups = getGroups();
    groups.push({ id: groupId, name: groupName, members: members });
    localStorage.setItem('myGroups', JSON.stringify(groups));
    alert(`👥 群組 「${groupName}」 已建立！`);
    renderMessages();
};

// 3. 渲染收件匣 (新增搜尋功能)
window.renderMessages = async function(searchFilter = "") {
    const container = document.getElementById('messages-list');
    if (!container) return;

    try {
        const { data: inboxData, error } = await window.supabaseClient
            .from('messages')
            .select('*')
            .or(`sender_name.eq.${myChatName},receiver.eq.${myChatName},room_id.ilike.GROUP_%`)
            .order('created_at', { ascending: false }); 

        if (error) throw error;

        let roomsMap = {};
        const lastReadTimes = getLastReadTimes();

        (inboxData || []).forEach(msg => {
            const isGroupMsg = msg.room_id.startsWith('GROUP_');
            let targetKey, displayName;

            if (isGroupMsg) {
                targetKey = msg.room_id;
                const groupInfo = getGroups().find(g => g.id === msg.room_id);
                displayName = groupInfo ? `👥 ${groupInfo.name}` : "未知群組";
                // 群組成員判斷：如果我不在此群組，則跳過 (除非資料庫有更嚴謹的成員表)
                if (groupInfo && !groupInfo.members.includes(myChatName)) return;
            } else {
                targetKey = msg.sender_name === myChatName ? msg.receiver : msg.sender_name;
                displayName = targetKey;
            }

            const msgTime = new Date(msg.created_at).getTime();

            if (!roomsMap[targetKey]) {
                roomsMap[targetKey] = {
                    id: targetKey,
                    isGroup: isGroupMsg,
                    displayName: displayName,
                    lastMsg: msg.content || (msg.image_url ? '傳送了一張圖片 🖼️' : ''),
                    time: new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
                    timestamp: msgTime,
                    unreadCount: 0
                };
            }
            if (msg.sender_name !== myChatName && msgTime > (lastReadTimes[targetKey] || 0)) {
                roomsMap[targetKey].unreadCount++;
            }
        });

        let inboxArray = Object.values(roomsMap);
        
        // 加入沒有對話的好友與群組
        getFriends().forEach(f => { if (!inboxArray.find(r => r.id === f)) inboxArray.push({ id: f, isGroup: false, displayName: f, lastMsg: '點擊開始對話', time: '', timestamp: 0, unreadCount: 0 }); });
        getGroups().forEach(g => { if (!inboxArray.find(r => r.id === g.id)) inboxArray.push({ id: g.id, isGroup: true, displayName: `👥 ${g.name}`, lastMsg: '群組已開啟', time: '', timestamp: 0, unreadCount: 0 }); });

        // 搜尋過濾
        if (searchFilter) {
            inboxArray = inboxArray.filter(chat => chat.displayName.toLowerCase().includes(searchFilter.toLowerCase()) || chat.lastMsg.toLowerCase().includes(searchFilter.toLowerCase()));
        }

        inboxArray.sort((a, b) => b.timestamp - a.timestamp);

        let html = `
            <div class="p-4 bg-white border-b border-gray-100 sticky top-0 z-10">
                <div class="flex justify-between items-center mb-3">
                    <h2 class="font-black text-xl text-gray-800">${myChatName}</h2>
                    <div class="flex gap-2">
                        <button onclick="createGroup()" class="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-800 active:scale-90 transition"><i class="fa-solid fa-users"></i></button>
                        <button onclick="addFriend()" class="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-800 active:scale-90 transition"><i class="fa-solid fa-user-plus"></i></button>
                    </div>
                </div>
                <div class="relative">
                    <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
                    <input type="text" placeholder="搜尋聊天內容或好友..." oninput="renderMessages(this.value)" class="w-full bg-gray-100 border-none rounded-xl py-2 pl-9 pr-4 text-sm focus:ring-1 focus:ring-gray-200">
                </div>
            </div>
        `;

        html += `<div class="pb-20 divide-y divide-gray-50">` + inboxArray.map(chat => `
            <div class="flex items-center gap-4 p-4 active:bg-gray-50 transition cursor-pointer" onclick="openChat('${chat.id}', ${chat.isGroup})">
                <div class="relative flex-shrink-0">
                    <img src="https://i.pravatar.cc/150?u=${chat.id}" class="w-14 h-14 rounded-full border border-gray-100 object-cover">
                    ${chat.unreadCount > 0 ? `<span class="absolute -top-1 -right-1 bg-sexify text-white text-[10px] min-w-[20px] h-[20px] flex items-center justify-center rounded-full border-2 border-white font-bold px-1">${chat.unreadCount > 99 ? '99+' : chat.unreadCount}</span>` : ''}
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex justify-between items-center mb-1">
                        <h3 class="font-bold text-gray-900 truncate">${chat.displayName}</h3>
                        <span class="text-[10px] text-gray-400 font-medium">${chat.time}</span>
                    </div>
                    <p class="text-sm truncate ${chat.unreadCount > 0 ? 'text-gray-900 font-bold' : 'text-gray-500'}">${chat.lastMsg}</p>
                </div>
            </div>
        `).join('') + `</div>`;
        
        container.innerHTML = html;
    } catch (err) { console.error(err); }
};

// 4. 回收訊息功能
window.unsendMessage = async function(msgId) {
    if (!confirm("確定要回收這條訊息嗎？")) return;
    try {
        const { error } = await window.supabaseClient.from('messages').delete().eq('id', msgId).eq('sender_name', myChatName);
        if (error) throw error;
        // 刪除後本地 UI 會透過 Realtime 自動更新 (如果是 INSERT)
        // 但 DELETE 需要手動重新載入或監聽 DELETE 事件
        openChat(window.activeChatTarget, window.isGroup); 
    } catch (err) { alert("回收失敗: " + err.message); }
};

// 5. 聊天室邏輯 (支援搜尋與時間顯示)
window.openChat = async function(targetId, isGroup = false) {
    window.activeChatTarget = targetId;
    window.isGroup = isGroup;
    window.activeRoomId = isGroup ? targetId : generateRoomId(myChatName, targetId);

    updateLastRead(targetId);
    renderMessages();

    const modal = document.getElementById('chat-modal');
    const chatMessages = document.getElementById('chat-messages');

    // 更新 Header
    const displayName = isGroup ? (getGroups().find(g => g.id === targetId)?.name || "群組") : targetId;
    document.getElementById('chat-name').innerText = displayName;
    document.getElementById('chat-avatar').src = `https://i.pravatar.cc/150?u=${targetId}`;

    // 增加搜尋框到聊天室 Header (如果沒有的話)
    if (!document.getElementById('chat-search-input')) {
        const header = document.querySelector('#chat-modal header');
        header.insertAdjacentHTML('afterend', `
            <div class="bg-white px-4 py-2 border-b border-gray-50 flex items-center gap-2">
                <input id="chat-search-input" type="text" placeholder="搜尋對話內容..." oninput="drawMessages(null, this.value)" class="flex-1 bg-gray-50 border-none rounded-lg py-1.5 px-3 text-xs focus:ring-0">
            </div>
        `);
    }

    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.remove('translate-x-full'), 10);
    chatMessages.innerHTML = `<div class="absolute inset-0 flex items-center justify-center text-gray-400 text-sm"><i class="fa-solid fa-spinner fa-spin mr-2"></i>載入對話中...</div>`;

    try {
        const { data, error } = await window.supabaseClient.from('messages')
            .select('*').eq('room_id', window.activeRoomId).order('created_at', { ascending: false });
        if (error) throw error;
        
        currentChatMessages = data || [];
        drawMessages(currentChatMessages);
        setupRoomRealtime();
    } catch (err) { chatMessages.innerHTML = `<div class="text-center py-10">連線失敗</div>`; }
};

function drawMessages(messages = null, filter = "") {
    const container = document.getElementById('chat-messages');
    const msgsToDraw = messages || currentChatMessages;
    
    if (msgsToDraw.length === 0) {
        container.innerHTML = `<div class="text-center text-gray-300 py-10 w-full text-xs">沒有對話紀錄</div>`;
        return;
    }

    container.innerHTML = msgsToDraw
        .filter(msg => !filter || (msg.content && msg.content.toLowerCase().includes(filter.toLowerCase())))
        .map(msg => {
            const isMe = msg.sender_name === myChatName;
            const align = isMe ? 'justify-end' : 'justify-start';
            const bg = isMe ? 'bg-sexify text-white' : 'bg-white border border-gray-100 text-gray-900';
            const borderRadius = isMe ? 'rounded-2xl rounded-tr-sm' : 'rounded-2xl rounded-tl-sm';
            const timeStr = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            // 搜尋關鍵字高亮
            let contentHtml = msg.content || '';
            if (filter && contentHtml) {
                const regex = new RegExp(`(${filter})`, 'gi');
                contentHtml = contentHtml.replace(regex, `<span class="search-highlight">$1</span>`);
            }

            return `
                <div class="flex flex-col ${isMe ? 'items-end' : 'items-start'} mb-1 group msg-bubble">
                    ${window.isGroup && !isMe ? `<span class="text-[10px] text-gray-400 ml-1 mb-1">${msg.sender_name}</span>` : ''}
                    <div class="flex ${align} items-end gap-2 max-w-[85%]">
                        ${isMe ? `<button onclick="unsendMessage('${msg.id}')" class="unsend-btn text-[10px] text-gray-300 hover:text-red-400 transition mb-1">回收</button>` : ''}
                        ${isMe ? `<span class="text-[9px] text-gray-300 mb-1">${timeStr}</span>` : ''}
                        <div class="${bg} px-4 py-2.5 ${borderRadius} shadow-sm break-words leading-relaxed text-sm">
                            ${msg.image_url ? `<img src="${msg.image_url}" class="max-w-full rounded-lg mb-1 object-cover min-w-[120px]">` : ''}
                            ${contentHtml ? `<span>${contentHtml}</span>` : ''}
                        </div>
                        ${!isMe ? `<span class="text-[9px] text-gray-300 mb-1">${timeStr}</span>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    
    if(!filter) container.scrollTop = container.scrollHeight;
}

// 6. 全局通知監聽 (支援群組通知)
function setupGlobalRealtime() {
    if (window.globalChannel) return;
    window.globalChannel = window.supabaseClient.channel('global_notifications')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
            const msg = payload.new;
            // 判斷是否跟我有關 (私訊我，或者是我的群組訊息)
            const myGroupIds = getGroups().map(g => g.id);
            const isMyGroup = myGroupIds.includes(msg.room_id);
            const isForMe = msg.receiver === myChatName;

            if ((isForMe || isMyGroup) && msg.sender_name !== myChatName) {
                if (window.activeRoomId === msg.room_id) {
                    updateLastRead(window.activeChatTarget);
                    return; 
                }
                const senderTitle = isMyGroup ? `群組新訊息: ${msg.sender_name}` : msg.sender_name;
                showToastNotification(senderTitle, msg.content || '傳送了圖片 🖼️', `https://i.pravatar.cc/150?u=${msg.sender_name}`, msg.room_id, isMyGroup);
                renderMessages(); 
            }
        })
        // 監聽刪除事件 (同步回收)
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, payload => {
            if (window.activeChatTarget) openChat(window.activeChatTarget, window.isGroup);
            renderMessages();
        })
        .subscribe();
}

function showToastNotification(sender, text, avatar, roomId, isGroup) {
    const container = document.getElementById('global-toast-container');
    const toast = document.createElement('div');
    toast.className = `toast-enter pointer-events-auto w-full max-w-sm mx-auto bg-white shadow-xl rounded-2xl p-4 flex items-center gap-3 border border-gray-100 cursor-pointer`;
    toast.innerHTML = `<img src="${avatar}" class="w-10 h-10 rounded-full object-cover">
        <div class="flex-1 min-w-0">
            <p class="text-sm font-bold text-gray-900">${sender}</p>
            <p class="text-sm text-gray-500 truncate">${text}</p>
        </div>`;
    toast.onclick = () => { toast.remove(); openChat(roomId, isGroup); };
    container.appendChild(toast);
    setTimeout(() => { toast.classList.replace('toast-enter', 'toast-leave'); setTimeout(() => toast.remove(), 300); }, 4000);
}

// 7. 發送動作 (支援群組)
window.handleSendAction = async function() {
    const input = document.getElementById('chat-input');
    const text = input.value;
    if (!text.trim() && !selectedImageFile) return;

    input.value = '';
    let uploadedImageUrl = null;
    const sendBtn = event.currentTarget;
    sendBtn.disabled = true;

    if (selectedImageFile) {
        const fileName = `${Date.now()}_${selectedImageFile.name}`;
        try {
            const { data: uploadData, error: uploadError } = await window.supabaseClient.storage.from('message-images').upload(fileName, selectedImageFile);
            if (uploadError) throw uploadError;
            const { data: publicUrlData } = window.supabaseClient.storage.from('message-images').getPublicUrl(fileName);
            uploadedImageUrl = publicUrlData.publicUrl;
        } catch (err) { alert("圖片上傳失敗"); sendBtn.disabled = false; return; }
        cancelImageSelection();
    }

    try {
        await window.supabaseClient.from('messages').insert([{
            room_id: window.activeRoomId, 
            sender_name: myChatName, 
            receiver: window.isGroup ? null : window.activeChatTarget, // 群組不設單一接收者
            content: text.trim() || null,
            image_url: uploadedImageUrl
        }]);
    } catch (err) { console.error("發送失敗", err); } finally { sendBtn.disabled = false; }
};

// ... (其餘 handleImageSelection, cancelImageSelection, closeChat 維持不變) ...

function setupRoomRealtime() {
    if (window.roomChannel) window.supabaseClient.removeChannel(window.roomChannel);
    window.roomChannel = window.supabaseClient.channel('room_' + window.activeRoomId)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${window.activeRoomId}` }, payload => {
            currentChatMessages.unshift(payload.new);
            drawMessages(currentChatMessages);
            if (payload.new.sender_name !== myChatName) updateLastRead(window.activeChatTarget);
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages', filter: `room_id=eq.${window.activeRoomId}` }, payload => {
            // 這裡可以重新 openChat 或從本地 array 移除
            openChat(window.activeChatTarget, window.isGroup);
        })
        .subscribe();
}

window.closeChat = function() {
    window.activeChatTarget = null;
    window.activeRoomId = null;
    document.getElementById('chat-modal').classList.add('translate-x-full');
    // 清除搜尋框
    const searchInput = document.getElementById('chat-search-input');
    if(searchInput) searchInput.value = '';
    setTimeout(() => {
        document.getElementById('chat-modal').classList.add('hidden');
        document.getElementById('chat-messages').innerHTML = '';
        cancelImageSelection();
    }, 300);
    renderMessages();
};

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        setupGlobalRealtime();
        renderMessages();
    }, 500);
});
