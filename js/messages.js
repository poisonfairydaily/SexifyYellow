// ==========================================
// js/messages.js - 完美升級版 (搜尋、群組、時間、回收、未讀計數、由下至上顯示)
// ==========================================

window.activeRoomId = null;
window.activeChatTarget = null;
window.isGroupChat = false;    // 新增：判斷是否為群組
window.roomChannel = null;     
window.globalChannel = null;   
let selectedImageFile = null;
window.currentRoomMessages = []; // 新增：用於室內搜尋快取

// 1. 初始化使用者與全局 UI
let myChatName = localStorage.getItem('myChatName');
if (!myChatName) {
    let name = prompt("【IG風格聊天室】請輸入你的專屬帳號：", "User_" + Math.floor(Math.random() * 10000));
    localStorage.setItem('myChatName', name || "神秘使用者");
    myChatName = localStorage.getItem('myChatName');
}

// 注入通知與進階 UI CSS
if(!document.getElementById('enhanced-chat-style')){
    document.head.insertAdjacentHTML('beforeend', `
    <style id="enhanced-chat-style">
        .toast-enter { animation: slideDownFade 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
        .toast-leave { animation: slideUpFade 0.3s ease-in forwards; }
        .unsend-btn { opacity: 0; transition: opacity 0.2s; }
        .msg-container:hover .unsend-btn { opacity: 1; }
        @keyframes slideDownFade { from { transform: translateY(-100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes slideUpFade { from { transform: translateY(0); opacity: 1; } to { transform: translateY(-100%); opacity: 0; } }
    </style>
    `);
    if(!document.getElementById('global-toast-container')){
        document.body.insertAdjacentHTML('beforeend', `<div id="global-toast-container" class="fixed top-4 left-0 w-full px-4 z-[9999] pointer-events-none flex flex-col gap-2"></div>`);
    }
}

function generateRoomId(user1, user2) { return [user1, user2].sort().join('_'); }
function getLastReadTimes() { return JSON.parse(localStorage.getItem(`lastRead_${myChatName}`) || '{}'); }
function updateLastRead(targetId) {
    const times = getLastReadTimes();
    times[targetId] = Date.now();
    localStorage.setItem(`lastRead_${myChatName}`, JSON.stringify(times));
}

// 2. 好友與群組系統 (LocalStorage 儲存)
function getFriends() { return JSON.parse(localStorage.getItem('myFriends')) || []; }
function getGroups() { return JSON.parse(localStorage.getItem('myGroups')) || []; }

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

window.createGroup = function() {
    const groupName = prompt("請輸入群組名稱：");
    if (!groupName) return;
    const membersStr = prompt("請輸入群組成員帳號 (用逗號 , 隔開)：");
    let members = membersStr ? membersStr.split(',').map(m => m.trim()).filter(m => m) : [];
    members.push(myChatName); // 把自己加進去
    
    const groupId = 'GROUP_' + Date.now();
    let groups = getGroups();
    groups.push({ id: groupId, name: groupName, members: [...new Set(members)] });
    localStorage.setItem('myGroups', JSON.stringify(groups));
    alert(`🎉 群組「${groupName}」創建成功！`);
    renderMessages();
}

