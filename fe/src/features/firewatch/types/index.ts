export type AreaId = 'zone_1' | 'zone_2' | 'zone_3';

export interface Area {
  id: AreaId;
  name: string;
  code: string;
  tag: string;
  riskLevel: 1 | 2 | 3 | 4;
  description: string;
}

export type DeviceType = 'mcu_esp32' | 'camera_rtsp' | 'relay_pump' | 'buzzer_horn' | 'strobe_led';

export interface Device {
  id: string;
  name: string;
  type: DeviceType;
  areaId: AreaId;
  gpio?: number;
  ip?: string;
  mac?: string;
  firmwareVersion?: string;
  isOnline: boolean;
  lastHeartbeat: string;
  status: 'idle' | 'active' | 'warning' | 'error' | 'offline';
  metadata?: Record<string, string | number | boolean>;
}

export interface SensorReading {
  id: string;
  areaId: AreaId;
  timestamp: string; // ISO or formatted
  temperatureC: number | null; // DHT22 GPIO3
  humidityPercent: number | null; // DHT22 GPIO3
  flameAdc: number | null; // Flame GPIO6 ADC1_CH5 (0 - 4095 raw, inverse: lower is stronger flame)
  mq2Adc: number | null; // MQ-2 GPIO5 ADC1_CH4 (0 - 4095 raw smoke/gas)
  mq2SmokeDetected?: boolean | null; // firmware MQ-2 smoke/gas threshold state
  flameFireDetected: boolean; // firmware logic: flameAdc < 2500 in 3 consecutive cycles
  pumpRelayState?: boolean | null; // ESP32 reported relay output state only, not water-flow proof
  fanState?: boolean | null;
  buzzerState?: boolean | null;
  ledState?: boolean | null;
  operatingMode?: string | null;
  isStale: boolean;
}

export interface AIDetection {
  id: string;
  class: 'fire' | 'smoke';
  confidence: number; // 0.0 - 1.0
  bbox: [number, number, number, number]; // [x, y, width, height] normalized or pixel in 1080p
  timestamp: string;
  frameIndex?: number;
}

export type AlertSeverity = 'critical' | 'warning' | 'info' | 'audit';
export type AlertStatus = 'new' | 'acknowledged' | 'resolved';
export type AlertConditionStatus = 'active' | 'cleared' | 'unknown';
export type AlertSource = 'ai' | 'sensor' | 'dual' | 'manual' | 'system';

export interface AlertEvent {
  id: string;
  code: string; // e.g. #EV-8041
  timestamp: string;
  startedAtMs?: number;
  lastDetectedAtMs?: number;
  conditionClearedAtMs?: number;
  areaId: AreaId;
  areaName: string;
  source: AlertSource;
  sourceDescription: string;
  severity: AlertSeverity;
  backendSeverity?: string;
  status: AlertStatus;
  isActive: boolean;
  conditionStatus: AlertConditionStatus;
  title: string;
  description: string;
  operatorName?: string;
  operatorId?: string;
  acknowledgedAt?: string;
  conditionClearedAt?: string;
  snapshotUrl: string;
  aiConfidence?: number | null;
  detections: AIDetection[];
  sensorSnapshot: {
    temp: number | null;
    humidity: number | null;
    flameAdc: number | null;
    mq2Adc: number | null;
    pumpActive: boolean;
  };
  timeline: {
    time: string;
    stepTitle: string;
    description: string;
    actor?: string;
  }[];
}

export type CommandStatus = 'sending' | 'pending_ack' | 'ack_success' | 'failed' | 'timeout';

export interface DeviceCommand {
  id: string;
  timestamp: string;
  targetDevice: string;
  gpio: number;
  commandPayload: string;
  topic: string;
  ackLatencyMs?: number;
  status: CommandStatus;
  operator: string;
  notes?: string;
}

export type LogLevel = 'CRITICAL' | 'WARN' | 'INFO' | 'ERROR' | 'AUDIT';

export interface AuditLog {
  id: string;
  timestamp: string;
  source: string;
  channel?: string;
  level: LogLevel;
  message: string;
  device?: string;
  deviceName?: string;
  areaName?: string;
  entityId?: string;
  operator?: string;
  details?: Record<string, unknown>;
}

export interface SystemSettings {
  aiModelName: string;
  aiConfidenceFireThreshold: number; // e.g. 0.55
  aiConfidenceSmokeThreshold: number; // e.g. 0.50
  aiConsecutiveFrames: number; // e.g. 5
  aiCooldownSeconds: number; // e.g. 15
  flameTriggerThresholdAdc: number; // 2500 (lower means trigger)
  flameClearThresholdAdc: number; // 3000
  mq2SmokeOnThresholdAdc: number; // MQ-2 fan ON threshold, 0 - 4095 ADC
  mq2SmokeOffThresholdAdc: number; // MQ-2 fan OFF threshold, lower than ON threshold
  dhtSamplingPeriodMs: number;
  pumpStartDelayMs: number;
  pumpStopDelayMs: number;
  pumpCycleOnMs: number; // 2000ms
  pumpCycleOffMs: number; // 1000ms
  pumpMaxDurationSec: number;
  hardwareInterlockMode: 'hardware_enforced' | 'manual_override' | 'estop';
  
  ttsInitialMessage: string;
  ttsInitialRepeatCount: number;
  ttsRepeatDelayMs: number;
  ttsFireRepeatMessage: string;
  ttsPersonDetectedMessage: string;
  ttsPersonRepeatMessage: string;
  ttsInitialEnabled: boolean;
  ttsFireRepeatEnabled: boolean;
  ttsPersonDetectedEnabled: boolean;
  ttsPersonRepeatEnabled: boolean;

  checksumSha256: string;
  deviceConfigQueued?: boolean;
}

export type DemoScenarioId =
  | 'normal'
  | 'ai_fire'
  | 'sensor_fire'
  | 'dual_fire'
  | 'esp32_offline'
  | 'cam_offline'
  | 'ai_offline'
  | 'pumping'
  | 'cmd_pending'
  | 'cmd_failed';

export interface DemoScenario {
  id: DemoScenarioId;
  name: string;
  description: string;
  badgeColor: string;
}
