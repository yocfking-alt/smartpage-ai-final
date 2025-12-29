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
        
        // إنشاء نصوص بديلة للصور الإضافية
        let galleryPlaceholders = "";
        for (let i = 1; i < productImageArray.length && i <= 5; i++) {
            galleryPlaceholders += `[[PRODUCT_IMAGE_${i + 1}_SRC]] `;
        }

        // --- CSS الخاص بتعليقات الفيسبوك (تصميم سكرين شوت + قلوب فقط) ---
        const fbStyles = `
        <style>
            :root { --bg-color: #ffffff; --comment-bg: #f0f2f5; --text-primary: #050505; --text-secondary: #65676b; --blue-link: #216fdb; --line-color: #eaebef; }
            
            /* حاوية القسم العام */
            .fb-reviews-section { 
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
                direction: rtl; 
                padding: 20px; 
                background: #f9f9f9; 
                margin-top: 30px; 
                border-top: 1px solid #ddd; 
                text-align: center;
            }

            .fb-reviews-title {
                margin-bottom: 30px;
                font-size: 1.5rem;
                font-weight: bold;
                color: #333;
            }

            /* تصميم السكرين شوت (الصورة الوهمية) */
            .fb-screenshot-card {
                background: #fff;
                max-width: 500px;
                margin: 0 auto 30px auto; /* مسافة بين كل سكرين شوت */
                border: 1px solid #ddd;
                border-radius: 12px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.08); /* ظل خفيف ليبدو كصورة طافية */
                overflow: hidden;
                text-align: right;
                position: relative;
            }

            /* محاكاة شريط الحالة العلوي للفيسبوك (اختياري للواقعية) */
            .fb-fake-header {
                padding: 10px 15px;
                border-bottom: 1px solid #eee;
                font-size: 12px;
                color: #65676b;
                display: flex;
                justify-content: space-between;
                background: #fff;
            }

            .comment-thread { padding: 10px 15px 20px 15px; position: relative; }
            .thread-line-container { position: absolute; right: 40px; top: 15px; bottom: 30px; width: 2px; background-color: var(--line-color); z-index: 0; }
            
            .comment-row { display: flex; align-items: flex-start; margin-bottom: 15px; position: relative; z-index: 1; }
            .avatar { width: 36px; height: 36px; border-radius: 50%; overflow: hidden; margin-left: 10px; flex-shrink: 0; border: 1px solid rgba(0,0,0,0.1); }
            .avatar img { width: 100%; height: 100%; object-fit: cover; }
            .comment-content { display: flex; flex-direction: column; max-width: 88%; }
            .bubble { background-color: var(--comment-bg); padding: 8px 12px; border-radius: 18px; display: inline-block; position: relative; min-width: 120px; }
            .username { font-weight: 600; font-size: 13px; color: var(--text-primary); display: block; margin-bottom: 2px; cursor: pointer; }
            .text { font-size: 14px; color: var(--text-primary); line-height: 1.3; white-space: pre-wrap; }
            .actions { display: flex; gap: 15px; margin-right: 12px; margin-top: 3px; font-size: 12px; color: var(--text-secondary); font-weight: 600; }
            
            /* التفاعلات */
            .reactions-container { position: absolute; bottom: -8px; left: -10px; background-color: white; border-radius: 10px; box-shadow: 0 1px 2px rgba(0,0,0,0.2); padding: 2px 4px; display: flex; align-items: center; height: 18px; z-index: 10; }
            .react-icon { width: 16px; height: 16px; border: 2px solid #fff; border-radius: 50%; }
            .react-count { font-size: 11px; color: var(--text-secondary); margin-left: 4px; margin-right: 2px; }
            
            .view-replies { display: flex; align-items: center; font-weight: 600; font-size: 13px; color: var(--text-primary); margin: 5px 0 15px 0; padding-right: 50px; cursor: pointer; }
            
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

## 🖼️ **تعليمات الصور المتعددة (مهم جداً):**
لقد تم تزويدك بعدة صور للمنتج (${productImageArray.length} صور) وشعار.
**يجب اتباع التعليمات التالية بدقة:**

### **1. الصورة الرئيسية:**
- استخدم هذا النص بالضبط كمصدر للصورة الرئيسية: \`${MAIN_IMG_PLACEHOLDER}\`
- مثال: <img src="${MAIN_IMG_PLACEHOLDER}" alt="${productName}" class="main-product-image">

### **2. معرض الصور الإضافية:**
- أضف قسم معرض صور يظهر الصور الإضافية للمنتج
- استخدم النصوص التالية كمصادر للصور الإضافية:
${productImageArray.length > 1 ? 
  Array.from({length: Math.min(productImageArray.length - 1, 5)}, (_, i) => 
    `  - الصورة ${i + 2}: استخدم \`[[PRODUCT_IMAGE_${i + 2}_SRC]]\``
  ).join('\n') 
  : '  - لا توجد صور إضافية'}
