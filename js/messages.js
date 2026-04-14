// ==========================================
// js/messages.js - 核心通訊最終安全強化版 (全替換完整版)
// ==========================================

window.activeRoomId = null;
window.activeChatTarget = null;
window.roomChannel = null;     

let selectedMediaFile = null; 
let mediaRecorder = null;
let audioChunks = [];
window.isRecording = false;

// 1. 取得當前經過驗證的真實 User ID
async function getValidUserId() {
    // 優先從 session 獲取，這最準確
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    if (session) return session.user.id;
    
    // 如果 session 沒拿到，再試一次 getUser
    const { data: { user } } = await window.supabaseClient.auth.getUser();
    return user ? user.id : null;
}

function generateRoomId(id1, id2) { 
    if (!id1 || !id2) return null;
    return [id1, id2].sort().join('_'); 
}

// 2. 搜尋發起對話 (帶 XSS 防禦)
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

        container.innerHTML = data.map(u => {
            const safeName = window.escapeHTML(u.display_name || '未命名');
            const safeAvatar = window.escapeHTML(u.avatar_url || 'https://ui-avatars.com/api/?name=' + safeName);
            return `
                <div class="flex items-center gap-3 p-4 border-b border-gray-50 active:bg-gray-50 transition cursor-pointer" onclick="openChat('${u.id}', '${safeName}')">
                    <img src="${safeAvatar}" class="w-12 h-12 rounded-full object-cover">
                    <div>
                        <div class="font-bold text-gray-800">${safeName}</div>
                        <div class="text-xs text-gray-400">@${window.escapeHTML(u.username || '')}</div>
                    </div>
                </div>`;
        }).join('');
    } catch (e) {
        container.innerHTML = `<div class="p-10 text-center text-red-400">搜尋失敗</div>`;
    }
}

// 3. 發送訊息 (配合 RLS 與身份驗證)
async function sendMessage(content, mediaUrl) {
    const myRealId = await getValidUserId();
    if (!myRealId) return alert('請先登入');

    if (!window.activeRoomId || !window.activeChatTarget) return alert('無效的聊天對象');

    try {
        const { error } = await window.supabaseClient
            .from('messages')
            .insert([{
                room_id: window.activeRoomId,
                sender_name: myRealId, 
                receiver: window.activeChatTarget,
                content: content || '',
                image_url: mediaUrl,
                is_read: false
            }]);

        if (error) throw error;
        if (typeof renderMessages === 'function') renderMessages();
    } catch (e) {
        console.error('發送失敗:', e);
        alert('發送失敗，請確認身分權限');
    }
}

// 4. 開啟聊天室
window.openChat = async function(targetUid, displayName) {
    const myRealId = await getValidUserId();
    if (!myRealId) return alert('請先登入');
    
    window.activeChatTarget = targetUid;
    window.activeRoomId = generateRoomId(myRealId, targetUid);

    const modal = document.getElementById('chat-modal');
    if (!modal) return;
    
    document.getElementById('chat-target-name').innerText = displayName || '未知用戶';
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.remove('translate-x-full'), 10);

    try {
        await window.supabaseClient
            .from('messages')
            .update({ is_read: true })
            .eq('room_id', window.activeRoomId)
            .eq('receiver', myRealId);
    } catch (e) {}

    loadMessages();
    setupChatRealtime();
};

// 5. 載入訊息
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
        container.innerHTML = `<div class="p-10 text-center text-red-400">載入失敗</div>`;
    }
}

