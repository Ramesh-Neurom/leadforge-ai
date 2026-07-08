export const LEAD_FETCH_QUEUE = 'lead-fetch';

export interface LeadFetchJobPayload {
  sourceId: string;
}

export interface LeadFetchJobResult {
  imported: number;
  skipped: number;
  total: number;
}

export class LeadFetchWorker {
  // Worker-ready shell. Wire this to BullMQ when scheduled source syncs are added.
  async process(_payload: LeadFetchJobPayload): Promise<LeadFetchJobResult> {
    return {
      imported: 0,
      skipped: 0,
      total: 0,
    };
  }
}
