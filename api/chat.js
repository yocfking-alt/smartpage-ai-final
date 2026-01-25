// api/chat.js
import fetch from 'node-fetch';

export default async function handler(req, res) {
    // إعدادات الأمان (CORS)
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    
    // التأكد من أن الطلب هو POST
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { message, productContext, history } = req.body;
        
        // هنا يتم استدعاء المفتاح من متغيرات البيئة في Vercel
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY; 

        if (!GEMINI_API_KEY) {
            console.error('API Key is missing in Vercel Environment Variables');
            throw new Error('API Key is missing');
        }

        // تعليمات البوت (System Prompt)
        const systemInstruction = `
        أنت مساعد مبيعات ذكي ومحترف لمتجر إلكتروني جزائري.
        مهمتك هي إقناع الزائر بشراء المنتج التالي:
        ${productContext}
        
        التعليمات:
        1. تحدث بلهجة جزائرية مهذبة وممزوجة بالعربية الفصحى البسيطة.
        2. كن مختصراً ومباشراً (ردود قصيرة).
        3. هدفك هو الإقناع وإغلاق البيع.
        4. اعتمد فقط على معلومات المنتج المقدمة لك.
        `;

        const chatHistory = history || [];
        
        // تجهيز الرسالة لـ Gemini
        const contents = [
            { role: "user", parts: [{ text: systemInstruction }] },
            ...chatHistory.map(msg => ({
                role: msg.role === 'bot' ? 'model' : 'user',
                parts: [{ text: msg.text }]
            })),
            { role: "user", parts: [{ text: message }] }
        ];

        // الاتصال بـ Gemini باستخدام مفتاحك
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: contents,
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 200,
                }
            })
        });

        const data = await response.json();
        
        if (!data.candidates || !data.candidates[0]) {
            throw new Error('No response from Gemini');
        }

        const aiResponse = data.candidates[0].content.parts[0].text;

        res.status(200).json({ reply: aiResponse });

    } catch (error) {
        console.error("Chat API Error:", error);
        res.status(500).json({ error: 'حدث خطأ أثناء معالجة الطلب' });
    }
}
