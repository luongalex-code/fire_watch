import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/user_profile.dart';

class ConfigService extends ChangeNotifier {
  static const String _keyBackendUrl = 'config_backend_url';
  static const String _keyCameraStreamUrl = 'config_camera_stream_url';
  static const String _keyAreaCode = 'config_area_code';
  static const String _keyAreaName = 'config_area_name';
  static const String _keyCameraId = 'config_camera_id';
  static const String _keyUserSession = 'config_user_session';

  // Sane defaults for Android emulator / mobile development
  // 10.0.2.2 is host loopback for Android emulator, but user can easily configure LAN IP like 192.168.1.x
  static const String defaultBackendUrl = 'http://10.0.2.2:8000';
  static const String defaultCameraStreamUrl = 'http://10.0.2.2:8090/stream';
  static const String defaultAreaCode = 'default';
  static const String defaultAreaName = 'Phòng Thủ Dầu Một';
  static const String defaultCameraId = 'camera-01';

  late SharedPreferences _prefs;
  bool _initialized = false;

  String _backendUrl = defaultBackendUrl;
  String _cameraStreamUrl = defaultCameraStreamUrl;
  String _areaCode = defaultAreaCode;
  String _areaName = defaultAreaName;
  String _cameraId = defaultCameraId;
  UserProfile? _currentUser;

  bool get isInitialized => _initialized;
  String get backendUrl => _backendUrl;
  String get cameraStreamUrl => _cameraStreamUrl;
  String get areaCode => _areaCode;
  String get areaName => _areaName;
  String get cameraId => _cameraId;
  UserProfile? get currentUser => _currentUser;
  bool get isLoggedIn => _currentUser != null;

  String get wsUrl {
    final clean = _backendUrl.trim().replaceAll(RegExp(r'/+$'), '');
    if (clean.startsWith('https://')) {
      return 'wss://${clean.substring(8)}/ws';
    } else if (clean.startsWith('http://')) {
      return 'ws://${clean.substring(7)}/ws';
    }
    return 'ws://$clean/ws';
  }

  Future<void> init() async {
    _prefs = await SharedPreferences.getInstance();
    _backendUrl = _prefs.getString(_keyBackendUrl) ?? defaultBackendUrl;
    _cameraStreamUrl = _prefs.getString(_keyCameraStreamUrl) ?? defaultCameraStreamUrl;
    _areaCode = _prefs.getString(_keyAreaCode) ?? defaultAreaCode;
    _areaName = _prefs.getString(_keyAreaName) ?? defaultAreaName;
    _cameraId = _prefs.getString(_keyCameraId) ?? defaultCameraId;

    final userJson = _prefs.getString(_keyUserSession);
    if (userJson != null && userJson.isNotEmpty) {
      try {
        _currentUser = UserProfile.fromJson(jsonDecode(userJson) as Map<String, dynamic>);
      } catch (_) {
        _currentUser = null;
      }
    }

    _initialized = true;
    notifyListeners();
  }

  Future<void> updateNetworkConfig({
    required String backendUrl,
    required String cameraStreamUrl,
    String? areaCode,
    String? areaName,
    String? cameraId,
  }) async {
    _backendUrl = backendUrl.trim().replaceAll(RegExp(r'/+$'), '');
    _cameraStreamUrl = cameraStreamUrl.trim();
    if (areaCode != null && areaCode.trim().isNotEmpty) {
      _areaCode = areaCode.trim();
    }
    if (areaName != null && areaName.trim().isNotEmpty) {
      _areaName = areaName.trim();
    }
    if (cameraId != null && cameraId.trim().isNotEmpty) {
      _cameraId = cameraId.trim();
    }

    await _prefs.setString(_keyBackendUrl, _backendUrl);
    await _prefs.setString(_keyCameraStreamUrl, _cameraStreamUrl);
    await _prefs.setString(_keyAreaCode, _areaCode);
    await _prefs.setString(_keyAreaName, _areaName);
    await _prefs.setString(_keyCameraId, _cameraId);

    notifyListeners();
  }

  Future<void> saveUserSession(UserProfile user) async {
    _currentUser = user;
    await _prefs.setString(_keyUserSession, jsonEncode(user.toJson()));
    notifyListeners();
  }

  Future<void> clearUserSession() async {
    _currentUser = null;
    await _prefs.remove(_keyUserSession);
    notifyListeners();
  }
}
