// ==========================================
// js/messages.js - 終極修復版 (解決代碼彈出與畫面消失問題)
// ==========================================

window.activeChatId = window.activeChatId || null;
window.realtimeChannel = window.realtimeChannel || null;
let selectedImageFile = null; 

// 預設對話列表
window.chatList = [
    { id: 'global-room-1', user: '🔥 Sexify 測試大廳', avatar: 'https://i.pravatar.cc/100?u=sexify-lobby', lastMsg: '連網功能已修復，點擊進入測試...', time: '現在' }
];

// 初始化使用者暱稱
let myChatName = localStorage.getItem('myChatName');
if (!myChatName) {
    let name = prompt("【首次測試】請輸入你的聊天暱稱：", "用戶" + Math.floor(Math.random() * 1000));
    localStorage.setItem('myChatName', name || "神秘使用者");
    myChatName = localStorage.getItem('myChatName');
}

// 1. 渲染左側訊息列表
function renderMessages() {
    const container = document.getElementById('messages-list');
    if (!container) return;

    container.innerHTML = window.chatList.map(chat => `
        <div class="flex items-center gap-4 p-4 active:bg-gray-50 transition border-b border-gray-50 cursor-pointer" onclick="openChat('${chat.user}', '${chat.avatar}', '${chat.id}')">
            <img src="${chat.avatar}" class="w-12 h-12 rounded-full border border-gray-100 object-cover flex-shrink-0">
            <div class="flex-1 min-w-0">
                <div class="flex justify-between items-center mb-0.5">
                    <h4 class="font-bold text-sm truncate text-gray-800">${chat.user}</h4>
                    <span class="text-[10px] text-gray-400 flex-shrink-0">${chat.time}</span>
                </div>
                <p class="text-xs text-gray-500 truncate leading-relaxed">${chat.lastMsg}</p>
            </div>
        </div>
    `).join('');
}

// 2. 打開對話框
async function openChat(username, avatarUrl, id) {
    window.activeChatId = id;
    
    const nameEl = document.getElementById('chat-name');
    const avatarEl = document.getElementById('chat-avatar');
    const modal = document.getElementById('chat-modal');
    const chatContainer = document.getElementById('chat-messages');

    if (nameEl) nameEl.innerText = username;
    if (avatarEl) avatarEl.src = avatarUrl;
    
    // 顯示視窗
    if (modal) {
        modal.classList.remove('hidden');
        setTimeout(() => modal.classList.remove('translate-x-full'), 10);
    }
    
    if (!chatContainer) return;

    // 清空區域並顯示讀取中
    chatContainer.innerHTML = '<div id="chat-loading-status" class="absolute inset-0 flex items-center justify-center text-xs text-gray-400">連線中...</div>';

    if (!window.supabaseClient) {
        alert("資料庫連線失敗，請檢查配置。");
        return;
    }

    try {
        // A. 抓取歷史訊息 (由舊到新)
        const { data, error } = await window.supabaseClient
            .from('messages')
            .select('*')
            .order('created_at', { ascending: true });

        // 移除讀取狀態
        const statusEl = document.getElementById('chat-loading-status');
        if (statusEl) statusEl.remove();

        if (!error && data) {
            // 由於 HTML 有 flex-col-reverse，新訊息在 DOM 最上面會顯示在螢幕最下面
            // 所以歷史訊息我們要「依序」插入到最上面
            data.forEach(msg => { appendMessageToUI(msg); }); 
        }

        // B. 監聽即時訊息
        if (window.realtimeChannel) window.supabaseClient.removeChannel(window.realtimeChannel);

        window.realtimeChannel = window.supabaseClient
            .channel('public:messages')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
                appendMessageToUI(payload.new); 
            })
            .subscribe();

    } catch (err) {
        console.error("開啟聊天室錯誤:", err);
    }
}

