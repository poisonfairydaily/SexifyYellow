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
            // 登入流程
            const { error } = await window.supabaseClient.auth.signInWithPassword({ email, password });
            if (error) throw error;
            
            // 登入成功後，重新導向乾淨的網址來重置 JS 記憶體
            window.location.href = window.location.pathname; 
        } else {
            // 註冊流程
            const nameEl = document.getElementById('auth-name');
            const name = nameEl && nameEl.value ? nameEl.value : "使用者";
            
            // 為了確保新註冊不會被舊狀態污染，先清除一次儲存空間
            localStorage.clear();
            sessionStorage.clear();
            
            const { error } = await window.supabaseClient.auth.signUp({
                email, 
                password,
                options: { data: { display_name: name } }
            });
            if (error) throw error;
            
            alert("註冊成功！系統已為您建立帳號，即將進入。");
            window.location.href = window.location.pathname; 
        }
    } catch (err) {
        alert(err.message || "發生錯誤");
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

// 實作徹底的登出邏輯 (解決快取與幽靈 Session 問題)
async function logoutUser() {
    try {
        // 1. 呼叫 Supabase 登出，清除伺服器與本機的 session
        const { error } = await window.supabaseClient.auth.signOut();
        if (error) throw error;

        // 2. 徹底清除瀏覽器的所有暫存資料
        localStorage.clear();
        sessionStorage.clear();

        // 3. 確保 Supabase 自己在 localStorage 裡面的 token 也被強行拔除
        for (let key in localStorage) {
            if (key.startsWith('sb-')) {
                localStorage.removeItem(key);
            }
        }

        // 4. 強制重新載入頁面，清除 JavaScript 記憶體中的全域變數
        // 使用 replace 避免使用者按上一頁又回到舊狀態
        window.location.replace(window.location.pathname);
        
    } catch (err) {
        console.error("Logout Error:", err.message);
        alert("登出過程發生異常，已強制為您清除本機登入資料。");
        // 即使發生錯誤，也要強制清空並重整，確保安全
        localStorage.clear();
        sessionStorage.clear();
        window.location.replace(window.location.pathname);
    }
}

// 監聽登入狀態並控制 Modal 顯示
document.addEventListener('DOMContentLoaded', async () => {
    if (!window.supabaseClient) return;
    
    // 檢查初始狀態
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    const authModal = document.getElementById('auth-modal');

    if (session) {
        if(authModal) authModal.classList.add('hidden');
        const realName = session.user.user_metadata?.display_name;
        // 每次重整都用最新 session 更新 localStorage，確保抓到對的人
        localStorage.setItem('myChatName', realName || "使用者");
    } else {
        // 沒有 session，確保所有畫面呈現登出狀態，並清空殘留資料
        if(authModal) authModal.classList.remove('hidden');
        localStorage.clear();
        sessionStorage.clear();
    }

    // 加入即時狀態監聽器：當偵測到被登出時，強制阻擋畫面
    window.supabaseClient.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') {
            localStorage.clear();
            sessionStorage.clear();
            const authModalEl = document.getElementById('auth-modal');
            // 如果登出狀態下，登入框竟然是隱藏的，直接強制重整頁面
            if (authModalEl && authModalEl.classList.contains('hidden')) {
                window.location.replace(window.location.pathname);
            }
        }
    });
});
