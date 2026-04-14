// ==========================================
// js/messages.js - 核心通訊重構版 (修復無法開啟聊天室問題)
// 1. 修正了與資料庫 schema 不符的欄位名稱 (使用 sender_name)
// 2. 移除了無法執行的 JOIN 查詢，改用手動匹配用戶資料
// 3. 增加 DOM 元素檢查與錯誤提示，避免靜默崩潰
// ==========================================

window.activeRoomId = null;
window.activeChatTarget = null;
window.roomChannel = null;     

let selectedMediaFile = null; 
let mediaRecorder = null;
let audioChunks = [];
window.isRecording = false;

let myUserId = localStorage.getItem('userId');

function refreshMyUser() {
    myUserId = localStorage.getItem('userId');
}

document.addEventListener('DOMContentLoaded', () => {
    refreshMyUser();
});

function generateRoomId(id1, id2) { 
    if (!id1 || !id2) return null;
    return [id1, id2].sort().join('_'); 
}

window.searchUsersToChat = async function() {
    const keyword = document.getElementById('inbox-search-input')?.value.trim();
    const container = document.getElementById('chat-list');
    
    if (!container) return;
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
        console.error('搜尋錯誤:', e);
        container.innerHTML = `<div class="p-10 text-center text-red-400">搜尋失敗</div>`;
    }
}

window.handleImageSelection = function(input) {
    if (input.files && input.files[0]) {
        selectedMediaFile = input.files[0];
        const reader = new FileReader();
        reader.onload = (e) => {
            let previewArea = document.getElementById('chat-input-preview');
            if (!previewArea) previewArea = createPreviewArea();
            
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
    if (chatInputArea) {
        chatInputArea.parentNode.insertBefore(area, chatInputArea);
    }
    return area;
}

window.clearSelectedMedia = function() {
    selectedMediaFile = null;
    const previewArea = document.getElementById('chat-input-preview');
    if (previewArea) previewArea.innerHTML = '';
    const input = document.getElementById('chat-image-input');
    if (input) input.value = '';
};

window.toggleVoiceRecord = async function() {
    if (!window.isRecording) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
            const micIcon = document.querySelector('.fa-microphone');
            if (micIcon) {
                micIcon.parentElement.classList.replace('text-gray-400', 'text-red-500');
                micIcon.parentElement.classList.add('animate-pulse');
            }
        } catch (err) {
            alert('無法開啟麥克風：' + err.message);
        }
    } else {
        if (mediaRecorder) mediaRecorder.stop();
        window.isRecording = false;
        const micIcon = document.querySelector('.fa-microphone');
        if (micIcon) {
            micIcon.parentElement.classList.replace('text-red-500', 'text-gray-400');
            micIcon.parentElement.classList.remove('animate-pulse');
        }
    }
};

