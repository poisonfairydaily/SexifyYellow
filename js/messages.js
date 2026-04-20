// ==========================================
// js/messages.js - 完整升級版 (未讀數量 + 影片支援 + 在線狀態修復)
// ==========================================

window.activeRoomId = null;
window.activeChatTarget = null;
window.roomChannel = null;

let mediaRecorder = null;
let audioChunks = [];
window.isRecording = false;
window.selectedMediaUrl = null;

// 內部工具：將檔案上傳至 Supabase Storage (media 桶)
async function uploadMediaToSupabase(fileBlob, filePath) {
    try {
        const { data, error } = await window.supabaseClient.storage
            .from('media')
            .upload(filePath, fileBlob, {
                cacheControl: '3600',
                upsert: false
            });

        if (error) throw error;

        // 取得公開網址
        const { data: publicData } = window.supabaseClient.storage
            .from('media')
            .getPublicUrl(filePath);

        return publicData.publicUrl;
    } catch (err) {
        console.error("Supabase 上傳失敗:", err);
        throw err;
    }
}

// 純 CSS 頭像產生器 (解決 UI-Avatars 的 CORS 報錯)
function getFallbackAvatar(name) {
    const char = name ? name.charAt(0).toUpperCase() : 'U';
    return `<div class="w-full h-full rounded-full flex items-center justify-center text-white text-xs font-bold" style="background: linear-gradient(135deg, #FF6B6B, #FF8E53)">${char}</div>`;
}

