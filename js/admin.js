/**
 * admin.js - 究極管理員核心版 (整合 Dashboard + WebP + AI 審核 + 全域內容中控)
 * 修正：多重關聯錯誤、Description 遺漏、強效刪除機制、✨ AI 報告 Likelihood 相容性修復與二次元偵測
 */

const SUPABASE_URL = 'https://shsmvbeebuxscnvnmlzf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNoc212YmVlYnV4c2Nudm5tbHpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NDU5MTgsImV4cCI6MjA5MDQyMTkxOH0.kK5A0RYj6RrzBJHMleKcFQp4wVq7hCm-lVDTbnxrFJQ';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const WORKER_URL = 'https://sexify-uploader.poisonfairydaily.workers.dev';

const loginSec = document.getElementById('login-section');
const adminSec = document.getElementById('admin-section'); 
const adminDash = document.getElementById('admin-dashboard'); 
const statusText = document.getElementById('status');
const previewContainer = document.getElementById('preview-container');

// --- 🛡️ 0. 安全核心 ---
function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// 用於 AI 標籤的顏色判定
function getAiColor(v) {
    if (v === 'VERY_LIKELY' || v === 'LIKELY') return '#ff4d4f'; // 紅色危險
    if (v === 'POSSIBLE') return '#faad14'; // 橘色警告
    return '#8c8c8c'; // 灰色安全
}

// --- 🔐 1. 初始化門禁檢查 ---
window.onload = async () => {
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();

        if (!session) {
            if(loginSec) loginSec.style.display = 'block';
            return;
        }

        const { data: profile, error: pError } = await supabaseClient
            .from('profiles')
            .select('is_admin')
            .eq('id', session.user.id)
            .single();

        if (pError || !profile?.is_admin) {
            alert("⚠️ 權限不足：您不是管理員");
            await supabaseClient.auth.signOut();
            location.reload();
            return;
        }

        if(loginSec) loginSec.style.display = 'none';
        
        if(adminDash) {
            adminDash.style.display = 'flex';
            if(typeof loadPendingProducts === 'function') loadPendingProducts();
            if(typeof loadRecentPosts === 'function') loadRecentPosts();
            if(typeof loadAuditList === 'function') loadAuditList(); 
        } else if (adminSec) {
            adminSec.style.display = 'block';
        }
        
        console.log("✅ 管理員驗證成功");

    } catch (err) {
        console.error("初始化崩潰:", err);
        if(loginSec) loginSec.style.display = 'block';
    }
};

// --- 🔑 2. 登入/登出功能 ---
const loginBtn = document.getElementById('login-btn');
if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) {
            document.getElementById('login-status').textContent = "❌ " + error.message;
        } else {
            location.reload();
        }
    });
}

const logoutBtnTrigger = document.getElementById('logout-btn-trigger');
if (logoutBtnTrigger) {
    logoutBtnTrigger.addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        location.reload();
    });
}

// --- 🔄 3. 頁籤切換 ---
window.switchTab = function(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    
    const targetTab = document.getElementById(tabId);
    if(targetTab) targetTab.classList.add('active');
    
    if(event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    }
};

// --- 🖼️ 4. 預覽與轉換工具 ---
const pImageInput = document.getElementById('p-image');
if (pImageInput) {
    pImageInput.addEventListener('change', (e) => {
        if(!previewContainer) return;
        previewContainer.innerHTML = '';
        Array.from(e.target.files).forEach(file => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const img = document.createElement('img');
                img.src = ev.target.result;
                img.className = 'preview-img';
                img.style = "width: 80px; height: 80px; object-fit: cover; border-radius: 8px; margin: 4px; border: 1px solid #eee;";
                previewContainer.appendChild(img);
            };
            reader.readAsDataURL(file);
        });
    });
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
    });
}

async function generateWebPBlob(file) {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = URL.createObjectURL(file);
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const max_size = 1200; 
            let width = img.width, height = img.height;
            if (width > height) { if (width > max_size) { height *= max_size / width; width = max_size; } }
            else { if (height > max_size) { width *= max_size / height; height = max_size; } }
            canvas.width = width; canvas.height = height;
            ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob((blob) => resolve(blob), 'image/webp', 0.85); 
        };
    });
}

