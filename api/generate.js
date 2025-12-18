// api/generate.js
import fetch from 'node-fetch'; 

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        if (!GEMINI_API_KEY) {
            return res.status(500).json({ error: 'GEMINI_API_KEY is not set in Vercel Environment Variables' });
        }

        const { 
            productName, 
            productFeatures, 
            designDescription,
            productPrice,
            productCategory,
            targetAudience,
            shippingOption,
            customShippingPrice,
            customOffer
        } = req.body;

        if (!productName || !productFeatures) {
            return res.status(400).json({ error: 'Missing productName or productFeatures' });
        }

        const GEMINI_MODEL = 'gemini-2.5-flash'; 
        const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
        
        // **********************************************
        // * PROMPT الجديد - إبداعي بدون قيود *
        // **********************************************
        const prompt = `أنت الآن مدير إبداعي في وكالة إعلانات حائزة على جوائز. فريقك:

## 👥 الفريق الإبداعي:
1. **كاتب إعلانات محترف** - متخصص في الكتابة العاطفية
2. **مصمم جرافيك متميز** - خبير في نظرية الألوان
3. **مسوق رقمي مخضرم** - خبير في تحويل الزوار لعملاء
4. **مطور واجهات محترف** - خبير في تجربة المستخدم

## 🎯 المهمة:
أنشئ صفحة هبوط لـ **${productName}** (${productCategory})

## 📊 بيانات المشروع:
**الجمهور المستهدف:** ${targetAudience}
**الميزات الرئيسية:** ${productFeatures}
**السعر:** ${productPrice}
${designDescription ? `**ملاحظات التصميم:** ${designDescription}` : ''}
${customOffer ? `**العرض الترويجي:** ${customOffer}` : ''}
${shippingOption === 'free' ? '**الشحن:** مجاني' : customShippingPrice ? `**الشحن:** ${customShippingPrice}` : ''}

## 🧠 عملية العمل:
### المرحلة 1: البحث والتحليل
- تحليل ${targetAudience} وما يهمهم فعلياً
- فهم المشاعر والاحتياجات العميقة
- تحديد ما يجعل ${productName} فريداً حقاً

### المرحلة 2: الإبداع
- اختر نظام ألوان مبتكر يعكس شخصية ${productName}
- اكتب عنواناً لا ينسى يلخص الفائدة العاطفية
- صمم هيكلاً يحكي قصة المنتج بطريقة غير تقليدية
- اختر أيقونات ورموز تعبر عن ${productFeatures} بذكاء

### المرحلة 3: البناء
- HTML5 مع CSS داخلي متقدم
- تأثيرات بصرية ذكية تعزز الرسالة
- تخطيط يركز على مسار التحويل الطبيعي
- تصميم متجاوب مع جميع الأجهزة

## 📋 المخرجات المطلوبة:
أنشئ لي:
1. كود Liquid كامل لـ Shopify
2. Schema مع إعدادات قابلة للتعديل
3. صفحة HTML للمعاينة (بجودة وكالة إعلانية مبدعة)

أرجع الناتج كـ JSON بالشكل التالي:
{
  "liquid_code": "كود Liquid متكامل مع إعدادات",
  "schema": {"name": "section-name", "settings": []},
  "html_preview": "صفحة HTML كاملة بجودة وكالة إعلانية"
}

## ⚡ قواعد الجودة:
1. لا تكرر نفس التصميم مرتين - كل منتج فريد
2. اختر ألواناً مبتكرة تناسب طبيعة ${productName} وليس مجرد فئته
3. النصوص تخاطب العاطفة قبل المنطق
4. التصميم يبدأ من "لماذا يشتري العميل" وليس "ماذا يبيع المنتج"
5. استخدم لغة عربية فصيحة وجذابة
6. أضف عناصر بناء الثقة (شهادات، ضمانات)
7. ركز على نقاط التحويل الحرجة

**لا تتبع قوالب جاهزة. فكر خارج الصندوق. ابتكر. أدهشني.**`;

        const geminiBody = {
            contents: [{
                parts: [{ text: prompt }]
            }],
            generationConfig: {
                responseMimeType: "application/json"
            }
        };

        const response = await fetch(GEMINI_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(geminiBody),
        });

        const rawData = await response.text();
        let data;
        
        try {
            data = JSON.parse(rawData);
        } catch (e) {
            console.error('Failed parsing AI response:', rawData.substring(0, 200));
            return res.status(500).json({ error: 'AI returned non-JSON data. Please try again.' });
        }

        if (!response.ok) {
            const errorMessage = data.error?.message || `Gemini API error: ${response.status}`;
            console.error('Gemini API Error:', errorMessage);
            return res.status(500).json({ error: 'Failed to generate page: ' + errorMessage });
        }
        
        const generatedContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!generatedContent || typeof generatedContent !== 'string') {
            console.error('AI returned no valid text content');
            return res.status(500).json({ 
                error: 'AI failed to return valid content. Check your GEMINI_API_KEY in Vercel.'
            });
        }

        let parsedSection;
        try {
            const cleanContent = generatedContent.replace(/```json\s*|```/g, '').trim();
            parsedSection = JSON.parse(cleanContent);
        } catch (e) {
            console.error('Failed to parse AI JSON:', e.message);
            console.error('AI Response:', generatedContent.substring(0, 500));
            return res.status(500).json({ error: 'AI output format error. Could not parse JSON response.' });
        }

        // التحقق من وجود الحقول الأساسية
        if (!parsedSection.liquid_code) {
            console.error('AI did not generate liquid_code');
            return res.status(500).json({ error: 'AI did not generate required liquid_code.' });
        }

        // استخدام html_preview إذا وجد، وإلا استخدام liquid_code
        const previewHTML = parsedSection.html_preview || parsedSection.liquid_code;

        // إرجاع البيانات بنفس الهيكل الذي يتوقعه builder.html
        res.status(200).json({
            liquid_code: parsedSection.liquid_code,
            schema: parsedSection.schema || { 
                name: "smartpage-section", 
                settings: [
                    {
                        "type": "text",
                        "id": "heading",
                        "label": "العنوان الرئيسي",
                        "default": productName
                    },
                    {
                        "type": "richtext",
                        "id": "description",
                        "label": "الوصف",
                        "default": productFeatures
                    }
                ] 
            },
            html: previewHTML
        });

    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ error: 'Internal Server Error. Please check Vercel logs.' });
    }
}
