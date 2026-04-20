// ==========================================
// 🔥 Supabase & Cloudflare R2 設定檔
// ==========================================

// 1. Supabase 連線設定
const SUPABASE_URL = "https://shsmvbeebuxscnvnmlzf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNoc212YmVlYnV4c2Nudm5tbHpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NDU5MTgsImV4cCI6MjA5MDQyMTkxOH0.kK5A0RYj6RrzBJHMleKcFQp4wVq7hCm-lVDTbnxrFJQ";

// 2. ✨ Cloudflare R2 設定 (剛拿到的公開開發網址)
window.R2_PUBLIC_URL = "https://pub-2915df0675504948a36a7921daf79af1.r2.dev"; // 👈 請把這裡換成你剛在截圖位址看到的網址

// 3. 建立連線並設為全域變數
if (window.supabase) {
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else {
    console.error("❌ 找不到 Supabase 核心套件，請確認 index.html 有正確引入。");
}

// 4. 全域防禦 XSS 的轉義工具 (修復之前 discovery.js 可能報錯的問題)
window.escapeHTML = function(str) {
    if (typeof str !== 'string') return str || '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};
