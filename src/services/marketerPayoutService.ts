import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { badRequest, notFound } from '../utils/httpError';
import { ensureUploadDir } from '../utils/fileStorage';
import { EmailOtpService } from './emailOtpService';
import { emailService } from './emailService';
import { MarketerCabinetService } from './marketerCabinetService';
import {
  buildMarketerPayoutActPdf,
  unlinkActFile,
  type ActPdfMarketer,
} from './marketerPayoutActPdf';

export const PAYOUT_STATUS = {
  AWAITING_SIGNATURE: 'AWAITING_SIGNATURE',
  PROCESSING: 'PROCESSING',
  PAID: 'PAID',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
} as const;

const OTP_PURPOSE = 'marketer_payout_pep' as const;

/** Добавляет N рабочих дней (пн–пт, без праздников). */
export function addBusinessDays(from: Date, days: number): Date {
  const d = new Date(from.getTime());
  let left = Math.max(0, Math.floor(days));
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const wd = d.getUTCDay(); // 0 Sun .. 6 Sat
    if (wd !== 0 && wd !== 6) left -= 1;
  }
  return d;
}

function maskAccount(account: string): string {
  const digits = String(account || '').replace(/\s/g, '');
  if (digits.length <= 4) return '••••';
  return `•••• ${digits.slice(-4)}`;
}

function maskBank(marketer: {
  bankName?: string | null;
  bankBik?: string | null;
  bankAccount?: string | null;
  bankRecipient?: string | null;
}) {
  if (!marketer.bankAccount && !marketer.bankName) return null;
  return {
    bankName: marketer.bankName || null,
    bankBik: marketer.bankBik || null,
    bankAccountMasked: marketer.bankAccount ? maskAccount(marketer.bankAccount) : null,
    bankRecipient: marketer.bankRecipient || null,
    hasDetails: !!(marketer.bankName && marketer.bankBik && marketer.bankAccount && marketer.bankRecipient),
  };
}

function serializePayout(p: any) {
  return {
    id: p.id,
    amount: Number(p.amount),
    status: p.status,
    bankName: p.bankName,
    bankBik: p.bankBik,
    bankAccountMasked: maskAccount(p.bankAccount),
    bankRecipient: p.bankRecipient,
    signedAt: p.signedAt,
    paidAt: p.paidAt,
    dueAt: p.dueAt || null,
    rejectReason: p.rejectReason,
    dueBusinessDays: p.dueBusinessDays,
    createdAt: p.createdAt,
    document: p.document
      ? {
          id: p.document.id,
          title: p.document.title,
          contentHash: p.document.contentHash,
          signedContentHash: p.document.signedContentHash || null,
          hasSignedCopy: Boolean(p.document.signedFileUrl || p.document.signedAt),
          signedAt: p.document.signedAt,
          codeSentAt: p.document.codeSentAt,
        }
      : null,
    npdReceipt: p.npdReceipt
      ? {
          id: p.npdReceipt.id,
          uploadedAt: p.npdReceipt.uploadedAt,
          originalName: p.npdReceipt.originalName || null,
        }
      : null,
  };
}

const payoutInclude = {
  document: true,
  npdReceipt: true,
} as const;

function toActMarketer(marketer: {
  name: string;
  email: string;
  phone?: string | null;
  inn?: string | null;
  taxStatus?: string | null;
  bankName?: string | null;
  bankBik?: string | null;
  bankAccount?: string | null;
  bankRecipient?: string | null;
}): ActPdfMarketer {
  return {
    name: marketer.name,
    email: marketer.email,
    phone: marketer.phone || null,
    inn: marketer.inn || null,
    taxStatus: marketer.taxStatus || null,
    bankName: marketer.bankName || '',
    bankBik: marketer.bankBik || '',
    bankAccount: marketer.bankAccount || '',
    bankRecipient: marketer.bankRecipient || '',
  };
}

export class MarketerPayoutService {
  static maskBank = maskBank;
  static serializePayout = serializePayout;

