import { Router } from 'express';
import { authenticateSuperAdmin } from '../middleware/superAdminAuth';
import { superAdminCreatePlatformStaffUser } from '../controllers/platformStaffAdminController';
import {
  superAdminListSupportTickets,
  superAdminGetSupportMessages,
  superAdminPostSupportMessage,
  superAdminListCallRecordings,
  superAdminListKnowledgeArticles,
  superAdminCreateKnowledgeArticle,
  superAdminDeleteCallRecording,
} from '../controllers/supportTicketController';

const router = Router();
router.use(authenticateSuperAdmin);

router.get('/tickets', superAdminListSupportTickets);
router.get('/tickets/:ticketId', superAdminGetSupportMessages);
router.post('/tickets/:ticketId/messages', superAdminPostSupportMessage);
router.get('/recordings', superAdminListCallRecordings);
router.delete('/recordings/:id', superAdminDeleteCallRecording);
router.get('/knowledge', superAdminListKnowledgeArticles);
router.post('/knowledge', superAdminCreateKnowledgeArticle);

// Manage platform staff accounts (support/designer/security)
router.post('/platform-staff/users', superAdminCreatePlatformStaffUser);

export default router;
