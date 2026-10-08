import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  Area,
  AreaId,
  Device,
  SensorReading,
  AlertEvent,
  DeviceCommand,
  DemoScenarioId,
} from '../types';
import { fireWatchService } from '../services';
import { PumpAutoController } from './pumpAutoController';

const CAMERA_SERVICE_URL = (import.meta.env.VITE_CAMERA_SERVICE_URL || 'http://127.0.0.1:8090').replace(/\/$/, '');
const PUMP_AUTO_ON_DELAY_MS = Number(import.meta.env.VITE_PUMP_AUTO_ON_DELAY_MS) || 4000;
const PUMP_AUTO_OFF_DELAY_MS = Number(import.meta.env.VITE_PUMP_AUTO_OFF_DELAY_MS) || 4000;

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message?: string;
}

export interface PersonDetectionState {
  enabled: boolean;
  status: 'loading' | 'online' | 'offline' | 'disabled' | 'error';
  areaCode?: string | null;
  cameraCode?: string | null;
  personCount: number;
  detections: Array<{
    label: string;
    confidence: number;
    bbox?: Record<string, number>;
  }>;
  updatedAt?: string | null;
  confidenceThreshold?: number;
  intervalFrames?: number;
  modelName?: string | null;
  latencyMs?: number | null;
  error?: string | null;
}

interface FireWatchContextType {
  currentAreaId: AreaId;
  setCurrentAreaId: (id: AreaId) => void;
  areas: Area[];
  devices: Device[];
  latestReading: SensorReading | null;
  alerts: AlertEvent[];
  unacknowledgedCount: number;
  activeCriticalAlert: AlertEvent | null;
  fullScreenAlert: AlertEvent | null;
  currentScenario: DemoScenarioId;
  changeScenario: (scenarioId: DemoScenarioId) => Promise<void>;
  isMock: boolean;
  operator: {
    name: string;
    role: string;
    id: string;
  };
  systemStatus: {
    esp32: 'connected' | 'disconnected';
    camera: 'live' | 'offline';
    ai: 'online' | 'offline';
    mqtt: 'synced' | 'disconnected';
    lastSyncTime: string;
    cameraFrameAgeSeconds?: number | null;
    personDetection?: PersonDetectionState;
  };
  toasts: ToastMessage[];
  showToast: (toast: Omit<ToastMessage, 'id'>) => void;
  dismissToast: (id: string) => void;
  dismissFullScreenAlert: (id: string) => void;
  acknowledgeAlert: (id: string) => Promise<void>;
  sendDeviceCommand: (target: string, gpio: number, payload: string) => Promise<DeviceCommand>;
  refreshAlerts: () => Promise<void>;
  refreshDevices: () => Promise<void>;
}

const FireWatchContext = createContext<FireWatchContextType | null>(null);
const TOAST_DURATION_MS = 12000;

interface FireWatchProviderProps {
  children: React.ReactNode;
  currentUser?: {
    id: number;
    email: string;
    full_name?: string | null;
    role: string;
  } | null;
}

const roleLabels: Record<string, string> = {
  admin: 'Quan tri vien',
  operator: 'Dieu hanh vien',
  viewer: 'Nguoi xem',
};

