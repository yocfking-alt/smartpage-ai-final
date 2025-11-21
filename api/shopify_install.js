// api/shopify_install.js - نسخة معدلة
export default function handler(req, res) {
    const { HOST } = process.env;
    
    if (req.method === 'POST') {
        const { shop, liquid_code, schema } = req.body;
        
        if (!shop) {
            return res.status(400).send("Missing shop parameter");
        }

        // تخزين البيانات في كookies مؤقتة
        res.setHeader('Set-Cookie', [
            `liquid_code=${encodeURIComponent(liquid_code)}; Path=/; Max-Age=300`,
            `schema=${encodeURIComponent(schema)}; Path=/; Max-Age=300`
        ]);

        const successUrl = `${HOST}/publish_finish.html?shop=${shop}`;
        console.log('Custom App Install - Redirecting with data via cookies');
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
