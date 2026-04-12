let isLoginMode = true; 

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

async function handleAuthAction() {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value.trim();
    const btn = document.getElementById('auth-btn');
    
    if (!email || !password) return alert("請填寫信箱與密碼");
    
    btn.disabled = true;
    btn.innerText = "處理中...";

    try {
        if (isLoginMode) {
            // --- 登入邏輯 ---
            const { data, error } = await window.supabaseClient.auth.signInWithPassword({ email, password });
            if (error) throw error;
            alert("登入成功！");
            window.location.reload();
        } else {
            // --- 註冊邏輯 (加入年齡與資料驗證) ---
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

            // 嚴格計算年齡
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

            // 發送註冊請求至 Supabase
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

async function logoutUser() {
    try {
        const { error } = await window.supabaseClient.auth.signOut();
        if (error) throw error;
        localStorage.clear();
        sessionStorage.clear();
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
    const appContent = document.getElementById('app-content');

    if (session) {
        // 如果有登入狀態，隱藏登入框
        if(authModal) authModal.classList.add('hidden');
        
        // 核心修復：解除首頁的模糊鎖死狀態，讓使用者可以操作
        if(appContent) {
            appContent.classList.remove('blur-2xl', 'pointer-events-none');
        }
        
        localStorage.setItem('userId', session.user.id);
        localStorage.setItem('myChatName', session.user.user_metadata?.display_name || "使用者");
        
        window.dispatchEvent(new Event('authReady'));
    } else {
        // 沒有登入狀態，顯示登入框
        if(authModal) authModal.classList.remove('hidden');
        // 確保沒登入時畫面保持模糊不可點
        if(appContent) {
            appContent.classList.add('blur-2xl', 'pointer-events-none');
        }
        localStorage.clear();
        sessionStorage.clear();
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