export const FireWatchProvider: React.FC<FireWatchProviderProps> = ({ children, currentUser }) => {
  const [currentAreaId, setCurrentAreaId] = useState<AreaId>('default' as AreaId);
  const [areas, setAreas] = useState<Area[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [latestReading, setLatestReading] = useState<SensorReading | null>(null);
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [currentScenario, setCurrentScenario] = useState<DemoScenarioId>(
    fireWatchService.getCurrentScenario()
  );
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [lastSyncTime, setLastSyncTime] = useState<string>('14:32:05');
  const [cameraHealth, setCameraHealth] = useState<{
    hasFrame: boolean;
    frameAgeSeconds: number | null;
    personDetection?: PersonDetectionState;
  }>({ hasFrame: false, frameAgeSeconds: null });
  const [dismissedFullScreenAlertIds, setDismissedFullScreenAlertIds] = useState<Set<string>>(
    () => new Set()
  );
  const [locallyAcknowledgedAlertIds, setLocallyAcknowledgedAlertIds] = useState<Set<string>>(
    () => new Set()
  );
  const [latchedCriticalAlertId, setLatchedCriticalAlertId] = useState<string | null>(null);
  const lastUrgentToastAlertIdRef = useRef<string | null>(null);

  const operator = {
    name: currentUser?.full_name || currentUser?.email || 'Nguoi dung',
    role: roleLabels[currentUser?.role || ''] || currentUser?.role || 'Nguoi dung',
    id: currentUser?.id ? `USER-${currentUser.id}` : 'USER',
  };

  const showToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = `toast_${Date.now()}_${Math.random()}`;
    setToasts((prev) => {
      const hasSameToast = prev.some(
        (item) =>
          item.type === toast.type &&
          item.title === toast.title &&
          item.message === toast.message
      );
      return hasSameToast ? prev : [...prev, { ...toast, id }];
    });
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, TOAST_DURATION_MS);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const dismissFullScreenAlert = useCallback((id: string) => {
    setDismissedFullScreenAlertIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  // Initial load
  const loadInitialData = useCallback(async () => {
    try {
      const [fetchedAreas, fetchedDevices, fetchedAlerts] = await Promise.all([
        fireWatchService.getAreas(),
        fireWatchService.getDevices(),
        fireWatchService.getAlerts(),
      ]);
      const selectedAreaId = (fetchedAreas[0]?.id || currentAreaId) as AreaId;
      const fetchedReading = await fireWatchService.getLatestReading(selectedAreaId);
      setAreas(fetchedAreas);
      setCurrentAreaId(selectedAreaId);
      setDevices(fetchedDevices);
      setAlerts(fetchedAlerts);
      setLatestReading(fetchedReading);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Loi tai du lieu';
      showToast({ type: 'error', title: 'Loi tai du lieu', message: msg });
    }
  }, [currentAreaId, showToast]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const refreshAlerts = useCallback(async () => {
    const updated = await fireWatchService.getAlerts();
    setAlerts(updated);
  }, []);

  const refreshDevices = useCallback(async () => {
    const updated = await fireWatchService.getDevices();
    setDevices(updated);
  }, []);

  // Subscribe to live telemetry
  useEffect(() => {
    const unsubscribe = fireWatchService.subscribeTelemetry(currentAreaId, (reading) => {
      setLatestReading(reading);
      const now = new Date();
      setLastSyncTime(now.toTimeString().split(' ')[0]);
      void refreshAlerts();
      void refreshDevices();
    });
    return () => {
      unsubscribe();
    };
  }, [currentAreaId, refreshAlerts, refreshDevices]);

  useEffect(() => {
    let stopped = false;

    const checkCameraHealth = async () => {
      try {
        const response = await fetch(`${CAMERA_SERVICE_URL}/health`, { cache: 'no-store' });
        if (!response.ok) throw new Error(`camera health ${response.status}`);
        const data = await response.json();
        void refreshAlerts();
        const person = data.person_detection || {};
        if (!stopped) {
          setCameraHealth({
            hasFrame: Boolean(data.has_frame),
            frameAgeSeconds:
              typeof data.frame_age_seconds === 'number' ? data.frame_age_seconds : null,
            personDetection: {
              enabled: Boolean(person.enabled),
              status: typeof person.status === 'string' ? person.status : 'offline',
              areaCode: typeof person.area_code === 'string' ? person.area_code : null,
              cameraCode: typeof person.camera_code === 'string' ? person.camera_code : null,
              personCount: typeof person.person_count === 'number' ? person.person_count : 0,
              detections: Array.isArray(person.detections) ? person.detections : [],
              updatedAt: typeof person.updated_at === 'string' ? person.updated_at : null,
              confidenceThreshold:
                typeof person.confidence_threshold === 'number' ? person.confidence_threshold : undefined,
              intervalFrames:
                typeof person.interval_frames === 'number' ? person.interval_frames : undefined,
              modelName: typeof person.model_name === 'string' ? person.model_name : null,
              latencyMs: typeof person.latency_ms === 'number' ? person.latency_ms : null,
              error: typeof person.error === 'string' ? person.error : null,
            },
          });
        }
      } catch {
        if (!stopped) {
          setCameraHealth({ hasFrame: false, frameAgeSeconds: null });
        }
      }
    };

    void checkCameraHealth();
    const interval = window.setInterval(checkCameraHealth, 1000);
    return () => {
      stopped = true;
      window.clearInterval(interval);
    };
  }, [refreshAlerts]);

  const changeScenario = useCallback(
    async (scenarioId: DemoScenarioId) => {
      await fireWatchService.setDemoScenario(scenarioId);
      setCurrentScenario(scenarioId);
      await Promise.all([refreshDevices(), refreshAlerts()]);
      const reading = await fireWatchService.getLatestReading(currentAreaId);
      setLatestReading(reading);
      showToast({
        type: 'info',
        title: 'Chuyen kich ban mo phong',
        message: `Da ap dung kich ban: ${scenarioId}`,
      });
    },
    [currentAreaId, refreshAlerts, refreshDevices, showToast]
  );

  const acknowledgeAlert = useCallback(
    async (id: string) => {
      setLocallyAcknowledgedAlertIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
      setAlerts((prev) =>
        prev.map((alert) =>
          alert.id === id
            ? {
                ...alert,
                status: 'acknowledged',
                operatorName: operator.name,
              }
            : alert
        )
      );

      try {
        await fireWatchService.acknowledgeAlert(id, operator.name);
        await refreshAlerts();
      } catch (err: unknown) {
        setLocallyAcknowledgedAlertIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        await refreshAlerts();
        showToast({
          type: 'error',
          title: 'Loi xác nhận',
          message: err instanceof Error ? err.message : 'Thao tác thất bại',
        });
        throw err;
      }
    },
    [operator.name, refreshAlerts, showToast]
  );

  const sendDeviceCommand = useCallback(
    async (target: string, gpio: number, payload: string) => {
      try {
        const cmd = await fireWatchService.sendDeviceCommand(
          target,
          gpio,
          payload,
          operator.name
        );
        await refreshDevices();
        if (cmd.status === 'ack_success') {
          showToast({
            type: 'success',
            title: 'Lenh thuc thi thanh cong',
            message: `ESP32 phan hoi ACK sau ${cmd.ackLatencyMs}ms`,
          });
        } else if (cmd.status === 'pending_ack') {
          showToast({
            type: 'warning',
            title: 'Dang cho xác nhận',
            message: 'Lenh da gửi qua MQTT, dang doi goi tin phan hoi.',
          });
        } else {
          showToast({
            type: 'error',
            title: 'Lenh thất bại',
            message: 'Ro-le bi tu choi boi điều kiện an toan firmware hoặc thiết bị chua ACK.',
          });
        }
        return cmd;
      } catch (err: unknown) {
        showToast({
          type: 'error',
          title: 'Loi điều khiển thiết bị',
          message: err instanceof Error ? err.message : 'Thao tác thất bại',
        });
        throw err;
      }
    },
    [operator.name, refreshDevices, showToast]
  );

  const pumpCommandRef = useRef<(action: 'on' | 'off') => Promise<DeviceCommand>>(() =>
    Promise.reject(new Error('Pump command is not initialized'))
  );
  pumpCommandRef.current = (action) =>
    sendDeviceCommand('Bơm chữa cháy', 16, `pump:${action}`);
  const pumpControllerRef = useRef<PumpAutoController | null>(null);

  // Derived system states
  const esp32Device = devices.find((d) => d.type === 'mcu_esp32' && d.areaId === currentAreaId);
  const cameraDevice = devices.find((d) => d.type === 'camera_rtsp' && d.areaId === currentAreaId);

  const isEsp32Online = esp32Device ? esp32Device.isOnline : false;
  const isCameraOnline = cameraHealth.hasFrame && (cameraHealth.frameAgeSeconds ?? Number.POSITIVE_INFINITY) <= 5;
  const isAiOnline = isCameraOnline;
  const isMqttSynced = isEsp32Online;

  const alertsWithConnectionState = alerts.map((alert) => {
    const alertWithLocalAck = locallyAcknowledgedAlertIds.has(alert.id) && alert.status === 'new'
      ? { ...alert, status: 'acknowledged' as const, operatorName: alert.operatorName || operator.name }
      : alert;
    return alertWithLocalAck;
  });

  const flameReadingIsFresh = Boolean(latestReading && !latestReading.isStale);
  const flameSensorFireDetected =
    flameReadingIsFresh && Boolean(latestReading?.flameFireDetected);
  const cameraFireDetected = alertsWithConnectionState.some(
    (alert) =>
      alert.areaId === currentAreaId &&
      (alert.source === 'ai' || alert.source === 'dual') &&
      alert.severity === 'critical' &&
      alert.isActive &&
      alert.conditionStatus === 'active'
  );
  const confirmedFire = cameraFireDetected && flameSensorFireDetected;
  const canConfirmNoFire = flameReadingIsFresh && !confirmedFire;
  const pumpState = flameReadingIsFresh ? latestReading?.pumpRelayState : null;
  const confirmedCriticalAlert =
    alertsWithConnectionState.find(
      (a) =>
        a.severity === 'critical' &&
        a.status === 'new' &&
        a.isActive &&
        a.conditionStatus === 'active'
    ) ||
    alertsWithConnectionState.find(
      (a) =>
        a.severity === 'critical' &&
        a.isActive &&
        a.conditionStatus === 'active'
    ) ||
    null;

  useEffect(() => {
    if (confirmedFire && confirmedCriticalAlert?.status === 'new') {
      setLatchedCriticalAlertId(confirmedCriticalAlert.id);
      return;
    }

    if (
      latchedCriticalAlertId &&
      !alertsWithConnectionState.some(
        (alert) =>
          alert.id === latchedCriticalAlertId &&
          alert.status === 'new' &&
          alert.isActive
      )
    ) {
      setLatchedCriticalAlertId(null);
    }
  }, [alertsWithConnectionState, confirmedCriticalAlert, confirmedFire, latchedCriticalAlertId]);
  const latchedCriticalAlert = latchedCriticalAlertId
    ? alertsWithConnectionState.find(
        (alert) =>
          alert.id === latchedCriticalAlertId &&
          alert.status === 'new' &&
          alert.isActive
      ) || null
    : null;

  const unacknowledgedCount = latchedCriticalAlert
    ? alertsWithConnectionState.filter(
        (a) =>
          a.status === 'new' &&
          a.severity === 'critical' &&
          a.isActive
      ).length
    : 0;

  const activeCriticalAlert = latchedCriticalAlert || (confirmedFire ? confirmedCriticalAlert : null);

  const fullScreenAlert =
    activeCriticalAlert &&
    activeCriticalAlert.status === 'new' &&
    !dismissedFullScreenAlertIds.has(activeCriticalAlert.id)
      ? activeCriticalAlert
      : null;

  useEffect(() => {
    if (
      !activeCriticalAlert ||
      activeCriticalAlert.status !== 'new' ||
      !activeCriticalAlert.isActive
    ) {
      return;
    }

    if (lastUrgentToastAlertIdRef.current === activeCriticalAlert.id) return;
    lastUrgentToastAlertIdRef.current = activeCriticalAlert.id;
    showToast({
      type: 'error',
      title: 'Cảnh báo cháy khẩn cấp',
      message: `${activeCriticalAlert.areaName} - ${activeCriticalAlert.title}`,
    });
  }, [activeCriticalAlert, showToast]);

  useEffect(() => {
    const controller = new PumpAutoController(
      PUMP_AUTO_ON_DELAY_MS,
      PUMP_AUTO_OFF_DELAY_MS,
      (action) => pumpCommandRef.current(action)
    );
    pumpControllerRef.current = controller;
    return () => {
      controller.dispose();
      if (pumpControllerRef.current === controller) pumpControllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    pumpControllerRef.current?.update({ hasFire: confirmedFire, canConfirmNoFire, pumpState });
  }, [
    canConfirmNoFire,
    confirmedFire,
    latestReading?.id,
    latestReading?.timestamp,
    pumpState,
  ]);

  return (
    <FireWatchContext.Provider
      value={{
        currentAreaId,
        setCurrentAreaId,
        areas,
        devices,
        latestReading,
        alerts: alertsWithConnectionState,
        unacknowledgedCount,
        activeCriticalAlert,
        fullScreenAlert,
        currentScenario,
        changeScenario,
        isMock: fireWatchService.isMock,
        operator,
        systemStatus: {
          esp32: isEsp32Online ? 'connected' : 'disconnected',
          camera: isCameraOnline ? 'live' : 'offline',
          ai: isAiOnline ? 'online' : 'offline',
          mqtt: isMqttSynced ? 'synced' : 'disconnected',
          lastSyncTime,
          cameraFrameAgeSeconds: cameraHealth.frameAgeSeconds,
          personDetection: cameraHealth.personDetection,
        },
        toasts,
        showToast,
        dismissToast,
        dismissFullScreenAlert,
        acknowledgeAlert,
        sendDeviceCommand,
        refreshAlerts,
        refreshDevices,
      }}
    >
      {children}
    </FireWatchContext.Provider>
  );
};

export const useFireWatch = (): FireWatchContextType => {
  const context = useContext(FireWatchContext);
  if (!context) {
    throw new Error('useFireWatch phai duoc dung ben trong FireWatchProvider');
  }
  return context;
};
