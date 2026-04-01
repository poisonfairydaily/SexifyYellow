// ==========================================
// js/messages.js - 修正 HTML 原始碼彈出問題版
// ==========================================

// 1. 全域變數與防衝突宣告
window.activeChatId = window.activeChatId || null;
window.realtimeChannel = window.realtimeChannel || null;
let selectedImageFile = null; 

// 模擬的對話對象列表
window.chatList = [
    { id: 'global-room-1', user: '🔥 Sexify 測試大廳', avatar: 'https://i.pravatar.cc/100?u=sexify-lobby', lastMsg: '點擊開始跨視窗連網測試...', time: '現在' }
];

// 初始化使用者暱稱
let myChatName = localStorage.getItem('myChatName');
if (!myChatName) {
    let name = prompt("【首次測試】請輸入你的聊天暱稱：", "匿名朋友" + Math.floor(Math.random() * 1000));
    localStorage.setItem('myChatName', name || "神秘使用者");
    myChatName = localStorage.getItem('myChatName');
}

// 2. 渲染左側訊息列表
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

// 3. 打開對話框的核心邏輯
async function openChat(username, avatarUrl, id) {
    window.activeChatId = id;
    document.getElementById('chat-name').innerText = username;
    document.getElementById('chat-avatar').src = avatarUrl;
    
    // 顯示視窗
    const modal = document.getElementById('chat-modal');
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.remove('translate-x-full'), 10);
    
    // 初始化訊息區域
    const chatContainer = document.getElementById('chat-messages');
    chatContainer.innerHTML = '<div class="absolute inset-0 flex items-center justify-center text-xs text-gray-400" id="chat-loading-status">連線中...</div>';

    if (!window.supabaseClient) {
        alert("資料庫尚未連線，請檢查 supabase-config.js");
        return;
    }

    // A. 抓取歷史訊息
    const { data, error } = await window.supabaseClient
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true });

    const statusEl = document.getElementById('chat-loading-status');
    if(statusEl) statusEl.remove();

    if (!error && data) {
        // 歷史訊息由舊到新插入底部
        data.forEach(msg => { appendMessageToUI(msg, false); }); 
    }

    // B. 啟動即時監聽器
    if (window.realtimeChannel) {
        window.supabaseClient.removeChannel(window.realtimeChannel);
    }

    window.realtimeChannel = window.supabaseClient
        .channel('public:messages')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
            appendMessageToUI(payload.new, true); 
        })
        .subscribe();
}

// 4. 訊息氣泡生成邏輯 (🔥 修復 HTML 顯示問題版)
function appendMessageToUI(msg, isNewMessage) {
    const chatContainer = document.getElementById('chat-messages');
    if (!chatContainer) return;

    const isMe = msg.sender_name === myChatName;
    const alignClass = isMe ? "justify-end flex-row-reverse ml-auto" : "justify-start mr-auto";
    const bgClass = isMe ? "bg-sexify text-white rounded-tr-none" : "bg-white text-gray-800 rounded-tl-none border border-gray-100";
    const avatar = isMe ? `https://i.pravatar.cc/100?u=me-${myChatName}` : `https://i.pravatar.cc/100?u=${msg.sender_name}`;
    const nameColor = isMe ? "text-pink-100" : "text-gray-400";

    // 處理圖片內容
    let mediaHtml = '';
    if (msg.image_url && typeof msg.image_url === 'string' && msg.image_url.trim() !== '' && msg.image_url !== 'null') {
        mediaHtml = `
            <div class="relative max-w-sm rounded-xl overflow-hidden mb-2 mt-1 shadow-sm bg-gray-100/50 flex items-center justify-center min-h-[120px]">
                <img src="${msg.image_url}" class="w-full h-auto max-h-[250px] object-cover" 
                     onload="this.parentElement.classList.remove('bg-gray-100/50');"
                     onerror="this.outerHTML='<div class=\\'p-3 text-xs text-gray-400 text-center bg-gray-100 rounded-xl\\'>⚠️ 圖片載入失敗</div>'">
            </div>
        `;
    }

    // 處理文字內容
    let safeText = '';
    if (msg.content && msg.content !== 'null') {
        safeText = String(msg.content).trim();
    }
    
    const textHtml = safeText ? `<div class="break-words whitespace-pre-wrap">${safeText}</div>` : '';

    // 防呆：如果沒有圖片也沒有文字，就不要畫出空泡泡
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

    // 🔥 核心修復：使用 insertAdjacentHTML 而不是 prepend
    if (isNewMessage) {
        // 即時訊息插入到最前方（如果是 flex-col-reverse，視覺上會在最底部）
        chatContainer.insertAdjacentHTML('afterbegin', msgHtml);
    } else {
        // 歷史訊息插入到最後方
        chatContainer.insertAdjacentHTML('beforeend', msgHtml);
    }
}

