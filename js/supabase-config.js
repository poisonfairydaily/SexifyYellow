// ==========================================
// 🔥 Supabase 資料庫連線設定檔
// ==========================================

// 1. 你的專屬網路住址與公開金鑰 (直接使用你提供的)
const SUPABASE_URL = "https://shsmvbeebuxscnvnmlzf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yeW9ldHp2d3dqa2dvZ2lmcWdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MDUwNTksImV4cCI6MjA5MTk4MTA1OX0.FhCtNKacJCVrHpP7CZcb4sbhy3fN4mEPmk7_aMyRqF0";

// 2. 建立連線並設為全域變數 (window.supabaseClient)
if (window.supabase) {
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log("✅ Supabase 連線已成功初始化！");
} else {
    console.error("❌ 找不到 Supabase 核心套件，請確認 index.html 有正確引入。");
}// 全域防禦 XSS 的轉義工具
window.escapeHTML = function(str) {
    if (typeof str !== 'string') return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};
