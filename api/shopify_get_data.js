import { connectToDatabase } from './db.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const { data_key, shop } = req.query;
    
    if (!data_key || !shop) {
        return res.status(400).json({ error: 'Missing data_key or shop' });
    }
    
    try {
        const { db } = await connectToDatabase();
        
        // البحث عن البيانات
        const data = await db.collection('temp_sections').findOne({
            data_key,
            shop,
            status: 'pending'
        });
        
        if (!data) {
            return res.status(404).json({ 
                success: false, 
                error: 'Data not found or expired',
                hint: 'قد تكون البيانات انتهت صلاحيتها (30 دقيقة) أو تم استخدامها مسبقاً' 
            });
        }
        
        // تحديث الحالة
        await db.collection('temp_sections').updateOne(
            { data_key },
            { $set: { 
                status: 'retrieved',
                retrieved_at: new Date()
            }}
        );
        
        res.status(200).json({
            success: true,
            liquid_code: data.liquid_code,
            schema: typeof data.schema === 'string' ? JSON.parse(data.schema) : data.schema,
            created_at: data.created_at
        });
        
    } catch (error) {
        console.error('Get data error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error' 
        });
    }
}
