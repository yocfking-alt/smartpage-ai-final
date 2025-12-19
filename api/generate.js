// api/generate.js - النسخة المتوافقة مع البرومبت الجديد
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
        // * البرومبت الجديد المعدل للتكامل *
        // **********************************************
        const prompt = `
Act as a world-class "Conversion Rate Optimization (CRO) Architect" and "Senior UI/UX Designer".
Your input is a simple product description: "${productName}" (Context: ${productFeatures}. Category: ${productCategory}).

ADDITIONAL CONTEXT:
- Product Price: ${productPrice || 'Not specified'}
- Target Audience: ${targetAudience || 'To be inferred'}
- Design Style: ${designDescription || 'Modern and professional'}
- Shipping Option: ${shippingOption || 'Standard'} ${customShippingPrice ? `(${customShippingPrice})` : ''}
- Special Offer: ${customOffer || 'None'}

IMPORTANT: The user input might be very brief. Your first task is to deeply INFER the missing details:
1. Identify the specific target audience (Persona).
2. Determine the core "Pain Point" this product solves.
3. Invent a Unique Selling Proposition (USP) if not provided.

**Objective:**
Create a high-performance, mobile-first landing page that feels like a premium brand experience, not a template.

**Psychological & Content Rules (Arabic Language):**
1. **Language:** Write in persuasive, high-impact Arabic (Copywriting aimed at sales). NO "Lorem Ipsum".
2. **The Hook (Hero):** Don't just list the product. Sell the "Transformation" (e.g., "Don't buy a watch, buy time").
3. **The Agitation:** A section dedicated to the problem the user faces without this product.
4. **The Solution:** How this product specifically solves that problem.
5. **Social Proof:** Invent realistic testimonials and trust badges (e.g., "Guaranteed by...", "5000+ Sold").
6. **Scarcity:** Add a dynamic "Limited Time Offer" section with a crossed-out price.

**Visual & Design Rules (CSS Masterclass):**
1. **Adaptive Design System:**
   - If Product = Luxury (e.g., iPhone, Perfume) -> Use Dark Mode, Gold/Silver accents, Serif fonts, Minimalist UI.
   - If Product = Health/Clean -> Use White, Mint, Blue, Soft Shadows.
   - If Product = Tech/Gadget -> Use Vibrant Gradients, Glassmorphism, Neon accents.
2. **Visual Hierarchy:** Use distinct background colors for sections to break visual monotony.
3. **No External Images:** Use CSS Gradients and high-quality Emojis as icons/graphics to ensure the page renders perfectly without broken image links. Use colorful \`div\` placeholders for the main product image.
4. **Typography:** Use Google Fonts (Cairo or Tajawal) for a modern Arabic look.

**SHOPIFY INTEGRATION SPECIFICS:**
1. **Liquid Code Requirements:**
   - Must be a valid Shopify Section with proper schema settings
   - Include at least 5 customizable options in the schema
   - Use Liquid variables for dynamic content: {{ product.title }}, {{ product.price }}, etc.
   - Add proper schema.org structured data for products
2. **Schema Structure:** Must include:
   - Name of the section
   - Settings for colors, text, and images
   - Presets for different product types
   - Blocks if necessary for flexible content

**DUAL OUTPUT FORMAT (Strict JSON Only):**
Return ONLY a JSON object with these exact keys:

{
  "liquid_code": "FULL Shopify Liquid code with complete schema and settings for the section",
  "schema": "Valid JSON object representing the Shopify Section Schema with presets and settings",
  "preview_html": "A complete, standalone HTML file with internal CSS, no external dependencies, fully responsive, with Arabic content and mobile-first design"
}

IMPORTANT: The "preview_html" must be a complete HTML document that can be rendered immediately.
        `;

        const geminiBody = {
            contents: [{
                parts: [{ text: prompt }]
            }],
            generationConfig: {
                responseMimeType: "application/json",
                temperature: 0.9
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
            // تنظيف أي markdown أو نص إضافي
            const cleanContent = generatedContent.replace(/```json\s*|```/g, '').trim();
            parsedSection = JSON.parse(cleanContent);
            
            // التحقق من الهيكل المطلوب
            if (!parsedSection.liquid_code || !parsedSection.schema || !parsedSection.preview_html) {
                throw new Error('AI output missing required keys: liquid_code, schema, or preview_html');
            }
        } catch (e) {
            console.error('Failed to parse final section JSON:', generatedContent);
            return res.status(500).json({ 
                error: 'AI output format error. Could not parse liquid_code, schema, and preview_html.',
                details: e.message
            });
        }

        // إرجاع البيانات بنفس هيكل التطبيق الحالي
        res.status(200).json({
            liquid_code: parsedSection.liquid_code,
            schema: parsedSection.schema,
            html: parsedSection.preview_html  // يستخدم html بدلاً من preview_html
        });

    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ 
            error: 'Internal Server Error',
            message: error.message 
        });
    }
}
