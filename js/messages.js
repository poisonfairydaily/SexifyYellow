// ==========================================
// js/messages.js - 完美升級版 (含語音、個人主頁、粉絲名單)
// ==========================================

window.activeRoomId = null;
window.activeChatTarget = null;
window.roomChannel = null;     
window.globalChannel = null;   
let selectedImageFile = null;

// 語音錄製相關變數
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

// 1. 初始化使用者與全局 UI
let myChatName = localStorage.getItem('myChatName');
if (!myChatName) {
    let name = prompt("【IG風格聊天室】請輸入你的專屬帳號：", "User_" + Math.floor(Math.random() * 10000));
    localStorage.setItem('myChatName', name || "神秘使用者");
    myChatName = localStorage.getItem('myChatName');
}

// 注入全局 UI 與彈窗 CSS
if(!document.getElementById('global-toast-container')){
    document.head.insertAdjacentHTML('beforeend', `
    <style>
        .toast-enter { animation: slideDownFade 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
        .toast-leave { animation: slideUpFade 0.3s ease-in forwards; }
        @keyframes slideDownFade { from { transform: translateY(-100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes slideUpFade { from { transform: translateY(0); opacity: 1; } to { transform: translateY(-100%); opacity: 0; } }
        .recording-pulse { animation: pulseRed 1.5s infinite; }
        @keyframes pulseRed { 0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); } 70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); } 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); } }
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

// ==========================================
// 2. 好友與粉絲系統 (新增：直接進入聊天或專頁)
// ==========================================
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

// 開啟粉絲與訂閱列表 (自動生成 UI 保證可用)
window.openFansModal = function() {
    let modal = document.getElementById('fans-modal');
    if (!modal) {
        document.body.insertAdjacentHTML('beforeend', `
            <div id="fans-modal" class="fixed inset-0 bg-black bg-opacity-50 z-[9999] hidden flex items-center justify-center backdrop-blur-sm">
                <div class="bg-white w-full max-w-md rounded-2xl shadow-xl flex flex-col max-h-[80vh] overflow-hidden">
                    <div class="p-4 border-b flex justify-between items-center">
                        <h2 class="font-bold text-lg">粉絲與訂閱</h2>
                        <button onclick="document.getElementById('fans-modal').classList.add('hidden')" class="text-gray-500 hover:text-gray-800"><i class="fa-solid fa-times text-xl"></i></button>
                    </div>
                    <div id="fans-list" class="p-4 overflow-y-auto flex-1 divide-y"></div>
                </div>
            </div>
        `);
        modal = document.getElementById('fans-modal');
    }
    
    const listContainer = document.getElementById('fans-list');
    const friends = getFriends();
    
    if (friends.length === 0) {
        listContainer.innerHTML = `<div class="text-center text-gray-400 py-10">目前還沒有粉絲或好友</div>`;
    } else {
        listContainer.innerHTML = friends.map(f => {
            const avatarUrl = localStorage.getItem(`avatar_${f}`) || `https://i.pravatar.cc/150?u=${f}`;
            return `
            <div class="flex items-center justify-between py-3">
                <div class="flex items-center gap-3 cursor-pointer" onclick="openProfile('${f}')">
                    <img src="${avatarUrl}" class="w-10 h-10 rounded-full object-cover border border-gray-200">
                    <span class="font-bold text-gray-800">${f}</span>
                </div>
                <div class="flex gap-2">
                    <button onclick="openChat('${f}'); document.getElementById('fans-modal').classList.add('hidden');" class="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-blue-100 transition">
                        <i class="fa-solid fa-comment-dots mr-1"></i>私訊
                    </button>
                    <button onclick="openProfile('${f}')" class="bg-gray-50 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-gray-200 transition">
                        專頁
                    </button>
                </div>
            </div>
        `}).join('');
    }
    modal.classList.remove('hidden');
}

