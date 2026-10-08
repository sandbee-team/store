import { lazy, Suspense, useState } from "react";
import { ChartArea, ChartColumn } from "lucide-react";
const Chart = lazy(() => import("./charts/ActivityChart"));
export default function UsageChart({ series, service }) {
  const [view, setView] = useState("area");
  return (
    <figure className="usage-chart">
      <div className="chart-toolbar">
        <span>
          Daily volume <span className="muted">/ UTC</span>
        </span>
        <div className="segmented" role="group" aria-label="Chart style">
          <button
            aria-label="Area chart"
            aria-pressed={view === "area"}
            onClick={() => setView("area")}
          >
            <ChartArea size={14} />
            Area
          </button>
          <button
            aria-label="Bar chart"
            aria-pressed={view === "bar"}
            onClick={() => setView("bar")}
          >
            <ChartColumn size={14} />
            Bars
          </button>
        </div>
      </div>
      <Suspense
        fallback={
          <div className="chart-loading" role="status">
            Loading chart
          </div>
        }
      >
        <Chart series={series} service={service} view={view} />
      </Suspense>
      <figcaption>
        {service !== "ocr" && (
          <span>
            <i className="legend-gst" />
            GSTIN
          </span>
        )}
        {service !== "gst" && (
          <span>
            <i className="legend-demo" />
            OCR demo
          </span>
        )}
        <small>Successful requests</small>
      </figcaption>
    </figure>
  );
}
