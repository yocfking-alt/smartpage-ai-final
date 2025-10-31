// api/generate.js - انسخ هذا الكود بالكامل
import fetch from 'node-fetch';

export default async function handler(req, res) {
  // السماح بـ CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // معالجة طلبات OPTIONS لـ CORS
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // التأكد من أن الطريقة POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'الطريقة غير مسموحة. استخدم POST فقط.' });
  }

  try {
    const { productName, productFeatures, productPrice, productCategory, targetAudience, designDescription } = req.body;

    // فحص المدخلات الأساسية
    if (!productName || !productFeatures) {
      return res.status(400).json({ 
        error: "البيانات ناقصة. الرجاء إدخال اسم المنتج والميزات." 
      });
    }

    console.log('🚀 جاري إنشاء صفحة للمنتج:', productName);

    const prompt = `
أنت مصمم ويب محترف ومطور واجهات أمامية. قم بإنشاء صفحة هبوط HTML كاملة وجذابة لمنتج باستخدام المعلومات التالية:

**معلومات المنتج:**
- الاسم: ${productName}
- السعر: ${productPrice || '4990 دج'}
- الفئة: ${productCategory || 'beauty'}
- الجمهور المستهدف: ${targetAudience || 'women'}
- المميزات: ${productFeatures}

**متطلبات التصميم:**
${designDescription || 'تصميم عصري وجذاب يتناسب مع المنتج'}

**المتطلبات الفنية:**
- HTML و CSS حديث
- تصميم متجاوب للجوال
- ألوان متناسقة وجذابة
- أزرار واضحة ودعوات للعمل
- قسم للمميزات والعروض
- مناسب للسوق العربي

أنشئ كود HTML كامل وجاهز للاستخدام بدون أي شرح إضافي.
`;

    // استدعاء DeepSeek API
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { 
            role: 'system', 
            content: 'أنت مساعد AI متخصص في تصميم صفحات الويب. قم بإخراج كود HTML فقط بدون أي شرح إضافي.' 
          },
          { 
            role: 'user', 
            content: prompt 
          }
        ],
        max_tokens: 4000,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`خطأ في DeepSeek API: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('استجابة غير صالحة من DeepSeek API');
    }

    let html = data.choices[0].message.content.trim();
    
    // تنظيف الـ HTML من markdown
    html = html.replace(/```html|```/g, '').trim();
    
    console.log('✅ تم إنشاء الصفحة بنجاح');
    
    res.json({ 
      html: html,
      success: true,
      message: 'تم إنشاء الصفحة بنجاح'
    });
    
  } catch (err) {
    console.error("❌ خطأ في إنشاء الصفحة:", err.message);
    res.status(500).json({ 
      error: `فشل في إنشاء الصفحة.`,
      detail: err.message
    });
  }
}