window.renderMessages = async function(searchKeyword = "") {
    const container = document.getElementById('messages-list');
    if (!container) return;

    if(!searchKeyword) container.innerHTML = `<div class="text-center py-10"><i class="fa-solid fa-circle-notch fa-spin text-sexify text-2xl"></i><p class="mt-2 text-gray-400 text-sm">載入收件匣中...</p></div>`;

    try {
        const { data: inboxData, error } = await window.supabaseClient
            .from('messages')
            .select('*')
            .or(`sender_name.eq.${myChatName},receiver.eq.${myChatName},room_id.ilike.GROUP_%`)
            .order('created_at', { ascending: false }); 

        if (error) throw error;

        let roomsMap = {};
        const lastReadTimes = getLastReadTimes();
        const myGroups = getGroups();

        (inboxData || []).forEach(msg => {
            // --- 【安全檢查修復】 ---
            // 如果 room_id 是空的，嘗試用 sender/receiver 組合成一個臨時 ID，避免程式崩潰
            if (!msg.room_id) {
                msg.room_id = generateRoomId(msg.sender_name, msg.receiver || 'Unknown');
            }
            
            const isGroup = msg.room_id.startsWith('GROUP_');
            
            let groupInfo = null;
            if (isGroup) {
                groupInfo = myGroups.find(g => g.id === msg.room_id);
                if (!groupInfo || !groupInfo.members.includes(myChatName)) return; 
            }

            const targetId = isGroup ? msg.room_id : (msg.sender_name === myChatName ? msg.receiver : msg.sender_name);
            if (!targetId) return; // 再次確保 targetId 存在

            const msgTime = new Date(msg.created_at).getTime();

            if (!roomsMap[targetId]) {
                roomsMap[targetId] = {
                    id: targetId,
                    isGroup: isGroup,
                    displayName: isGroup ? `👥 ${groupInfo?.name || '未知群組'}` : targetId,
                    lastMsg: msg.content || (msg.image_url ? '傳送了一張圖片 🖼️' : ''),
                    time: new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false}),
                    timestamp: msgTime,
                    unreadCount: 0
                };
            }

            if ((!isGroup && msg.receiver === myChatName) || (isGroup && msg.sender_name !== myChatName)) {
                if (msgTime > (lastReadTimes[targetId] || 0)) {
                    roomsMap[targetId].unreadCount++;
                }
            }
        });

        // 剩餘渲染邏輯保持不變...
        let inboxArray = Object.values(roomsMap);
        getFriends().forEach(f => {
            if (!inboxArray.find(r => r.id === f)) inboxArray.push({ id: f, isGroup: false, displayName: f, lastMsg: '點擊開始對話', time: '', timestamp: 0, unreadCount: 0 });
        });
        myGroups.forEach(g => {
            if (!inboxArray.find(r => r.id === g.id)) inboxArray.push({ id: g.id, isGroup: true, displayName: `👥 ${g.name}`, lastMsg: '新群組創建成功', time: '', timestamp: 0, unreadCount: 0 });
        });
        
        inboxArray.sort((a, b) => b.timestamp - a.timestamp);

        if (searchKeyword) {
            const kw = searchKeyword.toLowerCase();
            inboxArray = inboxArray.filter(chat => chat.displayName.toLowerCase().includes(kw) || chat.lastMsg.toLowerCase().includes(kw));
        }

        let html = `
            <div class="p-4 bg-white border-b border-gray-100 sticky top-0 z-10 flex flex-col gap-3">
                <div class="flex justify-between items-center">
                    <h2 class="font-black text-xl text-gray-800">${myChatName}</h2>
                    <div class="flex gap-2">
                        <button onclick="createGroup()" class="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-800 active:scale-90 transition"><i class="fa-solid fa-users"></i></button>
                        <button onclick="addFriend()" class="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-800 active:scale-90 transition"><i class="fa-solid fa-user-plus"></i></button>
                    </div>
                </div>
                <input type="text" placeholder="搜尋聊天紀錄..." oninput="window.renderMessages(this.value)" class="w-full bg-gray-50 border border-gray-200 rounded-full py-1.5 px-4 text-sm outline-none focus:ring-1 focus:ring-sexify">
            </div>
        `;

        html += `<div class="pb-20 divide-y divide-gray-50">` + inboxArray.map(chat => `
            <div class="flex items-center gap-4 p-4 active:bg-gray-50 transition cursor-pointer" onclick="openChat('${chat.id}', ${chat.isGroup}, '${chat.displayName}')">
                <div class="relative flex-shrink-0">
                    <img src="https://i.pravatar.cc/150?u=${chat.id}" class="w-14 h-14 rounded-full border border-gray-100 object-cover">
                    ${chat.unreadCount > 0 ? `<span class="absolute -top-1 -right-1 bg-sexify text-white text-[10px] min-w-[20px] h-[20px] flex items-center justify-center rounded-full border-2 border-white font-bold px-1 shadow-sm">${chat.unreadCount}</span>` : ''}
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex justify-between items-center mb-1">
                        <h3 class="font-bold text-gray-900 truncate pr-2">${chat.displayName}</h3>
                        <span class="text-[10px] text-gray-400 font-medium whitespace-nowrap">${chat.time}</span>
                    </div>
                    <p class="text-sm truncate ${chat.unreadCount > 0 ? 'text-gray-900 font-bold' : 'text-gray-500'}">${chat.lastMsg}</p>
                </div>
            </div>
        `).join('') + `</div>`;

        container.innerHTML = html;
    } catch (err) {
        console.error("連線錯誤:", err);
        container.innerHTML = `<div class="text-center text-red-400 py-10">資料庫資料格式異常</div>`;
    }
};

