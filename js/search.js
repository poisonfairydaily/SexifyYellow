// ==========================================
// 🔍 全域搜尋模組 (Global Search Logic)
// 檔案路徑: js/search.js
// 依賴: window.supabaseClient (由 supabase-config.js 提供)
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
    // 確保 Supabase 已初始化
    if (!window.supabaseClient) {
        console.error("❌ Search 模組載入失敗：找不到 Supabase Client。");
        return;
    }

    const searchInput = document.getElementById("searchInput");
    const searchResults = document.getElementById("searchResults");
    const closeSearchBtn = document.getElementById("closeSearchBtn");
    
    let searchTimeout = null;

    // 1. 監聽輸入框事件 (加入 Debounce 防抖機制)
    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            const query = e.target.value.trim();
            
            // 清除前一次的計時器
            if (searchTimeout) {
                clearTimeout(searchTimeout);
            }

            // 如果輸入為空，清空結果
            if (query === "") {
                renderEmptyState();
                return;
            }

            // 顯示載入中
            searchResults.innerHTML = `<div class="search-loading">搜尋中 (Searching)...</div>`;

            // 設定 500 毫秒的延遲，用戶停止輸入半秒後才發送請求
            searchTimeout = setTimeout(() => {
                performSearch(query);
            }, 500);
        });
    }

    // 2. 關閉搜尋介面事件
    if (closeSearchBtn) {
        closeSearchBtn.addEventListener("click", () => {
            if (searchInput) searchInput.value = "";
            renderEmptyState();
            // 如果你的搜尋是彈出視窗，這裡可以加上隱藏 UI 的邏輯
            // document.getElementById("search-container").style.display = "none";
        });
    }

    // ==========================================
    // 核心邏輯區
    // ==========================================

    /**
     * 執行 Supabase 搜尋查詢
     * @param {string} query 用戶輸入的關鍵字
     */
    async function performSearch(query) {
        try {
            // 使用 ilike 進行模糊不區分大小寫的搜尋
            // 我們搜尋 display_name 或 username
            const { data, error } = await window.supabaseClient
                .from('profiles')
                .select('id, username, display_name, avatar_url, bio')
                .or(`display_name.ilike.%${query}%,username.ilike.%${query}%`)
                .limit(20); // 限制最多回傳 20 筆避免效能問題

            if (error) {
                throw error;
            }

            renderResults(data);

        } catch (error) {
            console.error("❌ 搜尋發生錯誤:", error.message);
            searchResults.innerHTML = `<div class="search-error">搜尋失敗，請稍後再試。</div>`;
        }
    }

    /**
     * 渲染搜尋結果
     * @param {Array} users 從資料庫抓回來的用戶陣列
     */
    function renderResults(users) {
        if (!users || users.length === 0) {
            searchResults.innerHTML = `<div class="search-no-results">找不到相關創作者 (No creators found).</div>`;
            return;
        }

        searchResults.innerHTML = ""; // 清空目前內容

        users.forEach(user => {
            // 建立單個用戶清單項目
            const userCard = document.createElement("div");
            userCard.className = "search-user-card";
            
            // 安全處理欄位空值
            const avatarUrl = user.avatar_url || "https://ui-avatars.com/api/?name=User&background=random";
            const displayName = user.display_name || user.username || "未命名用戶";
            const bioText = user.bio ? user.bio.substring(0, 30) + '...' : "";

            userCard.innerHTML = `
                <img src="${avatarUrl}" alt="${displayName}" class="search-avatar">
                <div class="search-user-info">
                    <div class="search-user-name">${displayName}</div>
                    <div class="search-user-bio">${bioText}</div>
                </div>
            `;

            // 3. 點擊跳轉邏輯 (解決孤島效應的關鍵)
            userCard.addEventListener("click", () => {
                // 將用戶 UUID 帶入 URL，跳轉到個人頁面 (profile.html 我們下一階段會實作)
                window.location.href = `profile.html?userId=${user.id}`;
            });

            searchResults.appendChild(userCard);
        });
    }

    /**
     * 恢復初始空白狀態
     */
    function renderEmptyState() {
        if (searchResults) {
            searchResults.innerHTML = `<div class="search-empty-state" data-i18n="search_empty">輸入名稱開始搜尋...</div>`;
        }
    }
});