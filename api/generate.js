import fetch from 'node-fetch';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // 1. قراءة مفتاح GEMINI الجديد
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        if (!GEMINI_API_KEY) {
            return res.status(500).json({ error: 'GEMINI_API_KEY is not set' });
        }

        const { productName, productFeatures, productPrice, productCategory, targetAudience, designDescription } = req.body;

        // 2. تحديد النموذج ونقطة النهاية (Endpoint) لـ Gemini
        const GEMINI_MODEL = 'gemini-1.5-flash'; 
        const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
        
        // بناء أمر التوليد (Prompt) كما كان سابقاً...

        const prompt = `
            You are an expert AI web developer specializing in creating single-page product landing pages using modern HTML and Tailwind CSS.
            Your response MUST be ONLY the complete, fully styled HTML code for the landing page. DO NOT include any text, markdown, or explanation outside of the HTML structure.
            
            ... (بقية محتوى الـ Prompt) ...
        `;

        // 3. بناء جسم الطلب (Body) لـ Gemini API - يختلف عن DeepSeek
        const geminiBody = {
            contents: [{
                parts: [{ text: prompt }]
            }],
            config: {
                temperature: 0.7,
            }
        };

        // 4. إرسال الطلب إلى Gemini API
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
        
        // 5. استخلاص كود HTML من استجابة Gemini - يختلف عن DeepSeek
        const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!generatedText) {
            return res.status(500).json({ error: 'AI failed to return valid content.' });
        }
        
        res.status(200).json({ html: generatedText });

    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ error: 'Internal Server Error (Check Vercel Logs)' });
    }
}
