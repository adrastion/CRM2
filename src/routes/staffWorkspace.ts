import { Router } from 'express';
import { authenticate, requireOwnerAdminOrTrainer } from '../middleware/auth';
import {
  listStaffNotes,
  createStaffNote,
  updateStaffNote,
  deleteStaffNote,
  noteAttachmentUpload,
  uploadStaffNoteAttachment,
  deleteStaffNoteAttachment,
  getStaffNoteAttachmentFile,
  duplicateStaffNote,
} from '../controllers/staffNoteController';
import {
  listStaffTasks,
  listStaffUsers,
  createStaffTask,
  updateStaffTask,
  updateStaffTaskStatus,
  deleteStaffTask,
  ensureStaffTaskChat,
  taskAttachmentUpload,
  uploadStaffTaskAttachment,
  deleteStaffTaskAttachment,
  getStaffTaskAttachmentFile,
  createStaffTaskComment,
  deleteStaffTaskComment,
} from '../controllers/staffTaskController';

const router = Router();

router.use(authenticate);
router.use(requireOwnerAdminOrTrainer);

router.get('/notes', listStaffNotes);
router.post('/notes', createStaffNote);
router.put('/notes/:id', updateStaffNote);
router.delete('/notes/:id', deleteStaffNote);
router.post('/notes/:id/duplicate', duplicateStaffNote);
router.post(
  '/notes/:id/attachments',
  noteAttachmentUpload.single('file'),
  uploadStaffNoteAttachment
);
router.get('/notes/:id/attachments/:attachmentId/file', getStaffNoteAttachmentFile);
router.delete('/notes/:id/attachments/:attachmentId', deleteStaffNoteAttachment);

router.get('/users', listStaffUsers);
router.get('/tasks', listStaffTasks);
router.post('/tasks', createStaffTask);
router.put('/tasks/:id', updateStaffTask);
router.patch('/tasks/:id/status', updateStaffTaskStatus);
router.delete('/tasks/:id', deleteStaffTask);
router.post('/tasks/:id/chat', ensureStaffTaskChat);
router.post(
  '/tasks/:id/attachments',
  taskAttachmentUpload.single('file'),
  uploadStaffTaskAttachment
);
router.get('/tasks/:id/attachments/:attachmentId/file', getStaffTaskAttachmentFile);
router.delete('/tasks/:id/attachments/:attachmentId', deleteStaffTaskAttachment);
router.post('/tasks/:id/comments', createStaffTaskComment);
router.delete('/tasks/:id/comments/:commentId', deleteStaffTaskComment);

export default router;
