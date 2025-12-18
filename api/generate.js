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
        // * PROMPT الذكي الذي يجعل AI يفكر كفريق إبداعي *
        // **********************************************
        const prompt = `

أنت الآن مدير إبداعي في وكالة إعلانات متكاملة.

## 📊 بيانات المشروع:
**المنتج:** ${productName}
**الفئة:** ${productCategory}
**الجمهور المستهدف:** ${targetAudience}
**الميزات الرئيسية:** ${productFeatures}
**السعر:** ${productPrice}
${designDescription ? `**ملاحظات التصميم:** ${designDescription}` : ''}
${customOffer ? `**عرض ترويجي:** ${customOffer}` : ''}
${shippingOption === 'free' ? '**الشحن:** مجاني' : customShippingPrice ? `**الشحن:** ${customShippingPrice}` : ''}

## 🧠 مهمتك:
أنشئ صفحة هبوط عالية التحويل يجب أن تحتوي على:

### 1. تصميم فريد يناسب ${productCategory}
- ألوان مبتكرة تناسب الفئة
- تخطيط يجذب الانتباه
- صور وأيقونات مناسبة

### 2. نصوص تسويقية احترافية
- عنوان رئيسي جذاب
- وصف مقنع للمنتج
- نقاط بيع واضحة
- نداء للعمل مؤثر

### 3. هيكل تقني سليم
- HTML5 نظيف
- CSS داخلي متجاوب
- تأثيرات بسيطة وجذابة

## 📤 المطلوب منك:
أنشئ لي كود Shopify Liquid كامل مع Schema مناسب، وصفحة HTML للمعاينة.

أرجع الناتج كـ JSON بالشكل التالي:
{
  "liquid_code": "كود Liquid الكامل لـ Shopify",
  "schema": {"name": "main-section", "settings": []},
  "html_preview": "كود HTML كامل للمعاينة"
}

## ⚡ قواعد مهمة:
- لا تكرر التصميم! كل منتج يجب أن يكون له تصميم فريد
- الألوان يجب أن تعكس طبيعة ${productCategory}
- النصوص يجب أن تخاطب ${targetAudience}
- التصميم يجب أن يكون متجاوبًا مع جميع الأجهزة

**ابدأ الآن.**
`;

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
            schema: parsedSection.schema || { name: "smartpage-section", settings: [] },
            html: previewHTML
        });

    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ error: 'Internal Server Error. Please check Vercel logs.' });
    }
}
