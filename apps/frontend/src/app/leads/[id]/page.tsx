'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { CurrentUser, getMe } from '@/lib/auth';
import {
  CrmActivity,
  fetchLeadActivities,
  formatActivityType,
} from '@/lib/crm';
import {
  Conversation,
  fetchConversation,
  saveConversationMessage,
} from '@/lib/conversations';
import {
  Followup,
  completeFollowup,
  fetchFollowups,
  followupStatusBadgeClass,
  formatFollowupStatus,
  generateFollowup,
} from '@/lib/followups';
import {
  Lead,
  LeadStatus,
  analyzeLead,
  fetchLead,
  formatStatus,
  leadStatuses,
  parseStringArray,
  statusBadgeClass,
  updateLeadStatus,
} from '@/lib/leads';
import {
  Proposal,
  approveProposal,
  copyProposalForManualSend,
  formatProposalStatus,
  generateProposal,
  markProposalSent,
  proposalStatusBadgeClass,
  rejectProposal,
  sendProposalEmail,
  updateProposal,
} from '@/lib/proposals';

interface ProposalDraft {
  proposalText: string;
  solutionSummary: string;
  timeline: string;
  budgetRange: string;
  questions: string;
  portfolioLinks: string;
}

const emptyProposalDraft: ProposalDraft = {
  proposalText: '',
  solutionSummary: '',
  timeline: '',
  budgetRange: '',
  questions: '',
  portfolioLinks: '',
};

