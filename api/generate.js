import fetch from 'node-fetch';

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
            targetAudience, designDescription, shippingOption, customShippingPrice, 
            customOffer, productImages, brandLogo, variants 
        } = req.body;

        // 1. تحضير بيانات المتغيرات (Variants) للذكاء الاصطناعي
        // نحتاج أن يعرف الذكاء الاصطناعي الألوان ليقترح تدرجات خلفية مناسبة
        let variantsPromptInfo = "";
        if (variants && variants.colors && variants.colors.items.length > 0) {
            variantsPromptInfo = `The product has these color variants: ${variants.colors.items.map(c => c.name).join(', ')}.`;
        }

        // 2. هندسة البرومبت (Prompt Engineering) المتقدمة
        // نطلب من الذكاء الاصطناعي أن يتصرف كمصمم UI/UX ويعطينا JSON خاص بالستايل
        const prompt = `
        Act as a World-Class UI/UX Designer & Frontend Developer.
        Product: ${productName} (${productCategory}).
        Context: ${productFeatures}.
        Price: ${productPrice}.
        User Style Request: ${designDescription}.
        ${variantsPromptInfo}

        I need a JSON configuration to build a high-end, award-winning landing page (like Nike/Ridestore style).
        
        **CRITICAL TASK**: You must generate a "Color Theme" for EACH product variant color provided (or 1 default if none).
        
        Return ONLY a raw JSON object (no markdown, no code blocks) with this exact structure:
        {
            "headlines": {
                "main": "Short punchy 2-3 words title (e.g. AIR MAX)",
                "sub": "Compelling one-liner description",
                "bg_text": "One giant word for background (e.g. JUMP)"
            },
            "features_short": ["Feature 1", "Feature 2", "Feature 3"],
            "marketing": {
                "offer_text": "${customOffer || 'Special Launch Offer'}",
                "cta_text": "Add to Cart"
            },
            "themes": [
                // Generate one object per color variant. If no variants, generate 1 main theme.
                {
                    "variant_name": "Color Name (e.g., Red)",
                    "primary_color": "Hex code matching the variant (e.g., #ff0000)",
                    "bg_gradient": "CSS linear-gradient or radial-gradient string that matches this color (e.g., radial-gradient(circle at center, #ff0000, #000))",
                    "text_color": "#ffffff",
                    "accent_color": "Contrast color for buttons"
                }
            ]
        }
        `;

        const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

        const response = await fetch(GEMINI_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: "application/json" }
            })
        });

        const data = await response.json();
        const aiJson = JSON.parse(data.candidates[0].content.parts[0].text);

        // 3. دمج بيانات الصور والمتغيرات
        // هنا نقوم بدمج بيانات الذكاء الاصطناعي مع الصور التي رفعها المستخدم
        
        const finalImages = productImages && productImages.length > 0 ? productImages : ["https://via.placeholder.com/600x600?text=No+Image"];
        const mainLogo = brandLogo || "https://via.placeholder.com/100x50?text=Logo";

        // مطابقة الثيمات مع الصور (Logic Matcher)
        // نحاول ربط كل لون اختاره المستخدم بالثيم الذي اقترحه الذكاء الاصطناعي
        let themesData = [];
        if (variants && variants.colors && variants.colors.items.length > 0) {
            themesData = variants.colors.items.map((colorItem, index) => {
                // البحث عن اقتراح AI لهذا اللون أو استخدام الافتراضي
                const aiTheme = aiJson.themes.find(t => t.variant_name.toLowerCase().includes(colorItem.name.toLowerCase())) || aiJson.themes[index] || aiJson.themes[0];
                
                // تحديد الصورة: إذا حدد المستخدم صورة للون نستخدمها، وإلا نستخدم الصورة حسب الترتيب
                let imgUrl = finalImages[0];
                if (colorItem.imgIndex !== "" && colorItem.imgIndex !== undefined) {
                    imgUrl = finalImages[colorItem.imgIndex] || finalImages[0];
                }

                return {
                    name: colorItem.name,
                    hex: colorItem.hex, // لون الدائرة
                    bg_gradient: aiTheme.bg_gradient,
                    primary_color: aiTheme.primary_color,
                    image: imgUrl
                };
            });
        } else {
            // حالة عدم وجود متغيرات (منتج واحد)
            themesData = [{
                name: "Standard",
                hex: "#333",
                bg_gradient: aiJson.themes[0].bg_gradient,
                primary_color: aiJson.themes[0].primary_color,
                image: finalImages[0]
            }];
        }

        // 4. بناء كود HTML "الخارق" (The Super Template)
        // هذا القالب مبني على Ridestore + Nike Style ومجهز بـ GSAP
        
        const generatedHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${productName} - Official Page</title>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;500;700;900&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>
    <style>
        :root {
            --bg-gradient: ${themesData[0].bg_gradient};
            --primary-color: ${themesData[0].primary_color};
            --text-color: #ffffff;
            --glass-bg: rgba(255, 255, 255, 0.1);
            --glass-border: rgba(255, 255, 255, 0.2);
        }

        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Poppins', sans-serif; }
        
        body {
            background: var(--bg-gradient);
            color: var(--text-color);
            height: 100vh;
            overflow: hidden;
            transition: background 1s ease;
        }

        /* Nav */
        nav {
            display: flex; justify-content: space-between; align-items: center;
            padding: 20px 5%; z-index: 100; position: relative;
        }
        .logo img { height: 40px; object-fit: contain; }
        .nav-right { display: flex; gap: 20px; align-items: center; }
        .cart-btn {
            background: var(--glass-bg); padding: 10px 25px; border-radius: 30px;
            border: 1px solid var(--glass-border); backdrop-filter: blur(10px);
            cursor: pointer; transition: 0.3s;
        }
        .cart-btn:hover { background: rgba(255,255,255,0.2); }

        /* Main Layout */
        .container {
            display: grid;
            grid-template-columns: 1.2fr 1.5fr 0.5fr;
            height: calc(100vh - 80px);
            padding: 0 5%;
            align-items: center;
            position: relative;
        }

        /* Left: Details */
        .details { z-index: 10; padding-right: 20px; }
        .badge {
            background: var(--primary-color); color: white; padding: 5px 15px;
            border-radius: 20px; font-size: 0.8rem; font-weight: bold;
            display: inline-block; margin-bottom: 20px; text-transform: uppercase;
        }
        h1 {
            font-size: clamp(3rem, 5vw, 5rem); line-height: 1; text-transform: uppercase;
            margin-bottom: 10px; text-shadow: 0 10px 30px rgba(0,0,0,0.3);
        }
        .sub-title { font-size: 1.2rem; opacity: 0.8; margin-bottom: 30px; font-weight: 300; }
        
        /* Interactive Controls */
        .controls-area {
            background: var(--glass-bg); backdrop-filter: blur(15px);
            padding: 25px; border-radius: 20px; border: 1px solid var(--glass-border);
            max-width: 400px;
        }
        
        .variant-selector { margin-bottom: 20px; }
        .selector-label { font-size: 0.8rem; opacity: 0.7; display: block; margin-bottom: 10px; }
        .colors-row { display: flex; gap: 15px; }
        .color-dot {
            width: 35px; height: 35px; border-radius: 50%; cursor: pointer;
            border: 2px solid rgba(255,255,255,0.3); transition: 0.3s; position: relative;
        }
        .color-dot.active { border-color: white; transform: scale(1.2); box-shadow: 0 0 15px var(--primary-color); }

        .price-action { display: flex; align-items: center; justify-content: space-between; margin-top: 20px; }
        .price { font-size: 2rem; font-weight: 700; }
        .buy-btn {
            background: white; color: black; padding: 15px 40px; border: none;
            border-radius: 30px; font-weight: 700; font-size: 1rem; cursor: pointer;
            transition: 0.3s; box-shadow: 0 10px 25px rgba(0,0,0,0.2);
        }
        .buy-btn:hover { transform: translateY(-3px); box-shadow: 0 15px 35px rgba(0,0,0,0.3); }

        /* Center: Hero Image */
        .hero-section {
            position: relative; display: flex; justify-content: center; align-items: center; height: 100%;
        }
        .bg-text {
            position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
            font-size: 18vw; font-weight: 900; color: rgba(255,255,255,0.03);
            white-space: nowrap; z-index: 1; pointer-events: none;
        }
        .hero-img {
            max-width: 120%; max-height: 80vh; z-index: 5;
            filter: drop-shadow(0 30px 50px rgba(0,0,0,0.4));
            transition: transform 0.5s ease;
        }

        /* Right: Sidebar */
        .sidebar {
            display: flex; flex-direction: column; justify-content: center; align-items: flex-end; gap: 20px;
        }
        .feature-item {
            text-align: right; background: var(--glass-bg); padding: 15px;
            border-radius: 15px; border: 1px solid var(--glass-border);
            width: 100%; max-width: 200px;
            transform: translateX(50px); opacity: 0; /* For Animation */
        }
        .feature-item i { color: var(--primary-color); font-size: 1.5rem; margin-bottom: 5px; }
        .feature-item h4 { font-size: 0.9rem; }

        /* Mobile Responsive */
        @media (max-width: 1024px) {
            body { overflow-y: auto; height: auto; padding-bottom: 50px; }
            .container { grid-template-columns: 1fr; text-align: center; height: auto; margin-top: 40px; }
            .details { padding: 0; order: 2; display: flex; flex-direction: column; align-items: center; }
            .hero-section { order: 1; height: 50vh; margin-bottom: 20px; }
            .hero-img { max-width: 80%; max-height: 400px; }
            .sidebar { display: none; }
            .controls-area { width: 100%; }
            .price-action { width: 100%; }
        }
    </style>
