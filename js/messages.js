// ==========================================
// js/messages.js - 完美升級版 (未讀計數 + 由下至上顯示)
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

// 注入通知彈窗 CSS (如果還沒有的話)
if(!document.getElementById('global-toast-container')){
    document.head.insertAdjacentHTML('beforeend', `
    <style>
        .toast-enter { animation: slideDownFade 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
        .toast-leave { animation: slideUpFade 0.3s ease-in forwards; }
        @keyframes slideDownFade { from { transform: translateY(-100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes slideUpFade { from { transform: translateY(0); opacity: 1; } to { transform: translateY(-100%); opacity: 0; } }
    </style>
    `);
    document.body.insertAdjacentHTML('beforeend', `<div id="global-toast-container" class="fixed top-4 left-0 w-full px-4 z-[9999] pointer-events-none flex flex-col gap-2"></div>`);
}

function generateRoomId(user1, user2) {
    return [user1, user2].sort().join('_');
}

// 輔助函式：取得與更新最後閱讀時間 (用於未讀計數)
function getLastReadTimes() {
    return JSON.parse(localStorage.getItem(`lastRead_${myChatName}`) || '{}');
}
function updateLastRead(targetUser) {
    const times = getLastReadTimes();
    times[targetUser] = Date.now();
    localStorage.setItem(`lastRead_${myChatName}`, JSON.stringify(times));
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

// 3. 渲染收件匣 (新增精準未讀計數)
window.renderMessages = async function() {
    const container = document.getElementById('messages-list');
    if (!container) return;

    container.innerHTML = `<div class="text-center py-10"><i class="fa-solid fa-circle-notch fa-spin text-sexify text-2xl"></i><p class="mt-2 text-gray-400 text-sm">載入收件匣中...</p></div>`;

    try {
        const { data: inboxData, error } = await window.supabaseClient
            .from('messages')
            .select('*')
            .or(`sender_name.eq.${myChatName},receiver.eq.${myChatName}`)
            .order('created_at', { ascending: false }); 

        if (error) throw error;

        let roomsMap = {};
        const lastReadTimes = getLastReadTimes();

        (inboxData || []).forEach(msg => {
            const targetUser = msg.sender_name === myChatName ? msg.receiver : msg.sender_name;
            const msgTime = new Date(msg.created_at).getTime();

            // 如果是這個房間的最新一筆訊息
            if (!roomsMap[targetUser]) {
                roomsMap[targetUser] = {
                    targetUser: targetUser,
                    lastMsg: msg.content || (msg.image_url ? '傳送了一張圖片 🖼️' : ''),
                    time: new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
                    timestamp: msgTime,
                    unreadCount: 0
                };
            }

            // 如果我是接收者，且訊息時間晚於我最後一次打開這對話的時間，則未讀+1
            if (msg.receiver === myChatName && msgTime > (lastReadTimes[targetUser] || 0)) {
                roomsMap[targetUser].unreadCount++;
            }
        });

        // 確保沒有對話紀錄的好友也會顯示出來
        let inboxArray = Object.values(roomsMap);
        let friends = getFriends();
        friends.forEach(f => {
            if (!inboxArray.find(r => r.targetUser === f)) {
                inboxArray.push({ targetUser: f, lastMsg: '點擊開始對話', time: '', timestamp: 0, unreadCount: 0 });
            }
        });
        
        // 依據最後對話時間排序
        inboxArray.sort((a, b) => b.timestamp - a.timestamp);

        let html = `
            <div class="p-4 bg-white border-b border-gray-100 sticky top-0 z-10 flex justify-between items-center">
                <h2 class="font-black text-xl text-gray-800">${myChatName}</h2>
                <button onclick="addFriend()" class="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-800 active:scale-90 transition shadow-sm">
                    <i class="fa-solid fa-user-plus"></i>
                </button>
            </div>
        `;

        if (inboxArray.length === 0) {
            html += `<div class="text-center text-gray-400 py-20"><p>目前沒有訊息，快去添加好友！</p></div>`;
        } else {
            html += `<div class="pb-20 divide-y divide-gray-50">` + inboxArray.map(chat => `
                <div class="flex items-center gap-4 p-4 active:bg-gray-50 transition cursor-pointer" onclick="openChat('${chat.targetUser}')">
                    <div class="relative flex-shrink-0">
                        <img src="https://i.pravatar.cc/150?u=${chat.targetUser}" class="w-14 h-14 rounded-full border border-gray-100 object-cover">
                        ${chat.unreadCount > 0 ? `
                            <span class="absolute -top-1 -right-1 bg-sexify text-white text-[10px] min-w-[20px] h-[20px] flex items-center justify-center rounded-full border-2 border-white font-bold px-1 shadow-sm">
                                ${chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                            </span>` : ''}
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex justify-between items-center mb-1">
                            <h3 class="font-bold text-gray-900">${chat.targetUser}</h3>
                            <span class="text-[10px] text-gray-400 font-medium">${chat.time}</span>
                        </div>
                        <p class="text-sm truncate ${chat.unreadCount > 0 ? 'text-gray-900 font-bold' : 'text-gray-500'}">${chat.lastMsg}</p>
                    </div>
                </div>
            `).join('') + `</div>`;
        }
        container.innerHTML = html;
    } catch (err) {
        console.error("連線錯誤:", err);
        container.innerHTML = `<div class="text-center text-red-400 py-10">資料庫連線失敗</div>`;
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
            // 如果當前正在與對方聊天，則自動標記為已讀且不彈出通知
            if (window.activeChatTarget === msg.sender_name) {
                updateLastRead(msg.sender_name);
                return; 
            }
            showToastNotification(msg.sender_name, msg.content || '傳送了一張圖片 🖼️', `https://i.pravatar.cc/150?u=${msg.sender_name}`);
            renderMessages(); // 即時更新外面列表的未讀數字
        }).subscribe();
}

function showToastNotification(sender, text, avatar) {
    const container = document.getElementById('global-toast-container');
    const toast = document.createElement('div');
    toast.className = `toast-enter pointer-events-auto w-full max-w-sm mx-auto bg-white shadow-xl rounded-2xl p-4 flex items-center gap-3 border border-gray-100 cursor-pointer`;
    toast.innerHTML = `
        <img src="${avatar}" class="w-10 h-10 rounded-full object-cover">
        <div class="flex-1 min-w-0">
            <p class="text-sm font-bold text-gray-900">${sender} 傳來了新訊息</p>
            <p class="text-sm text-gray-500 truncate">${text}</p>
        </div>
    `;
    toast.onclick = () => { toast.remove(); openChat(sender); };
    container.appendChild(toast);
    setTimeout(() => { toast.classList.replace('toast-enter', 'toast-leave'); setTimeout(() => toast.remove(), 300); }, 4000);
}

// 5. 聊天室邏輯 (修正排序，適配 flex-col-reverse)
window.openChat = async function(targetName) {
    window.activeChatTarget = targetName;
    window.activeRoomId = generateRoomId(myChatName, targetName);

    // 一進入聊天室，馬上更新已讀時間並消除紅點
    updateLastRead(targetName);
    renderMessages();

    const modal = document.getElementById('chat-modal');
    const chatMessages = document.getElementById('chat-messages');

    document.getElementById('chat-name').innerText = targetName;
    document.getElementById('chat-avatar').src = `https://i.pravatar.cc/150?u=${targetName}`;

    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.remove('translate-x-full'), 10);
    chatMessages.innerHTML = `<div class="absolute inset-0 flex items-center justify-center text-gray-400 text-sm"><i class="fa-solid fa-spinner fa-spin mr-2"></i>載入中...</div>`;

    try {
        // 使用 descending (最新在最前面) 配合 HTML 的 flex-col-reverse
        const { data, error } = await window.supabaseClient.from('messages')
            .select('*').eq('room_id', window.activeRoomId).order('created_at', { ascending: false });
        if (error) throw error;
        
        drawMessages(data || []);
        setupRoomRealtime();
    } catch (err) { 
        console.error(err); 
        chatMessages.innerHTML = `<div class="absolute inset-0 flex items-center justify-center text-red-400">無法載入訊息</div>`;
    }
};

