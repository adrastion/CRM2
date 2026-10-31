import { Router } from 'express';
import {
  getPublicTerms,
  getPublicPrivacy,
  listPublicMarketerLegalDocs,
  downloadPublicMarketerLegalDoc,
} from '../controllers/maintenanceController';

const router = Router();

router.get('/terms', getPublicTerms);
router.get('/privacy', getPublicPrivacy);
router.get('/marketer', listPublicMarketerLegalDocs);
router.get('/marketer/:key', downloadPublicMarketerLegalDoc);

export default router;
