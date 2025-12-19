import fetch from 'node-fetch';

export default async function handler(req, res) {
    // 1. إعدادات CORS (نفس النظام القديم لضمان قبول الطلبات)
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        if (!GEMINI_API_KEY) throw new Error('API Key is missing');

        // استقبال البيانات من الواجهة الأمامية
        const { 
            productName, productFeatures, productPrice, productCategory,
            targetAudience, designDescription, shippingOption, customShippingPrice, customOffer
        } = req.body;

        // استخدام الموديل المستقر والسريع
        const GEMINI_MODEL = 'gemini-2.5-flash'; 
        const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
        
        // بناء النصوص الخاصة بالشحن والعرض
        const shippingText = shippingOption === 'free' ? "Free Shipping" : `Shipping: ${customShippingPrice}`;
        const offerText = customOffer ? `Special Offer: ${customOffer}` : "";

        // *****************************************************************
        // الـ Prompt الجديد (المعدل حسب متطلباتك)
        // *****************************************************************
        const prompt = `
Act as a Senior Creative Director and Conversion Expert. 
Analyze this product: ${productName}. 
Category: ${productCategory}. 
Target Audience: ${targetAudience}.
Context/Features: ${productFeatures}.
Price: ${productPrice}. ${shippingText}. ${offerText}.
User Design Request: ${designDescription}.

## 🎯 **OBJECTIVE:**
Create a completely unique, high-converting landing page with maximum creativity.

## ⚠️ **STRICT REQUIREMENTS (MUST FOLLOW):**

### **1. HERO SECTION (FIRST VISIBLE ELEMENT):**
- Must be the first section users see
- Include: Creative Headline (H1) + Subtitle + Primary CTA Button
- Design: Use advanced CSS (glassmorphism, animations, gradients, etc.)

### **2. CUSTOMER INFO BOX (IMMEDIATELY AFTER HERO):**
Must contain this exact form structure:
<div class="customer-info-box">
  <input type="text" placeholder="Full Name" required>
  <select required>
    <option value="">Select State/Province</option>
    <!-- State options -->
  </select>
  <input type="tel" placeholder="Phone Number" required>
  <button type="submit">Submit</button>
</div>

### **3. OUTPUT FORMAT - CRITICAL (MUST BE EXACT):**
You MUST return a **Strict JSON object** with exactly these 3 keys:
{
  "html": "Complete HTML string with <style> in head and <body> content",
  "liquid_code": "Shopify Liquid template code (without {% schema %})",
  "schema": {
    "name": "Landing Page",
    "settings": [
      // Generate relevant settings here
    ]
  }
}

## 🚀 **COMPLETE CREATIVE FREEDOM (FOR EVERYTHING ELSE):**
After the required sections above, you have 100% creative freedom:
- Create any number of unique sections
- Use any layout/design patterns (parallax, 3D, interactive, etc.)
- Surprise with innovative psychological triggers
- No restrictions on section order or content
- Break conventional patterns for better conversion

## 🎨 **DESIGN GUIDELINES (NOT RESTRICTIONS):**
- Use FontAwesome 6 icons
- Write custom CSS (no templates)
- Fully responsive design
- Modern CSS (Grid, Flexbox, CSS Variables)
- Consider color psychology

## 🔧 **TECHNICAL NOTES:**
- The \`html\` key: For live preview (complete standalone HTML)
- The \`liquid_code\` key: For Shopify (use Liquid syntax like {{ product.title }})
- The \`schema\` key: Settings for Shopify theme editor
- Return ONLY the JSON object, no additional text

**Remember:** Only the Hero structure, Info Box fields, and output format are fixed. Everything else should be uniquely creative each time!
        `;

        const response = await fetch(GEMINI_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { 
                    responseMimeType: "application/json", 
                    temperature: 0.95,
                    topP: 0.95,
                    topK: 40
                }
            })
        });

        const data = await response.json();

        // معالجة الأخطاء من Gemini
        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
            console.error("Gemini Error:", data);
            throw new Error('Failed to generate content from AI');
        }

        const aiResponseText = data.candidates[0].content.parts[0].text;
        
        // تنظيف النص من علامات Markdown إذا وجدت لضمان عدم حدوث خطأ في الـ JSON
        const cleanedText = aiResponseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const aiResponse = JSON.parse(cleanedText);

        // إرسال النتيجة بنفس الهيكل الذي يتوقعه builder.html
        res.status(200).json({
            liquid_code: aiResponse.liquid_code,
            schema: aiResponse.schema,
            html: aiResponse.html
        });

    } catch (error) {
        console.error("Server Error:", error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
}