  static async updateBankDetails(
    marketerId: string,
    input: { bankName?: string; bankBik?: string; bankAccount?: string; bankRecipient?: string }
  ) {
    const bankName = String(input.bankName || '').trim();
    const bankBik = String(input.bankBik || '').replace(/\D/g, '');
    const bankAccount = String(input.bankAccount || '').replace(/\s/g, '');
    const bankRecipient = String(input.bankRecipient || '').trim();
    if (!bankName) throw badRequest('Укажите банк', 'bankName');
    if (!/^\d{9}$/.test(bankBik)) throw badRequest('БИК должен содержать 9 цифр', 'bankBik');
    if (!/^\d{20}$/.test(bankAccount)) throw badRequest('Счёт должен содержать 20 цифр', 'bankAccount');
    if (!bankRecipient) throw badRequest('Укажите получателя', 'bankRecipient');

    const updated = await prisma.marketer.update({
      where: { id: marketerId },
      data: { bankName, bankBik, bankAccount, bankRecipient },
      select: { bankName: true, bankBik: true, bankAccount: true, bankRecipient: true },
    });
    try {
      const { MarketerProfileService } = await import('./marketerProfileService');
      await MarketerProfileService.refreshCompletion(marketerId);
    } catch {
      /* ignore */
    }
    return maskBank(updated);
  }

  static async createPayout(marketerId: string, amountRaw: unknown) {
    const { MarketerProfileService } = await import('./marketerProfileService');
    await MarketerProfileService.assertOnboardingComplete(marketerId);

    const amount = Number(amountRaw);
    if (!Number.isFinite(amount) || amount <= 0) throw badRequest('Укажите корректную сумму', 'amount');
    if (Math.round(amount * 100) !== amount * 100 && String(amount).includes('.') && String(amount).split('.')[1]?.length > 2) {
      throw badRequest('Сумма — не более 2 знаков после запятой', 'amount');
    }

    const marketer = await prisma.marketer.findUnique({ where: { id: marketerId } });
    if (!marketer) throw notFound('Маркетолог не найден');
    if (!marketer.bankName || !marketer.bankBik || !marketer.bankAccount || !marketer.bankRecipient) {
      throw badRequest('Сначала заполните банковские реквизиты');
    }
    const balance = Number(marketer.balance);
    if (amount > balance) throw badRequest('Сумма превышает доступный баланс', 'amount');

    const payoutId = crypto.randomBytes(12).toString('hex');
    const act = await buildMarketerPayoutActPdf({
      payoutId,
      amount,
      marketer: toActMarketer(marketer),
      issuedAt: new Date(),
    });

    try {
      const created = await prisma.$transaction(async (tx) => {
        const locked = await tx.marketer.findUnique({ where: { id: marketerId } });
        if (!locked) throw notFound('Маркетолог не найден');
        if (amount > Number(locked.balance)) throw badRequest('Сумма превышает доступный баланс', 'amount');

        await tx.marketer.update({
          where: { id: marketerId },
          data: { balance: { decrement: amount } },
        });

        const payout = await tx.marketerPayoutRequest.create({
          data: {
            id: payoutId,
            marketerId,
            amount,
            status: PAYOUT_STATUS.AWAITING_SIGNATURE,
            bankName: marketer.bankName!,
            bankBik: marketer.bankBik!,
            bankAccount: marketer.bankAccount!,
            bankRecipient: marketer.bankRecipient!,
            document: {
              create: {
                title: act.title,
                fileUrl: act.relativePath,
                contentHash: act.contentHash,
              },
            },
          },
          include: payoutInclude,
        });
        return payout;
      });
      return serializePayout(created);
    } catch (e) {
      unlinkActFile(act.relativePath);
      throw e;
    }
  }

