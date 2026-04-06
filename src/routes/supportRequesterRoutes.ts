import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticateSupportRequester } from '../middleware/supportRequesterAuth';
import {
  requesterCreateSupportTicket,
  requesterGetSupportMessages,
  requesterListSupportTickets,
  requesterPostSupportMessage,
  requesterUploadDesignerCallRecording,
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
router.use(authenticateSupportRequester);

router.post('/tickets', requesterCreateSupportTicket);
router.get('/tickets', requesterListSupportTickets);
router.get('/tickets/:ticketId/messages', requesterGetSupportMessages);
router.post('/tickets/:ticketId/messages', requesterPostSupportMessage);
router.post('/tickets/:ticketId/recordings', upload.single('file'), requesterUploadDesignerCallRecording);

export default router;

