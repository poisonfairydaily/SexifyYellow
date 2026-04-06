let isLoginMode = true; 

function toggleAuthMode() {
    isLoginMode = !isLoginMode;
    const nameField = document.getElementById('auth-name-field');
    const title = document.getElementById('auth-title');
    const subtitle = document.getElementById('auth-subtitle');
    const btn = document.getElementById('auth-btn');
    const switchText = document.getElementById('auth-switch-text');
    const switchBtn = document.getElementById('auth-switch-btn');

    if (isLoginMode) {
        if(nameField) nameField.classList.add('hidden');
        if(title) title.innerText = "SEXIFY";
        if(subtitle) subtitle.innerText = "登入以繼續探索";
        if(btn) btn.innerText = "登入";
        if(switchText) switchText.innerText = "還沒有帳號嗎？";
        if(switchBtn) switchBtn.innerText = "立即註冊";
    } else {
        if(nameField) nameField.classList.remove('hidden');
        if(title) title.innerText = "加入 SEXIFY";
        if(subtitle) subtitle.innerText = "建立您的專屬帳號";
        if(btn) btn.innerText = "註冊";
        if(switchText) switchText.innerText = "已經有帳號了？";
        if(switchBtn) switchBtn.innerText = "登入";
    }
}

async function handleAuthAction() {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const btn = document.getElementById('auth-btn');
    const originalText = btn.innerText;

    if (!email || !password) return alert("請填寫完整資訊！");

    try {
        btn.innerText = "處理中...";
        btn.disabled = true;

        if (isLoginMode) {
            const { data, error } = await window.supabaseClient.auth.signInWithPassword({ email, password });
            if (error) throw error;
            
            // 【修復核心 1】重整頁面前，強制先更新 LocalStorage，解決同步抓取舊資料的問題
            if (data.session) {
                localStorage.setItem('userId', data.session.user.id);
                localStorage.setItem('myChatName', data.session.user.user_metadata?.display_name || "使用者");
            }
            
            window.location.replace(window.location.pathname); 
        } else {
            const nameEl = document.getElementById('auth-name');
            const name = nameEl && nameEl.value ? nameEl.value : "使用者";
            
            localStorage.clear();
            sessionStorage.clear();
            
            const { data, error } = await window.supabaseClient.auth.signUp({
                email, 
                password,
                options: { data: { display_name: name } }
            });
            if (error) throw error;
            
            // 【修復核心 1】註冊成功也必須立刻寫入 LocalStorage
            if (data.session) {
                localStorage.setItem('userId', data.session.user.id);
                localStorage.setItem('myChatName', data.session.user.user_metadata?.display_name || "使用者");
            }
            
            alert("註冊成功！系統已為您建立帳號，即將進入。");
            window.location.replace(window.location.pathname); 
        }
    } catch (err) {
        alert(err.message || "發生錯誤");
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

async function logoutUser() {
    try {
        const { error } = await window.supabaseClient.auth.signOut();
        if (error) throw error;

        localStorage.clear();
        sessionStorage.clear();

        for (let key in localStorage) {
            if (key.startsWith('sb-')) {
                localStorage.removeItem(key);
            }
        }

        window.location.replace(window.location.pathname);
    } catch (err) {
        console.error("Logout Error:", err.message);
        alert("登出過程發生異常，已強制為您清除本機登入資料。");
        localStorage.clear();
        sessionStorage.clear();
        window.location.replace(window.location.pathname);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    if (!window.supabaseClient) return;
    
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    const authModal = document.getElementById('auth-modal');

    if (session) {
        if(authModal) authModal.classList.add('hidden');
        
        // 【修復核心 2】確保啟動時 userId 絕對存在，修復發送訊息會卡住崩潰的 Bug
        localStorage.setItem('userId', session.user.id);
        localStorage.setItem('myChatName', session.user.user_metadata?.display_name || "使用者");
        
        // 發送廣播：通知其他腳本「身分已準備完畢，可以開始抓資料了」
        window.dispatchEvent(new Event('authReady'));
    } else {
        if(authModal) authModal.classList.remove('hidden');
        localStorage.clear();
        sessionStorage.clear();
    }

    window.supabaseClient.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') {
            localStorage.clear();
            sessionStorage.clear();
            const authModalEl = document.getElementById('auth-modal');
            if (authModalEl && authModalEl.classList.contains('hidden')) {
                window.location.replace(window.location.pathname);
            }
        }
    });
});
