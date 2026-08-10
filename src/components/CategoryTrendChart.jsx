import { ResponsiveBar } from '@nivo/bar';
import { getNivoTheme, colorForCategory, cssVar } from '../lib/chartTheme';

// One small multiple per category rather than overlapping lines on a
// shared axis — with up to 14 real categories, overlapping lines get
// unreadable past 2-3 selections. target draws a dashed reference line so
// "over/under budget" reads as a shape, not just a number.
export default function CategoryTrendChart({ category, data, target }) {
  return (
    <div style={{ height: '150px' }}>
      <ResponsiveBar
        data={data}
        keys={['amount']}
        indexBy="month"
        theme={getNivoTheme()}
        colors={colorForCategory(category)}
        margin={{ top: 10, right: 10, bottom: 24, left: 44 }}
        padding={0.3}
        markers={target > 0 ? [{
          axis: 'y',
          value: target,
          lineStyle: { stroke: cssVar('--ev-coral-tx', '#FF6B5A'), strokeWidth: 1, strokeDasharray: '4 4' },
        }] : []}
        axisBottom={{ tickSize: 0, tickPadding: 6 }}
        axisLeft={{ tickSize: 0, tickPadding: 6, format: (v) => `$${v}` }}
        enableLabel={false}
        enableGridY={false}
        animate={false}
        isInteractive
      />
    </div>
  );
}
