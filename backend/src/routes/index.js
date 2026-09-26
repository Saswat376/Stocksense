import { Router } from 'express';
import authRoutes from './auth.routes.js';
import productRoutes from './product.routes.js';
import operationRoutes from './operation.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import referenceRoutes from './reference.routes.js';

const router = Router();
router.get('/', (_req, res) => res.json({ name: 'StockSense API', version: '1.0.0' }));
router.use('/auth', authRoutes);
router.use('/products', productRoutes);
router.use('/operations', operationRoutes);
router.use('/', dashboardRoutes); // mounts /dashboard, /stock, /moves, /ledger
router.use('/ref', referenceRoutes); // mounts /ref/warehouses, /ref/locations, etc.

export default router;
