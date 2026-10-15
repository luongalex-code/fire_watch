class AlertItem {
  final int id;
  final int areaId;
  final String? areaCode;
  final String? areaName;
  final String sourceType;
  final String severity;
  final String status;
  final String title;
  final String? message;
  final DateTime startedAt;
  final DateTime lastDetectedAt;
  final DateTime? conditionClearedAt;
  final Map<String, dynamic>? details;

  const AlertItem({
    required this.id,
    required this.areaId,
    this.areaCode,
    this.areaName,
    required this.sourceType,
    required this.severity,
    required this.status,
    required this.title,
    this.message,
    required this.startedAt,
    required this.lastDetectedAt,
    this.conditionClearedAt,
    this.details,
  });

  bool get isActive => (status == 'open' || status == 'acknowledged') && conditionClearedAt == null;
  bool get isCritical => severity == 'critical' || severity == 'high';

  factory AlertItem.fromJson(Map<String, dynamic> json) {
    return AlertItem(
      id: int.tryParse(json['id']?.toString() ?? '') ?? 0,
      areaId: int.tryParse(json['area_id']?.toString() ?? '') ?? 0,
      areaCode: json['area_code']?.toString(),
      areaName: json['area_name']?.toString(),
      sourceType: json['source_type']?.toString() ?? 'sensor',
      severity: json['severity']?.toString() ?? 'high',
      status: json['status']?.toString() ?? 'open',
      title: json['title']?.toString() ?? 'Cảnh báo cháy',
      message: json['message']?.toString(),
      startedAt: json['started_at'] != null
          ? DateTime.tryParse(json['started_at'].toString()) ?? DateTime.now()
          : DateTime.now(),
      lastDetectedAt: json['last_detected_at'] != null
          ? DateTime.tryParse(json['last_detected_at'].toString()) ?? DateTime.now()
          : DateTime.now(),
      conditionClearedAt: json['condition_cleared_at'] != null
          ? DateTime.tryParse(json['condition_cleared_at'].toString())
          : null,
      details: json['details'] as Map<String, dynamic>?,
    );
  }
}
