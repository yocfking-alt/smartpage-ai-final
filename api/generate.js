// api/generate.js
// ملاحظة: إن كنت على Vercel/Next.js الحديثة يمكنك حذف `node-fetch` واستعمال fetch المدمج.
// import fetch from 'node-fetch'; 

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
      productName = '',
      productFeatures = '',
      productPrice = '',
      productCategory = '',
      targetAudience = '',
      designDescription = '',
      customOffer = '',
      shippingOption = '',
      customShippingPrice = ''
    } = req.body || {};

    // Validation básica
    if (!productName.trim() || !productFeatures.trim()) {
      return res.status(400).json({ error: 'Missing productName or productFeatures' });
    }

    // Sanitization بسيطة للمدخلات لمنع كسر الـ prompt أو حقن JSON
    const sanitize = (s, max = 800) => {
      if (!s) return '';
      // إزالة backticks وقطع السلاسل الطويلة
      return String(s)
        .replace(/`/g, "'")
        .replace(/\$\{/g, '\\${')
        .slice(0, max);
    };

    const P = {
      productName: sanitize(productName, 200),
      productFeatures: sanitize(productFeatures, 1200),
      productPrice: sanitize(productPrice, 80),
      productCategory: sanitize(productCategory, 120),
      targetAudience: sanitize(targetAudience, 200),
      designDescription: sanitize(designDescription, 300),
      customOffer: sanitize(customOffer, 200),
      shippingOption: sanitize(shippingOption, 60),
      customShippingPrice: sanitize(customShippingPrice, 60)
    };

    const shippingDetails =
      P.shippingOption === 'free'
        ? 'The landing page MUST emphasize Free Shipping in the Call-to-Action section.'
        : `Shipping Cost: ${P.customShippingPrice || 'to be determined. Mention the cost clearly.'}`;

    const offerDetails = P.customOffer
      ? `Primary Promotional Offer: ${P.customOffer}. Use this prominent text as the main incentive on the hero section and CTA.`
      : 'No special promotion is provided. Focus on product value, features, and price.';

    // بناء الـ prompt مع حد أقصى لطوله
    let prompt = `
أنت الآن خبير في تطوير مقاطع (Sections) Shopify السريعة والمُحسَّنة. مهمتك هي إنشاء كود مقطع Shopify (Liquid Section) كامل بناءً على الوصف التالي.

تعليمات صارمة يجب اتباعها:
1. التنسيق (Format): يجب أن يكون الخرج **ملف JSON واحد** وصالح تماماً.
2. الهيكل (Structure): يجب أن يحتوي ملف JSON على خاصيتين (Keys) فقط:
    - **"liquid_code":** يحتوي على كود Liquid/HTML5 للمقطع. يجب وضع جميع التنسيقات (CSS) داخل وسم <style> في بداية هذا الكود.
    - **"schema":** يحتوي على كود JSON الخاص بالـ "Schema" اللازم لإعدادات المقطع في محرر ثيم Shopify.

3. النقاء (Purity): لا يجب تضمين أي وسوم HTML رئيسية (<html>، <head>، <body>) في أي جزء من الخرج.
4. الصور (Images Strategy): استخدم روابط URL كاملة وصريحة للصور. لا تستخدم Base64.
5. المتغيرات: استخدم خاصية "schema" لتعريف متغيرات (Settings) لكل جزء نصي وصوري رئيسي في المقطع (مثل: عناوين، أزرار، صور). يجب أن يعرض الـ "liquid_code" هذه المتغيرات (مثال: {{ section.settings.image_url }} أو {{ section.settings.title }}).

Your response MUST be ONLY the complete, fully formed JSON object. DO NOT include any text, markdown, or explanation outside of the JSON object.

Product Name: ${P.productName}
Key Features: ${P.productFeatures}
Price: ${P.productPrice || 'Check website for details'}
Category: ${P.productCategory}
Target Audience: ${P.targetAudience}
Design Style: ${P.designDescription || 'modern and clean'}

--- Marketing and Logistics Details ---
${offerDetails}
${shippingDetails}
`;

    // قطّع الـ prompt لو صار طويل جدًا (مثال 6000 حرف)
    const PROMPT_MAX = 6000;
    if (prompt.length > PROMPT_MAX) {
      prompt = prompt.slice(0, PROMPT_MAX - 200) + '\n\n[TRUNCATED: input too long]';
    }

    // إعداد timeout لطلب الـ API
    const controller = new AbortController();
    const TIMEOUT_MS = 25_000; // 25s
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    // ملاحظة: تأكد أن GEMINI_ENDPOINT صحيح وفقٌ لواجهة Google Generative API التي تستخدمها
    const GEMINI_MODEL = 'gemini-2.5-flash';
    const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

    const geminiBody = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 2500 }
    };

    const response = await fetch(GEMINI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // وضع المفتاح في هيدر Authorization كـ Bearer Token هو أفضل ممارسة
        'Authorization': `Bearer ${GEMINI_API_KEY}`,
      },
      body: JSON.stringify(geminiBody),
      signal: controller.signal
    });

    clearTimeout(timeout);

    let data;
    try {
      data = await response.json();
    } catch (e) {
      console.error('Failed parsing Gemini response JSON', e);
      return res.status(502).json({ error: 'Invalid response from AI provider' });
    }

    if (!response.ok) {
      // لا تطبع كل data في اللوغز بالـ production
      console.error('Gemini API Error:', response.status, data?.error || data);
      const msg = data?.error?.message || `Gemini API error: ${response.status}`;
      return res.status(502).json({ error: 'Failed to generate page: ' + msg });
    }

    const generatedJsonString = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!generatedJsonString || typeof generatedJsonString !== 'string') {
      console.error('AI returned no valid text', data);
      return res.status(500).json({ error: 'AI failed to return valid content.' });
    }

    // محاولة تحليل النتيجة كملف JSON
    let liquidSection;
    try {
        // إزالة الكود الزائد مثل "```json" إذا أضافه النموذج
        const cleanJsonString = generatedJsonString.replace(/```json\s*|```/g, '').trim();
        liquidSection = JSON.parse(cleanJsonString);
    } catch (e) {
        console.error('Failed to parse AI response as JSON', e, generatedJsonString);
        return res.status(502).json({ error: 'AI returned non-JSON content. Please try again.' });
    }

    // التأكد من أن النتيجة تحتوي على المفاتيح المطلوبة
    if (!liquidSection.liquid_code || !liquidSection.schema) {
        console.error('Parsed JSON missing liquid_code or schema', liquidSection);
        return res.status(500).json({ error: 'AI returned incomplete Shopify Section JSON.' });
    }

    // العودة بكود المقطع Shopify Section
    res.status(200).json(liquidSection);
  } catch (err) {
    if (err.name === 'AbortError') {
      console.error('Request to AI timed out');
      return res.status(504).json({ error: 'AI provider timeout' });
    }
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
