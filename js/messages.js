// ==========================================
// js/messages.js - 核心通訊重構版 (Storage 儲存 + 語音修復)
// 1. 移除 Base64，所有媒體改為上傳至 Supabase Storage
// 2. 修復語音錄製無聲問題 (確保 MIME Type 正確)
// 3. 優化圖片上傳預覽邏輯
// ==========================================

window.activeRoomId = null;
window.activeChatTarget = null;
window.roomChannel = null;     

let selectedMediaFile = null; // 存放待發送的圖片檔案物件
let mediaRecorder = null;
let audioChunks = [];
window.isRecording = false;

window.typingUsers = new Set();
let typingClearTimer = null;

let myUserId = localStorage.getItem('userId');

function refreshMyUser() {
    myUserId = localStorage.getItem('userId');
}

document.addEventListener('DOMContentLoaded', () => {
    refreshMyUser();
});

function generateRoomId(id1, id2) { 
    return [id1, id2].sort().join('_'); 
}

/**
 * 搜尋用戶發起對話
 */
window.searchUsersToChat = async function() {
    const keyword = document.getElementById('inbox-search-input').value.trim();
    const container = document.getElementById('chat-list');
    
    if (!keyword) { renderMessages(); return; }

    container.innerHTML = `<div class="p-6 text-center text-gray-400 mt-10"><i class="fa-solid fa-spinner fa-spin text-2xl"></i></div>`;

    try {
        const { data, error } = await window.supabaseClient
            .from('profiles')
            .select('id, display_name, username, avatar_url')
            .or(`username.ilike.%${keyword}%,display_name.ilike.%${keyword}%`)
            .limit(10);

        if (error) throw error;

        if (!data || data.length === 0) {
            container.innerHTML = `<div class="p-10 text-center text-gray-400">找不到用戶</div>`;
            return;
        }

        container.innerHTML = data.map(u => `
            <div class="flex items-center gap-3 p-4 border-b border-gray-50 active:bg-gray-50 transition cursor-pointer" onclick="openChat('${u.id}', '${u.display_name}')">
                <img src="${u.avatar_url || 'https://ui-avatars.com/api/?name=' + u.display_name}" class="w-12 h-12 rounded-full object-cover">
                <div>
                    <div class="font-bold text-gray-800">${u.display_name}</div>
                    <div class="text-xs text-gray-400">@${u.username}</div>
                </div>
            </div>
        `).join('');
    } catch (e) {
        console.error(e);
        container.innerHTML = `<div class="p-10 text-center text-red-400">搜尋失敗</div>`;
    }
}

/**
 * 處理圖片選擇預覽 (不使用 Base64 傳輸，僅用於預覽)
 */
window.handleImageSelection = function(input) {
    if (input.files && input.files[0]) {
        selectedMediaFile = input.files[0];
        const reader = new FileReader();
        reader.onload = (e) => {
            // 在輸入框上方顯示一個小預覽
            const previewArea = document.getElementById('chat-input-preview') || createPreviewArea();
            previewArea.innerHTML = `
                <div class="relative inline-block mt-2 ml-4">
                    <img src="${e.target.result}" class="w-20 h-20 object-cover rounded-lg border-2 border-sexify">
                    <button onclick="clearSelectedMedia()" class="absolute -top-2 -right-2 bg-red-500 text-white w-5 h-5 rounded-full text-[10px] flex items-center justify-center shadow-lg"><i class="fa-solid fa-xmark"></i></button>
                </div>
            `;
        };
        reader.readAsDataURL(selectedMediaFile);
    }
};

function createPreviewArea() {
    const area = document.createElement('div');
    area.id = 'chat-input-preview';
    area.className = 'bg-white border-t border-gray-100 pb-2';
    const chatInputArea = document.querySelector('.bg-white.border-t.p-4');
    chatInputArea.parentNode.insertBefore(area, chatInputArea);
    return area;
}