// 6. 繪製訊息泡泡
async function drawMessages(messages) {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    const myRealId = await getValidUserId();
    
    if (!messages || messages.length === 0) {
        container.innerHTML = `<div class="p-10 text-center text-gray-300 text-sm">開始聊天吧</div>`;
        return;
    }

    container.innerHTML = messages.map(m => {
        const isMine = m.sender_name === myRealId;
        const msgClass = isMine ? 'bg-sexify text-white rounded-tr-none' : 'bg-gray-100 text-gray-800 rounded-tl-none';
        const wrapperClass = isMine ? 'justify-end' : 'justify-start';

        const safeContent = window.escapeHTML(m.content || '');
        const safeUrl = window.escapeHTML(m.image_url || '');

        return `
            <div class="flex ${wrapperClass} mb-4">
                <div class="max-w-[80%] ${msgClass} px-4 py-2 rounded-2xl shadow-sm">
                    ${safeContent ? `<div class="text-sm">${safeContent}</div>` : ''}
                    ${safeUrl ? `<img src="${safeUrl}" class="rounded-lg mt-1 max-w-full" onclick="window.open('${safeUrl}')">` : ''}
                    <div class="text-[9px] opacity-50 mt-1 text-right">
                        ${new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                </div>
            </div>`;
    }).join('');
    
    container.scrollTop = container.scrollHeight;
}

// 7. 渲染訊息列表 (首頁 Inbox)
window.renderMessages = async function() {
    const container = document.getElementById('chat-list');
    if (!container) return;
    const myRealId = await getValidUserId();
    if (!myRealId) return;

    try {
        const { data: msgData, error: msgError } = await window.supabaseClient
            .from('messages')
            .select('*')
            .or(`sender_name.eq.${myRealId},receiver.eq.${myRealId}`)
            .order('created_at', { ascending: false });

        if (msgError) throw msgError;

        const rooms = {};
        msgData.forEach(m => { if (!rooms[m.room_id]) rooms[m.room_id] = m; });
        const sortedRooms = Object.values(rooms);

        const targetIds = [...new Set(sortedRooms.map(m => m.sender_name === myRealId ? m.receiver : m.sender_name))];
        const { data: profilesData } = await window.supabaseClient.from('profiles').select('id, display_name, avatar_url').in('id', targetIds);
            
        const profilesMap = {};
        if (profilesData) profilesData.forEach(p => profilesMap[p.id] = p);

        container.innerHTML = sortedRooms.map(m => {
            const targetId = m.sender_name === myRealId ? m.receiver : m.sender_name;
            const prof = profilesMap[targetId];
            const safeName = window.escapeHTML(prof?.display_name || '未知用戶');
            const isUnread = !m.is_read && m.receiver === myRealId;

            return `
                <div class="flex items-center gap-3 p-4 border-b border-gray-50 active:bg-gray-50 transition cursor-pointer ${isUnread ? 'bg-red-50/30' : ''}" 
                     onclick="openChat('${targetId}', '${safeName}')">
                    <img src="${window.escapeHTML(prof?.avatar_url || 'https://ui-avatars.com/api/?name=' + safeName)}" class="w-14 h-14 rounded-full object-cover">
                    <div class="flex-1 overflow-hidden">
                        <div class="flex justify-between items-center mb-1">
                            <span class="font-bold text-gray-800">${safeName}</span>
                            <span class="text-[10px] text-gray-400">${new Date(m.created_at).toLocaleDateString()}</span>
                        </div>
                        <div class="text-xs text-gray-400 truncate">${window.escapeHTML(m.content || (m.image_url ? '[媒體]' : ''))}</div>
                    </div>
                </div>`;
        }).join('');
    } catch (e) {
        container.innerHTML = `<div class="p-10 text-center text-red-400">載入清單失敗</div>`;
    }
};

function setupChatRealtime() {
    if (!window.activeRoomId) return;
    if (window.roomChannel) window.roomChannel.unsubscribe();

    window.roomChannel = window.supabaseClient.channel('room_' + window.activeRoomId)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${window.activeRoomId}` }, payload => {
        loadMessages();
    })
    .subscribe();
}

window.closeChat = function() {
    window.activeChatTarget = null;
    window.activeRoomId = null;
    const modal = document.getElementById('chat-modal');
    if (modal) {
        modal.classList.add('translate-x-full');
        setTimeout(() => modal.classList.add('hidden'), 300);
    }
};