function drawMessages(messages) {
    const container = document.getElementById('chat-messages');
    
    // 因為資料已經是最新在前面，配合 index.html 中 chat-messages 的 flex-col-reverse，
    // 最新的 DOM 會被推到底部，這是完美的行為。
    if (messages.length === 0) {
        container.innerHTML = `<div class="text-center text-gray-300 py-10 w-full text-xs">開始你們的第一句話吧！</div>`;
        return;
    }

    container.innerHTML = messages.map(msg => {
        const isMe = msg.sender_name === myChatName;
        const align = isMe ? 'justify-end' : 'justify-start';
        const bg = isMe ? 'bg-sexify text-white' : 'bg-white border border-gray-100 text-gray-900';
        const borderRadius = isMe ? 'rounded-2xl rounded-tr-sm' : 'rounded-2xl rounded-tl-sm';
        
        return `
            <div class="flex ${align}">
                <div class="${bg} px-4 py-2.5 ${borderRadius} shadow-sm max-w-[75%] break-words leading-relaxed text-sm">
                    ${msg.image_url ? `<img src="${msg.image_url}" class="max-w-full rounded-lg mb-1 object-cover min-w-[120px]">` : ''}
                    ${msg.content ? `<span>${msg.content}</span>` : ''}
                </div>
            </div>
        `;
    }).join('');
    
    // 確保捲軸在最底下
    container.scrollTop = container.scrollHeight;
}