function safeText(str) {
    if (!str) return '';
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

async function getValidUserId() {
    const { data: { user } } = await window.supabaseClient.auth.getUser();
    return user ? user.id : null;
}

function generateRoomId(id1, id2) {
    if (!id1 || !id2) return null;
    return [id1, id2].sort().join('_');
}

function scrollToBottom() {
    const container = document.getElementById('chat-messages');
    if (container) {
        setTimeout(() => {
            container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
        }, 150);
    }
}

// 更新 UI 在線狀態 (修復假在線問題)
function updateOnlineStatusUI(isOnline) {
    const statusText = document.querySelector('#chat-modal span.uppercase');
    if (!statusText) return;
    statusText.innerHTML = isOnline ? '● Online' : '● Offline';
    statusText.className = `text-[10px] font-bold mt-1 uppercase tracking-tighter ${isOnline ? 'text-green-500' : 'text-gray-400'}`;
}

window.handleSendAction = async function() {
    const input = document.getElementById('chat-input');
    const content = input.value.trim();
    const btn = document.getElementById('send-btn');

    if (!content && !window.selectedMediaUrl) return;
    btn.disabled = true;

    try {
        const myId = await getValidUserId();
        if (!myId || !window.activeRoomId) return alert('請先登入');

        const { error } = await window.supabaseClient.from('messages').insert([{
            room_id: window.activeRoomId,
            sender_name: myId,
            receiver: window.activeChatTarget,
            content: content,
            image_url: window.selectedMediaUrl,
            is_read: false
        }]);

        if (error) throw error;
        input.value = '';
        window.selectedMediaUrl = null; // 發送後清空
        await loadMessages();
        scrollToBottom();
        
        // 發送訊息後更新外層列表，將最後一句話推到最上面
        if(typeof window.renderMessages === 'function') window.renderMessages();
    } catch (e) {
        alert('傳送失敗');
    } finally {
        btn.disabled = false;
    }
};

// 渲染對話內容 (✨新增影片判斷與渲染)
function drawMessages(messages) {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    
    window.supabaseClient.auth.getUser().then(({data: {user}}) => {
        const myId = user?.id;
        let lastDate = null;

        container.innerHTML = messages.map(m => {
            const isMine = m.sender_name === myId;
            const msgClass = isMine ? 'bg-sexify text-white rounded-tr-none' : 'bg-gray-100 text-gray-800 rounded-tl-none';
            const wrapperClass = isMine ? 'justify-end' : 'justify-start';
            
            const messageDate = new Date(m.created_at).toLocaleDateString();
            let dateSeparator = '';
            if (messageDate !== lastDate) {
                const displayDate = messageDate === new Date().toLocaleDateString() ? '今天' : messageDate;
                dateSeparator = `<div class="flex justify-center my-6"><span class="bg-gray-200 text-gray-500 text-[10px] px-3 py-1 rounded-full font-bold">${displayDate}</span></div>`;
                lastDate = messageDate;
            }

            const cleanContent = safeText(m.content);
            const safeImgUrl = m.image_url ? encodeURI(m.image_url) : null;
            
            // 判斷媒體類型
            const isAudio = safeImgUrl && (safeImgUrl.match(/\.(mp3|wav|m4a)$/i) || safeImgUrl.includes('voice_'));
            const isVideo = safeImgUrl && safeImgUrl.match(/\.(mp4|webm|mov|ogg)$/i) && !isAudio;
            
            let mediaHtml = '';
            if (safeImgUrl) {
                if (isAudio) {
                    mediaHtml = `<audio src="${safeImgUrl}" controls class="h-8 mt-1 max-w-[200px] sm:max-w-xs"></audio>`;
                } else if (isVideo) {
                    mediaHtml = `<video src="${safeImgUrl}" controls playsinline class="rounded-lg mt-1 max-w-full shadow-sm max-h-48 bg-black object-cover"></video>`;
                } else {
                    mediaHtml = `<img src="${safeImgUrl}" class="rounded-lg mt-1 max-w-full shadow-sm object-cover">`;
                }
            }

            return `
                ${dateSeparator}
                <div class="flex ${wrapperClass} mb-4 px-4 animate-fade-in">
                    <div class="max-w-[80%] ${msgClass} px-4 py-2 rounded-2xl shadow-sm relative group">
                        ${cleanContent ? `<div class="text-sm whitespace-pre-wrap">${cleanContent}</div>` : ''}
                        ${mediaHtml}
                        <div class="text-[9px] opacity-50 mt-1 text-right">${new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</div>
                        ${isMine ? `<button onclick="window.deleteMessage('${m.id}', '${m.sender_name}', '${m.image_url || ''}')" class="absolute -left-8 top-1/2 -translate-y-1/2 text-gray-300 opacity-0 group-hover:opacity-100 transition p-2"><i class="fa-solid fa-trash-can text-xs"></i></button>` : ''}
                    </div>
                </div>`;
        }).join('');
    });
}

// 渲染訊息列表 (✨新增未讀數量計算)
window.renderMessages = async function() {
    const container = document.getElementById('chat-list');
    const myId = await getValidUserId();
    if (!container || !myId) return;

    const { data: msgData } = await window.supabaseClient.from('messages')
        .select('*').or(`sender_name.eq.${myId},receiver.eq.${myId}`)
        .order('created_at', { ascending: false });

    if (!msgData) return;

    const rooms = {};
    const unreadCounts = {};

    msgData.forEach(m => { 
        if (!rooms[m.room_id]) rooms[m.room_id] = m; // 保留每個房間最新的一則訊息
        
        // 如果我是接收者且這則訊息還沒讀過，數量+1
        if (m.receiver === myId && m.is_read === false) {
            unreadCounts[m.room_id] = (unreadCounts[m.room_id] || 0) + 1;
        }
    });
    
    const sortedRooms = Object.values(rooms);
    const targetIds = sortedRooms.map(m => m.sender_name === myId ? m.receiver : m.sender_name);
    const { data: profiles } = await window.supabaseClient.from('profiles').select('id, display_name, avatar_url').in('id', targetIds);
    const profMap = Object.fromEntries(profiles?.map(p => [p.id, p]) || []);

    if (sortedRooms.length === 0) {
        container.innerHTML = `<div class="text-center py-20 text-gray-400 text-sm font-bold">目前還沒有訊息喔</div>`;
        return;
    }

    container.innerHTML = sortedRooms.map(m => {
        const tid = m.sender_name === myId ? m.receiver : m.sender_name;
        const p = profMap[tid];
        const name = p?.display_name || '用戶';
        
        // 判斷最後一句話是不是媒體
        let lastMsg = '';
        if (m.content) {
            lastMsg = safeText(m.content);
        } else if (m.image_url) {
            if (m.image_url.match(/\.(mp4|webm|mov|ogg)$/i) && !m.image_url.includes('voice_')) lastMsg = '[影片]';
            else if (m.image_url.match(/\.(mp3|wav|m4a)$/i) || m.image_url.includes('voice_')) lastMsg = '[語音]';
            else lastMsg = '[圖片]';
        }
        
        const avatarPart = p?.avatar_url 
            ? `<img src="${p.avatar_url}" class="w-full h-full rounded-full object-cover border border-gray-100">`
            : getFallbackAvatar(name);
            
        // 未讀紅點 HTML
        const unreads = unreadCounts[m.room_id] || 0;
        const unreadBadge = unreads > 0 
            ? `<div class="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm">${unreads > 99 ? '99+' : unreads}</div>` 
            : '';
        
        // 如果有未讀，讓預覽文字變黑變粗體
        const textStyle = unreads > 0 ? "text-gray-900 font-bold" : "text-gray-400";
        
        return `
            <div class="flex items-center gap-3 p-4 border-b border-gray-50 active:bg-gray-50 transition cursor-pointer" onclick="openChat('${tid}', '${safeText(name)}', '${p?.avatar_url || ''}')">
                <div class="w-14 h-14 bg-gray-100 rounded-full relative flex-shrink-0">${avatarPart}</div>
                <div class="flex-1 overflow-hidden flex flex-col justify-center">
                    <div class="flex justify-between items-center font-bold text-sm text-gray-900 mb-1">
                        <span class="truncate pr-2">${safeText(name)}</span>
                        ${unreadBadge}
                    </div>
                    <div class="text-xs ${textStyle} truncate pr-4">${lastMsg}</div>
                </div>
            </div>`;
    }).join('');

    // ✨ 確保外層列表更新時，底部的全域紅點也同步狀態
    if(typeof window.updateGlobalMessageBadge === 'function') window.updateGlobalMessageBadge();
};

window.openChat = async function(targetUid, displayName, avatarUrl) {
    const myId = await getValidUserId(); 
    if (!myId) return;
    
    window.activeChatTarget = targetUid;
    window.activeRoomId = generateRoomId(myId, targetUid);
    
    if(document.getElementById('chat-name')) document.getElementById('chat-name').innerText = safeText(displayName);
    
    const avatarImg = document.getElementById('chat-target-avatar');
    if (avatarImg) {
        avatarImg.src = avatarUrl || `https://ui-avatars.com/api/?name=${safeText(displayName)}&background=random`;
    }
    
    // ✨ 修復: 打開聊天室時先預設為 Offline，避免被硬生生寫死的 Online 騙了
    updateOnlineStatusUI(false);
    
    const modal = document.getElementById('chat-modal');
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.remove('translate-x-full'), 10);
    
    // 一打開就把該房間、對方傳給我的訊息標記為已讀
    await window.supabaseClient.from('messages').update({ is_read: true }).eq('room_id', window.activeRoomId).eq('receiver', myId);
    
    // ✨ 更新外層列表以消除紅點，同時同步全域底部紅點
    if(typeof window.renderMessages === 'function') window.renderMessages();
    if(typeof window.updateGlobalMessageBadge === 'function') window.updateGlobalMessageBadge();
    
    await loadMessages();
    scrollToBottom();
    setupChatRealtime();
};