// ==========================================
// 3. 個人專頁系統 (支援更換頭像與 Banner)
// ==========================================
window.openProfile = function(targetUser) {
    let modal = document.getElementById('profile-modal');
    if (!modal) {
        document.body.insertAdjacentHTML('beforeend', `
            <div id="profile-modal" class="fixed inset-0 bg-white z-[9999] hidden flex-col transition-transform duration-300 translate-x-full">
                <div class="relative h-48 bg-gray-200 group">
                    <img id="profile-banner" src="" class="w-full h-full object-cover">
                    <button id="btn-edit-banner" onclick="document.getElementById('input-banner').click()" class="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center text-white opacity-0 transition group-hover:opacity-100 hidden">
                        <i class="fa-solid fa-camera text-2xl"></i> 更換封面
                    </button>
                    <input type="file" id="input-banner" accept="image/*" class="hidden" onchange="uploadProfileImage(this, 'banner')">
                    <button onclick="closeProfile()" class="absolute top-4 left-4 w-10 h-10 bg-black bg-opacity-50 rounded-full text-white flex items-center justify-center backdrop-blur-md">
                        <i class="fa-solid fa-arrow-left"></i>
                    </button>
                </div>
                <div class="px-6 relative pb-6 border-b">
                    <div class="relative w-24 h-24 -mt-12 mb-4 group rounded-full">
                        <img id="profile-avatar" src="" class="w-full h-full rounded-full border-4 border-white object-cover bg-white shadow-sm">
                        <button id="btn-edit-avatar" onclick="document.getElementById('input-avatar').click()" class="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center text-white opacity-0 transition group-hover:opacity-100 rounded-full hidden">
                            <i class="fa-solid fa-camera"></i>
                        </button>
                        <input type="file" id="input-avatar" accept="image/*" class="hidden" onchange="uploadProfileImage(this, 'avatar')">
                    </div>
                    <h2 id="profile-name" class="font-black text-2xl text-gray-900"></h2>
                    <p class="text-gray-500 mt-1">在這裡分享生活點滴...</p>
                    <div class="mt-4 flex gap-3" id="profile-actions"></div>
                </div>
            </div>
        `);
        modal = document.getElementById('profile-modal');
    }

    const isMe = targetUser === myChatName;
    const bannerImg = localStorage.getItem(`banner_${targetUser}`) || 'https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?q=80&w=1000&auto=format&fit=crop';
    const avatarImg = localStorage.getItem(`avatar_${targetUser}`) || `https://i.pravatar.cc/150?u=${targetUser}`;

    document.getElementById('profile-banner').src = bannerImg;
    document.getElementById('profile-avatar').src = avatarImg;
    document.getElementById('profile-name').innerText = targetUser;

    // 權限控制：只有自己可以換頭像/Banner
    document.getElementById('btn-edit-banner').style.display = isMe ? 'flex' : 'none';
    document.getElementById('btn-edit-avatar').style.display = isMe ? 'flex' : 'none';

    // 動作按鈕：如果是別人，顯示私訊按鈕
    const actionContainer = document.getElementById('profile-actions');
    if (isMe) {
        actionContainer.innerHTML = `<button class="flex-1 bg-gray-100 text-gray-800 py-2 rounded-xl font-bold">編輯個人檔案</button>`;
    } else {
        actionContainer.innerHTML = `<button onclick="closeProfile(); openChat('${targetUser}');" class="flex-1 bg-blue-600 text-white py-2 rounded-xl font-bold shadow-md shadow-blue-200">私訊</button>`;
    }

    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.remove('translate-x-full'), 10);
}

window.closeProfile = function() {
    const modal = document.getElementById('profile-modal');
    modal.classList.add('translate-x-full');
    setTimeout(() => modal.classList.add('hidden'), 300);
}

