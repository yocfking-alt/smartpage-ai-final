// api/generate.js - الملف المحدث مع دعم الصور
import fetch from 'node-fetch';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
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
            customShippingPrice,
            productImage  // الصورة الجديدة
        } = req.body;

        if (!productName || !productFeatures) {
            return res.status(400).json({ error: 'Missing product details' });
        }

        const GEMINI_MODEL = 'gemini-2.5-flash'; 
        const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
        
        const shippingDetails = 
            shippingOption === 'free' 
            ? 'The landing page MUST emphasize Free Shipping in the Call-to-Action section.' 
            : `Shipping Cost: ${customShippingPrice || 'to be determined. Mention the cost clearly.'}`;

        const offerDetails = customOffer 
            ? `Primary Promotional Offer: ${customOffer}. Use this prominent text as the main incentive on the hero section and CTA.` 
            : 'No special promotion is provided. Focus on product value, features, and price.';

        // بناء الprompt مع تضمين معلومات الصورة
        let imageInstruction = '';
        if (productImage) {
            imageInstruction = `IMPORTANT: The user has provided a product image. You MUST include this image in the landing page design. Place it prominently in the hero section and ensure it looks professional and appealing. Use the following base64 image data in an <img> tag: ${productImage}`;
        }

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
            
            ${imageInstruction}
            
            --- Marketing and Logistics Details ---
            ${offerDetails}
            ${shippingDetails}
            
            The HTML must include:
            1. Full Tailwind CSS integration (via CDN link in the <head>).
            2. A compelling headline section (Hero) ${productImage ? 'with the product image displayed professionally' : ''}.
            3. A features section.
            4. A clear call-to-action (CTA) button that explicitly incorporates the price, offer, and shipping details provided.
            5. Use an elegant and effective color scheme based on the product category.
            ${productImage ? '6. The product image must be integrated beautifully and professionally in the design.' : ''}
        `;

        const geminiBody = {
            contents: [{
                parts: [{ text: prompt }]
            }],
            generationConfig: {
                temperature: 0.7,
            }
        };

        const response = await fetch(GEMINI_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(geminiBody),
        });

        const data = await response.json();

        if (!response.ok) {
            const errorMessage = data.error?.message || `Gemini API error: ${response.status}`;
            console.error('Gemini API Error:', data);
            return res.status(500).json({ error: 'Failed to generate page: ' + errorMessage });
        }
        
        const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!generatedText) {
            return res.status(500).json({ error: 'AI failed to return valid content.' });
        }
        
        res.status(200).json({ html: generatedText });

    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ error: 'Internal Server Error (Check Vercel Logs)' });
    }
}
