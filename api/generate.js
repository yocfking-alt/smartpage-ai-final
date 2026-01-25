import fetch from 'node-fetch';
import crypto from 'crypto'; // استيراد مكتبة التشفير

export default async function handler(req, res) {
    // 1. إعدادات CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*'); // يفضل تغييره لاحقاً لرابط موقعك
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        if (!GEMINI_API_KEY) throw new Error('API Key is missing');

        const { 
            productName, productFeatures, productPrice, productCategory,
            targetAudience, designDescription, shippingOption, customShippingPrice, 
            customOffer, productImages, brandLogo, variants 
        } = req.body;

        const productImageArray = productImages || [];
        const GEMINI_MODEL = 'gemini-2.5-flash'; // تم التصحيح هنا
        const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
        
        const shippingText = shippingOption === 'free' ? "شحن مجاني" : `الشحن: ${customShippingPrice}`;
        const offerText = customOffer ? `عرض خاص: ${customOffer}` : "";
        const MAIN_IMG_PLACEHOLDER = "[[PRODUCT_IMAGE_MAIN_SRC]]";
        const LOGO_PLACEHOLDER = "[[BRAND_LOGO_SRC]]";
        
        // ... (كود السلايدر والمتغيرات يبقى كما هو لتوفير المساحة في الرد، لكن تأكد من وجوده في ملفك) ...
        // سنفترض أن كود إعداد sliderSlidesHTML و variantsHTML و fbStyles موجود هنا كما في ملفك السابق
        
        let sliderSlidesHTML = `   <img src="${MAIN_IMG_PLACEHOLDER}" class="slider-img active" data-index="1">`;
        for (let i = 1; i < productImageArray.length && i <= 6; i++) {
            sliderSlidesHTML += `\n   <img src="[[PRODUCT_IMAGE_${i + 1}_SRC]]" class="slider-img" data-index="${i + 1}">`;
        }
        const totalSlidesCount = Math.max(productImageArray.length, 1);

        let variantsHTML = "";
        if (variants && variants.colors && variants.colors.enabled) {
             variants.colors.items.forEach(c => { variantsHTML += `<div class="variant-option color-option" style="background-color:${c.hex}" onclick="selectColor(this, '${c.name}', ${parseInt(c.imgIndex)+1})"></div>`; });
             variantsHTML = `<div class="form-group"><div class="variants-wrapper">${variantsHTML}</div><input type="hidden" id="selected-color" name="color"></div>`;
        }

        const fbStyles = `<style>/* نفس الستايل السابق الخاص بفيسبوك */</style>`;

        const prompt = `
        Act as a Senior Creative Director. Create a high-converting landing page for: ${productName}.
        Category: ${productCategory}. Price: ${productPrice}. ${shippingText}.
        
        REQUIRED HTML STRUCTURE:
        1. Use the provided slider HTML code exactly:
           <div class="product-viewer-container">...${sliderSlidesHTML}...</div>
        2. Use the exact order form structure provided previously.
        3. Use the Facebook reviews style provided.
        4. Return JSON only: { "html": "...", "liquid_code": "...", "schema": ... }
        `;
        // (ملاحظة: اختصرت البرومبت هنا للعرض، استخدم البرومبت الكامل الخاص بك من الملف السابق)

        const response = await fetch(GEMINI_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }], // استخدم البرومبت الكامل هنا
                generationConfig: { responseMimeType: "application/json", temperature: 0.95 }
            })
        });

        const data = await response.json();
        if (!data.candidates || !data.candidates[0]) throw new Error('AI Generation Failed');

        let aiResponse = JSON.parse(data.candidates[0].content.parts[0].text.replace(/```json/g, '').replace(/```/g, '').trim());

        // --- معالجة الصور (كما في كودك السابق) ---
        const replaceImages = (content) => {
            let res = content.split(MAIN_IMG_PLACEHOLDER).join(productImageArray[0] || '');
            res = res.split(LOGO_PLACEHOLDER).join(brandLogo || '');
            // ... باقي استبدال الصور
            return res;
        };
        aiResponse.html = replaceImages(aiResponse.html);

        // ***************************************************************
        //  الجزء الأمني الجديد: حقن الشات بوت + التوقيع الرقمي
        // ***************************************************************

        // 1. تحضير سياق المنتج
        const productContextData = `اسم المنتج: ${productName}. السعر: ${productPrice}. المميزات: ${productFeatures}. العرض: ${offerText}. الشحن: ${shippingText}.`;

        // 2. إنشاء التوقيع (Signature) باستخدام مفتاح API كسكرت (أو يمكنك استخدام متغير بيئة خاص APP_SECRET)
        // هذا التوقيع يضمن عدم تلاعب العميل بالنص
        const signature = crypto
            .createHmac('sha256', GEMINI_API_KEY)
            .update(productContextData)
            .digest('hex');

        // 3. كود الشات بوت الذي سيتم حقنه
        const chatWidget = `
        <div id="chat-widget" style="position:fixed;bottom:20px;right:20px;z-index:9999;">
            <div id="chat-window" style="display:none;width:300px;height:400px;background:#fff;border:1px solid #ccc;border-radius:10px;flex-direction:column;box-shadow:0 5px 15px rgba(0,0,0,0.2);">
                <div style="background:#075e54;color:#fff;padding:10px;border-radius:10px 10px 0 0;display:flex;justify-content:space-between;">
                    <span>مساعد المبيعات</span><span onclick="toggleChat()" style="cursor:pointer;">✕</span>
                </div>
                <div id="chat-msgs" style="flex:1;padding:10px;overflow-y:auto;background:#efe7dd;"></div>
                <div style="padding:10px;border-top:1px solid #ddd;display:flex;">
                    <input id="chat-input" type="text" style="flex:1;padding:5px;" placeholder="اكتب استفسارك...">
                    <button onclick="sendMsg()" style="background:#075e54;color:#fff;border:none;padding:5px 10px;margin-right:5px;cursor:pointer;">➤</button>
                </div>
            </div>
            <button onclick="toggleChat()" style="width:50px;height:50px;border-radius:50%;background:#25D366;border:none;box-shadow:0 2px 10px rgba(0,0,0,0.2);cursor:pointer;font-size:24px;">💬</button>
        </div>
        <script>
            const pContext = \`${productContextData}\`;
            const pSignature = "${signature}"; // التوقيع الرقمي المحقون من السيرفر
            let history = [];

            function toggleChat() { 
                const w = document.getElementById('chat-window'); 
                w.style.display = w.style.display === 'none' ? 'flex' : 'none'; 
            }
            
            async function sendMsg() {
                const inp = document.getElementById('chat-input');
                const txt = inp.value.trim();
                if(!txt) return;
                
                const box = document.getElementById('chat-msgs');
                box.innerHTML += \`<div style="background:#dcf8c6;padding:5px;margin:5px;border-radius:5px;align-self:flex-end;">\${txt}</div>\`;
                inp.value = '';
                box.scrollTop = box.scrollHeight;

                try {
                    const req = await fetch('/api/chat', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ 
                            message: txt, 
                            productContext: pContext, // نرسل النص
                            signature: pSignature,    // ونرسل التوقيع للتحقق
                            history: history 
                        })
                    });
                    const res = await req.json();
                    if(res.reply) {
                        box.innerHTML += \`<div style="background:#fff;padding:5px;margin:5px;border-radius:5px;align-self:flex-start;">\${res.reply}</div>\`;
                        history.push({role:'user', text:txt}, {role:'bot', text:res.reply});
                        box.scrollTop = box.scrollHeight;
                    }
                } catch(e) { console.error(e); }
            }
        </script>
        `;

        aiResponse.html += chatWidget;

        res.status(200).json(aiResponse);

    } catch (error) {
        console.error("Generate Error:", error);
        res.status(500).json({ error: error.message });
    }
}
