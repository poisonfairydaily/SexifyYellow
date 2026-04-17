/**
 * dashboard.js - 管理員審核中控台 (最穩定版本)
 */
const SUPABASE_URL = 'https://shsmvbeebuxscnvnmlzf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNoc212YmVlYnV4c2Nudm5tbHpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NDU5MTgsImV4cCI6MjA5MDQyMTkxOH0.kK5A0RYj6RrzBJHMleKcFQp4wVq7hCm-lVDTbnxrFJQ';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

window.onload = async () => {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        alert("請先登入管理員帳號");
        window.location.href = 'index.html'; 
        return;
    }
    const { data: profile } = await supabaseClient.from('profiles').select('is_admin').eq('id', session.user.id).single();
    if (!profile?.is_admin) {
        alert("權限不足");
        window.location.href = 'index.html';
        return;
    }
    loadAuditList();
};

async function loadAuditList() {
    const listContainer = document.getElementById('audit-list');
    listContainer.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:50px;">載入中...</td></tr>';

    try {
        // ✨ 使用最新的聚合查詢語法
        const { data: products, error } = await supabaseClient
            .from('products')
            .select('*, reports(count)')
            .order('created_at', { ascending: false });

        if (error) {
            console.error("SQL 查詢出錯:", error);
            // 如果 reports 聯結失敗，嘗試降級抓取純 products
            const { data: fallbackData } = await supabaseClient.from('products').select('*');
            renderTable(fallbackData || []);
            return;
        }

        console.log("抓取到的原始數據:", products);
        renderTable(products);

    } catch (err) {
        console.error("Dashboard Crash:", err);
    }
}

function renderTable(products) {
    const listContainer = document.getElementById('audit-list');
    listContainer.innerHTML = '';

    if (products.length === 0) {
        listContainer.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:50px;color:gray;">目前沒有任何商品</td></tr>';
        return;
    }

    products.forEach(p => {
        const report = p.ai_report || {};
        const firstImg = p.image_url?.split(',')[0] || '';
        const imgUrl = `${SUPABASE_URL}/storage/v1/object/public/previews/${firstImg}`;
        
        // ✨ 檢舉數提取邏輯 (Supabase 聚合結果通常在陣列裡)
        let reportCount = 0;
        if (p.reports && p.reports.length > 0) {
            reportCount = p.reports[0].count;
        }

        const reportAlert = reportCount > 0 
            ? `<div style="color:#ff4d4f; font-weight:bold; font-size:11px; margin-top:5px; background:rgba(255,77,79,0.1); padding:2px 8px; border-radius:10px; display:inline-block;">⚠️ 檢舉: ${reportCount}</div>` 
            : '';

        const getClr = (v) => (v === 'LIKELY' || v === 'VERY_LIKELY') ? '#ff4d4f' : '#8c8c8c';

        const tr = document.createElement('tr');
        tr.style.borderBottom = "1px solid #eee";
        tr.innerHTML = `
            <td style="padding: 15px;"><img src="${imgUrl}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 12px; background:#f5f5f5;"></td>
            <td style="padding: 15px;">
                <div style="font-weight:bold; color:#333; font-size:14px;">${p.name}</div>
                <div style="margin-top:5px;"><span style="font-size:10px; background:#f0f0f0; color:#666; padding:2px 6px; border-radius:4px;">${p.status}</span></div>
                ${reportAlert}
            </td>
            <td style="padding: 15px; font-weight:bold; color:#ff2442;">🪙 ${p.price}</td>
            <td style="padding: 15px; font-size: 11px; font-family: monospace; line-height:1.5;">
                <div style="color: ${getClr(report.violence)}">💀 暴力: ${report.violence || 'N/A'}</div>
                <div style="color: ${getClr(report.medical)}">🩸 血腥: ${report.medical || 'N/A'}</div>
                <div style="color: ${getClr(report.racy)}">👙 挑逗: ${report.racy || 'N/A'}</div>
            </td>
            <td style="padding: 15px;">
                <div style="display:flex; flex-direction:column; gap:8px;">
                    <button onclick="updateStatus('${p.id}', 'approved')" style="background:#52c41a; color:white; border:none; padding:8px 15px; border-radius:10px; cursor:pointer; font-size:12px; font-weight:bold;">通過</button>
                    <button onclick="updateStatus('${p.id}', 'rejected')" style="background:#ff4d4f; color:white; border:none; padding:8px 15px; border-radius:10px; cursor:pointer; font-size:12px; font-weight:bold;">刪除</button>
                </div>
            </td>
        `;
        listContainer.appendChild(tr);
    });
}

window.updateStatus = async (id, newStatus) => {
    const { error } = await supabaseClient.from('products').update({ status: newStatus }).eq('id', id);
    if (error) alert("操作失敗");
    else loadAuditList();
};
