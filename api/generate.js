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

        // ✅ تصحيح اسم الموديل إلى نسخة مستقرة وموجودة
        const GEMINI_MODEL = 'gemini-2.5-flash'; 
        const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
        
        const prompt = `
            Act as a Senior Shopify Developer and UI/UX Designer.
            
            Context:
            Product: "${productName}"
            Features: "${productFeatures}"
            Category: "${productCategory}"
            Audience: "${targetAudience}"
            Price: "${productPrice}"
            Style: "${designDescription}"
            Offer: "${customOffer || 'None'}"
            Shipping: "${shippingOption === 'free' ? 'Free Shipping' : customShippingPrice}"

            **Task:**
            Generate a high-converting Landing Page. Return the output strictly as a JSON object.
            
            **CRITICAL FORMATTING RULES (To prevent JSON Errors):**
            1. Output MUST be a single, valid JSON object.
            2. Do NOT use markdown code blocks (like \`\`\`json).
            3. **ESCAPING:** You are writing HTML/Liquid code inside a JSON string. You MUST escape all double quotes (\") inside the HTML.
            4. **NEWLINES:** Do NOT use actual line breaks inside the JSON strings. Use literal \\n characters for formatting the HTML code.
            
            **JSON Structure:**
            {
              "liquid_code": "The complete Shopify Liquid Section code. Use \\n for newlines and \\\" for quotes.",
              "schema": { ... valid shopify schema object ... },
              "html_preview": "A standalone, responsive HTML5 file for preview. Use \\n for newlines and \\\" for quotes. Include internal CSS."
            }

            **Design Requirements:**
            - Use Arabic language (RTL).
            - Mobile-first, responsive design.
            - Modern, clean UI based on the product category.
            - Include sections: Hero (Hook), Problem/Agitation, Solution (Product), Features, Social Proof, Footer.
        `;

        const geminiBody = {
            contents: [{
                parts: [{ text: prompt }]
            }],
            generationConfig: {
                responseMimeType: "application/json" // ✅ إجبار الموديل على إخراج JSON
            }
        };

        const response = await fetch(GEMINI_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(geminiBody),
        });

        const rawData = await response.text();
        let data;
        
        try {
            data = JSON.parse(rawData);
        } catch (e) {
            console.error('Failed parsing API response:', rawData);
            return res.status(500).json({ error: 'AI API returned invalid data.' });
        }

        if (!response.ok) {
            const errorMessage = data.error?.message || `Gemini API error: ${response.status}`;
            return res.status(500).json({ error: errorMessage });
        }
        
        const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!generatedText) {
            return res.status(500).json({ error: 'AI returned empty content.' });
        }

        // **********************************************
        // * دالة تنظيف ذكية لإصلاح الـ JSON *
        // **********************************************
        let parsedSection;
        try {
            // 1. إزالة أي نصوص زائدة (Markdown)
            let cleanJson = generatedText.replace(/```json/g, '').replace(/```/g, '').trim();
            
            // 2. محاولة استخراج الكائن JSON فقط (من أول قوس { إلى آخر قوس })
            const firstBrace = cleanJson.indexOf('{');
            const lastBrace = cleanJson.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1) {
                cleanJson = cleanJson.substring(firstBrace, lastBrace + 1);
            }

            // 3. محاولة التحليل (Parse)
            parsedSection = JSON.parse(cleanJson);

        } catch (e) {
            console.error('JSON Parse Error:', e);
            console.log('Failed Text:', generatedText.substring(0, 500) + '...'); // Log first 500 chars for debug
            
            // محاولة أخيرة: إصلاح الأسطر الجديدة التي قد تكسر الـ JSON
            try {
                // استبدال الأسطر الجديدة الحقيقية بـ \n (هذا حل طوارئ)
                let fixedJson = generatedText.replace(/\n/g, "\\n").replace(/\r/g, "");
                // قد نحتاج لإزالة الـ escaping الزائد إذا كان موجوداً، لكن هذا معقد.
                // نكتفي بإرجاع خطأ واضح للمستخدم إذا فشلت المحاولة الثانية
                return res.status(500).json({ 
                    error: 'AI Output Error: The generated code was too complex to parse. Please try again (Click Generate once more).' 
                });
            } catch (retryError) {
                return res.status(500).json({ error: 'Fatal JSON Error' });
            }
        }

        // التحقق من صحة البيانات المستخرجة
        if (!parsedSection.liquid_code || !parsedSection.html_preview) {
            return res.status(500).json({ error: 'AI returned incomplete data structure.' });
        }

        res.status(200).json({
            liquid_code: parsedSection.liquid_code,
            schema: parsedSection.schema || {},
            html: parsedSection.html_preview
        });

    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ error: 'Internal Server Error: ' + error.message });
    }
}
