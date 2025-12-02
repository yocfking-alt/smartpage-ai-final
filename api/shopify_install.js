// api/shopify_install.js - نسخة معدلة بحذف كود Cookies

export default function handler(req, res) {
    const { HOST } = process.env;
    
    if (req.method === 'POST') {
        // نستخدم req.body لتحليل البيانات المرسلة في طلب POST
        const { shop, liquid_code, schema } = req.body;
        
        if (!shop) {
            return res.status(400).send("Missing shop parameter");
        }

        // ❌ تم حذف الكود الذي كان يضبط الـ Cookies هنا.
        // الآن نعتمد على أن builder.html قام بتخزين البيانات في localStorage
        
        const successUrl = `${HOST}/publish_finish.html?shop=${shop}`;
        console.log('Custom App Install - Redirecting without cookies (using localStorage now)');
        return res.redirect(successUrl);
    }
    
    // إذا كان GET، استخدم الطريقة القديمة كنسخة احتياطية
    const { shop } = req.query;
    if (!shop) {
        return res.status(400).send("Missing shop parameter");
    }
    
    const successUrl = `${HOST}/publish_finish.html?shop=${shop}`;
    console.log('Custom App Install - Redirecting (fallback)');
    res.redirect(successUrl);
}
