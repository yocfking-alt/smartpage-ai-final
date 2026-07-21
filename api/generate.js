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

        // --- تحضير منطق المتغيرات (الألوان والمقاسات) ---
        let variantsHTML = "";

        // 1. معالجة الألوان
        if (variants && variants.colors && variants.colors.enabled && variants.colors.items.length > 0) {
            variantsHTML += `<div class="form-group variant-group"><label class="variant-label">اللون المفضل:</label><div class="variants-wrapper colors-wrapper">`;
            
            variants.colors.items.forEach((color) => {
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

        // --- CSS المدمج (فيسبوك + السلايدر الجديد + ستايل المتغيرات) ---
        const fbStyles = `
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Poppins:wght@300;400;500;600;700&family=Inter:wght@300;400;500&display=swap');

            :root { 
                --bg-color: #ffffff; 
                --comment-bg: #f0f2f5; 
                --text-primary: #050505; 
                --text-secondary: #65676b; 
                --blue-link: #216fdb; 
                --line-color: #eaebef; 
                --paper:#f3f1ee;
                --paper-2:#eceae6;
            }
            
            /* --- 1. ستايل السلايدر المتوافق مع واجهة Nike --- */
            .product-viewer-container { position: relative; width: 100%; max-width: 550px; margin: 0 auto; background: transparent; overflow: hidden; border-radius: 16px; }
            .slider-wrapper { position: relative; width: 100%; min-height: 380px; display: flex; align-items: center; justify-content: center; overflow: hidden; background: rgba(255,255,255,0.05); border-radius: 16px; backdrop-filter: blur(5px); }
            .slider-img { display: none; width: 100%; height: auto; object-fit: contain; transition: opacity 0.3s ease; cursor: zoom-in; }
            .slider-img.active { display: block; animation: fadeIn 0.4s; }
            @keyframes fadeIn { from { opacity: 0.5; } to { opacity: 1; } }
            .zoom-btn { position: absolute; top: 15px; left: 15px; width: 38px; height: 38px; background: rgba(255,255,255,0.85); border-radius: 50%; box-shadow: 0 4px 12px rgba(0,0,0,0.15); display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 10; border: none; color: #111; }
            .slider-controls { display: flex; align-items: center; justify-content: center; padding: 12px 0; gap: 20px; background: transparent; font-family: 'Poppins', sans-serif; }
            .nav-btn { background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.4); border-radius: 50%; width: 32px; height: 32px; cursor: pointer; font-size: 16px; color: inherit; transition: all 0.2s; display: flex; align-items: center; justify-content: center; }
            .nav-btn:hover { background: rgba(255,255,255,0.4); }
            .slide-counter { font-size: 14px; font-weight: 500; opacity: 0.85; letter-spacing: 1px; }
            .lightbox-modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.92); z-index: 9999; justify-content: center; align-items: center; }
            .lightbox-modal.open { display: flex; }
            .lightbox-img { max-width: 90%; max-height: 90%; object-fit: contain; }
            .close-lightbox { position: absolute; top: 20px; right: 20px; font-size: 35px; cursor: pointer; color: #fff; }

            /* --- 2. ستايل خيارات المنتج والكمية --- */
            .variant-group { margin-bottom: 15px; }
            .variant-label { display: block; font-weight: bold; margin-bottom: 8px; font-size: 14px; }
            .variants-wrapper { display: flex; gap: 10px; flex-wrap: wrap; }
            .variant-option { cursor: pointer; border: 2px solid #ddd; transition: all 0.2s; }
            .color-option { width: 35px; height: 35px; border-radius: 50%; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
            .color-option:hover { transform: scale(1.1); }
            .color-option.selected { border-color: var(--text-primary); transform: scale(1.15); box-shadow: 0 0 0 2px #fff, 0 0 0 4px var(--text-primary); }
            .size-option { padding: 8px 15px; border-radius: 999px; background: #fff; font-size: 14px; font-weight: 600; min-width: 40px; text-align: center; }
            .size-option:hover { border-color: #999; }
            .size-option.selected { background-color: var(--text-primary); color: #fff; border-color: var(--text-primary); }

            /* ستايل الكمية والسعر */
            .qty-price-wrapper { display: flex; align-items: center; justify-content: space-between; margin-top: 15px; padding-top: 15px; border-top: 1px dashed #ddd; }
            .qty-control { display: flex; align-items: center; border: 1px solid #ddd; border-radius: 999px; overflow: hidden; background: #fff; }
            .qty-btn { width: 35px; height: 35px; background: transparent; border: none; font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
            .qty-btn:hover { background: #f0f0f0; }
            .qty-input { width: 40px; height: 35px; border: none; text-align: center; font-weight: bold; outline: none; background: transparent; }
            .total-price-box { text-align: left; }
            .total-label { font-size: 12px; color: #666; display: block; }
            .total-value { font-size: 20px; font-weight: 700; color: #111; }

            /* --- 3. ستايل تعليقات الفيسبوك الأصلي --- */
            .fb-reviews-section { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; direction: rtl; padding: 25px 20px; background: #fff; margin-top: 30px; border-top: 1px solid #ddd; }
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

## 🎨 **نمط التصميم المطلوب (NIKE LANDING PAGE TEMPLATE STYLE):**
يجب إنشاء واجهة صفحة الهبوط واستخدام لغة تصميم مطابقة لصفحات هبوط NIKE تماماً:
1. **تصميم الهيرو (Hero Section):**
   - خلفية ذات تدرج لوني داكن وأنيق يتناسب مع لون المنتج (مثل التدرج الداكن العنابي، الأورانج، الوردي أو الأسود/الرمادي الداكن: \`linear-gradient(135deg, #161616, #0a0a0a)\` أو حسب لون المنتج).
   - إضافة العارضة المائية الخلفية (Swoosh/Watermark SVG opacity: 0.06).
   - استخدام خطوط Nike المميزة: \`font-family: 'Poppins', 'Archivo Black', sans-serif\`.
   - عنوان عريض جداً وجذاب مع نصوص ثانوية شفافة أنيقة (\`color: rgba(255,255,255,0.75)\`).
   - أزرار بيضاوية دائرية الشكل (\`btn-pill\`) وتفاصيل تصميم عصرية.
   - وضع عارض الصور (السلايدر) في منتصف قسم الهيرو بتصميم متناسق مع الحلقات المدارية (\`orbit-ring\`).

2. **أقسام مميزات المنتج (Nike Features & Quality Sections):**
   - إنشاء أقسام تالية مستوحاة من نايك بخلفيات أنيقة (\`#f3f1ee\`).
   - استخدام الشارات التوضيحية حول المنتج (\`callout badges\`) مثل: Lightweight, Durable, Shock absorption... إلخ.

## 🖼️ **تعليمات عرض الصور (السلايدر التفاعلي):**
لقد تم تزويدك بصور للمنتج (${productImageArray.length} صور).
**ضع عارض الصور (Slider) التفاعلي في قسم الهيرو الرئيسي بداخل الهيكل التالي بالضبط:**

### **1. كود HTML للسلايدر:**
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
إنشاء صفحة هبوط ذات نمط واجهة Nike تحقق أعلى معدلات التحويل.

## ⚠️ **متطلبات إلزامية:**

### **1. قسم الهيرو (Nike Styled Hero):**
- يتضمن الشعار في الهيدر.
- استبدل صورة المنتج التقليدية بكود "السلايدر التفاعلي" المذكور أعلاه بالكامل داخل التصميم العريض لـ Nike.

### **2. استمارة الطلب الذكية (مباشرة بعد الهيرو):**
يجب إبقاء استمارة الطلب كما هي بالضبط وبنفس الهيكل أدناه (يمكنك تنسيق بطاقتها الخارجية لتناسب ستايل الصفحة):

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
يجب عليك إضافة كود JavaScript التالي بالضبط بدون أي تعديل:
\`\`\`html
<script>
    // --- منطق السلايدر ---
    let currentSlide = 1; const totalSlides = ${totalSlidesCount};
    function changeSlide(d) { currentSlide += d; if (currentSlide > totalSlides) currentSlide = 1; if (currentSlide < 1) currentSlide = totalSlides; updateSlider(); }
    
    function updateSlider() { 
        document.querySelectorAll('.slider-img').forEach(img => { 
            img.classList.remove('active'); 
            if(parseInt(img.dataset.index) === currentSlide) img.classList.add('active'); 
        });
        document.getElementById('slideCounter').innerText = currentSlide + ' / ' + totalSlides; 
    }
    
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
        document.querySelectorAll('.color-option').forEach(el => el.classList.remove('selected'));
        element.classList.add('selected');
        document.getElementById('selected-color').value = name;
        document.getElementById('color-name-display').innerText = name;
        
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
        if(total.endsWith('.00')) total = parseInt(total);
        
        document.getElementById('total-price-display').innerText = total + ' دينار';
        document.getElementById('final-total').value = total;
    }
</script>
\`\`\`

### **4. قسم آراء العملاء (Facebook Style):**
يجب حماية قسم التعليقات تماماً وأن يبدو كأنه Screenshot من فيسبوك:
1. **التصميم:** استخدم أكواد CSS المرفقة في المتغير \`fbStyles\`.
2. **المحتوى:** أنشئ 3-5 تعليقات بالدارجة الجزائرية والإنطباعات الإيجابية.
3. **الصور والأسماء:**
   - **للذكور:** الرمز \`[[MALE_IMG]]\` في مصدر الصورة \`src\`.
   - **للإناث:** الرمز \`[[FEMALE_IMG]]\` في مصدر الصورة \`src\`.
4. **التفاعل (القلب فقط ❤️):**
   - استخدم حصراً أيقونة القلب (\`icon-love\`). لا تستخدم أيقونة اللايك أبداً.

### **5. تنسيق الإخراج:**
أعد كائن JSON فقط:
{
  "html": "سلسلة HTML كاملة",
  "liquid_code": "كود Shopify Liquid",
  "schema": { "name": "Landing Page", "settings": [] }
}

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
        
        const defaultImg = "https://via.placeholder.com/600x600?text=Product+Image";
        const defaultLogo = "https://via.placeholder.com/150x50?text=Logo";
        const finalProductImages = productImageArray.length > 0 ? productImageArray : [defaultImg];
        const finalBrandLogo = brandLogo || defaultLogo;

        const getRandomAvatar = (gender) => {
            const randomId = Math.floor(Math.random() * 50); 
            const genderPath = gender === 'male' ? 'men' : 'women';
            return `https://randomuser.me/api/portraits/${genderPath}/${randomId}.jpg`;
        };

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

        const replaceImages = (content) => {
            if (!content) return content;
            let result = content;
            result = result.split(MAIN_IMG_PLACEHOLDER).join(finalProductImages[0]);
            result = result.split(LOGO_PLACEHOLDER).join(finalBrandLogo);
            for (let i = 1; i < finalProductImages.length && i <= 6; i++) {
                const placeholder = `[[PRODUCT_IMAGE_${i + 1}_SRC]]`;
                result = result.split(placeholder).join(finalProductImages[i]);
            }
            return result;
        };

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
