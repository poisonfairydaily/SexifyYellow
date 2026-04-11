document.addEventListener("DOMContentLoaded", () => {
    if (!window.supabaseClient) {
        console.error("❌ Search 模組載入失敗：找不到 Supabase Client。");
        return;
    }

    const searchInput = document.getElementById("searchInput");
    const searchResults = document.getElementById("searchResults");
    let searchTimeout = null;

    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            const query = e.target.value.trim();
            
            if (searchTimeout) {
                clearTimeout(searchTimeout);
            }

            if (query === "") {
                renderEmptyState();
                return;
            }

            searchResults.innerHTML = `<div class="text-center py-10"><i class="fa-solid fa-spinner fa-spin text-gray-400 text-2xl"></i></div>`;

            searchTimeout = setTimeout(() => {
                performSearch(query);
            }, 500); 
        });
    }

    async function performSearch(query) {
        try {
            const { data: users, error } = await window.supabaseClient
                .from("profiles")
                .select("id, username, display_name, avatar_url, bio")
                .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
                .limit(20);

            if (error) throw error;

            if (!users || users.length === 0) {
                renderNoResults();
                return;
            }

            searchResults.innerHTML = ""; 

            users.forEach(user => {
                const userCard = document.createElement("div");
                userCard.className = "flex items-center gap-4 p-3 bg-white rounded-2xl shadow-sm mb-3 cursor-pointer border border-gray-100 active:scale-95 transition";
                
                const avatarUrl = user.avatar_url || "https://ui-avatars.com/api/?name=User&background=random";
                const displayName = user.display_name || user.username || "未命名用戶";
                const bioText = user.bio ? user.bio.substring(0, 20) + '...' : "點擊查看主頁";

                userCard.innerHTML = `
                    <img src="${avatarUrl}" alt="${displayName}" class="w-12 h-12 rounded-full object-cover shadow-sm">
                    <div class="flex-1 overflow-hidden">
                        <div class="font-bold text-gray-800 text-sm truncate">${displayName}</div>
                        <div class="text-gray-400 text-xs truncate">${bioText}</div>
                    </div>
                `;

                userCard.addEventListener("click", () => {
                    window.location.href = `profile.html?userId=${user.id}`;
                });

                searchResults.appendChild(userCard);
            });
        } catch (error) {
            console.error("搜尋發生錯誤:", error);
            searchResults.innerHTML = `<div class="text-center text-red-500 mt-10 text-sm">搜尋失敗，請稍後再試。</div>`;
        }
    }

    function renderEmptyState() {
        if(searchResults) searchResults.innerHTML = `<div class="text-center text-gray-400 mt-10 text-sm">請輸入關鍵字開始搜尋...</div>`;
    }

    function renderNoResults() {
        if(searchResults) searchResults.innerHTML = `<div class="text-center text-gray-400 mt-10 text-sm font-bold">沒有該用戶</div>`;
    }
});