// --- 🚀 5. 上架主邏輯 ---
const uploadBtn = document.getElementById('upload-btn');
if (uploadBtn) {
    uploadBtn.addEventListener('click', async () => {
        const rawName = document.getElementById('p-name')?.value.trim();
        const price = document.getElementById('p-price')?.value;
        const desc = document.getElementById('p-desc')?.value.trim() || ''; 
        const files = document.getElementById('p-image')?.files;
        const btn = document.getElementById('upload-btn');

        if (!rawName || !price || !files || files.length === 0) return alert("請填寫標題、價格與圖片");

        btn.disabled = true;
        if(statusText) statusText.innerText = "⏳ 管理員身分確認，準備上傳...";

        try {
            const { data: { user } } = await supabaseClient.auth.getUser();
            const { data: profile } = await supabaseClient.from('profiles').select('is_admin').eq('id', user.id).single();
            if (!profile?.is_admin) throw new Error("您無權從此介面上傳商品");

            let uploadedFileNames = [];
            let lastAiReport = null;

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                if(statusText) statusText.innerText = `🔍 Google Vision 掃描中 (${i+1}/${files.length})...`;

                const base64Str = await fileToBase64(file);
                
                const { data: audit, error: auditError } = await supabaseClient.functions.invoke('vision-audit', {
                    body: { imageBase64: base64Str }
                });

                if (auditError) throw new Error("AI 審核系統連線失敗");
                
                console.log("🔍 AI 原始報告內容:", audit); // 方便管理員在 F12 除錯
                
                const safeSearch = audit.safeSearchAnnotation || audit;

                if (safeSearch) {
                    // ✨ 修正點：支援 Google Vision SDK 的 Likelihood 後綴
                    const valViolence = safeSearch.violence || safeSearch.violenceLikelihood;
                    const valMedical = safeSearch.medical || safeSearch.medicalLikelihood;
                    const valAdult = safeSearch.adult || safeSearch.adultLikelihood;
                    const valRacy = safeSearch.racy || safeSearch.racyLikelihood;

                    const dangerLevels = ['POSSIBLE', 'LIKELY', 'VERY_LIKELY'];
                    
                    const isViolent = dangerLevels.includes(valViolence);
                    const isMedicalGore = dangerLevels.includes(valMedical);
                    
                    if (isViolent || isMedicalGore) {
                        alert(`🚨 嚴重違規：圖片 "${escapeHTML(file.name)}" 偵測到暴力或血腥內容，已強制攔截！`);
                        continue; 
                    }

                    const isAdult = dangerLevels.includes(valAdult);
                    const isRacy = dangerLevels.includes(valRacy);
                    
                    if (isAdult || isRacy) {
                        console.log(`🔥 圖片 "${file.name}" 包含成人/性感內容，安全放行 (18+ 政策)。`);
                    }
                    
                    lastAiReport = safeSearch; 
                } else if (audit && audit.safe === false) {
                    alert(`❌ 警告：圖片 "${escapeHTML(file.name)}" 偵測到違規 (${audit.reason})，已略過。`);
                    continue; 
                }

                if(statusText) statusText.innerText = `📦 轉換 WebP (${i+1}/${files.length})...`;
                const webpBlob = await generateWebPBlob(file);
                const baseName = file.name.split('.').slice(0, -1).join('.').replace(/[^a-z0-9]/gi, '_');
                const fileName = `${Date.now()}_${i}_${baseName}.webp`;

                if(statusText) statusText.innerText = `🚀 上傳儲存空間 (${i+1}/${files.length})...`;

                const uploadOptions = {
                    contentType: 'image/webp',
                    upsert: true 
                };

                await supabaseClient.storage.from('products').upload(fileName, webpBlob, uploadOptions);
                await supabaseClient.storage.from('previews').upload(fileName, webpBlob, uploadOptions);
                
                uploadedFileNames.push(fileName);
            }

            if (uploadedFileNames.length === 0) throw new Error("沒有符合安全規範的圖片可供上傳");

            const { error: dbError } = await supabaseClient.from('products').insert([{
                name: rawName,
                price: parseInt(price),
                description: desc, 
                image_url: uploadedFileNames.join(','),
                user_id: user.id,  
                status: 'approved',
                is_official: true, 
                ai_report: lastAiReport,
                is_archived: false
            }]);

            if (dbError) throw dbError;

            alert("🎉 官方商品已成功發布！");
            location.reload();

        } catch (err) {
            console.error(err);
            if(statusText) statusText.textContent = "❌ 出錯了：" + err.message;
            btn.disabled = false;
        }
    });
}

