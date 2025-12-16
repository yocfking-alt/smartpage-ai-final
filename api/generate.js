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
        
        // ***************************************************************
        // * التوجيه الحاسم: نموذج خبير تسويق وتوليد كود (CRO & Coding) *
        // ***************************************************************
        const prompt = `
            أنت مطور Shopify خبير ومتخصص في إنشاء أكواد Liquid Sections ذات تحويل عالٍ جدًا وتصميم جذاب واحترافي. 
            يجب أن تتصرف كخبير في زيادة معدلات التحويل (CRO Expert) لتعويض ضعف وصف المستخدم البسيط.

            **مهمتك:** إنشاء كود Shopify Section كامل (باستخدام HTML و CSS فقط، وبعض أكواد JavaScript البسيطة للمؤقت إذا لزم الأمر).

            **1. تحليل وتضخيم الوصف (Expansion & Marketing Strategy):**
            * **اسم المنتج:** ${productName}
            * **الميزات الأساسية:** ${productFeatures} (استخدمها لتوليد فوائد قوية ومقنعة).
            * **الوصف البسيط للتصميم:** ${designDescription} (تجاهل بساطته وركز على الجودة).
            * **الفئة:** ${productCategory}
            * **السعر الأساسي:** ${productPrice}
            * **الجمهور المستهدف:** ${targetAudience}

            **2. العناصر الإلزامية لزيادة التحويل:**
            يجب أن تحتوي الصفحة على الأقسام التالية مع التركيز على التجاوبية (Responsive Design) والتصميم الحديث:
            * **[Hero Section]:** عنوان رئيسي قوي، ونص فرعي، وزر دعوة لاتخاذ إجراء (CTA) بارز يرسل الزائر إلى سلة التسوق.
            * **[Scarcity Bar]:** شريط علوي جذاب للإشعار بخصم أو عرض محدود المدة.
            * **[Countdown Timer]:** مؤقت عد تنازلي وهمي (يُعاد تعيينه كل 60 دقيقة مثلاً) لإنشاء إحساس بالندرة. يجب أن يكون المؤقت بتنسيق ساعة/دقيقة/ثانية.
            * **[Benefits Cards]:** بطاقات تعرض 4 إلى 6 فوائد (وليست مجرد ميزات) باستخدام أيقونات جذابة ومحتوى مصاغ بأسلوب إقناعي.
            * **[Social Proof]:** قسم مخصص لـ 3 آراء عملاء وهمية لكنها واقعية ومقنعة.
            * **[Final CTA]:** زر دعوة لاتخاذ إجراء (CTA) كبير ونابض في أسفل الصفحة.

            **3. توجيهات التصميم والكود (Design & Code Directives):**
            * **النمط:** تصميم متجاوب وعصري، يعكس جودة الأسلوب المرفق سابقاً (صفحة مجفف الشعر).
            * **الخط:** استخدم خط **Tajawal** عبر رابط Google Fonts في الكود.
            * **اللغة:** يجب أن يكون الكود والعناصر والمحتوى كله **باللغة العربية (dir="rtl")**.
            * **الألوان:** استخدم ألواناً حديثة تتناسب مع المنتج (مثل ألوان الإثارة والاحترافية).
            * **التأثيرات:** استخدم CSS Animations و Transitions لتأثيرات حركة خفيفة على الأقسام والـ CTA عند الظهور أو التفاعل لزيادة الجاذبية.

            **الناتج المطلوب:**
            * **يجب أن يكون الإخراج كود Liquid Section الكامل والمحسن فقط.**
            * **لا تقم بكتابة أي مقدمة أو شرح أو تعليقات قبل أو بعد الكود.**
            * **تأكد من أن الكود يحتوي على الإعدادات (Schema Settings) الأساسية ليكون قابلاً للتعديل في Shopify Customizer.**
            
            **أبدأ الآن بتوليد كود Shopify Section المحسن والجاهز للتحويل.**
            `;

        const response = await fetch(GEMINI_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                config: {
                    // زيادة درجة الحرارة لتعزيز الإبداع والتصميم
                    temperature: 0.8,
                },
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Gemini API Error:', errorText);
            return res.status(response.status).json({ error: 'Failed to generate content from Gemini API', details: errorText });
        }

        const data = await response.json();
        
        // استخراج النص النظيف الذي يمثل كود الـ Liquid Section
        let generatedCode = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        // تنظيف الكود من أي علامات Markdown قديمة (مثل ```liquid)
        generatedCode = generatedCode.replace(/```(liquid|html|javascript|css)?\s*|```/gs, '').trim();

        // يجب أن نرسل الكود النظيف فقط للـ API الذي يليه
        const parsedSection = {
            section_code: generatedCode
        };

        // *************************************************************
        // * بناء كود HTML للمعاينة (استخدم البيانات الأساسية للعرض) *
        // *************************************************************
        // ملاحظة: هذا الكود للمعاينة فقط، ولا يمثل بالضرورة جودة الكود المُنشأ بواسطة Gemini
        const previewHTML = `
            <!DOCTYPE html>
            <html lang="ar" dir="rtl">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>معاينة صفحة الهبوط | ${productName}</title>
                <link href="[https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap](https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap)" rel="stylesheet">
                <link rel="stylesheet" href="[https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css](https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css)">
                <style>
                    body { 
                        font-family: 'Tajawal', sans-serif; 
                        background-color: #f5f7fa; 
                        color: #333;
                        direction: rtl; 
                        line-height: 1.6;
                        margin: 0;
                        padding: 0;
                    }
                    .preview-container {
                        max-width: 800px;
                        margin: 20px auto;
                        padding: 20px;
                        border-radius: 12px;
                        box-shadow: 0 4px 20px rgba(0,0,0,0.1);
                        background-color: white;
                    }
                    .header-title {
                        color: #1a73e8; /* لون جذاب */
                        border-bottom: 3px solid #ffcc00;
                        padding-bottom: 10px;
                        margin-bottom: 20px;
                        text-align: center;
                    }
                    .section-block {
                        background-color: #fff;
                        padding: 25px;
                        margin-bottom: 20px;
                        border-radius: 8px;
                        border: 1px solid #eee;
                    }
                    .cta-button {
                        display: block;
                        width: 90%;
                        margin: 20px auto;
                        padding: 15px;
                        background-color: #e53e3e; /* أحمر للتحفيز */
                        color: white;
                        text-align: center;
                        font-size: 1.2rem;
                        font-weight: 700;
                        border-radius: 30px;
                        text-decoration: none;
                        transition: background-color 0.3s;
                        box-shadow: 0 4px 10px rgba(229, 62, 62, 0.4);
                        animation: pulse 1.5s infinite; /* تأثير النبض */
                    }
                    @keyframes pulse {
                        0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(229, 62, 62, 0.7); }
                        70% { transform: scale(1.03); box-shadow: 0 0 0 10px rgba(229, 62, 62, 0); }
                        100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(229, 62, 62, 0); }
                    }
                </style>
            </head>
            <body>
                <div class="preview-container">
                    <h1 class="header-title">معاينة: ${productName} (التحويل العالي)</h1>
                    <div class="section-block">
                        <h2>تم توليد كود الـ Liquid بنجاح</h2>
                        <p>قام نموذج Gemini 2.5 Flash بتحليل مدخلاتك البسيطة وبتطبيق استراتيجيات التسويق (CRO) لإنشاء كود صفحة هبوط شاملة تتضمن: مؤقت عد تنازلي، بطاقات فوائد محسّنة، وآراء عملاء، وزر CTA نابض.</p>
                        <p><strong>الرجاء نسخ الكود الكامل أدناه والتحقق منه قبل النشر.</strong></p>
                    </div>
                    
                    <a href="#" class="cta-button">
                        <i class="fas fa-shopping-cart"></i> اطلب الآن (تم تفعيل تأثير النبض)
                    </a>
                    
                    <div class="section-block" style="background-color: #f0f4f8;">
                        <h3 style="color: #1a73e8;">الكود الذي تم توليده (ملف Liquid Section):</h3>
                        <pre style="white-space: pre-wrap; word-wrap: break-word; background: #eee; padding: 10px; border-radius: 5px; font-size: 0.8rem; direction: ltr; text-align: left;">${parsedSection.section_code.substring(0, 500)}...</pre>
                        <p style="font-size: 0.9rem; margin-top: 10px;">(تم عرض جزء بسيط من الكود هنا، الكود الكامل موجود في الرد)</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        // إرجاع البيانات مع HTML للمعاينة
        res.status(200).json({
            ...parsedSection,
            html: previewHTML
        });

    } catch (error) {
        console.error('Error in generate handler:', error);
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}
