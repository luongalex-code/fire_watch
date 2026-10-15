package com.firewatch.fire_watch

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    private val channelId = "firewatch_alerts"
    private val permissionRequest = 4101
    private var permissionReply: MethodChannel.Result? = null
    private val manager get() = getSystemService(NOTIFICATION_SERVICE) as NotificationManager

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(channelId, "Cảnh báo Fire-Watch", NotificationManager.IMPORTANCE_HIGH)
            channel.description = "Cảnh báo từ khu vực đang giám sát"
            channel.enableVibration(true)
            manager.createNotificationChannel(channel)
        }
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "firewatch/notifications")
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "requestPermission" -> {
                        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                            if (permissionReply != null) result.success(false)
                            else {
                                permissionReply = result
                                requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), permissionRequest)
                            }
                        } else result.success(notificationsEnabled())
                    }
                    "isEnabled" -> result.success(notificationsEnabled())
                    "openSettings" -> {
                        startActivity(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                            .putExtra(Settings.EXTRA_APP_PACKAGE, packageName))
                        result.success(null)
                    }
                    "show" -> {
                        val id = call.argument<Number>("id")?.toInt()
                        val title = call.argument<String>("title")
                        val body = call.argument<String>("body")
                        if (id == null || id <= 0 || title.isNullOrBlank() || body == null) {
                            result.error("INVALID_NOTIFICATION", "Missing alert notification fields", null)
                        } else if (!notificationsEnabled()) result.success(false)
                        else {
                            val intent = Intent(this, MainActivity::class.java)
                                .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                                .putExtra("alert_id", id)
                            val pending = PendingIntent.getActivity(this, id, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
                            val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, channelId) else Notification.Builder(this)
                            val notification = builder.setSmallIcon(R.drawable.ic_notification_fire)
                                .setContentTitle(title).setContentText(body)
                                .setStyle(Notification.BigTextStyle().bigText(body))
                                .setCategory(Notification.CATEGORY_ALARM)
                                .setVisibility(Notification.VISIBILITY_PRIVATE)
                                .setPriority(Notification.PRIORITY_HIGH)
                                .setDefaults(Notification.DEFAULT_ALL)
                                .setAutoCancel(true).setOnlyAlertOnce(true)
                                .setContentIntent(pending).build()
                            try {
                                manager.notify(id, notification)
                                result.success(true)
                            } catch (_: SecurityException) { result.success(false) }
                        }
                    }
                    else -> result.notImplemented()
                }
            }
    }

    private fun notificationsEnabled(): Boolean {
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return false
        if (Build.VERSION.SDK_INT >= 24 && !manager.areNotificationsEnabled()) return false
        if (Build.VERSION.SDK_INT >= 26 && manager.getNotificationChannel(channelId)?.importance == NotificationManager.IMPORTANCE_NONE) return false
        return true
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == permissionRequest) {
            permissionReply?.success(notificationsEnabled())
            permissionReply = null
        }
    }

    override fun onDestroy() {
        permissionReply?.success(false)
        permissionReply = null
        super.onDestroy()
    }
}