// ==========================================
// 🛡️ 模塊 B：審核介面 (Pending Products)
// ==========================================

window.loadPendingProducts = async function() {
    const grid = document.getElementById('products-grid');
    if(!grid) return;
    grid.innerHTML = '<div class="col-span-full text-center text-gray-400 py-10"><i class="fa-solid fa-spinner fa-spin text-2xl"></i></div>';
    
    try {
        const { data, error } = await supabaseClient.from('products')
            .select('*, profiles!user_id(display_name)')
            .eq('is_official', false)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });
            
        if (error) throw error;
        
        if(!data || data.length === 0) {
            grid.innerHTML = '<div class="col-span-full text-center text-gray-400 font-bold py-10">🎉 目前沒有待審核的商品</div>';
            return;
        }

        grid.innerHTML = data.map(item => {
            let firstImg = item.image_url.split(',')[0];
            let imgPath = firstImg;
            if (firstImg.includes('r2.dev')) {
                const fileName = firstImg.split('/').pop();
                imgPath = `${WORKER_URL}/media/${fileName}`;
            } else if (!firstImg.startsWith('http')) {
                imgPath = supabaseClient.storage.from('previews').getPublicUrl(firstImg).data.publicUrl;
            }
            
            const prof = Array.isArray(item.profiles) ? item.profiles[0] : (item.profiles || {});

            // ✨ 加入：在待審核列表直接顯示 AI 報告 (防止 Creators 繞過)
            const rawReport = item.ai_report || {};
            const report = rawReport.safeSearchAnnotation || rawReport;
            const valAdult = report.adult || report.adultLikelihood || 'N/A';
            const valViolence = report.violence || report.violenceLikelihood || 'N/A';
            const hasAiReport = valAdult !== 'N/A';

            return `
            <div class="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm flex flex-col">
                <div class="h-44 bg-gray-100 relative cursor-zoom-in" onclick="openLightbox('${imgPath}')">
                    <img src="${imgPath}" class="w-full h-full object-cover" onerror="this.src='https://placehold.co/400x400/eeeeee/999999?text=Image+Error'">
                    <span class="absolute top-2 left-2 bg-yellow-400 text-black text-[10px] font-black px-2 py-1 rounded">待審核</span>
                    <span class="absolute top-2 right-2 bg-black/70 text-white text-[10px] font-bold px-2 py-1 rounded">🪙 ${item.price}</span>
                </div>
                <div class="p-4 flex-1 flex flex-col">
                    <h3 class="font-bold text-sm text-gray-900 mb-1 truncate">${escapeHTML(item.name)}</h3>
                    <p class="text-[10px] text-gray-500 mb-2">創作者: ${escapeHTML(prof.display_name || '未知')}</p>
                    
                    <div class="mb-4 text-[10px] bg-gray-50 p-2 rounded border border-gray-100">
                        ${hasAiReport ? 
                            `<span style="color:${getAiColor(valAdult)}">🔞成人: ${valAdult}</span><br><span style="color:${getAiColor(valViolence)}">💀暴力: ${valViolence}</span>` 
                            : `<span class="text-orange-500 font-bold">⚠️ 此商品上傳時未經過 AI 掃描</span>`
                        }
                    </div>

                    <div class="mt-auto flex flex-col gap-2">
                        <button onclick="approveProduct('${item.id}')" class="w-full bg-green-500 text-white font-bold py-2 rounded-lg text-xs hover:bg-green-600 transition">
                            <i class="fa-solid fa-check mr-1"></i> 核准上架
                        </button>
                        <button onclick="hardDeleteProduct('${item.id}', '${item.image_url || ''}')" class="w-full bg-red-50 text-red-600 border border-red-100 font-bold py-2 rounded-lg text-xs hover:bg-red-100 transition">
                            <i class="fa-solid fa-trash mr-1"></i> 刪除違規
                        </button>
                    </div>
                </div>
            </div>`;
        }).join('');

    } catch(e) {
        grid.innerHTML = '<div class="col-span-full text-center text-red-500 font-bold">載入失敗: ' + e.message + '</div>';
    }
}

