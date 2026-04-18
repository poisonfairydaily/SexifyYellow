/**
 * auth.js - 核心身分驗證系統 (含登入、註冊、忘記密碼 Modal 邏輯)
 */
let isLoginMode = true; 

// --- 🔓 忘記密碼 Modal 控制邏輯 ---

/**
 * 切換忘記密碼彈窗顯示狀態
 */
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

/**
 * 處理忘記密碼郵件發送 (Modal 版本)
 */
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
            // ✨ 成功後引導使用者至重設密碼頁面
            redirectTo: window.location.origin + '/reset-password.html',
        });

        if (error) throw error;

        if (msgLabel) {
            msgLabel.style.color = "#52c41a";
            msgLabel.textContent = "✅ 郵件已發送！請檢查信箱。";
        }
        
        // 3秒後自動關閉 Modal 並恢復按鈕
        setTimeout(() => {
            toggleForgotModal(false);
            btn.disabled = false;
            btn.innerText = originalText;
        }, 3000);

    } catch (err) {
        console.error("Reset Password Error:", err);
        if (msgLabel) {
            msgLabel.style.color = "#ff4d4f";
            // 人性化轉換發送太頻繁的錯誤訊息
            const errorMsg = err.message === "Email rate limit exceeded" 
                ? "發送太頻繁，請稍後再試" 
                : err.message;
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
            // 登入邏輯
            const { data, error } = await window.supabaseClient.auth.signInWithPassword({ email, password });
            if (error) throw error;
            alert("登入成功！");
            window.location.reload();
        } else {
            // 註冊邏輯
            const displayName = document.getElementById('auth-display-name').value.trim();
            const username = document.getElementById('auth-username').value.trim();
            const gender = document.getElementById('auth-gender').value;
            const birthday = document.getElementById('auth-birthday').value;
            const tosChecked = document.getElementById('auth-tos').checked;

            if (!displayName || !username || !birthday || gender === "Unspecified") {
                throw new Error("請填寫所有註冊資料（顯示名稱、帳號名、性別與生日）。");
            }
            if (!tosChecked) {
                throw new Error("您必須同意服務條款並確認已滿18歲。");
            }

            // 年齡驗證
            const birthDate = new Date(birthday);
            const today = new Date();
            let age = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }

            if (age < 18) {
                throw new Error("抱歉，您必須年滿 18 歲才能註冊此網站。");
            }

            const { data, error } = await window.supabaseClient.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        display_name: displayName,
                        username: username,
                        gender: gender,
                        birthday: birthday
                    }
                }
            });

            if (error) throw error;
            alert("註冊成功！系統將自動為您登入。");
            window.location.reload();
        }
    } catch (err) {
        console.error("Auth Error:", err);
        alert("錯誤: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerText = isLoginMode ? "登入" : "註冊並滿18歲";
    }
}

// --- 🚪 登出邏輯 ---

async function logoutUser() {
    try {
        const { error } = await window.supabaseClient.auth.signOut();
        if (error) throw error;
        localStorage.clear();
        sessionStorage.clear();
        window.location.replace(window.location.pathname);
    } catch (err) {
        console.error("Logout Error:", err.message);
        alert("登出發生異常，已強制清除本機資料。");
        localStorage.clear();
        sessionStorage.clear();
        window.location.replace(window.location.pathname);
    }
}

// --- 🏠 初始化與狀態監聽 ---

document.addEventListener('DOMContentLoaded', async () => {
    if (!window.supabaseClient) return;
    
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    const authModal = document.getElementById('auth-modal');
    const appContent = document.getElementById('app-content');

    if (session) {
        if(authModal) authModal.classList.add('hidden');
        if(appContent) {
            appContent.classList.remove('blur-2xl', 'pointer-events-none');
        }
        localStorage.setItem('userId', session.user.id);
        localStorage.setItem('myChatName', session.user.user_metadata?.display_name || "使用者");
        window.dispatchEvent(new Event('authReady'));
    } else {
        if(authModal) authModal.classList.remove('hidden');
        if(appContent) {
            appContent.classList.add('blur-2xl', 'pointer-events-none');
        }
    }

    window.supabaseClient.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') {
            localStorage.clear();
            sessionStorage.clear();
            const authModalEl = document.getElementById('auth-modal');
            const appContentEl = document.getElementById('app-content');
            if (authModalEl) authModalEl.classList.remove('hidden');
            if (appContentEl) appContentEl.classList.add('blur-2xl', 'pointer-events-none');
        }
    });
});
