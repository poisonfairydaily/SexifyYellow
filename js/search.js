document.addEventListener("DOMContentLoaded", () => {
    const searchInput = document.getElementById("searchInput");
    const searchResults = document.getElementById("searchResults");
    let searchTimeout = null;

    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            const query = e.target.value.trim();
            if (searchTimeout) clearTimeout(searchTimeout);

            if (query === "") {
                searchResults.innerHTML = `<div class="text-center text-gray-400 mt-10 text-sm">請在上方輸入關鍵字開始搜尋...</div>`;
                return;
            }

            searchResults.innerHTML = `<div class="text-center py-10"><i class="fa-solid fa-spinner fa-spin text-gray-400 text-2xl"></i></div>`;
            searchTimeout = setTimeout(() => performSearch(query), 500);
        });
    }

    async function performSearch(query) {
        try {
            // 防止查詢字串包含逗號導致 Supabase 的 .or() 語法解析錯誤
            const safeQuery = query.replace(/,/g, '');

            const { data: users, error } = await window.supabaseClient
                .from("profiles")
                .select("*") // 改為選取所有欄位，防止某些舊帳號結構不完整導致報錯崩潰
                .or(`username.ilike.%${safeQuery}%,display_name.ilike.%${safeQuery}%`)
                .limit(20);

            if (error) {
                console.error("Supabase 搜尋 API 錯誤:", error);
                throw error;
            }

            if (!users || users.length === 0) {
                searchResults.innerHTML = `<div class="text-center text-gray-400 mt-10 text-sm font-bold flex flex-col items-center"><i class="fa-solid fa-user-slash text-3xl mb-2 opacity-50"></i>找不到該用戶</div>`;
                return;
            }

                        const escapeHTML = window.escapeHTML || function(str) {
                return String(str).replace(/[&<>'"]/g, match => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[match]));
            };

            searchResults.innerHTML = users.map(user => {
                const avatar = escapeHTML(user.avatar_url || "https://ui-avatars.com/api/?name=User");
                const name = escapeHTML(user.display_name || user.username || "未命名");
                const bioRaw = user.bio ? user.bio.substring(0, 20) + '...' : "點擊查看主頁";
                const bio = escapeHTML(bioRaw);
                const safeId = escapeHTML(user.id);
                return `
                <div class="flex items-center gap-4 p-3 bg-white rounded-2xl shadow-sm mb-3 cursor-pointer border border-gray-100 active:scale-95 transition" onclick="toggleSearch(false); viewOtherProfile('${safeId}')">
                    <img src="${avatar}" class="w-12 h-12 rounded-full object-cover">
                    <div class="flex-1 overflow-hidden">
                        <div class="font-bold text-gray-800 text-sm truncate">${name}</div>
                        <div class="text-gray-400 text-xs truncate">${bio}</div>
                    </div>
                </div>`;
            }).join('');

        } catch (err) {
            console.error("搜尋例外錯誤:", err);
            searchResults.innerHTML = `<div class="text-center text-red-500 mt-10 text-sm">搜尋發生錯誤，請確認網路連線或資料庫狀態。</div>`;
        }
    }
});
