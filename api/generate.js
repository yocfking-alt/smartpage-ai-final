import fetch from 'node-fetch';

export default async function handler(req, res) {
    // 1. إعدادات CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        const { 
            productName, productFeatures, productPrice, productCategory,
            customOffer, productImages, brandLogo 
        } = req.body;

        const GEMINI_MODEL = 'gemini-2.5-flash'; 
        const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
        
        // تعديل البرومبت ليقوم بتوليد الأسئلة والأجوبة المتوقعة (FAQ)
        const prompt = `
        Act as a Marketing Expert. Create a Landing Page for "${productName}". 
        Category: ${productCategory}, Price: ${productPrice}, Features: ${productFeatures}.
        
        Also, generate 15 potential customer questions and their answers about this product in Algerian/Arabic dialect.
        
        Return ONLY a JSON object with this structure:
        {
          "html": "...", 
          "faq": [
            {"q": "السؤال الأول؟", "a": "الجواب الأول..."},
            {"q": "السؤال الثاني؟", "a": "الجواب الثاني..."}
          ]
        }`;

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

        // تحويل قائمة الأسئلة والأجوبة إلى نص جافاسكربت ليتم حقنها
        const faqJSON = JSON.stringify(aiResponse.faq);

        // كود البوت الثابت (بدون API)
        const chatWidgetHTML = `
        <div id="static-chat-bot" style="position:fixed; bottom:20px; right:20px; z-index:10000; font-family:sans-serif; direction:rtl;">
            <button id="chat-btn" onclick="toggleChat()" style="width:60px; height:60px; border-radius:50%; background:#25D366; color:white; border:none; cursor:pointer; font-size:24px; box-shadow:0 4px 10px rgba(0,0,0,0.3); display:flex; align-items:center; justify-content:center;">💬</button>
            
            <div id="chat-box" style="display:none; position:absolute; bottom:75px; right:0; width:320px; height:450px; background:white; border-radius:15px; flex-direction:column; box-shadow:0 5px 25px rgba(0,0,0,0.2); border:1px solid #ddd; overflow:hidden;">
                <div style="background:#075e54; color:white; padding:15px; font-weight:bold; display:flex; justify-content:space-between;">
                    <span>مساعد المبيعات 🤖</span>
                    <button onclick="toggleChat()" style="background:none; border:none; color:white; cursor:pointer; font-size:18px;">✕</button>
                </div>
                <div id="msgs-container" style="flex:1; padding:15px; overflow-y:auto; background:#efe7dd; display:flex; flex-direction:column; gap:10px;">
                    <div style="background:white; padding:10px; border-radius:10px; font-size:14px; align-self:flex-start; box-shadow:0 1px 2px rgba(0,0,0,0.1);">
                        مرحباً بك! أنا هنا للإجابة على استفساراتك حول <b>${productName}</b>. كيف يمكنني مساعدتك؟
                    </div>
                </div>
                <div style="padding:10px; background:#f0f0f0; border-top:1px solid #ddd; display:flex; gap:5px;">
                    <input id="user-input" type="text" style="flex:1; padding:10px; border-radius:20px; border:1px solid #ccc; outline:none;" placeholder="اسأل عن السعر، التوصيل...">
                    <button onclick="processMessage()" style="background:#075e54; color:white; border:none; width:40px; height:40px; border-radius:50%; cursor:pointer;">➤</button>
                </div>
            </div>
        </div>

        <script>
            const faqData = ${faqJSON}; // الأسئلة التي ولدها الذكاء الاصطناعي
            
            function toggleChat() {
                const box = document.getElementById('chat-box');
                box.style.display = box.style.display === 'none' ? 'flex' : 'none';
            }

            function processMessage() {
                const input = document.getElementById('user-input');
                const msg = input.value.trim().toLowerCase();
                if(!msg) return;

                addMsg(msg, 'user');
                input.value = '';

                // البحث عن أفضل إجابة مطابقة
                setTimeout(() => {
                    let answer = "عذراً، لم أفهم سؤالك جيداً. هل يمكنك السؤال عن السعر، المميزات، أو التوصيل؟";
                    
                    // محرك بحث بسيط للكلمات الدلالية
                    for (let item of faqData) {
                        if (msg.includes(item.q.toLowerCase()) || isRelated(msg, item.q)) {
                            answer = item.a;
                            break;
                        }
                    }
                    
                    addMsg(answer, 'bot');
                }, 600);
            }

            function isRelated(msg, question) {
                // دالة بسيطة للتحقق من وجود كلمات مفتاحية مشتركة
                const keywords = question.split(' ');
                return keywords.some(word => word.length > 3 && msg.includes(word.toLowerCase()));
            }

            function addMsg(text, sender) {
                const container = document.getElementById('msgs-container');
                const div = document.createElement('div');
                div.style.padding = "10px";
                div.style.borderRadius = "10px";
                div.style.fontSize = "14px";
                div.style.maxWidth = "85%";
                div.style.boxShadow = "0 1px 2px rgba(0,0,0,0.1)";
                
                if(sender === 'user') {
                    div.style.background = "#dcf8c6";
                    div.style.alignSelf = "flex-end";
                } else {
                    div.style.background = "white";
                    div.style.alignSelf = "flex-start";
                }
                
                div.innerText = text;
                container.appendChild(div);
                container.scrollTop = container.scrollHeight;
            }
        </script>
        `;

        aiResponse.html += chatWidgetHTML;

        res.status(200).json({
            html: aiResponse.html,
            faq_count: aiResponse.faq.length // للتأكد من توليد الأسئلة
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
}
