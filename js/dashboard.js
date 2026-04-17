/**
 * dashboard.js - 管理員審核後台
 */
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function loadPendingProducts() {
    const listContainer = document.getElementById('audit-list');
    
    // 1. 抓取所有 pending 的商品
    const { data: products, error } = await supabaseClient
        .from('products')
        .select('*')
        .eq('status', 'pending') 
        .order('created_at', { ascending: false });

    if (error) return console.error(error);
    
    document.getElementById('pending-count').innerText = products.length;
    listContainer.innerHTML = '';

    products.forEach(p => {
        // 假設你的 image_url 儲存的是多張圖片，我們取第一張顯示
        const firstImg = p.image_url.split(',')[0];
        const imgUrl = `${SUPABASE_URL}/storage/v1/object/public/previews/${firstImg}`;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><img src="${imgUrl}" style="width: 100px; height: 100px; object-fit: cover;"></td>
            <td>${p.name}</td>
            <td>$${p.price}</td>
            <td><small>${p.creator_id}</small></td>
            <td>
                <button onclick="updateStatus('${p.id}', 'approved')" style="color: green;">✅ 通過</button>
                <button onclick="updateStatus('${p.id}', 'rejected')" style="color: red;">❌ 拒絕</button>
            </td>
        `;
        listContainer.appendChild(tr);
    });
}

// 2. 更新狀態的功能
window.updateStatus = async (id, newStatus) => {
    const { error } = await supabaseClient
        .from('products')
        .update({ status: newStatus })
        .eq('id', id);

    if (error) alert("更新失敗：" + error.message);
    else {
        alert(`商品已標記為 ${newStatus}`);
        loadPendingProducts(); // 重新整理清單
    }
};

// 頁面載入時執行
window.onload = loadPendingProducts;
