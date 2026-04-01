// ==========================================
// js/messages.js - 1對1 私密聊天升級版 (全替換)
// ==========================================

window.activeRoomId = null;
window.activeChatTarget = null;
window.realtimeChannel = null;
let selectedImageFile = null;

// 1. 初始化你的專屬暱稱
let myChatName = localStorage.getItem('myChatName');
if (!myChatName) {
    let name = prompt("【1對1 私密聊天】請輸入你的專屬暱稱：\n(其他人將透過此暱稱與你聊天)", "用戶" + Math.floor(Math.random() * 1000));
    localStorage.setItem('myChatName', name || "神秘使用者");
    myChatName = localStorage.getItem('myChatName');
}

// 2. 獲取本地的聊天紀錄列表 (類似 Line 的聊天清單)
function getChatSessions() {
    try {
        return JSON.parse(localStorage.getItem('chatSessions')) || [];
    } catch (e) {
        return [];
    }
}

// 儲存/更新聊天列表
function saveChatSession(targetName, targetAvatar, lastMsg) {
    let sessions = getChatSessions();
    let existingIndex = sessions.findIndex(s => s.name === targetName);
    let session = {
        name: targetName,
        avatar: targetAvatar || `https://i.pravatar.cc/150?u=${targetName}`,
        lastMsg: lastMsg || '開始聊天...',
        time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
    };

    if (existingIndex >= 0) {
        sessions[existingIndex] = session; // 更新現有對話
    } else {
        sessions.unshift(session); // 新增對話到最上方
    }
    localStorage.setItem('chatSessions', JSON.stringify(sessions));
    renderMessageList();
}

// 🔥 核心演算法：產生唯一的房間 ID (確保 A找B 和 B找A 是同一個房間)
function generateRoomId(user1, user2) {
    return [user1, user2].sort().join('_');
}

// 3. 渲染首頁的「訊息列表」與「新增按鈕」
window.renderMessages = function() {
    renderMessageList();
};

function renderMessageList() {
    const container = document.getElementById('messages-list');
    if (!container) return;

    const sessions = getChatSessions();

    // 頂部新增「發起新聊天」按鈕
    let html = `
        <div class="p-4 border-b border-gray-100">
            <button onclick="startNewChatPrompt()" class="w-full bg-sexify text-white font-bold py-3.5 rounded-2xl shadow-md active:scale-95 transition flex items-center justify-center gap-2">
                <i class="fa-solid fa-comment-medical text-lg"></i> 發起 1 對 1 聊天
            </button>
        </div>
    `;

    if (sessions.length === 0) {
        html += `<div class="text-center text-gray-400 py-12 text-sm flex flex-col items-center"><i class="fa-regular fa-comments text-4xl mb-3 text-gray-200"></i>目前沒有聊天紀錄，點擊上方按鈕開始吧！</div>`;
    } else {
        html += sessions.map(chat => `
            <div class="flex items-center gap-4 p-4 active:bg-gray-50 transition border-b border-gray-50 cursor-pointer"
                 onclick="openChat('${chat.name}', '${chat.avatar}')">
                <img src="${chat.avatar}" class="w-12 h-12 rounded-full object-cover border border-gray-100 shadow-sm">
                <div class="flex-1 min-w-0">
                    <div class="flex justify-between items-baseline mb-1">
                        <h3 class="font-bold text-gray-800 truncate">${chat.name}</h3>
                        <span class="text-xs text-gray-400">${chat.time}</span>
                    </div>
                    <p class="text-sm text-gray-500 truncate">${chat.lastMsg}</p>
                </div>
            </div>
        `).join('');
    }

    container.innerHTML = html;
}

// 透過彈窗發起新聊天
window.startNewChatPrompt = function() {
    const targetName = prompt(`你的暱稱是「${myChatName}」。\n請輸入你想聊天的【對方暱稱】：`);
    if (targetName && targetName.trim() !== "") {
        if (targetName.trim() === myChatName) {
            alert("不能跟自己聊天啦！");
            return;
        }
        openChat(targetName.trim(), `https://i.pravatar.cc/150?u=${targetName.trim()}`);
    }
};

