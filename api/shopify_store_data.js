import { connectToDatabase } from './db.js';
import crypto from 'crypto';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        const { shop, liquid_code, schema } = req.body;
        
        if (!liquid_code || !schema || !shop) {
            return res.status(400).json({ error: 'Missing required data' });
        }
        
        const { db } = await connectToDatabase();
        
        // إنشاء مفتاح فريد
        const data_key = crypto.randomBytes(32).toString('hex');
        const session_id = crypto.randomBytes(16).toString('hex');
        
        // تخزين البيانات
        await db.collection('temp_sections').insertOne({
            data_key,
            session_id,
            shop,
            liquid_code,
            schema: typeof schema === 'string' ? schema : JSON.stringify(schema),
            created_at: new Date(),
            expires_at: new Date(Date.now() + 30 * 60 * 1000), // 30 دقيقة
            status: 'pending'
        });
        
        res.status(200).json({
            success: true,
            data_key,
            session_id,
            shop,
            redirect_url: `/api/shopify_install?shop=${encodeURIComponent(shop)}&data_key=${data_key}`
        });
        
    } catch (error) {
        console.error('Store data error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error',
            message: error.message 
        });
    }
}
