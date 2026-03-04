import { Router } from 'express';
import { getNotifications, markAsRead } from '../controllers/notificationController.js';
import protect from '../middlewares/protect.js';

const router = Router();

router.get('/', protect, getNotifications);
router.post('/mark-read', protect, markAsRead);

export default router;
