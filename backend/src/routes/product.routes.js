import { Router } from 'express';
import * as productCtrl from '../controllers/product.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(requireAuth); // All product routes require auth

router.get('/', productCtrl.listProducts);
router.post('/', productCtrl.createNewProduct);

export default router;