window.approveProduct = async function(productId) {
    if(!confirm("確定要核准此商品上架到商城嗎？")) return;
    try {
        const { error } = await supabaseClient.from('products').update({ status: 'approved' }).eq('id', productId);
        if (error) throw error;
        alert("✅ 商品已成功上架！");
        loadPendingProducts(); 
        if(typeof loadAuditList === 'function') loadAuditList();
    } catch(e) { alert("核准失敗：" + e.message); }
}

// ==========================================
// 🛡️ 模塊 C：活躍商品中控 (來自 Dashboard.js)
// ==========================================

window.loadAuditList = async function() {
    const listContainer = document.getElementById('audit-list');
    if(!listContainer) return;
    listContainer.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:50px;">🚀 正在載入活躍商品列表...</td></tr>';

    try {
        const { data: products, error } = await supabaseClient
            .from('products')
            .select('*, reports(count), profiles!user_id(display_name)')
            .eq('is_archived', false)
            .order('created_at', { ascending: false });

        if (error) throw error;
        renderTable(products);

    } catch (err) {
        console.error("抓取失敗:", err);
        listContainer.innerHTML = `<tr><td colspan="5" style="color:red; text-align:center;">抓取資料失敗: ${err.message}</td></tr>`;
    }
}

function renderTable(products) {
    const listContainer = document.getElementById('audit-list');
    if(!listContainer) return;
    listContainer.innerHTML = '';

    if (!products || products.length === 0) {
        listContainer.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:50px;color:gray;">目前沒有待處理的活躍商品</td></tr>';
        return;
    }

    products.forEach(p => {
        // ✨ 修正點：全域相容 Likelihood，加入 Spoof 屬性偵測二次元干擾
        const rawReport = p.ai_report || {};
        const report = rawReport.safeSearchAnnotation || rawReport;

        const valViolence = report.violence || report.violenceLikelihood || 'N/A';
        const valRacy = report.racy || report.racyLikelihood || 'N/A';
        const valMedical = report.medical || report.medicalLikelihood || 'N/A';
        const valAdult = report.adult || report.adultLikelihood || 'N/A';
        const valSpoof = report.spoof || report.spoofLikelihood || 'N/A';

        const isSuspicious = [valViolence, valRacy, valMedical, valAdult].some(v => v === 'POSSIBLE' || v === 'LIKELY' || v === 'VERY_LIKELY');

        const allFiles = p.image_url?.split(',') || [];
        const imagesHtml = allFiles.map(fileName => {
            const imgUrl = fileName.includes('r2.dev') 
                ? `${WORKER_URL}/media/${fileName.split('/').pop()}`
                : (fileName.startsWith('http') ? fileName : `${SUPABASE_URL}/storage/v1/object/public/previews/${fileName.trim()}`);
            return `<img src="${imgUrl}" onclick="openLightbox('${imgUrl}')" style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px; border: 1px solid #eee; cursor: zoom-in; transition: opacity 0.2s;" onmouseover="this.style.opacity=0.8" onmouseout="this.style.opacity=1">`;
        }).join('');
        
        let reportCount = 0;
        if (p.reports && p.reports.length > 0) reportCount = p.reports[0].count;

        const tr = document.createElement('tr');
        tr.style.borderBottom = "1px solid #eee";
        if (isSuspicious) tr.style.backgroundColor = "#fffbe6";

        tr.innerHTML = `
            <td style="padding: 15px;"><div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; width: 190px;">${imagesHtml}</div></td>
            <td style="padding: 15px;">
                <div style="font-weight:bold;">${escapeHTML(p.name)}</div>
                <div style="margin-top:5px;">
                    <span style="font-size:10px; background:#f0f0f0; padding:2px 6px; border-radius:4px;">${p.status}</span>
                    ${p.is_official ? '<span style="font-size:10px; background:#e6f7ff; color:#1890ff; padding:2px 6px; border-radius:4px; margin-left:4px;">官方</span>' : ''}
                </div>
                ${reportCount > 0 ? `<div style="color:#ff4d4f; font-size:11px; margin-top:4px;">⚠️ 被用戶檢舉: ${reportCount} 次</div>` : ''}
            </td>
            <td style="padding: 15px; font-weight:bold; color:#ff2442;">🪙 ${p.price}</td>
            <td style="padding: 15px; font-size: 11px; font-family: monospace; line-height: 1.5;">
                <div style="color: ${getAiColor(valAdult)}">🔞 成人: ${valAdult}</div>
                <div style="color: ${getAiColor(valViolence)}">💀 暴力: ${valViolence}</div>
                <div style="color: ${getAiColor(valRacy)}">👙 挑逗: ${valRacy}</div>
                <div style="color: ${getAiColor(valMedical)}">🏥 醫療: ${valMedical}</div>
                <div style="color: #bfbfbf">🤡 惡搞/卡通: ${valSpoof}</div>
            </td>
            <td style="padding: 15px;">
                <div style="display:flex; flex-direction:column; gap:8px;">
                    ${p.status === 'pending' ? `<button onclick="approveProduct('${p.id}')" style="background:#52c41a; color:white; border:none; padding:8px 12px; border-radius:8px; cursor:pointer; font-weight:bold;">通過</button>` : ''}
                    <button onclick="archiveProduct('${p.id}')" style="background:#faad14; color:white; border:none; padding:8px 12px; border-radius:8px; cursor:pointer; font-weight:bold;">下架封存</button>
                    <button onclick="hardDeleteProduct('${p.id}', '${p.image_url || ''}')" style="background:none; color:#ff4d4f; border:1px solid #ff4d4f; padding:6px; border-radius:8px; cursor:pointer; font-size:10px; font-weight:bold;">徹底刪除 (違規)</button>
                </div>
            </td>
        `;
        listContainer.appendChild(tr);
    });
}

