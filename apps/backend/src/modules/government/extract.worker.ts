import { readFile } from 'node:fs/promises';
import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import WordExtractor from 'word-extractor';

// Separate process gives malformed/untrusted documents a memory and time boundary.
process.on('message', async (message: { path: string; extension: string }) => {
  try {
    const buffer = await readFile(message.path);
    let text = '';
    if (message.extension === '.pdf') {
      const parser = new PDFParse({ data: buffer, isEvalSupported: false });
      try {
        const result = await parser.getText();
        text = result.pages
          .map((page) => `[Page ${page.num}]\n${page.text}`)
          .join('\n');
      } finally {
        await parser.destroy();
      }
    } else if (message.extension === '.docx')
      text = (await mammoth.extractRawText({ buffer })).value;
    else if (message.extension === '.doc')
      text = (await new WordExtractor().extract(buffer)).getBody();
    else if (['.xlsx', '.xls'].includes(message.extension)) {
      const workbook = XLSX.read(buffer, {
        type: 'buffer',
        cellFormula: false,
        bookVBA: false,
      });
      for (const name of workbook.SheetNames) {
        text +=
          `\nSheet: ${name}\n` + XLSX.utils.sheet_to_csv(workbook.Sheets[name]);
      }
    } else if (message.extension === '.csv') text = buffer.toString('utf8');
    else throw new Error('Unsupported document format.');
    if (!text.trim())
      throw new Error(
        'No readable text found. Scanned documents need OCR or a text-based copy.',
      );
    if (text.length > 1000000)
      throw new Error(
        'Extracted text exceeds 1,000,000 characters. Split this document.',
      );
    process.send?.({ text });
  } catch (error) {
    process.send?.({
      error: error instanceof Error ? error.message : 'Extraction failed',
    });
  }
});
