import { Router } from 'express';
import multer from 'multer';
import { authenticateSuperAdmin } from '../middleware/superAdminAuth';
import { superAdminCreatePlatformStaffUser, superAdminListPlatformStaffUsers } from '../controllers/platformStaffAdminController';
import {
  superAdminListSupportTickets,
  superAdminSupportUnreadTotal,
  superAdminGetSupportMessages,
  superAdminPostSupportMessage,
  superAdminCloseSupportTicket,
  superAdminReopenSupportTicket,
  superAdminGetSupportAttachment,
  superAdminListCallRecordings,
  superAdminDownloadCallRecording,
  superAdminListKnowledgeArticles,
  superAdminCreateKnowledgeArticle,
  superAdminUpdateKnowledgeArticle,
  superAdminDeleteKnowledgeArticle,
  superAdminListCannedReplies,
  superAdminCreateCannedReply,
  superAdminUpdateCannedReply,
  superAdminDeleteCannedReply,
  superAdminDeleteCallRecording,
  superAdminListSupportPromos,
  superAdminCreateSupportPromo,
  superAdminUpdateSupportPromo,
  superAdminDeleteSupportPromo,
  superAdminReorderSupportPromos,
  superAdminGetSupportAutoReplySettings,
  superAdminUpdateSupportAutoReplySettings,
  superAdminUploadAutoReplyAttachment,
  superAdminDeleteAutoReplyAttachment,
  superAdminGetAutoReplyAttachment,
} from '../controllers/supportTicketController';
import {
  ensureSupportAttachmentUploadDir,
  SUPPORT_ATTACHMENT_MAX_BYTES,
  SUPPORT_ATTACHMENT_MAX_FILES,
  supportAttachmentFilename,
} from '../services/supportTicketHelpers';
import { ensureUploadDir } from '../utils/fileStorage';

const supportAttachDir = ensureSupportAttachmentUploadDir();
const supportFilesUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, supportAttachDir),
    filename: (_req, file, cb) => cb(null, supportAttachmentFilename(file.originalname)),
  }),
  limits: {
    fileSize: SUPPORT_ATTACHMENT_MAX_BYTES,
    files: SUPPORT_ATTACHMENT_MAX_FILES,
  },
});

const autoReplyUploadDir = ensureUploadDir('support-auto-reply');
const autoReplyUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, autoReplyUploadDir),
    filename: (_req, file, cb) => cb(null, supportAttachmentFilename(file.originalname)),
  }),
  limits: {
    fileSize: SUPPORT_ATTACHMENT_MAX_BYTES,
    files: 1,
  },
});

const router = Router();
router.use(authenticateSuperAdmin);

router.get('/tickets/unread-total', superAdminSupportUnreadTotal);
router.get('/tickets', superAdminListSupportTickets);
router.get('/tickets/:ticketId', superAdminGetSupportMessages);
router.post(
  '/tickets/:ticketId/messages',
  supportFilesUpload.array('files', SUPPORT_ATTACHMENT_MAX_FILES),
  superAdminPostSupportMessage
);
router.post('/tickets/:ticketId/close', superAdminCloseSupportTicket);
router.post('/tickets/:ticketId/reopen', superAdminReopenSupportTicket);
router.get('/attachments/:attachmentId', superAdminGetSupportAttachment);
router.get('/recordings', superAdminListCallRecordings);
router.get('/recordings/:id/download', superAdminDownloadCallRecording);
router.delete('/recordings/:id', superAdminDeleteCallRecording);
router.get('/knowledge', superAdminListKnowledgeArticles);
router.post('/knowledge', superAdminCreateKnowledgeArticle);
router.put('/knowledge/:id', superAdminUpdateKnowledgeArticle);
router.delete('/knowledge/:id', superAdminDeleteKnowledgeArticle);
router.get('/canned-replies', superAdminListCannedReplies);
router.post('/canned-replies', superAdminCreateCannedReply);
router.put('/canned-replies/:id', superAdminUpdateCannedReply);
router.delete('/canned-replies/:id', superAdminDeleteCannedReply);
router.get('/promos', superAdminListSupportPromos);
router.post('/promos', superAdminCreateSupportPromo);
router.put('/promos/reorder', superAdminReorderSupportPromos);
router.put('/promos/:id', superAdminUpdateSupportPromo);
router.delete('/promos/:id', superAdminDeleteSupportPromo);
router.get('/auto-reply-settings', superAdminGetSupportAutoReplySettings);
router.put('/auto-reply-settings', superAdminUpdateSupportAutoReplySettings);
router.post(
  '/auto-reply-attachments',
  autoReplyUpload.single('file'),
  superAdminUploadAutoReplyAttachment
);
router.get('/auto-reply-attachments/:id', superAdminGetAutoReplyAttachment);
router.delete('/auto-reply-attachments/:id', superAdminDeleteAutoReplyAttachment);

// Manage platform staff accounts (support/designer/security)
router.get('/platform-staff/users', superAdminListPlatformStaffUsers);
router.post('/platform-staff/users', superAdminCreatePlatformStaffUser);

export default router;
