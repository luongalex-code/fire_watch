import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fire_watch/models/sensor_reading.dart';
import 'package:fire_watch/widgets/sensor_card.dart';

void main() {
  test('SensorReading json deserialization test', () {
    final json = {
      'id': '101',
      'areaId': 'default',
      'temperatureC': 29.5,
      'humidityPercent': 62.0,
      'flameAdc': 2300,
      'mq2Adc': 510,
      'mq2SmokeDetected': false,
      'flameFireDetected': false,
      'isStale': false,
    };

    final reading = SensorReading.fromJson(json);
    expect(reading.id, '101');
    expect(reading.areaId, 'default');
    expect(reading.temperatureC, 29.5);
    expect(reading.humidityPercent, 62.0);
    expect(reading.flameAdc, 2300);
    expect(reading.mq2Adc, 510);
    expect(reading.mq2SmokeDetected, false);
    expect(reading.flameFireDetected, false);
    expect(reading.isStale, false);
  });

  testWidgets('SensorCard renders title and value correctly', (WidgetTester tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: SensorCard(
            title: 'Nhiệt độ',
            value: '29.5',
            unit: '°C',
            icon: Icons.thermostat_rounded,
          ),
        ),
      ),
    );

    expect(find.text('Nhiệt độ'), findsOneWidget);
    expect(find.text('29.5'), findsOneWidget);
    expect(find.text('°C'), findsOneWidget);
  });
}
