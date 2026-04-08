// ==========================================
// js/messages.js - 商業級進化版 
// (加入圖片壓縮、懶加載、打字狀態、樂觀更新秒發送體驗、精準已讀修正)
// ==========================================

window.activeRoomId = null;
window.activeChatTarget = null;
window.isGroupChat = false;    
window.roomChannel = null;     
window.globalChannel = null;   
let selectedImageFile = null;
window.currentRoomMessages = []; 

// ★ 新增：打字狀態全域變數
window.typingUsers = new Set();
let typingClearTimer = null;

// 1. 初始化使用者與全局 UI
let myChatName = localStorage.getItem('myChatName') || "神秘使用者";

// ★ 新增：確保隨時獲取最新的使用者名稱，防止快取殘留[cite: 17]
function refreshMyName() {
    myChatName = localStorage.getItem('myChatName') || "神秘使用者";
}

document.addEventListener('DOMContentLoaded', () => {
    refreshMyName();
    const titleEl = document.getElementById('my-chat-title-name');
    if (titleEl) titleEl.innerText = myChatName;
});

if(!document.getElementById('enhanced-chat-style')){
    document.head.insertAdjacentHTML('beforeend', `
    <style id="enhanced-chat-style">
        .toast-enter { animation: slideDownFade 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
        .toast-leave { animation: slideUpFade 0.3s ease-in forwards; }
        .unsend-btn { opacity: 0; transition: opacity 0.2s; }
        .msg-container:hover .unsend-btn { opacity: 1; }
        .temp-msg { opacity: 0.6; pointer-events: none; } /* 發送中訊息變半透明 */
        @keyframes slideDownFade { from { transform: translateY(-100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes slideUpFade { from { transform: translateY(0); opacity: 1; } to { transform: translateY(-100%); opacity: 0; } }
    </style>
    `);
    if(!document.getElementById('global-toast-container')){
        document.body.insertAdjacentHTML('beforeend', `<div id="global-toast-container" class="fixed top-4 left-0 w-full px-4 z-[9999] pointer-events-none flex flex-col gap-2"></div>`);
    }
}

function generateRoomId(user1, user2) { return [user1, user2].sort().join('_'); }

// ★ 修正：已讀狀態核心邏輯 (解決本地與伺服器時間差)[cite: 17]
function getLastReadTimes() { 
    refreshMyName();
    return JSON.parse(localStorage.getItem(`lastRead_${myChatName}`) || '{}'); 
}

function updateLastRead(targetId, timestamp = null) {
    refreshMyName();
    const times = getLastReadTimes();
    // 如果有傳入特定資料庫時間則使用，否則使用本地時間 + 5秒容錯，避免設備時間過慢[cite: 17]
    const newTime = timestamp || (Date.now() + 5000); 
    
    // 保證時間只會往後推，不會被舊的時間覆蓋
    if (!times[targetId] || newTime > times[targetId]) {
        times[targetId] = newTime;
        localStorage.setItem(`lastRead_${myChatName}`, JSON.stringify(times));
    }
}

// 2. 好友與群組系統
function getFriends() { return JSON.parse(localStorage.getItem('myFriends')) || []; }
function getGroups() { return JSON.parse(localStorage.getItem('myGroups')) || []; }

window.addFriend = function() {
    refreshMyName();
    const friendName = prompt("請輸入你想添加的好友帳號：");
    if (!friendName || friendName.trim() === "") return;
    if (friendName.trim() === myChatName) return alert("不能添加自己為好友！");
    
    let friends = getFriends();
    if (!friends.includes(friendName.trim())) {
        friends.push(friendName.trim());
        localStorage.setItem('myFriends', JSON.stringify(friends));
        alert(`🎉 成功添加 ${friendName.trim()} 為好友！`);
        renderMessages(document.getElementById('inbox-search-input')?.value || ""); 
    }
}

window.createGroup = function() {
    refreshMyName();
    const groupName = prompt("請輸入群組名稱：");
    if (!groupName) return;
    const membersStr = prompt("請輸入群組成員帳號 (用逗號 , 隔開)：");
    let members = membersStr ? membersStr.split(',').map(m => m.trim()).filter(m => m) : [];
    members.push(myChatName); 
    
    const groupId = 'GROUP_' + Date.now();
    let groups = getGroups();
    groups.push({ id: groupId, name: groupName, members: [...new Set(members)] });
    localStorage.setItem('myGroups', JSON.stringify(groups));
    alert(`🎉 群組「${groupName}」創建成功！`);
    renderMessages(document.getElementById('inbox-search-input')?.value || "");
}

