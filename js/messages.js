// ==========================================
// js/messages.js - 修復無效 ID 與身分識別問題
// ==========================================

window.activeRoomId = null;
window.activeChatTarget = null;
window.roomChannel = null;

// 安全獲取 ID 的工具
async function getValidUserId() {
    // 優先檢查 Supabase Session
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    if (session) return session.user.id;
    
    // 如果 Session 還沒好，嘗試 getUser
    const { data: { user } } = await window.supabaseClient.auth.getUser();
    return user ? user.id : null;
}

// 監聽 AuthReady 事件，確保登入後才加載列表
document.addEventListener('authReady', async () => {
    console.log("登入已確認，加載聊天列表...");
    await loadChatList();
});

window.loadChatList = async function() {
    const listContainer = document.getElementById('chat-list');
    if (!listContainer) return;

    try {
        const myId = await getValidUserId();
        if (!myId) {
            console.warn("聊天列表：尚未登入");
            return;
        }

        // 讀取與我相關的最新訊息
        const { data, error } = await window.supabaseClient
            .from('messages')
            .select(`
                id, content, created_at, sender_id, receiver, room_id,
                profiles!messages_sender_id_fkey(display_name, avatar_url)
            `)
            .or(`sender_id.eq.${myId},receiver.eq.${myId}`)
            .order('created_at', { ascending: false });

        if (error) throw error;
        renderChatList(data, myId);
    } catch (e) {
        console.error("載入聊天列表失敗", e);
    }
};

// 修復發送邏輯：加入 sender_id
window.handleSendAction = async function() {
    const input = document.getElementById('chat-input');
    const content = input.value.trim();
    const myId = await getValidUserId();

    if (!content || !myId || !window.activeChatTarget) return;

    try {
        const { error } = await window.supabaseClient
            .from('messages')
            .insert([{
                room_id: window.generateRoomId(myId, window.activeChatTarget),
                sender_id: myId,
                receiver: window.activeChatTarget,
                content: content
            }]);

        if (error) throw error;
        input.value = '';
    } catch (e) {
        alert("發送失敗");
    }
};
