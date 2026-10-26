import { describe, it, expect } from 'vitest';
import { buildBugReportMailto } from './bugReport';

describe('buildBugReportMailto', () => {
  it('targets the shared family agent address', () => {
    expect(buildBugReportMailto('it broke')).toMatch(/^mailto:simpsonfamilyhubapp@gmail\.com\?/);
  });

  it('includes the description and a non-actionable header the agent parser can see', () => {
    const url = buildBugReportMailto('Groceries list did not save');
    const decoded = decodeURIComponent(url);
    expect(decoded).toContain('Groceries list did not save');
    expect(decoded).toContain('BUG REPORT');
  });

  it('encodes spaces as %20, not +, so mail clients render the body correctly', () => {
    const url = buildBugReportMailto('two words');
    expect(url).not.toContain('+');
    expect(url).toContain('%20');
  });

  it('includes page/theme context when provided', () => {
    const url = buildBugReportMailto('x', { page: 'budget', theme: 'dark' });
    const decoded = decodeURIComponent(url);
    expect(decoded).toContain('Page: budget');
    expect(decoded).toContain('Theme: dark');
  });
});
