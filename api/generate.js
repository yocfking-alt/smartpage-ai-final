--- START OF FILE generate.js ---

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
        
        // --- تحضير شرائح السلايدر (نظام البطاقات الجديد ZEVANA 3D) ---
        // البطاقة الأولى (نشطة افتراضياً)
        let sliderSlidesHTML = `
        <div class="card active" data-index="1">
            <div class="img-container">
                <img src="${MAIN_IMG_PLACEHOLDER}" alt="Product 1">
            </div>
        </div>`;
        
        // باقي البطاقات
        for (let i = 1; i < productImageArray.length && i <= 6; i++) {
            sliderSlidesHTML += `
            <div class="card" data-index="${i + 1}">
                <div class="img-container">
                    <img src="[[PRODUCT_IMAGE_${i + 1}_SRC]]" alt="Product ${i + 1}">
                </div>
            </div>`;
        }
        const totalSlidesCount = Math.max(productImageArray.length, 1);

        // --- تحضير منطق المتغيرات (الألوان والمقاسات) ---
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

        // --- CSS المدمج (فيسبوك + ستايل السلايدر الجديد ZEVANA 3D) ---
        const fbStyles = `
        <style>
            :root { --bg-color: #ffffff; --comment-bg: #f0f2f5; --text-primary: #050505; --text-secondary: #65676b; --blue-link: #216fdb; --line-color: #eaebef; }
            
            /* --- 1. ستايل السلايدر الحر المتجاوب (ZEVANA 3D) --- */
            .product-viewer-container { 
                position: relative; 
                width: 100%; 
                height: 450px; /* ارتفاع الكمبيوتر */
                margin: 0 auto 30px auto; 
                overflow: hidden; 
                background: transparent; 
            }

            .gallery-stage {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                display: flex;
                justify-content: center;
                align-items: center;
                perspective: 1200px;
                overflow: hidden;
                touch-action: pan-y;
                z-index: 10;
            }

            .card {
                position: absolute;
                width: 260px; /* عرض البطاقة للكمبيوتر */
                height: 380px; /* ارتفاع البطاقة للكمبيوتر */
                border-radius: 12px; 
                background-color: #ffffff; 
                overflow: hidden;
                box-shadow: 0 20px 50px rgba(0,0,0,0.15);
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%) scale(0.6);
                transition: all 1.2s cubic-bezier(0.2, 1, 0.3, 1); 
                cursor: grab;
                opacity: 0;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                border: 1px solid rgba(0,0,0,0.05);
            }

            /* --- تصحيح حجم الصور للموبايل --- */
            @media (max-width: 768px) {
                .product-viewer-container {
                    height: 350px; /* تقليل ارتفاع السلايدر في الموبايل */
                    margin-bottom: 10px;
                }
                .card {
                    width: 190px; /* عرض أصغر للبطاقة في الموبايل ليسمح بظهور الجوانب */
                    height: 280px; /* ارتفاع أصغر */
                }
            }

            .img-container {
                width: 100%;
                height: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                background: #fff;
            }

            .img-container img {
                width: 100%;
                height: 100%;
                object-fit: cover;
                display: block;
            }
            
            /* أزرار التحكم */
            .controls {
                position: absolute;
                bottom: 10px;
                left: 50%;
                transform: translateX(-50%);
                display: flex;
                justify-content: center;
                align-items: center;
                gap: 40px;
                z-index: 100;
            }

            .nav-btn {
                width: 40px; height: 40px;
                border: 1px solid rgba(0,0,0,0.1);
                border-radius: 50%;
                display: flex; justify-content: center; align-items: center;
                cursor: pointer;
                transition: 0.3s;
                background: rgba(255,255,255,0.8);
                box-shadow: 0 4px 10px rgba(0,0,0,0.1);
            }

            .nav-btn:hover { border-color: #000; background: #fff; transform: scale(1.1); }
            .nav-btn svg { width: 18px; height: 18px; fill: #333; }

            /* --- 2. ستايل خيارات المنتج (الألوان والمقاسات) والكمية --- */
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

## 🖼️ **تعليمات عرض الصور (سلايدر 3D تفاعلي):**
لقد تم تزويدك بصور للمنتج (${productImageArray.length} صور).
**بدلاً من عرض صور ثابتة، يجب عليك بناء "عارض منتج" (3D Slider) تفاعلي يطابق الكود التالي بدقة:**

### **1. كود HTML للسلايدر (يجب وضعه في مكان الصورة الرئيسية):**
استخدم هذا الهيكل بالضبط مع تضمين البطاقات المجهزة:
\`\`\`html
<div class="product-viewer-container">
    <div class="gallery-stage" id="slider-stage">
        ${sliderSlidesHTML}
    </div>

    <div class="controls">
        <button type="button" class="nav-btn" id="prevBtn" onclick="changeSlide(-1)">
            <svg viewBox="0 0 24 24"><path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6 1.41-1.41z"/></svg>
        </button>
        <button type="button" class="nav-btn" id="nextBtn" onclick="changeSlide(1)">
            <svg viewBox="0 0 24 24"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/></svg>
        </button>
    </div>
</div>
\`\`\`

### **2. الشعار:**
- استخدم هذا النص بالضبط كمصدر للشعار: \`${LOGO_PLACEHOLDER}\`
- مثال: <img src="${LOGO_PLACEHOLDER}" alt="شعار العلامة التجارية" class="logo">

## 🎯 **الهدف:**
إنشاء صفحة هبوط فريدة ومبدعة تحتوي على السلايدر أعلاه وتحقق أعلى معدلات التحويل.

## ⚠️ **متطلبات إلزامية:**

### **1. قسم الهيرو:**
- يتضمن الشعار في الهيدر.
- **مهم جداً:** استبدل صورة المنتج التقليدية بكود "السلايدر التفاعلي" المذكور أعلاه بالكامل.
- لا تضف معرض صور منفصل في الأسفل، السلايدر يكفي.

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
يجب عليك إضافة كود JavaScript التالي بالضبط لتفعيل السلايدر الجديد (ZEVANA 3D Logic)، وتبديل الصور عند اختيار اللون، وحساب السعر:
\`\`\`html
<script>
    // --- منطق السلايدر (ZEVANA 3D Logic - With Slow Intro & Responsive Gap) ---
    const stage = document.getElementById('slider-stage');
    let cards = [];
    let currentIndex = 0; // البدء من البطاقة الأولى (Index 0)
    let isDragging = false;
    let startX = 0;

    function initSlider() {
        cards = Array.from(document.querySelectorAll('.card'));
        if(cards.length > 0) {
            updateSlider(true); // true تعني تفعيل مقدمة بطيئة
        }
    }

    function updateSlider(isInitial = false) {
        // حساب المسافة ديناميكياً بناءً على حجم الشاشة
        const isMobile = window.innerWidth <= 768;
        const gap = isMobile ? 170 : 260; // 170px للهاتف، 260px للكمبيوتر

        cards.forEach((card, index) => {
            const offset = index - currentIndex;
            
            let translateX = offset * gap; 
            let rotateY = offset * -15;    
            let scale = 1 - Math.abs(offset) * 0.15; 
            let zIndex = 10 - Math.abs(offset);
            
            if (Math.abs(offset) > 2) {
               card.style.opacity = "0";
               card.style.pointerEvents = "none";
            } else {
               card.style.opacity = "1";
               card.style.pointerEvents = offset === 0 ? 'auto' : 'none';
            }

            if (offset === 0) {
                card.classList.add('active');
                scale = 1.0; 
            } else {
                card.classList.remove('active');
            }

            if (isInitial) {
               // مقدمة بطيئة وفخمة
               card.style.transitionDelay = (Math.abs(offset) * 0.5) + "s";
               card.style.transitionDuration = "2.2s"; 
               card.style.transitionTimingFunction = "cubic-bezier(0.2, 1, 0.3, 1)";
            } else {
                // سرعة عادية
                card.style.transitionDelay = "0s";
                card.style.transitionDuration = "0.8s";
            }

            card.style.transform = \`translate(-50%, -50%) translateX(\${translateX}px) scale(\${scale}) rotateY(\${rotateY}deg)\`;
            card.style.zIndex = zIndex;
        });
    }

    // تحديث السلايدر عند تغيير حجم الشاشة لضبط المسافات
    window.addEventListener('resize', () => {
        updateSlider(false);
    });

    function changeSlide(dir) {
        if (dir === 1 && currentIndex < cards.length - 1) { currentIndex++; updateSlider(); }
        else if (dir === -1 && currentIndex > 0) { currentIndex--; updateSlider(); }
    }
    
    // دالة الانتقال المباشر لشريحة معينة (تستخدم عند اختيار لون)
    function goToSlide(index) {
        let targetIndex = index - 1; // تحويل من 1-based إلى 0-based
        if(targetIndex >= 0 && targetIndex < cards.length) {
            currentIndex = targetIndex;
            updateSlider();
        }
    }

    // تهيئة السحب (Drag/Touch)
    if(stage) {
        stage.addEventListener('mousedown', (e) => { isDragging = true; startX = e.pageX; });
        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const diff = startX - e.pageX;
            if (Math.abs(diff) > 80) {
                if (diff > 0 && currentIndex < cards.length - 1) { currentIndex++; updateSlider(); }
                else if (diff < 0 && currentIndex > 0) { currentIndex--; updateSlider(); }
                isDragging = false;
            }
        });
        window.addEventListener('mouseup', () => isDragging = false);

        stage.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; });
        stage.addEventListener('touchmove', (e) => {
            const diff = startX - e.touches[0].clientX;
            if (Math.abs(diff) > 50) {
                if (diff > 0 && currentIndex < cards.length - 1) { currentIndex++; updateSlider(); }
                else if (diff < 0 && currentIndex > 0) { currentIndex--; updateSlider(); }
                startX = e.touches[0].clientX;
            }
        });
    }

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

    // تهيئة عند التحميل
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => { initSlider(); }, 200);
    });
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

## 🚀 **حرية إبداعية كاملة لباقي الأقسام:**
- صمم باقي الصفحة بحرية تامة باستخدام CSS حديث وجذاب
- استخدم تأثيرات hover، transitions، وanimations لجعل الصفحة تفاعلية
- تأكد من أن الصفحة سريعة الاستجابة وتعمل على جميع الأجهزة
- أضف عد تنازلي أقل من ساعتان أنيق يحفز الزائر على الشراء بلون مناسب لصفحة و للمنتج
- أضف أقسام إضافية مثل: مميزات المنتج، الأسئلة الشائعة، إلخ
- **مهم:** قم بتضمين كود CSS (\`fbStyles\`) الذي سأزودك به في بداية الـ HTML الناتج.

قم بدمج هذا الـ CSS في بداية الـ HTML الناتج:
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