window.clearSelectedMedia = function() {
    selectedMediaFile = null;
    const previewArea = document.getElementById('chat-input-preview');
    if (previewArea) previewArea.innerHTML = '';
    document.getElementById('chat-image-input').value = '';
};

/**
 * 語音錄製控制
 */
window.toggleVoiceRecord = async function() {
    if (!window.isRecording) {
        // 開始錄音
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            // 指定 MIME Type 解決部分設備聽不到聲音的問題 (WebM 格式最穩定)
            const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
                             ? 'audio/webm;codecs=opus' 
                             : 'audio/ogg;codecs=opus';
                             
            mediaRecorder = new MediaRecorder(stream, { mimeType });
            audioChunks = [];
            
            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunks.push(e.data);
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: mimeType });
                if (confirm('是否發送這段語音訊息？')) {
                    await uploadAndSendMedia(audioBlob, 'voice.webm');
                }
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            window.isRecording = true;
            document.querySelector('.fa-microphone').parentElement.classList.replace('text-gray-400', 'text-red-500');
            document.querySelector('.fa-microphone').parentElement.classList.add('animate-pulse');
        } catch (err) {
            alert('無法開啟麥克風：' + err.message);
        }
    } else {
        // 停止錄音
        mediaRecorder.stop();
        window.isRecording = false;
        document.querySelector('.fa-microphone').parentElement.classList.replace('text-red-500', 'text-gray-400');
        document.querySelector('.fa-microphone').parentElement.classList.remove('animate-pulse');
    }
};

/**
 * 核心上傳邏輯：將檔案上傳至 Storage 並獲取 Public URL
 */
