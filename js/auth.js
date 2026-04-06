// js/auth.js

// 登入功能
async function loginUser(email, password) {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password,
    });
    if (error) throw error;
    return data;
}

// 註冊功能
async function signupUser(email, password, metadata) {
    const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
            data: metadata // 包含 username, avatar 等
        }
    });
    if (error) throw error;
    return data;
}

// 【新增】登出功能
async function logoutUser() {
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
        console.error('Logout error:', error.message);
        alert('登出失敗，請稍後再試');
    } else {
        // 登出成功後，強制重新載入頁面以清空所有記憶體中的狀態與訂閱
        window.location.reload();
    }
}

// 監聽身份驗證狀態變化
supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN') {
        console.log('User signed in:', session.user);
        document.getElementById('auth-modal').classList.add('hidden');
        // 初始化用戶數據
        if (typeof initApp === 'function') initApp(session.user);
    }
    if (event === 'SIGNED_OUT') {
        console.log('User signed out');
        // 顯示登入彈窗
        document.getElementById('auth-modal').classList.remove('hidden');
    }
});
