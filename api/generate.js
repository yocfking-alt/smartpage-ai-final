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

        // استقبال البيانات بما في ذلك الصور المتعددة
        const { 
            productName, productFeatures, productPrice, productCategory,
            targetAudience, designDescription, shippingOption, customShippingPrice, 
            customOffer, productImages, brandLogo 
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
        
        // تحضير قائمة الصور للسلايدر (الرئيسية + الإضافية)
        let sliderImagesInstruction = `   - الشريحة 1 (الرئيسية): <img src="${MAIN_IMG_PLACEHOLDER}" class="slider-img active" data-index="1">`;
        for (let i = 1; i < productImageArray.length && i <= 6; i++) {
            sliderImagesInstruction += `\n   - الشريحة ${i + 1}: <img src="[[PRODUCT_IMAGE_${i + 1}_SRC]]" class="slider-img" data-index="${i + 1}">`;
        }
        const totalImagesCount = Math.min(productImageArray.length, 7) || 1; // حساب العدد الكلي للصور

        // --- CSS مدمج: تعليقات الفيسبوك + ستايل السلايدر الجديد المطابق للصورة ---
        const combinedStyles = `
        <style>
            /* إعدادات المتغيرات والألوان */
            :root { --bg-color: #ffffff; --comment-bg: #f0f2f5; --text-primary: #050505; --text-secondary: #65676b; --blue-link: #216fdb; --line-color: #eaebef; }
            
            /* --- 1. ستايل السلايدر المطابق للصورة المرفقة (Lazzwood Style) --- */
            .product-viewer-container {
                position: relative;
                width: 100%;
                max-width: 500px; /* عرض مناسب للصورة */
                margin: 0 auto 30px auto;
                background-color: #f9f9f9;
                overflow: hidden;
            }
            .slider-wrapper {
                position: relative;
                width: 100%;
                min-height: 400px; /* ارتفاع أولي */
                display: flex;
                align-items: center;
                justify-content: center;
                overflow: hidden;
                background-color: #f4f4f4;
            }
            .slider-img {
                display: none;
                width: 100%;
                height: auto;
                object-fit: contain;
                transition: opacity 0.3s ease;
                cursor: zoom-in;
            }
            .slider-img.active {
                display: block;
                animation: fadeIn 0.4s;
            }
            @keyframes fadeIn { from { opacity: 0.5; } to { opacity: 1; } }

            /* زر التكبير (العدسة) */
            .zoom-btn {
                position: absolute;
                top: 20px;
                left: 20px;
                width: 40px;
                height: 40px;
                background: white;
                border-radius: 50%;
                box-shadow: 0 2px 5px rgba(0,0,0,0.1);
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                z-index: 10;
                border: none;
                font-size: 18px;
                color: #333;
            }

            /* شريط التحكم السفلي (أسهم + عداد) */
            .slider-controls {
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 15px 0;
                gap: 20px;
                background: transparent;
                font-family: 'Times New Roman', serif; /* خط كلاسيكي للأرقام */
            }
            .nav-btn {
                background: none;
                border: none;
                cursor: pointer;
                font-size: 18px;
                color: #666;
                padding: 5px;
                transition: color 0.2s;
            }
            .nav-btn:hover { color: #000; }
            .slide-counter {
                font-size: 16px;
                font-style: italic;
                color: #333;
                letter-spacing: 2px;
            }

            /* مودال التكبير */
            .lightbox-modal {
                display: none;
                position: fixed;
                top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(255,255,255,0.95);
                z-index: 9999;
                justify-content: center;
                align-items: center;
            }
            .lightbox-modal.open { display: flex; }
            .lightbox-img { max-width: 90%; max-height: 90%; }
            .close-lightbox { position: absolute; top: 20px; right: 20px; font-size: 30px; cursor: pointer; }

            /* --- 2. ستايل تعليقات الفيسبوك --- */
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

## 🖼️ **تعليمات السلايدر (أهم جزء):**
**لا تقم بإنشاء صورة رئيسية ثابتة ومعرض منفصل.** بدلاً من ذلك، يجب عليك إنشاء قسم "عارض المنتج" (Product Viewer) يطابق تماماً الهيكل والوظيفة التالية، حيث يتم دمج جميع الصور في مكان واحد مع أزرار تنقل في الأسفل.

### **هيكل HTML الإلزامي لقسم الصور:**
يجب أن تضع هذا الكود في بداية الصفحة (بعد الهيدر) بدلاً من صورة الهيرو التقليدية:

\`\`\`html
<div class="product-viewer-container">
    <button class="zoom-btn" onclick="openLightbox()" aria-label="Zoom Image">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
    </button>

    <div class="slider-wrapper" id="mainSlider">
        ${sliderImagesInstruction}
    </div>

    <div class="slider-controls">
        <button class="nav-btn prev" onclick="changeSlide(-1)">&#10094;</button> <span class="slide-counter" id="slideCounter">1 / ${totalImagesCount}</span>
        <button class="nav-btn next" onclick="changeSlide(1)">&#10095;</button> </div>
</div>

<div id="lightbox" class="lightbox-modal" onclick="closeLightbox()">
    <span class="close-lightbox">&times;</span>
    <img id="lightbox-img" class="lightbox-img" src="">
</div>

<script>
    let currentSlide = 1;
    const totalSlides = ${totalImagesCount};
    
    function changeSlide(direction) {
        currentSlide += direction;
        if (currentSlide > totalSlides) currentSlide = 1;
        if (currentSlide < 1) currentSlide = totalSlides;
        updateSlider();
    }
    
    function updateSlider() {
        // إخفاء الكل وإظهار الحالي
        document.querySelectorAll('.slider-img').forEach(img => {
            img.classList.remove('active');
            if(parseInt(img.dataset.index) === currentSlide) {
                img.classList.add('active');
            }
        });
        // تحديث العداد
        document.getElementById('slideCounter').innerText = currentSlide + ' / ' + totalSlides;
    }

    function openLightbox() {
        const currentImgSrc = document.querySelector('.slider-img.active').src;
        document.getElementById('lightbox-img').src = currentImgSrc;
        document.getElementById('lightbox').classList.add('open');
    }
    
    function closeLightbox() {
        document.getElementById('lightbox').classList.remove('open');
    }
</script>
\`\`\`

---

## 🎯 **باقي متطلبات الصفحة:**

### **1. الشعار:**
- استخدم \`${LOGO_PLACEHOLDER}\` في الهيدر.

### **2. استمارة الطلب (مباشرة بعد السلايدر):**
يجب أن تحتوي على هذا الهيكل الدقيق للحقول باللغة العربية:
<div class="customer-info-box">
  <h3>استمارة الطلب</h3>
  <p>المرجو إدخال معلوماتك الخاصة بك</p>
  <div class="form-group"><label>الإسم الكامل</label><input type="text" placeholder="Nom et prénom" required></div>
  <div class="form-group"><label>رقم الهاتف</label><input type="tel" placeholder="Nombre" required></div>
  <div class="form-group"><label>الولاية</label><input type="text" placeholder="Wilaya" required></div>
  <div class="form-group"><label>البلدية</label><input type="text" placeholder="أدخل بلديتك" required></div>
  <div class="form-group"><label>الموقع / العنوان</label><input type="text" placeholder="أدخل عنوانك بالتفصيل" required></div>
  <div class="price-display"><p>سعر المنتج: ${productPrice} دينار</p></div>
  <button type="submit" class="submit-btn">تأكيد الطلب</button>
</div>

### **3. قسم آراء العملاء (Facebook Style):**
يجب أن يبدو القسم كأنه مأخوذ من نقاش حقيقي على فيسبوك.
- استخدم **الدارجة الجزائرية** و **العربية الفصحى**.
- استخدم \`[[MALE_IMG]]\` و \`[[FEMALE_IMG]]\` للصور الرمزية.
- استخدم كود HTML للتعليق المرفق في الستايل (مع القلوب فقط).

### **4. تنسيق الإخراج:**
أعد كائن JSON فقط:
{
  "html": "سلسلة HTML كاملة",
  "liquid_code": "كود Shopify Liquid",
  "schema": { "name": "Landing Page", "settings": [] }
}

## 🚀 **تعليمات التصميم:**
- حافظ على التصميم نظيفاً جداً (Minimalist) ليتناسب مع ستايل السلايدر الجديد.
- **مهم:** قم بتضمين كود CSS (\`combinedStyles\`) الذي سأزودك به في بداية الـ HTML الناتج.

قم بدمج هذا الـ CSS في بداية الـ HTML الناتج:
${combinedStyles}
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
        // عملية الحقن: استبدال الرموز
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
