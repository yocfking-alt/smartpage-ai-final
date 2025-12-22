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

        const { 
            productName, productFeatures, productPrice, productCategory,
            targetAudience, designDescription, shippingOption, customShippingPrice, 
            customOffer, productImages, brandLogo 
        } = req.body;

        const productImageArray = productImages || [];
        
        const GEMINI_MODEL = 'gemini-2.5-flash'; 
        const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
        
        const shippingText = shippingOption === 'free' ? "شحن مجاني" : `الشحن: ${customShippingPrice}`;
        const offerText = customOffer ? `عرض خاص: ${customOffer}` : "";

        const MAIN_IMG_PLACEHOLDER = "[[PRODUCT_IMAGE_MAIN_SRC]]";
        const LOGO_PLACEHOLDER = "[[BRAND_LOGO_SRC]]";
        
        // تم تحديث الـ Prompt لمنح حرية كاملة في الصور واللهجة
        const prompt = `
Act as a Senior Creative Director, Conversion Expert, and Algerian Market Specialist. 
Analyze this product: ${productName}. 
Category: ${productCategory}. 
Target Audience: ${targetAudience}.
Context/Features: ${productFeatures}.
Price: ${productPrice}. ${shippingText}. ${offerText}.
User Design Request: ${designDescription}.

## 🖼️ **تعليمات الصور:**
- الصورة الرئيسية: \`${MAIN_IMG_PLACEHOLDER}\`
- الشعار: \`${LOGO_PLACEHOLDER}\`
- للصور الإضافية استخدم: \`[[PRODUCT_IMAGE_2_SRC]]\`, \`[[PRODUCT_IMAGE_3_SRC]]\` ...إلخ.

## 🎯 **الهدف:**
إنشاء صفحة هبوط احترافية (Landing Page) موجهة للسوق الجزائري، تركز على الإقناع ورفع معدل التحويل.

## ⚠️ **المتطلبات الهيكلية:**

### **1. قسم الهيرو (Hero Section):**
- عنوان جذاب وقوي.
- زر طلب واضح.
- صورة المنتج بارزة.

### **2. استمارة الطلب (Order Form):**
نفس الحقول القياسية (الاسم، الهاتف، الولاية، البلدية) بتصميم نظيف.

### **3. قسم آراء العملاء (Facebook Style Reviews) - إبداع كامل مطلوب:**
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

### **4. تنسيق الإخراج:**
أعد كائن JSON فقط:
{
  "html": "سلسلة HTML كاملة",
  "liquid_code": "كود Shopify Liquid",
  "schema": { "name": "Landing Page", "settings": [] }
}

## 🚀 **تعليمات إضافية:**
- صمم باقي الصفحة بحرية.
- تأكد من التجاوب مع الجوال.
        `;

        const response = await fetch(GEMINI_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { 
                    responseMimeType: "application/json",
                    temperature: 1.0 // رفع درجة الحرارة لأقصى حد لضمان التنوع والإبداع
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
        // عملية الحقن واستبدال الصور
        // ***************************************************************
        
        const defaultImg = "https://via.placeholder.com/600x600?text=Product+Image";
        const defaultLogo = "https://via.placeholder.com/150x50?text=Logo";

        const finalProductImages = productImageArray.length > 0 ? productImageArray : [defaultImg];
        const finalBrandLogo = brandLogo || defaultLogo;

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
