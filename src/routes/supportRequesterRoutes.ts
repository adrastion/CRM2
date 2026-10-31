import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { authenticateSupportRequester } from '../middleware/supportRequesterAuth';
import {
  getSupportConfig,
  requesterCreateSupportTicket,
  requesterGetSupportAttachment,
  requesterGetSupportMessages,
  requesterListSupportTickets,
  requesterPostSupportMessage,
  requesterSupportUnreadSummary,
  requesterUploadDesignerCallRecording,
} from '../controllers/supportTicketController';
import {
  ensureSupportAttachmentUploadDir,
  SUPPORT_ATTACHMENT_MAX_BYTES,
  SUPPORT_ATTACHMENT_MAX_FILES,
  supportAttachmentFilename,
} from '../services/supportTicketHelpers';
import { ensureUploadDir } from '../utils/fileStorage';

const callUploadDir = ensureUploadDir('call-recordings');
const supportAttachDir = ensureSupportAttachmentUploadDir();

const callStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, callUploadDir),
  filename: (_req, file, cb) => {
    const safe = `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname) || '.webm'}`;
    cb(null, safe);
  },
});

const supportAttachStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, supportAttachDir),
  filename: (_req, file, cb) => cb(null, supportAttachmentFilename(file.originalname)),
});

const callUpload = multer({
  storage: callStorage,
  limits: { fileSize: 500 * 1024 * 1024 },
});

const supportFilesUpload = multer({
  storage: supportAttachStorage,
  limits: {
    fileSize: SUPPORT_ATTACHMENT_MAX_BYTES,
    files: SUPPORT_ATTACHMENT_MAX_FILES,
  },
});

const router = Router();
router.use(authenticateSupportRequester);

router.get('/config', getSupportConfig);
router.get('/unread-summary', requesterSupportUnreadSummary);
router.post('/tickets', supportFilesUpload.array('files', SUPPORT_ATTACHMENT_MAX_FILES), requesterCreateSupportTicket);
router.get('/tickets', requesterListSupportTickets);
router.get('/tickets/:ticketId/messages', requesterGetSupportMessages);
router.post(
  '/tickets/:ticketId/messages',
  supportFilesUpload.array('files', SUPPORT_ATTACHMENT_MAX_FILES),
  requesterPostSupportMessage
);
router.get('/attachments/:attachmentId', requesterGetSupportAttachment);
router.post('/tickets/:ticketId/recordings', callUpload.single('file'), requesterUploadDesignerCallRecording);

export default router;
