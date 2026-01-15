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
        if (!GEMINI_API_KEY) throw new Error('API Key is missing');

        // استقبال البيانات
        const { 
            productName, productFeatures, productPrice, productCategory,
            targetAudience, designDescription, variants, productImages 
        } = req.body;

        const productImageArray = productImages || [];
        
        // تعريف الرموز البديلة للصور ليتم حقنها لاحقاً
        // سنقوم بإنشاء خريطة للصور: Image1 -> [[IMG_0]], Image2 -> [[IMG_1]]
        let imagesMapInstruction = "Here are the image placeholders available to use in the JSON array based on user selection: ";
        productImageArray.forEach((_, index) => {
            imagesMapInstruction += `Use "[[IMG_${index}]]" for image number ${index + 1}. `;
        });

        // تحضير وصف المتغيرات (الألوان والمقاسات) للذكاء الاصطناعي
        let variantsInfo = "User defined variants: ";
        if (variants && variants.colors && variants.colors.items.length > 0) {
            variantsInfo += `Colors provided: ${JSON.stringify(variants.colors.items)}. `;
        } else {
            variantsInfo += "No specific colors defined (create generic themes based on product description). ";
        }
        
        if (variants && variants.sizes && variants.sizes.items.length > 0) {
            variantsInfo += `Sizes provided: ${JSON.stringify(variants.sizes.items)}. `;
        }

        const GEMINI_MODEL = 'gemini-2.5-flash'; 
        const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

        // --- القالب الصارم (Nike Air Drift Style) ---
        // سنضع الكود الأصلي هنا كمرجع، ونطلب من الذكاء الاصطناعي توليد JSON فقط لملء الفراغات
        
        const prompt = `
        You are a Senior Frontend Developer & UI/UX Expert.
        
        **Task:** We have a high-end, smooth interaction landing page template (Tech/Speed aesthetic). 
        You need to generate the configuration JSON and the specific HTML content to populate this template for a user's product.

        **Product Info:**
        - Name: ${productName}
        - Category: ${productCategory}
        - Description: ${productFeatures}
        - Price: ${productPrice}
        - Design Request: ${designDescription}
        - ${variantsInfo}
        - ${imagesMapInstruction}

        **Strict Requirements:**
        1. **Aesthetic:** Maintain the "Dark Mode", "Orbitron/Rajdhani font", and "Smooth Gradient" look. Do NOT make it bright/white unless specifically asked. Keep it moody and premium.
        2. **Gradients:** For each color variant, generate a \`bgGradientInner\` (darker center) and \`bgGradientOuter\` (black/dark edge). The colors should be subtle, not neon-blinding background.
        3. **Copywriting:** Generate a powerful, short, uppercase Headline (2 lines max) suitable for the "Speed/Tech" theme.
        4. **Output:** You must return a JSON object containing the \`products\` array for the JS logic, the HTML for sizes, and the HTML for the text section.

        **Expected JSON Output Format (Do not include markdown formatting like \`\`\`json):**
        {
            "headlineHTML": "<h1>LINE 1<br>LINE 2</h1>",
            "subHeadline": "${productName}",
            "sizesHTML": "<div class='size-box'>S</div>...", 
            "productsArray": [
                {
                    "id": 1,
                    "color": "#HEX_ACCENT",
                    "bgGradientInner": "#HEX_DARK_BG", 
                    "bgGradientOuter": "#000000",
                    "name": "${productName} - Variant Name",
                    "image": "[[IMG_0]]" 
                }
                // ... generate an entry for each color variant provided by user. 
                // If user provided mapped images in variants (imgIndex), use the corresponding [[IMG_x]].
                // If no specific image mapped, rotate through available [[IMG_x]] placeholders.
            ]
        }
        `;

        const response = await fetch(GEMINI_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { 
                    responseMimeType: "application/json",
                    temperature: 0.7 
                }
            })
        });

        const data = await response.json();
        
        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
            throw new Error('AI Generation Failed');
        }

        const aiResponseText = data.candidates[0].content.parts[0].text;
        const generatedData = JSON.parse(aiResponseText.replace(/```json/g, '').replace(/```/g, '').trim());

        // --- بناء الصفحة النهائية (HTML Reassembly) ---
        
        // 1. تحويل مصفوفة المنتجات إلى نص JSON صالح للكود
        const productsJSONString = JSON.stringify(generatedData.productsArray);

        // 2. الكود الكامل للصفحة (مدمج معه البيانات الجديدة)
        const finalHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${productName} - Official Page</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Rajdhani:wght@500;700&display=swap" rel="stylesheet">
    <style>
        :root {
            /* Initial variables, will be updated by JS */
            --accent-color: ${generatedData.productsArray[0].color || '#55efc4'}; 
            --bg-gradient-inner: ${generatedData.productsArray[0].bgGradientInner || '#252525'};
            --bg-gradient-outer: ${generatedData.productsArray[0].bgGradientOuter || '#000000'};
        }

        * { margin: 0; padding: 0; box-sizing: border-box; user-select: none; }

        body {
            height: 100vh;
            width: 100%;
            font-family: 'Rajdhani', sans-serif;
            background: radial-gradient(circle at center, var(--bg-gradient-inner), var(--bg-gradient-outer));
            color: white;
            overflow: hidden; 
            transition: background 0.8s ease-in-out; /* Smooth background transition */
        }

        /* --- Header --- */
        header {
            display: flex; justify-content: space-between; align-items: center;
            padding: 30px 50px; position: absolute; width: 100%; top: 0; z-index: 10;
        }
        .logo { font-family: 'Orbitron'; font-weight: bold; font-size: 24px; letter-spacing: 2px; }
        .cart-btn {
            background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 50%; width: 45px; height: 45px; display: flex;
            justify-content: center; align-items: center; cursor: pointer; transition: 0.3s;
        }
        .cart-btn:hover { background: var(--accent-color); border-color: var(--accent-color); color: black; }

        /* --- Layout --- */
        .container {
            display: grid; grid-template-columns: 1fr 1.2fr 0.5fr; 
            height: 100vh; align-items: center; position: relative; padding: 0 50px;
        }

        /* --- Text Section --- */
        .text-section { z-index: 5; padding-left: 20px; }
        .text-section h1 {
            font-family: 'Orbitron', sans-serif; font-size: 3.5rem; line-height: 1.1;
            text-transform: uppercase; letter-spacing: 2px; margin-bottom: 20px;
            text-shadow: 0 10px 30px rgba(0,0,0,0.5);
        }
        .text-section h3 {
            color: var(--accent-color); font-size: 1.4rem; text-transform: uppercase;
            font-weight: 700; letter-spacing: 1px; transition: color 0.5s;
        }

        /* --- Background Giant Text --- */
        .bg-text {
            position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
            font-family: 'Orbitron', sans-serif; font-size: 25vw; font-weight: 900;
            color: rgba(255, 255, 255, 0.03); z-index: 1; pointer-events: none; letter-spacing: -10px;
        }

        /* --- Product Stage (Center) --- */
        .product-stage {
            position: relative; display: flex; justify-content: center; align-items: center;
            height: 100%; z-index: 5;
        }
        .orbit-ring {
            position: absolute; width: 450px; height: 450px;
            border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 50%;
            transform: rotateX(60deg) rotateY(0deg) rotateZ(-45deg); z-index: 4;
            box-shadow: 0 0 50px rgba(0,0,0,0.2);
        }
        .orbit-dot {
            position: absolute; bottom: 20px; left: 50%; width: 12px; height: 12px;
            background: var(--accent-color); border-radius: 50%;
            box-shadow: 0 0 15px var(--accent-color); transition: background 0.5s ease, box-shadow 0.5s ease;
        }
        .shoe-img {
            width: 120%; max-width: 700px;
            filter: drop-shadow(0 30px 40px rgba(0,0,0,0.6));
            transform: rotate(-25deg) translateY(-20px); z-index: 6;
            transition: all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1); /* Elastic/Bounce effect */
            opacity: 1;
        }
        /* Animation Class */
        .shoe-img.transitioning {
            opacity: 0; transform: rotate(-10deg) scale(0.8) translateY(50px);
            transition: all 0.4s ease-in;
        }

        /* --- Controls (Right) --- */
        .controls {
            display: flex; flex-direction: column; justify-content: center; align-items: flex-end;
            padding-right: 20px; gap: 20px; z-index: 10;
        }
        .dot {
            width: 10px; height: 10px; background: rgba(255, 255, 255, 0.2);
            border-radius: 50%; cursor: pointer; transition: all 0.3s ease;
        }
        .dot.active {
            background: var(--accent-color); box-shadow: 0 0 10px var(--accent-color); transform: scale(1.6);
        }

        /* --- Footer UI --- */
        .sizes-container {
            position: absolute; bottom: 50px; left: 70px; display: flex; gap: 15px; z-index: 10;
        }
        .size-box {
            min-width: 45px; height: 45px; padding: 0 10px;
            border: 1px solid rgba(255, 255, 255, 0.15); background: rgba(0, 0, 0, 0.4);
            display: flex; justify-content: center; align-items: center;
            cursor: pointer; transition: 0.3s; font-weight: 700; font-size: 14px; backdrop-filter: blur(5px);
        }
        .size-box:hover, .size-box.selected {
            border-color: var(--accent-color); color: var(--accent-color);
            box-shadow: 0 0 15px rgba(0,0,0,0.2);
        }

        .cta-container {
            position: absolute; bottom: 50px; right: 70px; z-index: 10; display: flex; flex-direction: column; align-items: flex-end;
        }
        .price-tag {
            font-size: 2rem; font-weight: bold; margin-bottom: 10px; font-family: 'Orbitron';
        }
        .add-btn {
            background: white; color: black; padding: 18px 40px; border: none;
            display: flex; align-items: center; gap: 12px;
            font-family: 'Orbitron', sans-serif; font-weight: 900; text-transform: uppercase;
            letter-spacing: 2px; cursor: pointer; transition: transform 0.2s, background 0.3s;
            clip-path: polygon(15px 0, 100% 0, 100% 100%, 0 100%, 0 15px);
        }
        .add-btn:hover { background: var(--accent-color); transform: translateY(-3px); }
        .add-btn:active { transform: scale(0.95); }

        @media (max-width: 1024px) {
            .bg-text { font-size: 20vw; }
            .container { grid-template-columns: 1fr; grid-template-rows: auto 1fr auto; padding: 100px 20px 40px; }
            .text-section { text-align: center; padding: 0; margin-bottom: 20px; }
            .text-section h1 { font-size: 2.5rem; }
            .shoe-img { width: 80%; max-width: 450px; transform: rotate(-15deg); }
            .sizes-container { left: 50%; transform: translateX(-50%); bottom: 100px; width: 100%; justify-content: center; }
            .cta-container { left: 50%; transform: translateX(-50%); bottom: 20px; align-items: center; width: 100%; }
            .controls { display: flex; flex-direction: row; position: absolute; bottom: 160px; right: auto; left: 50%; transform: translateX(-50%); }
        }
    </style>
