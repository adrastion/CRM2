import { Router } from 'express';
import {
  getMarketers,
  getMarketer,
  createMarketer,
  updateMarketer,
  deleteMarketer,
  getMarketerStats,
  registerMarketer,
} from '../controllers/marketerController';
import {
  getMarketerDashboard,
  listMarketerClients,
  getMarketerClientCard,
  createMarketerLead,
  updateMarketerLead,
  claimMarketerClient,
  listMarketerTasks,
  createMarketerTask,
  updateMarketerTask,
  listMarketerChats,
  ensureMarketerChat,
  listMarketerChatMessages,
  postMarketerChatMessage,
  getMarketerFinance,
  listMarketerPublications,
  listMarketerClosingDocs,
  downloadMarketerPublicationImage,
  downloadMarketerPublicationFile,
  downloadMarketerClosingDoc,
} from '../controllers/marketerCabinetController';
import { authenticatePromoCodeAdmin } from '../middleware/promoCodeAdminAuth';
import { authenticateMarketer } from '../middleware/marketerAuth';
import { loginRateLimiter } from '../middleware/loginRateLimit';

const router = Router();

router.post('/register', loginRateLimiter, registerMarketer);

// Cabinet (marketer JWT)
router.get('/me/stats', authenticateMarketer, getMarketerStats);
router.get('/me/dashboard', authenticateMarketer, getMarketerDashboard);
router.get('/me/clients', authenticateMarketer, listMarketerClients);
router.get('/me/clients/:id', authenticateMarketer, getMarketerClientCard);
router.post('/me/leads', authenticateMarketer, createMarketerLead);
router.patch('/me/leads/:id', authenticateMarketer, updateMarketerLead);
router.post('/me/clients/claim', authenticateMarketer, claimMarketerClient);
router.get('/me/tasks', authenticateMarketer, listMarketerTasks);
router.post('/me/tasks', authenticateMarketer, createMarketerTask);
router.patch('/me/tasks/:id', authenticateMarketer, updateMarketerTask);
router.get('/me/chats', authenticateMarketer, listMarketerChats);
router.post('/me/chats/:channel/ensure', authenticateMarketer, ensureMarketerChat);
router.get('/me/chats/:threadId/messages', authenticateMarketer, listMarketerChatMessages);
router.post('/me/chats/:threadId/messages', authenticateMarketer, postMarketerChatMessage);
router.get('/me/finance', authenticateMarketer, getMarketerFinance);
router.get('/me/publications', authenticateMarketer, listMarketerPublications);
router.get('/me/publications/:id/image', authenticateMarketer, downloadMarketerPublicationImage);
router.get('/me/publications/:id/file', authenticateMarketer, downloadMarketerPublicationFile);
router.get('/me/closing-docs', authenticateMarketer, listMarketerClosingDocs);
router.get('/me/closing-docs/:id/file', authenticateMarketer, downloadMarketerClosingDoc);

router.use(authenticatePromoCodeAdmin);

router.get('/:id/stats', getMarketerStats);
router.get('/', getMarketers);
router.get('/:id', getMarketer);
router.post('/', createMarketer);
router.put('/:id', updateMarketer);
router.delete('/:id', deleteMarketer);

export default router;
