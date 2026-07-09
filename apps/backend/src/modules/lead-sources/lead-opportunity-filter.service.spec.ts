import assert from 'node:assert/strict';
import { LeadOpportunityFilterService } from './lead-opportunity-filter.service';

const filter = new LeadOpportunityFilterService();

const cases = [
  {
    title: 'Senior Software Engineer',
    description:
      'This is a full-time role with salary, benefits, resume review, and a chance to join our team.',
    expected: 'JOB_POSTING',
  },
  {
    title: 'Customer Support Consultant',
    description:
      'Handle customer support calls and chats in German and English.',
    expected: 'IRRELEVANT',
  },
  {
    title: 'Need React Native App Development',
    description:
      'Client needs Android/iOS app, backend API, fixed budget, and project timeline.',
    expected: 'PROJECT_LEAD',
  },
  {
    title: 'Contract Node.js Developer Needed',
    description:
      '3-month contract, part-time, remote consultant for project deliverables.',
    expected: 'CONTRACT_LEAD',
  },
] as const;

for (const item of cases) {
  assert.equal(
    filter.classify(item).opportunityType,
    item.expected,
    item.title,
  );
}