window.addGroupMember = function(groupId) {
    refreshMyName();
    const newMember = prompt("請輸入要加入的新成員帳號：");
    if (!newMember || newMember.trim() === "") return;
    if (newMember.trim() === myChatName) return alert("你已經在群組中了！");

    let groups = getGroups();
    let groupIndex = groups.findIndex(g => g.id === groupId);
    if(groupIndex !== -1) {
        if(groups[groupIndex].members.includes(newMember.trim())) {
            alert("該成員已在群組中！");
            return;
        }
        groups[groupIndex].members.push(newMember.trim());
        localStorage.setItem('myGroups', JSON.stringify(groups));
        alert(`🎉 成功將 ${newMember.trim()} 加入群組！`);
        renderMessages(document.getElementById('inbox-search-input')?.value || "");
    }
}

// 3. 渲染聊天列表
window.renderMessages = async function(searchKeyword = "") {
    refreshMyName();
    const container = document.getElementById('messages-list');
    if (!container) return;

    if(!searchKeyword && !window.initialInboxLoaded) {
        container.innerHTML = `<div class="text-center py-10"><i class="fa-solid fa-circle-notch fa-spin text-sexify text-2xl"></i><p class="mt-2 text-gray-400 text-sm">載入收件匣中...</p></div>`;
    }

    try {
        const { data: inboxData, error } = await window.supabaseClient
            .from('messages')
            .select('*')
            .or(`sender_name.eq.${myChatName},receiver.eq.${myChatName},room_id.ilike.GROUP_%`)
            .order('created_at', { ascending: false }); 

        if (error) throw error;
        window.initialInboxLoaded = true;

        let roomsMap = {};
        const lastReadTimes = getLastReadTimes();
        const myGroups = getGroups();

        (inboxData || []).forEach(msg => {
            if (!msg.room_id) msg.room_id = generateRoomId(msg.sender_name, msg.receiver || 'Unknown');
            
            const isGroup = msg.room_id.startsWith('GROUP_');
            let groupInfo = null;
            if (isGroup) {
                groupInfo = myGroups.find(g => g.id === msg.room_id);
                if (!groupInfo || !groupInfo.members.includes(myChatName)) return; 
            }

            const targetId = isGroup ? msg.room_id : (msg.sender_name === myChatName ? msg.receiver : msg.sender_name);
            if (!targetId) return;

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

            // 嚴格比對：只有訊息時間大於我們儲存的最後已讀時間，才算未讀
            if ((!isGroup && msg.receiver === myChatName) || (isGroup && msg.sender_name !== myChatName)) {
                if (msgTime > (lastReadTimes[targetId] || 0)) {
                    roomsMap[targetId].unreadCount++;
                }
            }
        });

        let inboxArray = Object.values(roomsMap);
        getFriends().forEach(f => {
            if (!inboxArray.find(r => r.id === f)) inboxArray.push({ id: f, isGroup: false, displayName: f, lastMsg: '點擊開始對話', time: '', timestamp: 0, unreadCount: 0 });
        });
        myGroups.forEach(g => {
            if (!inboxArray.find(r => r.id === g.id)) inboxArray.push({ id: g.id, isGroup: true, displayName: `👥 ${g.name}`, lastMsg: '新群組創建成功', time: '', timestamp: 0, unreadCount: 0 });
        });
        
        inboxArray.sort((a, b) => b.timestamp - a.timestamp);

        if (searchKeyword && searchKeyword.trim() !== "") {
            const kw = searchKeyword.toLowerCase();
            inboxArray = inboxArray.filter(chat => chat.displayName.toLowerCase().includes(kw) || chat.lastMsg.toLowerCase().includes(kw));
        }

        if(inboxArray.length === 0) {
            container.innerHTML = `<div class="text-center py-10 text-gray-400 text-sm">沒有找到相關訊息</div>`;
            return;
        }

        let html = inboxArray.map(chat => `
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
        `).join('');

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
            const isGroup = msg.room_id.startsWith('GROUP_');
            let isRelevant = false;
            
            if (!isGroup && msg.receiver === myChatName) isRelevant = true;
            if (isGroup && getGroups().find(g => g.id === msg.room_id)?.members.includes(myChatName) && msg.sender_name !== myChatName) isRelevant = true;

            if (isRelevant) {
                const activeId = isGroup ? msg.room_id : msg.sender_name;
                if (window.activeChatTarget === activeId) {
                    // 如果用戶正在看這個視窗，用這筆訊息的時間更新已讀，並 +1000ms 保證超越
                    updateLastRead(activeId, new Date(msg.created_at).getTime() + 1000);
                    return; 
                }
                const senderDisplay = isGroup ? `${msg.sender_name} (群組)` : msg.sender_name;
                showToastNotification(senderDisplay, msg.content || '傳送了一張圖片 🖼️', `https://i.pravatar.cc/150?u=${activeId}`);
                renderMessages(document.getElementById('inbox-search-input')?.value || ""); 
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
    refreshMyName();
    window.activeChatTarget = targetId;
    window.isGroupChat = isGroup;
    window.activeRoomId = isGroup ? targetId : generateRoomId(myChatName, targetId);
    window.typingUsers.clear(); // 清空舊的打字狀態

    updateLastRead(targetId); // 基礎已讀更新
    renderMessages(document.getElementById('inbox-search-input')?.value || "");

    const modal = document.getElementById('chat-modal');
    const chatMessages = document.getElementById('chat-messages');

    document.getElementById('chat-name').innerText = displayName;
    document.getElementById('chat-avatar').src = `https://i.pravatar.cc/150?u=${targetId}`;

    const actionsContainer = document.getElementById('chat-header-actions');
    let actionsHtml = '';
    if (isGroup) {
        actionsHtml += `<button onclick="addGroupMember('${targetId}')" class="w-8 h-8 flex items-center justify-center text-sexify rounded-full active:bg-gray-100 transition" title="加入成員"><i class="fa-solid fa-user-plus text-sm"></i></button>`;
    }
    actionsHtml += `<button onclick="document.getElementById('room-search-wrapper').classList.toggle('hidden')" class="w-8 h-8 flex items-center justify-center text-gray-500 rounded-full active:bg-gray-100 transition"><i class="fa-solid fa-magnifying-glass text-sm"></i></button>`;
    actionsContainer.innerHTML = actionsHtml;

    document.getElementById('room-search-input').value = "";
    document.getElementById('room-search-wrapper').classList.add('hidden');

    const chatInput = document.getElementById('chat-input');
    chatInput.oninput = () => {
        if (window.roomChannel) {
            window.roomChannel.send({
                type: 'broadcast',
                event: 'typing',
                payload: { sender: myChatName }
            });
        }
    };
    
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.remove('translate-x-full'), 10);
    chatMessages.innerHTML = `<div class="absolute inset-0 flex items-center justify-center text-gray-400 text-sm"><i class="fa-solid fa-spinner fa-spin mr-2"></i>載入中...</div>`;

    try {
        const { data, error } = await window.supabaseClient.from('messages')
            .select('*').eq('room_id', window.activeRoomId).order('created_at', { ascending: false });
        if (error) throw error;
        
        window.currentRoomMessages = data || [];
        
        // ★ 精準時間校對：以最新一則訊息的「伺服器時間」當作基準寫入已讀，徹底杜絕設備時間差導致的紅點殘留
        if (window.currentRoomMessages.length > 0) {
            const latestMsgTime = new Date(window.currentRoomMessages[0].created_at).getTime();
            updateLastRead(targetId, latestMsgTime + 1000); 
            renderMessages(document.getElementById('inbox-search-input')?.value || ""); // 再次重繪清除紅點
        }

        drawMessages(window.currentRoomMessages);
        setupRoomRealtime();
    } catch (err) { chatMessages.innerHTML = `<div class="absolute inset-0 flex items-center justify-center text-red-400">無法載入訊息</div>`; }
};

window.filterRoomMessages = function(keyword) {
    if(!keyword) return drawMessages(window.currentRoomMessages);
    const filtered = window.currentRoomMessages.filter(m => m.content && m.content.toLowerCase().includes(keyword.toLowerCase()));
    drawMessages(filtered, true); 
}

// ★ 渲染訊息 (加入打字狀態與發送中狀態、圖片懶加載)
function drawMessages(messages, isSearching = false) {
    const container = document.getElementById('chat-messages');
    
    // 渲染打字指示器 (放在最前面，因為是 flex-col-reverse)
    let typingHtml = '';
    if (window.typingUsers.size > 0 && !isSearching) {
        const usersArr = Array.from(window.typingUsers);
        const typingNames = window.isGroupChat ? usersArr.join(', ') : '';
        typingHtml = `
            <div class="flex items-end gap-1.5 mb-2 w-full justify-start msg-container">
                ${window.isGroupChat ? `<span class="text-[10px] text-gray-400 mb-1 ml-1">${typingNames}</span>` : ''}
                <div class="bg-white border border-gray-100 text-gray-500 px-4 py-2.5 rounded-2xl rounded-tl-sm text-sm shadow-sm flex items-center gap-1 animate-pulse">
                    正在輸入<span class="flex gap-0.5 ml-1"><div class="w-1 h-1 bg-gray-400 rounded-full animate-bounce"></div><div class="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.1s"></div><div class="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.2s"></div></span>
                </div>
            </div>
        `;
    }

    if (messages.length === 0 && !typingHtml) {
        container.innerHTML = `<div class="text-center text-gray-300 py-10 w-full text-xs">${isSearching ? '找不到相關訊息' : '開始你們的第一句話吧！'}</div>`;
        return;
    }

    const messagesHtml = messages.map(msg => {
        const isMe = msg.sender_name === myChatName;
        const align = isMe ? 'justify-end' : 'justify-start';
        const bg = isMe ? 'bg-sexify text-white' : 'bg-white border border-gray-100 text-gray-900';
        const borderRadius = isMe ? 'rounded-2xl rounded-tr-sm' : 'rounded-2xl rounded-tl-sm';
        const timeStr = new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false});
        // 判斷是否為「發送中」的臨時訊息
        const tempClass = msg.isTemp ? 'temp-msg' : ''; 
        
        return `
            <div id="msg-${msg.id}" class="flex flex-col ${isMe ? 'items-end' : 'items-start'} mb-1 msg-container ${tempClass}">
                ${window.isGroupChat && !isMe ? `<span class="text-[10px] text-gray-400 mb-1 ml-1">${msg.sender_name}</span>` : ''}
                <div class="flex items-end gap-1.5 w-full ${align}">
                    
                    ${isMe ? `<div class="flex flex-col items-end gap-1">
                                ${!msg.isTemp ? `<button onclick="deleteMessage('${msg.id}')" class="unsend-btn text-[10px] text-red-400 hover:text-red-600 bg-white shadow-sm px-1.5 rounded-md border border-red-100 whitespace-nowrap">回收</button>` : ''}
                                <span class="text-[9px] text-gray-400 whitespace-nowrap">${msg.isTemp ? '發送中...' : timeStr}</span>
                              </div>` : ''}

                    <div class="${bg} px-4 py-2.5 ${borderRadius} shadow-sm max-w-[75%] break-words leading-relaxed text-sm relative group">
                        ${msg.image_url ? `<img src="${msg.image_url}" loading="lazy" class="max-w-full rounded-lg mb-1 object-cover min-w-[120px] bg-gray-100">` : ''}
                        ${msg.content ? `<span>${msg.content}</span>` : ''}
                    </div>

                    ${!isMe ? `<span class="text-[9px] text-gray-400 whitespace-nowrap">${timeStr}</span>` : ''}
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = typingHtml + messagesHtml;
}

window.deleteMessage = async function(msgId) {
    if (!msgId || msgId.startsWith('temp_')) return;
    if (!confirm("確定要回收這條訊息嗎？")) return;

    const msgEl = document.getElementById('msg-' + msgId);
    if (msgEl) msgEl.style.display = 'none';

    try {
        const { error } = await window.supabaseClient.from('messages').delete().eq('id', msgId).eq('sender_name', myChatName); 
        if (error) throw error;
        window.currentRoomMessages = window.currentRoomMessages.filter(m => m.id !== msgId);
        if (msgEl) msgEl.remove();
        if(window.currentRoomMessages.length === 0) drawMessages([]);
    } catch (err) {
        if (msgEl) msgEl.style.display = ''; 
        alert("回收失敗，請檢查權限");
    }
};

function setupRoomRealtime() {
    if (window.roomChannel) window.supabaseClient.removeChannel(window.roomChannel);
    
    // ★ 加入 Broadcast 監聽打字狀態
    window.roomChannel = window.supabaseClient.channel('room_' + window.activeRoomId, {
        config: { broadcast: { ack: false } }
    })
    .on('broadcast', { event: 'typing' }, payload => {
        if (payload.payload.sender !== myChatName) {
            window.typingUsers.add(payload.payload.sender);
            drawMessages(window.currentRoomMessages);
            clearTimeout(typingClearTimer);
            typingClearTimer = setTimeout(() => {
                window.typingUsers.delete(payload.payload.sender);
                drawMessages(window.currentRoomMessages);
            }, 3000); // 3秒沒打字自動消失
        }
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${window.activeRoomId}` }, payload => {
        const newMsg = payload.new;
        
        // 如果是我自己發的，因為已經有樂觀更新 (temp message)，這時把舊的 temp 拔掉
        if (newMsg.sender_name === myChatName) {
            window.currentRoomMessages = window.currentRoomMessages.filter(m => !m.isTemp);
        }

        window.currentRoomMessages.unshift(newMsg); 
        const searchVal = document.getElementById('room-search-input')?.value;
        if(!searchVal) drawMessages(window.currentRoomMessages);
        
        if (newMsg.sender_name !== myChatName) {
            window.typingUsers.delete(newMsg.sender_name); // 對方發送完畢，取消打字狀態
            // 使用新訊息的伺服器時間寫入已讀[cite: 17]
            updateLastRead(window.activeChatTarget, new Date(newMsg.created_at).getTime() + 1000); 
        }
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages', filter: `room_id=eq.${window.activeRoomId}` }, payload => {
        window.currentRoomMessages = window.currentRoomMessages.filter(m => m.id !== payload.old.id);
        const msgEl = document.getElementById('msg-' + payload.old.id);
        if(msgEl) msgEl.remove();
        if(window.currentRoomMessages.length === 0) drawMessages([]);
    }).subscribe();
}

