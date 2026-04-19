// ==========================================
// js/login.js - SFY 獨立登入與註冊邏輯
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    const emailInput = document.getElementById('auth-email');
    const passwordInput = document.getElementById('auth-password');
    const btnLogin = document.getElementById('btn-login');
    const btnRegister = document.getElementById('btn-register');
    const msgBox = document.getElementById('auth-message');

    // 顯示訊息工具
    function showMessage(msg, isError = false) {
        msgBox.textContent = msg;
        msgBox.className = `mt-4 text-center text-xs font-bold ${isError ? 'text-red-500' : 'text-green-500'} block animate-pulse`;
    }

    // 檢查是否已經登入過
    async function checkSession() {
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        if (session) {
            window.location.href = 'index.html'; // 已經登入就直接進首頁
        }
    }
    checkSession();

    // 登入事件
    btnLogin.addEventListener('click', async () => {
        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();

        if (!email || !password) return showMessage('請輸入信箱與密碼', true);
        
        btnLogin.disabled = true;
        btnLogin.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 登入中...';

        const { data, error } = await window.supabaseClient.auth.signInWithPassword({ email, password });

        if (error) {
            btnLogin.disabled = false;
            btnLogin.innerText = '登入';
            showMessage('登入失敗：帳號或密碼錯誤', true);
        } else {
            showMessage('登入成功！正在跳轉...', false);
            localStorage.setItem('userId', data.user.id);
            setTimeout(() => { window.location.href = 'index.html'; }, 500);
        }
    });

    // 註冊事件
    btnRegister.addEventListener('click', async () => {
        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();

        if (!email || !password) return showMessage('請輸入信箱與密碼', true);
        if (password.length < 6) return showMessage('密碼至少需要 6 個字元', true);

        btnRegister.disabled = true;
        btnRegister.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 註冊中...';

        const { data, error } = await window.supabaseClient.auth.signUp({ email, password });

        if (error) {
            btnRegister.disabled = false;
            btnRegister.innerText = '註冊新帳號';
            showMessage('註冊失敗：' + error.message, true);
        } else {
            // 建立初始 Profile 數據
            if (data.user) {
                await window.supabaseClient.from('profiles').insert([
                    { id: data.user.id, display_name: '新用戶', username: 'user_' + Math.floor(Math.random() * 10000) }
                ]);
                localStorage.setItem('userId', data.user.id);
            }
            showMessage('註冊成功！歡迎加入 SFY，正在跳轉...', false);
            setTimeout(() => { window.location.href = 'index.html'; }, 1000);
        }
    });
});
