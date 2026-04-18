/**
 * auth.js - 核心身分驗證系統 (修復解鎖失效與點擊鎖死版)
 */
let isLoginMode = true; 

// --- 🔓 忘記密碼 Modal 控制邏輯 ---
function toggleForgotModal(show) {
    const modal = document.getElementById('forgot-password-modal');
    const msgLabel = document.getElementById('modal-message');
    const emailInput = document.getElementById('modal-reset-email');
    
    if (show) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        if (msgLabel) msgLabel.textContent = ""; 
        if (emailInput) emailInput.value = "";
    } else {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

async function handleModalResetRequest() {
    const email = document.getElementById('modal-reset-email').value.trim();
    const btn = document.getElementById('modal-reset-btn');
    const msgLabel = document.getElementById('modal-message');

    if (!email) {
        if (msgLabel) {
            msgLabel.style.color = "#ff4d4f";
            msgLabel.textContent = "❌ 請輸入有效的 Email";
        }
        return;
    }

    btn.disabled = true;
    const originalText = btn.innerText;
    btn.innerText = "發送中...";

    try {
        const { error } = await window.supabaseClient.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + '/reset-password.html',
        });
        if (error) throw error;
        if (msgLabel) {
            msgLabel.style.color = "#52c41a";
            msgLabel.textContent = "✅ 郵件已發送！請檢查信箱。";
        }
        setTimeout(() => {
            toggleForgotModal(false);
            btn.disabled = false;
            btn.innerText = originalText;
        }, 3000);
    } catch (err) {
        if (msgLabel) {
            msgLabel.style.color = "#ff4d4f";
            const errorMsg = err.message === "Email rate limit exceeded" ? "發送太頻繁，請稍後再試" : err.message;
            msgLabel.textContent = "❌ " + errorMsg;
        }
        btn.disabled = false;
        btn.innerText = originalText;
    }
}

// --- 🔐 登入/註冊 切換邏輯 ---
function toggleAuthMode() {
    isLoginMode = !isLoginMode;
    const registerFields = document.getElementById('auth-register-only-fields');
    const title = document.getElementById('auth-title');
    const subtitle = document.getElementById('auth-subtitle');
    const btn = document.getElementById('auth-btn');
    const switchText = document.getElementById('auth-switch-text');
    const switchBtn = document.getElementById('auth-switch-btn');

    if (isLoginMode) {
        if(registerFields) registerFields.classList.add('hidden');
        if(title) title.innerText = "SEXIFY";
        if(subtitle) subtitle.innerText = "登入以繼續探索";
        if(btn) btn.innerText = "登入";
        if(switchText) switchText.innerText = "還沒有帳號嗎？";
        if(switchBtn) switchBtn.innerText = "立即註冊";
    } else {
        if(registerFields) registerFields.classList.remove('hidden');
        if(title) title.innerText = "加入 SEXIFY";
        if(subtitle) subtitle.innerText = "建立您的專屬帳號";
        if(btn) btn.innerText = "註冊並滿18歲";
        if(switchText) switchText.innerText = "已經有帳號了？";
        if(switchBtn) switchBtn.innerText = "登入";
    }
}

// --- 🚀 登入與註冊執行邏輯 ---
async function handleAuthAction() {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value.trim();
    const btn = document.getElementById('auth-btn');
    if (!email || !password) return alert("請填寫信箱與密碼");
    btn.disabled = true;
    btn.innerText = "處理中...";

    try {
        if (isLoginMode) {
            const { error } = await window.supabaseClient.auth.signInWithPassword({ email, password });
            if (error) throw error;
            window.location.reload();
        } else {
            const displayName = document.getElementById('auth-display-name').value.trim();
            const username = document.getElementById('auth-username').value.trim();
            const gender = document.getElementById('auth-gender').value;
            const birthday = document.getElementById('auth-birthday').value;
            const tosChecked = document.getElementById('auth-tos').checked;

            if (!displayName || !username || !birthday || gender === "Unspecified") throw new Error("請填寫所有資料。");
            if (!tosChecked) throw new Error("您必須同意條款。");

            const birthDate = new Date(birthday);
            const today = new Date();
            let age = today.getFullYear() - birthDate.getFullYear();
            if (today.getMonth() < birthDate.getMonth() || (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate())) age--;
            if (age < 18) throw new Error("須年滿 18 歲。");

            const { error } = await window.supabaseClient.auth.signUp({
                email, password,
                options: { data: { display_name: displayName, username, gender, birthday } }
            });
            if (error) throw error;
            window.location.reload();
        }
    } catch (err) {
        alert("錯誤: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerText = isLoginMode ? "登入" : "註冊並滿18歲";
    }
}

// --- 🚪 登出邏輯 ---
async function logoutUser() {
    await window.supabaseClient.auth.signOut();
    localStorage.clear();
    sessionStorage.clear();
    window.location.replace(window.location.pathname);
}

// --- 🏠 核心修復：解鎖 UI 邏輯 ---
function updateUIAccess(hasSession) {
    const authModal = document.getElementById('auth-modal');
    const appContent = document.getElementById('app-content');
    
    if (hasSession) {
        // 解鎖
        if (authModal) authModal.classList.add('hidden');
        if (appContent) {
            appContent.classList.remove('blur-2xl', 'pointer-events-none');
            appContent.style.pointerEvents = 'auto'; // 強制覆蓋
            appContent.style.filter = 'none'; // 強制覆蓋
        }
    } else {
        // 鎖定
        if (authModal) authModal.classList.remove('hidden');
        if (appContent) {
            appContent.classList.add('blur-2xl', 'pointer-events-none');
        }
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // 確保配置已載入
    if (!window.supabaseClient) {
        console.error("Supabase Client 未就緒");
        return;
    }

    // 1. 立即檢查一次 Session
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    if (session) {
        localStorage.setItem('userId', session.user.id);
        localStorage.setItem('myChatName', session.user.user_metadata?.display_name || "使用者");
        updateUIAccess(true);
        window.dispatchEvent(new Event('authReady'));
    } else {
        updateUIAccess(false);
    }

    // 2. 監聽狀態變更 (登入、登出、Token 刷新)
    window.supabaseClient.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            updateUIAccess(true);
        } else if (event === 'SIGNED_OUT') {
            updateUIAccess(false);
            localStorage.clear();
            sessionStorage.clear();
        }
    });
});
