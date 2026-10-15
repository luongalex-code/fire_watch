import {
  Area,
  Device,
  SensorReading,
  AlertEvent,
  DeviceCommand,
  AuditLog,
  SystemSettings,
  DemoScenarioId,
} from '../types';

export interface AlertFilterOptions {
  areaId?: string;
  status?: string;
  severity?: string;
  query?: string;
  startedFrom?: string;
  startedBefore?: string;
  limit?: number;
}

export interface TelemetryHistoryPoint {
  time: string;
  temp: number | null;
  humidity: number | null;
  flameAdc: number | null;
  mq2Adc: number | null;
  mq2SmokeDetected?: boolean | null;
  fanState?: boolean | null;
}

export interface IFireWatchService {
  isMock: boolean;
  getAreas(): Promise<Area[]>;
  getDevices(areaId?: string): Promise<Device[]>;
  getLatestReading(areaId: string): Promise<SensorReading>;
  getTelemetryHistory(areaId: string, rangeMinutes: number): Promise<TelemetryHistoryPoint[]>;
  getAlerts(filters?: AlertFilterOptions): Promise<AlertEvent[]>;
  getAlertById(id: string): Promise<AlertEvent | null>;
  acknowledgeAlert(id: string, operatorName: string): Promise<AlertEvent>;
  sendDeviceCommand(
    targetDevice: string,
    gpio: number,
    payload: string,
    operator: string
  ): Promise<DeviceCommand>;
  getCommandHistory(): Promise<DeviceCommand[]>;
  getAuditLogs(filters?: { level?: string; query?: string }): Promise<AuditLog[]>;
  getSettings(): Promise<SystemSettings>;
  saveSettings(
    settings: Partial<SystemSettings>
  ): Promise<SystemSettings & { deviceConfigQueued: boolean }>;
  setDemoScenario(scenarioId: DemoScenarioId): Promise<void>;
  getCurrentScenario(): DemoScenarioId;
  subscribeTelemetry(areaId: string, callback: (reading: SensorReading) => void): () => void;
}