// 4. 開啟特定 1對1 聊天室並讀取歷史紀錄
window.openChat = async function(targetName, targetAvatar) {
    window.activeChatTarget = targetName;
    window.activeRoomId = generateRoomId(myChatName, targetName);

    // UI 切換與載入狀態
    const modal = document.getElementById('chat-modal');
    const headerTitle = modal ? modal.querySelector('h2') : null; // 動態抓取標題
    const chatMessages = document.getElementById('chat-messages');

    if (headerTitle) headerTitle.innerHTML = `<i class="fa-solid fa-lock text-sm text-gray-400 mr-2"></i>與 ${targetName} 聊天中`;
    if (chatMessages) chatMessages.innerHTML = `<div class="text-center text-gray-400 py-10"><i class="fa-solid fa-circle-notch fa-spin text-2xl"></i><p class="mt-2 text-sm">載入加密訊息中...</p></div>`;

    if (modal) {
        modal.classList.remove('hidden');
        setTimeout(() => modal.classList.remove('translate-x-full'), 10);
    }

    // 將此人加入首頁列表
    saveChatSession(targetName, targetAvatar, "進入聊天室...");

    // 從 Supabase 抓取「指定房間」的歷史訊息
    try {
        const { data, error } = await window.supabaseClient
            .from('messages')
            .select('*')
            .eq('room_id', window.activeRoomId)
            .order('created_at', { ascending: true });

        if (error) {
            if (error.message.includes('column "room_id" does not exist')) {
                alert('⚠️ 系統錯誤：請先到 Supabase 的 messages 資料表新增「room_id」欄位！');
                closeChat();
                return;
            }
            console.error(error);
        }

        drawMessages(data || []);
        setupRealtime();

    } catch (err) {
        console.error("載入訊息失敗", err);
    }
};

// 5. 繪製對話氣泡
function drawMessages(messages) {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    if (messages.length === 0) {
        container.innerHTML = `<div class="text-center text-gray-400 py-10 text-sm">這是你與 ${window.activeChatTarget} 的 1對1 專屬空間<br>傳個訊息打招呼吧！</div>`;
        return;
    }

    container.innerHTML = messages.map(msg => {
        const isMe = msg.sender === myChatName;
        const align = isMe ? 'justify-end' : 'justify-start';
        const bg = isMe ? 'bg-sexify text-white' : 'bg-gray-100 text-gray-800';
        const radius = isMe ? 'rounded-tl-2xl rounded-tr-2xl rounded-bl-2xl rounded-br-sm' : 'rounded-tl-2xl rounded-tr-2xl rounded-br-2xl rounded-bl-sm';

        let mediaHtml = '';
        if (msg.image_url) {
            mediaHtml = `<img src="${msg.image_url}" class="max-w-[200px] sm:max-w-xs rounded-lg mb-2 cursor-pointer" onclick="window.open('${msg.image_url}')">`;
        }

        return `
            <div class="flex ${align} mb-4">
                <div class="max-w-[75%] flex flex-col ${isMe ? 'items-end' : 'items-start'}">
                    ${!isMe ? `<span class="text-[10px] text-gray-400 mb-1 ml-1">${msg.sender}</span>` : ''}
                    <div class="${bg} ${radius} px-4 py-2.5 shadow-sm inline-block break-words">
                        ${mediaHtml}
                        ${msg.content ? `<p class="text-[15px] leading-relaxed">${msg.content}</p>` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');

    container.scrollTop = container.scrollHeight;
}

// 6. 監聽專屬房間的即時訊息 (Realtime)
function setupRealtime() {
    if (window.realtimeChannel) {
        window.supabaseClient.removeChannel(window.realtimeChannel);
    }

    // 🔥 這裡加上了 filter，保證只收到目前這個 1對1 房間的推播
    window.realtimeChannel = window.supabaseClient.channel('room_' + window.activeRoomId)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `room_id=eq.${window.activeRoomId}` 
        }, payload => {
            const newMsg = payload.new;
            const container = document.getElementById('chat-messages');

            if (container.innerHTML.includes('專屬空間')) container.innerHTML = '';

            const isMe = newMsg.sender === myChatName;
            const align = isMe ? 'justify-end' : 'justify-start';
            const bg = isMe ? 'bg-sexify text-white' : 'bg-gray-100 text-gray-800';
            const radius = isMe ? 'rounded-tl-2xl rounded-tr-2xl rounded-bl-2xl rounded-br-sm' : 'rounded-tl-2xl rounded-tr-2xl rounded-br-2xl rounded-bl-sm';

            let mediaHtml = '';
            if (newMsg.image_url) {
                mediaHtml = `<img src="${newMsg.image_url}" class="max-w-[200px] sm:max-w-xs rounded-lg mb-2 cursor-pointer" onclick="window.open('${newMsg.image_url}')">`;
            }

            const msgDiv = document.createElement('div');
            msgDiv.className = `flex ${align} mb-4 transition-opacity duration-300 opacity-100`;
            msgDiv.innerHTML = `
                <div class="max-w-[75%] flex flex-col ${isMe ? 'items-end' : 'items-start'}">
                    ${!isMe ? `<span class="text-[10px] text-gray-400 mb-1 ml-1">${newMsg.sender}</span>` : ''}
                    <div class="${bg} ${radius} px-4 py-2.5 shadow-sm inline-block break-words">
                        ${mediaHtml}
                        ${newMsg.content ? `<p class="text-[15px] leading-relaxed">${newMsg.content}</p>` : ''}
                    </div>
                </div>
            `;
            container.appendChild(msgDiv);
            container.scrollTop = container.scrollHeight;

            // 即時更新外層列表的最後訊息預覽
            let previewText = newMsg.image_url ? "[傳送了一張圖片]" : newMsg.content;
            saveChatSession(window.activeChatTarget, `https://i.pravatar.cc/150?u=${window.activeChatTarget}`, previewText);
        })
        .subscribe();
}

