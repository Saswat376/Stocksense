import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware.js';
import * as dashCtrl from '../controllers/dashboard.controller.js';

const router = Router();
router.use(requireAuth);

// Dashboard
router.get('/dashboard',           dashCtrl.dashboard);
router.get('/dashboard/alerts',    dashCtrl.alerts);

// Stock overview (current on-hand per location)
router.get('/stock',               dashCtrl.stock);

// Move operations — list, detail, validate
router.get('/moves',               dashCtrl.moves);
router.get('/moves/:id',           dashCtrl.moveDetail);
router.post('/moves/:id/validate', dashCtrl.validateExistingMove);

// Immutable audit ledger
router.get('/ledger',              dashCtrl.ledger);

export default router;
