import {
  ResponsiveContainer,
  AreaChart,
  BarChart,
  Area,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { number } from "../../lib/format";
const dateLabel = (date) =>
  new Date(date + "T00:00:00Z").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
function ActivityTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <strong>{dateLabel(label)} / UTC</strong>
      {payload.map((item) => (
        <div key={item.dataKey}>
          <span>
            <i style={{ backgroundColor: item.color }} />
            {item.name}
          </span>
          <b>{number(item.value)}</b>
        </div>
      ))}
    </div>
  );
}
export default function ActivityChart({ series, service, view }) {
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  const Chart = view === "bar" ? BarChart : AreaChart;
  const Data = view === "bar" ? Bar : Area;
  const metrics = [
    {
      key: "gst",
      label: "GSTIN",
      color: "#2459c4",
      visible: service !== "ocr",
    },
    {
      key: "demo",
      label: "OCR demo",
      color: "#138078",
      visible: service !== "gst",
    },
  ];
  return (
    <div
      className="activity-plot"
      aria-label="Interactive daily request chart. Use arrow keys for dates; exact values are in reports."
    >
      <ResponsiveContainer
        width="100%"
        height="100%"
        minWidth={0}
        debounce={60}
      >
        <Chart
          data={series}
          accessibilityLayer
          margin={{ top: 12, right: 8, bottom: 4, left: -12 }}
        >
          <CartesianGrid
            vertical={false}
            stroke="#dfe3e8"
            strokeDasharray="3 5"
          />
          <XAxis
            dataKey="date"
            tickFormatter={dateLabel}
            minTickGap={40}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#596270", fontSize: 11 }}
            tickMargin={12}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#596270", fontSize: 11 }}
            domain={[0, (max) => Math.max(2, max)]}
          />
          <Tooltip
            content={<ActivityTooltip />}
            cursor={
              view === "bar"
                ? { fill: "#eef0f3" }
                : { stroke: "#aeb6c2", strokeDasharray: "4 4" }
            }
          />
          {metrics
            .filter((item) => item.visible)
            .map((item) => (
              <Data
                key={item.key}
                type="linear"
                dataKey={item.key}
                name={item.label}
                stackId="requests"
                stroke={item.color}
                fill={item.color}
                fillOpacity={view === "bar" ? 1 : 0.12}
                strokeWidth={2}
                maxBarSize={28}
                radius={view === "bar" ? [3, 3, 0, 0] : undefined}
                isAnimationActive={!reduced}
                animationDuration={450}
              />
            ))}
        </Chart>
      </ResponsiveContainer>
    </div>
  );
}