async function uploadAndSendMedia(file, fileNameHint) {
    const userId = localStorage.getItem('userId');
    if (!userId) return;

    const fileExt = fileNameHint.split('.').pop();
    const fileName = `${userId}_${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    try {
        // 1. 上傳至 message-images bucket (語音也暫放這或另建 bucket)
        const { data, error } = await window.supabaseClient.storage
            .from('message-images')
            .upload(filePath, file, {
                contentType: file.type,
                upsert: true
            });

        if (error) throw error;

        // 2. 獲取公開鏈接
        const { data: { publicUrl } } = window.supabaseClient.storage
            .from('message-images')
            .getPublicUrl(filePath);

        // 3. 發送訊息 (如果是語音，我們把 URL 存入 image_url，或根據你的 schema 調整)
        await sendMessage(null, publicUrl);
        clearSelectedMedia();
    } catch (err) {
        console.error('媒體上傳失敗:', err);
        alert('檔案傳送失敗，請稍後再試。');
    }
}

/**
 * 處理發送按鈕
 */
window.handleSendAction = async function() {
    const input = document.getElementById('chat-input');
    const content = input.value.trim();

    if (!content && !selectedMediaFile) return;

    const sendBtn = document.getElementById('send-btn');
    sendBtn.disabled = true;

    if (selectedMediaFile) {
        // 先處理圖片上傳
        await uploadAndSendMedia(selectedMediaFile, selectedMediaFile.name);
    } else {
        // 純文字發送
        await sendMessage(content, null);
    }

    input.value = '';
    sendBtn.disabled = false;
};

/**
 * 執行訊息寫入資料庫
 */
async function sendMessage(content, mediaUrl) {
    if (!window.activeRoomId || !window.activeChatTarget) return;
    refreshMyUser();

    try {
        const { error } = await window.supabaseClient
            .from('messages')
            .insert([{
                room_id: window.activeRoomId,
                sender: myUserId,
                receiver: window.activeChatTarget,
                content: content || '',
                image_url: mediaUrl, // 這裡存放的是 Storage 的 HTTP URL
                is_read: false
            }]);

        if (error) throw error;
        
        // 發送後重新繪製 (如果即時監聽沒觸發，確保 UI 有反應)
        if (typeof renderMessages === 'function') renderMessages();
    } catch (e) {
        console.error('發送失敗:', e);
    }
}

/**
 * 打開聊天視窗並載入訊息
 */
window.openChat = async function(targetUid, displayName) {
    refreshMyUser();
    window.activeChatTarget = targetUid;
    window.activeRoomId = generateRoomId(myUserId, targetUid);

    const modal = document.getElementById('chat-modal');
    document.getElementById('chat-target-name').innerText = displayName;
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.remove('translate-x-full'), 10);

    // 標記訊息為已讀
    await window.supabaseClient
        .from('messages')
        .update({ is_read: true })
        .eq('room_id', window.activeRoomId)
        .eq('receiver', myUserId);

    loadMessages();
    setupChatRealtime();
};

/**
 * 從資料庫載入歷史訊息
 */
async function loadMessages() {
    if (!window.activeRoomId) return;
    const container = document.getElementById('chat-messages');
    container.innerHTML = `<div class="p-10 text-center"><i class="fa-solid fa-spinner fa-spin text-gray-300"></i></div>`;

    try {
        const { data, error } = await window.supabaseClient
            .from('messages')
            .select('*')
            .eq('room_id', window.activeRoomId)
            .order('created_at', { ascending: true });

        if (error) throw error;
        drawMessages(data);
    } catch (e) {
        console.error(e);
    }
}

/**
 * 渲染訊息到 UI
 */
function drawMessages(messages) {
    const container = document.getElementById('chat-messages');
    if (!messages || messages.length === 0) {
        container.innerHTML = `<div class="p-10 text-center text-gray-300 text-sm">開始與 ${document.getElementById('chat-target-name').innerText} 聊天吧</div>`;
        return;
    }

    container.innerHTML = messages.map(m => {
        const isMine = m.sender === myUserId;
        const msgClass = isMine ? 'bg-sexify text-white rounded-tr-none' : 'bg-gray-100 text-gray-800 rounded-tl-none';
        const wrapperClass = isMine ? 'justify-end' : 'justify-start';

        // 判斷是否為語音 (簡單判斷 URL 結尾)
        const isVoice = m.image_url && (m.image_url.includes('.webm') || m.image_url.includes('.ogg'));
        const isImage = m.image_url && !isVoice;

        return `
            <div class="flex ${wrapperClass} mb-4 animate-in fade-in slide-in-from-bottom-2">
                <div class="max-w-[80%] ${msgClass} px-4 py-2 rounded-2xl shadow-sm">
                    ${m.content ? `<div class="text-sm">${m.content}</div>` : ''}
                    ${isImage ? `<img src="${m.image_url}" class="rounded-lg mt-1 max-w-full cursor-pointer" onclick="window.open('${m.image_url}')">` : ''}
                    ${isVoice ? `
                        <div class="flex items-center gap-2 py-1 cursor-pointer" onclick="playVoice('${m.image_url}', this)">
                            <i class="fa-solid fa-play"></i>
                            <div class="text-xs">語音訊息</div>
                            <div class="w-16 h-1 bg-white/30 rounded-full relative overflow-hidden">
                                <div class="progress-bar absolute left-0 top-0 h-full bg-white/80 w-0"></div>
                            </div>
                        </div>
                    ` : ''}
                    <div class="text-[9px] opacity-50 mt-1 text-right">
                        ${new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    container.scrollTop = container.scrollHeight;
}

/**
 * 播放語音訊息
 */
window.playVoice = function(url, el) {
    const icon = el.querySelector('i');
    const progressBar = el.querySelector('.progress-bar');
    
    // 如果點擊正在播放的
    if (window.currentAudio && window.currentAudio.src === url && !window.currentAudio.paused) {
        window.currentAudio.pause();
        icon.className = 'fa-solid fa-play';
        return;
    }

    if (window.currentAudio) window.currentAudio.pause();

    const audio = new Audio(url);
    window.currentAudio = audio;
    icon.className = 'fa-solid fa-spinner fa-spin';

    audio.onplay = () => { icon.className = 'fa-solid fa-pause'; };
    audio.ontimeupdate = () => {
        const progress = (audio.currentTime / audio.duration) * 100;
        progressBar.style.width = progress + '%';
    };
    audio.onended = () => {
        icon.className = 'fa-solid fa-play';
        progressBar.style.width = '0%';
    };
    audio.onerror = () => {
        alert('語音載入失敗');
        icon.className = 'fa-solid fa-play';
    };

    audio.play().catch(e => console.error('播放失敗:', e));
};

/**
 * 設置 Realtime 監聽
 */
function setupChatRealtime() {
    if (window.roomChannel) window.roomChannel.unsubscribe();

    window.roomChannel = window.supabaseClient.channel('room_' + window.activeRoomId)
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'messages', 
            filter: `room_id=eq.${window.activeRoomId}` 
        }, payload => {
            // 如果收到別人的訊息，標記為已讀
            if (payload.new.receiver === myUserId) {
                window.supabaseClient.from('messages').update({ is_read: true }).eq('id', payload.new.id);
            }
            loadMessages(); // 收到新訊息，重新載入
        })
        .subscribe();
}

