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
            shopUrl // تمت إضافته ليكون متاحًا في Prompt
        } = req.body;

        if (!productName || !productFeatures) {
            return res.status(400).json({ error: 'Missing productName or productFeatures' });
        }

        const GEMINI_MODEL = 'gemini-2.5-flash'; 
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
            generationConfig: { // <--- تم التصحيح هنا: استخدام generationConfig بدلاً من config
                // تفعيل وضع الـ JSON Schema Output إذا كانت متاحة للموديل، أو الاعتماد على التوجيه
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
            return res.status(500).json({ error: 'AI failed to return valid content.' });
        }

        let parsedSection;
        try {
            // محاولة تحليل الكود الناتج من Gemini مباشرة
            parsedSection = JSON.parse(generatedContent);
        } catch (e) {
            console.error('Failed to parse final section JSON:', generatedContent);
            return res.status(500).json({ error: 'AI output format error. Could not parse liquid_code and schema.' });
        }

        // إرجاع JSON object يحتوي على liquid_code و schema
        res.status(200).json(parsedSection);

    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ error: 'Internal Server Error (Check Vercel Logs)' });
    }
}
