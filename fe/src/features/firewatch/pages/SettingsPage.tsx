import React, { useState, useEffect } from 'react';
import { useFireWatch } from '../hooks/useFireWatch';
import { SystemSettings } from '../types';
import { fireWatchService } from '../services';
import {
  SlidersHorizontal,
  Save,
  RotateCcw,
  Cpu,
  Layers,
  ShieldAlert,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Lock,
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { showToast } = useFireWatch();
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [activeTab, setActiveTab] = useState<'ai' | 'sensors' | 'actuators' | 'interlock' | 'tts'>('ai');

  useEffect(() => {
    fireWatchService.getSettings().then(setSettings).catch((error: Error) => {
      showToast({
        type: 'error',
        title: 'Không tải được cau hinh',
        message: error.message,
      });
    });
  }, [showToast]);

  const updateSettings = (nextSettings: SystemSettings) => {
    setSettings(nextSettings);
    setIsDirty(true);
  };

  const updateDhtSamplingPeriod = (value: string) => {
    if (!settings) return;
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return;

    updateSettings({
      ...settings,
      dhtSamplingPeriodMs: Math.min(60000, Math.max(2000, parsed)),
    });
  };

  if (!settings) {
    return <div className="p-8 text-center text-slate-500">Dang tai cau hinh...</div>;
  }

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const saved = await fireWatchService.saveSettings(settings);
      setSettings(saved);
      setIsDirty(false);
      showToast({
        type: 'success',
        title: 'Da luu cau hinh',
        message: saved.deviceConfigQueued
          ? 'Da luu tren backend va dua chu ky doc DHT22 vao MQTT retained de ESP32 nhan khi ket noi.'
          : 'Da luu tren backend. ESP32 se nhan cau hinh khi ket noi MQTT.',
      });
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Không lưu được cau hinh',
        message: error instanceof Error ? error.message : 'Loi khong xac dinh',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefaults = () => {
    updateSettings({
      ...settings,
      aiModelName: 'YOLO Fire/Smoke custom model',
      aiConfidenceFireThreshold: 0.55,
      aiConfidenceSmokeThreshold: 0.5,
      aiConsecutiveFrames: 5,
      aiCooldownSeconds: 5,
      flameTriggerThresholdAdc: 1850,
      flameClearThresholdAdc: 2500,
      dhtSamplingPeriodMs: 2000,
      pumpStartDelayMs: 300,
      pumpStopDelayMs: 3000,
      pumpCycleOnMs: 300,
      pumpCycleOffMs: 3000,
      pumpMaxDurationSec: 30,
      hardwareInterlockMode: 'manual_override',
      ttsInitialMessage: 'Chú ý, chú ý. Cảnh báo cháy tại {areaName}.',
      ttsInitialRepeatCount: 2,
      ttsRepeatDelayMs: 2000,
      ttsFireRepeatMessage: 'Cảnh báo cháy tại {areaName}.',
      ttsPersonDetectedMessage: 'Phát hiện {personCount} người tại {areaName}.',
      ttsPersonRepeatMessage: 'Phát hiện {personCount} người tại {areaName}.',
      ttsInitialEnabled: true,
      ttsFireRepeatEnabled: true,
      ttsPersonDetectedEnabled: true,
      ttsPersonRepeatEnabled: true,
    });
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center text-white">
            <SlidersHorizontal className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] font-bold text-slate-700">v2.4.1-prod</span>
              <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[10px] font-mono font-bold">
                • Cấu hình duoc luu tren backend
              </span>
            </div>
            <h2 className="text-base font-bold text-slate-900">
              CAU HINH THONG SO VAN HANH &amp; LIEN DONG HE THONG
            </h2>
            <p className="text-xs text-slate-500 font-mono">
              Cấu hình duoc luu trong backend; AI doc nguong runtime, DHT22 GPIO3 nhan chu ky doc qua MQTT. Cac tham so phan cung khac van theo cau hinh firmware.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-xs transition"
          >
            Nap mac dinh (Reset)
          </button>
          <button
            type="button"
            onClick={handleSaveSettings}
            disabled={isSaving || !isDirty}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Dang luu...' : 'Luu cau hinh'}</span>
          </button>
        </div>
      </div>

      {/* Tabs Selector */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 bg-white px-3 pt-2 rounded-t-lg text-xs font-semibold text-slate-600">
        <button
          onClick={() => setActiveTab('ai')}
          className={`px-4 py-2.5 border-b-2 transition ${
            activeTab === 'ai'
              ? 'border-slate-900 text-slate-900 font-bold'
              : 'border-transparent hover:text-slate-900'
          }`}
        >
          1. Thi giac may tinh &amp; AI (Camera AI)
        </button>
        <button
          onClick={() => setActiveTab('sensors')}
          className={`px-4 py-2.5 border-b-2 transition ${
            activeTab === 'sensors'
              ? 'border-slate-900 text-slate-900 font-bold'
              : 'border-transparent hover:text-slate-900'
          }`}
        >
          2. Hiệu chuẩn cảm biến (ESP32-S3 ADC)
        </button>
        <button
          onClick={() => setActiveTab('actuators')}
          className={`px-4 py-2.5 border-b-2 transition ${
            activeTab === 'actuators'
              ? 'border-slate-900 text-slate-900 font-bold'
              : 'border-transparent hover:text-slate-900'
          }`}
        >
          3. Ánh xạ GPIO &amp; Ro-le Chap hanh
        </button>
        <button
          onClick={() => setActiveTab('interlock')}
          className={`px-4 py-2.5 border-b-2 transition ${
            activeTab === 'interlock'
              ? 'border-slate-900 text-slate-900 font-bold'
              : 'border-transparent hover:text-slate-900'
          }`}
        >
          4. Luong xác nhận & điều khiển
        </button>
        <button
          onClick={() => setActiveTab('tts')}
          className={`px-4 py-2.5 border-b-2 transition ${
            activeTab === 'tts'
              ? 'border-slate-900 text-slate-900 font-bold'
              : 'border-transparent hover:text-slate-900'
          }`}
        >
          5. Kịch bản thông báo
        </button>
      </div>

      {/* Tab 1: AI Vision Config */}
      {activeTab === 'ai' && (
        <div className="bg-white p-5 rounded-b-lg border border-slate-200 shadow-sm space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Model A */}
            <div className="p-3.5 rounded-lg border-2 border-slate-900 bg-slate-50/50">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-900">
                  YOLO Fire/Smoke custom model
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono text-[10px] font-bold">
                  DANG DUNG
                </span>
              </div>
              <p className="text-xs text-slate-600 mb-2 leading-relaxed">
                Mo hinh YOLO nhận diện lửa/khói chay trong camera service. Ten file .pt la trong so noi bo, giao dien chi hien thi loai mo hinh khi chua co metadata phien ban thật.
              </p>
              <div className="font-mono text-[11px] text-slate-500">
                Camera service - realtime stream - backend event
              </div>
            </div></div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-black text-slate-900">Cấu hình ngưỡng suy luận</h3>
                <p className="text-xs text-slate-500 font-mono">
                  Runtime Params - luu truc tiep tren backend/PostgreSQL qua API /api/settings.
                </p>
              </div>
              <span className="px-2 py-1 rounded bg-emerald-100 text-emerald-800 text-[10px] font-mono font-bold">
                LIVE CONFIG
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Ngưỡng tin cay Lua (Fire Conf)
              </label>
              <input
                type="number"
                step="0.05"
                min="0.3"
                max="0.95"
                value={settings.aiConfidenceFireThreshold}
                onChange={(e) =>
                  updateSettings({ ...settings, aiConfidenceFireThreshold: parseFloat(e.target.value) })
                }
                className="w-full text-xs font-mono p-2 rounded border border-slate-300"
              />
              <div className="text-[10px] text-slate-400 mt-1">Khuyen dung: 0.70 - 0.85 de giam bao nham.</div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Ngưỡng tin cay Khoi (Smoke Conf)
              </label>
              <input
                type="number"
                step="0.05"
                min="0.3"
                max="0.95"
                value={settings.aiConfidenceSmokeThreshold}
                onChange={(e) =>
                  updateSettings({ ...settings, aiConfidenceSmokeThreshold: parseFloat(e.target.value) })
                }
                className="w-full text-xs font-mono p-2 rounded border border-slate-300"
              />
              <div className="text-[10px] text-slate-400 mt-1">Khuyen dung: 0.55 - 0.75 de tranh nham bui/hoi nuoc.</div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Frames xác nhận lien tiep
              </label>
              <input
                type="number"
                min="2"
                max="15"
                value={settings.aiConsecutiveFrames}
                onChange={(e) =>
                  updateSettings({ ...settings, aiConsecutiveFrames: parseInt(e.target.value, 10) })
                }
                className="w-full text-xs font-mono p-2 rounded border border-slate-300"
              />
              <div className="text-[10px] text-slate-400 mt-1">So frame lien tiep can dat truoc khi AI gửi sự kiện.</div>
            </div>
          </div>
          </div>
        </div>
      )}

      {/* Tab 2: Sensors Calibration */}
      {activeTab === 'sensors' && (
        <div className="bg-white p-5 rounded-b-lg border border-slate-200 shadow-sm space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 space-y-2">
              <div className="text-xs font-bold text-slate-900">Cảm biến Lửa Flame (GPIO6)</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="block text-slate-600 mb-1">Ngưỡng phát hiện lửa (ADC):</label>
                  <input
                    type="number"
                    value={settings.flameTriggerThresholdAdc}
                    onChange={(e) =>
                      updateSettings({ ...settings, flameTriggerThresholdAdc: parseInt(e.target.value, 10) })
                    }
                    className="w-full text-xs font-mono p-1.5 rounded border border-slate-300 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1">Ngưỡng xác nhận hết lửa (ADC):</label>
                  <input
                    type="number"
                    value={settings.flameClearThresholdAdc}
                    onChange={(e) =>
                      updateSettings({ ...settings, flameClearThresholdAdc: parseInt(e.target.value, 10) })
                    }
                    className="w-full text-xs font-mono p-1.5 rounded border border-slate-300 bg-white"
                  />
                </div>
              </div>
              <div className="text-[10px] text-slate-500">
                Tín hiệu nghịch đảo: ADC &lt;= Ngưỡng phát hiện thì báo cháy. ADC &gt;= Ngưỡng hết lửa thì hết cháy.
              </div>
            </div>

            <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 space-y-2">
              <div className="text-xs font-bold text-slate-900">Nhiệt ẩm DHT22 (GPIO3)</div>
              <div className="text-xs text-slate-600">Chu ky doc 1-Wire (ms):</div>
              <input
                type="number"
                value={settings.dhtSamplingPeriodMs}
                min={2000}
                max={60000}
                onChange={(e) => updateDhtSamplingPeriod(e.target.value)}
                className="w-full text-xs font-mono p-2 rounded border border-slate-300 bg-white"
              />
              <div className="text-[10px] text-slate-500">
                Pham vi ho tro: 2,000–60,000ms; gia tri duoc luu tren backend va gửi qua MQTT toi ESP32.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Actuators GPIO Mapping */}
      {activeTab === 'actuators' && (
        <div className="bg-white p-5 rounded-b-lg border border-slate-200 shadow-sm space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 space-y-2">
              <div className="text-xs font-bold text-slate-900">Co che Bao ve Phần cứng Bơm Cuu Hoa</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="block text-slate-600 mb-1">Thời gian Bat (ON ms):</label>
                  <input
                    type="number"
                    value={settings.pumpCycleOnMs}
                    onChange={(e) =>
                      updateSettings({ ...settings, pumpCycleOnMs: parseInt(e.target.value, 10) })
                    }
                    className="w-full text-xs font-mono p-1.5 rounded border border-slate-300 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1">Thời gian Tat (OFF ms):</label>
                  <input
                    type="number"
                    value={settings.pumpCycleOffMs}
                    onChange={(e) =>
                      updateSettings({ ...settings, pumpCycleOffMs: parseInt(e.target.value, 10) })
                    }
                    className="w-full text-xs font-mono p-1.5 rounded border border-slate-300 bg-white"
                  />
                </div>
              </div>
              <div className="text-[10px] text-slate-500">
                Chu ky mac dinh: 0.3 giay Bat / 3 giay Tat de chong chay cuon dong co va ngua sut ap.
              </div>
            </div>

            <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 space-y-2">
              <div className="text-xs font-bold text-slate-900">Gioi han thoi gian bom toi da (Max Timeout)</div>
              <input
                type="number"
                value={settings.pumpMaxDurationSec}
                onChange={(e) =>
                  updateSettings({ ...settings, pumpMaxDurationSec: parseInt(e.target.value, 10) })
                }
                className="w-full text-xs font-mono p-2 rounded border border-slate-300 bg-white"
              />
              <div className="text-[10px] text-slate-500">
                Tu dong ngat sau 180s neu không có lenh gia han thu cong tu dieu hanh vien.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Real confirmation flow */}
      {activeTab === 'interlock' && (
        <div className="bg-white p-5 rounded-b-lg border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Luong xác nhận chay va điều khiển
            </h3>
            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-mono font-bold">
              Backend + MQTT + ESP32
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-lg border border-red-200 bg-red-50/60 space-y-1">
              <div className="font-bold text-red-900">Điều kiện xác nhận chay</div>
              <div className="text-[11px] font-mono text-red-800">
                Cảm biến ESP32 bao FIRE cùng khu vực va camera AI bao lửa/khói trong khoang hop le.
              </div>
              <div className="text-[11px] text-slate-700">
                Khi đủ điều kiện kép, backend tao/cap nhat cảnh báo active va gửi MQTT command <strong>pump:on</strong> xuong ESP32.
              </div>
            </div>

            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-1">
              <div className="font-bold text-slate-900">Lệnh điều khiển</div>
              <div className="text-[11px] text-slate-700">
                Lenh bom/coi di qua backend va MQTT. Chi xem la da nhan khi ESP32 gửi ACK về backend.
              </div>
              
              <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Delay bật bơm (ms):</label>
                  <input
                    type="number"
                    value={settings.pumpStartDelayMs}
                    onChange={(e) =>
                      updateSettings({ ...settings, pumpStartDelayMs: parseInt(e.target.value, 10) })
                    }
                    className="w-full text-xs font-mono p-1.5 rounded border border-slate-300 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Delay tắt bơm (ms):</label>
                  <input
                    type="number"
                    value={settings.pumpStopDelayMs}
                    onChange={(e) =>
                      updateSettings({ ...settings, pumpStopDelayMs: parseInt(e.target.value, 10) })
                    }
                    className="w-full text-xs font-mono p-1.5 rounded border border-slate-300 bg-white"
                  />
                </div>
              </div>
            </div>

            <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/60 space-y-1">
              <div className="font-bold text-amber-900">Dữ liệu chưa đủ điều kiện</div>
              <div className="text-[11px] text-slate-700">
                AI phát hiện đơn lẻ hoặc cảm biến phát hiện đơn lẻ chỉ tạo trạng thái cần theo dõi; không hiển thị như đã đủ điều kiện bật bơm.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Checksum and Save Footer */}
      <div className="bg-slate-900 text-slate-300 p-3 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
        <div className="flex items-center gap-2">
          <Lock className="w-3.5 h-3.5 text-emerald-400" />
          <span>Checksum cau hinh SHA-256: <strong>{settings.checksumSha256}</strong></span>
        </div>
        <div>
          Trạng thái: {isDirty
            ? <span className="text-amber-400 font-bold">Co thay doi chua luu</span>
            : <span className="text-emerald-400 font-bold">Da luu tren backend</span>}
        </div>
      </div>
      {/* Tab 5: TTS Settings */}
      {activeTab === 'tts' && (
        <div className="bg-white p-5 rounded-b-lg border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col space-y-4">
            <div className="text-xs text-slate-500 mb-2">
              <strong>Placeholder hỗ trợ:</strong> {'{areaName}'}, {'{personCount}'}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Initial Fire */}
              <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-900">Cảnh báo cháy ban đầu</div>
                  <input
                    type="checkbox"
                    checked={settings.ttsInitialEnabled}
                    onChange={(e) => updateSettings({ ...settings, ttsInitialEnabled: e.target.checked })}
                  />
                </div>
                <input
                  type="text"
                  value={settings.ttsInitialMessage}
                  disabled={!settings.ttsInitialEnabled}
                  onChange={(e) => updateSettings({ ...settings, ttsInitialMessage: e.target.value })}
                  className="w-full text-xs font-mono p-2 rounded border border-slate-300 bg-white"
                />
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">Số lần lặp:</label>
                    <input
                      type="number"
                      min="1" max="10"
                      value={settings.ttsInitialRepeatCount}
                      disabled={!settings.ttsInitialEnabled}
                      onChange={(e) => updateSettings({ ...settings, ttsInitialRepeatCount: parseInt(e.target.value, 10) })}
                      className="w-full text-xs font-mono p-1.5 rounded border border-slate-300 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">Khoảng nghỉ lặp lại (ms):</label>
                    <input
                      type="number"
                      min="0" max="60000"
                      value={settings.ttsRepeatDelayMs}
                      onChange={(e) => updateSettings({ ...settings, ttsRepeatDelayMs: parseInt(e.target.value, 10) })}
                      className="w-full text-xs font-mono p-1.5 rounded border border-slate-300 bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Repeat Fire */}
              <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-900">Chu kỳ nhắc lại khi cháy</div>
                  <input
                    type="checkbox"
                    checked={settings.ttsFireRepeatEnabled}
                    onChange={(e) => updateSettings({ ...settings, ttsFireRepeatEnabled: e.target.checked })}
                  />
                </div>
                <input
                  type="text"
                  value={settings.ttsFireRepeatMessage}
                  disabled={!settings.ttsFireRepeatEnabled}
                  onChange={(e) => updateSettings({ ...settings, ttsFireRepeatMessage: e.target.value })}
                  className="w-full text-xs font-mono p-2 rounded border border-slate-300 bg-white"
                />
              </div>

              {/* Initial Person */}
              <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-900">Khi mới phát hiện người</div>
                  <input
                    type="checkbox"
                    checked={settings.ttsPersonDetectedEnabled}
                    onChange={(e) => updateSettings({ ...settings, ttsPersonDetectedEnabled: e.target.checked })}
                  />
                </div>
                <input
                  type="text"
                  value={settings.ttsPersonDetectedMessage}
                  disabled={!settings.ttsPersonDetectedEnabled}
                  onChange={(e) => updateSettings({ ...settings, ttsPersonDetectedMessage: e.target.value })}
                  className="w-full text-xs font-mono p-2 rounded border border-slate-300 bg-white"
                />
              </div>

              {/* Repeat Person */}
              <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-900">Chu kỳ nhắc lại có người</div>
                  <input
                    type="checkbox"
                    checked={settings.ttsPersonRepeatEnabled}
                    onChange={(e) => updateSettings({ ...settings, ttsPersonRepeatEnabled: e.target.checked })}
                  />
                </div>
                <input
                  type="text"
                  value={settings.ttsPersonRepeatMessage}
                  disabled={!settings.ttsPersonRepeatEnabled}
                  onChange={(e) => updateSettings({ ...settings, ttsPersonRepeatMessage: e.target.value })}
                  className="w-full text-xs font-mono p-2 rounded border border-slate-300 bg-white"
                />
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
};