// 7. 發送訊息 (綁定房間 ID)
window.handleSendAction = async function() {
    const input = document.getElementById('chat-input');
    const text = input.value;

    if (!text.trim() && !selectedImageFile) return;

    input.value = '';

    let uploadedImageUrl = null;

    if (selectedImageFile) {
        const pg = document.getElementById('chat-upload-progress');
        if(pg) { pg.classList.remove('hidden'); pg.classList.add('flex'); }

        const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 5)}.jpg`;
        const { data: uploadData, error: uploadError } = await window.supabaseClient.storage
            .from('chat-images')
            .upload(fileName, selectedImageFile);

        if (uploadError) {
            console.error("圖片上傳失敗", uploadError);
            alert("圖片上傳失敗，請稍後再試");
            cancelImageSelection();
            return;
        }

        const { data: publicUrlData } = window.supabaseClient.storage
            .from('chat-images')
            .getPublicUrl(fileName);

        uploadedImageUrl = publicUrlData.publicUrl;
        cancelImageSelection();
    }

    // 🔥 寫入資料庫時，將 room_id 一併存入
    const { error } = await window.supabaseClient.from('messages').insert([{
        room_id: window.activeRoomId, 
        sender: myChatName,
        content: text.trim() || null,
        image_url: uploadedImageUrl
    }]);

    if (error) {
        console.error("訊息發送失敗", error);
        alert("發送失敗: " + error.message);
    } else {
        let previewText = uploadedImageUrl ? "[圖片]" : text.trim();
        saveChatSession(window.activeChatTarget, `https://i.pravatar.cc/150?u=${window.activeChatTarget}`, previewText);
    }
};

// 8. 圖片選擇與取消預覽 (保持原有功能)
window.handleImageSelection = function(input) {
    const file = input.files[0];
    if (!file) return;
    selectedImageFile = file;

    const reader = new FileReader();
    reader.onload = e => {
        const p = document.getElementById('chat-image-preview');
        const c = document.getElementById('chat-image-preview-container');
        if (p && c) { p.src = e.target.result; c.classList.remove('hidden'); c.classList.add('flex'); }
    };
    reader.readAsDataURL(file);
};

window.cancelImageSelection = function() {
    selectedImageFile = null;
    const i = document.getElementById('chat-image-input');
    const c = document.getElementById('chat-image-preview-container');
    const pg = document.getElementById('chat-upload-progress');
    if (i) i.value = '';
    if (c) { c.classList.add('hidden'); c.classList.remove('flex'); }
    if (pg) { pg.classList.add('hidden'); pg.classList.remove('flex'); }
};

// 9. 關閉聊天室並清理監聽器
window.closeChat = function() {
    const modal = document.getElementById('chat-modal');
    if (modal) {
        modal.classList.add('translate-x-full');
        setTimeout(() => {
            modal.classList.add('hidden');
            document.getElementById('chat-messages').innerHTML = ''; // 清空畫面避免殘影
        }, 300);
    }
    
    if (window.realtimeChannel) {
        window.supabaseClient.removeChannel(window.realtimeChannel); // 離開房間時關閉即時監聽
        window.realtimeChannel = null;
    }
    window.activeRoomId = null;
    window.activeChatTarget = null;
};

// 網頁載入時自動渲染列表
document.addEventListener('DOMContentLoaded', () => {
    renderMessageList();
});
