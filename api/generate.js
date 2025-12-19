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

        const GEMINI_MODEL = 'gemini-2.5-flash'; 
        const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
        
        // **********************************************
        // * NEW PROMPT BASED ON AI_STUDIO_CODE *
        // **********************************************
        const prompt = `
            [span_0](start_span)Act as a world-class "Conversion Rate Optimization (CRO) Architect" and "Senior UI/UX Designer".[span_0](end_span)
            
            Your input is a product description:
            Product Name: "${productName}"
            Features: "${productFeatures}"
            Category: "${productCategory}"
            Target Audience: "${targetAudience}"
            Price: "${productPrice}"
            Design Preference: "${designDescription}"
            Offer: "${customOffer || 'No specific offer'}"
            Shipping: "${shippingOption === 'free' ? 'Free Shipping' : customShippingPrice}"

            Your task is to deeply INFER the missing details:
            1. [span_1](start_span)Identify the specific target audience (Persona).[span_1](end_span)
            2. [span_2](start_span)Determine the core "Pain Point" this product solves.[span_2](end_span)
            3. Invent a Unique Selling Proposition (USP).

            **Objective:**
            [span_3](start_span)Create a high-performance, mobile-first landing page that feels like a premium brand experience.[span_3](end_span)

            **Psychological & Content Rules (Arabic Language):**
            1. **Language:** Write in persuasive, high-impact Arabic (Copywriting aimed at sales). [span_4](start_span)NO "Lorem Ipsum".[span_4](end_span)
            2. **[span_5](start_span)The Hook (Hero):** Sell the "Transformation" (e.g., "Don't buy a watch, buy time").[span_5](end_span)
            3. **[span_6](start_span)The Agitation:** A section dedicated to the problem the user faces without this product.[span_6](end_span)
            4. **[span_7](start_span)The Solution:** How this product specifically solves that problem.[span_7](end_span)
            5. **[span_8](start_span)Social Proof:** Invent realistic testimonials and trust badges (e.g., "Guaranteed by...", "5000+ Sold").[span_8](end_span)
            6. **[span_9](start_span)Scarcity:** Add a dynamic "Limited Time Offer" section.[span_9](end_span)

            **Visual & Design Rules (CSS Masterclass):**
            1. **[span_10](start_span)Adaptive Design System:**[span_10](end_span)
               - If Category = Beauty/Luxury -> Use Dark Mode/Gold or Minimalist Serif.
               - [span_11](start_span)If Category = Health -> Use White, Mint, Blue.[span_11](end_span)
               - [span_12](start_span)If Category = Electronics -> Use Vibrant Gradients, Glassmorphism.[span_12](end_span)
            2. **[span_13](start_span)Visual Hierarchy:** Use distinct background colors for sections.[span_13](end_span)
            3. **[span_14](start_span)No External Images:** Use CSS Gradients and high-quality Emojis as icons/graphics.[span_14](end_span)
            4. **Typography:** Use Google Fonts (Cairo or Tajawal).

            **Output Structure (Strict JSON Only):**
            You must return a valid JSON object with exactly these keys. Do not include markdown formatting.
            {
              "liquid_code": "The complete Shopify Liquid Section code (HTML + Liquid tags). It must include schema settings for customization.",
              "schema": "A valid JSON object representing the Shopify Section Schema (settings, presets) extracted from the liquid code.",
              [span_15](start_span)"html_preview": "A complete, standalone index.html file (HTML5 + Internal CSS). It must be fully responsive, visually stunning, Arabic (RTL), and ready to deploy. Include a 'Buy Now' fixed bottom bar for mobile.[span_15](end_span)"
            }
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

        if (!generatedContent) {
            return res.status(500).json({ 
                error: 'AI failed to return valid content.'
            });
        }

        let parsedSection;
        try {
            const cleanContent = generatedContent.replace(/```json\s*|```/g, '').trim();
            parsedSection = JSON.parse(cleanContent);
        } catch (e) {
            console.error('Failed to parse final section JSON:', generatedContent);
            return res.status(500).json({ error: 'AI output format error.' });
        }

        // **********************************************
        // * Return Data to Frontend *
        // **********************************************
        // نستخدم الـ HTML الذي ولده الذكاء الاصطناعي (html_preview) لأنه يتبع قواعد التصميم الجديدة
        // بدلاً من القالب اليدوي القديم.
        
        res.status(200).json({
            liquid_code: parsedSection.liquid_code,
            schema: parsedSection.schema,
            html: parsedSection.html_preview // Use the AI-generated High-Fidelity HTML
        });

    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}
