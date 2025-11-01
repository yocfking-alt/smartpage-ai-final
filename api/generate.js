// api/generate.js - الكود الكامل لـ DeepSeek
import fetch from 'node-fetch';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { productName, productFeatures, productPrice, designDescription } = req.body;

    if (!productName || !productFeatures) {
      return res.status(400).json({ 
        error: 'الرجاء إدخال اسم المنتج والميزات' 
      });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'API key not configured' });
    }

    const prompt = `
أنشئ صفحة هبوط HTML كاملة بالعربية للمنتج التالي:

المنتج: ${productName}
السعر: ${productPrice || '4990 دج'}
الميزات: ${productFeatures}
${designDescription ? `وصف التصميم: ${designDescription}` : ''}

أنشئ كود HTML كامل مع CSS مدمج، تصميم عصري وجذاب، متجاوب مع الجوال.
`;

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 4000,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.status}`);
    }

    const data = await response.json();
    let html = data.choices[0].message.content;
    html = html.replace(/```html|```/g, '').trim();

    res.json({ 
      html: html,
      success: true 
    });

  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to generate page: ' + error.message 
    });
  }
}
