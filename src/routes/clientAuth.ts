import { Router } from 'express';
import {
  findClientsForRegistration,
  registerClient,
  loginClient,
  getClientProfile,
  getClientTrainings,
  findParentsForRegistration,
  registerParent,
  getAthleteCard,
  getClientCalendarPlan,
  getClientPayments,
} from '../controllers/clientAuthController';
import { authenticateClient } from '../middleware/clientAuth';
import { getClientDashboard } from '../controllers/clientDashboardController';
import {
  clientCreateSupportTicket,
  clientListSupportTickets,
  clientGetSupportMessages,
  clientPostSupportMessage,
} from '../controllers/supportTicketController';

const router = Router();

// Публичные маршруты
router.post('/find', findClientsForRegistration);
router.post('/register', registerClient);
router.post('/login', loginClient);
router.post('/parent/find', findParentsForRegistration);
router.post('/parent/register', registerParent);

// Защищенные маршруты
router.get('/profile', authenticateClient, getClientProfile);
router.get('/trainings', authenticateClient, getClientTrainings);
router.get('/athlete-card', authenticateClient, getAthleteCard);
router.get('/calendar-plan', authenticateClient, getClientCalendarPlan);
router.get('/payments', authenticateClient, getClientPayments);
// Данные для новой панели управления клиента (учитывает статус подтверждения)
router.get('/dashboard', authenticateClient, getClientDashboard);

// Техподдержка / дизайн (клиент или родитель)
router.post('/support/tickets', authenticateClient, clientCreateSupportTicket);
router.get('/support/tickets', authenticateClient, clientListSupportTickets);
router.get('/support/tickets/:ticketId/messages', authenticateClient, clientGetSupportMessages);
router.post('/support/tickets/:ticketId/messages', authenticateClient, clientPostSupportMessage);

export default router;

