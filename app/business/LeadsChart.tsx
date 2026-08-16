"use client";

import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
} from "chart.js";
import { useLocale } from "@/components/LocaleProvider";
import { formatDate } from "@/lib/i18n/format";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);

export interface LeadsByDay {
  day: string;
  leads: number;
}

export default function LeadsChart({ data }: { data: LeadsByDay[] }) {
  const { t, locale } = useLocale();
  const total = data.reduce((sum, d) => sum + d.leads, 0);

  return (
    <div className="card p-4">
      <div className="flex items-baseline justify-between mb-2">
        <p className="text-sm font-medium">{t("business.leadsChartTitle")}</p>
        <p className="text-xs text-muted">{t("business.leadsChartTotal", { count: total })}</p>
      </div>
      <div className="h-32">
        <Line
          data={{
            labels: data.map((d) => formatDate(d.day, locale)),
            datasets: [
              {
                data: data.map((d) => d.leads),
                borderColor: "#ff4458",
                backgroundColor: "rgba(255, 68, 88, 0.1)",
                fill: true,
                tension: 0.35,
                pointRadius: 0,
                borderWidth: 2,
              },
            ],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { intersect: false, mode: "index" } },
            scales: {
              x: { display: false },
              y: { display: false, beginAtZero: true },
            },
          }}
        />
      </div>
    </div>
  );
}
