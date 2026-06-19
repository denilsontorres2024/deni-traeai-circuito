"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatDate } from "@/lib/utils";

export function HistoryChart({
  data,
}: {
  data: Array<{ analyzed_at: string; score: number }>;
}) {
  return (
    <div className="h-[280px] min-w-0 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
          <XAxis
            dataKey="analyzed_at"
            stroke="#94a3b8"
            tickFormatter={(value) => formatDate(value, "dd/MM")}
          />
          <YAxis domain={[0, 100]} stroke="#94a3b8" />
          <Tooltip
            contentStyle={{
              borderRadius: 20,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "#0a1020",
              color: "#fff",
            }}
            formatter={(value) => [`${value}`, "Score"]}
            labelFormatter={(label) => formatDate(label)}
          />
          <Line
            dataKey="score"
            dot={{ fill: "#4ade80", strokeWidth: 0 }}
            stroke="#4ade80"
            strokeWidth={3}
            type="monotone"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
