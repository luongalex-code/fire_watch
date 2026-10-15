import 'package:fire_watch/models/alert_item.dart';
import 'package:fire_watch/services/notification_service.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  final calls = <MethodCall>[];
  var enabled = true;

  setUp(() {
    debugDefaultTargetPlatformOverride = TargetPlatform.android;
    enabled = true;
    calls.clear();
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(NotificationService.channel, (call) async {
      calls.add(call);
      return enabled;
    });
  });
  tearDown(() {
    debugDefaultTargetPlatformOverride = null;
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(NotificationService.channel, null);
  });

  test('requests Android permission and posts the original alert ID', () async {
    expect(await NotificationService.requestPermission(), isTrue);
    expect(await NotificationService.show(id: 1505, title: 'Cảnh báo', body: 'Camera phát hiện khói'), isTrue);
    expect(calls.map((call) => call.method), ['requestPermission', 'show']);
    expect(calls.last.arguments['id'], 1505);
  });

  test('denied permission is returned without claiming delivery', () async {
    enabled = false;
    expect(await NotificationService.requestPermission(), isFalse);
    expect(await NotificationService.show(id: 1, title: 'Cảnh báo', body: 'Khói'), isFalse);
  });

  test('invalid IDs and other platforms do not post notifications', () async {
    expect(await NotificationService.show(id: 0, title: 'x', body: 'y'), isFalse);
    debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
    expect(await NotificationService.show(id: 1, title: 'x', body: 'y'), isFalse);
    expect(calls, isEmpty);
  });

  test('cleared backend conditions must not be treated as active alerts', () {
    final alert = AlertItem.fromJson({
      'id': 1505, 'area_id': 1, 'area_code': 'default', 'status': 'open',
      'condition_cleared_at': '2026-10-15T12:00:00Z',
    });
    expect(alert.isActive, isFalse);
  });
}