// 4. 全局通知監聽
function setupGlobalRealtime() {
    if (window.globalChannel) return;
    window.globalChannel = window.supabaseClient.channel('global_notifications')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
            const msg = payload.new;
            // 過濾：是傳給我的，或者是群組訊息且我在此群組
            const isGroup = msg.room_id.startsWith('GROUP_');
            let isRelevant = false;
            
            if (!isGroup && msg.receiver === myChatName) isRelevant = true;
            if (isGroup && getGroups().find(g => g.id === msg.room_id)?.members.includes(myChatName) && msg.sender_name !== myChatName) isRelevant = true;

            if (isRelevant) {
                const activeId = isGroup ? msg.room_id : msg.sender_name;
                if (window.activeChatTarget === activeId) {
                    updateLastRead(activeId);
                    return; 
                }
                const senderDisplay = isGroup ? `${msg.sender_name} (群組)` : msg.sender_name;
                showToastNotification(senderDisplay, msg.content || '傳送了一張圖片 🖼️', `https://i.pravatar.cc/150?u=${activeId}`);
                renderMessages(); 
            }
        }).subscribe();
}

function showToastNotification(sender, text, avatar) {
    const container = document.getElementById('global-toast-container');
    const toast = document.createElement('div');
    toast.className = `toast-enter pointer-events-auto w-full max-w-sm mx-auto bg-white shadow-xl rounded-2xl p-4 flex items-center gap-3 border border-gray-100`;
    toast.innerHTML = `<img src="${avatar}" class="w-10 h-10 rounded-full object-cover"><div class="flex-1 min-w-0"><p class="text-sm font-bold text-gray-900">${sender} 新訊息</p><p class="text-sm text-gray-500 truncate">${text}</p></div>`;
    setTimeout(() => { toast.classList.replace('toast-enter', 'toast-leave'); setTimeout(() => toast.remove(), 300); }, 3000);
    container.appendChild(toast);
}