  static async cancelPayout(marketerId: string, payoutId: string) {
    const payout = await prisma.marketerPayoutRequest.findFirst({
      where: { id: payoutId, marketerId },
      include: payoutInclude,
    });
    if (!payout) throw notFound('Заявка не найдена');
    if (payout.status !== PAYOUT_STATUS.AWAITING_SIGNATURE) {
      throw badRequest('Отменить можно только неподписанную заявку');
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.marketer.update({
        where: { id: marketerId },
        data: { balance: { increment: Number(payout.amount) } },
      });
      return tx.marketerPayoutRequest.update({
        where: { id: payoutId },
        data: { status: PAYOUT_STATUS.CANCELLED, dueAt: null },
        include: payoutInclude,
      });
    });
    return serializePayout(updated);
  }

  static async sendSignCode(marketerId: string, payoutId: string) {
    const { MarketerProfileService } = await import('./marketerProfileService');
    await MarketerProfileService.assertOnboardingComplete(marketerId);

    const payout = await prisma.marketerPayoutRequest.findFirst({
      where: { id: payoutId, marketerId },
      include: { document: true, marketer: { select: { email: true, name: true } } },
    });
    if (!payout) throw notFound('Заявка не найдена');
    if (payout.status !== PAYOUT_STATUS.AWAITING_SIGNATURE) {
      throw badRequest('Заявка уже не ожидает подписи');
    }

    const { code, email } = await EmailOtpService.createAndIssue({
      email: payout.marketer.email,
      purpose: OTP_PURPOSE,
      accountType: 'marketer',
      accountId: payoutId,
    });

    try {
      await emailService.sendMarketerPayoutSignCodeEmail(email, {
        firstName: payout.marketer.name,
        code,
        amount: Number(payout.amount),
      });
    } catch (e) {
      await EmailOtpService.invalidate({
        email,
        purpose: OTP_PURPOSE,
        accountType: 'marketer',
        accountId: payoutId,
      });
      throw e;
    }

    if (payout.document) {
      await prisma.marketerPayoutDocument.update({
        where: { id: payout.document.id },
        data: { codeSentAt: new Date(), signerEmail: email },
      });
    }

    return { ok: true, emailMasked: maskEmail(email) };
  }

  static async confirmSign(
    marketerId: string,
    payoutId: string,
    code: string,
    meta?: { ip?: string; userAgent?: string }
  ) {
    const payout = await prisma.marketerPayoutRequest.findFirst({
      where: { id: payoutId, marketerId },
      include: {
        document: true,
        marketer: true,
      },
    });
    if (!payout) throw notFound('Заявка не найдена');
    if (payout.status !== PAYOUT_STATUS.AWAITING_SIGNATURE) {
      throw badRequest('Заявка уже не ожидает подписи');
    }

    await EmailOtpService.verify({
      email: payout.marketer.email,
      purpose: OTP_PURPOSE,
      code,
      accountType: 'marketer',
      accountId: payoutId,
    });

    const now = new Date();
    const dueAt = addBusinessDays(now, payout.dueBusinessDays || 7);
    const draftHash = payout.document?.contentHash || '';

    let signedRelativePath: string | null = null;
    let signedContentHash: string | null = null;
    if (payout.document) {
      const signed = await buildMarketerPayoutActPdf({
        payoutId,
        amount: Number(payout.amount),
        marketer: toActMarketer({
          ...payout.marketer,
          bankName: payout.bankName,
          bankBik: payout.bankBik,
          bankAccount: payout.bankAccount,
          bankRecipient: payout.bankRecipient,
        }),
        issuedAt: payout.createdAt || now,
        signature: {
          signedAt: now,
          signerEmail: payout.marketer.email,
          signIp: meta?.ip || null,
          draftContentHash: draftHash,
        },
      });
      signedRelativePath = signed.relativePath;
      signedContentHash = signed.contentHash;
    }

    try {
      const updated = await prisma.$transaction(async (tx) => {
        if (payout.document) {
          await tx.marketerPayoutDocument.update({
            where: { id: payout.document.id },
            data: {
              signedAt: now,
              signerEmail: payout.marketer.email,
              signIp: meta?.ip || null,
              signUserAgent: meta?.userAgent || null,
              signedFileUrl: signedRelativePath,
              signedContentHash,
            },
          });
        }
        return tx.marketerPayoutRequest.update({
          where: { id: payoutId },
          data: { status: PAYOUT_STATUS.PROCESSING, signedAt: now, dueAt },
          include: payoutInclude,
        });
      });
      return serializePayout(updated);
    } catch (e) {
      unlinkActFile(signedRelativePath);
      throw e;
    }
  }

  /**
   * Возвращает путь к PDF. По умолчанию — подписанная копия (если есть), иначе черновик.
   * version=draft|signed — явный выбор; для signed без файла — ленивая догенерация.
   */
  static async resolveDocumentFile(
    payoutId: string,
    opts?: { marketerId?: string; version?: 'draft' | 'signed' | 'auto' }
  ) {
    const version = opts?.version || 'auto';
    const payout = await prisma.marketerPayoutRequest.findFirst({
      where: opts?.marketerId ? { id: payoutId, marketerId: opts.marketerId } : { id: payoutId },
      include: { document: true, marketer: true },
    });
    if (!payout?.document?.fileUrl) throw notFound('Документ не найден');

    const doc = payout.document;
    const wantSigned =
      version === 'signed' || (version === 'auto' && Boolean(doc.signedAt || doc.signedFileUrl));

    if (!wantSigned || version === 'draft') {
      return { fileUrl: doc.fileUrl, title: doc.title, version: 'draft' as const };
    }

    if (doc.signedFileUrl) {
      return { fileUrl: doc.signedFileUrl, title: doc.title, version: 'signed' as const };
    }

    // Ленивая догенерация подписанной копии для старых заявок
    if (doc.signedAt) {
      const signed = await buildMarketerPayoutActPdf({
        payoutId,
        amount: Number(payout.amount),
        marketer: toActMarketer({
          ...payout.marketer,
          bankName: payout.bankName,
          bankBik: payout.bankBik,
          bankAccount: payout.bankAccount,
          bankRecipient: payout.bankRecipient,
        }),
        issuedAt: payout.createdAt || doc.signedAt,
        signature: {
          signedAt: doc.signedAt,
          signerEmail: doc.signerEmail || payout.marketer.email,
          signIp: doc.signIp,
          draftContentHash: doc.contentHash,
        },
      });
      await prisma.marketerPayoutDocument.update({
        where: { id: doc.id },
        data: {
          signedFileUrl: signed.relativePath,
          signedContentHash: signed.contentHash,
        },
      });
      return { fileUrl: signed.relativePath, title: doc.title, version: 'signed' as const };
    }

    return { fileUrl: doc.fileUrl, title: doc.title, version: 'draft' as const };
  }

  static async getDocumentPath(
    marketerId: string,
    payoutId: string,
    version?: 'draft' | 'signed' | 'auto'
  ) {
    return this.resolveDocumentFile(payoutId, { marketerId, version });
  }

  static async getDocumentPathAdmin(payoutId: string, version?: 'draft' | 'signed' | 'auto') {
    return this.resolveDocumentFile(payoutId, { version });
  }

  static async uploadNpdReceipt(
    marketerId: string,
    payoutId: string,
    file: { filename: string; originalname?: string; path?: string }
  ) {
    const payout = await prisma.marketerPayoutRequest.findFirst({
      where: { id: payoutId, marketerId },
      include: { npdReceipt: true },
    });
    if (!payout) throw notFound('Заявка не найдена');
    if (payout.status !== PAYOUT_STATUS.PAID) {
      throw badRequest('Чек НПД можно загрузить только после выплаты');
    }
    if (!file?.filename) throw badRequest('Файл не загружен');

    ensureUploadDir('marketer-cabinet', 'npd-receipts');
    const relativePath = `marketer-cabinet/npd-receipts/${file.filename}`;
    const { decodeUploadOriginalName, safeUnlink } = await import('../utils/fileStorage');
    const originalName = decodeUploadOriginalName(file.originalname || file.filename);

    if (payout.npdReceipt) {
      safeUnlink(payout.npdReceipt.fileUrl);
      await prisma.marketerNpdReceipt.update({
        where: { id: payout.npdReceipt.id },
        data: { fileUrl: relativePath, originalName, uploadedAt: new Date() },
      });
    } else {
      await prisma.marketerNpdReceipt.create({
        data: { payoutId, fileUrl: relativePath, originalName },
      });
    }

    const updated = await prisma.marketerPayoutRequest.findUnique({
      where: { id: payoutId },
      include: payoutInclude,
    });
    return serializePayout(updated);
  }

  static async getNpdReceiptPath(marketerId: string | null, payoutId: string) {
    const payout = await prisma.marketerPayoutRequest.findFirst({
      where: marketerId ? { id: payoutId, marketerId } : { id: payoutId },
      include: { npdReceipt: true },
    });
    if (!payout?.npdReceipt?.fileUrl) throw notFound('Чек не найден');
    return {
      fileUrl: payout.npdReceipt.fileUrl,
      title: payout.npdReceipt.originalName || 'npd-receipt',
    };
  }

  static async listAdminPayouts(status?: string) {
    const where: any = {};
    if (status) where.status = status;
    else where.status = PAYOUT_STATUS.PROCESSING;
    const rows = await prisma.marketerPayoutRequest.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      include: {
        marketer: { select: { id: true, name: true, email: true, phone: true } },
        document: {
          select: {
            id: true,
            title: true,
            signedAt: true,
            contentHash: true,
            signedFileUrl: true,
            signedContentHash: true,
          },
        },
        npdReceipt: true,
      },
      take: 200,
    });
    return rows.map((p) => ({
      ...serializePayout(p),
      marketer: p.marketer,
    }));
  }

  static async markPaid(payoutId: string, superAdminId?: string, note?: string) {
    const payout = await prisma.marketerPayoutRequest.findUnique({
      where: { id: payoutId },
      include: { marketer: true, document: true },
    });
    if (!payout) throw notFound('Заявка не найдена');
    if (payout.status !== PAYOUT_STATUS.PROCESSING) {
      throw badRequest('Выплатить можно только заявку в обработке');
    }

    const amount = Number(payout.amount);
    const now = new Date();

    const [transaction] = await prisma.$transaction([
      (prisma as any).adminTransaction.create({
        data: {
          type: 'marketer_payment',
          amount,
          description:
            note ||
            `Выплата по заявке ${payout.id.slice(-8)} маркетологу ${payout.marketer.name}`,
          marketerId: payout.marketerId,
          superAdminId: superAdminId || undefined,
        },
      }),
      prisma.marketerPayoutRequest.update({
        where: { id: payoutId },
        data: { status: PAYOUT_STATUS.PAID, paidAt: now },
      }),
    ]);

    await MarketerCabinetService.recordCommissionPayout({
      marketerId: payout.marketerId,
      amount,
      notes: note || `Выплата по заявке ${payout.id}`,
      externalKey: `payout_request:${payout.id}`,
    });

    const updated = await prisma.marketerPayoutRequest.findUnique({
      where: { id: payoutId },
      include: payoutInclude,
    });
    return { payout: serializePayout(updated), transactionId: transaction.id };
  }

  static async reject(payoutId: string, reasonRaw?: string) {
    const reason = String(reasonRaw || '').trim() || 'Отклонено администратором';
    const payout = await prisma.marketerPayoutRequest.findUnique({ where: { id: payoutId } });
    if (!payout) throw notFound('Заявка не найдена');
    if (payout.status !== PAYOUT_STATUS.PROCESSING) {
      throw badRequest('Отклонить можно только заявку в обработке');
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.marketer.update({
        where: { id: payout.marketerId },
        data: { balance: { increment: Number(payout.amount) } },
      });
      return tx.marketerPayoutRequest.update({
        where: { id: payoutId },
        data: { status: PAYOUT_STATUS.REJECTED, rejectReason: reason, dueAt: null },
        include: payoutInclude,
      });
    });
    return serializePayout(updated);
  }
}

function maskEmail(email: string): string {
  const [local, domain] = String(email).split('@');
  if (!domain) return '***';
  const head = local.slice(0, 2);
  return `${head}***@${domain}`;
}
