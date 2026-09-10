/**
 * One-time: перенос birthCertificate / medicalCertificate из data URL (base64 в БД)
 * в файлы uploads/client-certificates/{tenantId}/.
 *
 * Запуск: npx ts-node scripts/migrate-client-certificates-to-disk.ts
 */
import { PrismaClient } from '@prisma/client';
import {
  isDataUrl,
  migrateCertificateValueIfNeeded,
} from '../src/utils/clientCertificates';

const prisma = new PrismaClient();

async function main() {
  const clients = await prisma.client.findMany({
    select: {
      id: true,
      tenantId: true,
      birthCertificate: true,
      medicalCertificate: true,
    },
  });

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const client of clients) {
    const data: { birthCertificate?: string | null; medicalCertificate?: string | null } = {};

    if (isDataUrl(client.birthCertificate)) {
      try {
        const r = migrateCertificateValueIfNeeded(
          client.tenantId,
          client.id,
          'birth',
          client.birthCertificate
        );
        if (r.changed) {
          data.birthCertificate = r.path;
          migrated += 1;
        }
      } catch (e) {
        errors += 1;
        console.error(`birth ${client.id}`, e);
      }
    } else {
      skipped += 1;
    }

    if (isDataUrl(client.medicalCertificate)) {
      try {
        const r = migrateCertificateValueIfNeeded(
          client.tenantId,
          client.id,
          'medical',
          client.medicalCertificate
        );
        if (r.changed) {
          data.medicalCertificate = r.path;
          migrated += 1;
        }
      } catch (e) {
        errors += 1;
        console.error(`medical ${client.id}`, e);
      }
    } else {
      skipped += 1;
    }

    if (Object.keys(data).length > 0) {
      await prisma.client.update({ where: { id: client.id }, data });
      console.log(`OK ${client.id}`, data);
    }
  }

  console.log({ migrated, skipped, errors, totalClients: clients.length });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
