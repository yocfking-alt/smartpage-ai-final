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
            :root { --bg-color: #ffffff; --comment-bg: #f0f2f5; --text-primary: #050505; --text-secondary: #65676b; --blue-link: #216fdb; --line-color: #eaebef; }
            
            /* --- 1. ستايل السلايدر الجديد --- */
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

            /* --- 2. ستايل خيارات المنتج --- */
            .variant-group { margin-bottom: 15px; }
            .variant-label { display: block; font-weight: bold; margin-bottom: 8px; font-size: 14px; }
            .variants-wrapper { display: flex; gap: 10px; flex-wrap: wrap; }
            .variant-option { cursor: pointer; border: 2px solid #ddd; transition: all 0.2s; }
            .color-option { width: 35px; height: 35px; border-radius: 50%; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
            .color-option:hover { transform: scale(1.1); }
            .color-option.selected { border-color: var(--text-primary); transform: scale(1.15); box-shadow: 0 0 0 2px #fff, 0 0 0 4px var(--text-primary); }
            .size-option { padding: 8px 15px; border-radius: 4px; background: #fff; font-size: 14px; font-weight: 600; min-width: 40px; text-align: center; }
            .size-option:hover { border-color: #999; }
            .size-option.selected { background-color: var(--text-primary); color: #fff; border-color: var(--text-primary); }
            .qty-price-wrapper { display: flex; align-items: center; justify-content: space-between; margin-top: 15px; padding-top: 15px; border-top: 1px dashed #ddd; }
            .qty-control { display: flex; align-items: center; border: 1px solid #ddd; border-radius: 4px; overflow: hidden; }
            .qty-btn { width: 35px; height: 35px; background: #f4f4f4; border: none; font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
            .qty-btn:hover { background: #e0e0e0; }
            .qty-input { width: 40px; height: 35px; border: none; text-align: center; font-weight: bold; outline: none; }
            .total-price-box { text-align: left; }
            .total-label { font-size: 12px; color: #666; display: block; }
            .total-value { font-size: 18px; font-weight: bold; color: #d32f2f; }

            /* --- 3. ستايل تعليقات الفيسبوك --- */
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

### **1. قسم الهيرو:**
- يتضمن الشعار في الهيدر.
- **مهم جداً:** استبدل صورة المنتج التقليدية بكود "السلايدر التفاعلي" المذكور أعلاه بالكامل.
- لا تضف معرض صور منفصل في الأسفل، السلايدر يكفي.

### **2. استمارة الطلب الذكية (مباشرة بعد الهيرو):**
يجب أن تحتوي على هذا الهيكل الدقيق للحقول باللغة العربية:

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
يجب عليك إضافة كود JavaScript التالي بالضبط لتفعيل السلايدر والمتغيرات وحساب السعر:
\`\`\`html
<script>
    // --- منطق السلايدر ---
    let currentSlide = 1; const totalSlides = ${totalSlidesCount};
    function changeSlide(d) { currentSlide += d; if (currentSlide > totalSlides) currentSlide = 1; if (currentSlide < 1) currentSlide = totalSlides; updateSlider(); }
    
    // دالة تحديث السلايدر
    function updateSlider() { 
        document.querySelectorAll('.slider-img').forEach(img => { 
            img.classList.remove('active'); 
            if(parseInt(img.dataset.index) === currentSlide) img.classList.add('active'); 
        });
        document.getElementById('slideCounter').innerText = currentSlide + ' / ' + totalSlides; 
    }
    
    // الانتقال المباشر لشريحة (للمتغيرات)
    function goToSlide(index) {
        if(index && index >= 1 && index <= totalSlides) {
            currentSlide = index;
            updateSlider();
        }
    }

    function openLightbox() { document.getElementById('lightbox-img').src = document.querySelector('.slider-img.active').src; document.getElementById('lightbox').classList.add('open'); }
    function closeLightbox() { document.getElementById('lightbox').classList.remove('open'); }

    // --- منطق خيارات المنتج ---
    function selectColor(element, name, slideIndex) {
        document.querySelectorAll('.color-option').forEach(el => el.classList.remove('selected'));
        element.classList.add('selected');
        document.getElementById('selected-color').value = name;
        document.getElementById('color-name-display').innerText = name;
        if(slideIndex !== null && slideIndex !== 'null') goToSlide(slideIndex);
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
استخدم CSS المرفق في المتغير \`fbStyles\`.
أنشئ 3-5 تعليقات واقعية باللهجة الجزائرية والفصحى.
استخدم الرموز \`[[MALE_IMG]]\` و \`[[FEMALE_IMG]]\` للصور.
استخدم أيقونة القلب \`icon-love\` فقط للتفاعلات.

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

        // تطبيق الاستبدال وحقن الأفاتار
        aiResponse.html = injectAvatars(replaceImages(aiResponse.html));
        aiResponse.liquid_code = injectAvatars(replaceImages(aiResponse.liquid_code));

        // ***************************************************************
        // ميزة البوت الذكي (Gemini Chatbot) - مدمجة تلقائياً
        // ***************************************************************
        
        // 1. تحضير سياق المنتج للبوت
        const chatbotContext = `
        اسم المنتج: ${productName}
        السعر: ${productPrice}
        المميزات: ${productFeatures}
        التصنيف: ${productCategory}
        العرض الحالي: ${offerText || "لا يوجد عرض حالي"}
        الشحن: ${shippingText}
        `;

        // 2. كود واجهة الشات (CSS + HTML + JS) ليتم حقنها في الصفحة
        const chatbotWidgetCode = `
        <style>
            .chatbot-toggler { position: fixed; bottom: 30px; right: 35px; outline: none; border: none; height: 50px; width: 50px; display: flex; cursor: pointer; align-items: center; justify-content: center; border-radius: 50%; background: #25D366; transition: all 0.2s ease; z-index: 9999; box-shadow: 0 4px 10px rgba(0,0,0,0.2); }
            .chatbot-toggler span { color: #fff; position: absolute; font-size: 24px; }
            .chatbot-toggler span:last-child, body.show-chatbot .chatbot-toggler span:first-child { opacity: 0; }
            body.show-chatbot .chatbot-toggler span:last-child { opacity: 1; }
            .chatbot { position: fixed; right: 35px; bottom: 90px; width: 320px; background: #fff; border-radius: 15px; overflow: hidden; opacity: 0; pointer-events: none; transform: scale(0.5); transform-origin: bottom right; box-shadow: 0 0 128px 0 rgba(0,0,0,0.1), 0 32px 64px -48px rgba(0,0,0,0.5); transition: all 0.1s ease; z-index: 9998; border: 1px solid #ddd; }
            body.show-chatbot .chatbot { opacity: 1; pointer-events: auto; transform: scale(1); }
            .chatbot header { padding: 15px 0; text-align: center; color: #fff; background: #25D366; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .chatbot header h2 { font-size: 1.2rem; font-weight: bold; margin: 0; }
            .chatbot .chatbox { overflow-y: auto; height: 300px; padding: 15px 20px 70px; margin: 0; list-style: none; }
            .chatbot :where(.chatbox, textarea)::-webkit-scrollbar { width: 6px; }
            .chatbot :where(.chatbox, textarea)::-webkit-scrollbar-thumb { background: #ccc; border-radius: 25px; }
            .chatbox .chat { display: flex; list-style: none; margin-bottom: 15px; }
            .chatbox .outgoing { justify-content: flex-end; }
            .chatbox .incoming span { width: 32px; height: 32px; color: #fff; background: #25D366; text-align: center; line-height: 32px; border-radius: 4px; margin: 0 10px 7px 0; align-self: flex-end; font-size: 18px; }
            .chatbox .chat p { white-space: pre-wrap; padding: 10px 14px; border-radius: 10px 10px 0 10px; max-width: 80%; color: #fff; font-size: 0.9rem; background: #25D366; margin: 0; }
            .chatbox .incoming p { border-radius: 10px 10px 10px 0; color: #000; background: #f2f2f2; }
            .chatbot .chat-input { display: flex; gap: 5px; position: absolute; bottom: 0; width: 100%; background: #fff; padding: 5px 20px; border-top: 1px solid #ddd; }
            .chat-input textarea { height: 50px; width: 100%; border: none; outline: none; resize: none; padding: 12px 0; font-size: 0.95rem; }
            .chat-input span { align-self: center; color: #25D366; cursor: pointer; height: 40px; width: 40px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; visibility: hidden; }
            .chat-input textarea:valid ~ span { visibility: visible; }
            @media (max-width: 490px) { .chatbot { right: 0; bottom: 0; height: 100%; border-radius: 0; width: 100%; } .chatbot .chatbox { height: 90%; } }
        </style>

        <button class="chatbot-toggler">
            <span>💬</span>
            <span>✖</span>
        </button>
        <div class="chatbot">
            <header>
                <h2>خدمة العملاء</h2>
            </header>
            <ul class="chatbox">
                <li class="chat incoming">
                    <span>🎧</span>
                    <p>مرحباً! 👋<br>أنا المساعد الذكي، كاش ما تسحق نعاونك بخصوص ${productName}؟</p>
                </li>
            </ul>
            <div class="chat-input">
                <textarea placeholder="اكتب سؤالك هنا..." spellcheck="false" required></textarea>
                <span id="send-btn">➤</span>
            </div>
        </div>

        <script>
            (function() {
                const chatbotToggler = document.querySelector(".chatbot-toggler");
                const chatbox = document.querySelector(".chatbox");
                const chatInput = document.querySelector(".chat-input textarea");
                const sendChatBtn = document.querySelector(".chat-input span");

                let userMessage = null;
                const inputInitHeight = chatInput.scrollHeight;
                
                // سياق المنتج (يتم حقنه من السيرفر)
                const PRODUCT_CONTEXT = \`${chatbotContext}\`;
                let chatHistory = [];

                const createChatLi = (message, className) => {
                    const chatLi = document.createElement("li");
                    chatLi.classList.add("chat", className);
                    let chatContent = className === "outgoing" ? \`<p></p>\` : \`<span>🎧</span><p></p>\`;
                    chatLi.innerHTML = chatContent;
                    chatLi.querySelector("p").textContent = message;
                    return chatLi;
                }

                const generateResponse = async (chatElement) => {
                    const API_URL = "/api/chat"; 
                    const messageElement = chatElement.querySelector("p");

                    try {
                        const response = await fetch(API_URL, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                message: userMessage,
                                productContext: PRODUCT_CONTEXT,
                                history: chatHistory
                            })
                        });
                        const data = await response.json();
                        if (!response.ok) throw new Error(data.error || 'Server Error');

                        messageElement.textContent = data.reply;
                        
                        chatHistory.push({ role: 'user', text: userMessage });
                        chatHistory.push({ role: 'bot', text: data.reply });
                        if(chatHistory.length > 6) chatHistory = chatHistory.slice(-6);

                    } catch (error) {
                        messageElement.textContent = "عذراً، لا يمكنني الرد حالياً. يرجى التحقق من اتصالك.";
                        messageElement.style.color = "#721c24";
                        messageElement.style.background = "#f8d7da";
                    } finally {
                        chatbox.scrollTo(0, chatbox.scrollHeight);
                    }
                }

                const handleChat = () => {
                    userMessage = chatInput.value.trim();
                    if (!userMessage) return;

                    chatInput.value = "";
                    chatInput.style.height = \`\${inputInitHeight}px\`;

                    chatbox.appendChild(createChatLi(userMessage, "outgoing"));
                    chatbox.scrollTo(0, chatbox.scrollHeight);

                    setTimeout(() => {
                        const incomingChatLi = createChatLi("جاري الكتابة...", "incoming");
                        chatbox.appendChild(incomingChatLi);
                        chatbox.scrollTo(0, chatbox.scrollHeight);
                        generateResponse(incomingChatLi);
                    }, 600);
                }

                chatInput.addEventListener("input", () => {
                    chatInput.style.height = \`\${inputInitHeight}px\`;
                    chatInput.style.height = \`\${chatInput.scrollHeight}px\`;
                });

                chatInput.addEventListener("keydown", (e) => {
                    if(e.key === "Enter" && !e.shiftKey && window.innerWidth > 800) {
                        e.preventDefault();
                        handleChat();
                    }
                });

                sendChatBtn.addEventListener("click", handleChat);
                chatbotToggler.addEventListener("click", () => document.body.classList.toggle("show-chatbot"));
            })();
        </script>
        `;

        // حقن كود البوت قبل إغلاق وسم body مباشرة
        if (aiResponse.html.includes('</body>')) {
            aiResponse.html = aiResponse.html.replace('</body>', `${chatbotWidgetCode}</body>`);
        } else {
            aiResponse.html += chatbotWidgetCode;
        }

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
