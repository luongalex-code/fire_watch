import 'dart:async';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/alert_item.dart';
import '../models/person_state.dart';
import '../models/sensor_reading.dart';
import '../services/api_service.dart';
import '../services/config_service.dart';
import '../services/websocket_service.dart';
import '../services/notification_service.dart';
import '../widgets/alert_banner.dart';
import '../widgets/mjpeg_view.dart';
import '../widgets/sensor_card.dart';

class HomeScreen extends StatefulWidget {
  final ConfigService config;
  final ApiService api;
  final WebSocketService ws;

  const HomeScreen({
    super.key,
    required this.config,
    required this.api,
    required this.ws,
  });

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  SensorReading? _latestReading;
  AlertItem? _activeAlert;
  PersonState? _latestPersonState;
  bool _isLoading = true;
  bool _isBackendReachable = true;
  DateTime? _lastFetchTime;

  // Track shown alert IDs to prevent duplicate notifications
  final Set<int> _notifiedAlertIds = <int>{};
  final Set<int> _systemNotifiedAlertIds = <int>{};
  final Set<int> _checkingAlertIds = <int>{};
  final Set<int> _postingNotificationIds = <int>{};
  late final Future<bool> _notificationReady;
  bool? _notificationsEnabled;

  StreamSubscription? _telemetrySub;
  StreamSubscription? _alertSub;
  StreamSubscription? _personSub;
  StreamSubscription? _rawEventSub;
  Timer? _pollingTimer;

  @override
  void initState() {
    super.initState();
    _notificationReady = NotificationService.requestPermission();
    _notificationReady.then((enabled) {
      if (mounted) setState(() => _notificationsEnabled = enabled);
    });
    _subscribeEvents();
    _loadInitialData();

    // Fallback polling every 5 seconds to keep data fresh and check backend health
    _pollingTimer = Timer.periodic(const Duration(seconds: 5), (_) {
      _pollData();
    });
  }

  void _subscribeEvents() {
    _rawEventSub = widget.ws.onRawEvent.listen((event) {
      if (event['type'] != 'vision_detection') return;
      final payload = event['payload'] as Map<String, dynamic>? ?? {};
      final id = int.tryParse((payload['active_alert_id'] ?? payload['alert_id'] ?? '').toString());
      if (id != null) unawaited(_checkAndNotifyAlertId(id));
    });
    _telemetrySub = widget.ws.onTelemetry.listen((reading) {
      if (mounted) {
        setState(() {
          _latestReading = reading;
          _isBackendReachable = true;
          _lastFetchTime = DateTime.now();
        });

        if (reading.alertId != null) {
          unawaited(_checkAndNotifyAlertId(reading.alertId!));
        }
      }
    });

    _alertSub = widget.ws.onAlert.listen((alert) {
      if (mounted && _matchesArea(alert)) {
        setState(() {
          if (alert.isActive) {
            _activeAlert = alert;
          } else if (_activeAlert?.id == alert.id) {
            _activeAlert = null;
          }
        });
        _checkAndNotifyAlert(alert);
      }
    });

    _personSub = widget.ws.onPersonState.listen((personState) {
      if (mounted) {
        setState(() {
          _latestPersonState = personState;
        });
      }
    });
  }

  Future<void> _loadInitialData() async {
    setState(() => _isLoading = true);
    await _pollData();
    if (mounted) {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _pollData() async {
    try {
      // 1. Fetch sensor reading
      final reading = await widget.api.getLatestReading(widget.config.areaCode);

      // 2. Fetch active alerts from backend
      final alerts = await widget.api.getActiveAlerts(areaCode: widget.config.areaCode);
      AlertItem? topActiveAlert;
      final active = alerts.where((alert) => alert.isActive && _matchesArea(alert)).toList();
      if (active.isNotEmpty) topActiveAlert = active.first;

      // 3. Fetch person state if available
      final person = await widget.api.getPersonState(widget.config.cameraId);

      if (mounted) {
        setState(() {
          _latestReading = reading;
          _activeAlert = topActiveAlert;
          if (person != null) {
            _latestPersonState = person;
          }
          _isBackendReachable = true;
          _lastFetchTime = DateTime.now();
        });

        for (final alert in active) { _checkAndNotifyAlert(alert); }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isBackendReachable = false;
        });
      }
    }
  }