// 5. 聊天室內部邏輯
window.openChat = async function(targetId, isGroup = false, displayName = targetId) {
    window.activeChatTarget = targetId;
    window.isGroupChat = isGroup;
    window.activeRoomId = isGroup ? targetId : generateRoomId(myChatName, targetId);

    updateLastRead(targetId);
    renderMessages();

    const modal = document.getElementById('chat-modal');
    const chatMessages = document.getElementById('chat-messages');

    document.getElementById('chat-name').innerText = displayName;
    document.getElementById('chat-avatar').src = `https://i.pravatar.cc/150?u=${targetId}`;

    // 注入室內搜尋框 (無損注入，不影響原有 HTML 結構)
    let searchWrap = document.getElementById('room-search-wrapper');
    if (!searchWrap) {
        const header = document.querySelector('#chat-modal .border-b');
        header.insertAdjacentHTML('afterend', `
            <div id="room-search-wrapper" class="bg-gray-50 border-b px-4 py-2 hidden transition-all">
                <input type="text" id="room-search-input" placeholder="在對話中搜尋..." oninput="filterRoomMessages(this.value)" class="w-full bg-white border border-gray-200 rounded-full px-3 py-1 text-xs outline-none focus:border-sexify">
            </div>
        `);
        // 幫 header 加上搜尋切換按鈕
        header.innerHTML += `<button onclick="document.getElementById('room-search-wrapper').classList.toggle('hidden')" class="ml-2 w-8 h-8 flex items-center justify-center text-gray-500 rounded-full active:bg-gray-100"><i class="fa-solid fa-magnifying-glass text-sm"></i></button>`;
    } else {
        document.getElementById('room-search-input').value = "";
        searchWrap.classList.add('hidden');
    }

    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.remove('translate-x-full'), 10);
    chatMessages.innerHTML = `<div class="absolute inset-0 flex items-center justify-center text-gray-400 text-sm"><i class="fa-solid fa-spinner fa-spin mr-2"></i>載入中...</div>`;

    try {
        const { data, error } = await window.supabaseClient.from('messages')
            .select('*').eq('room_id', window.activeRoomId).order('created_at', { ascending: false });
        if (error) throw error;
        
        window.currentRoomMessages = data || [];
        drawMessages(window.currentRoomMessages);
        setupRoomRealtime();
    } catch (err) { chatMessages.innerHTML = `<div class="absolute inset-0 flex items-center justify-center text-red-400">無法載入訊息</div>`; }
};

// 搜尋室內訊息
window.filterRoomMessages = function(keyword) {
    if(!keyword) return drawMessages(window.currentRoomMessages);
    const filtered = window.currentRoomMessages.filter(m => m.content && m.content.toLowerCase().includes(keyword.toLowerCase()));
    drawMessages(filtered, true); // true 代表是搜尋狀態
}

