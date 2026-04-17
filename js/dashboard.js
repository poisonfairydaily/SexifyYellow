/**
 * dashboard.js - 管理員審核中控台 (含檢舉統計顯示)
 */
const SUPABASE_URL = 'https://shsmvbeebuxscnvnmlzf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNoc212YmVlYnV4c2Nudm5tbHpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NDU5MTgsImV4cCI6MjA5MDQyMTkxOH0.kK5A0RYj6RrzBJHMleKcFQp4wVq7hCm-lVDTbnxrFJQ';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- 🔐 門禁核心：頁面載入時立即檢查權限 ---
window.onload = async () => {
    const { data: { session } } = await supabaseClient.auth.getSession();

    if (!session) {
        alert("請先登入管理員帳號");
        window.location.href = 'index.html'; 
        return;
    }

    const { data: profile, error: profileError } = await supabaseClient
        .from('profiles')
        .select('is_admin')
        .eq('id', session.user.id)
        .single();

    if (profileError || !profile?.is_admin) {
        alert("權限不足：你不是管理員！");
        window.location.href = 'index.html';
        return;
    }

    loadAuditList();
};

/**
 * dashboard.js 渲染 logic 修正
 */
async function loadAuditList() {
    // ... 前面的 listContainer.innerHTML 保持不變 ...

    try {
        // ✨ 確保查詢包含聚合計數
        const { data: products, error } = await supabaseClient
            .from('products')
            .select('*, reports(count)')
            .order('created_at', { ascending: false });

        if (error) throw error;
        
        listContainer.innerHTML = '';

        products.forEach(p => {
            const report = p.ai_report || {};
            const firstImg = p.image_url?.split(',')[0] || '';
            const imgUrl = `${SUPABASE_URL}/storage/v1/object/public/previews/${firstImg}`;
            
            // 🔍 這裡是最容易出錯的地方：Supabase 的聚合結果處理
            let reportCount = 0;
            if (p.reports && p.reports.length > 0) {
                // 有些版本回傳是物件，有些是陣列，這裡做相容性處理
                reportCount = p.reports[0].count !== undefined ? p.reports[0].count : p.reports.length;
            }

            // 只有大於 0 才顯示警告，增加視覺張力
            const reportAlert = reportCount > 0 
                ? `<div style="color:#ff4d4f; font-weight:bold; font-size:11px; margin-top:5px; background:rgba(255,77,79,0.1); padding:2px 6px; border-radius:4px; display:inline-block;">⚠️ 檢舉: ${reportCount}</div>` 
                : '';

            const getClr = (v) => (v === 'LIKELY' || v === 'VERY_LIKELY') ? '#ff4d4f' : '#8c8c8c';

            const tr = document.createElement('tr');
            tr.style.borderBottom = "1px solid #eee";
            tr.innerHTML = `
                <td style="padding: 15px;"><img src="${imgUrl}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px;"></td>
                <td style="padding: 15px;">
                    <div style="font-weight:bold; color:#333;">${p.name}</div>
                    <div style="font-size:10px; color:#999; margin-top:2px;">ID: ${p.id.substring(0,8)}...</div>
                    <div style="margin-top:5px;"><span style="font-size:10px; background:#eee; padding:2px 6px; border-radius:4px;">${p.status}</span></div>
                    ${reportAlert}
                </td>
                <td style="padding: 15px; font-weight:bold;">🪙 ${p.price}</td>
                <td style="padding: 15px; font-size: 11px; font-family: monospace;">
                    <div style="color: ${getClr(report.violence)}">💀 暴力: ${report.violence || 'N/A'}</div>
                    <div style="color: ${getClr(report.medical)}">🩸 血腥: ${report.medical || 'N/A'}</div>
                    <div style="color: #8c8c8c">👙 挑逗: ${report.racy || 'N/A'}</div>
                </td>
                <td style="padding: 15px;">
                    <div style="display:flex; flex-direction:column; gap:8px;">
                        <button onclick="updateStatus('${p.id}', 'approved')" style="background:#52c41a; color:white; border:none; padding:8px; border-radius:8px; cursor:pointer; font-size:12px; font-weight:bold;">通過</button>
                        <button onclick="updateStatus('${p.id}', 'rejected')" style="background:#ff4d4f; color:white; border:none; padding:8px; border-radius:8px; cursor:pointer; font-size:12px; font-weight:bold;">刪除</button>
                    </div>
                </td>
            `;
            listContainer.appendChild(tr);
        });
    } catch (err) {
        console.error("Dashboard Error:", err);
    }
}

// 更新狀態函式
window.updateStatus = async (id, newStatus) => {
    // 如果是 rejected，通常建議直接從 products 表刪除或隱藏
    // 這裡我們維持 update 狀態
    const { error } = await supabaseClient.from('products').update({ status: newStatus }).eq('id', id);
    if (error) {
        console.error(error);
        alert("操作失敗，可能是權限不足或網路問題");
    } else {
        loadAuditList(); // 重新整理清單
    }
};
