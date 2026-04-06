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
            const { error } = await window.supabaseClient.auth.signInWithPassword({ email, password });
            if (error) throw error;
            window.location.reload(); 
        } else {
            const nameEl = document.getElementById('auth-name');
            const name = nameEl && nameEl.value ? nameEl.value : "使用者";
            const { error } = await window.supabaseClient.auth.signUp({
                email, 
                password,
                options: { data: { display_name: name } }
            });
            if (error) throw error;
            alert("註冊成功！系統已為您建立帳號，即將自動登入。");
            window.location.reload();
        }
    } catch (err) {
        alert(err.message || "發生錯誤");
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

// 實作真正的登出邏輯
async function logoutUser() {
    try {
        const { error } = await window.supabaseClient.auth.signOut();
        if (error) throw error;
        localStorage.clear();
        window.location.reload(); // 重整後會自動觸發下方監聽器，顯示登入框
    } catch (err) {
        console.error("Logout Error:", err.message);
        alert("登出過程發生錯誤");
    }
}

// 監聽登入狀態並控制 Modal 顯示
document.addEventListener('DOMContentLoaded', async () => {
    if (!window.supabaseClient) return;
    
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    const authModal = document.getElementById('auth-modal');

    if (session) {
        if(authModal) authModal.classList.add('hidden');
        const realName = session.user.user_metadata?.display_name;
        localStorage.setItem('myChatName', realName || "使用者");
    } else {
        if(authModal) authModal.classList.remove('hidden');
    }
});
