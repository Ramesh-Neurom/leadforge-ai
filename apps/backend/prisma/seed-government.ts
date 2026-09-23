import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import {
  parse,
  sourceInput,
} from '../src/modules/government/government.schemas';
const db = new PrismaClient();
async function main() {
  const template = parse(
    sourceInput,
    JSON.parse(
      readFileSync(
        resolve(__dirname, '../../../docs/government-source-config.json'),
        'utf8',
      ),
    ),
  );
  for (const source of [
    template,
    {
      ...template,
      name: 'Manual Government Tenders',
      integrationType: 'MANUAL_GOVT_TENDER' as const,
    },
  ]) {
    const existing = await db.tenderSource.findFirst({
      where: { name: source.name, integrationType: source.integrationType },
    });
    if (!existing) await db.tenderSource.create({ data: source });
  }
  await db.companyProfile.upsert({
    where: { id: 'company' },
    create: { id: 'company' },
    update: {},
  });
  console.log(
    'Government source configuration initialized; company facts remain empty. Existing source rules preserved.',
  );
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