function setupRoomRealtime() {
    if (window.roomChannel) window.supabaseClient.removeChannel(window.roomChannel);
    window.roomChannel = window.supabaseClient.channel('room_' + window.activeRoomId)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${window.activeRoomId}` }, payload => {
            const newMsg = payload.new;
            const container = document.getElementById('chat-messages');
            
            // 移除可能存在的「開始第一句話」提示
            if(container.querySelector('.text-gray-300')) container.innerHTML = '';

            const isMe = newMsg.sender_name === myChatName;
            const align = isMe ? 'justify-end' : 'justify-start';
            const bg = isMe ? 'bg-sexify text-white' : 'bg-white border border-gray-100 text-gray-900';
            const borderRadius = isMe ? 'rounded-2xl rounded-tr-sm' : 'rounded-2xl rounded-tl-sm';
            
            const msgDiv = document.createElement('div');
            msgDiv.className = `flex ${align}`;
            msgDiv.innerHTML = `<div class="${bg} px-4 py-2.5 ${borderRadius} shadow-sm max-w-[75%] break-words leading-relaxed text-sm">${newMsg.image_url ? `<img src="${newMsg.image_url}" class="max-w-full rounded-lg mb-1 object-cover min-w-[120px]">`:''}${newMsg.content ? `<span>${newMsg.content}</span>` : ''}</div>`;
            
            // 使用 prepend 將新訊息塞在陣列最前端 (因為是 flex-col-reverse，前端等同於視覺的最下方)
            container.prepend(msgDiv);
            container.scrollTop = container.scrollHeight;

            if (!isMe) {
                updateLastRead(newMsg.sender_name); // 既然打開著，自動標記已讀
            }
        }).subscribe();
}

// 6. 發送動作 (加入上傳防呆與 Loading)
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
            // 顯示圖片預覽上的 Loading 轉圈圈
            const progress = document.getElementById('chat-upload-progress');
            if(progress) { progress.classList.remove('hidden'); progress.classList.add('flex'); }

            const { data: uploadData, error: uploadError } = await window.supabaseClient.storage
                .from('message-images') 
                .upload(fileName, selectedImageFile);
            if (uploadError) throw uploadError;

            const { data: publicUrlData } = window.supabaseClient.storage
                .from('message-images')
                .getPublicUrl(fileName);
            uploadedImageUrl = publicUrlData.publicUrl;
            
            if(progress) { progress.classList.remove('flex'); progress.classList.add('hidden'); }
        } catch (err) {
            alert("圖片上傳失敗，請確認 Storage 名稱為 message-images 且 RLS 已開放");
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
            receiver: window.activeChatTarget,
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
    document.getElementById('chat-modal').classList.add('translate-x-full');
    setTimeout(() => {
        document.getElementById('chat-modal').classList.add('hidden');
        document.getElementById('chat-messages').innerHTML = ''; // 清理殘留畫面
        cancelImageSelection();
    }, 300);
    renderMessages(); // 關閉時重整一次列表，確保未讀歸零
};

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        setupGlobalRealtime();
        renderMessages();
    }, 500);
});