  Future<void> _checkAndNotifyAlertId(int alertId) async {
    if (alertId <= 0 || _systemNotifiedAlertIds.contains(alertId) || !_checkingAlertIds.add(alertId)) return;
    try {
      final alert = await widget.api.getAlertById(alertId);
      if (mounted) _checkAndNotifyAlert(alert);
    } catch (_) {
      // The next backend event or polling cycle can retry.
    } finally { _checkingAlertIds.remove(alertId); }
  }

  bool _matchesArea(AlertItem alert) => alert.areaCode == widget.config.areaCode;

  void _checkAndNotifyAlert(AlertItem alert) {
    if (!alert.isActive || !_matchesArea(alert)) return;
    final title = 'Cảnh báo · ${alert.areaName ?? widget.config.areaName}';
    final source = alert.sourceType == 'ai' ? 'Camera phát hiện lửa/khói' : alert.sourceType == 'sensor' ? 'Cảm biến báo cháy' : alert.title;
    final message = '$source · EV-${alert.id}';
    if (_notifiedAlertIds.add(alert.id)) {
      _showInAppAlertNotification(title: title, message: message, alertId: alert.id);
    }
    if (!_systemNotifiedAlertIds.contains(alert.id) && _postingNotificationIds.add(alert.id)) {
      unawaited(_postSystemNotification(alert.id, title, message));
    }
  }

  Future<void> _postSystemNotification(int id, String title, String message) async {
    try {
      await _notificationReady;
      if (!mounted) return;
      // Re-read condition after a permission dialog: it may have cleared meanwhile.
      final latest = await widget.api.getAlertById(id);
      if (!mounted || !latest.isActive || !_matchesArea(latest)) return;
      final posted = await NotificationService.show(id: id, title: title, body: message);
      if (posted) _systemNotifiedAlertIds.add(id);
      if (mounted) setState(() => _notificationsEnabled = posted);
    } catch (_) {
      // Retain the in-app warning and retry on the next event.
    } finally { _postingNotificationIds.remove(id); }
  }