// 5. 圖片發送相關邏輯
function handleImageSelection(input) {
    const file = input.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
        alert("為了測試速度，請上傳小於 5MB 的圖片喔！");
        input.value = '';
        return;
    }

    selectedImageFile = file;
    const preview = document.getElementById('chat-image-preview');
    const container = document.getElementById('chat-image-preview-container');

    const reader = new FileReader();
    reader.onload = function(e) {
        preview.src = e.target.result;
        container.classList.remove('hidden');
        container.classList.add('flex'); 
    }
    reader.readAsDataURL(file);
}

function cancelImageSelection() {
    selectedImageFile = null;
    const fileInput = document.getElementById('chat-image-input');
    if (fileInput) fileInput.value = '';
    
    const container = document.getElementById('chat-image-preview-container');
    if (container) {
        container.classList.add('hidden');
        container.classList.remove('flex');
    }
    
    const progress = document.getElementById('chat-upload-progress');
    if (progress) {
        progress.classList.add('hidden');
        progress.classList.remove('flex');
    }
}

async function handleSendAction() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    const fileToUpload = selectedImageFile; 
    
    if (!text && !fileToUpload) return;

    if (!window.supabaseClient) {
        alert("Supabase 資料庫連線失敗！");
        return;
    }

    const progress = document.getElementById('chat-upload-progress');
    if (fileToUpload && progress) {
        progress.classList.remove('hidden');
        progress.classList.add('flex'); 
    }

    try {
        let imageUrl = null;

        if (fileToUpload) {
            const ext = fileToUpload.name.split('.').pop() || 'png';
            const randomCode = Math.floor(Math.random() * 10000);
            const storagePath = `public/${Date.now()}_${randomCode}.${ext}`;

            const { data: uploadData, error: uploadError } = await window.supabaseClient
                .storage
                .from('message-images')
                .upload(storagePath, fileToUpload);

            if (uploadError) {
                console.error("圖片上傳失敗:", uploadError.message);
                alert(`圖片上傳失敗: ${uploadError.message}`);
                cancelImageSelection();
                return;
            }

            const { data: publicUrlData } = window.supabaseClient
                .storage
                .from('message-images')
                .getPublicUrl(storagePath);
            
            imageUrl = publicUrlData.publicUrl;
        }

        const payload = { 
            content: text || null, 
            sender_name: myChatName,
            image_url: imageUrl || null
        };

        const { error: dbError } = await window.supabaseClient
            .from('messages')
            .insert([payload]);

        if (dbError) {
            console.error("發送失敗:", dbError.message);
            alert("發送失敗！");
        } else {
            input.value = '';
            cancelImageSelection();
        }

    } catch (err) {
        console.error("錯誤:", err);
        cancelImageSelection();
    }
}

function closeChat() {
    const modal = document.getElementById('chat-modal');
    modal.classList.add('translate-x-full');
    setTimeout(() => modal.classList.add('hidden'), 300);
    
    if (window.realtimeChannel) {
        window.supabaseClient.removeChannel(window.realtimeChannel);
        window.realtimeChannel = null;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    renderMessages();
    setTimeout(() => {
        const chatInput = document.getElementById('chat-input');
        if(chatInput) {
            chatInput.addEventListener('keypress', function (e) {
                if (e.key === 'Enter') {
                    handleSendAction();
                }
            });
        }
    }, 1000);
});