// 渲染訊息 (加入時間與回收按鈕，適配 flex-col-reverse)
function drawMessages(messages, isSearching = false) {
    const container = document.getElementById('chat-messages');
    
    if (messages.length === 0) {
        container.innerHTML = `<div class="text-center text-gray-300 py-10 w-full text-xs">${isSearching ? '找不到相關訊息' : '開始你們的第一句話吧！'}</div>`;
        return;
    }

    container.innerHTML = messages.map(msg => {
        const isMe = msg.sender_name === myChatName;
        const align = isMe ? 'justify-end' : 'justify-start';
        const bg = isMe ? 'bg-sexify text-white' : 'bg-white border border-gray-100 text-gray-900';
        const borderRadius = isMe ? 'rounded-2xl rounded-tr-sm' : 'rounded-2xl rounded-tl-sm';
        const timeStr = new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false});
        
        return `
            <div class="flex flex-col ${isMe ? 'items-end' : 'items-start'} mb-1 msg-container">
                ${window.isGroupChat && !isMe ? `<span class="text-[10px] text-gray-400 mb-1 ml-1">${msg.sender_name}</span>` : ''}
                <div class="flex items-end gap-1.5 w-full ${align}">
                    
                    ${isMe ? `<div class="flex flex-col items-end gap-1">
                                <button onclick="deleteMessage('${msg.id}')" class="unsend-btn text-[10px] text-red-400 hover:text-red-600 bg-white shadow-sm px-1.5 rounded-md border border-red-100 whitespace-nowrap">回收</button>
                                <span class="text-[9px] text-gray-400 whitespace-nowrap">${timeStr}</span>
                              </div>` : ''}

                    <div class="${bg} px-4 py-2.5 ${borderRadius} shadow-sm max-w-[75%] break-words leading-relaxed text-sm relative group">
                        ${msg.image_url ? `<img src="${msg.image_url}" class="max-w-full rounded-lg mb-1 object-cover min-w-[120px]">` : ''}
                        ${msg.content ? `<span>${msg.content}</span>` : ''}
                    </div>

                    ${!isMe ? `<span class="text-[9px] text-gray-400 whitespace-nowrap">${timeStr}</span>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

// 刪除/回收訊息邏輯
window.deleteMessage = async function(msgId) {
    if (!msgId || !confirm("確定要回收這條訊息嗎？")) return;
    try {
        const { error } = await window.supabaseClient.from('messages').delete().match({ id: msgId, sender_name: myChatName });
        if(error) throw error;
        // 刪除成功後，更新本地快取並重繪
        window.currentRoomMessages = window.currentRoomMessages.filter(m => m.id !== msgId);
        drawMessages(window.currentRoomMessages);
    } catch(err) {
        console.error("回收失敗", err);
        alert("回收失敗，請確保有配置 id 欄位與對應權限");
    }
}

function setupRoomRealtime() {
    if (window.roomChannel) window.supabaseClient.removeChannel(window.roomChannel);
    window.roomChannel = window.supabaseClient.channel('room_' + window.activeRoomId)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${window.activeRoomId}` }, payload => {
            const newMsg = payload.new;
            window.currentRoomMessages.unshift(newMsg); // 加入快取頂部 (因為是 desc)
            
            // 如果沒在搜尋中，直接重繪並捲動到底部
            const searchVal = document.getElementById('room-search-input')?.value;
            if(!searchVal) drawMessages(window.currentRoomMessages);
            
            if (newMsg.sender_name !== myChatName) updateLastRead(window.activeChatTarget); 
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages', filter: `room_id=eq.${window.activeRoomId}` }, payload => {
            // 監聽別人的回收動作
            window.currentRoomMessages = window.currentRoomMessages.filter(m => m.id !== payload.old.id);
            drawMessages(window.currentRoomMessages);
        }).subscribe();
}

// 6. 發送動作 (支援群組)
window.handleSendAction = async function() {
    const input = document.getElementById('chat-input');
    const text = input.value;
    if (!text.trim() && !selectedImageFile) return;

    input.value = '';
    let uploadedImageUrl = null;
    const sendBtn = event.currentTarget;
    const originalBtnText = sendBtn.innerText;
    
    sendBtn.innerText = '傳送中...';
    sendBtn.disabled = true;

    if (selectedImageFile) {
        const fileName = `${Date.now()}_${selectedImageFile.name}`;
        try {
            const progress = document.getElementById('chat-upload-progress');
            if(progress) { progress.classList.remove('hidden'); progress.classList.add('flex'); }

            const { data: uploadData, error: uploadError } = await window.supabaseClient.storage.from('message-images').upload(fileName, selectedImageFile);
            if (uploadError) throw uploadError;

            const { data: publicUrlData } = window.supabaseClient.storage.from('message-images').getPublicUrl(fileName);
            uploadedImageUrl = publicUrlData.publicUrl;
            
            if(progress) { progress.classList.remove('flex'); progress.classList.add('hidden'); }
        } catch (err) {
            alert("圖片上傳失敗！");
            sendBtn.innerText = originalBtnText;
            sendBtn.disabled = false;
            return;
        }
        cancelImageSelection();
    }

    try {
        await window.supabaseClient.from('messages').insert([{
            room_id: window.activeRoomId, 
            sender_name: myChatName, 
            receiver: window.isGroupChat ? null : window.activeChatTarget, // 群組不指定 receiver
            content: text.trim() || null,
            image_url: uploadedImageUrl
        }]);
    } catch (err) {
        console.error("發送失敗", err);
    } finally {
        sendBtn.innerText = originalBtnText;
        sendBtn.disabled = false;
    }
};

// 7. 輔助功能 (預覽圖片與關閉)
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
    window.activeChatTarget = null;
    window.activeRoomId = null;
    window.isGroupChat = false;
    
    // 清除搜尋狀態
    const searchWrap = document.getElementById('room-search-wrapper');
    if(searchWrap) {
        searchWrap.classList.add('hidden');
        document.getElementById('room-search-input').value = "";
    }

    document.getElementById('chat-modal').classList.add('translate-x-full');
    setTimeout(() => {
        document.getElementById('chat-modal').classList.add('hidden');
        document.getElementById('chat-messages').innerHTML = ''; 
        cancelImageSelection();
    }, 300);
    renderMessages(); 
};

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => { setupGlobalRealtime(); renderMessages(); }, 500);
});
