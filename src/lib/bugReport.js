// T-22 (in-app bug reporting). Deliberately the simplest version that needs
// zero Apps Script changes and zero new sheet tabs: a mailto: link to the
// same shared agent address everything else already goes through
// (simpsonfamilyhubapp@gmail.com). Gemini will try to parse it as a
// task/event/grocery item, find nothing actionable, and the existing
// fallback in processFamilyAgentEmails_ (family-agent.gs) already parks
// anything non-actionable in "Family Agent/Needs Review" -- which Trey
// already checks periodically (see T-27/T-28 in family-hub-project.md). So
// this reuses an existing, already-working landing spot instead of
// building a new one.
//
// Known limitation, not fixed here on purpose: Gemini *could* in principle
// misread a report as a real task/event instead of finding it
// non-actionable, landing it in Tasks/Calendar instead of Needs Review --
// a stray item to notice and delete, not a dangerous failure. Fixing that
// for certain would mean teaching the Gemini prompt in family-agent.gs
// about a dedicated bug-report case, which is a script.google.com change --
// flagged territory, not done blind. The explicit "BUG REPORT" header
// below is a best-effort nudge, not a guarantee.

const AGENT_ADDRESS = 'simpsonfamilyhubapp@gmail.com';

export function buildBugReportMailto(description, context = {}) {
  const subject = '[Bug Report] Family Hub';
  const lines = [
    'BUG REPORT (not a task, event, or grocery item)',
    '',
    description.trim(),
    '',
    `Page: ${context.page || 'unknown'}`,
    `Theme: ${context.theme || 'unknown'}`,
    `Reported: ${new Date().toLocaleString()}`,
  ];
  const params = new URLSearchParams({ subject, body: lines.join('\n') });
  // URLSearchParams encodes spaces as "+", which mailto: body/subject
  // fields don't decode back to spaces in every mail client -- swap to %20.
  return `mailto:${AGENT_ADDRESS}?${params.toString().replace(/\+/g, '%20')}`;
}
