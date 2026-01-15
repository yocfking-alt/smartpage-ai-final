import fetch from 'node-fetch';

// دالة مساعدة لتحويل لون HEX إلى RGBA لعمل تأثير التوهج
function hexToRgba(hex, alpha = 1) {
    let c;
    if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
        c = hex.substring(1).split('');
        if (c.length === 3) {
            c = [c[0], c[0], c[1], c[1], c[2], c[2]];
        }
        c = '0x' + c.join('');
        return 'rgba(' + [(c >> 16) & 255, (c >> 8) & 255, c & 255].join(',') + ',' + alpha + ')';
    }
    // لون احتياطي في حال كان الإدخال غير صحيح
    return `rgba(163, 255, 18, ${alpha})`; 
}

export default async function handler(req, res) {
    // 1. إعدادات CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        if (!GEMINI_API_KEY) throw new Error('API Key is missing');

        // استقبال البيانات من الواجهة الأمامية
        const { 
            productName, productFeatures, productPrice, 
            productImages, brandLogo, variants 
        } = req.body;

        const productImageArray = productImages || [];
        // استخدام صور افتراضية إذا لم يقم المستخدم برفع صور
        const mainImgPlaceholder = productImageArray.length > 0 ? productImageArray[0] : "https://i.imgur.com/3XZ3t3s.png";
        const logoSrc = brandLogo || "https://via.placeholder.com/150x50?text=Logo";

        // --- تحضير بيانات المتغيرات (الألوان) للقالب الاحترافي ---
        let colorDotsHTML = "";
        let productScriptArray = [];
        // الألوان الافتراضية (أخضر نيون) في حال لم يحدد المستخدم متغيرات ألوان
        let initialPrimaryColor = "#a3ff12"; 
        let initialGlowColor = "rgba(163, 255, 18, 0.3)";

        if (variants && variants.colors && variants.colors.enabled && variants.colors.items.length > 0) {
            variants.colors.items.forEach((color, index) => {
                // تحديد الصورة المرتبطة باللون
                let imgIndex = parseInt(color.imgIndex);
                let imgSrc = (isNaN(imgIndex) || imgIndex >= productImageArray.length) ? mainImgPlaceholder : productImageArray[imgIndex];
                
                // حساب لون التوهج بناءً على لون الهيكس الذي اختاره المستخدم
                let glowRgba = hexToRgba(color.hex, 0.3);

                // 1. بناء HTML لنقاط الألوان
                const activeClass = index === 0 ? 'active' : '';
                colorDotsHTML += `<div class="color-dot ${activeClass}" style="background-color: ${color.hex};" data-index="${index}"></div>`;

                // 2. بناء مصفوفة البيانات للسكريبت
                productScriptArray.push(`{
                    name: "${productName} - ${color.name}",
                    image: "${imgSrc}",
                    color: "${color.hex}",
                    glow: "${glowRgba}"
                }`);

                // تعيين الألوان الأولية بناءً على أول خيار
                if (index === 0) {
                    initialPrimaryColor = color.hex;
                    initialGlowColor = glowRgba;
                }
            });
        } else {
            // حالة عدم وجود متغيرات ألوان: نستخدم الصورة الرئيسية ونخفي نقاط التحكم
            productScriptArray.push(`{
                name: "${productName}",
                image: "${mainImgPlaceholder}",
                color: "${initialPrimaryColor}",
                glow: "${initialGlowColor}"
            }`);
            // إخفاء حاوية النقاط إذا لم تكن هناك ألوان
            colorDotsHTML = `<style>.color-options { display: none !important; }</style>`;
        }

        // --- استخدام Gemini فقط لتوليد نصوص إبداعية (العنوان) ---
        const GEMINI_MODEL = 'gemini-2.5-flash'; 
        const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

        const prompt = `
        Act as a professional copywriter for a high-end product landing page.
        Product Name: ${productName}
        Product Features: ${productFeatures}
        
        Task:
        1. Generate a powerful, short, 2-line uppercase headline (max 8 words total) that emphasizes speed, quality, or uniqueness based on the features. Use a <br> tag to separate the two lines. (e.g., "BUILT FOR SPEED.<br>DESIGNED TO LEAD").
        2. Extract a single, short, impactful word from the product name or brand to be used as giant background text (e.g., if name is "Nike Air", output "NIKE").

        Output purely in JSON format: {"headline": "...", "bgText": "..."}
        `;

        const aiResponse = await fetch(GEMINI_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: "application/json" }
            })
        });

        const aiData = await aiResponse.json();
        const aiContent = JSON.parse(aiData.candidates[0].content.parts[0].text);
        const generatedHeadline = aiContent.headline || "BUILT FOR EXCELLENCE.<br>DESIGNED FOR YOU";
        const generatedBgText = aiContent.bgText || "PREMIUM";


        // --- تجميع صفحة الهبوط النهائية (القالب الاحترافي الثابت) ---
        // نقوم بحقن البيانات التي جهزناها أعلاه داخل هذا الهيكل الثابت
        
        const finalHTML = `
<!DOCTYPE html>
<html lang="ar" dir="ltr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${productName} - صفحة هبوط احترافية</title>
    <link href="https://fonts.googleapis.com/css2?family=Anton&family=Roboto:wght@300;400;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary-color: ${initialPrimaryColor};
            --secondary-color: #1a1a1a;
            --bg-dark: #0a0a0a;
            --text-light: #ffffff;
            --text-gray: #888888;
            --glow-color: ${initialGlowColor};
        }
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Roboto', sans-serif; }
        body { background-color: var(--bg-dark); color: var(--text-light); overflow-x: hidden; height: 100vh; display: flex; justify-content: center; align-items: center; background: radial-gradient(circle at center, #1c1c1c 0%, var(--bg-dark) 70%); transition: background 0.5s ease; }
        .container { width: 90%; max-width: 1200px; height: 90vh; background: transparent; position: relative; display: grid; grid-template-columns: 1fr 1.5fr; grid-template-rows: auto 1fr auto; padding: 20px; }
        header { grid-column: 1 / -1; display: flex; justify-content: space-between; align-items: center; padding-bottom: 40px; }
        .logo img { height: 40px; object-fit: contain; }
        .nav-icons { display: flex; gap: 20px; align-items: center; }
        .nav-icons i { font-size: 24px; cursor: pointer; color: var(--text-light); font-style: normal; }
        .cart-icon::before { content: '🛒'; } .menu-icon::before { content: '☰'; }
        .content-text { grid-column: 1 / 2; grid-row: 2 / 3; display: flex; flex-direction: column; justify-content: center; z-index: 2; }
        h1 { font-family: 'Anton', sans-serif; font-size: 4rem; line-height: 1.1; margin-bottom: 10px; letter-spacing: 1px; text-transform: uppercase; }
        .product-name { color: var(--text-gray); font-size: 1.2rem; margin-bottom: 30px; }
        .bg-text { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-family: 'Anton', sans-serif; font-size: 15rem; color: rgba(255, 255, 255, 0.03); z-index: 0; pointer-events: none; white-space: nowrap; text-transform: uppercase; }
        .product-image-container { grid-column: 2 / 3; grid-row: 2 / 3; position: relative; display: flex; justify-content: center; align-items: center; z-index: 1; }
        .glow-effect { position: absolute; width: 80%; height: 80%; background: radial-gradient(circle, var(--glow-color) 0%, transparent 70%); filter: blur(50px); opacity: 0.7; transition: background 0.5s ease; }
        .product-image { width: 100%; max-width: 650px; height: auto; object-fit: contain; transform: rotate(-15deg) translateX(50px); filter: drop-shadow(0 20px 30px rgba(0,0,0,0.5)); transition: all 0.5s ease-in-out; }
        .controls { grid-column: 2 / 3; grid-row: 2 / 3; display: flex; flex-direction: column; justify-content: center; align-items: flex-end; padding-right: 20px; z-index: 3; }
        .color-options { display: flex; flex-direction: column; gap: 15px; margin-bottom: 20px; }
        .color-dot { width: 12px; height: 12px; border-radius: 50%; cursor: pointer; opacity: 0.5; transition: all 0.3s ease; position: relative; }
        .color-dot.active { opacity: 1; transform: scale(1.3); box-shadow: 0 0 10px var(--primary-color); }
        .pagination-dots { display: flex; flex-direction: column; gap: 8px; align-items: center; }
        .pagination-dot { width: 8px; height: 8px; border-radius: 50%; background-color: var(--text-gray); opacity: 0.3; }
        .pagination-dot.active { background-color: var(--text-light); opacity: 1; }
        footer { grid-column: 1 / -1; grid-row: 3 / 4; display: flex; justify-content: space-between; align-items: flex-end; padding-top: 20px; }
        .bottom-numbers { display: flex; gap: 15px; }
        .number-btn { width: 40px; height: 40px; background-color: rgba(255, 255, 255, 0.1); color: var(--text-gray); display: flex; justify-content: center; align-items: center; border-radius: 8px; font-weight: bold; cursor: pointer; transition: all 0.3s ease; }
        .number-btn.active, .number-btn:hover { background-color: var(--primary-color); color: var(--bg-dark); }
        .add-to-cart-btn { padding: 15px 40px; background-color: var(--primary-color); color: var(--bg-dark); border: none; border-radius: 30px; font-size: 1rem; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 10px; transition: all 0.3s ease; }
        .add-to-cart-btn:hover { transform: scale(1.05); box-shadow: 0 5px 15px var(--glow-color); }
        @media (max-width: 768px) { .container { grid-template-columns: 1fr; grid-template-rows: auto auto auto auto auto; height: auto; } header { grid-row: 1; padding-bottom: 20px; } .product-image-container { grid-row: 2; height: 300px; } .product-image { max-width: 80%; transform: rotate(-10deg); } .bg-text { font-size: 8rem; top: 30%; } .content-text { grid-row: 3; text-align: center; } h1 { font-size: 2.5rem; } .controls { grid-row: 4; flex-direction: row; justify-content: center; gap: 30px; align-items: center; padding: 20px 0; } .color-options { flex-direction: row; margin-bottom: 0; } .pagination-dots { display: none; } footer { grid-row: 5; flex-direction: column; gap: 20px; align-items: center; } }
    </style>
</head>
<body>
    <div class="bg-text">${generatedBgText}</div>
    <div class="container">
        <header>
            <div class="logo">
                <img src="${logoSrc}" alt="Brand Logo">
            </div>
            <div class="nav-icons">
                <i class="cart-icon"></i>
                <i class="menu-icon"></i>
            </div>
        </header>
        <section class="content-text">
            <h1>${generatedHeadline}</h1>
            <p class="product-name">${productName}</p>
            <p style="color: var(--primary-color); font-weight: bold; margin-top: 10px;">${productPrice}</p>
        </section>
        <section class="product-image-container">
            <div class="glow-effect"></div>
            <img src="${productScriptArray.length > 0 ? JSON.parse(productScriptArray[0]).image : mainImgPlaceholder}" alt="${productName}" class="product-image" id="main-product-image">
        </section>
        <aside class="controls">
            <div class="color-options">
                ${colorDotsHTML}
            </div>
            <div class="pagination-dots">
                <div class="pagination-dot active"></div>
                <div class="pagination-dot"></div>
                <div class="pagination-dot"></div>
            </div>
        </aside>
        <footer>
            <div class="bottom-numbers">
                <div class="number-btn active">S</div>
                <div class="number-btn">M</div>
                <div class="number-btn">L</div>
            </div>
            <button class="add-to-cart-btn" onclick="alert('تمت الإضافة للسلة! (هذا زر تجريبي)')">ADD TO CART</button>
        </footer>
    </div>
    <script>
        // تم حقن بيانات المنتجات برمجياً هنا
        const products = [${productScriptArray.join(',')}];

        const productImage = document.getElementById('main-product-image');
        const colorDots = document.querySelectorAll('.color-dot');
        const root = document.documentElement;
        let currentIndex = 0;

        function updateProduct(index) {
            if (!products[index]) return;
            const product = products[index];
            currentIndex = index;

            productImage.style.transform = 'rotate(-15deg) translateX(100px)';
            productImage.style.opacity = '0';

            setTimeout(() => {
                productImage.src = product.image;
                root.style.setProperty('--primary-color', product.color);
                root.style.setProperty('--glow-color', product.glow);
                
                productImage.style.transform = 'rotate(-15deg) translateX(50px)';
                productImage.style.opacity = '1';
            }, 300);

            colorDots.forEach(dot => dot.classList.remove('active'));
            if (colorDots[index]) colorDots[index].classList.add('active');
        }

        if (colorDots.length > 0) {
            colorDots.forEach(dot => {
                dot.addEventListener('click', function() {
                    const index = parseInt(this.getAttribute('data-index'));
                    if (index !== currentIndex) updateProduct(index);
                });
            });
            // تهيئة المنتج الأول
            updateProduct(0);
        }

        // تفاعل بسيط لأزرار المقاسات (شكلي فقط)
        const numberBtns = document.querySelectorAll('.number-btn');
        numberBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                numberBtns.forEach(b => b.classList.remove('active'));
                this.classList.add('active');
            });
        });
    </script>
</body>
</html>
        `;

        // إرجاع النتيجة
        res.status(200).json({
            html: finalHTML,
            // يمكن إضافة منطق لتوليد كود Liquid لاحقاً إذا لزم الأمر
            liquid_code: "Liquid code generation for this specific template is complex and requires separate logic.",
            schema: {}
        });

    } catch (error) {
        console.error("Server Error:", error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
}
