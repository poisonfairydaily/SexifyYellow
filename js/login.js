// ==========================================
// js/login.js - 完整版 (登入/註冊/忘記密碼) - 防止死循環修復版
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    const emailInput = document.getElementById('auth-email');
    const passwordInput = document.getElementById('auth-password');
    const btnLogin = document.getElementById('btn-login');
    const btnRegister = document.getElementById('btn-register');
    const btnForgot = document.getElementById('btn-forgot-password');
    const msgBox = document.getElementById('auth-message');

    // ✨ 終極防護：如果畫面上沒有登入信箱輸入框，代表這不是登入頁面，直接停止執行，防止無限循環！
    if (!emailInput) return;

    function showMessage(msg, isError = false) {
        if (!msgBox) return;
        msgBox.textContent = msg;
        msgBox.classList.remove('hidden');
        msgBox.className = `mt-4 text-center text-xs font-bold ${isError ? 'text-red-500' : 'text-green-500'} block animate-pulse`;
    }

    async function checkSession() {
        if (!window.supabaseClient) return;
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        
        // ✨ 修改跳轉邏輯：只有在登入頁面且有 session 時，才使用 replace 跳轉 (防止上一頁循環)
        if (session && window.location.pathname.includes('login.html')) {
            window.location.replace('index.html');
        }
    }
    checkSession();

    if (btnLogin) {
        btnLogin.addEventListener('click', async () => {
            const email = emailInput?.value.trim();
            const password = passwordInput?.value.trim();
            
            if (!email || !password) return showMessage('請輸入信箱與密碼', true);
            
            btnLogin.disabled = true;
            const originalText = btnLogin.innerText;
            btnLogin.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

            try {
                const { data, error } = await window.supabaseClient.auth.signInWithPassword({ email, password });
                if (error) throw error;
                
                showMessage('登入成功！正在跳轉...', false);
                localStorage.setItem('userId', data.user.id);
                // 使用 replace 避免瀏覽器歷史紀錄產生死循環
                setTimeout(() => { window.location.replace('index.html'); }, 500);
            } catch (error) {
                btnLogin.disabled = false;
                btnLogin.innerText = originalText;
                showMessage('登入失敗：' + error.message, true);
            }
        });
    }

    if (btnRegister) {
        btnRegister.addEventListener('click', async () => {
            const email = emailInput?.value.trim();
            const password = passwordInput?.value.trim();

            if (!email || !password) return showMessage('請輸入信箱與密碼以進行註冊', true);
            if (password.length < 6) return showMessage('密碼至少需要 6 個字元', true);

            btnRegister.disabled = true;
            const originalText = btnRegister.innerText;
            btnRegister.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

            try {
                const { data, error } = await window.supabaseClient.auth.signUp({ email, password });
                if (error) throw error;

                if (data.user) {
                    await window.supabaseClient.from('profiles').upsert([
                        { id: data.user.id, display_name: '新用戶', username: 'u_' + Math.floor(Math.random() * 100000) }
                    ]);
                }
                showMessage('註冊成功！歡迎加入，正在跳轉...', false);
                setTimeout(() => { window.location.replace('index.html'); }, 1000);
            } catch (error) {
                btnRegister.disabled = false;
                btnRegister.innerText = originalText;
                showMessage('註冊失敗：' + error.message, true);
            }
        });
    }

    if (btnForgot) {
        btnForgot.addEventListener('click', async () => {
            const email = emailInput?.value.trim();
            if (!email) return showMessage('請先在上方輸入您的 Email，再點擊忘記密碼', true);

            btnForgot.disabled = true;
            const originalText = btnForgot.innerText;
            btnForgot.innerText = "發送中...";

            try {
                const { error } = await window.supabaseClient.auth.resetPasswordForEmail(email, {
                    redirectTo: window.location.origin + '/reset-password.html',
                });
                if (error) throw error;

                showMessage('✅ 重設連結已發送至您的信箱！', false);
                setTimeout(() => {
                    btnForgot.disabled = false;
                    btnForgot.innerText = originalText;
                }, 5000);
            } catch (error) {
                showMessage('發送失敗：' + error.message, true);
                btnForgot.disabled = false;
                btnForgot.innerText = originalText;
            }
        });
    }
});