async function loadMessages() {
    if (!window.activeRoomId) return;
    const { data, error } = await window.supabaseClient.from('messages')
        .select('*').eq('room_id', window.activeRoomId).order('created_at', { ascending: true });
    if (!error) drawMessages(data);
}

function setupChatRealtime() {
    if (!window.activeRoomId) return;
    if (window.roomChannel) window.roomChannel.unsubscribe();

    window.roomChannel = window.supabaseClient.channel('room_' + window.activeRoomId);

    window.roomChannel
        .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'messages', 
            filter: `room_id=eq.${window.activeRoomId}` 
        }, async () => {
            // 如果對方發新訊息，自動把狀態標成已讀
            const myId = await getValidUserId();
            await window.supabaseClient.from('messages').update({ is_read: true }).eq('room_id', window.activeRoomId).eq('receiver', myId);
            
            await loadMessages();
            scrollToBottom();
            
            // ✨ 同步更新外層最新文字與全域紅點
            if(typeof window.renderMessages === 'function') window.renderMessages();
            if(typeof window.updateGlobalMessageBadge === 'function') window.updateGlobalMessageBadge();
        })
        .on('presence', { event: 'sync' }, () => {
            const state = window.roomChannel.presenceState();
            const isOnline = Object.values(state).flat().some(p => p.user_id === window.activeChatTarget);
            updateOnlineStatusUI(isOnline);
        })
        .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                const myId = await getValidUserId();
                await window.roomChannel.track({
                    user_id: myId,
                    online_at: new Date().toISOString(),
                });
            }
        });
}

window.deleteMessage = async function(msgId, senderId, mediaUrl) {
    const myId = await getValidUserId();
    if (myId !== senderId) return; 
    if (!confirm('確定回收這條訊息？(相關媒體檔案也將從伺服器永久刪除)')) return;
    
    try {
        // 如果有 Supabase Storage 的網址，同步刪除實體檔案
        if (mediaUrl && mediaUrl.includes('/storage/v1/object/public/media/')) {
            const filePath = mediaUrl.split('/storage/v1/object/public/media/')[1];
            if (filePath) {
                await window.supabaseClient.storage.from('media').remove([filePath]);
            }
        }

        await window.supabaseClient.from('messages').delete().eq('id', msgId);
        loadMessages();
        if(typeof window.renderMessages === 'function') window.renderMessages(); // 同步更新外層最新文字
    } catch (e) { 
        console.error(e);
        alert('回收失敗'); 
    }
};

