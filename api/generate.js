import fetch from 'node-fetch';

export default async function handler(req, res) {
    // 1. إعدادات CORS (نفس النظام القديم لضمان قبول الطلبات)
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
            targetAudience, designDescription, shippingOption, customShippingPrice, customOffer
        } = req.body;

        // استخدام الموديل المستقر والسريع
        const GEMINI_MODEL = 'gemini-2.5-flash'; 
        const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
        
        // بناء النصوص الخاصة بالشحن والعرض
        const shippingText = shippingOption === 'free' ? "Free Shipping" : `Shipping: ${customShippingPrice}`;
        const offerText = customOffer ? `Special Offer: ${customOffer}` : "";

        // *****************************************************************
        // الـ Prompt الجديد (معدل ليعمل مع نظامك التقني)
        // *****************************************************************
        const prompt = `
            Act as a Senior Creative Director and Conversion Expert. 
            Analyze this product: ${productName}. 
            Category: ${productCategory}. 
            Target Audience: ${targetAudience}.
            Context/Features: ${productFeatures}.
            Price: ${productPrice}. ${shippingText}. ${offerText}.
            User Design Request: ${designDescription}.
            
            **Objective:** Create a high-converting, psychologically-driven landing page.
            
            **Design Rules:**
            1. **No Templates:** Generate a completely unique layout.
            2. **Custom CSS:** Write bespoke CSS for every section inside the HTML. Use advanced UI like glassmorphism, floating elements, creative gradients, and modern typography. 
            3. **Marketing Flow:** - Start with a "Hook" (Benefit-driven Hero Section).
               - Add "Agitation" (The problem the customer faces).
               - "Visual Solution" (How this product fixes it).
               - "Us vs Them" Comparison Table (if applicable).
               - Creative Testimonials and FAQ.
               - Strong Sticky CTA.
            4. **Visuals:** Use FontAwesome for icons. Choose a color palette based on product psychology (e.g., Mint/White for Health, Black/Gold for Luxury).
            5. **Responsiveness:** Must be fully responsive for mobile.

            **Technical Output Requirement (CRITICAL):**
            You must return a Strict JSON object. Do not include markdown formatting (like \`\`\`json).
            The JSON must have exactly these three keys:

            {
              "html": "A complete, standalone index.html string including <style> and <body>. This is for the live preview.",
              "liquid_code": "The Shopify Liquid template code. It should be similar to the HTML but using Liquid syntax ({{ product.title }}, etc) where appropriate, BUT DO NOT include the {% schema %} tag here.",
              "schema": {
                  "name": "Landing Page",
                  "settings": [
                      { "type": "text", "id": "headline", "label": "Headline", "default": "Your Headline Here" }
                      // Generate relevant schema settings for the sections you created
                  ]
              }
            }
        `;

        const response = await fetch(GEMINI_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: "application/json", temperature: 0.9 }
            })
        });

        const data = await response.json();

        // معالجة الأخطاء من Gemini
        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
            console.error("Gemini Error:", data);
            throw new Error('Failed to generate content from AI');
        }

        const aiResponseText = data.candidates[0].content.parts[0].text;
        
        // تنظيف النص من علامات Markdown إذا وجدت لضمان عدم حدوث خطأ في الـ JSON
        const cleanedText = aiResponseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const aiResponse = JSON.parse(cleanedText);

        // إرسال النتيجة بنفس الهيكل الذي يتوقعه builder.html
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