// ★ 前端 Canvas 圖片壓縮器
window.compressImage = function(file, maxWidth = 1200, quality = 0.8) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = e => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob(blob => {
                    resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
                }, 'image/jpeg', quality);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
};

// 6. 發送動作
window.handleSendAction = async function() {
    refreshMyName();
    const input = document.getElementById('chat-input');
    const text = input.value;
    if (!text.trim() && !selectedImageFile) return;

    const tempImageUrl = selectedImageFile ? document.getElementById('chat-image-preview').src : null;
    const originalFile = selectedImageFile;

    // 清空 UI，讓用戶覺得「已經發出去了」
    input.value = '';
    cancelImageSelection();

    // 建立臨時的虛擬訊息 (樂觀更新)
    const tempMsg = {
        id: 'temp_' + Date.now(),
        sender_name: myChatName,
        content: text.trim() || null,
        image_url: tempImageUrl,
        created_at: new Date().toISOString(),
        isTemp: true // 標記為臨時
    };
    
    window.currentRoomMessages.unshift(tempMsg);
    drawMessages(window.currentRoomMessages);

    let uploadedImageUrl = null;

    if (originalFile) {
        try {
            // 進行壓縮再上傳
            const compressedFile = await window.compressImage(originalFile);
            const fileName = `${Date.now()}_${compressedFile.name}`;
            
            const { data: uploadData, error: uploadError } = await window.supabaseClient.storage.from('message-images').upload(fileName, compressedFile);
            if (uploadError) throw uploadError;

            const { data: publicUrlData } = window.supabaseClient.storage.from('message-images').getPublicUrl(fileName);
            uploadedImageUrl = publicUrlData.publicUrl;
        } catch (err) {
            alert("圖片壓縮或上傳失敗，請重試！");
            window.currentRoomMessages = window.currentRoomMessages.filter(m => m.id !== tempMsg.id);
            drawMessages(window.currentRoomMessages);
            return;
        }
    }

    try {
        await window.supabaseClient.from('messages').insert([{
            room_id: window.activeRoomId, 
            sender_name: myChatName, 
            receiver: window.isGroupChat ? null : window.activeChatTarget,
            content: tempMsg.content,
            image_url: uploadedImageUrl
        }]);
    } catch (err) {
        console.error("發送失敗", err);
        window.currentRoomMessages = window.currentRoomMessages.filter(m => m.id !== tempMsg.id);
        drawMessages(window.currentRoomMessages);
    }
};

// 7. 輔助功能
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
    window.typingUsers.clear();
    
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
    renderMessages(document.getElementById('inbox-search-input')?.value || ""); 
};

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => { setupGlobalRealtime(); renderMessages(); }, 500);
});