window.archiveProduct = async (id) => {
    const ok = confirm("確定要下架此商品嗎？\n下架後商品將不再顯示，但會保留歷史交易紀錄。");
    if (!ok) return;

    const { error } = await supabaseClient.from('products').update({ is_archived: true, status: 'rejected' }).eq('id', id);
    if (error) alert("下架失敗: " + error.message);
    else { loadAuditList(); loadPendingProducts(); }
};

// ✨ 強效徹底刪除 (繞過關聯保護與軟刪除機制)
window.hardDeleteProduct = async (id, imageUrls) => {
    const ok = confirm("🚨 極度警告 🚨\n\n此操作將會「永遠刪除」該商品及其所有圖片檔案。\n此操作無法撤銷，確定執行嗎？");
    if (!ok) return;

    try {
        // 先強制刪除所有該商品的檢舉紀錄，防止資料庫因為外鍵保護而拒絕刪除
        await supabaseClient.from('reports').delete().eq('product_id', id);

        // 嘗試刪除本體
        const { error: dbError } = await supabaseClient.from('products').delete().eq('id', id);
        
        if (dbError) {
            console.warn("徹底刪除受阻，執行強制深度封存:", dbError);
            // 如果仍有外鍵(如訂單)導致無法刪除，進行深度防呆封存，確保商城絕對看不見
            await supabaseClient.from('products').update({ is_archived: true, status: 'deleted' }).eq('id', id);
            alert("⚠️ 由於該商品已有用戶購買紀錄，基於資料庫安全，已將其「強制深度封存」。它絕對不會再出現在商城中！");
        } else {
            alert("🗑️ 商品資料庫已徹底清除。");
        }

        // 刪除 Supabase 儲存空間內的圖片
        if (imageUrls) {
            const fileNames = imageUrls.split(',').map(name => name.trim()).filter(n => !n.startsWith('http') && !n.includes('r2.dev'));
            if (fileNames.length > 0) {
                await supabaseClient.storage.from('products').remove(fileNames);
                await supabaseClient.storage.from('previews').remove(fileNames);
            }
        }

        loadAuditList();
        loadPendingProducts();
    } catch (err) {
        alert("執行操作失敗: " + err.message);
    }
};

window.updateStatus = async (id, newStatus) => {
    const { error } = await supabaseClient.from('products').update({ status: newStatus }).eq('id', id);
    if (error) alert("操作失敗: " + error.message);
    else loadAuditList();
};