// 處理頭像與 Banner 上傳
window.uploadProfileImage = async function(input, type) {
    const file = input.files[0];
    if (!file) return;

    const toast = document.createElement('div');
    toast.className = "fixed bottom-10 left-1/2 transform -translate-x-1/2 bg-black text-white px-4 py-2 rounded-full z-[9999]";
    toast.innerText = "上傳中...";
    document.body.appendChild(toast);

    const fileName = `${myChatName}_${type}_${Date.now()}`;
    try {
        const { data, error } = await window.supabaseClient.storage
            .from('profile-images') 
            .upload(fileName, file, { upsert: true });
        
        if (error) throw error;

        const { data: publicUrlData } = window.supabaseClient.storage
            .from('profile-images')
            .getPublicUrl(fileName);
        
        const imageUrl = publicUrlData.publicUrl;
        
        // 儲存至 LocalStorage 以供快速讀取 (實務上也可存入 profiles table)
        localStorage.setItem(`${type}_${myChatName}`, imageUrl);
        
        // 立即更新畫面
        document.getElementById(`profile-${type}`).src = imageUrl;
        toast.innerText = "更新成功！";
    } catch (err) {
        console.error("上傳失敗:", err);
        toast.innerText = "上傳失敗，請檢查 Storage 是否有 profile-images";
    }
    setTimeout(() => toast.remove(), 2000);
}