- يمكنك إنشاء سلايدر، شبكة صور، أو معرض تفاعلي
- تأكد من أن المعرض سريع الاستجابة ويعمل جيداً على الجوال

### **3. الشعار:**
- استخدم هذا النص بالضبط كمصدر للشعار: \`${LOGO_PLACEHOLDER}\`
- مثال: <img src="${LOGO_PLACEHOLDER}" alt="شعار العلامة التجارية" class="logo">

## 🎯 **الهدف:**
إنشاء صفحة هبوط فريدة ومبدعة تحتوي على جميع الصور المقدمة وتحقق أعلى معدلات التحويل.

## ⚠️ **متطلبات إلزامية:**

### **1. قسم الهيرو:**
- يتضمن الشعار (استخدم \`${LOGO_PLACEHOLDER}\`) في الأعلى أو في الهيدر
- صورة المنتج الرئيسية (استخدم \`${MAIN_IMG_PLACEHOLDER}\`) يجب أن تكون بارزة جداً
- إذا كان هناك أكثر من صورة، أضف أزرار تنقل بين الصور أو معرض مصغر

### **2. معرض الصور (إذا كان هناك أكثر من صورة):**
- قم بإنشاء قسم مخصص لعرض جميع صور المنتج
- استخدم تقنيات CSS/JS حديثة لعرض المعرض (مثل grid، flexbox، أو سلايدر)
- تأكد من أن الصور معروضة بشكل جميل ومنظم

### **3. استمارة الطلب (مباشرة بعد الهيرو):**
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
  
  <div class="price-display">
    <p>سعر المنتج: ${productPrice} دينار</p>
  </div>
  
  <button type="submit" class="submit-btn">تأكيد الطلب</button>
</div>

### **4. قسم آراء العملاء (تصميم 3-5 لقطات شاشة - Facebook Style):**
بدلاً من قائمة واحدة طويلة، يجب عليك إنشاء **3 إلى 5 "بطاقات" منفصلة** (Screenshots). كل بطاقة تمثل لقطة شاشة مستقلة لهاتف محمول تعرض نقاشاً مختلفاً.

**الهيكل المطلوب لهذا القسم:**
1. العنوان: \`<h3>ماذا يقول عملاؤنا</h3>\`
2. التكرار: قم بتوليد **من 3 إلى 5** كتل \`div\` منفصلة، كل واحدة بالكلاس \`fb-screenshot-card\`.
3. داخل كل \`fb-screenshot-card\` ضع **3 إلى 5 تعليقات مختلفة**.

**تفاصيل كل بطاقة (Screenshot):**
- استخدم الكلاس \`fb-screenshot-card\`.
- **المحتوى:** محادثة فريدة (3-5 تعليقات) تمزج بين الدارجة الجزائرية (مثل: "هايلة"، "يعطيكم الصحة"، "وصلتني روعة") والعربية.
- **الصور:**
   - للذكور: استخدم \`[[MALE_IMG]]\`.
   - للإناث: استخدم \`[[FEMALE_IMG]]\`.
- **التفاعل (قلوب فقط ❤️):** استخدم \`<div class="react-icon icon-love"></div>\` فقط.
- **التنسيق:** يجب أن تبدو كل بطاقة كسكرين شوت منفصلة تماماً (استخدم CSS المرفق).

**مثال لهيكل بطاقة سكرين شوت واحدة (كرر هذا الكود 3-5 مرات ببيانات مختلفة):**
\`\`\`html
<div class="fb-screenshot-card">
    <div class="fb-fake-header">التعليقات الأكثر ملاءمة ▾</div>
    <div class="comment-thread">
        <div class="thread-line-container"></div>
        
        <div class="comment-row">
            <div class="avatar"><img src="[[FEMALE_IMG]]" alt="User"></div>
            <div class="comment-content">
                <div class="bubble">
                    <span class="username">سارة القسنطينية</span>
                    <span class="text">منتج في القمة شكرا لكم على المصداقية</span>
                    <div class="reactions-container">
                        <div class="react-icon icon-love"></div> <span class="react-count">45</span>
                    </div>
                </div>
                <div class="actions">
                    <span class="time">2 س</span>
                    <span class="action-link">أعجبني</span>
                    <span class="action-link">رد</span>
                </div>
            </div>
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
- أضف عد تنازلي أقل من ساعتان.
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
