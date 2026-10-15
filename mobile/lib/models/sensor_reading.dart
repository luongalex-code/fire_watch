class SensorReading {
  final String id;
  final String areaId;
  final DateTime timestamp;
  final double? temperatureC;
  final double? humidityPercent;
  final int? flameAdc;
  final int? mq2Adc;
  final bool? mq2SmokeDetected;
  final bool flameFireDetected;
  final bool isStale;
  final int? alertId;

  const SensorReading({
    required this.id,
    required this.areaId,
    required this.timestamp,
    this.temperatureC,
    this.humidityPercent,
    this.flameAdc,
    this.mq2Adc,
    this.mq2SmokeDetected,
    this.flameFireDetected = false,
    this.isStale = false,
    this.alertId,
  });

  factory SensorReading.fromJson(Map<String, dynamic> json) {
    return SensorReading(
      id: json['id']?.toString() ?? '',
      areaId: json['areaId']?.toString() ?? json['area_code']?.toString() ?? 'default',
      timestamp: json['timestamp'] != null
          ? DateTime.tryParse(json['timestamp'].toString()) ?? DateTime.now()
          : (json['measured_at'] != null
              ? DateTime.tryParse(json['measured_at'].toString()) ?? DateTime.now()
              : DateTime.now()),
      temperatureC: (json['temperatureC'] ?? json['temperature_c']) != null
          ? double.tryParse(json['temperatureC']?.toString() ?? json['temperature_c']?.toString() ?? '')
          : null,
      humidityPercent: (json['humidityPercent'] ?? json['humidity_percent']) != null
          ? double.tryParse(json['humidityPercent']?.toString() ?? json['humidity_percent']?.toString() ?? '')
          : null,
      flameAdc: json['flameAdc'] != null
          ? int.tryParse(json['flameAdc'].toString())
          : (json['flame_adc'] != null ? int.tryParse(json['flame_adc'].toString()) : null),
      mq2Adc: json['mq2Adc'] != null
          ? int.tryParse(json['mq2Adc'].toString())
          : (json['mq2_adc'] != null ? int.tryParse(json['mq2_adc'].toString()) : null),
      mq2SmokeDetected: json['mq2SmokeDetected'] as bool? ?? json['mq2_smoke_detected'] as bool?,
      flameFireDetected: json['flameFireDetected'] == true || json['fire_state'] == 'fire',
      isStale: json['isStale'] == true || json['is_stale'] == true,
      alertId: json['alertId'] != null
          ? int.tryParse(json['alertId'].toString())
          : (json['alert_id'] != null ? int.tryParse(json['alert_id'].toString()) : null),
    );
  }

  factory SensorReading.empty(String areaId) {
    return SensorReading(
      id: 'empty',
      areaId: areaId,
      timestamp: DateTime.now(),
      isStale: true,
    );
  }
}
