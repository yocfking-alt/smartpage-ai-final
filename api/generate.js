[file name]: generate.js
[file content begin]
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

        // استقبال البيانات من الواجهة الأمامية
        const { 
            productName, productFeatures, productPrice, productCategory,
            targetAudience, designDescription, shippingOption, customShippingPrice, customOffer,
            productImageBase64, brandImageBase64
        } = req.body;

        // التحقق من وجود صورة المنتج
        if (!productImageBase64) {
            return res.status(400).json({ error: 'Product image is required' });
        }

        // استخدام الموديل المستقر والسريع
        const GEMINI_MODEL = 'gemini-2.5-flash'; 
        const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
        
        // بناء النصوص الخاصة بالشحن والعرض
        const shippingText = shippingOption === 'free' ? "شحن مجاني" : `الشحن: ${customShippingPrice}`;
        const offerText = customOffer ? `عرض خاص: ${customOffer}` : "";

        // *****************************************************************
        // الـ Prompt الجديد مع دمج الصور
        // *****************************************************************
        const prompt = `
Act as a Senior Creative Director and Conversion Expert. 
Analyze this product: ${productName}. 
Category: ${productCategory}. 
Target Audience: ${targetAudience}.
Context/Features: ${productFeatures}.
Price: ${productPrice}. ${shippingText}. ${offerText}.
User Design Request: ${designDescription}.

## 🎯 **الهدف:**
إنشاء صفحة هبوط فريدة ومبدعة لتحقيق أعلى معدلات التحويل.

## 🖼️ **الصور المرفوعة:**
1. **صورة المنتج:** تم رفع صورة المنتج وسيتم تضمينها مباشرة في HTML.
2. **شعار البراند:** ${brandImageBase64 ? 'تم رفع شعار البراند وسيتم تضمينه' : 'لم يتم رفع شعار براند'}.

## ⚠️ **متطلبات إلزامية (يجب اتباعها بدقة):**

### **1. قسم الهيرو (القسم الأول والأساسي):**
- يجب أن يكون أول قسم يراه المستخدم
- يتضمن: عنوان إبداعي (H1) + وصف ثانوي + زر دعوة رئيسي
- **يجب تضمين صورة المنتج المرفوعة في هذا القسم بشكل بارز**
- ${brandImageBase64 ? 'يجب تضمين شعار البراند في الهيدر أو الهيرو' : ''}
- التصميم: استخدام تأثيرات CSS متقدمة (glassmorphism, animations, gradients, etc.)

### **2. استمارة الطلب (مباشرة بعد الهيرو):**
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
    <!-- ملاحظة: لا تستخدم قائمة منسدلة select، استخدم input نصي فقط -->
  </div>
  
  <div class="form-group">
    <label>البلدية</label>
    <input type="text" placeholder="أدخل بلديتك" required>
    <!-- ملاحظة: لا تستخدم قائمة منسدلة select، استخدم input نصي فقط -->
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

### **3. تنسيق الإخراج - حاسم (يجب أن يكون دقيقًا):**
يجب أن تعيد كائن JSON صارمًا يحتوي على هذه المفاتيح الثلاثة فقط:
{
  "html": "سلسلة HTML كاملة تحتوي على <style> في الرأس و<body> للمحتوى",
  "liquid_code": "كود قالب Shopify Liquid (بدون {% schema %})",
  "schema": {
    "name": "Landing Page",
    "settings": [
      // إنشاء الإعدادات المناسبة هنا
    ]
  }
}

## 📸 **تعليمات خاصة بالصور:**
- استخدم الصورة المرفوعة للمنتج كصورة رئيسية
- ${brandImageBase64 ? 'استخدم شعار البراند المرفوع في المكان المناسب' : 'لا داعي لشعار براند'}
- تأكد من أن الصور تظهر بشكل واضح وجذاب
- استخدم CSS لجعل الصور متجاوبة مع جميع الشاشات

## 🚀 **حرية إبداعية كاملة (للباقي من الصفحة):**
بعد الأقسام المطلوبة أعلاه، لديك 100% حرية إبداعية:
- أنشئ أي عدد من الأقسام الفريدة
- استخدم أي أنماط تخطيط وتصميم (parallax, 3D, interactive, etc.)
- فاجئني بمحفزات نفسية مبتكرة
- لا توجد قيود على ترتيب أو محتوى الأقسام
- كسر الأنماط التقليدية لتحقيق تحويل أفضل

## 🎨 **إرشادات التصميم (ليست قيودًا):**
- استخدم أيقونات FontAwesome 6
- اكتب CSS مخصص (بدون قوالب)
- تصميم متجاوب بالكامل للهاتف المحمول
- CSS حديث (Grid, Flexbox, CSS Variables)
- فكر في سيكولوجية الألوان المناسبة للمنتج

## 🔧 **ملاحظات تقنية:**
- مفتاح \`html\`: للمعاينة الحية (HTML كامل وقائم بذاته)
- مفتاح \`liquid_code\`: لـShopify (استخدم صيغة Liquid مثل {{ product.title }})
- مفتاح \`schema\>: إعدادات لمحرر قوالب Shopify
- أعد فقط كائن JSON، بدون أي نص إضافي

**تذكر:** فقط هيكل الهيرو، حقول استمارة الطلب، وتنسيق الإخراج ثابتة. كل شيء آخر يجب أن يكون مبدعًا وفريدًا في كل مرة!
        `;

        const response = await fetch(GEMINI_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { 
                    responseMimeType: "application/json", 
                    temperature: 0.95,
                    topP: 0.95,
                    topK: 40
                }
            })
        });

        const data = await response.json();

        // معالجة الأخطاء من Gemini
        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
            console.error("Gemini Error:", data);
            throw new Error('Failed to generate content from AI');
        }

        const aiResponseText = data.candidates[0].content.parts[0].text;
        
        // تنظيف النص من علامات Markdown
        const cleanedText = aiResponseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const aiResponse = JSON.parse(cleanedText);

        // استبدال الصور في HTML الناتج
        let finalHtml = aiResponse.html;
        
        // استبدال العلامات الخاصة بالصور إذا وجدت
        if (finalHtml.includes('{{product_image}}')) {
            finalHtml = finalHtml.replace(/{{product_image}}/g, productImageBase64);
        }
        
        if (brandImageBase64 && finalHtml.includes('{{brand_image}}')) {
            finalHtml = finalHtml.replace(/{{brand_image}}/g, brandImageBase64);
        }
        
        // إضافة الصور مباشرة إذا لم تكن هناك علامات
        if (productImageBase64 && !finalHtml.includes(productImageBase64)) {
            // إضافة صورة المنتج في مكان مناسب
            finalHtml = finalHtml.replace(
                /<body[^>]*>/i, 
                `$&<div style="display:none;" id="uploaded-product-image">
                    <img src="${productImageBase64}" alt="${productName}" />
                 </div>`
            );
        }

        // إرسال النتيجة مع HTML المعدل
        res.status(200).json({
            liquid_code: aiResponse.liquid_code,
            schema: aiResponse.schema,
            html: finalHtml
        });

    } catch (error) {
        console.error("Server Error:", error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
}
[file content end]
