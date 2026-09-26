import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as authCtrl from '../controllers/auth.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const router = Router();

// Strict rate-limit for auth endpoints (brute-force protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20,
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(authLimiter);

router.post('/signup',          authCtrl.signup);
router.post('/login',           authCtrl.login);
router.post('/forgot-password', authCtrl.forgotPassword);
router.post('/verify-otp',      authCtrl.verifyOtp);
router.post('/reset-password',  authCtrl.resetPassword);
router.get('/me',               requireAuth, authCtrl.me);

export default router;
