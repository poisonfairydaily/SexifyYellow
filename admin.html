<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>商戶安全後台</title>
    <style>
        :root { --primary: #000; --bg: #f5f5f7; --card: #fff; }
        body { font-family: -apple-system, sans-serif; background: var(--bg); display: flex; justify-content: center; padding: 20px; }
        .container { width: 100%; max-width: 400px; }
        .card { background: var(--card); padding: 30px; border-radius: 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); }
        h2 { text-align: center; margin-bottom: 25px; font-weight: 700; }
        label { display: block; margin-bottom: 5px; font-size: 13px; color: #666; }
        input { width: 100%; padding: 12px; margin-bottom: 15px; border: 1px solid #eee; border-radius: 10px; box-sizing: border-box; }
        button { width: 100%; padding: 14px; background: var(--primary); color: #fff; border: none; border-radius: 10px; font-weight: 600; cursor: pointer; transition: 0.2s; }
        button:hover { opacity: 0.8; }
        button:disabled { background: #ccc; }
        #admin-section, #login-section { display: none; }
        #preview { width: 100%; border-radius: 10px; margin-top: 10px; display: none; object-fit: cover; max-height: 200px; }
        .logout-btn { background: transparent; color: #ff3b30; border: 1px solid #ff3b30; margin-top: 10px; }
        #status { text-align: center; font-size: 13px; margin-top: 15px; color: #888; }
    </style>
</head>
<body>

<div class="container">
    <div id="login-section" class="card">
        <h2>商戶登入</h2>
        <input type="email" id="login-email" placeholder="管理員信箱">
        <input type="password" id="login-password" placeholder="密碼">
        <button id="login-btn">進入系統</button>
        <p id="login-status"></p>
    </div>

    <div id="admin-section" class="card">
        <h2>上架商品</h2>
        <label>商品名稱</label>
        <input type="text" id="p-name" placeholder="請輸入名稱">
        <label>價格</label>
        <input type="number" id="p-price" placeholder="價格">
        <label>圖片</label>
        <input type="file" id="p-image" accept="image/*">
        <img id="preview" src="" alt="預覽">
        <button id="upload-btn">確認上架</button>
        <button onclick="handleLogout()" class="logout-btn">登出系統</button>
        <p id="status"></p>
    </div>
</div>

<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script>
    const SUPABASE_URL = 'https://shsmvbeebuxscnvnmlzf.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNoc212YmVlYnV4c2Nudm5tbHpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NDU5MTgsImV4cCI6MjA5MDQyMTkxOH0.kK5A0RYj6RrzBJHMleKcFQp4wVq7hCm-lVDTbnxrFJQ';
    const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const loginSection = document.getElementById('login-section');
    const adminSection = document.getElementById('admin-section');

    window.onload = async () => {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) {
            // 注意：若尚未設定 admin role，可先移除此判斷直接顯示 showAdmin() 進行測試
            const userRole = session.user.app_metadata.role;
            if (userRole === 'admin') {
                showAdmin();
            } else {
                alert("抱歉，您沒有管理員權限！");
                await supabaseClient.auth.signOut();
                location.reload();
            }
        } else {
            showLogin();
        }
    };

    function showLogin() { loginSection.style.display = 'block'; adminSection.style.display = 'none'; }
    function showAdmin() { loginSection.style.display = 'none'; adminSection.style.display = 'block'; }

    document.getElementById('login-btn').addEventListener('click', async () => {
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const btn = document.getElementById('login-btn');
        btn.disabled = true;

        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) {
            document.getElementById('login-status').innerText = "❌ 登入失敗：" + error.message;
            btn.disabled = false;
        } else {
            location.reload();
        }
    });

    async function handleLogout() {
        await supabaseClient.auth.signOut();
        location.reload();
    }

    document.getElementById('p-image').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                document.getElementById('preview').src = event.target.result;
                document.getElementById('preview').style.display = 'block';
            };
            reader.readAsDataURL(file);
        }
    });

    document.getElementById('upload-btn').addEventListener('click', async () => {
        const name = document.getElementById('p-name').value;
        const price = document.getElementById('p-price').value;
        const file = document.getElementById('p-image').files[0];
        const status = document.getElementById('status');
        const btn = document.getElementById('upload-btn');

        if (!name || !price || !file) return alert("請填寫完整資訊");

        btn.disabled = true;
        status.innerText = "⏳ 正在處理中...";

        try {
            // 1. 生成唯一檔名防止覆蓋
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}.${fileExt}`;

            // 2. 上傳到 Supabase Storage (Bucket 名稱需為 products)
            const { data: uploadData, error: uploadError } = await supabaseClient.storage
                .from('products')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            // 3. 取得圖片的公開網址
            const { data: { publicUrl } } = supabaseClient.storage
                .from('products')
                .getPublicUrl(fileName);

            // 4. 將完整資訊存入資料庫
            const { error: dbError } = await supabaseClient
                .from('products')
                .insert([{
                    name: name,
                    price: parseInt(price),
                    image_url: publicUrl // 儲存可以直接顯示的網址
                }]);

            if (dbError) throw dbError;

            alert("✅ 上架成功！");
            location.reload();
        } catch (err) {
            console.error(err);
            status.innerText = "❌ 錯誤：" + err.message;
            btn.disabled = false;
        }
    });
</script>

</body>
</html>
