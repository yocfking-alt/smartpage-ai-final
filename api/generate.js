import fetch from 'node-fetch';
import crypto from 'crypto';

export default async function handler(req, res) {
    // إعدادات CORS
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
            customOffer, productImages, brandLogo 
        } = req.body;

        const GEMINI_MODEL = 'gemini-2.5-flash'; 
        const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
        
        // 1. طلب بناء الصفحة من الذكاء الاصطناعي
        const prompt = `Create a high-converting landing page HTML for ${productName}. Category: ${productCategory}. Price: ${productPrice}. Features: ${productFeatures}. Return JSON: {"html": "..."}`;

        const aiReq = await fetch(GEMINI_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: "application/json" }
            })
        });

        const aiData = await aiReq.json();
        let aiResponse = JSON.parse(aiData.candidates[0].content.parts[0].text);

        // --- نظام الحماية (Security System) ---
        
        // تحضير سياق المنتج وتشفيره بـ Base64 لضمان سلامة النص العربي
        const productContextData = `Product: ${productName}, Price: ${productPrice}, Features: ${productFeatures}, Offer: ${customOffer || 'None'}`;
        const contextBase64 = Buffer.from(productContextData).toString('base64');

        // إنشاء التوقيع الرقمي لمنع التلاعب
        const signature = crypto
            .createHmac('sha256', GEMINI_API_KEY)
            .update(contextBase64)
            .digest('hex');

        // كود الشات بوت الذي سيتم حقنه في الصفحة
        const chatWidgetHTML = `
        <div id="ai-chat-bot" style="position:fixed; bottom:20px; right:20px; z-index:10000; font-family:Arial,sans-serif;">
            <button onclick="document.getElementById('ai-chat-window').style.display='flex'" style="width:60px; height:60px; border-radius:50%; background:#25D366; color:white; border:none; cursor:pointer; font-size:24px; box-shadow:0 4px 10px rgba(0,0,0,0.3);">💬</button>
            <div id="ai-chat-window" style="display:none; position:absolute; bottom:70px; right:0; width:300px; height:400px; background:white; border-radius:10px; flex-direction:column; box-shadow:0 5px 20px rgba(0,0,0,0.2); border:1px solid #ddd; overflow:hidden;">
                <div style="background:#075e54; color:white; padding:10px; display:flex; justify-content:space-between;">
                    <span>مساعد ذكي</span>
                    <button onclick="document.getElementById('ai-chat-window').style.display='none'" style="background:none; border:none; color:white; cursor:pointer;">✕</button>
                </div>
                <div id="ai-chat-msgs" style="flex:1; padding:10px; overflow-y:auto; background:#efe7dd; display:flex; flex-direction:column; gap:8px;"></div>
                <div style="padding:10px; display:flex; gap:5px; background:#f0f0f0;">
                    <input id="ai-chat-input" type="text" style="flex:1; padding:8px; border-radius:5px; border:1px solid #ccc;" placeholder="اسألني أي شيء...">
                    <button onclick="sendAiMessage()" style="background:#075e54; color:white; border:none; padding:8px 15px; border-radius:5px; cursor:pointer;">إرسال</button>
                </div>
            </div>
        </div>
        <script>
            const secureContext = "${contextBase64}";
            const secureSig = "${signature}";
            let chatHistory = [];

            async function sendAiMessage() {
                const input = document.getElementById('ai-chat-input');
                const msg = input.value.trim();
                if(!msg) return;

                const box = document.getElementById('ai-chat-msgs');
                box.innerHTML += '<div style="background:#dcf8c6; padding:8px; align-self:flex-end; border-radius:5px;">' + msg + '</div>';
                input.value = '';

                try {
                    const r = await fetch('/api/chat', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ 
                            message: msg, 
                            contextBase64: secureContext, 
                            signature: secureSig,
                            history: chatHistory 
                        })
                    });
                    const d = await r.json();
                    if(d.reply) {
                        box.innerHTML += '<div style="background:white; padding:8px; align-self:flex-start; border-radius:5px;">' + d.reply + '</div>';
                        chatHistory.push({role:'user', text:msg}, {role:'bot', text:d.reply});
                    } else {
                         box.innerHTML += '<div style="color:red; font-size:12px;">حدث خطأ أمني أو فني</div>';
                    }
                } catch(e) { console.error(e); }
                box.scrollTop = box.scrollHeight;
            }
        </script>`;

        aiResponse.html += chatWidgetHTML;
        res.status(200).json(aiResponse);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