// ==========================================
// 4. 收件匣渲染 (包含文字、圖片、語音提示)
// ==========================================
window.renderMessages = async function() {
    const container = document.getElementById('messages-list');
    if (!container) return;

    container.innerHTML = `<div class="text-center py-10"><i class="fa-solid fa-circle-notch fa-spin text-blue-500 text-2xl"></i><p class="mt-2 text-gray-400 text-sm">載入收件匣中...</p></div>`;

    try {
        const { data: inboxData, error } = await window.supabaseClient
            .from('messages') //[cite: 25]
            .select('*')
            .or(`sender_name.eq.${myChatName},receiver.eq.${myChatName}`)
            .order('created_at', { ascending: false }); 

        if (error) throw error;

        let roomsMap = {};
        const lastReadTimes = getLastReadTimes();

        (inboxData || []).forEach(msg => {
            const targetUser = msg.sender_name === myChatName ? msg.receiver : msg.sender_name;
            const msgTime = new Date(msg.created_at).getTime();

            if (!roomsMap[targetUser]) {
                let displayMsg = msg.content || '';
                if (msg.image_url) displayMsg = '傳送了一張圖片 🖼️';
                if (msg.audio_url) displayMsg = '傳送了一則語音 🎤';

                roomsMap[targetUser] = {
                    targetUser: targetUser,
                    lastMsg: displayMsg,
                    time: new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
                    timestamp: msgTime,
                    unreadCount: 0
                };
            }

            if (msg.receiver === myChatName && msgTime > (lastReadTimes[targetUser] || 0)) {
                roomsMap[targetUser].unreadCount++;
            }
        });

        let inboxArray = Object.values(roomsMap);
        let friends = getFriends();
        friends.forEach(f => {
            if (!inboxArray.find(r => r.targetUser === f)) {
                inboxArray.push({ targetUser: f, lastMsg: '點擊開始對話', time: '', timestamp: 0, unreadCount: 0 });
            }
        });
        
        inboxArray.sort((a, b) => b.timestamp - a.timestamp);

        let html = `
            <div class="p-4 bg-white border-b border-gray-100 sticky top-0 z-10 flex justify-between items-center">
                <div class="flex items-center gap-3 cursor-pointer" onclick="openProfile('${myChatName}')">
                    <img src="${localStorage.getItem(`avatar_${myChatName}`) || `https://i.pravatar.cc/150?u=${myChatName}`}" class="w-10 h-10 rounded-full object-cover">
                    <h2 class="font-black text-xl text-gray-800">${myChatName}</h2>
                </div>
                <div class="flex gap-2">
                    <button onclick="openFansModal()" class="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-800 active:scale-90 transition shadow-sm">
                        <i class="fa-solid fa-users"></i>
                    </button>
                    <button onclick="addFriend()" class="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-800 active:scale-90 transition shadow-sm">
                        <i class="fa-solid fa-user-plus"></i>
                    </button>
                </div>
            </div>
        `;

        if (inboxArray.length === 0) {
            html += `<div class="text-center text-gray-400 py-20"><p>目前沒有訊息，快去添加好友！</p></div>`;
        } else {
            html += `<div class="pb-20 divide-y divide-gray-50">` + inboxArray.map(chat => `
                <div class="flex items-center gap-4 p-4 active:bg-gray-50 transition cursor-pointer" onclick="openChat('${chat.targetUser}')">
                    <div class="relative flex-shrink-0">
                        <img src="${localStorage.getItem(`avatar_${chat.targetUser}`) || `https://i.pravatar.cc/150?u=${chat.targetUser}`}" class="w-14 h-14 rounded-full border border-gray-100 object-cover">
                        ${chat.unreadCount > 0 ? `
                            <span class="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] min-w-[20px] h-[20px] flex items-center justify-center rounded-full border-2 border-white font-bold px-1 shadow-sm">
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

// ==========================================
// 5. 全局通知
// ==========================================
function setupGlobalRealtime() {
    if (window.globalChannel) return;
    window.globalChannel = window.supabaseClient.channel('global_notifications')
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'messages', //[cite: 25]
            filter: `receiver=eq.${myChatName}`
        }, payload => {
            const msg = payload.new;
            if (window.activeChatTarget === msg.sender_name) {
                updateLastRead(msg.sender_name);
                return; 
            }
            
            let displayMsg = msg.content || '';
            if (msg.image_url) displayMsg = '傳送了一張圖片 🖼️';
            if (msg.audio_url) displayMsg = '傳送了一則語音 🎤';

            const avatarUrl = localStorage.getItem(`avatar_${msg.sender_name}`) || `https://i.pravatar.cc/150?u=${msg.sender_name}`;
            showToastNotification(msg.sender_name, displayMsg, avatarUrl);
            renderMessages();
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

// ==========================================
// 6. 聊天室邏輯 (支援文字、圖片、語音渲染)
// ==========================================
window.openChat = async function(targetName) {
    window.activeChatTarget = targetName;
    window.activeRoomId = generateRoomId(myChatName, targetName);

    updateLastRead(targetName);
    renderMessages();

    const modal = document.getElementById('chat-modal');
    const chatMessages = document.getElementById('chat-messages');

    document.getElementById('chat-name').innerText = targetName;
    document.getElementById('chat-avatar').src = localStorage.getItem(`avatar_${targetName}`) || `https://i.pravatar.cc/150?u=${targetName}`;
    
    // 讓聊天室頭像也能點擊進入專頁
    document.getElementById('chat-avatar').onclick = () => openProfile(targetName);
    document.getElementById('chat-avatar').style.cursor = 'pointer';

    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.remove('translate-x-full'), 10);
    chatMessages.innerHTML = `<div class="absolute inset-0 flex items-center justify-center text-gray-400 text-sm"><i class="fa-solid fa-spinner fa-spin mr-2"></i>載入中...</div>`;

    // 為聊天輸入框旁邊加上語音按鈕 (防呆動態注入)
    const inputContainer = document.getElementById('chat-input').parentElement;
    if (!document.getElementById('btn-voice-record')) {
        inputContainer.insertAdjacentHTML('afterend', `
            <button id="btn-voice-record" onmousedown="startVoiceRecord()" onmouseup="stopVoiceRecord()" ontouchstart="startVoiceRecord()" ontouchend="stopVoiceRecord()" class="ml-2 w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 transition flex-shrink-0">
                <i class="fa-solid fa-microphone"></i>
            </button>
        `);
    }

    try {
        const { data, error } = await window.supabaseClient.from('messages') //[cite: 25]
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
    
    if (messages.length === 0) {
        container.innerHTML = `<div class="text-center text-gray-300 py-10 w-full text-xs">開始你們的第一句話吧！</div>`;
        return;
    }

    container.innerHTML = messages.map(msg => {
        const isMe = msg.sender_name === myChatName;
        const align = isMe ? 'justify-end' : 'justify-start';
        const bg = isMe ? 'bg-blue-600 text-white' : 'bg-white border border-gray-100 text-gray-900';
        const borderRadius = isMe ? 'rounded-2xl rounded-tr-sm' : 'rounded-2xl rounded-tl-sm';
        
        let mediaHtml = '';
        if (msg.image_url) mediaHtml += `<img src="${msg.image_url}" class="max-w-full rounded-lg mb-1 object-cover min-w-[120px]">`;
        if (msg.audio_url) mediaHtml += `<audio controls src="${msg.audio_url}" class="w-48 h-10 ${isMe ? 'opacity-90' : ''}"></audio>`;

        return `
            <div class="flex ${align}">
                <div class="${bg} px-4 py-2.5 ${borderRadius} shadow-sm max-w-[75%] break-words leading-relaxed text-sm">
                    ${mediaHtml}
                    ${msg.content ? `<span>${msg.content}</span>` : ''}
                </div>
            </div>
        `;
    }).join('');
    
    container.scrollTop = container.scrollHeight;
}

function setupRoomRealtime() {
    if (window.roomChannel) window.supabaseClient.removeChannel(window.roomChannel);
    window.roomChannel = window.supabaseClient.channel('room_' + window.activeRoomId)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${window.activeRoomId}` }, payload => { //[cite: 25]
            const newMsg = payload.new;
            const container = document.getElementById('chat-messages');
            
            if(container.querySelector('.text-gray-300')) container.innerHTML = '';

            const isMe = newMsg.sender_name === myChatName;
            const align = isMe ? 'justify-end' : 'justify-start';
            const bg = isMe ? 'bg-blue-600 text-white' : 'bg-white border border-gray-100 text-gray-900';
            const borderRadius = isMe ? 'rounded-2xl rounded-tr-sm' : 'rounded-2xl rounded-tl-sm';
            
            let mediaHtml = '';
            if (newMsg.image_url) mediaHtml += `<img src="${newMsg.image_url}" class="max-w-full rounded-lg mb-1 object-cover min-w-[120px]">`;
            if (newMsg.audio_url) mediaHtml += `<audio controls src="${newMsg.audio_url}" class="w-48 h-10 ${isMe ? 'opacity-90' : ''}"></audio>`;

            const msgDiv = document.createElement('div');
            msgDiv.className = `flex ${align}`;
            msgDiv.innerHTML = `<div class="${bg} px-4 py-2.5 ${borderRadius} shadow-sm max-w-[75%] break-words leading-relaxed text-sm">${mediaHtml}${newMsg.content ? `<span>${newMsg.content}</span>` : ''}</div>`;
            
            container.prepend(msgDiv);
            container.scrollTop = container.scrollHeight;

            if (!isMe) {
                updateLastRead(newMsg.sender_name); 
            }
        }).subscribe();
}

// ==========================================
// 7. 發送動作 (整合文字、圖片)
// ==========================================
window.handleSendAction = async function() {
    const input = document.getElementById('chat-input');
    const text = input.value;
    if (!text.trim() && !selectedImageFile) return;

    input.value = '';
    let uploadedImageUrl = null;
    const sendBtn = document.getElementById('btn-send') || event.currentTarget;
    const originalBtnText = sendBtn.innerHTML;
    
    sendBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    sendBtn.disabled = true;

    if (selectedImageFile) {
        const fileName = `${Date.now()}_${selectedImageFile.name}`;
        try {
            const progress = document.getElementById('chat-upload-progress');
            if(progress) { progress.classList.remove('hidden'); progress.classList.add('flex'); }

            const { data: uploadData, error: uploadError } = await window.supabaseClient.storage
                .from('message-images') //[cite: 25]
                .upload(fileName, selectedImageFile);
            if (uploadError) throw uploadError;

            const { data: publicUrlData } = window.supabaseClient.storage
                .from('message-images') //[cite: 25]
                .getPublicUrl(fileName);
            uploadedImageUrl = publicUrlData.publicUrl;
            
            if(progress) { progress.classList.remove('flex'); progress.classList.add('hidden'); }
        } catch (err) {
            alert("圖片上傳失敗，請確認 Storage 名稱並開放 RLS");
            sendBtn.innerHTML = originalBtnText;
            sendBtn.disabled = false;
            return;
        }
        cancelImageSelection();
    }

    try {
        await window.supabaseClient.from('messages').insert([{ //[cite: 25]
            room_id: window.activeRoomId, 
            sender_name: myChatName, 
            receiver: window.activeChatTarget,
            content: text.trim() || null,
            image_url: uploadedImageUrl,
            audio_url: null
        }]);
    } catch (err) {
        console.error("發送失敗", err);
    } finally {
        sendBtn.innerHTML = originalBtnText;
        sendBtn.disabled = false;
    }
};

// ==========================================
// 8. 語音錄製與發送邏輯
// ==========================================
window.startVoiceRecord = async function() {
    if (isRecording) return;
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = event => {
            if (event.data.size > 0) audioChunks.push(event.data);
        };

        mediaRecorder.start();
        isRecording = true;

        const btn = document.getElementById('btn-voice-record');
        btn.classList.add('bg-red-500', 'text-white', 'recording-pulse');
        btn.classList.remove('bg-gray-100', 'text-gray-600');
    } catch (err) {
        console.error("無法存取麥克風:", err);
        alert("無法開啟麥克風，請確認權限是否開啟。");
    }
};

window.stopVoiceRecord = async function() {
    if (!isRecording || !mediaRecorder) return;
    
    const btn = document.getElementById('btn-voice-record');
    btn.classList.remove('bg-red-500', 'text-white', 'recording-pulse');
    btn.classList.add('bg-gray-100', 'text-gray-600');

    mediaRecorder.onstop = async () => {
        isRecording = false;
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        
        // 如果錄製時間太短 (小於0.5秒)，當作誤觸不發送
        if (audioBlob.size < 5000) return;

        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        btn.disabled = true;

        const fileName = `${Date.now()}_voice.webm`;
        try {
            const { error: uploadError } = await window.supabaseClient.storage
                .from('message-audio')
                .upload(fileName, audioBlob);
            
            if (uploadError) throw uploadError;

            const { data: publicUrlData } = window.supabaseClient.storage
                .from('message-audio')
                .getPublicUrl(fileName);
            
            const uploadedAudioUrl = publicUrlData.publicUrl;

            // 寫入資料庫
            await window.supabaseClient.from('messages').insert([{ //[cite: 25]
                room_id: window.activeRoomId, 
                sender_name: myChatName, 
                receiver: window.activeChatTarget,
                content: null,
                image_url: null,
                audio_url: uploadedAudioUrl
            }]);
        } catch (err) {
            console.error("語音發送失敗:", err);
            alert("語音上傳失敗，請確認是否建立 message-audio Storage。");
        } finally {
            btn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
            btn.disabled = false;
        }
    };
    mediaRecorder.stop();
    mediaRecorder.stream.getTracks().forEach(track => track.stop());
};

// ==========================================
// 9. 圖片輔助與關閉視窗功能
// ==========================================
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
    const input = document.getElementById('chat-image-input');
    if(input) input.value = '';
    const previewContainer = document.getElementById('chat-image-preview-container');
    if(previewContainer) {
        previewContainer.classList.remove('flex');
        previewContainer.classList.add('hidden');
    }
};

window.closeChat = function() {
    window.activeChatTarget = null;
    window.activeRoomId = null;
    document.getElementById('chat-modal').classList.add('translate-x-full');
    setTimeout(() => {
        document.getElementById('chat-modal').classList.add('hidden');
        document.getElementById('chat-messages').innerHTML = ''; 
        cancelImageSelection();
    }, 300);
    renderMessages(); 
};

// ==========================================
// 啟動點
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        setupGlobalRealtime();
        renderMessages();
    }, 500);
});