  void _showInAppAlertNotification({
    required String title,
    required String message,
    required int alertId,
  }) {
    if (!mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        duration: const Duration(seconds: 8),
        backgroundColor: const Color(0xFFDC2626),
        behavior: SnackBarBehavior.floating,
        margin: const EdgeInsets.all(16),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: const BorderSide(color: Colors.white, width: 1.5),
        ),
        content: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: const BoxDecoration(
                color: Colors.white24,
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.local_fire_department_rounded,
                color: Colors.white,
                size: 24,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: 13,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    message,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 12,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  void dispose() {
    _telemetrySub?.cancel();
    _alertSub?.cancel();
    _personSub?.cancel();
    _rawEventSub?.cancel();
    _pollingTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final reading = _latestReading;
    final isConnected = _isBackendReachable && (widget.ws.isConnected || _latestReading != null);
    final isStale = reading?.isStale ?? true;

    return Scaffold(
      backgroundColor: const Color(0xFF11141A),
      body: SafeArea(
        child: RefreshIndicator(
          color: const Color(0xFFEF4444),
          backgroundColor: const Color(0xFF1E222B),
          onRefresh: _pollData,
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              if (NotificationService.supported && _notificationsEnabled == false)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: TextButton.icon(
                      onPressed: NotificationService.openSettings,
                      icon: const Icon(Icons.notifications_off_outlined),
                      label: const Text('Chưa bật thông báo điện thoại · Mở cài đặt'),
                    ),
                  ),
                ),
              // Header Sliver
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(8),
                                decoration: BoxDecoration(
                                  gradient: const LinearGradient(
                                    colors: [Color(0xFFEF4444), Color(0xFFF97316)],
                                  ),
                                  borderRadius: BorderRadius.circular(12),
                                  boxShadow: [
                                    BoxShadow(
                                      color: const Color(0xFFEF4444).withOpacity(0.3),
                                      blurRadius: 8,
                                      offset: const Offset(0, 2),
                                    ),
                                  ],
                                ),
                                child: const Icon(
                                  Icons.local_fire_department_rounded,
                                  color: Colors.white,
                                  size: 22,
                                ),
                              ),
                              const SizedBox(width: 10),
                              const Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'FIRE-WATCH',
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontSize: 18,
                                      fontWeight: FontWeight.w900,
                                      letterSpacing: 0.8,
                                    ),
                                  ),
                                  Text(
                                    'Hệ thống giám sát nguy cơ cháy',
                                    style: TextStyle(
                                      color: Colors.white54,
                                      fontSize: 11,
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                          _buildConnectionBadge(isConnected),
                        ],
                      ),
                      const SizedBox(height: 12),
                      // Monitored Area bar
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          color: const Color(0xFF1E222B),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: Colors.white.withOpacity(0.06)),
                        ),
                        child: Row(
                          children: [
                            const Icon(
                              Icons.location_on_rounded,
                              color: Color(0xFFF97316),
                              size: 16,
                            ),
                            const SizedBox(width: 8),
                            const Text(
                              'Khu vực giám sát:',
                              style: TextStyle(
                                color: Colors.white60,
                                fontSize: 12,
                              ),
                            ),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text(
                                widget.config.areaName,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 12,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      ),
                      if (_isLoading) ...[
                        const SizedBox(height: 8),
                        const LinearProgressIndicator(
                          minHeight: 2,
                          backgroundColor: Colors.transparent,
                          valueColor: AlwaysStoppedAnimation<Color>(Color(0xFFEF4444)),
                        ),
                      ],
                      const SizedBox(height: 12),
                      // Active Alert Banner
                      AlertBanner(
                        activeAlert: _activeAlert,
                        isConnected: isConnected,
                        isStale: isStale,
                      ),
                    ],
                  ),
                ),
              ),

              // Live Camera Stream Section
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Row(
                            children: [
                              Icon(Icons.videocam_rounded, color: Colors.white70, size: 18),
                              SizedBox(width: 6),
                              Text(
                                'Camera trực tiếp (MJPEG)',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 14,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ],
                          ),
                          Text(
                            widget.config.cameraId,
                            style: const TextStyle(
                              color: Colors.white38,
                              fontSize: 11,
                              fontFamily: 'monospace',
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      MjpegView(
                        streamUrl: widget.config.cameraStreamUrl,
                        height: 210,
                      ),
                    ],
                  ),
                ),
              ),

              // Sensor Dashboard Section Title
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Row(
                        children: [
                          Icon(Icons.sensors_rounded, color: Colors.white70, size: 18),
                          SizedBox(width: 6),
                          Text(
                            'Trạng thái cảm biến IoT',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 14,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                      if (_lastFetchTime != null)
                        Text(
                          'Cập nhật: ${DateFormat('HH:mm:ss').format(_lastFetchTime!.toLocal())}',
                          style: TextStyle(
                            color: Colors.white.withOpacity(0.4),
                            fontSize: 11,
                          ),
                        ),
                    ],
                  ),
                ),
              ),

              // Sensor Cards Grid
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
                sliver: SliverGrid.count(
                  crossAxisCount: 2,
                  mainAxisSpacing: 12,
                  crossAxisSpacing: 12,
                  childAspectRatio: 1.05,
                  children: [
                    // Nhiệt độ
                    SensorCard(
                      title: 'Nhiệt độ',
                      value: reading?.temperatureC != null
                          ? reading!.temperatureC!.toStringAsFixed(1)
                          : null,
                      unit: '°C',
                      icon: Icons.thermostat_rounded,
                      accentColor: const Color(0xFFF97316),
                      isWarning: (reading?.temperatureC ?? 0) >= 50,
                      isStale: isStale,
                      statusLabel: isStale
                          ? 'Dữ liệu đã cũ'
                          : ((reading?.temperatureC ?? 0) >= 50
                              ? 'Nhiệt độ cao nguy hiểm'
                              : 'Bình thường'),
                    ),

                    // Độ ẩm
                    SensorCard(
                      title: 'Độ ẩm không khí',
                      value: reading?.humidityPercent != null
                          ? reading!.humidityPercent!.toStringAsFixed(0)
                          : null,
                      unit: '%',
                      icon: Icons.water_drop_rounded,
                      accentColor: const Color(0xFF38BDF8),
                      isWarning: false,
                      isStale: isStale,
                      statusLabel: isStale ? 'Dữ liệu đã cũ' : 'Bình thường',
                    ),

                    // Cảm biến khói MQ-2
                    SensorCard(
                      title: 'Cảm biến khói (MQ-2)',
                      value: reading?.mq2Adc != null ? '${reading!.mq2Adc}' : null,
                      unit: 'ADC',
                      icon: Icons.cloud_queue_rounded,
                      accentColor: const Color(0xFFA855F7),
                      isWarning: reading?.mq2SmokeDetected == true,
                      isStale: isStale,
                      statusLabel: isStale
                          ? 'Dữ liệu đã cũ'
                          : (reading?.mq2SmokeDetected == true
                              ? 'Phát hiện khói / gas!'
                              : 'Mức an toàn'),
                    ),

                    // Cảm biến tia lửa Flame
                    SensorCard(
                      title: 'Cảm biến ngọn lửa',
                      value: reading?.flameAdc != null ? '${reading!.flameAdc}' : null,
                      unit: 'ADC',
                      icon: Icons.local_fire_department_rounded,
                      accentColor: const Color(0xFFEF4444),
                      isWarning: reading?.flameFireDetected == true,
                      isStale: isStale,
                      statusLabel: isStale
                          ? 'Dữ liệu đã cũ'
                          : (reading?.flameFireDetected == true
                              ? 'Phát hiện ngọn lửa!'
                              : 'Không có lửa'),
                    ),
                  ],
                ),
              ),

              // Person Detection Card from Vision AI (Full width card)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                  child: Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1E222B),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: Colors.white.withOpacity(0.08)),
                    ),
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: const Color(0xFF10B981).withOpacity(0.15),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Icon(
                            Icons.person_search_rounded,
                            color: Color(0xFF10B981),
                            size: 24,
                          ),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Số người phát hiện (AI Camera)',
                                style: TextStyle(
                                  color: Colors.white70,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                _latestPersonState != null
                                    ? '${_latestPersonState!.personCount} người trong khu vực'
                                    : 'Chưa có thông tin nhận diện người',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 15,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ],
                          ),
                        ),
                        if (_latestPersonState != null)
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: const Color(0xFF10B981).withOpacity(0.2),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Text(
                              '${_latestPersonState!.personCount}',
                              style: const TextStyle(
                                color: Color(0xFF10B981),
                                fontWeight: FontWeight.bold,
                                fontSize: 16,
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildConnectionBadge(bool isConnected) {
    Color color;
    String text;

    if (!isConnected) {
      color = const Color(0xFFEF4444);
      text = 'Mất kết nối';
    } else if (widget.ws.isConnected) {
      color = const Color(0xFF10B981);
      text = 'Trực tuyến';
    } else {
      color = Colors.amber;
      text = 'Polling HTTP';
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withOpacity(0.15),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withOpacity(0.4)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 7,
            height: 7,
            decoration: BoxDecoration(shape: BoxShape.circle, color: color),
          ),
          const SizedBox(width: 6),
          Text(
            text,
            style: TextStyle(
              color: color,
              fontSize: 11,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }
}
