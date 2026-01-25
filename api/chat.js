import fetch from 'node-fetch';
import crypto from 'crypto';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { message, contextBase64, signature, history } = req.body;
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

        // 1. التحقق من التوقيع (منع استغلال البوت في مواضيع أخرى)
        const expectedSignature = crypto
            .createHmac('sha256', GEMINI_API_KEY)
            .update(contextBase64)
            .digest('hex');

        if (signature !== expectedSignature) {
            return res.status(403).json({ error: 'Security violation: Data tampering detected' });
        }

        // 2. فك التشفير للحصول على المعلومات الحقيقية
        const productContext = Buffer.from(contextBase64, 'base64').toString('utf-8');

        // 3. إعداد التعليمات الصارمة للبوت
        const systemPrompt = `أنت بائع خبير للمنتج التالي فقط: ${productContext}. 
        قاعدة صارمة: لا تجب عن أي شيء خارج هذا المنتج. إذا سألك المستخدم عن برمجة أو طبخ أو أي شيء آخر، اعتذر وقل أنك مخصص لهذا المنتج فقط.`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [
                    { role: "user", parts: [{ text: systemPrompt }] },
                    ...(history || []).map(m => ({
                        role: m.role === 'bot' ? 'model' : 'user',
                        parts: [{ text: m.text }]
                    })),
                    { role: "user", parts: [{ text: message }] }
                ],
                generationConfig: { temperature: 0.4, maxOutputTokens: 200 }
            })
        });

        const data = await response.json();
        const aiReply = data.candidates[0].content.parts[0].text;

        res.status(200).json({ reply: aiReply });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Error' });
    }
}