// ==========================================
// 🛡️ 模塊 D：燈箱與貼文管理
// ==========================================

window.openLightbox = function(url) {
    let overlay = document.getElementById('audit-lightbox');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'audit-lightbox';
        overlay.style = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); z-index: 10000; display: none; align-items: center; justify-content: center; cursor: pointer; backdrop-filter: blur(5px); opacity: 0; transition: opacity 0.3s ease;`;
        
        overlay.onclick = function() {
            this.style.opacity = '0';
            setTimeout(() => { this.style.display = 'none'; document.body.style.overflow = 'auto'; }, 300);
        };
        document.body.appendChild(overlay);

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && overlay.style.display === 'flex') overlay.click();
        });
    }

    overlay.innerHTML = `
        <div style="position:relative; max-width:90%; max-height:90%; display:flex; justify-content:center; align-items:center;">
            <img src="${url}" style="max-width:100%; max-height:100%; border-radius:8px; box-shadow: 0 0 40px rgba(0,0,0,0.6); cursor: default; transform: scale(0.95); transition: transform 0.3s ease;" onload="this.style.transform='scale(1)'" onclick="event.stopPropagation();" onerror="this.src='https://placehold.co/600x400?text=圖片載入失敗';">
            <div style="position:absolute; top:-40px; right:-10px; color:white; font-size:35px; font-weight:bold;">&times;</div>
        </div>
    `;

    overlay.style.display = 'flex';
    setTimeout(() => { overlay.style.opacity = '1'; }, 10);
    document.body.style.overflow = 'hidden'; 
};

window.loadRecentPosts = async function() {
    const grid = document.getElementById('posts-grid');
    if(!grid) return;
    grid.innerHTML = '<div class="col-span-full text-center text-gray-400 py-10"><i class="fa-solid fa-spinner fa-spin text-2xl"></i></div>';
    
    try {
        const { data, error } = await supabaseClient.from('posts')
            .select('*, profiles!user_id(display_name)')
            .order('created_at', { ascending: false })
            .limit(20);
            
        if (error) throw error;
        
        if(data.length === 0) {
            grid.innerHTML = '<div class="col-span-full text-center text-gray-400 font-bold py-10">目前沒有用戶動態</div>';
            return;
        }

        grid.innerHTML = data.map(post => {
            let imgPath = post.media_url;
            if (imgPath && imgPath.includes('r2.dev')) {
                const fileName = imgPath.split('/').pop();
                imgPath = `${WORKER_URL}/media/${fileName}`;
            }

            const prof = Array.isArray(post.profiles) ? post.profiles[0] : (post.profiles || {});

            return `
            <div class="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm flex flex-col">
                <div class="h-40 bg-gray-50 relative flex items-center justify-center cursor-zoom-in" onclick="openLightbox('${imgPath}')">
                    ${imgPath ? `<img src="${escapeHTML(imgPath)}" class="w-full h-full object-cover">` : `<span class="text-gray-300 text-xs font-bold">無圖片</span>`}
                </div>
                <div class="p-4 flex-1 flex flex-col">
                    <p class="text-[12px] text-gray-800 line-clamp-3 mb-2">${escapeHTML(post.caption || '無文字內容')}</p>
                    <p class="text-[10px] text-blue-500 font-bold mb-3">@${escapeHTML(prof.display_name || '用戶')}</p>
                    <div class="mt-auto">
                        <button onclick="deleteRecord('posts', '${post.id}')" class="w-full bg-red-500 text-white font-bold py-2 rounded-lg text-xs shadow-md hover:bg-red-600 transition active:scale-95">強制刪除貼文</button>
                    </div>
                </div>
            </div>`;
        }).join('');

    } catch(e) {
        grid.innerHTML = '<div class="col-span-full text-center text-red-500 font-bold">載入失敗</div>';
    }
}

window.deleteRecord = async function(table, id) {
    if(!confirm(`確定要強制刪除這筆 ${table} 紀錄嗎？此操作不可逆！`)) return;
    try {
        const { error } = await supabaseClient.from(table).delete().eq('id', id);
        if (error) throw error;
        alert("🗑️ 已成功刪除！");
        if(table === 'posts') loadRecentPosts();
    } catch(e) {
        alert("刪除失敗：" + e.message);
    }
}
