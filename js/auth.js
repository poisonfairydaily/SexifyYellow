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
        nameField.classList.add('hidden');
        title.innerText = "SEXIFY";
        subtitle.innerText = "登入以繼續探索";
        btn.innerText = "登入";
        switchText.innerText = "還沒有帳號嗎？";
        switchBtn.innerText = "立即註冊";
    } else {
        nameField.classList.remove('hidden');
        title.innerText = "加入 SEXIFY";
        subtitle.innerText = "建立您的專屬帳號";
        btn.innerText = "註冊";
        switchText.innerText = "已經有帳號了？";
        switchBtn.innerText = "登入";
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
            const name = document.getElementById('auth-name').value;
            if (!name) throw new Error("請輸入顯示名稱！");
            const { error } = await window.supabaseClient.auth.signUp({
                email, 
                password,
                options: { data: { display_name: name } }
            });
            if (error) throw error;
            alert("註冊成功！我們已經為您建立好帳號，即將自動登入。");
            window.location.reload();
        }
    } catch (err) {
        alert(err.message || "發生錯誤");
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

// 【登出邏輯】
async function logoutUser() {
    try {
        const { error } = await window.supabaseClient.auth.signOut();
        if (error) throw error;
        localStorage.clear();
        window.location.reload();
    } catch (err) {
        console.error("Logout Error:", err.message);
        alert("登出過程發生錯誤");
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    const authModal = document.getElementById('auth-modal');

    if (session) {
        authModal.classList.add('hidden');
        const realName = session.user.user_metadata.display_name;
        localStorage.setItem('myChatName', realName || "使用者");
    } else {
        authModal.classList.remove('hidden');
    }
});
