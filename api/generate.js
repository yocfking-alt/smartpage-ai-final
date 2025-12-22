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

        // التعامل مع الصور المتعددة (نصي للتوافق مع الإصدارات السابقة)
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

### **4. تنسيق الإخراج:**
أعد كائن JSON فقط:
{
  "html": "سلسلة HTML كاملة",
  "liquid_code": "كود Shopify Liquid",
  "schema": { "name": "Landing Page", "settings": [] }
}

## 🚀 **حرية إبداعية كاملة:**
- صمم باقي الصفحة بحرية تامة باستخدام CSS حديث وجذاب
- استخدم تأثيرات hover، transitions، وanimations لجعل الصفحة تفاعلية
- تأكد من أن الصفحة سريعة الاستجابة وتعمل على جميع الأجهزة
- أضف عد تنازلي أقل من ساعتان أنيق يحفز الزائر على الشراء بلون مناسب لصفحة و للمنتج
- أضف أقسام إضافية مثل: مميزات المنتج، ، الأسئلة الشائعة، إلخ
### **. قسم آراء العملاء (Facebook Style Reviews) - إبداع كامل مطلوب:**
أريد تصميم هذا القسم ليشبه **تعليقات فيسبوك** لزيادة المصداقية.

**📝 تعليمات المحتوى (حرية مطلقة):**
1.  **التأليف:** قم بابتكار **4 إلى 6 تعليقات** جديدة تماماً.
2.  **اللهجة:** استخدم **اللهجة الجزائرية (الدارجة)** بكل تنوعاتها. لك الحرية المطلقة في صياغة الجمل (سواء كانت كلمات شوارع، خليط فرنسي-عربي، أو عربية بسيطة). اجعلها تبدو عفوية جداً وطبيعية ونابعة من أشخاص حقيقيين، دون التقيد بأي أمثلة مسبقة.
3.  **المصداقية:** اجعل التعليقات تتحدث عن تجربة الشراء، جودة المنتج، أو التعامل الجيد، بطريقة مقنعة وغير "روبوتية".

**👤 تعليمات صور الأشخاص (Avatars) - منع التكرار:**
- **لا تستخدم روابط صور ثابتة أو مكررة.**
- بدلاً من ذلك، قم بتوليد روابط ديناميكية باستخدام خدمات مثل \`pravatar.cc\` أو \`randomuser.me\` مع إضافة "seed" أو معرف عشوائي في الرابط.
- **مثال للطريقة المطلوبة:** \`https://i.pravatar.cc/150?u=[RANDOM_STRING_HERE]\`
- **القاعدة:** يجب عليك أنت (الذكاء الاصطناعي) وضع سلسلة أحرف وأرقام عشوائية مختلفة في كل رابط صورة (مكان \`u=...\`) لضمان ظهور وجه جديد ومختلف كلياً في كل مرة يتم فيها إنشاء الصفحة.
- تأكد من تطابق الجنس (ذكر/أنثى) مع الاسم الذي اخترته (اختر أسماء جزائرية واقعية).

**🎨 تعليمات التصميم (CSS/HTML):**
استخدم الهيكل التالي لمحاكاة فيسبوك بدقة:

\`\`\`html
<style>
  .fb-comments-section {
      background: #fff;
      padding: 20px;
      max-width: 600px;
      margin: 30px auto;
      direction: rtl;
      font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      border-top: 1px solid #e5e5e5;
  }
  .fb-header-stat { display: flex; justify-content: space-between; margin-bottom: 15px; color: #65676B; font-size: 14px; }
  .fb-comment { display: flex; margin-bottom: 12px; gap: 8px; }
  .fb-avatar { width: 38px; height: 38px; border-radius: 50%; object-fit: cover; cursor: pointer; }
  .fb-content-area { flex: 1; }
  .fb-bubble {
      background-color: #f0f2f5;
      padding: 8px 12px;
      border-radius: 18px;
      display: inline-block;
      position: relative;
  }
  .fb-name { font-weight: 600; font-size: 13px; color: #050505; display: block; margin-bottom: 2px; cursor: pointer; text-decoration: none; }
  .fb-name:hover { text-decoration: underline; }
  .fb-text { font-size: 15px; color: #050505; line-height: 1.35; word-break: break-word; }
  .fb-actions { display: flex; align-items: center; gap: 12px; margin-right: 12px; margin-top: 2px; font-size: 12px; color: #65676B; font-weight: bold; }
  .fb-actions span { cursor: pointer; }
  .fb-actions span:hover { text-decoration: underline; }
  .fb-likes-bubble {
      position: absolute;
      bottom: -10px;
      left: -5px;
      background: #fff;
      border-radius: 10px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.2);
      padding: 2px;
      display: flex;
      align-items: center;
      gap: 3px;
      font-size: 11px;
      color: #65676B;
      font-weight: normal;
  }
  .fb-like-icon-small { background: #1877F2; color: white; border-radius: 50%; width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; padding: 2px; }
</style>

<div class="fb-comments-section">
  <div class="fb-comment">
      <img src="https://i.pravatar.cc/150?u=[GENERATE_RANDOM_STRING_HERE]" class="fb-avatar" alt="User">
      <div class="fb-content-area">
          <div class="fb-bubble">
              <span class="fb-name">[GENERATE_ALGERIAN_NAME]</span>
              <span class="fb-text">[GENERATE_CREATIVE_ALGERIAN_COMMENT]</span>
              </div>
          <div class="fb-actions">
              <span>أعجبني</span> · <span>رد</span> · <span>[RANDOM_TIME: 14د, 2س, 1ي]</span>
          </div>
      </div>
  </div>
  </div>
\`\`\`

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
        // عملية الحقن: استبدال الرموز بالصور الحقيقية (Base64)
        // ***************************************************************
        
        // صور افتراضية في حال لم يرفع المستخدم صوراً
        const defaultImg = "https://via.placeholder.com/600x600?text=Product+Image";
        const defaultLogo = "https://via.placeholder.com/150x50?text=Logo";

        const finalProductImages = productImageArray.length > 0 ? productImageArray : [defaultImg];
        const finalBrandLogo = brandLogo || defaultLogo;

        // دالة للاستبدال الآمن للصور المتعددة
        const replaceImages = (content) => {
            if (!content) return content;
            
            let result = content;
            
            // استبدال الصورة الرئيسية
            result = result.split(MAIN_IMG_PLACEHOLDER).join(finalProductImages[0]);
            
            // استبدال الشعار
            result = result.split(LOGO_PLACEHOLDER).join(finalBrandLogo);
            
            // استبدال الصور الإضافية في المعرض
            for (let i = 1; i < finalProductImages.length && i <= 6; i++) {
                const placeholder = `[[PRODUCT_IMAGE_${i + 1}_SRC]]`;
                result = result.split(placeholder).join(finalProductImages[i]);
            }
            
            return result;
        };

        // تطبيق الاستبدال على HTML و Liquid Code
        aiResponse.html = replaceImages(aiResponse.html);
        aiResponse.liquid_code = replaceImages(aiResponse.liquid_code);

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
