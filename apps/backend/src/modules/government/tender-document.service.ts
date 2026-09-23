import {
  BadRequestException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import { fork } from 'node:child_process';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import https from 'node:https';
import { PrismaService } from '../../prisma/prisma.service';
import {
  GovernmentService,
  activity,
  documentSelect,
  invalidate,
  lockTender,
} from './government.service';
import { CompanyService } from './company.service';
import { documentTypeInput, parse } from './government.schemas';

export const maxDocumentBytes = () =>
  Math.min(
    Math.max(
      Number(process.env.TENDER_DOC_MAX_BYTES) || 15 * 1024 * 1024,
      1024,
    ),
    30 * 1024 * 1024,
  );
const mime: Record<string, string[]> = {
  '.pdf': ['application/pdf'],
  '.doc': ['application/msword'],
  '.docx': [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  '.xls': ['application/vnd.ms-excel'],
  '.xlsx': [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
  '.csv': [
    'text/csv',
    'application/csv',
    'application/vnd.ms-excel',
    'text/plain',
  ],
};
export function validateFile(file: {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
}) {
  const extension = extname(file.originalname).toLowerCase();
  if (
    !mime[extension] ||
    !mime[extension].includes(file.mimetype.toLowerCase().split(';')[0])
  )
    throw new BadRequestException('Unsupported file extension or MIME type');
  if (!file.buffer.length || file.buffer.length > maxDocumentBytes())
    throw new BadRequestException('File is empty or exceeds size limit');
  const magic = file.buffer.subarray(0, 8);
  if (extension === '.pdf' && !magic.toString().startsWith('%PDF-'))
    throw new BadRequestException('Invalid PDF signature');
  if (
    ['.docx', '.xlsx'].includes(extension) &&
    magic.subarray(0, 4).toString('hex') !== '504b0304'
  )
    throw new BadRequestException('Invalid Office file signature');
  if (
    ['.doc', '.xls'].includes(extension) &&
    magic.toString('hex') !== 'd0cf11e0a1b11ae1'
  )
    throw new BadRequestException('Invalid legacy Office signature');
  if (
    extension === '.csv' &&
    (file.buffer.includes(0) ||
      /<\s*(html|script|!doctype)/i.test(file.buffer.toString('utf8')))
  )
    throw new BadRequestException('Invalid CSV content');
  return extension;
}
export function publicIpv4(address: string) {
  const p = address.split('.').map(Number);
  return (
    isIP(address) === 4 &&
    !(
      [0, 10, 127].includes(p[0]) ||
      p[0] >= 224 ||
      (p[0] === 169 && p[1] === 254) ||
      (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
      (p[0] === 192 && (p[1] === 168 || p[1] === 0)) ||
      (p[0] === 100 && p[1] >= 64 && p[1] <= 127) ||
      (p[0] === 198 && (p[1] === 18 || p[1] === 19)) ||
      (p[0] === 198 && p[1] === 51) ||
      (p[0] === 203 && p[1] === 0)
    )
  );
}
export async function downloadPublic(
  url: string,
  redirects = 0,
): Promise<{ buffer: Buffer; mimeType: string; url: string }> {
  let target: URL;
  try {
    target = new URL(url);
  } catch {
    throw new BadRequestException('Invalid document URL');
  }
  const allowed = (process.env.TENDER_DOC_ALLOWED_HOSTS ?? 'bidplus.gem.gov.in')
    .split(',')
    .map((s) => s.trim().toLowerCase());
  if (
    target.protocol !== 'https:' ||
    target.username ||
    target.password ||
    (target.port && target.port !== '443') ||
    !allowed.includes(target.hostname) ||
    isIP(target.hostname) ||
    redirects > 3
  )
    throw new BadRequestException(
      'Document URL must use an allowed public government host',
    );
  const addresses = await lookup(target.hostname, { all: true, family: 4 });
  if (!addresses.length || addresses.some((a) => !publicIpv4(a.address)))
    throw new BadRequestException('Private or reserved destination blocked');
  // Pin the checked address; do not perform a second DNS lookup at connection time.
  return new Promise((resolveDownload, reject) => {
    const request = https.get(
      target,
      {
        lookup: (_host, _options, cb) => cb(null, addresses[0].address, 4),
        headers: { Accept: 'application/pdf,application/octet-stream' },
        timeout: 15000,
      },
      (response) => {
        if (
          response.statusCode &&
          response.statusCode >= 300 &&
          response.statusCode < 400
        ) {
          response.resume();
          if (!response.headers.location) {
            reject(new BadRequestException('Invalid redirect'));
            return;
          }
          downloadPublic(
            new URL(response.headers.location, target).href,
            redirects + 1,
          ).then(resolveDownload, reject);
          return;
        }
        if (response.statusCode !== 200) {
          response.resume();
          reject(
            new BadRequestException(
              `Public document access failed (${response.statusCode}). Upload manually; no protected access is attempted.`,
            ),
          );
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        response.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > maxDocumentBytes()) {
            request.destroy(
              new BadRequestException('Download exceeds size limit'),
            );
            return;
          }
          chunks.push(chunk);
        });
        response.on('error', reject);
        response.on('end', () =>
          resolveDownload({
            buffer: Buffer.concat(chunks),
            mimeType:
              response.headers['content-type']?.split(';')[0] ??
              'application/octet-stream',
            url: target.href,
          }),
        );
      },
    );
    const deadline = setTimeout(
      () => request.destroy(new Error('Document download timed out')),
      20000,
    );
    request.on('close', () => clearTimeout(deadline));
    request.on('timeout', () =>
      request.destroy(new Error('Document download timed out')),
    );
    request.on('error', reject);
  });
}

@Injectable()
export class TenderDocumentService {
  constructor(
    private db: PrismaService,
    private government: GovernmentService,
    private company: CompanyService,
  ) {}
  root() {
    return resolve(process.env.TENDER_STORAGE_DIR ?? 'storage/government');
  }
  async store(file: Express.Multer.File) {
    if (!file) throw new BadRequestException('File required');
    const extension = validateFile(file);
    await mkdir(this.root(), { recursive: true });
    const storageKey = randomUUID() + extension;
    await writeFile(join(this.root(), storageKey), file.buffer, { flag: 'wx' });
    return {
      storageKey,
      mimeType: file.mimetype,
      size: file.buffer.length,
      sha256: createHash('sha256').update(file.buffer).digest('hex'),
      name: basename(file.originalname.replace(/\\/g, '/'))
        .replace(/[\r\n\x00-\x1f]/g, '')
        .slice(0, 200),
    };
  }
  async upload(
    tenderId: string,
    file: Express.Multer.File,
    documentType: unknown,
    actor: string,
    sourceUrl?: string,
  ) {
    const type = parse(documentTypeInput, documentType ?? 'BID_DOCUMENT');
    await this.government.detail(tenderId);
    if (!file) throw new BadRequestException('File required');
    validateFile(file);
    const sha256 = createHash('sha256').update(file.buffer).digest('hex');
    const existing = await this.db.tenderDocument.findUnique({
      where: { tenderId_sha256: { tenderId, sha256 } },
      select: documentSelect,
    });
    if (existing) return existing;
    const stored = await this.store(file);
    const doc = await this.db.$transaction(async (tx) => {
      await lockTender(tx, tenderId);
      const result = await tx.tenderDocument.create({
        data: { ...stored, tenderId, documentType: type, sourceUrl },
        select: documentSelect,
      });
      await invalidate(tx, tenderId, actor);
      await activity(tx, actor, 'DOCUMENT_UPLOADED', tenderId, {
        documentId: result.id,
      });
      await tx.tenderRevision.create({
        data: { tenderId, fieldName: 'documents', newValue: stored.name },
      });
      return result;
    });
    await this.process(tenderId, doc.id, actor);
    return this.db.tenderDocument.findUnique({
      where: { id: doc.id },
      select: documentSelect,
    });
  }
  async fetch(
    tenderId: string,
    input: { url: string; name: string; documentType?: string },
    actor: string,
  ) {
    const downloaded = await downloadPublic(input.url);
    return this.upload(
      tenderId,
      {
        originalname: input.name,
        mimetype: downloaded.mimeType,
        buffer: downloaded.buffer,
      } as Express.Multer.File,
      input.documentType,
      actor,
      downloaded.url,
    );
  }
  async process(tenderId: string, id: string, actor: string) {
    const doc = await this.db.tenderDocument.findFirst({
      where: { id, tenderId },
    });
    if (!doc) throw new NotFoundException('Document not found');
    if (doc.processingStatus === 'PROCESSED') return { status: 'PROCESSED' };
    let text: string;
    try {
      text = await this.extract(
        join(this.root(), doc.storageKey),
        extname(doc.storageKey),
      );
    } catch (error) {
      await this.db.tenderDocument.update({
        where: { id },
        data: {
          processingStatus: 'FAILED',
          processingError:
            error instanceof Error ? error.message : 'Extraction failed',
        },
      });
      return { status: 'FAILED' };
    }
    return this.db.$transaction(async (tx) => {
      await lockTender(tx, tenderId);
      await tx.tenderDocument.update({
        where: { id },
        data: {
          extractedText: text,
          processingStatus: 'PROCESSED',
          processingError: null,
        },
      });
      await invalidate(tx, tenderId, actor);
      await activity(tx, actor, 'DOCUMENT_EXTRACTED', tenderId, {
        documentId: id,
      });
      return { status: 'PROCESSED' };
    });
  }
  extract(path: string, extension: string): Promise<string> {
    return new Promise((resolveText, reject) => {
      const workerFile = join(
        __dirname,
        'extract.worker' + extname(__filename),
      );
      const worker = fork(workerFile, [], {
        env: {
          PATH: process.env.PATH,
          SystemRoot: process.env.SystemRoot,
          TEMP: process.env.TEMP,
          TMP: process.env.TMP,
          NODE_ENV: 'production',
        },
        execArgv:
          extname(__filename) === '.ts'
            ? ['--import', 'tsx', '--max-old-space-size=256']
            : ['--max-old-space-size=256'],
        stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      });
      const timer = setTimeout(() => {
        worker.kill();
        reject(
          new Error('Extraction timed out; split or convert the document.'),
        );
      }, 30000);
      worker.on('message', (result: { text?: string; error?: string }) => {
        clearTimeout(timer);
        worker.kill();
        result.text
          ? resolveText(result.text)
          : reject(new Error(result.error ?? 'Extraction failed'));
      });
      worker.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      worker.on('exit', (code) => {
        clearTimeout(timer);
        if (code !== 0)
          reject(
            new Error(
              'Extraction process stopped; document may be malformed or too large.',
            ),
          );
      });
      worker.send({ path, extension });
    });
  }
  async remove(tenderId: string, id: string, actor: string) {
    return this.db.$transaction(async (tx) => {
      await lockTender(tx, tenderId);
      const deleted = await tx.tenderDocument.deleteMany({
        where: { id, tenderId },
      });
      if (!deleted.count) throw new NotFoundException();
      await invalidate(tx, tenderId, actor);
      await activity(tx, actor, 'DOCUMENT_REMOVED', tenderId, { id });
      return { deleted: true };
    });
  }
  async uploadCompany(id: string, file: Express.Multer.File, actor: string) {
    if (!(await this.db.companyDocument.findUnique({ where: { id } })))
      throw new NotFoundException();
    const stored = await this.store(file);
    return this.db.$transaction(async (tx) => {
      await tx.companyDocument.update({
        where: { id },
        data: { ...stored, status: 'NEEDS_VERIFICATION' },
      });
      await this.company.invalidateCompany(tx);
      await activity(tx, actor, 'COMPANY_DOCUMENT_UPLOADED', undefined, { id });
      return { uploaded: true };
    });
  }
  async download(id: string, company = false, tenderId?: string) {
    const doc = company
      ? await this.db.companyDocument.findUnique({ where: { id } })
      : await this.db.tenderDocument.findFirst({ where: { id, tenderId } });
    if (!doc?.storageKey) throw new NotFoundException('File not found');
    if (basename(doc.storageKey) !== doc.storageKey)
      throw new BadRequestException('Invalid storage key');
    return new StreamableFile(
      createReadStream(join(this.root(), doc.storageKey)),
      {
        type: 'application/octet-stream',
        disposition: `attachment; filename*=UTF-8''${encodeURIComponent(doc.name)}`,
      },
    );
  }
}
