import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/alert_item.dart';
import '../models/person_state.dart';
import '../models/sensor_reading.dart';
import '../models/user_profile.dart';
import 'config_service.dart';

class ApiService {
  final ConfigService config;
  final http.Client _client = http.Client();

  ApiService({required this.config});

  String get _baseUrl => config.backendUrl.replaceAll(RegExp(r'/+$'), '');

  Future<SensorReading> getLatestReading(String areaId) async {
    final uri = Uri.parse('$_baseUrl/api/sensors/latest?areaId=${Uri.encodeComponent(areaId)}');
    final response = await _client.get(uri).timeout(const Duration(seconds: 5));

    if (response.statusCode == 200) {
      final json = jsonDecode(utf8.decode(response.bodyBytes)) as Map<String, dynamic>;
      return SensorReading.fromJson(json);
    } else {
      throw Exception('Không thể tải dữ liệu cảm biến: HTTP ${response.statusCode}');
    }
  }

  Future<List<AlertItem>> getActiveAlerts({String? areaCode}) async {
    final queryParams = <String, String>{'status': 'open', 'limit': '20'};
    if (areaCode != null && areaCode.isNotEmpty) {
      queryParams['area_code'] = areaCode;
    }

    final uri = Uri.parse('$_baseUrl/api/alerts').replace(queryParameters: queryParams);
    final response = await _client.get(uri).timeout(const Duration(seconds: 5));

    if (response.statusCode == 200) {
      final list = jsonDecode(utf8.decode(response.bodyBytes)) as List<dynamic>;
      return list.map((item) => AlertItem.fromJson(item as Map<String, dynamic>)).toList();
    } else {
      throw Exception('Không thể tải danh sách cảnh báo: HTTP ${response.statusCode}');
    }
  }

  Future<AlertItem> getAlertById(int id) async {
    final response = await _client.get(Uri.parse('$_baseUrl/api/alerts/$id'))
        .timeout(const Duration(seconds: 5));
    if (response.statusCode != 200) {
      throw Exception('Không thể tải cảnh báo: HTTP ${response.statusCode}');
    }
    return AlertItem.fromJson(jsonDecode(utf8.decode(response.bodyBytes)) as Map<String, dynamic>);
  }

  Future<PersonState?> getPersonState(String cameraId) async {
    try {
      final uri = Uri.parse('$_baseUrl/api/vision/person-state/${Uri.encodeComponent(cameraId)}');
      final response = await _client.get(uri).timeout(const Duration(seconds: 4));

      if (response.statusCode == 200) {
        final json = jsonDecode(utf8.decode(response.bodyBytes)) as Map<String, dynamic>;
        return PersonState.fromJson(json);
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  Future<List<Map<String, dynamic>>> getAreas() async {
    final uri = Uri.parse('$_baseUrl/api/areas');
    final response = await _client.get(uri).timeout(const Duration(seconds: 5));

    if (response.statusCode == 200) {
      final list = jsonDecode(utf8.decode(response.bodyBytes)) as List<dynamic>;
      return list.cast<Map<String, dynamic>>();
    }
    return [];
  }

  Future<UserProfile> login(String email, String password) async {
    final uri = Uri.parse('$_baseUrl/api/auth/login');
    final response = await _client.post(
      uri,
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'email': email.trim(), 'password': password}),
    ).timeout(const Duration(seconds: 7));

    if (response.statusCode == 200) {
      final json = jsonDecode(utf8.decode(response.bodyBytes)) as Map<String, dynamic>;
      final userJson = json['user'] as Map<String, dynamic>?;
      if (userJson != null) {
        return UserProfile.fromJson(userJson);
      }
      throw Exception('Phản hồi đăng nhập không hợp lệ');
    } else {
      final errorJson = jsonDecode(utf8.decode(response.bodyBytes)) as Map<String, dynamic>?;
      final detail = errorJson?['detail']?.toString() ?? 'Đăng nhập thất bại (${response.statusCode})';
      throw Exception(detail);
    }
  }

  Future<bool> checkHealth() async {
    try {
      final uri = Uri.parse('$_baseUrl/api/health');
      final response = await _client.get(uri).timeout(const Duration(seconds: 3));
      return response.statusCode == 200;
    } catch (_) {
      // Fallback check areas
      try {
        final uri = Uri.parse('$_baseUrl/api/areas');
        final response = await _client.get(uri).timeout(const Duration(seconds: 3));
        return response.statusCode == 200;
      } catch (_) {
        return false;
      }
    }
  }
}
