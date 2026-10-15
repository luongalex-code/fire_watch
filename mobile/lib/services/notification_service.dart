import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

/// Posts Android notifications for events already received by the app.
/// This is not a background push transport.
class NotificationService {
  static const channel = MethodChannel('firewatch/notifications');
  static bool get supported => !kIsWeb && defaultTargetPlatform == TargetPlatform.android;

  static Future<bool> requestPermission() async {
    if (!supported) return false;
    try {
      return await channel.invokeMethod<bool>('requestPermission') ?? false;
    } on PlatformException {
      return false;
    } on MissingPluginException {
      return false;
    }
  }

  static Future<bool> show({required int id, required String title, required String body}) async {
    if (!supported || id <= 0) return false;
    try {
      return await channel.invokeMethod<bool>('show', {'id': id, 'title': title, 'body': body}) ?? false;
    } on PlatformException {
      return false;
    } on MissingPluginException {
      return false;
    }
  }

  static Future<void> openSettings() async {
    if (!supported) return;
    try {
      await channel.invokeMethod<void>('openSettings');
    } on PlatformException {
      // Keep in-app warnings available if Android settings cannot open.
    } on MissingPluginException {
      // Non-Android builds have no native notification channel.
    }
  }
}
