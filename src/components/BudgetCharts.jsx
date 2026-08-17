import { ResponsiveSankey } from '@nivo/sankey';
import { ResponsivePie } from '@nivo/pie';
import { ResponsiveLine } from '@nivo/line';
import { getNivoTheme, colorForCategory, cssVar } from '../lib/chartTheme';

// Must match EXCLUDED_BUDGET_CATEGORIES in AppContext.jsx / EXCLUDED_FROM_BUDGET
// in apps-script/family-agent.gs — these charts should reflect the same
// "regular monthly spending" definition the rest of the Budget page uses.
const EXCLUDED_FROM_CHARTS = ['one-time', 'trey-work'];

function formatCategoryLabel(category) {
  return category.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function formatCurrency(amount) {
  return amount.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

// Total Monthly Spend -> Fixed/Discretionary -> individual categories. The
// app has no income tracking (Transactions is spend-only), so "Income" as
// a root node would not fit the data model -- Total Spend splitting into
// the fixed/discretionary buckets already computed elsewhere on this page
// is the framing that actually matches what this app tracks.
function buildSankeyData(monthTransactions, fixedBillMerchants) {
  const fixedByCategory = {};
  const discretionaryByCategory = {};
  monthTransactions
    .filter((t) => !EXCLUDED_FROM_CHARTS.includes(t.category))
    .forEach((t) => {
      const bucket = fixedBillMerchants.includes(t.merchant.toLowerCase()) ? fixedByCategory : discretionaryByCategory;
      bucket[t.category] = (bucket[t.category] || 0) + t.amount;
    });

  // A category can legitimately net to zero or negative for a month now
  // that returns/refunds post as their own negative-amount rows (e.g. a
  // category whose only transaction that month was a return) -- a Sankey
  // link or pie slice can't represent a negative flow, so those categories
  // are dropped from the chart entirely rather than shown as $0 or negative.
  // The real (possibly negative) numbers still drive the actual totals
  // elsewhere on the page (budgetCategoryTotals in AppContext.jsx) -- this
  // filtering is chart-display-only.
  const fixedEntries = Object.entries(fixedByCategory).filter(([, v]) => v > 0);
  const discretionaryEntries = Object.entries(discretionaryByCategory).filter(([, v]) => v > 0);
  const fixedTotal = fixedEntries.reduce((s, [, v]) => s + v, 0);
  const discretionaryTotal = discretionaryEntries.reduce((s, [, v]) => s + v, 0);
  const categories = new Set([...fixedEntries, ...discretionaryEntries].map(([c]) => c));

  const nodes = [
    { id: 'Total Spend' },
    ...(fixedTotal > 0 ? [{ id: 'Fixed' }] : []),
    ...(discretionaryTotal > 0 ? [{ id: 'Discretionary' }] : []),
    ...[...categories].map((c) => ({ id: formatCategoryLabel(c) })),
  ];
  const links = [
    ...(fixedTotal > 0 ? [{ source: 'Total Spend', target: 'Fixed', value: fixedTotal }] : []),
    ...(discretionaryTotal > 0 ? [{ source: 'Total Spend', target: 'Discretionary', value: discretionaryTotal }] : []),
    ...fixedEntries.map(([c, v]) => ({ source: 'Fixed', target: formatCategoryLabel(c), value: v })),
    ...discretionaryEntries.map(([c, v]) => ({ source: 'Discretionary', target: formatCategoryLabel(c), value: v })),
  ];
  return { nodes, links };
}

export default function BudgetCharts({ monthLabel, monthTransactions, categoryTotals, fixedBillMerchants, trendMonths, trendTotals }) {
  const sankeyData = buildSankeyData(monthTransactions, fixedBillMerchants);
  // Same reasoning as buildSankeyData above -- a pie slice can't be negative,
  // so a category that nets to zero or negative for the month (e.g. only a
  // return posted) is left out of the pie rather than shown as $0/negative.
  const pieData = Object.entries(categoryTotals)
    .filter(([, amount]) => amount > 0)
    .map(([category, amount]) => ({
      id: formatCategoryLabel(category),
      label: formatCategoryLabel(category),
      value: amount,
      color: colorForCategory(category),
    }));
  const lineData = [{
    id: 'Total spend',
    data: trendMonths.map((label, i) => ({ x: label, y: trendTotals[i] })),
  }];
  const theme = getNivoTheme();
  const accentColor = cssVar('--accent-primary', '#6C7FE8');

  return (
    <div>
      <div className="task-section-head">{monthLabel} money flow</div>
      {sankeyData.links.length ? (
        <div style={{ height: '340px' }}>
          <ResponsiveSankey
            data={sankeyData}
            theme={theme}
            margin={{ top: 20, right: 160, bottom: 20, left: 100 }}
            align="justify"
            colors={{ scheme: 'category10' }}
            nodeOpacity={1}
            nodeThickness={14}
            nodeSpacing={14}
            nodeBorderWidth={0}
            linkOpacity={0.4}
            enableLinkGradient
            labelPosition="outside"
            labelOrientation="horizontal"
            labelPadding={10}
          />
        </div>
      ) : (
        <div style={{ color: 'var(--text-muted)', padding: '1em' }}>No categorized spend yet this month.</div>
      )}

      <div className="task-section-head" style={{ marginTop: '1em' }}>{monthLabel} by category</div>
      {pieData.length ? (
        <div style={{ height: '320px' }}>
          <ResponsivePie
            data={pieData}
            theme={theme}
            colors={{ datum: 'data.color' }}
            margin={{ top: 20, right: 100, bottom: 20, left: 100 }}
            innerRadius={0.5}
            padAngle={1}
            cornerRadius={2}
            activeOuterRadiusOffset={6}
            arcLinkLabelsSkipAngle={8}
            arcLinkLabelsTextColor={cssVar('--text-secondary', '#999')}
            arcLabelsSkipAngle={10}
            valueFormat={(v) => formatCurrency(v)}
          />
        </div>
      ) : (
        <div style={{ color: 'var(--text-muted)', padding: '1em' }}>No categorized spend yet this month.</div>
      )}

      <div className="task-section-head" style={{ marginTop: '1em' }}>Total spend trend</div>
      <div style={{ height: '220px' }}>
        <ResponsiveLine
          data={lineData}
          theme={theme}
          margin={{ top: 20, right: 20, bottom: 40, left: 60 }}
          colors={[accentColor]}
          axisBottom={{ tickSize: 0, tickPadding: 8 }}
          axisLeft={{ tickSize: 0, tickPadding: 8, format: (v) => `$${v}` }}
          enableGridX={false}
          pointSize={6}
          pointColor={{ theme: 'background' }}
          pointBorderWidth={2}
          pointBorderColor={{ from: 'serieColor' }}
          useMesh
          animate={false}
        />
      </div>
    </div>
  );
}
