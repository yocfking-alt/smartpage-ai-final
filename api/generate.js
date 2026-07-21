import fetch from 'node-fetch';

export default async function handler(req, res) {
    // 1. إعدادات CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        if (!GEMINI_API_KEY) throw new Error('API Key is missing');

        // استقبال البيانات بما في ذلك الصور المتعددة والمتغيرات (variants)
        const { 
            productName, productFeatures, productPrice, productCategory,
            targetAudience, designDescription, shippingOption, customShippingPrice, 
            customOffer, productImages, brandLogo, variants 
        } = req.body;

        // التعامل مع الصور المتعددة
        const productImageArray = productImages || [];
        const mainProductImage = productImageArray.length > 0 ? productImageArray[0] : null;

        const GEMINI_MODEL = 'gemini-2.5-flash'; 
        const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
        
        const shippingText = shippingOption === 'free' ? "شحن مجاني" : `الشحن: ${customShippingPrice}`;
        const offerText = customOffer ? `عرض خاص: ${customOffer}` : "";

        // تعريف المتغيرات البديلة للصور
        const MAIN_IMG_PLACEHOLDER = "[[PRODUCT_IMAGE_MAIN_SRC]]";
        const LOGO_PLACEHOLDER = "[[BRAND_LOGO_SRC]]";
        
        // --- تحضير شرائح السلايدر للبرومبت ---
        let sliderSlidesHTML = `   <img src="${MAIN_IMG_PLACEHOLDER}" class="slider-img active" data-index="1">`;
        for (let i = 1; i < productImageArray.length && i <= 6; i++) {
            sliderSlidesHTML += `\n   <img src="[[PRODUCT_IMAGE_${i + 1}_SRC]]" class="slider-img" data-index="${i + 1}">`;
        }
        const totalSlidesCount = Math.max(productImageArray.length, 1);

        // ===================================================================
        // --- قسم "الهوك" (الواجهة الأولى) — قالب Nike ثابت دائماً ---
        // لا تُترك هذه الواجهة لحرية الذكاء الاصطناعي، بل تُبنى هنا بشكل صريح
        // وتُحقن كنص جاهز داخل البرومبت ليضعه النموذج كما هو دون أي تعديل.
        // ===================================================================

        // دوال مساعدة لحساب تدرّج لوني (فاتح/غامق) انطلاقاً من لون المنتج
        const hexToRgbHero = (hex) => {
            let h = (hex || '#161616').replace('#', '');
            if (h.length === 3) h = h.split('').map(c => c + c).join('');
            const num = parseInt(h, 16);
            const safe = isNaN(num) ? 0x161616 : num;
            return { r: (safe >> 16) & 255, g: (safe >> 8) & 255, b: safe & 255 };
        };
        const shadeHero = (hex, percent) => {
            const { r, g, b } = hexToRgbHero(hex);
            const t = percent < 0 ? 0 : 255;
            const p = Math.abs(percent);
            const nr = Math.round((t - r) * p) + r;
            const ng = Math.round((t - g) * p) + g;
            const nb = Math.round((t - b) * p) + b;
            return `rgb(${nr}, ${ng}, ${nb})`;
        };

        // لون المنتج الأساسي: نعتمد أول لون من متغيرات الألوان إن وُجد، وإلا نستعمل الأسود الغامق (شبيه Nike الافتراضي)
        let heroBaseColor = '#161616';
        let heroSwatchList = [];
        if (variants && variants.colors && variants.colors.enabled && variants.colors.items.length > 0) {
            heroBaseColor = variants.colors.items[0].hex || '#161616';
            heroSwatchList = variants.colors.items;
        }
        const heroGradientStart = shadeHero(heroBaseColor, -0.28);
        const heroGradientEnd = shadeHero(heroBaseColor, 0.05);

        // أزرار الألوان الصغيرة أعلى الهوك (تظهر فقط إذا كان للمنتج ألوان)، مربوطة بنفس اختيار اللون في الاستمارة
        let heroSwatchesHTML = '';
        heroSwatchList.forEach((color, i) => {
            heroSwatchesHTML += `<div class="hero-swatch${i === 0 ? ' active' : ''}" style="background:${color.hex};" onclick="heroPickColor(this, '${color.hex}', '${color.name}')" title="${color.name}"></div>`;
        });

        // --- CSS الثابت لقسم الهوك (مقتبس حرفياً من قالب Nike المرجعي) ---
        const heroStyles = `
        <style>
            .hook-hero{ position:relative; min-height:100vh; width:100%; display:flex; flex-direction:column; justify-content:center; overflow:hidden; background:linear-gradient(135deg, ${heroGradientStart}, ${heroGradientEnd}); color:#fff; font-family:'Poppins','Segoe UI',sans-serif; }
            .hook-hero *{ box-sizing:border-box; }
            .hook-topbar{ position:absolute; top:26px; left:0; right:0; display:flex; justify-content:space-between; align-items:center; padding:0 40px; z-index:5; }
            .hook-brand img{ max-height:34px; max-width:160px; object-fit:contain; }
            .hook-swatches{ display:flex; gap:10px; }
            .hero-swatch{ width:28px; height:28px; border-radius:50%; border:2px solid rgba(255,255,255,.4); cursor:pointer; transition:.2s; }
            .hero-swatch.active, .hero-swatch:hover{ border-color:#fff; transform:scale(1.12); }
            .hook-inner{ position:relative; z-index:2; padding:110px 40px 30px; display:flex; flex-direction:column; align-items:center; text-align:center; gap:8px; }
            .hook-heading{ font-weight:600; font-size:clamp(28px,5vw,46px); line-height:1.15; max-width:640px; }
            .hook-subtitle{ font-size:14px; letter-spacing:.5px; color:rgba(255,255,255,.75); }
            .hook-visual{ position:relative; z-index:2; width:min(420px,88vw); margin:14px auto; transform:rotate(-6deg); transition:transform .4s ease; }
            .hook-visual:hover{ transform:rotate(0deg); }
            .hook-visual .product-viewer-container{ background:rgba(255,255,255,.06); margin:0 auto; }
            .hook-footer{ position:relative; z-index:2; display:flex; flex-direction:column; align-items:center; gap:16px; padding:0 24px 55px; }
            .hook-blurb{ font-weight:300; font-size:13px; line-height:1.6; max-width:440px; text-align:center; color:rgba(255,255,255,.65); }
            .hook-cta{ display:flex; align-items:center; gap:18px; }
            .hook-qty{ display:flex; align-items:center; gap:12px; font-size:13px; color:rgba(255,255,255,.85); }
            .hook-qty button{ width:30px; height:30px; border-radius:50%; border:1px solid rgba(255,255,255,.4); background:transparent; color:#fff; cursor:pointer; font-size:15px; display:flex; align-items:center; justify-content:center; transition:.2s; }
            .hook-qty button:hover{ background:rgba(255,255,255,.15); }
            .hook-qty-val{ min-width:20px; text-align:center; }
            .hook-buy-btn{ padding:15px 38px; border-radius:999px; border:none; background:#fff; color:#111; font-size:14px; font-weight:600; cursor:pointer; transition:transform .25s ease, box-shadow .25s ease; }
            .hook-buy-btn:hover{ transform:translateY(-2px); box-shadow:0 10px 24px rgba(0,0,0,.28); }
            @media (max-width:640px){ .hook-topbar{ padding:0 20px; } .hook-inner{ padding:95px 20px 15px; } .hook-blurb{ display:none; } }
        </style>
        `;

        // --- HTML + JS الثابتان لقسم الهوك (يُحقنان كما هما تماماً في الصفحة الناتجة) ---
        const heroHTML = `
<section class="hook-hero" id="hook">
    <div class="hook-topbar">
        <div class="hook-brand"><img src="${LOGO_PLACEHOLDER}" alt="${productName}"></div>
        <div class="hook-swatches">${heroSwatchesHTML}</div>
    </div>

    <div class="hook-inner">
        <h1 class="hook-heading">${productName}</h1>
        <div class="hook-subtitle">${productCategory ? productCategory + ' — ' : ''}${offerText || shippingText}</div>
    </div>

    <div class="hook-visual">
        <div class="product-viewer-container">
            <button class="zoom-btn" onclick="openLightbox()" aria-label="Zoom"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg></button>
            <div class="slider-wrapper">
${sliderSlidesHTML}
            </div>
            <div class="slider-controls">
                <button class="nav-btn prev" onclick="changeSlide(-1)">&#10094;</button>
                <span class="slide-counter" id="slideCounter">1 / ${totalSlidesCount}</span>
                <button class="nav-btn next" onclick="changeSlide(1)">&#10095;</button>
            </div>
        </div>
        <div id="lightbox" class="lightbox-modal" onclick="closeLightbox()"><span class="close-lightbox">&times;</span><img id="lightbox-img" class="lightbox-img" src=""></div>
    </div>

    <div class="hook-footer">
        <p class="hook-blurb">${productFeatures}</p>
        <div class="hook-cta">
            <div class="hook-qty">
                <button type="button" id="hookQtyMinus" aria-label="تقليل الكمية">–</button>
                <span class="hook-qty-val" id="hookQtyVal">01</span>
                <button type="button" id="hookQtyPlus" aria-label="زيادة الكمية">+</button>
            </div>
            <button type="button" class="hook-buy-btn" onclick="var t=document.querySelector('.customer-info-box'); if(t) t.scrollIntoView({behavior:'smooth'});">اطلب الآن</button>
        </div>
    </div>
</section>

<script>
    // ---- منطق زر الكمية الزخرفي في الهوك (يُزامن مع كمية الاستمارة دون تعديلها) ----
    (function(){
        let hookQty = 1;
        const hookQtyVal = document.getElementById('hookQtyVal');
        const hookPlus = document.getElementById('hookQtyPlus');
        const hookMinus = document.getElementById('hookQtyMinus');
        function syncMainQty(){
            const mainQty = document.getElementById('product-qty');
            if (mainQty) { mainQty.value = hookQty; if (typeof updateTotal === 'function') updateTotal(); }
        }
        if (hookPlus) hookPlus.addEventListener('click', () => {
            hookQty = Math.min(99, hookQty + 1);
            hookQtyVal.textContent = String(hookQty).padStart(2, '0');
            syncMainQty();
        });
        if (hookMinus) hookMinus.addEventListener('click', () => {
            hookQty = Math.max(1, hookQty - 1);
            hookQtyVal.textContent = String(hookQty).padStart(2, '0');
            syncMainQty();
        });
    })();

    // ---- ربط ألوان الهوك بلون خلفيته وبنفس اختيار اللون في استمارة الطلب ----
    function heroPickColor(el, hex, name){
        document.querySelectorAll('.hero-swatch').forEach(s => s.classList.remove('active'));
        el.classList.add('active');
        const hook = document.getElementById('hook');
        if (hook) hook.style.background = 'linear-gradient(135deg, ' + hex + 'cc, ' + hex + ')';
        const matchingOption = Array.from(document.querySelectorAll('.color-option')).find(c => c.getAttribute('data-name') === name);
        if (matchingOption) matchingOption.click();
    }
</script>
`;

        // --- تحضير منطق المتغيرات (الألوان والمقاسات) - مضاف من te.js ---
        // سنقوم ببناء كود HTML الخاص بالأزرار مسبقاً لحقنه في البرومبت لضمان الدقة
        let variantsHTML = "";

        // 1. معالجة الألوان
        if (variants && variants.colors && variants.colors.enabled && variants.colors.items.length > 0) {
            variantsHTML += `<div class="form-group variant-group"><label class="variant-label">اللون المفضل:</label><div class="variants-wrapper colors-wrapper">`;
            
            variants.colors.items.forEach((color) => {
                // حساب رقم الشريحة المرتبطة (1-based index)
                let slideTarget = 'null';
                if (color.imgIndex !== "" && color.imgIndex !== null && color.imgIndex !== undefined) {
                    slideTarget = parseInt(color.imgIndex) + 1;
                }
                
                variantsHTML += `
                <div class="variant-option color-option" 
                     style="background-color: ${color.hex};" 
                     data-name="${color.name}" 
                     data-slide="${slideTarget}"
                     onclick="selectColor(this, '${color.name}', ${slideTarget})"
                     title="${color.name}">
                </div>`;
            });
            variantsHTML += `</div><input type="hidden" id="selected-color" name="color" required> <span id="color-name-display" style="font-size:12px; color:#666;"></span></div>`;
        }

        // 2. معالجة المقاسات
        if (variants && variants.sizes && variants.sizes.enabled && variants.sizes.items.length > 0) {
            variantsHTML += `<div class="form-group variant-group"><label class="variant-label">المقاس:</label><div class="variants-wrapper sizes-wrapper">`;
            
            variants.sizes.items.forEach((size) => {
                variantsHTML += `
                <div class="variant-option size-option" 
                     data-name="${size.name}" 
                     onclick="selectSize(this, '${size.name}')">
                     ${size.name}
                </div>`;
            });
            variantsHTML += `</div><input type="hidden" id="selected-size" name="size" required></div>`;
        }

        // --- CSS المدمج (فيسبوك + السلايدر الجديد + ستايل المتغيرات الجديد) ---
        const fbStyles = `
        <style>
            :root { --bg-color: #ffffff; --comment-bg: #f0f2f5; --text-primary: #050505; --text-secondary: #65676b; --blue-link: #216fdb; --line-color: #eaebef; }
            
            /* --- 1. ستايل السلايدر الجديد (Lazzwood Style) --- */
            .product-viewer-container { position: relative; width: 100%; max-width: 500px; margin: 0 auto 30px auto; background-color: #f9f9f9; overflow: hidden; border-radius: 8px; }
            .slider-wrapper { position: relative; width: 100%; min-height: 400px; display: flex; align-items: center; justify-content: center; overflow: hidden; background-color: #f4f4f4; }
            .slider-img { display: none; width: 100%; height: auto; object-fit: contain; transition: opacity 0.3s ease; cursor: zoom-in; }
            .slider-img.active { display: block; animation: fadeIn 0.4s; }
            @keyframes fadeIn { from { opacity: 0.5; } to { opacity: 1; } }
            .zoom-btn { position: absolute; top: 20px; left: 20px; width: 40px; height: 40px; background: white; border-radius: 50%; box-shadow: 0 2px 5px rgba(0,0,0,0.1); display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 10; border: none; color: #333; }
            .slider-controls { display: flex; align-items: center; justify-content: center; padding: 15px 0; gap: 20px; background: transparent; font-family: 'Times New Roman', serif; }
            .nav-btn { background: none; border: none; cursor: pointer; font-size: 22px; color: #666; padding: 0 10px; transition: color 0.2s; }
            .nav-btn:hover { color: #000; }
            .slide-counter { font-size: 16px; font-style: italic; color: #333; letter-spacing: 2px; }
            .lightbox-modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(255,255,255,0.98); z-index: 9999; justify-content: center; align-items: center; }
            .lightbox-modal.open { display: flex; }
            .lightbox-img { max-width: 90%; max-height: 90%; object-fit: contain; }
            .close-lightbox { position: absolute; top: 20px; right: 20px; font-size: 35px; cursor: pointer; color: #333; }

            /* --- 2. ستايل خيارات المنتج (الألوان والمقاسات) والكمية - مضاف من te.js --- */
            .variant-group { margin-bottom: 15px; }
            .variant-label { display: block; font-weight: bold; margin-bottom: 8px; font-size: 14px; }
            .variants-wrapper { display: flex; gap: 10px; flex-wrap: wrap; }
            .variant-option { cursor: pointer; border: 2px solid #ddd; transition: all 0.2s; }
            
            /* ستايل الألوان */
            .color-option { width: 35px; height: 35px; border-radius: 50%; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
            .color-option:hover { transform: scale(1.1); }
            .color-option.selected { border-color: var(--text-primary); transform: scale(1.15); box-shadow: 0 0 0 2px #fff, 0 0 0 4px var(--text-primary); }
            
            /* ستايل المقاسات */
            .size-option { padding: 8px 15px; border-radius: 4px; background: #fff; font-size: 14px; font-weight: 600; min-width: 40px; text-align: center; }
            .size-option:hover { border-color: #999; }
            .size-option.selected { background-color: var(--text-primary); color: #fff; border-color: var(--text-primary); }

            /* ستايل الكمية والسعر */
            .qty-price-wrapper { display: flex; align-items: center; justify-content: space-between; margin-top: 15px; padding-top: 15px; border-top: 1px dashed #ddd; }
            .qty-control { display: flex; align-items: center; border: 1px solid #ddd; border-radius: 4px; overflow: hidden; }
            .qty-btn { width: 35px; height: 35px; background: #f4f4f4; border: none; font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
            .qty-btn:hover { background: #e0e0e0; }
            .qty-input { width: 40px; height: 35px; border: none; text-align: center; font-weight: bold; outline: none; }
            .total-price-box { text-align: left; }
            .total-label { font-size: 12px; color: #666; display: block; }
            .total-value { font-size: 18px; font-weight: bold; color: #d32f2f; }

            /* --- 3. ستايل تعليقات الفيسبوك الأصلي --- */
            .fb-reviews-section { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; direction: rtl; padding: 20px; background: #fff; margin-top: 30px; border-top: 1px solid #ddd; }
            .comment-thread { max-width: 600px; margin: 0 auto; position: relative; }
            .thread-line-container { position: absolute; right: 25px; top: 50px; bottom: 30px; width: 2px; background-color: var(--line-color); z-index: 0; }
            .comment-row { display: flex; align-items: flex-start; margin-bottom: 15px; position: relative; z-index: 1; }
            .avatar { width: 32px; height: 32px; border-radius: 50%; overflow: hidden; margin-left: 8px; flex-shrink: 0; border: 1px solid rgba(0,0,0,0.1); }
            .avatar img { width: 100%; height: 100%; object-fit: cover; }
            .comment-content { display: flex; flex-direction: column; max-width: 85%; }
            .bubble { background-color: var(--comment-bg); padding: 8px 12px; border-radius: 18px; display: inline-block; position: relative; }
            .username { font-weight: 600; font-size: 13px; color: var(--text-primary); display: block; margin-bottom: 2px; cursor: pointer; }
            .text { font-size: 15px; color: var(--text-primary); line-height: 1.3; white-space: pre-wrap; }
            .actions { display: flex; gap: 15px; margin-right: 12px; margin-top: 3px; font-size: 12px; color: var(--text-secondary); font-weight: 600; }
            .action-link { cursor: pointer; text-decoration: none; color: var(--text-secondary); }
            .time { font-weight: 400; }
            .reactions-container { position: absolute; bottom: -8px; left: -15px; background-color: white; border-radius: 10px; box-shadow: 0 1px 2px rgba(0,0,0,0.2); padding: 2px 4px; display: flex; align-items: center; height: 18px; z-index: 10; }
            .react-icon { width: 16px; height: 16px; border: 2px solid #fff; border-radius: 50%; }
            .react-count { font-size: 11px; color: var(--text-secondary); margin-left: 4px; margin-right: 2px; }
            .view-replies { display: flex; align-items: center; font-weight: 600; font-size: 14px; color: var(--text-primary); margin: 10px 0; padding-right: 50px; position: relative; cursor: pointer; }
            .view-replies::before { content: ''; position: absolute; right: 25px; top: 50%; width: 20px; height: 2px; background-color: var(--line-color); border-bottom-left-radius: 10px; }
            
            /* أيقونة القلب فقط */
            .icon-love { background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="%23f02849"/><path d="M16 26c-0.6 0-1.2-0.2-1.6-0.6 -5.2-4.6-9.4-8.4-9.4-13.4 0-3 2.4-5.4 5.4-5.4 2.1 0 3.9 1.1 4.9 2.9l0.7 1.2 0.7-1.2c1-1.8 2.8-2.9 4.9-2.9 3 0 5.4 2.4 5.4 5.4 0 5-4.2 8.8-9.4 13.4 -0.4 0.4-1 0.6-1.6 0.6z" fill="white"/></svg>') no-repeat center/cover; }
        </style>
        `;

        const prompt = `
Act as a Senior Creative Director and Conversion Expert. 
Analyze this product: ${productName}. 
Category: ${productCategory}. 
Target Audience: ${targetAudience}.
Context/Features: ${productFeatures}.
Price: ${productPrice}. ${shippingText}. ${offerText}.
User Design Request: ${designDescription}.

## 🖼️ **تعليمات عرض الصور (السلايدر التفاعلي):**
لقد تم تزويدك بصور للمنتج (${productImageArray.length} صور).
**بدلاً من عرض صور ثابتة، يجب عليك بناء "عارض منتج" (Slider) تفاعلي يطابق الكود التالي بدقة:**

### **1. كود HTML للسلايدر (يجب وضعه في مكان الصورة الرئيسية):**
استخدم هذا الهيكل بالضبط مع تضمين الصور المجهزة:
\`\`\`html
<div class="product-viewer-container">
    <button class="zoom-btn" onclick="openLightbox()" aria-label="Zoom"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg></button>
    
    <div class="slider-wrapper">
        ${sliderSlidesHTML}
    </div>

    <div class="slider-controls">
        <button class="nav-btn prev" onclick="changeSlide(-1)">&#10094;</button>
        <span class="slide-counter" id="slideCounter">1 / ${totalSlidesCount}</span>
        <button class="nav-btn next" onclick="changeSlide(1)">&#10095;</button>
    </div>
</div>

<div id="lightbox" class="lightbox-modal" onclick="closeLightbox()"><span class="close-lightbox">&times;</span><img id="lightbox-img" class="lightbox-img" src=""></div>
\`\`\`

### **2. الشعار:**
- استخدم هذا النص بالضبط كمصدر للشعار: \`${LOGO_PLACEHOLDER}\`
- مثال: <img src="${LOGO_PLACEHOLDER}" alt="شعار العلامة التجارية" class="logo">

## 🎯 **الهدف:**
إنشاء صفحة هبوط فريدة ومبدعة تحتوي على السلايدر أعلاه وتحقق أعلى معدلات التحويل.

## ⚠️ **متطلبات إلزامية:**

### **1. قسم الهوك (الواجهة الأولى) — ثابت إلزامياً، ممنوع تصميمه بحرية:**
هذا هو أول قسم يظهر في الصفحة (أول شيء يراه الزائر). **يجب أن يكون دائماً بنفس تصميم قالب Nike المرجعي دون أي تغيير في البنية أو الأسلوب.**
- إليك كود الـ HTML والـ CSS والـ JS الجاهز لهذا القسم، جهّزته مسبقاً بالكامل: انسخه **حرفياً وكما هو تماماً**، بدون أي إضافة أو حذف أو إعادة تصميم، وضعه كأول عنصر داخل الـ body:
\`\`\`html
${heroHTML}
\`\`\`
- ممنوع إنشاء أي غلاف/هيرو بديل، وممنوع تكرار هذا القسم، وممنوع تغيير أسماء الأصناف (classes) بداخله.
- الخلفية فيه محسوبة مسبقاً بالتدرج اللوني المناسب للون المنتج، فلا داعي لأي تصميم إضافي لها.

### **2. استمارة الطلب الذكية (مباشرة بعد الهيرو):**
يجب أن تحتوي على هذا الهيكل الدقيق للحقول باللغة العربية، بما في ذلك خيارات الألوان والمقاسات:

<div class="customer-info-box">
  <h3>استمارة الطلب</h3>
  <p>المرجو إدخال معلوماتك الخاصة بك</p>
  
  <div class="form-group">
    <label>الإسم الكامل</label>
    <input type="text" placeholder="Nom et prénom" required>
  </div>
  
  <div class="form-group">
    <label>رقم الهاتف</label>
    <input type="tel" placeholder="Nombre" required>
  </div>
  
  <div class="form-group">
    <label>الولاية</label>
    <input type="text" placeholder="Wilaya" required>
  </div>
  
  <div class="form-group">
    <label>البلدية</label>
    <input type="text" placeholder="أدخل بلديتك" required>
  </div>
  
  <div class="form-group">
    <label>الموقع / العنوان</label>
    <input type="text" placeholder="أدخل عنوانك بالتفصيل" required>
  </div>
  
  ${variantsHTML}
  <div class="qty-price-wrapper">
      <div class="qty-control">
          <button type="button" class="qty-btn" onclick="updateQty(-1)">-</button>
          <input type="number" id="product-qty" class="qty-input" value="1" min="1" readonly>
          <button type="button" class="qty-btn" onclick="updateQty(1)">+</button>
      </div>
      <div class="total-price-box">
          <span class="total-label">المجموع:</span>
          <span class="total-value" id="total-price-display">${productPrice} دينار</span>
          <input type="hidden" id="final-total" name="total_price" value="${productPrice}">
      </div>
  </div>
  
  <button type="submit" class="submit-btn" style="margin-top: 20px;">تأكيد الطلب</button>
</div>

### **3. سكريبت التفاعل (Logic):**
يجب عليك إضافة كود JavaScript التالي بالضبط لتفعيل السلايدر، وتبديل الصور عند اختيار اللون، وحساب السعر:
\`\`\`html
<script>
    // --- منطق السلايدر ---
    let currentSlide = 1; const totalSlides = ${totalSlidesCount};
    function changeSlide(d) { currentSlide += d; if (currentSlide > totalSlides) currentSlide = 1; if (currentSlide < 1) currentSlide = totalSlides; updateSlider(); }
    
    // دالة تحديث السلايدر العامة
    function updateSlider() { 
        document.querySelectorAll('.slider-img').forEach(img => { 
            img.classList.remove('active'); 
            if(parseInt(img.dataset.index) === currentSlide) img.classList.add('active'); 
        });
        document.getElementById('slideCounter').innerText = currentSlide + ' / ' + totalSlides; 
    }
    
    // دالة الانتقال المباشر لشريحة معينة (تستخدم عند اختيار لون)
    function goToSlide(index) {
        if(index && index >= 1 && index <= totalSlides) {
            currentSlide = index;
            updateSlider();
        }
    }

    function openLightbox() { document.getElementById('lightbox-img').src = document.querySelector('.slider-img.active').src; document.getElementById('lightbox').classList.add('open'); }
    function closeLightbox() { document.getElementById('lightbox').classList.remove('open'); }

    // --- منطق خيارات المنتج (الألوان والمقاسات) ---
    function selectColor(element, name, slideIndex) {
        // إزالة التحديد عن الكل
        document.querySelectorAll('.color-option').forEach(el => el.classList.remove('selected'));
        // تحديد العنصر الحالي
        element.classList.add('selected');
        // تحديث الحقل المخفي
        document.getElementById('selected-color').value = name;
        document.getElementById('color-name-display').innerText = name;
        
        // تغيير صورة المنتج إذا كان هناك صورة مرتبطة بهذا اللون
        if(slideIndex !== null && slideIndex !== 'null') {
            goToSlide(slideIndex);
        }
    }

    function selectSize(element, name) {
        document.querySelectorAll('.size-option').forEach(el => el.classList.remove('selected'));
        element.classList.add('selected');
        document.getElementById('selected-size').value = name;
    }

    // --- منطق حساب السعر والكمية ---
    let basePrice = ${parseFloat(productPrice) || 0};
    let currentQty = 1;

    function updateQty(change) {
        currentQty += change;
        if(currentQty < 1) currentQty = 1;
        document.getElementById('product-qty').value = currentQty;
        updateTotal();
    }

    function updateTotal() {
        let total = (basePrice * currentQty).toFixed(2);
        // إزالة الكسور العشرية إذا كانت .00 لجمالية العرض
        if(total.endsWith('.00')) total = parseInt(total);
        
        document.getElementById('total-price-display').innerText = total + ' دينار';
        document.getElementById('final-total').value = total;
    }
</script>
\`\`\`

### **4. قسم آراء العملاء (Facebook Style):**
يجب أن يبدو القسم كأنه مأخوذ (Screenshot) من نقاش حقيقي على فيسبوك حول المنتج.
1. **التصميم:** استخدم أكواد CSS المرفقة في المتغير \`fbStyles\`.
2. **المحتوى:** أنشئ 3-5 تعليقات واقعية جداً.
   - امزج بين **الدارجة الجزائرية** (مثل: "الله يبارك"، "سلعة شابة"، "وصلتني في وقتها") و **العربية الفصحى البسيطة**.
   - التعليقات يجب أن تمدح المنتج وتؤكد المصداقية.
3. **الصور والأسماء:**
   - **للذكور:** استخدم الاسم العربي المناسب واستخدم الرمز \`[[MALE_IMG]]\` في مصدر الصورة \`src\`.
   - **للإناث:** استخدم الاسم العربي المناسب واستخدم الرمز \`[[FEMALE_IMG]]\` في مصدر الصورة \`src\`.
4. **التفاعل (القلب فقط ❤️):**
   - **هام جداً:** استخدم حصراً أيقونة القلب (\`icon-love\`) لجميع التفاعلات.
   - **لا تستخدم أيقونة اللايك أبداً.**
   - ضع أرقاماً عشوائية منطقية لعدد ساعات لعدد القلوب بجانب كل تعليق.
   - أضف "عرض الردود السابقة" بين بعض التعليقات لزيادة الواقعية.

### نموذج HTML لتعليق واحد (استخدم القلب فقط):
\`\`\`html
<div class="comment-row">
    <div class="avatar"><img src="[[FEMALE_IMG]]" alt="User"></div>
    <div class="comment-content">
        <div class="bubble">
            <span class="username">اسم المستخدم</span>
            <span class="text">نص التعليق هنا...</span>
            <div class="reactions-container">
                <div class="react-icon icon-love"></div> <span class="react-count">15</span>
            </div>
        </div>
        <div class="actions">
            <span class="time">منذ ساعتين</span>
            <span class="action-link">أعجبني</span>
            <span class="action-link">رد</span>
        </div>
    </div>
</div>
\`\`\`

### **5. تنسيق الإخراج:**
أعد كائن JSON فقط:
{
  "html": "سلسلة HTML كاملة",
  "liquid_code": "كود Shopify Liquid",
  "schema": { "name": "Landing Page", "settings": [] }
}

## 🚀 **حرية إبداعية لباقي الأقسام (ما عدا قسم الهوك الثابت أعلاه):**
- قسم الهوك (رقم 1) ثابت إلزامياً كما هو موضح أعلاه، لا حرية فيه إطلاقاً.
- أما بقية الصفحة (تفاصيل إضافية عن المنتج، مميزات، أسئلة شائعة...) بين الهوك واستمارة الطلب أو بعدها، فصممها بحرية تامة باستخدام CSS حديث وجذاب
- استخدم تأثيرات hover، transitions، وanimations لجعل الصفحة تفاعلية
- تأكد من أن الصفحة سريعة الاستجابة وتعمل على جميع الأجهزة
- أضف عد تنازلي أقل من ساعتان أنيق يحفز الزائر على الشراء بلون مناسب لصفحة و للمنتج
- أضف أقسام إضافية مثل: مميزات المنتج، الأسئلة الشائعة، إلخ
- **مهم:** قم بتضمين كودي CSS (\`heroStyles\` الخاص بالهوك و\`fbStyles\`) اللذين سأزودك بهما في بداية الـ HTML الناتج.

قم بدمج هذا الـ CSS في بداية الـ HTML الناتج (كلاهما معاً، دون حذف أي منهما):
${heroStyles}
${fbStyles}
        `;

        const response = await fetch(GEMINI_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { 
                    responseMimeType: "application/json",
                    temperature: 0.95
                }
            })
        });

        const data = await response.json();

        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
            throw new Error('Failed to generate content from AI');
        }

        const aiResponseText = data.candidates[0].content.parts[0].text;
        const cleanedText = aiResponseText.replace(/```json/g, '').replace(/```/g, '').trim();
        let aiResponse = JSON.parse(cleanedText);

        // ***************************************************************
        // عملية الحقن: استبدال الرموز (صور المنتج + صور الأشخاص)
        // ***************************************************************
        
        // صور افتراضية
        const defaultImg = "https://via.placeholder.com/600x600?text=Product+Image";
        const defaultLogo = "https://via.placeholder.com/150x50?text=Logo";
        const finalProductImages = productImageArray.length > 0 ? productImageArray : [defaultImg];
        const finalBrandLogo = brandLogo || defaultLogo;

        // دالة الصور العشوائية (أشخاص حقيقيين)
        const getRandomAvatar = (gender) => {
            const randomId = Math.floor(Math.random() * 50); 
            const genderPath = gender === 'male' ? 'men' : 'women';
            return `https://randomuser.me/api/portraits/${genderPath}/${randomId}.jpg`;
        };

        // دالة حقن صور الأشخاص
        const injectAvatars = (htmlContent) => {
            if (!htmlContent) return htmlContent;
            let content = htmlContent;
            while (content.includes('[[MALE_IMG]]')) {
                content = content.replace('[[MALE_IMG]]', getRandomAvatar('male'));
            }
            while (content.includes('[[FEMALE_IMG]]')) {
                content = content.replace('[[FEMALE_IMG]]', getRandomAvatar('female'));
            }
            return content;
        };

        // دالة للاستبدال الآمن لصور المنتج
        const replaceImages = (content) => {
            if (!content) return content;
            let result = content;
            // استبدال الصورة الرئيسية
            result = result.split(MAIN_IMG_PLACEHOLDER).join(finalProductImages[0]);
            // استبدال الشعار
            result = result.split(LOGO_PLACEHOLDER).join(finalBrandLogo);
            // استبدال الصور الإضافية
            for (let i = 1; i < finalProductImages.length && i <= 6; i++) {
                const placeholder = `[[PRODUCT_IMAGE_${i + 1}_SRC]]`;
                result = result.split(placeholder).join(finalProductImages[i]);
            }
            return result;
        };

        // تطبيق الاستبدال وحقن الأفاتار على HTML و Liquid Code
        aiResponse.html = injectAvatars(replaceImages(aiResponse.html));
        aiResponse.liquid_code = injectAvatars(replaceImages(aiResponse.liquid_code));

        res.status(200).json({
            liquid_code: aiResponse.liquid_code,
            schema: aiResponse.schema,
            html: aiResponse.html
        });

    } catch (error) {
        console.error("Server Error:", error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
}