export default function LeadDetailPage() {
  const params = useParams<{ id: string }>();
  const [lead, setLead] = useState<Lead | null>(null);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [generatingProposal, setGeneratingProposal] = useState(false);
  const [proposalSaving, setProposalSaving] = useState(false);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [proposalDraft, setProposalDraft] =
    useState<ProposalDraft>(emptyProposalDraft);
  const [activities, setActivities] = useState<CrmActivity[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [followupBusyId, setFollowupBusyId] = useState<string | null>(null);
  const [generatingFollowup, setGeneratingFollowup] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailText, setEmailText] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const syncProposal = useCallback(
    (nextProposal: Proposal | null, leadTitle?: string | null) => {
      setProposal(nextProposal);
      setProposalDraft(
        nextProposal ? draftFromProposal(nextProposal) : emptyProposalDraft,
      );
      if (
        nextProposal?.status === 'APPROVED' ||
        nextProposal?.status === 'SENT'
      ) {
        setEmailText((current) => current || nextProposal.proposalText);
        setEmailSubject((current) => current || defaultEmailSubject(leadTitle));
      }
    },
    [],
  );

  useEffect(() => {
    getMe().then(setUser);
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchLead(params.id),
      fetchLeadActivities(params.id),
      fetchConversation(params.id),
      fetchFollowups(params.id),
    ])
      .then(([nextLead, nextActivities, nextConversation, nextFollowups]) => {
        setLead(nextLead);
        setActivities(nextActivities);
        setConversation(nextConversation);
        setFollowups(nextFollowups);
        syncProposal(nextLead.proposals?.[0] ?? null, nextLead.title);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [params.id, syncProposal]);

  async function handleStatusChange(status: LeadStatus) {
    setSaving(true);
    setError(null);
    try {
      setLead(await updateLeadStatus(params.id, status));
      setActivities(await fetchLeadActivities(params.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update status');
    } finally {
      setSaving(false);
    }
  }

  async function handleAnalyze() {
    setAnalyzing(true);
    setError(null);
    try {
      setLead(await analyzeLead(params.id));
      setActivities(await fetchLeadActivities(params.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to analyze lead');
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleMarkQualified() {
    await handleStatusChange('QUALIFIED');
  }

  async function handleGenerateProposal() {
    setGeneratingProposal(true);
    setError(null);
    try {
      const nextProposal = await generateProposal(params.id);
      syncProposal(nextProposal, lead?.title);
      setLead(await fetchLead(params.id));
      setActivities(await fetchLeadActivities(params.id));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to generate proposal',
      );
    } finally {
      setGeneratingProposal(false);
    }
  }

  async function handleSaveProposal() {
    if (!proposal) {
      return;
    }

    setProposalSaving(true);
    setError(null);
    try {
      syncProposal(
        await updateProposal(proposal.id, proposalDraft),
        lead?.title,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save proposal');
    } finally {
      setProposalSaving(false);
    }
  }

  async function handleApproveProposal() {
    if (!proposal) {
      return;
    }

    setProposalSaving(true);
    setError(null);
    try {
      const approved = await approveProposal(proposal.id);
      syncProposal(approved, lead?.title);
      setEmailText(approved.proposalText);
      setEmailSubject(defaultEmailSubject(lead?.title));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to approve proposal',
      );
    } finally {
      setProposalSaving(false);
    }
  }

  async function handleRejectProposal() {
    if (!proposal) {
      return;
    }

    setProposalSaving(true);
    setError(null);
    try {
      syncProposal(await rejectProposal(proposal.id), lead?.title);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to reject proposal',
      );
    } finally {
      setProposalSaving(false);
    }
  }

  async function handleMarkProposalSent() {
    if (!proposal) {
      return;
    }

    setProposalSaving(true);
    setError(null);
    try {
      syncProposal(await markProposalSent(proposal.id, 'Manual'), lead?.title);
      setLead(await fetchLead(params.id));
      setActivities(await fetchLeadActivities(params.id));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to mark proposal as sent',
      );
    } finally {
      setProposalSaving(false);
    }
  }

  async function handleCopyProposal() {
    await navigator.clipboard.writeText(proposalDraft.proposalText);
  }

  async function handleSaveMessage() {
    if (!emailText.trim()) {
      return;
    }

    setEmailSaving(true);
    setError(null);
    try {
      setConversation(
        await saveConversationMessage(params.id, {
          senderType: 'AI_DRAFT',
          messageText: emailText,
          messageChannel: 'COMPOSER_DRAFT',
          aiSummary: 'Saved email composer draft.',
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save message');
    } finally {
      setEmailSaving(false);
    }
  }

  async function handleSendEmail() {
    if (!proposal || !emailText.trim()) {
      return;
    }

    setEmailSaving(true);
    setError(null);
    try {
      const result = await sendProposalEmail(proposal.id, {
        subject: emailSubject,
        messageText: emailText,
      });
      syncProposal(result.proposal, lead?.title);
      setLead(await fetchLead(params.id));
      setActivities(await fetchLeadActivities(params.id));
      setConversation(await fetchConversation(params.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send email');
    } finally {
      setEmailSaving(false);
    }
  }

  async function handleCopyManualSend() {
    if (!proposal || !emailText.trim()) {
      return;
    }

    setEmailSaving(true);
    setError(null);
    try {
      const result = await copyProposalForManualSend(proposal.id, emailText);
      await navigator.clipboard.writeText(result.messageText);
      syncProposal(result.proposal, lead?.title);
      setLead(await fetchLead(params.id));
      setActivities(await fetchLeadActivities(params.id));
      setConversation(await fetchConversation(params.id));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to copy proposal for manual send',
      );
    } finally {
      setEmailSaving(false);
    }
  }

  async function handleGenerateFollowup() {
    setGeneratingFollowup(true);
    setError(null);
    try {
      await generateFollowup(params.id);
      setFollowups(await fetchFollowups(params.id));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to generate follow-up',
      );
    } finally {
      setGeneratingFollowup(false);
    }
  }

  async function handleCompleteFollowup(id: string) {
    setFollowupBusyId(id);
    setError(null);
    try {
      await completeFollowup(id);
      setFollowups(await fetchFollowups(params.id));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to complete follow-up',
      );
    } finally {
      setFollowupBusyId(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-600">Loading lead...</p>;
  }

  if (!lead) {
    return (
      <section className="space-y-4">
        <Link href="/leads" className="text-sm text-slate-600 hover:underline">
          Back to leads
        </Link>
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error ?? 'Lead not found'}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/leads"
            className="text-sm text-slate-600 hover:underline"
          >
            Back to leads
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">{lead.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-2 py-1 text-xs font-medium ${statusBadgeClass(lead.status)}`}
            >
              {formatStatus(lead.status)}
            </span>
            <span className="text-sm text-slate-500">{lead.sourceName}</span>
            {lead.analysis ? (
              <span className="text-sm text-slate-500">
                Score {lead.analysis.leadScore}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={analyzing}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {analyzing ? 'Analyzing...' : 'Analyze Lead'}
          </button>
          {lead.analysis?.recommendedAction === 'APPLY' &&
          canQualify(user) &&
          lead.status !== 'QUALIFIED' ? (
            <button
              type="button"
              onClick={handleMarkQualified}
              disabled={saving}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-emerald-300"
            >
              {saving ? 'Updating...' : 'Mark as Qualified'}
            </button>
          ) : null}
          <label className="space-y-1 text-sm">
            <span className="font-medium">Update status</span>
            <select
              value={lead.status}
              disabled={saving}
              onChange={(event) =>
                handleStatusChange(event.target.value as LeadStatus)
              }
              className="w-full min-w-56 rounded-md border px-3 py-2"
            >
              {leadStatuses.map((status) => (
                <option key={status} value={status}>
                  {formatStatus(status)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
            <h2 className="font-semibold">Project brief</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
              {lead.description}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {parseStringArray(lead.skillsJson).map((skill) => (
                <span
                  key={skill}
                  className="rounded border px-2 py-1 text-xs text-slate-600"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
            <h2 className="font-semibold">Lead analysis</h2>
            {lead.analysis ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <Info
                  label="Lead score"
                  value={String(lead.analysis.leadScore)}
                />
                <Info label="Priority" value={lead.analysis.priority} />
                <Info label="Category" value={lead.analysis.category} />
                <Info
                  label="Budget quality"
                  value={lead.analysis.budgetQuality}
                />
                <Info
                  label="Client seriousness"
                  value={lead.analysis.clientSeriousness}
                />
                <Info
                  label="Recommended action"
                  value={lead.analysis.recommendedAction}
                />
                <TagList
                  label="Required skills"
                  items={parseStringArray(lead.analysis.requiredSkillsJson)}
                />
                <FlagList
                  label="Red flags"
                  items={parseStringArray(lead.analysis.redFlagsJson)}
                />
                <div className="md:col-span-2">
                  <Info label="Summary" value={lead.analysis.aiSummary} />
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">
                No analysis added yet.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Proposal</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Generate, edit, approve, and track the proposal for this lead.
                </p>
              </div>
              <button
                type="button"
                onClick={handleGenerateProposal}
                disabled={generatingProposal}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {generatingProposal
                  ? 'Generating...'
                  : proposal
                    ? 'Regenerate Proposal'
                    : 'Generate Proposal'}
              </button>
            </div>

            {proposal ? (
              <div className="mt-4 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-2 py-1 text-xs font-medium ${proposalStatusBadgeClass(proposal.status)}`}
                  >
                    {formatProposalStatus(proposal.status)}
                  </span>
                  {proposal.approvedBy ? (
                    <span className="text-sm text-slate-500">
                      Approved by {proposal.approvedBy.name}
                    </span>
                  ) : null}
                  {proposal.sentAt ? (
                    <span className="text-sm text-slate-500">
                      Sent {formatDate(proposal.sentAt)}
                    </span>
                  ) : null}
                </div>

                <label className="space-y-1 text-sm">
                  <span className="font-medium">Proposal text</span>
                  <textarea
                    value={proposalDraft.proposalText}
                    onChange={(event) =>
                      setProposalDraft({
                        ...proposalDraft,
                        proposalText: event.target.value,
                      })
                    }
                    className="min-h-80 w-full rounded-md border px-3 py-2 leading-6"
                  />
                </label>

                <div className="grid gap-3 md:grid-cols-2">
                  <ProposalField
                    label="Solution summary"
                    value={proposalDraft.solutionSummary}
                    onChange={(solutionSummary) =>
                      setProposalDraft({ ...proposalDraft, solutionSummary })
                    }
                  />
                  <ProposalField
                    label="Timeline"
                    value={proposalDraft.timeline}
                    onChange={(timeline) =>
                      setProposalDraft({ ...proposalDraft, timeline })
                    }
                  />
                  <ProposalField
                    label="Budget range"
                    value={proposalDraft.budgetRange}
                    onChange={(budgetRange) =>
                      setProposalDraft({ ...proposalDraft, budgetRange })
                    }
                  />
                  <ProposalField
                    label="Portfolio links"
                    value={proposalDraft.portfolioLinks}
                    onChange={(portfolioLinks) =>
                      setProposalDraft({ ...proposalDraft, portfolioLinks })
                    }
                    placeholder="One link per line"
                  />
                  <label className="space-y-1 text-sm md:col-span-2">
                    <span className="font-medium">Clarification questions</span>
                    <textarea
                      value={proposalDraft.questions}
                      onChange={(event) =>
                        setProposalDraft({
                          ...proposalDraft,
                          questions: event.target.value,
                        })
                      }
                      placeholder="One question per line"
                      className="min-h-24 w-full rounded-md border px-3 py-2"
                    />
                  </label>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleSaveProposal}
                    disabled={proposalSaving}
                    className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
                  >
                    {proposalSaving ? 'Saving...' : 'Save proposal'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyProposal}
                    className="rounded-md border px-4 py-2 text-sm font-medium"
                  >
                    Copy proposal
                  </button>
                  <button
                    type="button"
                    onClick={handleApproveProposal}
                    disabled={proposalSaving || proposal.status === 'APPROVED'}
                    className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={handleRejectProposal}
                    disabled={proposalSaving || proposal.status === 'REJECTED'}
                    className="rounded-md border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    onClick={handleMarkProposalSent}
                    disabled={
                      proposalSaving ||
                      proposal.status === 'SENT' ||
                      proposal.status !== 'APPROVED'
                    }
                    className="rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Mark as Sent
                  </button>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">
                No proposal generated yet.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Email composer</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Edit the approved proposal before sending or copying it for
                  manual outreach.
                </p>
              </div>
              {lead.clientEmail ? (
                <span className="rounded-full border bg-slate-50 px-2 py-1 text-xs text-slate-600">
                  {lead.clientEmail}
                </span>
              ) : (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-700">
                  No client email
                </span>
              )}
            </div>

            {proposal?.status === 'APPROVED' || proposal?.status === 'SENT' ? (
              <div className="mt-4 space-y-4">
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Subject</span>
                  <input
                    value={emailSubject}
                    onChange={(event) => setEmailSubject(event.target.value)}
                    disabled={!canQualify(user)}
                    className="w-full rounded-md border px-3 py-2 disabled:bg-slate-50"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Email body</span>
                  <textarea
                    value={emailText}
                    onChange={(event) => setEmailText(event.target.value)}
                    disabled={!canQualify(user)}
                    className="min-h-80 w-full rounded-md border px-3 py-2 leading-6 disabled:bg-slate-50"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  {lead.clientEmail ? (
                    <button
                      type="button"
                      onClick={handleSendEmail}
                      disabled={
                        emailSaving ||
                        !canQualify(user) ||
                        proposal.status !== 'APPROVED'
                      }
                      className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
                    >
                      {emailSaving ? 'Sending...' : 'Send Email'}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={handleCopyManualSend}
                    disabled={
                      emailSaving ||
                      !canQualify(user) ||
                      proposal.status !== 'APPROVED'
                    }
                    className="rounded-md border px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Copy for Manual Send
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveMessage}
                    disabled={emailSaving || !canQualify(user)}
                    className="rounded-md border px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Save message history
                  </button>
                </div>
                {!lead.clientEmail ? (
                  <p className="text-sm text-slate-500">
                    Client email is missing, so use the copy workflow and send
                    through the marketplace or another channel.
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">
                Approve a proposal before composing an email.
              </p>
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
            <h2 className="font-semibold">Client</h2>
            <div className="mt-4 space-y-3">
              <Info label="Name" value={lead.clientName} />
              <Info label="Country" value={lead.clientCountry} />
              <Info label="Email" value={lead.clientEmail} />
              <Info label="Assigned to" value={lead.assignedTo?.name ?? null} />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
            <h2 className="font-semibold">Opportunity</h2>
            <div className="mt-4 space-y-3">
              <Info label="Budget" value={formatBudget(lead)} />
              <Info label="Budget type" value={lead.budgetType} />
              <Info label="Posted" value={formatDate(lead.postedAt)} />
              <Info label="Created" value={formatDate(lead.createdAt)} />
              {lead.projectUrl ? (
                <ExternalLink label="Project URL" href={lead.projectUrl} />
              ) : null}
              {lead.clientProfileUrl ? (
                <ExternalLink
                  label="Client profile"
                  href={lead.clientProfileUrl}
                />
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
            <h2 className="font-semibold">Activity timeline</h2>
            {activities.length ? (
              <ol className="mt-4 space-y-4">
                {activities.map((activity) => (
                  <li
                    key={activity.id}
                    className="border-l-2 border-slate-200 pl-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700">
                        {formatActivityType(activity.activityType)}
                      </span>
                      <span className="text-xs text-slate-500">
                        {formatDateTime(activity.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-800">
                      {activity.description}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      By {activity.user?.name ?? 'Unknown user'}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-3 text-sm text-slate-500">
                No CRM activities yet.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
            <h2 className="font-semibold">Message history</h2>
            {conversation?.messages.length ? (
              <ol className="mt-4 space-y-4">
                {conversation.messages.map((message) => (
                  <li
                    key={message.id}
                    className="space-y-1 border-b pb-3 last:border-0"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700">
                        {formatStatus(message.senderType as LeadStatus)}
                      </span>
                      <span className="text-xs text-slate-500">
                        {message.messageChannel}
                      </span>
                      <span className="text-xs text-slate-500">
                        {formatDateTime(message.createdAt)}
                      </span>
                    </div>
                    <p className="line-clamp-4 whitespace-pre-wrap text-sm text-slate-700">
                      {message.messageText}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-3 text-sm text-slate-500">
                No messages saved yet.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold">Follow-up timeline</h2>
              <button
                type="button"
                onClick={handleGenerateFollowup}
                disabled={generatingFollowup}
                className="rounded-md border px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-60"
              >
                {generatingFollowup ? 'Generating...' : 'AI generate'}
              </button>
            </div>
            {followups.length ? (
              <ol className="mt-4 space-y-4">
                {followups.map((followup) => (
                  <li
                    key={followup.id}
                    className="space-y-2 border-b pb-3 last:border-0"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs font-medium ${followupStatusBadgeClass(followup.status)}`}
                      >
                        {formatFollowupStatus(followup.status)}
                      </span>
                      <span className="text-xs text-slate-500">
                        {new Date(followup.scheduledAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-slate-700">
                      {followup.message}
                    </p>
                    {followup.status === 'PENDING' ? (
                      <button
                        type="button"
                        onClick={() => handleCompleteFollowup(followup.id)}
                        disabled={followupBusyId === followup.id}
                        className="rounded-md border px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {followupBusyId === followup.id
                          ? 'Completing...'
                          : 'Complete follow-up'}
                      </button>
                    ) : null}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-3 text-sm text-slate-500">
                No follow-ups scheduled yet.
              </p>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm text-slate-900">{value || '-'}</p>
    </div>
  );
}

function TagList({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      {items.length ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {items.map((item) => (
            <span
              key={item}
              className="rounded border px-2 py-1 text-xs text-slate-600"
            >
              {item}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-1 text-sm text-slate-500">-</p>
      )}
    </div>
  );
}

function ProposalField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="space-y-1 text-sm">
      <span className="font-medium">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-h-20 w-full rounded-md border px-3 py-2"
      />
    </label>
  );
}

function FlagList({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      {items.length ? (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-slate-500">None</p>
      )}
    </div>
  );
}

function ExternalLink({ label, href }: { label: string; href: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="mt-1 block break-all text-sm text-blue-700 hover:underline"
      >
        {href}
      </a>
    </div>
  );
}

function formatBudget(lead: Lead) {
  if (!lead.budgetMin && !lead.budgetMax) {
    return null;
  }

  const currency = lead.currency ?? '';
  if (lead.budgetMin && lead.budgetMax) {
    return `${currency} ${lead.budgetMin.toLocaleString()} - ${lead.budgetMax.toLocaleString()}`;
  }

  return `${currency} ${(lead.budgetMin ?? lead.budgetMax)?.toLocaleString()}`;
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString() : '-';
}

function formatDateTime(value: string | null) {
  return value ? new Date(value).toLocaleString() : '-';
}

function canQualify(user: CurrentUser | null) {
  return user?.role === 'MANAGER' || user?.role === 'ADMIN';
}

function draftFromProposal(proposal: Proposal): ProposalDraft {
  return {
    proposalText: proposal.proposalText,
    solutionSummary: proposal.solutionSummary ?? '',
    timeline: proposal.timeline ?? '',
    budgetRange: proposal.budgetRange ?? '',
    questions: parseStringArray(proposal.questionsJson).join('\n'),
    portfolioLinks: parseStringArray(proposal.portfolioLinksJson).join('\n'),
  };
}

function defaultEmailSubject(title?: string | null) {
  return title ? `Proposal: ${title}` : 'Proposal';
}
