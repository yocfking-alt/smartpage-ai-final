// تم إزالة استدعاء node-fetch ليعمل الكود تلقائياً في البيئات الحديثة
export default async function handler(req, res) {
    // 1. إعدادات CORS لضمان الاتصال مع builder.html
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
            productName, productPrice, productCategory, productImages, brandLogo, variants 
        } = req.body;

        const productImageArray = productImages || [];
        const MAIN_IMG_PLACEHOLDER = "[[PRODUCT_IMAGE_MAIN_SRC]]";
        const LOGO_PLACEHOLDER = "[[BRAND_LOGO_SRC]]";
        
        // تحديد "نظام التصميم" بدقة عالية بناءً على الفئة كما في الفيديوهات
        let designSystem = 'BOLD_IMPACT'; 
        let mainBgDefault = '#f3f4f6';

        if (['food', 'beauty', 'health', 'home'].includes(productCategory)) {
            designSystem = 'FRESH_GLASS';
            mainBgDefault = '#ffffff';
        }

        // بناء أزرار الألوان مع خاصية تغيير لون الصفحة (The Video Magic)
        let variantsHTML = "";
        if (variants?.colors?.enabled && variants.colors.items.length > 0) {
            variantsHTML += `<div class="variant-section"><label>اختر اللون:</label><div class="color-grid">`;
            variants.colors.items.forEach((color, idx) => {
                let slideTarget = color.imgIndex !== "" ? parseInt(color.imgIndex) + 1 : 'null';
                variantsHTML += `
                <div class="color-dot ${idx === 0 ? 'active' : ''}" 
                     style="background-color: ${color.hex};" 
                     onclick="syncTheme(this, '${color.name}', ${slideTarget}, '${color.hex}')">
                </div>`;
            });
            variantsHTML += `</div><input type="hidden" id="selected-color" name="color" value="${variants.colors.items[0].name}"></div>`;
        }

        // بناء السلايدر
        let sliderHTML = `<img src="${MAIN_IMG_PLACEHOLDER}" class="slide active" data-index="1">`;
        productImageArray.slice(1, 5).forEach((img, i) => {
            sliderHTML += `<img src="[[PRODUCT_IMAGE_${i + 2}_SRC]]" class="slide" data-index="${i + 2}">`;
        });

        // البرومبت الخاص بالذكاء الاصطناعي للحصول على نصوص تسويقية قوية
        const aiPrompt = `Build a high-conversion Arabic landing page content for "${productName}". Style: Premium. Return JSON only: {"h1": "headline", "p": "subheadline", "features": ["f1","f2","f3"]}`;

        // استخدام fetch المدمجة (لا تحتاج npm install)
        const aiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: aiPrompt }] }] })
        });
        
        const aiData = await aiResponse.json();
        let aiJson = { h1: productName, p: "أفضل منتج بجودة عالية", features: ["جودة ممتازة", "سعر مناسب", "توصيل سريع"] };
        try {
            const rawText = aiData.candidates[0].content.parts[0].text;
            aiJson = JSON.parse(rawText.substring(rawText.indexOf('{'), rawText.lastIndexOf('}') + 1));
        } catch (e) { console.log("AI Parse Error, using defaults"); }

        // تجميع الصفحة النهائية بـ CSS خارق
        const finalHTML = `
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                :root { --bg: ${mainBgDefault}; --txt: #111; --accent: #000; }
                body { margin: 0; background: var(--bg); color: var(--txt); font-family: sans-serif; transition: 0.8s cubic-bezier(0.2, 0.8, 0.2, 1); }
                .hero { display: flex; flex-wrap: wrap; min-height: 100vh; align-items: center; padding: 20px; position: relative; overflow: hidden; }
                
                /* ستايل النص العملاق مثل فيديو نايكي */
                .bg-title { position: absolute; font-size: 20vw; font-weight: 900; opacity: 0.05; z-index: 0; white-space: nowrap; top: 20%; left: 50%; transform: translateX(-50%); }
                
                .container { display: grid; grid-template-columns: 1fr 1fr; width: 100%; max-width: 1200px; margin: 0 auto; z-index: 1; gap: 40px; }
                @media (max-width: 768px) { .container { grid-template-columns: 1fr; } }

                .visual { position: relative; }
                .slide { width: 100%; display: none; filter: drop-shadow(0 20px 50px rgba(0,0,0,0.2)); transform: rotate(-5deg); transition: 0.5s; }
                .slide.active { display: block; animation: appear 0.8s ease-out forwards; }
                @keyframes appear { from { opacity: 0; transform: scale(0.8) rotate(-10deg); } to { opacity: 1; transform: scale(1) rotate(-5deg); } }

                .content { padding: 20px; }
                .price { font-size: 2.5rem; font-weight: bold; margin: 20px 0; color: var(--accent); }
                .color-grid { display: flex; gap: 15px; margin: 20px 0; }
                .color-dot { width: 40px; height: 40px; border-radius: 50%; cursor: pointer; border: 3px solid #fff; box-shadow: 0 4px 10px rgba(0,0,0,0.1); transition: 0.3s; }
                .color-dot.active { transform: scale(1.3); border-color: var(--txt); }

                .buy-card { background: #fff; padding: 30px; border-radius: 20px; box-shadow: 0 20px 40px rgba(0,0,0,0.1); color: #000; }
                .input { width: 100%; padding: 12px; margin: 10px 0; border: 1px solid #ddd; border-radius: 8px; }
                .btn { width: 100%; padding: 15px; background: #000; color: #fff; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 1.2rem; }
            </style>
        </head>
        <body>
            <div class="hero">
                <div class="bg-title">${productName.split(' ')[0]}</div>
                <div class="container">
                    <div class="visual">${sliderHTML}</div>
                    <div class="content">
                        <h1>${aiJson.h1}</h1>
                        <p>${aiJson.p}</p>
                        <div class="price">${productPrice}</div>
                        ${variantsHTML}
                        <div class="buy-card">
                            <input class="input" placeholder="الاسم الكامل">
                            <input class="input" placeholder="رقم الهاتف">
                            <button class="btn">اطلب الآن - الدفع عند الاستلام</button>
                        </div>
                    </div>
                </div>
            </div>

            <script>
                function syncTheme(el, name, slideIdx, hex) {
                    // تغيير الحالة البصرية للأزرار
                    document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
                    el.classList.add('active');
                    
                    // السحر: تغيير خلفية الموقع
                    document.documentElement.style.setProperty('--bg', hex);
                    
                    // تغيير لون النص بناء على درجة سطوع الخلفية
                    const r = parseInt(hex.slice(1,3), 16), g = parseInt(hex.slice(3,5), 16), b = parseInt(hex.slice(5,7), 16);
                    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
                    document.documentElement.style.setProperty('--txt', brightness > 125 ? '#000' : '#fff');

                    // تغيير الصورة
                    if(slideIdx) {
                        document.querySelectorAll('.slide').forEach(s => s.classList.remove('active'));
                        document.querySelector('.slide[data-index="'+slideIdx+'"]')?.classList.add('active');
                    }
                }
            </script>
        </body>
        </html>`;

        // استبدال روابط الصور الحقيقية
        let finalOutput = finalHTML.replace(MAIN_IMG_PLACEHOLDER, productImageArray[0] || '');
        productImageArray.forEach((img, i) => {
            finalOutput = finalOutput.replace(`[[PRODUCT_IMAGE_${i + 1}_SRC]]`, img);
        });

        res.status(200).json({ html: finalOutput });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
