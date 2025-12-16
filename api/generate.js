// api/generate.js
import fetch from 'node-fetch'; 

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        if (!GEMINI_API_KEY) {
            return res.status(500).json({ error: 'GEMINI_API_KEY is not set in Vercel Environment Variables' });
        }

        const { 
            productName, 
            productFeatures, 
            designDescription,
            productPrice,
            productCategory,
            targetAudience,
            shippingOption,
            customShippingPrice,
            customOffer
        } = req.body;

        if (!productName || !productFeatures) {
            return res.status(400).json({ error: 'Missing productName or productFeatures' });
        }

        const GEMINI_MODEL = 'gemini-1.5-pro'; 
        const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
        
        // **********************************************
        // * التوجيه الحاسم لإنشاء كود Shopify Section *
        // **********************************************
        const prompt = `
            You are an expert Shopify developer specializing in creating high-converting, responsive Liquid Sections.
            Your task is to generate the full code for a Shopify Section based on the user's input.
            
            Product Name: ${productName}
            Key Features/Selling Points: ${productFeatures}
            Design Style: ${designDescription}
            Product Price: ${productPrice}
            Product Category: ${productCategory}
            Target Audience: ${targetAudience}
            
            The output MUST strictly be a single JSON object (nothing before or after the JSON) with two main keys:
            1. "liquid_code": A string containing the entire Shopify Liquid code for the Section (the HTML structure and Liquid logic).
            2. "schema": A valid JSON object representing the Shopify Section Schema, defining the settings and presets.
            
            The Liquid code must use the settings defined in the "schema". The Section must be modern, responsive (using CSS, not Tailwind utility classes), and follow Shopify best practices. Do not use external libraries.
            
            Return the result ONLY as a raw JSON object. Do not include any explanation or markdown formatting like \`\`\`json.
        `;

        const geminiBody = {
            contents: [{
                parts: [{ text: prompt }]
            }],
            generationConfig: {
                responseMimeType: "application/json"
            }
        };

        const response = await fetch(GEMINI_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(geminiBody),
        });

        const rawData = await response.text();
        let data;
        
        try {
            data = JSON.parse(rawData);
        } catch (e) {
            console.error('Failed parsing AI response:', rawData);
            return res.status(500).json({ error: 'AI returned non-JSON data. Please try again.' });
        }

        if (!response.ok) {
            const errorMessage = data.error?.message || `Gemini API error: ${response.status}`;
            console.error('Gemini API Error:', data);
            return res.status(500).json({ error: 'Failed to generate page: ' + errorMessage });
        }
        
        const generatedContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!generatedContent || typeof generatedContent !== 'string') {
            console.error('AI returned no valid text content. Full response:', JSON.stringify(data, null, 2));
            return res.status(500).json({ 
                error: 'AI failed to return valid content (undefined). Check your GEMINI_API_KEY in Vercel.'
            });
        }

        let parsedSection;
        try {
            const cleanContent = generatedContent.replace(/```json\s*|```/g, '').trim();
            parsedSection = JSON.parse(cleanContent);
        } catch (e) {
            console.error('Failed to parse final section JSON:', generatedContent);
            return res.status(500).json({ error: 'AI output format error. Could not parse liquid_code and schema.' });
        }

        // **********************************************
        // * إنشاء صفحة HTML كاملة للمعاينة *
        // **********************************************
        const previewHTML = `
<!DOCTYPE html>
<html lang="ar">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${productName}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        body {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .landing-page {
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            overflow: hidden;
            max-width: 1200px;
            width: 100%;
        }
        .hero-section {
            background: linear-gradient(135deg, #1D4ED8 0%, #3B82F6 100%);
            color: white;
            padding: 60px 40px;
            text-align: center;
        }
        .hero-section h1 {
            font-size: 3rem;
            margin-bottom: 20px;
            font-weight: 700;
        }
        .hero-section p {
            font-size: 1.2rem;
            margin-bottom: 30px;
            opacity: 0.9;
        }
        .price-tag {
            background: #10B981;
            color: white;
            padding: 15px 30px;
            border-radius: 50px;
            font-size: 1.5rem;
            font-weight: bold;
            display: inline-block;
            margin-bottom: 30px;
        }
        .cta-button {
            background: #F59E0B;
            color: white;
            padding: 15px 40px;
            border-radius: 50px;
            text-decoration: none;
            font-size: 1.1rem;
            font-weight: bold;
            display: inline-block;
            transition: transform 0.3s ease;
        }
        .cta-button:hover {
            transform: translateY(-3px);
        }
        .features-section {
            padding: 60px 40px;
            background: #F8FAFC;
        }
        .features-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 30px;
            margin-top: 40px;
        }
        .feature-card {
            background: white;
            padding: 30px;
            border-radius: 15px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
            text-align: center;
        }
        .feature-card i {
            font-size: 2.5rem;
            color: #1D4ED8;
            margin-bottom: 20px;
        }
        .feature-card h3 {
            color: #1F2937;
            margin-bottom: 15px;
            font-size: 1.3rem;
        }
        .feature-card p {
            color: #6B7280;
            line-height: 1.6;
        }
        .guarantee-section {
            background: #1D4ED8;
            color: white;
            padding: 40px;
            text-align: center;
        }
        .offer-banner {
            background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%);
            color: white;
            padding: 20px;
            text-align: center;
            font-size: 1.2rem;
            font-weight: bold;
        }
        .shipping-info {
            background: #ECFDF5;
            color: #065F46;
            padding: 15px;
            text-align: center;
            margin: 20px 0;
            border-radius: 10px;
        }
        @media (max-width: 768px) {
            .hero-section h1 {
                font-size: 2rem;
            }
            .hero-section {
                padding: 40px 20px;
            }
        }
    </style>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
</head>
<body>
    <div class="landing-page">
        ${customOffer ? `
        <div class="offer-banner">
            🎁 ${customOffer}
        </div>
        ` : ''}

        <section class="hero-section">
            <h1>${productName}</h1>
            <p>${productFeatures.split('.')[0] || 'منتج مبتكر ومميز'}</p>
            <div class="price-tag">${productPrice || '$29.99'}</div>
            
            ${shippingOption === 'free' ? `
            <div class="shipping-info">
                🚚 شحن مجاني على جميع الطلبات
            </div>
            ` : customShippingPrice ? `
            <div class="shipping-info">
                🚚 رسوم الشحن: ${customShippingPrice}
            </div>
            ` : ''}
            
            <br>
            <a href="#order" class="cta-button">
                <i class="fas fa-shopping-cart"></i> احصل عليه الآن
            </a>
        </section>

        <section class="features-section">
            <h2 style="text-align: center; color: #1F2937; font-size: 2.5rem; margin-bottom: 20px;">لماذا تختار ${productName}؟</h2>
            <div class="features-grid">
                ${productFeatures.split('.').filter(f => f.trim()).slice(0, 6).map(feature => `
                    <div class="feature-card">
                        <i class="fas fa-check-circle"></i>
                        <h3>ميزة فريدة</h3>
                        <p>${feature.trim()}</p>
                    </div>
                `).join('')}
            </div>
        </section>

        <section class="guarantee-section">
            <h2><i class="fas fa-shield-alt"></i> ضمان 100% للرضا</h2>
            <p style="margin-top: 15px; opacity: 0.9;">${productCategory === 'electronics' ? 'ضمان 30 يوم للإرجاع' : 
              productCategory === 'beauty' ? 'ضمان الجودة والكفاءة' : 
              productCategory === 'fashion' ? 'ضمان المقاس والجودة' : 
              'نضمن لك الجودة والكفاءة في كل منتج'}</p>
        </section>
    </div>
</body>
</html>
`;

        // إرجاع البيانات مع HTML للمعاينة
        res.status(200).json({
            ...parsedSection,
            html: previewHTML
        });

    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ error: 'Internal Server Error (Check Vercel Logs)' });
    }
}
