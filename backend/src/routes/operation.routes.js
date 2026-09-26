import { Router } from 'express';
import * as opCtrl from '../controllers/operation.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(requireAuth);

router.post('/receipt', opCtrl.receiveGoods);
router.post('/delivery', opCtrl.deliverGoods);
router.post('/transfer', opCtrl.transferGoods);
router.post('/adjustment', opCtrl.adjustStock);

export default router;
