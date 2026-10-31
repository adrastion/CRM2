import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticatePlatformStaff } from '../middleware/platformStaffAuth';
import {
  staffListTickets,
  staffClaimTicket,
  staffCloseTicket,
  staffGetTicketMessages,
  staffPostTicketMessage,
  staffGetSupportAttachment,
  staffListKnowledge,
  staffRegisterCallRecording,
} from '../controllers/supportTicketController';

const uploadDir = path.join(process.cwd(), 'uploads', 'call-recordings');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safe = `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname) || '.webm'}`;
    cb(null, safe);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 },
});

const router = Router();

router.use(authenticatePlatformStaff);

router.get('/tickets', staffListTickets);
router.post('/tickets/:ticketId/claim', staffClaimTicket);
router.post('/tickets/:ticketId/close', staffCloseTicket);
router.get('/tickets/:ticketId/messages', staffGetTicketMessages);
router.post('/tickets/:ticketId/messages', staffPostTicketMessage);
router.get('/attachments/:attachmentId', staffGetSupportAttachment);
router.get('/knowledge', staffListKnowledge);
router.post('/recordings', upload.single('file'), staffRegisterCallRecording);

export default router;
