/**
 * dashboard.js - 管理員審核中控台
 */
const SUPABASE_URL = 'https://shsmvbeebuxscnvnmlzf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNoc212YmVlYnV4c2Nudm5tbHpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NDU5MTgsImV4cCI6MjA5MDQyMTkxOH0.kK5A0RYj6RrzBJHMleKcFQp4wVq7hCm-lVDTbnxrFJQ';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function loadAuditList() {
    const listContainer = document.getElementById('audit-list');
    listContainer.innerHTML = '<tr><td colspan="5">載入中...</td></tr>';

    // 抓取待審核商品 (也可去掉 .eq 改為看全部)
    const { data: products, error } = await supabaseClient
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) return console.error(error);
    
    listContainer.innerHTML = '';

    products.forEach(p => {
        const report = p.ai_report || {};
        const firstImg = p.image_url.split(',')[0];
        const imgUrl = `${SUPABASE_URL}/storage/v1/object/public/previews/${firstImg}`;

        // 判斷顏色函式
        const getClr = (v) => (v === 'LIKELY' || v === 'VERY_LIKELY') ? '#ff4d4f' : '#8c8c8c';

        const tr = document.createElement('tr');
        tr.style.borderBottom = "1px solid #eee";
        tr.innerHTML = `
            <td style="padding: 10px;"><img src="${imgUrl}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 5px;"></td>
            <td><strong>${p.name}</strong><br><small style="color:gray">${p.status}</small></td>
            <td>$${p.price}</td>
            <td style="font-size: 12px; font-family: monospace;">
                <div style="color: ${getClr(report.violence)}">💀 暴力: ${report.violence || 'N/A'}</div>
                <div style="color: ${getClr(report.medical)}">🩸 血腥: ${report.medical || 'N/A'}</div>
                <div style="color: #8c8c8c">👙 挑逗: ${report.racy || 'N/A'}</div>
            </td>
            <td>
                <button onclick="updateStatus('${p.id}', 'approved')" style="background:#52c41a; color:white; border:none; padding:5px 10px; border-radius:3px; cursor:pointer;">通過</button>
                <button onclick="updateStatus('${p.id}', 'rejected')" style="background:#ff4d4f; color:white; border:none; padding:5px 10px; border-radius:3px; cursor:pointer; margin-left:5px;">刪除</button>
            </td>
        `;
        listContainer.appendChild(tr);
    });
}

// 更新狀態函式
window.updateStatus = async (id, newStatus) => {
    const { error } = await supabaseClient.from('products').update({ status: newStatus }).eq('id', id);
    if (error) alert("操作失敗");
    else loadAuditList();
};

window.onload = loadAuditList;