window.closeChat = function() {
    window.activeChatTarget = null;
    window.activeRoomId = null;
    if (window.roomChannel) window.roomChannel.unsubscribe();
    
    const modal = document.getElementById('chat-modal');
    modal.classList.add('translate-x-full');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
};

/**
 * 獲取聊天列表 (Inbox)
 */
window.renderMessages = async function() {
    const container = document.getElementById('chat-list');
    if (!container) return;
    refreshMyUser();

    try {
        // 獲取最近的對話列表 (這裡簡化邏輯，實際可能需要 RPC 或更複雜的查詢)
        const { data, error } = await window.supabaseClient
            .from('messages')
            .select('*, profiles:sender(display_name, avatar_url, username)')
            .or(`sender.eq.${myUserId},receiver.eq.${myUserId}`)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // 簡單去重，只顯示每個 Room 的最後一條訊息
        const rooms = {};
        data.forEach(m => {
            if (!rooms[m.room_id]) rooms[m.room_id] = m;
        });

        const sortedRooms = Object.values(rooms);

        if (sortedRooms.length === 0) {
            container.innerHTML = `<div class="p-10 text-center text-gray-400">目前沒有訊息</div>`;
            return;
        }

        // 獲取對方的 Profile 資料
        container.innerHTML = await Promise.all(sortedRooms.map(async m => {
            const targetId = m.sender === myUserId ? m.receiver : m.sender;
            const { data: prof } = await window.supabaseClient.from('profiles').select('*').eq('id', targetId).single();
            
            const name = prof?.display_name || '未知用戶';
            const avatar = prof?.avatar_url || 'https://ui-avatars.com/api/?name=' + name;
            const isUnread = !m.is_read && m.receiver === myUserId;

            return `
                <div class="flex items-center gap-3 p-4 border-b border-gray-50 active:bg-gray-50 transition cursor-pointer ${isUnread ? 'bg-red-50/30' : ''}" 
                     onclick="openChat('${targetId}', '${name}')">
                    <div class="relative">
                        <img src="${avatar}" class="w-14 h-14 rounded-full object-cover">
                        ${isUnread ? '<div class="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></div>' : ''}
                    </div>
                    <div class="flex-1 overflow-hidden">
                        <div class="flex justify-between items-center mb-1">
                            <span class="font-bold text-gray-800">${name}</span>
                            <span class="text-[10px] text-gray-400">${new Date(m.created_at).toLocaleDateString()}</span>
                        </div>
                        <div class="text-xs text-gray-400 truncate">${m.content || (m.image_url ? '[媒體訊息]' : '')}</div>
                    </div>
                </div>
            `;
        })).then(results => results.join(''));

    } catch (e) {
        console.error(e);
    }
};
