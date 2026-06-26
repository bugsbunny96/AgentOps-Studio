import { Router } from 'express';
import * as authController from './auth.controller';
import { authenticate } from '../../middleware/authenticate';

const router = Router();

// ─── Public routes ─────────────────────────────────────────────────────────
router.post('/register', authController.register);
router.post('/verify-email', authController.verifyEmail);
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.post('/refresh', authController.refresh);

// ─── Protected routes ──────────────────────────────────────────────────────
router.get('/me', authenticate, authController.getMe);
router.post('/logout', authenticate, authController.logout);

export { router as authRouter };
