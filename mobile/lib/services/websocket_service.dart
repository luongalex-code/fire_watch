import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import '../models/alert_item.dart';
import '../models/person_state.dart';
import '../models/sensor_reading.dart';
import 'config_service.dart';

enum WsConnectionStatus {
  disconnected,
  connecting,
  connected,
}

class WebSocketService extends ChangeNotifier {
  final ConfigService config;
  WebSocketChannel? _channel;
  StreamSubscription? _subscription;
  Timer? _reconnectTimer;
  Timer? _heartbeatTimer;

  WsConnectionStatus _status = WsConnectionStatus.disconnected;
  WsConnectionStatus get status => _status;
  bool get isConnected => _status == WsConnectionStatus.connected;

  // Stream controllers for typed real-time events
  final _telemetryController = StreamController<SensorReading>.broadcast();
  final _alertController = StreamController<AlertItem>.broadcast();
  final _personStateController = StreamController<PersonState>.broadcast();
  final _rawEventController = StreamController<Map<String, dynamic>>.broadcast();

  Stream<SensorReading> get onTelemetry => _telemetryController.stream;
  Stream<AlertItem> get onAlert => _alertController.stream;
  Stream<PersonState> get onPersonState => _personStateController.stream;
  Stream<Map<String, dynamic>> get onRawEvent => _rawEventController.stream;

  bool _isDisposed = false;

  WebSocketService({required this.config}) {
    config.addListener(_onConfigChanged);
    connect();
  }

  void _onConfigChanged() {
    // Reconnect if URL or network config changed
    reconnect();
  }

  void connect() {
    if (_isDisposed) return;
    if (_status == WsConnectionStatus.connecting || _status == WsConnectionStatus.connected) {
      return;
    }

    _setStatus(WsConnectionStatus.connecting);
    _cancelReconnectTimer();

    try {
      final wsUri = Uri.parse(config.wsUrl);
      _channel = WebSocketChannel.connect(wsUri);

      _subscription = _channel!.stream.listen(
        (message) {
          if (_status != WsConnectionStatus.connected) {
            _setStatus(WsConnectionStatus.connected);
          }
          _handleMessage(message);
        },
        onError: (error) {
          _handleDisconnect();
        },
        onDone: () {
          _handleDisconnect();
        },
        cancelOnError: true,
      );

      // Start pinging periodically or monitor liveness
      _heartbeatTimer?.cancel();
      _heartbeatTimer = Timer.periodic(const Duration(seconds: 15), (_) {
        if (_status == WsConnectionStatus.connected && _channel != null) {
          try {
            _channel!.sink.add('ping');
          } catch (_) {
            _handleDisconnect();
          }
        }
      });
    } catch (_) {
      _handleDisconnect();
    }
  }

  void _handleMessage(dynamic rawMessage) {
    try {
      final data = jsonDecode(rawMessage.toString()) as Map<String, dynamic>;
      final type = data['type']?.toString();
      final payload = data['payload'] as Map<String, dynamic>? ?? {};

      _rawEventController.add(data);

      if (type == 'telemetry') {
        final reading = SensorReading.fromJson(payload);
        _telemetryController.add(reading);
      } else if (type == 'alert_updated') {
        final alert = AlertItem.fromJson(payload);
        _alertController.add(alert);
      } else if (type == 'vision_detection') {
        // HomeScreen resolves the raw event ID through REST before notifying.
      } else if (type == 'person_vision_state') {
        final personState = PersonState.fromJson(payload);
        _personStateController.add(personState);
      }
    } catch (_) {
      // Ignore ill-formed JSON messages
    }
  }

  void _handleDisconnect() {
    _subscription?.cancel();
    _subscription = null;
    _channel?.sink.close();
    _channel = null;
    _heartbeatTimer?.cancel();

    if (_status != WsConnectionStatus.disconnected) {
      _setStatus(WsConnectionStatus.disconnected);
    }

    _scheduleReconnect();
  }

  void _scheduleReconnect() {
    if (_isDisposed) return;
    _cancelReconnectTimer();
    _reconnectTimer = Timer(const Duration(seconds: 4), () {
      connect();
    });
  }

  void _cancelReconnectTimer() {
    _reconnectTimer?.cancel();
    _reconnectTimer = null;
  }

  void reconnect() {
    _handleDisconnect();
    connect();
  }

  void _setStatus(WsConnectionStatus newStatus) {
    if (_status != newStatus) {
      _status = newStatus;
      notifyListeners();
    }
  }

  @override
  void dispose() {
    _isDisposed = true;
    config.removeListener(_onConfigChanged);
    _cancelReconnectTimer();
    _heartbeatTimer?.cancel();
    _subscription?.cancel();
    _channel?.sink.close();
    _telemetryController.close();
    _alertController.close();
    _personStateController.close();
    _rawEventController.close();
    super.dispose();
  }
}
