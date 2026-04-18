// js/config.js
const CONFIG = {
    SUPABASE_URL: 'https://shsmvbeebuxscnvnmlzf.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', // 你的 Anon Key
};

// 為了讓其他 JS 檔案能讀取到，我們可以掛載到 window 物件
window.APP_CONFIG = CONFIG;
