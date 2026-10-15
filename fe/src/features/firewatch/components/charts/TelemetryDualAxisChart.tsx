import React from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { TelemetryHistoryPoint } from '../../services/contracts';

interface TelemetryDualAxisChartProps {
  data: TelemetryHistoryPoint[];
  className?: string;
  mq2SmokeOnThresholdAdc?: number;
}

const formatValue = (value: number | null | undefined, suffix: string, digits = 1) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'Chưa có dữ liệu';
  return `${Number(value).toFixed(digits)}${suffix}`;
};

const latestNonEmpty = (data: TelemetryHistoryPoint[]) => {
  return [...data].reverse().find((item) =>
    item.temp !== null ||
    item.humidity !== null ||
    item.flameAdc !== null ||
    item.mq2Adc !== null
  );
};

export const TelemetryDualAxisChart: React.FC<TelemetryDualAxisChartProps> = ({
  data,
  className = '',
  mq2SmokeOnThresholdAdc = 1200,
}) => {
  const latest = latestNonEmpty(data);

  return (
    <div className={`bg-white rounded-lg border border-slate-200 p-4 shadow-sm flex flex-col gap-4 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Lịch sử cảm biến</h3>
        </div>
        <div className="rounded border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-mono text-slate-600">
          Asia/Bangkok · {data.length} bản ghi
        </div>
      </div>

      {data.length === 0 ? (
        <div className="rounded border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500 min-h-[150px] flex items-center justify-center">
          Chưa có dữ liệu telemetry trong khoang thoi gian nay.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-lg border border-red-100 bg-red-50 p-3">
              <div className="text-[11px] font-bold uppercase tracking-wide text-red-700">Nhiệt độ DHT22</div>
              <div className="mt-1 text-xl font-black font-mono text-red-700">{formatValue(latest?.temp, '°C')}</div>
            </div>
            <div className="rounded-lg border border-sky-100 bg-sky-50 p-3">
              <div className="text-[11px] font-bold uppercase tracking-wide text-sky-700">Độ ẩm DHT22</div>
              <div className="mt-1 text-xl font-black font-mono text-sky-700">{formatValue(latest?.humidity, '%')}</div>
            </div>
            <div className="rounded-lg border border-amber-100 bg-amber-50 p-3">
              <div className="text-[11px] font-bold uppercase tracking-wide text-amber-800">Flame ADC GPIO6</div>
              <div className="mt-1 text-xl font-black font-mono text-amber-800">{formatValue(latest?.flameAdc, ' ADC', 0)}</div>
            </div>
            <div className="rounded-lg border border-orange-100 bg-orange-50 p-3">
              <div className="text-[11px] font-bold uppercase tracking-wide text-orange-800">MQ-2 ADC GPIO5</div>
              <div className="mt-1 text-xl font-black font-mono text-orange-800">{formatValue(latest?.mq2Adc, ' ADC', 0)}</div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3 mb-2 px-1">
              <div className="text-xs font-bold text-slate-800">DHT22 GPIO3</div>
              <div className="flex items-center gap-4 text-xs font-semibold">
                <span className="flex items-center gap-1.5 text-red-600">
                  <span className="w-3 h-0.5 bg-red-600 inline-block" /> Nhiệt độ
                </span>
                <span className="flex items-center gap-1.5 text-sky-600">
                  <span className="w-3 h-0.5 bg-sky-600 inline-block" /> Độ ẩm
                </span>
              </div>
            </div>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 10, right: 28, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="time" stroke="#94a3b8" tick={{ fontSize: 10 }} minTickGap={28} />
                  <YAxis yAxisId="temp" domain={[15, 55]} stroke="#dc2626" tick={{ fontSize: 10 }} unit="°C" />
                  <YAxis yAxisId="hum" orientation="right" domain={[20, 100]} stroke="#0284c7" tick={{ fontSize: 10 }} unit="%" />
                  <Tooltip />
                  <Line yAxisId="temp" type="monotone" dataKey="temp" name="Nhiệt độ" stroke="#dc2626" strokeWidth={2.5} dot={false} connectNulls={false} />
                  <Line yAxisId="hum" type="monotone" dataKey="humidity" name="Độ ẩm" stroke="#0284c7" strokeWidth={2} dot={false} connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between gap-3 mb-2 px-1">
              <div className="text-xs font-bold text-slate-800">Flame ADC thô</div>
              <div className="flex items-center gap-4 text-xs font-semibold">
                <span className="flex items-center gap-1.5 text-red-600">
                  <span className="w-3 h-0.5 bg-red-600 inline-block" /> Flame ADC
                </span>
              </div>
            </div>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 10, right: 28, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="time" stroke="#94a3b8" tick={{ fontSize: 10 }} minTickGap={28} />
                  <YAxis domain={[0, 4095]} stroke="#475569" tick={{ fontSize: 10 }} unit=" ADC" />
                  <Tooltip />
                  <ReferenceLine
                    y={2500}
                    stroke="#dc2626"
                    strokeDasharray="4 4"
                    label={{
                      value: 'Ngưỡng firmware Flame ADC < 2500',
                      fill: '#dc2626',
                      fontSize: 10,
                      position: 'insideTopLeft',
                    }}
                  />
                  <Line type="monotone" dataKey="flameAdc" name="Flame ADC" stroke="#dc2626" strokeWidth={2.5} dot={false} connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between gap-3 mb-2 px-1">
              <div className="text-xs font-bold text-slate-800">MQ-2 ADC thô</div>
              <div className="flex items-center gap-4 text-xs font-semibold">
                <span className="flex items-center gap-1.5 text-orange-600">
                  <span className="w-3 h-0.5 bg-orange-600 inline-block" /> MQ-2 ADC
                </span>
              </div>
            </div>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 10, right: 28, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="time" stroke="#94a3b8" tick={{ fontSize: 10 }} minTickGap={28} />
                  <YAxis domain={[0, 4095]} stroke="#475569" tick={{ fontSize: 10 }} unit=" ADC" />
                  <Tooltip />
                  <ReferenceLine
                    y={mq2SmokeOnThresholdAdc}
                    stroke="#f97316"
                    strokeDasharray="4 4"
                    label={{
                      value: `Ngưỡng bật quạt MQ-2 >= ${mq2SmokeOnThresholdAdc} ADC`,
                      fill: '#ea580c',
                      fontSize: 10,
                      position: 'insideTopLeft',
                    }}
                  />
                  <Line type="monotone" dataKey="mq2Adc" name="MQ-2 ADC" stroke="#f97316" strokeWidth={2.5} dot={false} connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
