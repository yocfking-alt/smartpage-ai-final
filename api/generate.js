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

        // استقبال البيانات بما في ذلك الصور المتعددة والمتغيرات الجديدة
        const { 
            productName, productFeatures, productPrice, productCategory,
            targetAudience, designDescription, shippingOption, customShippingPrice, 
            customOffer, productImages, brandLogo, variants // <-- تم إضافة variants هنا
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
        
        // --- تحضير شرائح السلايدر ---
        let sliderSlidesHTML = `   <img src="${MAIN_IMG_PLACEHOLDER}" class="slider-img active" data-index="1">`;
        for (let i = 1; i < productImageArray.length && i <= 6; i++) {
            sliderSlidesHTML += `\n   <img src="[[PRODUCT_IMAGE_${i + 1}_SRC]]" class="slider-img" data-index="${i + 1}">`;
        }
        const totalSlidesCount = Math.max(productImageArray.length, 1);

        // --- تحضير وصف المتغيرات (Variants) للبرومبت ---
        let variantsInstruction = "";
        let hasVariants = false;

        if (variants && (variants.colors.enabled || variants.sizes.enabled)) {
            hasVariants = true;
            variantsInstruction += `\n### **تعليمات المتغيرات (Variants Logic):**\n`;
            variantsInstruction += `يحتوي هذا المنتج على خيارات متقدمة. يجب عليك إنشاء منطق JS و HTML للتعامل معها بدقة:\n`;
            
            if (variants.colors.enabled) {
                variantsInstruction += `**1. الألوان (Colors):**\n`;
                variantsInstruction += `أنشئ "Color Swatches" (دوائر ملونة) للاختيارات التالية:\n`;
                variants.colors.items.forEach((col, idx) => {
                    // تحديد مؤشر الصورة المرتبطة (مع مراعاة أن الصورة الرئيسية هي 1)
                    let targetSlide = col.imgIndex !== "" ? parseInt(col.imgIndex) + 1 : null; 
                    variantsInstruction += `- لون: ${col.name} (Hex: ${col.hex}) ${targetSlide ? `-> عند النقر عليه، يجب أن ينتقل السلايدر فوراً للشريحة رقم ${targetSlide}` : ""}\n`;
                });
            }

            if (variants.sizes.enabled) {
                variantsInstruction += `**2. المقاسات (Sizes):**\n`;
                variantsInstruction += `أنشئ أزرار اختيار للمقاسات التالية: ${variants.sizes.items.map(s => s.name).join(', ')}\n`;
            }

            variantsInstruction += `**3. السعر والكمية:**\n`;
            variantsInstruction += `- أضف عداد للكمية (+/-).\n`;
            variantsInstruction += `- السعر الأساسي هو: ${productPrice}.\n`;
            variantsInstruction += `- يجب تحديث "السعر الإجمالي" تلقائياً عند تغيير الكمية (السعر × الكمية).\n`;
        }

        // --- CSS المدمج ---
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

            /* --- 2. ستايل تعليقات الفيسبوك الأصلي --- */
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
            
            /* --- 3. ستايل المتغيرات (Variants Styles) --- */
            .variants-section { margin-bottom: 20px; padding: 15px; border: 1px solid #eee; border-radius: 8px; background: #fff; }
            .variant-title { font-weight: bold; margin-bottom: 8px; display: block; }
            .color-options { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 15px; }
            .color-swatch { width: 35px; height: 35px; border-radius: 50%; cursor: pointer; border: 2px solid #ddd; transition: all 0.2s; position: relative; }
            .color-swatch.active { border-color: #333; transform: scale(1.1); box-shadow: 0 2px 5px rgba(0,0,0,0.2); }
            .color-swatch.active::after { content: '✔'; color: white; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 14px; text-shadow: 0 0 2px rgba(0,0,0,0.5); }
            .size-options { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 15px; }
            .size-btn { padding: 8px 16px; border: 1px solid #ddd; background: white; cursor: pointer; border-radius: 4px; transition: all 0.2s; }
            .size-btn.active { background: #000; color: white; border-color: #000; }
            .quantity-selector { display: flex; align-items: center; gap: 0; border: 1px solid #ddd; border-radius: 4px; width: fit-content; }
            .qty-btn { padding: 8px 15px; background: #f9f9f9; border: none; cursor: pointer; font-size: 18px; }
            .qty-btn:hover { background: #eee; }
            .qty-input { width: 50px; text-align: center; border: none; border-left: 1px solid #ddd; border-right: 1px solid #ddd; height: 100%; font-weight: bold; }
            .total-price-box { margin-top: 15px; padding: 10px; background: #f0fdf4; border: 1px solid #dcfce7; border-radius: 6px; text-align: center; font-weight: bold; color: #166534; font-size: 1.1em; }
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

${variantsInstruction}

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

<script>
    let currentSlide = 1; const totalSlides = ${totalSlidesCount};
    function changeSlide(d) { currentSlide += d; if (currentSlide > totalSlides) currentSlide = 1; if (currentSlide < 1) currentSlide = totalSlides; updateSlider(); }
    
    // دالة جديدة للانتقال المباشر لشريحة محددة (لربط الألوان بالصور)
    function goToSlide(index) {
        if(index >= 1 && index <= totalSlides) {
            currentSlide = index;
            updateSlider();
        }
    }

    function updateSlider() { 
        document.querySelectorAll('.slider-img').forEach(img => { img.classList.remove('active'); if(parseInt(img.dataset.index) === currentSlide) img.classList.add('active'); });
        document.getElementById('slideCounter').innerText = currentSlide + ' / ' + totalSlides; 
    }
    function openLightbox() { document.getElementById('lightbox-img').src = document.querySelector('.slider-img.active').src; document.getElementById('lightbox').classList.add('open'); }
    function closeLightbox() { document.getElementById('lightbox').classList.remove('open'); }
</script>
\`\`\`

### **2. الشعار:**
- استخدم هذا النص بالضبط كمصدر للشعار: \`${LOGO_PLACEHOLDER}\`

## ⚠️ **متطلبات إلزامية لاستمارة الطلب (Order Form):**
يجب أن تحتوي الاستمارة على هذا الهيكل الدقيق للحقول باللغة العربية، **مع دمج خيارات المتغيرات الجديدة (Variants) بداخلها**:

\`\`\`html
<div class="customer-info-box">
  <h3>استمارة الطلب</h3>
  <p>المرجو إدخال معلوماتك الخاصة بك</p>
  
  <div class="variants-section">
    ${variants && variants.colors.enabled ? `
    <label class="variant-title">اختر اللون:</label>
    <div class="color-options" id="color-selector">
        </div>
    <input type="hidden" id="selected-color" name="color">
    ` : ''}

    ${variants && variants.sizes.enabled ? `
    <label class="variant-title">اختر المقاس:</label>
    <div class="size-options" id="size-selector">
        </div>
    <input type="hidden" id="selected-size" name="size">
    ` : ''}

    <label class="variant-title">الكمية:</label>
    <div class="quantity-selector">
        <button type="button" class="qty-btn" onclick="updateQty(-1)">-</button>
        <input type="text" id="quantity-input" value="1" readonly class="qty-input">
        <button type="button" class="qty-btn" onclick="updateQty(1)">+</button>
    </div>
  </div>

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
  
  <div class="total-price-box">
    المجموع: <span id="total-price-display">${productPrice}</span> دينار
  </div>
  
  <button type="submit" class="submit-btn">تأكيد الطلب</button>
</div>

<script>
    let basePrice = ${parseFloat(productPrice) || 0};
    let currentQty = 1;

    function updateQty(change) {
        let newQty = currentQty + change;
        if(newQty < 1) newQty = 1;
        currentQty = newQty;
        document.getElementById('quantity-input').value = currentQty;
        updateTotalPrice();
    }

    function updateTotalPrice() {
        let total = basePrice * currentQty;
        document.getElementById('total-price-display').innerText = total.toFixed(2);
    }

    // دوال اختيار اللون والمقاس (يرجى كتابتها بالكامل)
    // عند اختيار لون له صورة مرتبطة، استدعِ goToSlide(index)
</script>
\`\`\`

### **3. قسم آراء العملاء (Facebook Style):**
يجب أن يبدو القسم كأنه مأخوذ (Screenshot) من نقاش حقيقي على فيسبوك حول المنتج.
1. **التصميم:** استخدم أكواد CSS المرفقة في المتغير \`fbStyles\`.
2. **المحتوى:** أنشئ 3-5 تعليقات واقعية جداً.
   - امزج بين **الدارجة الجزائرية** و **العربية الفصحى البسيطة**.
3. **الصور والأسماء:**
   - **للذكور:** استخدم الرمز \`[[MALE_IMG]]\` في \`src\`.
   - **للإناث:** استخدم الرمز \`[[FEMALE_IMG]]\` في \`src\`.
4. **التفاعل (القلب فقط ❤️):**
   - استخدم حصراً أيقونة القلب (\`icon-love\`).

### **4. تنسيق الإخراج:**
أعد كائن JSON فقط:
{
  "html": "سلسلة HTML كاملة",
  "liquid_code": "كود Shopify Liquid",
  "schema": { "name": "Landing Page", "settings": [] }
}

## 🚀 **تعليمات نهائية:**
- صمم باقي الصفحة بحرية تامة.
- أضف عد تنازلي.
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