</head>
<body>

    <nav>
        <div class="logo">
            <img src="${mainLogo}" alt="Brand Logo">
        </div>
        <div class="nav-right">
            <div class="cart-btn">
                <i class="fas fa-shopping-bag"></i> <span id="cart-count">0</span>
            </div>
        </div>
    </nav>

    <main class="container">
        
        <div class="details">
            <span class="badge">${aiJson.marketing.offer_text}</span>
            <h1 class="split-text">${aiJson.headlines.main}</h1>
            <p class="sub-title">${aiJson.headlines.sub}</p>

            <div class="controls-area">
                <div class="variant-selector">
                    <span class="selector-label">SELECT STYLE</span>
                    <div class="colors-row" id="colors-container">
                        </div>
                </div>

                ${variants.sizes.enabled ? `
                <div class="variant-selector">
                    <span class="selector-label">SIZE</span>
                    <div style="display:flex; gap:10px; justify-content: ${variants.colors.items.length > 0 ? 'flex-start' : 'center'}">
                         ${variants.sizes.items.map(s => `<div style="padding:8px 15px; background:rgba(255,255,255,0.1); border-radius:5px; cursor:pointer; font-size:0.8rem;">${s.name}</div>`).join('')}
                    </div>
                </div>` : ''}

                <div class="price-action">
                    <div class="price">${productPrice}</div>
                    <button class="buy-btn">${aiJson.marketing.cta_text}</button>
                </div>
            </div>
        </div>

        <div class="hero-section">
            <div class="bg-text">${aiJson.headlines.bg_text}</div>
            <img src="${themesData[0].image}" alt="Product" class="hero-img" id="main-image">
        </div>

        <div class="sidebar">
            ${aiJson.features_short.map((f, i) => `
            <div class="feature-item">
                <i class="fas fa-star"></i>
                <h4>${f}</h4>
            </div>`).join('')}
        </div>

    </main>

    <script>
        // Data passed from Backend
        const themes = ${JSON.stringify(themesData)};

        // Initialize Animation
        document.addEventListener('DOMContentLoaded', () => {
            // GSAP Animations
            gsap.from(".hero-img", { duration: 1.5, y: -100, opacity: 0, ease: "elastic.out(1, 0.3)" });
            gsap.from(".bg-text", { duration: 1, scale: 0.5, opacity: 0, delay: 0.5 });
            gsap.from(".details > *", { duration: 0.8, x: -50, opacity: 0, stagger: 0.1, delay: 0.2 });
            gsap.to(".feature-item", { duration: 0.8, x: 0, opacity: 1, stagger: 0.2, delay: 1 });

            renderColors();
        });

        function renderColors() {
            const container = document.getElementById('colors-container');
            if(themes.length <= 1) {
                container.innerHTML = '<span style="font-size:0.9rem; opacity:0.6">Standard Edition</span>';
                return;
            }

            themes.forEach((theme, index) => {
                const dot = document.createElement('div');
                dot.className = \`color-dot \${index === 0 ? 'active' : ''}\`;
                dot.style.backgroundColor = theme.hex;
                dot.title = theme.name;
                dot.onclick = () => changeVariant(index);
                container.appendChild(dot);
            });
        }

        function changeVariant(index) {
            const theme = themes[index];
            const img = document.getElementById('main-image');
            const dots = document.querySelectorAll('.color-dot');
            
            // 1. Animate Out
            gsap.to(img, { 
                duration: 0.3, 
                scale: 0.8, 
                opacity: 0, 
                rotation: 15,
                onComplete: () => {
                    // 2. Change State
                    img.src = theme.image;
                    document.body.style.background = theme.bg_gradient;
                    document.documentElement.style.setProperty('--primary-color', theme.primary_color);
                    
                    // 3. Animate In
                    gsap.to(img, { duration: 0.6, scale: 1, opacity: 1, rotation: 0, ease: "back.out(1.7)" });
                } 
            });

            // Update Active Dot
            dots.forEach((d, i) => {
                if(i === index) d.classList.add('active');
                else d.classList.remove('active');
            });
            
            // Text Animation effect
            gsap.fromTo(".bg-text", {opacity: 0}, {opacity: 0.03, duration: 1});
        }
    </script>
</body>
</html>
        `;

        res.status(200).json({
            liquid_code: "N/A for HTML download mode", // يمكن إضافة كود Liquid لاحقاً
            schema: {},
            html: generatedHTML
        });

    } catch (error) {
        console.error("Server Error:", error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
}
