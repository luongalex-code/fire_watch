import React from 'react';
import { Droplets, Flame, Power, Siren, Thermometer, Wind, Zap } from 'lucide-react';
import { SensorReading } from '../../types';

interface SensorCardsProps {
  reading: SensorReading | null;
  isStale?: boolean;
}

const valueOrEmpty = (value: number | null | undefined, suffix = '') => {
  if (value === null || value === undefined) return 'Chưa có dữ liệu';
  return `${value.toLocaleString()}${suffix}`;
};

const outputLabel = (value: boolean | null | undefined) => {
  if (value === null || value === undefined) return 'Chưa có dữ liệu';
  return value ? 'ON' : 'OFF';
};

export const SensorCards: React.FC<SensorCardsProps> = ({ reading, isStale = false }) => {
  const stale = isStale || Boolean(reading?.isStale);
  const hasReading = Boolean(reading) && !stale;
  const isFlameAlarm = hasReading && Boolean(reading?.flameFireDetected);
  const isMq2Alarm = hasReading && Boolean(reading?.mq2SmokeDetected);

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm flex flex-col gap-3">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <div className="flex items-center gap-2">
          <Thermometer className="w-4 h-4 text-slate-700" />
          <h3 className="text-sm font-bold text-slate-900">Cảm biến ESP32-S3</h3>
        </div>
        <span
          className={`text-[11px] font-mono px-2 py-0.5 rounded ${
            stale ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
          }`}
        >
          {stale ? 'Dữ liệu cũ hoặc mất kết nối' : 'Dữ liệu mới'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
          <div className="flex items-center gap-1 text-xs text-slate-500 mb-1">
            <Thermometer className="w-3.5 h-3.5 text-red-500" /> Nhiệt độ DHT22 GPIO3
          </div>
          <div className="font-mono text-xl font-bold text-slate-900">
            {hasReading && reading?.temperatureC !== null && reading?.temperatureC !== undefined
              ? `${reading.temperatureC.toFixed(1)} °C`
              : 'Chưa có dữ liệu'}
          </div>
        </div>

        <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
          <div className="flex items-center gap-1 text-xs text-slate-500 mb-1">
            <Droplets className="w-3.5 h-3.5 text-blue-500" /> Độ ẩm DHT22 GPIO3
          </div>
          <div className="font-mono text-xl font-bold text-slate-900">
            {hasReading && reading?.humidityPercent !== null && reading?.humidityPercent !== undefined
              ? `${reading.humidityPercent.toFixed(1)} %`
              : 'Chưa có dữ liệu'}
          </div>
        </div>
      </div>

      <div
        className={`p-3 rounded-lg border ${
          isFlameAlarm ? 'bg-red-50 border-red-300' : 'bg-slate-50 border-slate-200'
        }`}
      >
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="flex items-center gap-1.5 font-bold text-red-700">
            <Flame className="w-4 h-4 text-red-600" />
            Flame GPIO6 ADC thô
          </span>
          <span className="font-mono font-bold text-slate-900 text-sm">
            {hasReading ? valueOrEmpty(reading?.flameAdc, ' ADC') : 'Chưa có dữ liệu'}
          </span>
        </div>
        <div className="text-[11px] text-slate-600">
          {hasReading
            ? isFlameAlarm
              ? 'Firmware ESP32 đang báo trạng thái có lửa.'
              : 'Firmware ESP32 chưa báo trạng thái có lửa.'
            : 'Không kết luận trạng thái khi thiếu dữ liệu mới.'}
        </div>
      </div>

      <div
        className={`p-3 rounded-lg border ${
          isMq2Alarm ? 'bg-orange-50 border-orange-300' : 'bg-slate-50 border-slate-200'
        }`}
      >
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="flex items-center gap-1.5 font-bold text-orange-700">
            <Wind className="w-4 h-4 text-orange-600" />
            MQ-2 GPIO5 ADC thô
          </span>
          <span className="font-mono font-bold text-slate-900 text-sm">
            {hasReading ? valueOrEmpty(reading?.mq2Adc, ' ADC') : 'Chưa có dữ liệu'}
          </span>
        </div>
        <div className="text-[11px] text-slate-600">
          {hasReading
            ? isMq2Alarm
              ? 'Firmware ESP32 đang báo có khói/khí ga, quạt được bật theo relay quạt.'
              : 'Firmware ESP32 chưa báo khói/khí ga từ MQ-2.'
            : 'Không kết luận trạng thái MQ-2 khi thiếu dữ liệu mới.'}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div className="rounded border border-slate-200 bg-slate-50 p-2">
          <div className="flex items-center gap-1 text-slate-500">
            <Power className="w-3.5 h-3.5" /> Relay bơm
          </div>
          <div className="mt-1 font-mono font-bold text-slate-900">
            {hasReading ? outputLabel(reading?.pumpRelayState) : 'Chưa có dữ liệu'}
          </div>
        </div>
        <div className="rounded border border-slate-200 bg-slate-50 p-2">
          <div className="flex items-center gap-1 text-slate-500">
            <Wind className="w-3.5 h-3.5" /> Quạt
          </div>
          <div className="mt-1 font-mono font-bold text-slate-900">
            {hasReading ? outputLabel(reading?.fanState) : 'Chưa có dữ liệu'}
          </div>
        </div>
        <div className="rounded border border-slate-200 bg-slate-50 p-2">
          <div className="flex items-center gap-1 text-slate-500">
            <Siren className="w-3.5 h-3.5" /> Còi
          </div>
          <div className="mt-1 font-mono font-bold text-slate-900">
            {hasReading ? outputLabel(reading?.buzzerState) : 'Chưa có dữ liệu'}
          </div>
        </div>
        <div className="rounded border border-slate-200 bg-slate-50 p-2">
          <div className="flex items-center gap-1 text-slate-500">
            <Zap className="w-3.5 h-3.5" /> LED
          </div>
          <div className="mt-1 font-mono font-bold text-slate-900">
            {hasReading ? outputLabel(reading?.ledState) : 'Chưa có dữ liệu'}
          </div>
        </div>
      </div>

      <div className="rounded bg-amber-50 border border-amber-200 p-2 text-[11px] text-amber-800">
        Relay ON chỉ là trạng thái điều khiển do ESP32 báo lại, không chứng minh bơm hoặc quạt có tải thực tế.
      </div>
    </div>
  );
};