window.closeChat = function() {
    if (window.roomChannel) {
        window.roomChannel.untrack(); // 離開時主動解除線上追蹤
        window.roomChannel.unsubscribe();
    }
    window.activeRoomId = null;
    const modal = document.getElementById('chat-modal');
    modal.classList.add('translate-x-full');
    setTimeout(() => modal.classList.add('hidden'), 300);
};

// ==========================================
// 🎙️ 語音錄製核心邏輯 (直接上傳 Supabase)
// ==========================================
window.toggleVoiceRecord = async function() {
    const btnIcon = document.querySelector('[onclick*="toggleVoiceRecord"] i');
    const input = document.getElementById('chat-input');
    
    if (!window.isRecording) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            
            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunks.push(e.data);
            };
            
            mediaRecorder.onstop = async () => {
                const myId = await getValidUserId();
                
                // 動態判斷附檔名 (iOS 通常為 mp4/aac，Android/PC 為 webm)
                const mimeType = mediaRecorder.mimeType || 'audio/webm';
                const audioBlob = new Blob(audioChunks, { type: mimeType });
                const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
                
                // 設定在 Supabase Storage 中的路徑
                const filePath = `chat_media/voice_${myId}_${Date.now()}.${ext}`;

                const originalPlaceholder = input.placeholder;
                input.placeholder = "語音上傳中，請稍候...";
                input.disabled = true;

                try {
                    // 呼叫上方的 Supabase 上傳工具函數
                    const publicUrl = await uploadMediaToSupabase(audioBlob, filePath);
                    if (publicUrl) {
                        window.selectedMediaUrl = publicUrl;
                        await window.handleSendAction();
                    }
                } catch (e) { 
                    console.error("語音上傳錯誤:", e);
                    alert('語音上傳失敗，請確認網路連線與資料庫權限。'); 
                } finally {
                    input.placeholder = originalPlaceholder;
                    input.disabled = false;
                }
                
                stream.getTracks().forEach(track => track.stop());
            };
            
            mediaRecorder.start();
            window.isRecording = true;
            
            if(btnIcon) {
                btnIcon.classList.remove('fa-microphone');
                btnIcon.classList.add('fa-stop', 'text-red-500', 'animate-pulse');
            }
        } catch (e) { 
            console.error("麥克風錯誤:", e);
            alert('無法開啟麥克風。請確認：\n1. 您的網站使用 HTTPS 連線\n2. 已同意瀏覽器存取麥克風權限。'); 
        }
    } else {
        if(mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        }
        window.isRecording = false;
        
        if(btnIcon) {
            btnIcon.classList.add('fa-microphone');
            btnIcon.classList.remove('fa-stop', 'text-red-500', 'animate-pulse');
        }
    }
};

// ==========================================
// 🖼️ 圖片/影片上傳邏輯 (支援影片格式)
// ==========================================
window.handleImageSelection = async function(input) {
    const file = input.files[0];
    if (!file) return;
    
    const chatInput = document.getElementById('chat-input');
    const originalPlaceholder = chatInput.placeholder;
    chatInput.placeholder = "媒體檔案上傳中...";
    chatInput.disabled = true;

    try {
        const myId = await getValidUserId();
        // 抓取副檔名 (例如 .jpg, .png, .mp4, .mov)
        const ext = file.name.split('.').pop().toLowerCase() || 'jpg';
        const isVideoUpload = ['mp4', 'webm', 'mov', 'ogg'].includes(ext);
        const prefix = isVideoUpload ? 'vid_' : 'img_';
        
        const filePath = `chat_media/${prefix}${myId}_${Date.now()}.${ext}`;

        const publicUrl = await uploadMediaToSupabase(file, filePath);
        
        if (publicUrl) {
            window.selectedMediaUrl = publicUrl;
            await window.handleSendAction();
        }
    } catch (e) { 
        console.error("上傳錯誤:", e);
        alert('媒體上傳失敗'); 
    } finally {
        chatInput.placeholder = originalPlaceholder;
        chatInput.disabled = false;
        input.value = ''; // 清除 input 檔案，允許重複選擇同個檔案
    }
};
