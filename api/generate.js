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
        const { 
            productName, productFeatures, productPrice, 
            productImages, variants 
        } = req.body;

        // 1. تجهيز الصور
        const images = productImages || [];
        const mainImage = images.length > 0 ? images[0] : 'https://via.placeholder.com/500x500?text=No+Image';

        // 2. بناء منطق الألوان الديناميكي (RideStore Logic)
        // نحتاج لتحويل بيانات الألوان القادمة من المستخدم إلى هيكل يفهمه القالب الجديد
        let colorLogicJS = "";
        let colorButtonsHTML = "";
        let firstColorKey = "";

        if (variants && variants.colors && variants.colors.items.length > 0) {
            let colorsData = {};
            
            variants.colors.items.forEach((item, index) => {
                const key = item.name.toLowerCase().replace(/\s+/g, '-'); // مثلاً "Dark Blue" تصبح "dark-blue"
                if (index === 0) firstColorKey = key;

                // تحديد الصورة المرتبطة باللون
                let colorImg = mainImage;
                if (item.imgIndex !== "" && item.imgIndex !== null && images[item.imgIndex]) {
                    colorImg = images[item.imgIndex];
                }

                colorsData[key] = {
                    color: item.hex, // لون الخلفية الرئيسي
                    // نصنع تدرج لوني بناءً على لون المستخدم
                    bgGradient: `radial-gradient(circle at center, ${item.hex}, #000000)`, 
                    name: item.name.toUpperCase(),
                    imgSrc: colorImg
                };

                // إنشاء زر اللون
                const activeClass = index === 0 ? 'active' : '';
                colorButtonsHTML += `<div class="color-circle ${activeClass}" style="background-color: ${item.hex};" onclick="changeColor('${key}', this)" title="${item.name}"></div>`;
            });

            // تحويل كائن البيانات إلى نص JS لحقنه في الصفحة
            colorLogicJS = `const productData = ${JSON.stringify(colorsData)};`;
        } else {
            // بيانات افتراضية في حال لم يرفع المستخدم ألوان
            firstColorKey = 'default';
            const defaultData = {
                'default': {
                    color: '#4daeb3',
                    bgGradient: 'radial-gradient(circle at center, #4daeb3, #000000)',
                    name: productName.toUpperCase(),
                    imgSrc: mainImage
                }
            };
            colorLogicJS = `const productData = ${JSON.stringify(defaultData)};`;
            colorButtonsHTML = `<div class="color-circle active" style="background-color: #4daeb3;" onclick="changeColor('default', this)"></div>`;
        }

        // 3. بناء أزرار المقاسات
        let sizesHTML = "";
        if (variants && variants.sizes && variants.sizes.items.length > 0) {
            variants.sizes.items.forEach((size, index) => {
                const activeClass = index === 0 ? 'active' : '';
                sizesHTML += `<div class="size-box ${activeClass}" onclick="selectSize(this, '${size.name}')">${size.name}</div>`;
            });
        } else {
            sizesHTML = `<div class="size-box active">Free</div>`;
        }

        // 4. دمج القالب (RideStore Template)
        // قمت بدمج CSS و HTML و JS في سلسلة واحدة، مع إضافة Modal للطلب
        const finalHTML = `
<!DOCTYPE html>
<html lang="ar" dir="ltr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${productName}</title>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;500;700;900&family=Tajawal:wght@400;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <style>
        :root {
            --bg-color: #4daeb3;
            --text-color: #ffffff;
            --glass-bg: rgba(255, 255, 255, 0.1);
            --transition-speed: 0.6s;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Poppins', 'Tajawal', sans-serif; }
        body {
            background: radial-gradient(circle at center, var(--bg-color), #000000);
            background-size: 200% 200%;
            min-height: 100vh;
            color: var(--text-color);
            overflow-x: hidden;
            transition: background 0.8s ease;
        }
        /* Navbar */
        nav { display: flex; justify-content: space-between; align-items: center; padding: 20px 5%; z-index: 100; position: relative; }
        .logo { font-size: 1.5rem; font-weight: 700; display: flex; align-items: center; gap: 10px; }
        
        /* Layout */
        .container {
            display: grid;
            grid-template-columns: 1.2fr 1fr 0.5fr;
            min-height: calc(100vh - 80px);
            padding: 0 5%;
            align-items: center;
            position: relative;
        }
        
        /* Details Section */
        .details { z-index: 10; animation: fadeInLeft 1s ease; }
        .brand-tag { background: var(--glass-bg); padding: 5px 15px; border-radius: 20px; font-size: 0.8rem; display: inline-block; margin-bottom: 20px; backdrop-filter: blur(5px); }
        h1 { font-size: 3.5rem; line-height: 1.1; text-transform: uppercase; margin-bottom: 20px; }
        .color-name { display: block; font-weight: 300; color: rgba(255,255,255,0.8); font-size: 2rem;}
        .description { margin-bottom: 30px; font-size: 0.9rem; opacity: 0.8; max-width: 400px; line-height: 1.6; }

        /* Selectors */
        .selector-group { margin-bottom: 25px; }
        .selector-label { font-size: 0.9rem; margin-bottom: 10px; display: block; letter-spacing: 1px; }
        .sizes { display: flex; gap: 10px; flex-wrap: wrap; }
        .size-box { width: 45px; height: 45px; border: 2px solid rgba(255,255,255,0.3); display: flex; justify-content: center; align-items: center; border-radius: 8px; cursor: pointer; transition: 0.3s; font-weight: bold; }
        .size-box:hover, .size-box.active { background: white; color: black; border-color: white; transform: translateY(-2px); }
        
        .colors { display: flex; gap: 15px; }
        .color-circle { width: 40px; height: 40px; border-radius: 50%; cursor: pointer; border: 3px solid transparent; transition: 0.3s; box-shadow: 0 5px 15px rgba(0,0,0,0.2); }
        .color-circle.active { border-color: white; transform: scale(1.15); box-shadow: 0 0 15px var(--bg-color); }

        /* Purchase */
        .purchase-info { display: flex; align-items: center; gap: 20px; margin-top: 30px; }
        .price-box { width: 100px; height: 100px; border: 1px solid rgba(255,255,255,0.4); display: flex; flex-direction: column; justify-content: center; align-items: center; background: rgba(0,0,0,0.1); backdrop-filter: blur(5px); clip-path: polygon(20% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 20%); transition: 0.3s; }
        .price-box:hover { background: white; color: black; }
        .price-box strong { font-size: 1.4rem; }
        
        .buy-btn { background: white; color: black; padding: 20px 50px; border: none; border-radius: 40px; font-weight: 800; cursor: pointer; text-transform: uppercase; transition: all 0.3s; font-size: 1.1rem; letter-spacing: 1px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); }
        .buy-btn:hover { transform: translateY(-5px) scale(1.05); box-shadow: 0 20px 40px rgba(0,0,0,0.4); }

        /* Hero Image */
        .hero-image-container { position: relative; height: 100%; display: flex; justify-content: center; align-items: center; perspective: 1000px; }
        .bg-text { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 12vw; font-weight: 900; color: rgba(255,255,255,0.03); z-index: 1; white-space: nowrap; pointer-events: none; }
        .hero-img { max-width: 120%; height: auto; filter: drop-shadow(0 30px 60px rgba(0,0,0,0.6)); transition: all 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275); z-index: 5; }
        
        /* Sidebar */
        .sidebar { display: flex; flex-direction: column; justify-content: space-between; height: 60%; align-items: flex-end; padding-right: 20px; animation: fadeInRight 1s ease; }
        .stats { text-align: right; margin-top: auto; }
        .stats h3 { font-size: 2rem; font-weight: 700; }

        /* ORDER MODAL (Form) */
        .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); z-index: 999; display: none; justify-content: center; align-items: center; backdrop-filter: blur(8px); opacity: 0; transition: opacity 0.3s; }
        .modal-overlay.open { display: flex; opacity: 1; }
        .order-form-card { background: white; color: #333; padding: 40px; border-radius: 20px; width: 90%; max-width: 500px; position: relative; transform: translateY(50px); transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
        .modal-overlay.open .order-form-card { transform: translateY(0); }
        .close-modal { position: absolute; top: 20px; right: 20px; font-size: 24px; cursor: pointer; color: #666; }
        .form-group { margin-bottom: 15px; }
        .form-group label { display: block; font-size: 0.9rem; font-weight: 600; margin-bottom: 5px; }
        .form-group input { width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 1rem; }
        .submit-order-btn { width: 100%; background: #000; color: white; padding: 15px; border: none; border-radius: 10px; font-weight: bold; font-size: 1.1rem; cursor: pointer; margin-top: 10px; }
        .submit-order-btn:hover { background: #333; }

        /* Animations */
        @keyframes fadeInLeft { from { opacity: 0; transform: translateX(-50px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes fadeInRight { from { opacity: 0; transform: translateX(50px); } to { opacity: 1; transform: translateX(0); } }

        /* Responsive */
        @media (max-width: 1024px) {
            h1 { font-size: 2.5rem; }
            .container { grid-template-columns: 1fr; text-align: center; height: auto; padding-top: 40px; padding-bottom: 40px; }
            .sidebar, .bg-text { display: none; }
            .hero-image-container { order: -1; height: 350px; margin-bottom: 30px; }
            .hero-img { max-width: 70%; }
            .details { display: flex; flex-direction: column; align-items: center; }
            .description { text-align: center; }
            .purchase-info { flex-direction: column; width: 100%; gap: 15px; }
            .buy-btn { width: 100%; }
            .colors, .sizes { justify-content: center; }
        }
    </style>
</head>
<body>

    <nav>
        <div class="logo"><i class="fas fa-bolt"></i> STORE</div>
        <div class="nav-icons" style="color:white; cursor:pointer;" onclick="openModal()">
            <i class="fas fa-shopping-bag fa-lg"></i>
        </div>
    </nav>

    <main class="container">
        
        <div class="details">
            <span class="brand-tag">PREMIUM</span>
            
            <h1 id="product-title">
                ${productName}<br>
                <span class="color-name" id="color-text-display"></span>
            </h1>

            <p class="description">${productFeatures}</p>

            <div class="selector-group">
                <span class="selector-label">المقاسات المتاحة</span>
                <div class="sizes">
                    ${sizesHTML}
                </div>
            </div>

            <div class="selector-group">
                <span class="selector-label">الألوان</span>
                <div class="colors">
                    ${colorButtonsHTML}
                </div>
            </div>

            <div class="purchase-info">
                <div class="price-box">
                    <span>السعر</span>
                    <strong>${productPrice}</strong>
                </div>
                <button class="buy-btn" onclick="openModal()">اشتري الآن <i class="fas fa-arrow-right" style="margin-left:10px; font-size:0.9em;"></i></button>
            </div>
        </div>

        <div class="hero-image-container">
            <div class="bg-text">${productName}</div>
            <img src="${mainImage}" alt="${productName}" class="hero-img" id="main-image">
        </div>

        <div class="sidebar">
            <div class="thumbnails" id="thumbs-container">
                </div>
            <div class="stats">
                <h3>+1000</h3>
                <p>زبون سعيد</p>
                <div style="margin-top:10px; color:#ffdd00;">
                    <i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i>
                </div>
            </div>
        </div>

    </main>

    <div id="order-modal" class="modal-overlay">
        <div class="order-form-card">
            <span class="close-modal" onclick="closeModal()">&times;</span>
            <h2 style="margin-bottom:20px; border-bottom:1px solid #eee; padding-bottom:10px;">إتمام الطلب</h2>
            <form id="checkout-form">
                <input type="hidden" id="final-color" name="color">
                <input type="hidden" id="final-size" name="size">
                
                <div class="form-group">
                    <label>الاسم الكامل</label>
                    <input type="text" placeholder="الاسم واللقب" required>
                </div>
                <div class="form-group">
                    <label>رقم الهاتف</label>
                    <input type="tel" placeholder="05/06/07..." required>
                </div>
                <div class="form-group">
                    <label>العنوان / الولاية</label>
                    <input type="text" placeholder="العنوان الكامل" required>
                </div>
                
                <div style="background:#f9f9f9; padding:15px; border-radius:8px; margin-bottom:15px; display:flex; justify-content:space-between; align-items:center;">
                    <span>المجموع الكلي:</span>
                    <strong style="font-size:1.2rem; color:#d32f2f;">${productPrice}</strong>
                </div>

                <button type="submit" class="submit-order-btn">تأكيد الطلب (الدفع عند الاستلام)</button>
            </form>
        </div>
    </div>

    <script>
        // 1. حقن بيانات الألوان من السيرفر
        ${colorLogicJS}

        // 2. إعدادات الحالة الأولية
        let currentSelection = {
            color: '${firstColorKey}',
            size: document.querySelector('.size-box.active')?.innerText || 'Standard'
        };

        // دالة التهيئة عند التحميل
        window.onload = function() {
            if(productData[currentSelection.color]) {
                changeColor(currentSelection.color, document.querySelector('.color-circle.active'));
            }
            // تعبئة الصور المصغرة بشكل عشوائي للزينة (أو يمكن استخدام صور المنتج الفعلية)
            const thumbs = document.getElementById('thumbs-container');
            const keys = Object.keys(productData);
            keys.slice(0, 3).forEach(k => {
                const img = document.createElement('img');
                img.src = productData[k].imgSrc;
                img.style = "width:60px; height:60px; border-radius:10px; margin-bottom:10px; cursor:pointer; object-fit:contain; background:rgba(255,255,255,0.1); padding:5px;";
                img.onclick = () => changeColor(k, null); // يمكن الضغط على الصورة المصغرة لتغيير اللون
                thumbs.appendChild(img);
            });
        };

        // 3. دالة تغيير اللون (Core Logic)
        function changeColor(key, element) {
            const data = productData[key];
            if(!data) return;

            currentSelection.color = data.name;
            document.getElementById('final-color').value = data.name;

            // تغيير متغيرات الـ CSS للجذر
            document.documentElement.style.setProperty('--bg-color', data.color);
            document.body.style.background = data.bgGradient;

            // تغيير النصوص
            const colorText = document.getElementById('color-text-display');
            colorText.style.opacity = 0;
            setTimeout(() => {
                colorText.innerText = data.name;
                colorText.style.opacity = 1;
            }, 300);

            // تغيير الصورة الرئيسية مع أنيميشن
            const img = document.getElementById('main-image');
            img.style.transform = 'scale(0.8) rotate(-10deg) translateX(-50px)';
            img.style.opacity = 0;
            
            setTimeout(() => {
                img.src = data.imgSrc;
                img.style.transform = 'scale(1) rotate(0deg) translateX(0)';
                img.style.opacity = 1;
            }, 400);

            // تحديث حالة الأزرار
            if(element) {
                document.querySelectorAll('.color-circle').forEach(el => el.classList.remove('active'));
                element.classList.add('active');
            }
        }

        // 4. اختيار المقاس
        function selectSize(element, size) {
            document.querySelectorAll('.size-box').forEach(el => el.classList.remove('active'));
            element.classList.add('active');
            currentSelection.size = size;
            document.getElementById('final-size').value = size;
        }

        // 5. منطق المودال (النافذة المنبثقة)
        function openModal() {
            document.getElementById('order-modal').classList.add('open');
        }
        function closeModal() {
            document.getElementById('order-modal').classList.remove('open');
        }
        
        // إغلاق المودال عند الضغط في الخارج
        document.getElementById('order-modal').addEventListener('click', (e) => {
            if(e.target === document.getElementById('order-modal')) closeModal();
        });

        // 6. التعامل مع الفورم (إرسال وهمي)
        document.getElementById('checkout-form').addEventListener('submit', function(e) {
            e.preventDefault();
            const btn = this.querySelector('button');
            const originalText = btn.innerText;
            btn.innerText = 'جاري المعالجة...';
            btn.disabled = true;
            
            setTimeout(() => {
                alert('شكراً لك! تم استلام طلبك بنجاح. سنتصل بك قريباً.');
                closeModal();
                btn.innerText = originalText;
                btn.disabled = false;
            }, 1500);
        });

    </script>
</body>
</html>
        `;

        res.status(200).json({
            html: finalHTML,
            // يمكن ترك كود Liquid فارغاً أو إعداده لاحقاً إذا كنت تستخدم Shopify
            liquid_code: "", 
            schema: {}
        });

    } catch (error) {
        console.error("Server Error:", error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
}