async function uploadAndSendMedia(file, fileNameHint) {
    const userId = localStorage.getItem('userId');
    if (!userId) {
        alert('請先登入');
        return;
    }

    const fileExt = fileNameHint.split('.').pop();
    const fileName = `${userId}_${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    try {
        const { data, error } = await window.supabaseClient.storage
            .from('message-images')
            .upload(filePath, file, {
                contentType: file.type,
                upsert: true
            });

        if (error) throw error;

        const { data: { publicUrl } } = window.supabaseClient.storage
            .from('message-images')
            .getPublicUrl(filePath);

        await sendMessage(null, publicUrl);
        clearSelectedMedia();
    } catch (err) {
        console.error('媒體上傳失敗:', err);
        alert('檔案傳送失敗，請稍後再試。原因: ' + err.message);
    }
}

window.handleSendAction = async function() {
    const input = document.getElementById('chat-input');
    if (!input) return;
    
    const content = input.value.trim();

    if (!content && !selectedMediaFile) return;

    const sendBtn = document.getElementById('send-btn');
    if (sendBtn) sendBtn.disabled = true;

    if (selectedMediaFile) {
        await uploadAndSendMedia(selectedMediaFile, selectedMediaFile.name);
    } else {
        await sendMessage(content, null);
    }

    input.value = '';
    if (sendBtn) sendBtn.disabled = false;
};

async function sendMessage(content, mediaUrl) {
    if (!window.activeRoomId || !window.activeChatTarget) {
        alert('無效的聊天對象');
        return;
    }
    refreshMyUser();

    try {
        const { error } = await window.supabaseClient
            .from('messages')
            .insert([{
                room_id: window.activeRoomId,
                sender_name: myUserId, // 修正：精準對應 schema 的 sender_name
                receiver: window.activeChatTarget,
                content: content || '',
                image_url: mediaUrl,
                is_read: false
            }]);

        if (error) throw error;
        
        if (typeof renderMessages === 'function') renderMessages();
    } catch (e) {
        console.error('發送失敗:', e);
        alert('發送失敗: ' + e.message);
    }
}

window.openChat = async function(targetUid, displayName) {
    refreshMyUser();
    if (!myUserId) {
        alert('請先登入');
        return;
    }
    
    window.activeChatTarget = targetUid;
    window.activeRoomId = generateRoomId(myUserId, targetUid);

    const modal = document.getElementById('chat-modal');
    if (!modal) {
        console.error('找不到 ID 為 chat-modal 的元素');
        alert('系統錯誤：找不到聊天室介面組件 (chat-modal)，請確認 HTML 結構是否正確。');
        return;
    }
    
    const nameEl = document.getElementById('chat-target-name');
    if (nameEl) nameEl.innerText = displayName || '未知用戶';
    
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.remove('translate-x-full'), 10);

    try {
        await window.supabaseClient
            .from('messages')
            .update({ is_read: true })
            .eq('room_id', window.activeRoomId)
            .eq('receiver', myUserId);
    } catch (e) {
        console.warn('標記已讀失敗，但不影響聊天:', e);
    }

    loadMessages();
    setupChatRealtime();
};

async function loadMessages() {
    if (!window.activeRoomId) return;
    const container = document.getElementById('chat-messages');
    if (!container) return;
    
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
        console.error('載入訊息失敗:', e);
        container.innerHTML = `<div class="p-10 text-center text-red-400">載入失敗</div>`;
    }
}

function drawMessages(messages) {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    
    if (!messages || messages.length === 0) {
        const nameEl = document.getElementById('chat-target-name');
        const name = nameEl ? nameEl.innerText : '對方';
        container.innerHTML = `<div class="p-10 text-center text-gray-300 text-sm">開始與 ${name} 聊天吧</div>`;
        return;
    }

    container.innerHTML = messages.map(m => {
        // 修正：比對 sender_name 確認是否為本人發送
        const isMine = m.sender_name === myUserId;
        const msgClass = isMine ? 'bg-sexify text-white rounded-tr-none' : 'bg-gray-100 text-gray-800 rounded-tl-none';
        const wrapperClass = isMine ? 'justify-end' : 'justify-start';

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

window.playVoice = function(url, el) {
    const icon = el.querySelector('i');
    const progressBar = el.querySelector('.progress-bar');
    
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

function setupChatRealtime() {
    if (window.roomChannel) window.roomChannel.unsubscribe();

    window.roomChannel = window.supabaseClient.channel('room_' + window.activeRoomId)
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'messages', 
            filter: `room_id=eq.${window.activeRoomId}` 
        }, payload => {
            if (payload.new.receiver === myUserId) {
                window.supabaseClient.from('messages').update({ is_read: true }).eq('id', payload.new.id);
            }
            loadMessages(); 
        })
        .subscribe();
}

window.closeChat = function() {
    window.activeChatTarget = null;
    window.activeRoomId = null;
    if (window.roomChannel) window.roomChannel.unsubscribe();
    
    const modal = document.getElementById('chat-modal');
    if (modal) {
        modal.classList.add('translate-x-full');
        setTimeout(() => {
            modal.classList.add('hidden');
        }, 300);
    }
};

window.renderMessages = async function() {
    const container = document.getElementById('chat-list');
    if (!container) return;
    refreshMyUser();
    if (!myUserId) return;

    container.innerHTML = `<div class="p-10 text-center"><i class="fa-solid fa-spinner fa-spin text-gray-300"></i></div>`;

    try {
        // 修正：移除 JOIN 查詢，改為純粹獲取訊息，然後再手動關聯
        const { data: msgData, error: msgError } = await window.supabaseClient
            .from('messages')
            .select('*')
            .or(`sender_name.eq.${myUserId},receiver.eq.${myUserId}`)
            .order('created_at', { ascending: false });

        if (msgError) throw msgError;

        const rooms = {};
        msgData.forEach(m => {
            if (!rooms[m.room_id]) rooms[m.room_id] = m;
        });

        const sortedRooms = Object.values(rooms);

        if (sortedRooms.length === 0) {
            container.innerHTML = `<div class="p-10 text-center text-gray-400">目前沒有訊息</div>`;
            return;
        }

        // 手動批次獲取聊天對象的 Profile 資料
        const targetIds = [...new Set(sortedRooms.map(m => m.sender_name === myUserId ? m.receiver : m.sender_name))];
        
        const { data: profilesData } = await window.supabaseClient
            .from('profiles')
            .select('id, display_name, avatar_url, username')
            .in('id', targetIds);
            
        const profilesMap = {};
        if (profilesData) {
            profilesData.forEach(p => profilesMap[p.id] = p);
        }

        container.innerHTML = sortedRooms.map(m => {
            const targetId = m.sender_name === myUserId ? m.receiver : m.sender_name;
            const prof = profilesMap[targetId];
            
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
        }).join('');

    } catch (e) {
        console.error('渲染訊息列表失敗:', e);
        container.innerHTML = `<div class="p-10 text-center text-red-400">載入失敗: ${e.message}</div>`;
    }
};
