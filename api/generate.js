import fetch from 'node-fetch';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // قراءة مفتاح Gemini
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        if (!GEMINI_API_KEY) {
            return res.status(500).json({ error: 'GEMINI_API_KEY is not set' });
        }

        const { productName, productFeatures, productPrice, productCategory, targetAudience, designDescription } = req.body;

        if (!productName || !productFeatures) {
            return res.status(400).json({ error: 'Missing product details' });
        }

        // تحديد النموذج ونقطة النهاية (Endpoint) لـ Gemini
        const GEMINI_MODEL = 'gemini-1.5-flash'; 
        const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
        
        // بناء أمر التوليد (Prompt)
        const prompt = `
            You are an expert AI web developer specializing in creating single-page product landing pages using modern HTML and Tailwind CSS.
            Your response MUST be ONLY the complete, fully styled HTML code for the landing page. DO NOT include any text, markdown, or explanation outside of the HTML structure.
            
            Based on the following product details, generate a high-converting, professional, and visually appealing single-page HTML landing page:
            
            Product Name: ${productName}
            Key Features: ${productFeatures}
            Price: ${productPrice || 'Check website for details'}
            Category: ${productCategory}
            Target Audience: ${targetAudience}
            Design Style: ${designDescription || 'modern and clean'}
            
            The HTML must include:
            1. Full Tailwind CSS integration (via CDN link in the <head>).
            2. A compelling headline section (Hero).
            3. A features section.
            4. A clear call-to-action (CTA) button with an attractive offer.
            5. Use an elegant and effective color scheme based on the product category.
        `;

        // ✅ الهيكل الصحيح لـ Gemini API
        const geminiBody = {
            contents: [{
                parts: [{ text: prompt }]
            }],
            generationConfig: {  // ✅ التصحيح هنا
                temperature: 0.7,
            }
        };

        // إرسال الطلب إلى Gemini API
        const response = await fetch(GEMINI_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(geminiBody),
        });

        const data = await response.json();

        if (!response.ok) {
            const errorMessage = data.error?.message || `Gemini API error: ${response.status}`;
            console.error('Gemini API Error:', data);
            return res.status(500).json({ error: 'Failed to generate page: ' + errorMessage });
        }
        
        // استخلاص كود HTML من استجابة Gemini
        const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!generatedText) {
            return res.status(500).json({ error: 'AI failed to return valid content.' });
        }
        
        // إرجاع كود HTML للواجهة الأمامية
        res.status(200).json({ html: generatedText });

    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ error: 'Internal Server Error (Check Vercel Logs)' });
    }
}
