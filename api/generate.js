// api/generate.js
import fetch from 'node-fetch'; 

export default async function handler(req, res) {
    // إعدادات CORS لضمان الاتصال السليم
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
            targetAudience, customOffer, shippingOption
        } = req.body;

        // العودة للنموذج الخاص بك gemini-2.5-flash
        const GEMINI_MODEL = 'gemini-2.5-flash'; 
        const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
        
        // برومبت مكثف وعميق (عقلية جوجل استوديو)
        const prompt = `
            Act as a Senior Creative Director and Conversion Expert. 
            Analyze this product: ${productName}. 
            Category: ${productCategory}. Context: ${productFeatures}.
            
            **Objective:** Create a high-converting, psychologically-driven landing page.
            
            **Design Rules:**
            1. **No Templates:** Generate a completely unique layout.
            2. **Custom CSS:** Write bespoke CSS for every section. Use advanced UI like glassmorphism, floating elements, and creative gradients. 
            3. **Marketing Flow:** - Start with a "Hook" (Benefit-driven Hero).
               - Add "Agitation" (The problem the customer faces).
               - "Visual Solution" (How this product fixes it).
               - "Us vs Them" Comparison Table.
               - Creative Testimonials and FAQ.
            4. **Visuals:** Use FontAwesome. Choose a palette based on product psychology (e.g., Mint/White for Dental).

            **Output Format (Strict JSON):**
            {
              "liquid": "Full Shopify Liquid (HTML + CSS + Schema)",
              "preview_html": "Full standalone HTML/CSS page (fully rendered with content)"
            }
            Return ONLY the JSON. No markdown.
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
        const aiResponse = JSON.parse(data.candidates[0].content.parts[0].text);

        // إرسال النتيجة بنفس الهيكل الذي يتوقعه تطبيقك
        res.status(200).json({
            liquid: aiResponse.liquid,
            html: aiResponse.preview_html // هذا هو الجزء الذي سيعرض الإبداع الكامل في المعاينة
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