</head>
<body>

    <header>
        <div class="logo">SMART PAGE</div>
        <div class="cart-btn">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 20a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm7 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm-7-2h7v2H9v-2zm-3-1l.88-10.35A2 2 0 0 1 8.87 5H15.13a2 2 0 0 1 1.99 1.65L18 17H6z"/>
            </svg>
        </div>
    </header>

    <div class="bg-text">FUTURE</div>

    <main class="container">
        <div class="text-section">
            ${generatedData.headlineHTML}
            <h3 id="product-name">${generatedData.subHeadline}</h3>
        </div>

        <div class="product-stage">
            <div class="orbit-ring">
                <div class="orbit-dot"></div>
            </div>
            <img src="" alt="${productName}" class="shoe-img" id="main-shoe">
        </div>

        <div class="controls" id="dots-container"></div>

        <div class="sizes-container">
            ${generatedData.sizesHTML}
        </div>

        <div class="cta-container">
            <div class="price-tag" id="price-display">${productPrice}</div>
            <button class="add-btn" onclick="alert('Order logic here!')">
                ADD TO CART <i class="fas fa-arrow-right"></i>
            </button>
        </div>
    </main>

    <script>
        // --- DATA INJECTION FROM SERVER ---
        const products = ${productsJSONString};

        // --- DOM ELEMENTS ---
        const root = document.documentElement;
        const shoeImg = document.getElementById('main-shoe');
        const productName = document.getElementById('product-name');
        const dotsContainer = document.getElementById('dots-container');
        const sizeBoxes = document.querySelectorAll('.size-box');

        let currentIndex = 0;
        let isAnimating = false;

        function init() {
            // Create Dots based on products array length
            products.forEach((p, index) => {
                const dot = document.createElement('div');
                dot.classList.add('dot');
                if(index === 0) dot.classList.add('active');
                
                // Tooltip or click handler
                dot.addEventListener('click', () => {
                    if (index !== currentIndex && !isAnimating) {
                        changeSlide(index);
                    }
                });
                dotsContainer.appendChild(dot);
            });

            // Initial visual set
            updateVisuals(0);

            // Size selection logic
            sizeBoxes.forEach(box => {
                box.addEventListener('click', function() {
                    sizeBoxes.forEach(b => b.classList.remove('selected'));
                    this.classList.add('selected');
                });
            });
        }

        function changeSlide(index) {
            if (isAnimating) return;
            isAnimating = true;

            // 1. Animate Out
            shoeImg.classList.add('transitioning');

            // 2. Wait for exit animation, then swap data
            setTimeout(() => {
                currentIndex = index;
                updateVisuals(index);

                // 3. Update Image Src
                const newImgSrc = products[index].image;
                const tempImg = new Image();
                tempImg.src = newImgSrc;
                
                tempImg.onload = () => {
                    shoeImg.src = newImgSrc;
                    // Short delay to ensure DOM update before removing class
                    requestAnimationFrame(() => {
                        shoeImg.classList.remove('transitioning');
                        isAnimating = false;
                    });
                };
            }, 400); // 400ms matches half the CSS transition
        }

        function updateVisuals(index) {
            const product = products[index];

            // If init run
            if(!shoeImg.src || shoeImg.src === window.location.href) {
                shoeImg.src = product.image;
            }

            // Update Name
            productName.innerText = product.name;

            // Update CSS Vars (The core of the theme change)
            root.style.setProperty('--accent-color', product.color);
            root.style.setProperty('--bg-gradient-inner', product.bgGradientInner);
            if(product.bgGradientOuter) {
                root.style.setProperty('--bg-gradient-outer', product.bgGradientOuter);
            }

            // Update Dots UI
            const allDots = document.querySelectorAll('.dot');
            allDots.forEach(d => d.classList.remove('active'));
            if(allDots[index]) allDots[index].classList.add('active');
        }

        // Mouse Wheel Scroll (Throttled)
        let lastScroll = 0;
        window.addEventListener('wheel', (e) => {
            const now = Date.now();
            if(now - lastScroll < 1500) return;
            lastScroll = now;

            if(e.deltaY > 0) {
                let next = currentIndex + 1;
                if(next >= products.length) next = 0;
                changeSlide(next);
            } else {
                let prev = currentIndex - 1;
                if(prev < 0) prev = products.length - 1;
                changeSlide(prev);
            }
        });

        init();
    </script>
</body>
</html>
        `;

        // 3. استبدال الرموز بالصور الحقيقية (Base64)
        const replacePlaceholders = (html, images) => {
            let result = html;
            // استبدال [[IMG_0]], [[IMG_1]] إلخ
            for (let i = 0; i < images.length; i++) {
                // استبدال عام لكل الرموز المحتملة
                result = result.split(\`[[IMG_\${i}]]\`).join(images[i]);
            }
            // إذا بقي أي رمز لم يتم استبداله (لأن القوالب قد تطلب صور أكثر مما رفع المستخدم)
            // نضع الصورة الأولى كاحتياط
            if (images.length > 0) {
                result = result.replace(/\[\[IMG_\d+\]\]/g, images[0]);
            }
            return result;
        };

        const finalizedHTML = replacePlaceholders(finalHTML, productImageArray);

        // إرجاع النتيجة
        res.status(200).json({
            liquid_code: "", // Shopify code can be added similarly if needed
            schema: {},
            html: finalizedHTML
        });

    } catch (error) {
        console.error("Server Error:", error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
}