// 3. 核心：訊息泡泡渲染 (解決代碼彈出關鍵)
function appendMessageToUI(msg) {
    const chatContainer = document.getElementById('chat-messages');
    if (!chatContainer) return;

    const isMe = msg.sender_name === myChatName;
    const alignClass = isMe ? "justify-end flex-row-reverse ml-auto" : "justify-start mr-auto";
    const bgClass = isMe ? "bg-sexify text-white rounded-tr-none" : "bg-white text-gray-800 rounded-tl-none border border-gray-100";
    const avatar = isMe ? `https://i.pravatar.cc/100?u=me-${myChatName}` : `https://i.pravatar.cc/100?u=${msg.sender_name}`;
    const nameColor = isMe ? "text-pink-100" : "text-gray-400";

    // 處理內容
    let mediaHtml = '';
    if (msg.image_url && msg.image_url !== 'null' && String(msg.image_url).trim() !== '') {
        mediaHtml = `
            <div class="relative max-w-sm rounded-xl overflow-hidden mb-2 mt-1 shadow-sm bg-gray-100 flex items-center justify-center min-h-[120px]">
                <img src="${msg.image_url}" class="w-full h-auto max-h-[250px] object-cover" onerror="this.parentElement.style.display='none'">
            </div>
        `;
    }

    let safeText = (msg.content && msg.content !== 'null') ? String(msg.content).trim() : '';
    const textHtml = safeText ? `<div class="break-words whitespace-pre-wrap">${safeText}</div>` : '';

    if (!mediaHtml && !textHtml) return;

    const msgHtml = `
        <div class="flex ${alignClass} gap-3 mb-2 animate-fade-in max-w-[85%]">
            <img src="${avatar}" class="w-8 h-8 rounded-full flex-shrink-0 object-cover shadow-sm">
            <div class="${bgClass} p-3 rounded-2xl text-sm shadow-sm leading-relaxed min-w-[60px]">
                <div class="text-[9px] ${nameColor} mb-1 font-bold">${isMe ? '我' : msg.sender_name}</div>
                ${mediaHtml}
                ${textHtml}
            </div>
        </div>
    `;

    /** * 🔥 關鍵修復點：
     * 因為 HTML 結構使用了 flex-col-reverse
     * 使用 'afterbegin' 將新訊息/歷史訊息依序放入 DOM 的最前面
     * 視覺上它們會從螢幕底部往上推
     */
    chatContainer.insertAdjacentHTML('afterbegin', msgHtml);
}

// 4. 發送邏輯與圖片處理
async function handleSendAction() {
    const input = document.getElementById('chat-input');
    const text = input ? input.value.trim() : '';
    const fileToUpload = selectedImageFile; 
    
    if (!text && !fileToUpload) return;
    if (!window.supabaseClient) return;

    const progress = document.getElementById('chat-upload-progress');
    if (fileToUpload && progress) {
        progress.classList.remove('hidden');
        progress.classList.add('flex'); 
    }

    try {
        let imageUrl = null;
        if (fileToUpload) {
            const ext = fileToUpload.name.split('.').pop() || 'png';
            const storagePath = `public/${Date.now()}_${Math.floor(Math.random()*1000)}.${ext}`;
            const { data: upData, error: upErr } = await window.supabaseClient.storage.from('message-images').upload(storagePath, fileToUpload);
            
            if (!upErr) {
                const { data: urlData } = window.supabaseClient.storage.from('message-images').getPublicUrl(storagePath);
                imageUrl = urlData.publicUrl;
            }
        }

        const { error: dbError } = await window.supabaseClient.from('messages').insert([{ 
            content: text || null, 
            sender_name: myChatName,
            image_url: imageUrl || null
        }]);

        if (!dbError && input) input.value = '';
        cancelImageSelection();

    } catch (err) {
        console.error("發送出錯:", err);
        cancelImageSelection();
    }
}

// 輔助函式：圖片選擇與 UI 關閉
function handleImageSelection(input) {
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
}

function cancelImageSelection() {
    selectedImageFile = null;
    const i = document.getElementById('chat-image-input');
    const c = document.getElementById('chat-image-preview-container');
    const pg = document.getElementById('chat-upload-progress');
    if (i) i.value = '';
    if (c) { c.classList.add('hidden'); c.classList.remove('flex'); }
    if (pg) { pg.classList.add('hidden'); pg.classList.remove('flex'); }
}

function closeChat() {
    const modal = document.getElementById('chat-modal');
    if (modal) {
        modal.classList.add('translate-x-full');
        setTimeout(() => modal.classList.add('hidden'), 300);
    }
    if (window.realtimeChannel) {
        window.supabaseClient.removeChannel(window.realtimeChannel);
        window.realtimeChannel = null;
    }
}

// 綁定事件
document.addEventListener('DOMContentLoaded', () => {
    renderMessages();
    setTimeout(() => {
        const chatInput = document.getElementById('chat-input');
        if (chatInput) {
            chatInput.addEventListener('keypress', e => { if (e.key === 'Enter') handleSendAction(); });
        }
    }, 500);
});
