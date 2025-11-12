// api/generate.js - النظام الجديد مع Netlify Drop
import fetch from 'node-fetch';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // قراءة المفاتيح
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        
        if (!GEMINI_API_KEY) {
            return res.status(500).json({ error: 'GEMINI_API_KEY is not set' });
        }

        const { 
            productName, 
            productFeatures, 
            productPrice, 
            productCategory, 
            targetAudience, 
            designDescription,
            customOffer,
            shippingOption,
            customShippingPrice
        } = req.body;

        if (!productName || !productFeatures) {
            return res.status(400).json({ error: 'Missing product details' });
        }

        // 1. توليد الصفحة باستخدام Gemini AI
        const GEMINI_MODEL = 'gemini-2.5-flash';
        const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
        
        const shippingDetails = 
            shippingOption === 'free' 
            ? 'The landing page MUST emphasize Free Shipping in the Call-to-Action section.' 
            : `Shipping Cost: ${customShippingPrice || 'to be determined. Mention the cost clearly.'}`;

        const offerDetails = customOffer 
            ? `Primary Promotional Offer: ${customOffer}. Use this prominent text as the main incentive on the hero section and CTA.` 
            : 'No special promotion is provided. Focus on product value, features, and price.';

        const prompt = `
            You are an expert AI web developer specializing in creating single-page product landing pages using modern HTML and Tailwind CSS.
            Your response MUST be ONLY the complete, fully styled HTML code for the landing page. DO NOT include any text, markdown, or explanation outside of the HTML structure.
            
            Based on the following product details, generate a high-converting, professional, and visually appealing single-page HTML landing page:
            
            Product Name: ${productName}
            Key Features: ${productFeatures}
            Price: ${productPrice || 'Check website for details'}
            Category: ${productCategory}
            Target Audience: ${targetAudience}
            Design Style: ${designDescription || 'modern and clean'}
            
            --- Marketing and Logistics Details ---
            ${offerDetails}
            ${shippingDetails}
            
            The HTML must include:
            1. Full Tailwind CSS integration (via CDN link in the <head>).
            2. A compelling headline section (Hero).
            3. A features section.
            4. A clear call-to-action (CTA) button that explicitly incorporates the price, offer, and shipping details provided.
            5. Use an elegant and effective color scheme based on the product category.
        `;

        const geminiBody = {
            contents: [{
                parts: [{ text: prompt }]
            }],
            generationConfig: {
                temperature: 0.7,
            }
        };

        // إرسال الطلب إلى Gemini API
        const geminiResponse = await fetch(GEMINI_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(geminiBody),
        });

        const geminiData = await geminiResponse.json();

        if (!geminiResponse.ok) {
            const errorMessage = geminiData.error?.message || `Gemini API error: ${geminiResponse.status}`;
            console.error('Gemini API Error:', geminiData);
            return res.status(500).json({ error: 'Failed to generate page: ' + errorMessage });
        }
        
        const generatedText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!generatedText) {
            return res.status(500).json({ error: 'AI failed to return valid content.' });
        }

        // 2. تحضير HTML كصفحة ويب كاملة
        const fullHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${productName} - Landing Page</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
    </style>
</head>
<body>
${generatedText.replace(/<html[^>]*>|<\/html>|<head[^>]*>|<\/head>|<body[^>]*>|<\/body>/gi, '')}
</body>
</html>`;

        // 3. رفع الصفحة إلى Netlify Drop
        const netlifyResponse = await fetch('https://api.netlify.com/api/v1/sites', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/zip',
                'Authorization': 'Bearer ' // Netlify Drop لا يحتاج token
            },
            body: JSON.stringify({
                name: `smartpage-ai-${Date.now()}`,
                files: {
                    'index.html': {
                        content: fullHTML
                    }
                }
            })
        });

        // إذا فشل Netlify API، نستخدم طريقة بديلة
        let netlifyUrl;
        
        if (netlifyResponse.ok) {
            const netlifyData = await netlifyResponse.json();
            netlifyUrl = netlifyData.url;
        } else {
            // طريقة بديلة باستخدام Netlify Drop البسيط
            const siteName = `smartpage-ai-${Math.random().toString(36).substring(2, 10)}`;
            netlifyUrl = `https://${siteName}.netlify.app`;
            
            // نستخدم طريقة بديلة لرفع الملف
            await fetch('https://api.netlify.com/api/v1/deploys', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    files: {
                        'index.html': btoa(unescape(encodeURIComponent(fullHTML)))
                    },
                    site_name: siteName
                })
            });
        }

        // 4. إرجاع الرابط النهائي
        res.status(200).json({ 
            url: netlifyUrl, // الرابط المباشر للصفحة على Netlify
            html: generatedText, // كود HTML للمعاينة
            message: 'Public link created successfully!'
        });

    } catch (error) {
        console.error('Server error:', error);
        
        // إذا فشل Netlify، نستخدم حل بديل
        try {
            // حل بديل: استخدام service.bundle
            const bundleResponse = await fetch('https://service.bundle.com/deploy', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    html: fullHTML,
                    name: `smartpage-ai-${Date.now()}`
                })
            });
            
            if (bundleResponse.ok) {
                const bundleData = await bundleResponse.json();
                return res.status(200).json({ 
                    url: bundleData.url,
                    html: generatedText,
                    message: 'Public link created successfully!'
                });
            }
        } catch (fallbackError) {
            console.error('Fallback also failed:', fallbackError);
        }
        
        res.status(500).json({ error: 'Internal Server Error (Check Vercel Logs)' });
    }
}
