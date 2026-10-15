import {
  Area,
  Device,
  SensorReading,
  AlertEvent,
  AIDetection,
  DeviceCommand,
  AuditLog,
  SystemSettings,
  DemoScenarioId,
} from '../types';
import { IFireWatchService, AlertFilterOptions, TelemetryHistoryPoint } from './contracts';

export class ApiFireWatchService implements IFireWatchService {
  public isMock = false;
  private baseUrl: string;
  private cachedDevices: Device[] = [];

  constructor() {
    this.baseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(options.headers || {}),
      },
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      throw new Error(`API error ${res.status}: ${errorText || res.statusText}`);
    }

    return (await res.json()) as T;
  }

  public getCurrentScenario(): DemoScenarioId {
    return 'normal';
  }

  public async setDemoScenario(_scenarioId: DemoScenarioId): Promise<void> {
    return Promise.resolve();
  }

  public async getAreas(): Promise<Area[]> {
    return this.request<Area[]>('/api/areas');
  }

  public async getDevices(areaId?: string): Promise<Device[]> {
    const query = areaId ? `?areaId=${encodeURIComponent(areaId)}` : '';
    const devices = await this.request<Device[]>(`/api/devices${query}`);
    this.cachedDevices = areaId
      ? [...this.cachedDevices.filter((device) => device.areaId !== areaId), ...devices]
      : devices;
    return devices;
  }

  public async getLatestReading(areaId: string): Promise<SensorReading> {
    return this.request<SensorReading>(`/api/sensors/latest?areaId=${encodeURIComponent(areaId)}`);
  }

  public async getTelemetryHistory(
    areaId: string,
    rangeMinutes: number
  ): Promise<TelemetryHistoryPoint[]> {
    const rows = await this.request<TelemetryHistoryPoint[]>(
      `/api/sensors/history?areaId=${encodeURIComponent(areaId)}&range=${rangeMinutes}`
    );
    return rows.map((row) => ({ ...row, time: this.formatBangkokTime(row.time) }));
  }

  public async getAlerts(filters?: AlertFilterOptions): Promise<AlertEvent[]> {
    const params = new URLSearchParams();
    if (filters?.areaId) params.append('area_code', filters.areaId);
    if (filters?.startedFrom) params.append('started_from', filters.startedFrom);
    if (filters?.startedBefore) params.append('started_before', filters.startedBefore);
    if (filters?.limit) params.append('limit', String(filters.limit));
    if (filters?.status) params.append('status', this.toBackendStatus(filters.status));
    if (filters?.severity) params.append('severity', filters.severity);

    const rows = await this.request<BackendAlert[]>(`/api/alerts?${params.toString()}`);
    const alerts = await Promise.all(rows.map((row) => this.mapAlert(row, false)));
    if (!filters?.query) return alerts;

    const keyword = filters.query.toLowerCase();
    return alerts.filter(
      (alert) =>
        alert.title.toLowerCase().includes(keyword) ||
        alert.description.toLowerCase().includes(keyword) ||
        alert.code.toLowerCase().includes(keyword)
    );
  }

  public async getAlertById(id: string): Promise<AlertEvent | null> {
    const row = await this.request<BackendAlert>(`/api/alerts/${encodeURIComponent(id)}`);
    return this.mapAlert(row, true);
  }

  public async acknowledgeAlert(id: string, operatorName: string): Promise<AlertEvent> {
    const row = await this.request<BackendAlert>(`/api/alerts/${encodeURIComponent(id)}/ack`, {
      method: 'POST',
      body: JSON.stringify({ user_id: null, operator_name: operatorName }),
    });
    return this.mapAlert(row, false);
  }

  public async sendDeviceCommand(
    targetDevice: string,
    gpio: number,
    payload: string,
    operator: string
  ): Promise<DeviceCommand> {
    const deviceCode = await this.resolveEsp32DeviceCode();
    const command = this.mapCommandTarget(targetDevice, payload);
    const row = await this.request<BackendCommand>('/api/commands', {
      method: 'POST',
      body: JSON.stringify({
        device_code: deviceCode,
        target: command.target,
        action: command.action,
        operator,
      }),
    });

    return {
      ...this.mapCommand(row, targetDevice),
      gpio,
      commandPayload: payload,
      topic: `fire/devices/${deviceCode}/commands`,
    };
  }

  public async getCommandHistory(): Promise<DeviceCommand[]> {
    const rows = await this.request<BackendCommand[]>('/api/commands');
    return rows.map((row) => this.mapCommand(row));
  }

  public async getAuditLogs(filters?: { level?: string; query?: string }): Promise<AuditLog[]> {
    const params = new URLSearchParams({ limit: '500' });
    if (filters?.level) params.append('level', filters.level);
    if (filters?.query) params.append('q', filters.query);
    return this.request<AuditLog[]>(`/api/logs?${params.toString()}`);
  }

  public async getSettings(): Promise<SystemSettings> {
    return this.request<SystemSettings>('/api/settings');
  }

  public async saveSettings(
    settings: Partial<SystemSettings>
  ): Promise<SystemSettings & { deviceConfigQueued: boolean }> {
    return this.request<SystemSettings & { deviceConfigQueued: boolean }>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  public subscribeTelemetry(
    areaId: string,
    callback: (reading: SensorReading) => void
  ): () => void {
    let stopped = false;
    let socket: WebSocket | null = null;
    let currentToken = 0;

    const loadLatest = async () => {
      const token = ++currentToken;
      try {
        const reading = await this.getLatestReading(areaId);
        if (!stopped && token === currentToken) {
          callback(reading);
        }
      } catch {
        // The interval below is also the reconnect fallback.
      }
    };

    const mapRealtimeTelemetry = (payload: Record<string, unknown>): SensorReading | null => {
      const eventAreaId = String(payload.area_code || areaId);
      if (eventAreaId !== areaId) return null;
      const timestamp = typeof payload.measured_at === 'string' ? payload.measured_at : new Date().toISOString();
      return {
        id: String(payload.id || `ws-${Date.now()}`),
        areaId: eventAreaId as SensorReading['areaId'],
        timestamp,
        temperatureC: typeof payload.temperature_c === 'number' ? payload.temperature_c : null,
        humidityPercent: typeof payload.humidity_percent === 'number' ? payload.humidity_percent : null,
        flameAdc: typeof payload.flame_adc === 'number' ? payload.flame_adc : null,
        mq2Adc: typeof payload.mq2_adc === 'number' ? payload.mq2_adc : null,
        mq2SmokeDetected: typeof payload.mq2_smoke_detected === 'boolean' ? payload.mq2_smoke_detected : null,
        flameFireDetected: payload.fire_state === 'fire',
        pumpRelayState: typeof payload.pump_relay_state === 'boolean' ? payload.pump_relay_state : null,
        fanState: typeof payload.fan_state === 'boolean' ? payload.fan_state : null,
        buzzerState: typeof payload.buzzer_state === 'boolean' ? payload.buzzer_state : null,
        ledState: typeof payload.led_state === 'boolean' ? payload.led_state : null,
        operatingMode: typeof payload.operating_mode === 'string' ? payload.operating_mode : null,
        isStale: false,
      };
    };

    try {
      socket = new WebSocket(`${this.baseUrl.replace(/^http/, 'ws')}/ws`);
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'telemetry') {
            const reading = mapRealtimeTelemetry(data.payload || {});
            if (reading && !stopped) {
              currentToken += 1;
              callback(reading);
              return;
            }
            void loadLatest();
          }
          if (
            data.type === 'alert_updated' ||
            data.type === 'vision_detection' ||
            data.type === 'command_ack'
          ) {
            void loadLatest();
          }
        } catch {
          // ignore
        }
      };
      socket.onerror = () => {
        socket?.close();
      };
    } catch {
      socket = null;
    }

    const interval = window.setInterval(loadLatest, 1000);
    void loadLatest();

    return () => {
      stopped = true;
      window.clearInterval(interval);
      socket?.close();
    };
  }

  private toBackendStatus(status: string): string {
    if (status === 'new') return 'open';
    return status;
  }

  private mapStatus(status: string): AlertEvent['status'] {
    switch (status) {
      case 'open':
        return 'new';
      case 'acknowledged':
        return 'acknowledged';
      case 'closed':
      case 'false_positive':
        return 'resolved';
      default:
        throw new Error(`Unsupported backend alert status: ${status}`);
    }
  }

  private mapSeverity(severity: string): AlertEvent['severity'] {
    if (severity === 'critical' || severity === 'high') return 'critical';
    if (severity === 'medium') return 'warning';
    return 'info';
  }

  private mapSource(source: string): AlertEvent['source'] {
    if (source === 'ai') return 'ai';
    if (source === 'sensor') return 'sensor';
    if (source === 'dual') return 'dual';
    return 'system';
  }

  private mapSourceDescription(source: string): string {
    if (source === 'ai') return 'Camera AI';
    if (source === 'sensor') return 'Cảm biến ESP32';
    if (source === 'dual') return 'Backend xác nhận kép';
    return 'Loi thiết bị';
  }

  private mapAlertText(row: BackendAlert): { title: string; description: string } {
    if (row.source_type === 'ai') {
      return {
        title: 'Camera AI phát hiện lửa/kối',
        description: 'AI phát hiện fire/smoke trong frame camera. Chưa đủ điều kiện bật bơm nếu cảm biến ESP32 chưa xác nhận cùng khu vực.',
      };
    }
    if (row.source_type === 'sensor') {
      return {
        title: 'Cảm biến ESP32 phát hiện lửa',
        description: 'ESP32 báo trạng thái FIRE từ cảm biến lửa. Chưa đủ điều kiện bật bơm nếu camera AI chưa xác nhận cùng khu vực.',
      };
    }
    return {
      title: row.title,
      description: row.message || row.title,
    };
  }

  private formatBangkokTime(value?: string | null): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Bangkok',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour12: false,
    }).format(date);
  }

  private formatTime(value?: string | null): string {
    return this.formatBangkokTime(value);
  }

  private normalizeBBox(bbox: Record<string, number> | undefined): [number, number, number, number] {
    if (!bbox) return [0, 0, 0, 0];
    const x = bbox.x ?? bbox.x1 ?? 0;
    const y = bbox.y ?? bbox.y1 ?? 0;
    const width = bbox.w ?? bbox.width ?? ((bbox.x2 ?? x) - x);
    const height = bbox.h ?? bbox.height ?? ((bbox.y2 ?? y) - y);
    return [x, y, Math.max(0, width), Math.max(0, height)];
  }

  private mapDetectionRows(rows: BackendVisionDetection[]): AIDetection[] {
    return rows.flatMap((row) =>
      (row.detections || []).map((item, index) => ({
        id: `${row.id}_${index}`,
        class: String(item.label).toLowerCase() === 'smoke' ? 'smoke' : 'fire',
        confidence: Number(item.confidence || 0),
        bbox: this.normalizeBBox(item.bbox),
        timestamp: row.frame_at,
        frameIndex: row.id,
      }))
    );
  }

  private async mapAlert(row: BackendAlert, withDetections: boolean): Promise<AlertEvent> {
    const detections = withDetections
      ? await this.request<BackendVisionDetection[]>(`/api/vision/detections?alert_id=${row.id}&limit=50`)
      : [];
    const firstDetection = detections[0];
    const details = row.details || {};
    const status = this.mapStatus(row.status);
    const isActive = row.status === 'open' || row.status === 'acknowledged';
    const conditionStatus: AlertEvent['conditionStatus'] = row.condition_cleared_at == null ? 'active' : 'cleared';
    const text = this.mapAlertText(row);

    return {
      id: String(row.id),
      code: `#EV-${String(row.id).padStart(4, '0')}`,
      timestamp: this.formatTime(row.started_at),
      startedAtMs: Date.parse(row.started_at),
      lastDetectedAtMs: Date.parse(row.last_detected_at),
      conditionClearedAtMs: row.condition_cleared_at ? Date.parse(row.condition_cleared_at) : undefined,
      areaId: String(row.area_code || row.area_id) as Area['id'],
      areaName: row.area_name || `Khu vực ${row.area_id}`,
      source: this.mapSource(row.source_type),
      sourceDescription: this.mapSourceDescription(row.source_type),
      severity: this.mapSeverity(row.severity),
      backendSeverity: row.severity,
      status,
      isActive,
      conditionStatus,
      title: text.title,
      description: text.description,
      operatorId: row.acknowledged_by ? String(row.acknowledged_by) : undefined,
      operatorName: String(details.acknowledged_by_name || '') || (row.acknowledged_by ? `User ${row.acknowledged_by}` : undefined),
      acknowledgedAt: row.acknowledged_at ? this.formatTime(row.acknowledged_at) : undefined,
      conditionClearedAt: this.formatTime(row.condition_cleared_at),
      snapshotUrl: firstDetection?.snapshot_path || '',
      aiConfidence: typeof details.best_confidence === 'number' ? details.best_confidence : null,
      detections: this.mapDetectionRows(detections),
      sensorSnapshot: {
        temp: null,
        humidity: null,
        flameAdc: Number(details.flame_adc ?? 0) || null,
        mq2Adc: Number(details.mq2_adc ?? 0) || null,
        pumpActive: false,
      },
      timeline: [
        {
          time: this.formatTime(row.started_at),
          stepTitle: 'Phat hien cảnh báo',
          description: row.message || row.title,
          actor: row.source_type.toUpperCase(),
        },
        ...(row.acknowledged_at
          ? [
              {
                time: this.formatTime(row.acknowledged_at),
                stepTitle: 'Đã tiếp nhận',
                description: 'Nguoi van hanh da xác nhận cảnh báo.',
                actor: row.acknowledged_by ? `User ${row.acknowledged_by}` : 'Operator',
              },
            ]
          : []),
        ...(row.condition_cleared_at
          ? [
              {
                time: this.formatTime(row.condition_cleared_at),
                stepTitle: 'Điều kiện cảnh báo da het',
                description: 'Backend ghi nhận cảm biến hoặc AI không còn điều kiện cảnh báo.',
                actor: 'Backend',
              },
            ]
          : []),
      ],
    };
  }

  private async resolveEsp32DeviceCode(): Promise<string> {
    let esp32 = this.cachedDevices.find((device) => device.type === 'mcu_esp32');
    if (!esp32) {
      const devices = await this.getDevices();
      esp32 = devices.find((device) => device.type === 'mcu_esp32');
    }
    if (!esp32) throw new Error('Chưa có thiết bị ESP32 trong database');
    return esp32.id;
  }

  private mapCommandTarget(targetDevice: string, payload: string): { target: string; action: string } {
    const text = `${targetDevice} ${payload}`.toLowerCase();
    const target = text.includes('lcd') || text.includes('man hinh') || text.includes('màn hình')
      ? 'lcd'
      : text.includes('quat') || text.includes('fan')
      ? 'fan'
      : text.includes('bom') || text.includes('bom') || text.includes('pump')
      ? 'pump'
      : text.includes('coi') || text.includes('coi') || text.includes('buzzer')
        ? 'buzzer'
        : text.includes('den') || text.includes('den') || text.includes('strobe') || text.includes('led')
          ? 'led'
          : 'mode';
    const action = target === 'lcd'
      ? 'clear'
      : text.includes('stop') || text.includes('off')
      ? 'off'
      : text.includes('mute') || text.includes('silence')
        ? 'silence'
        : text.includes('reset') || text.includes('reboot')
          ? 'reset'
          : text.includes('auto')
            ? 'auto'
            : text.includes('manual')
              ? 'manual'
              : 'on';
    return { target, action };
  }

  private formatDeviceLabel(row: BackendCommand): string {
    const name = row.device_name?.trim();
    const code = row.device_code?.trim();
    const area = row.area_name?.trim();
    const base = name || code || `Thiết bị ${row.device_id}`;
    return area && !base.toLowerCase().includes(area.toLowerCase()) ? `${base} - ${area}` : base;
  }
  private mapCommand(row: BackendCommand, label?: string): DeviceCommand {
    const statusMap: Record<string, DeviceCommand['status']> = {
      pending: 'pending_ack',
      sent: 'pending_ack',
      acknowledged: 'ack_success',
      failed: 'failed',
      timeout: 'timeout',
    };
    const started = row.sent_at || row.requested_at;
    const ended = row.acknowledged_at;
    const latency = started && ended ? new Date(ended).getTime() - new Date(started).getTime() : undefined;

    return {
      id: row.command_uuid || String(row.id),
      timestamp: this.formatTime(row.requested_at),
      targetDevice: label || this.formatDeviceLabel(row),
      gpio: row.target === 'pump' ? 16 : row.target === 'fan' ? 15 : row.target === 'buzzer' ? 7 : row.target === 'led' ? 2 : 0,
      commandPayload: `${row.target}:${row.action}`,
      topic: `fire/devices/${row.device_code || row.device_id}/commands`,
      ackLatencyMs: latency && latency > 0 ? latency : undefined,
      status: statusMap[row.status] || 'pending_ack',
      operator: row.requested_by ? `User ${row.requested_by}` : 'Web Dashboard',
      notes: row.failure_reason || undefined,
    };
  }
}

interface BackendAlert {
  id: number;
  area_id: number;
  area_code?: string | null;
  area_name?: string | null;
  source_device_id?: number | null;
  source_type: string;
  severity: string;
  status: string;
  title: string;
  message?: string | null;
  started_at: string;
  last_detected_at: string;
  condition_cleared_at?: string | null;
  acknowledged_by?: number | null;
  acknowledged_at?: string | null;
  details?: Record<string, unknown> | null;
}

interface BackendVisionDetection {
  id: number;
  camera_device_id: number;
  alert_id?: number | null;
  frame_at: string;
  model_name: string;
  model_version?: string | null;
  detections: Array<{
    label: string;
    confidence: number;
    bbox?: Record<string, number>;
  }>;
  snapshot_path?: string | null;
  video_path?: string | null;
}

interface BackendCommand {
  id: number;
  command_uuid: string;
  device_id: number;
  device_code?: string | null;
  device_name?: string | null;
  area_name?: string | null;
  target: string;
  action: string;
  requested_by?: number | null;
  requested_at: string;
  sent_at?: string | null;
  acknowledged_at?: string | null;
  status: string;
  ack_payload?: Record<string, unknown> | null;
  failure_reason?: string | null;
}
