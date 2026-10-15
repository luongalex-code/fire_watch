class PersonState {
  final String cameraId;
  final int personCount;
  final String status;
  final DateTime updatedAt;

  const PersonState({
    required this.cameraId,
    required this.personCount,
    required this.status,
    required this.updatedAt,
  });

  factory PersonState.fromJson(Map<String, dynamic> json) {
    return PersonState(
      cameraId: json['camera_id']?.toString() ?? json['camera_code']?.toString() ?? 'camera-01',
      personCount: int.tryParse(json['person_count']?.toString() ?? '0') ?? 0,
      status: json['status']?.toString() ?? 'ok',
      updatedAt: json['updated_at'] != null
          ? DateTime.tryParse(json['updated_at'].toString()) ?? DateTime.now()
          : (json['frame_at'] != null
              ? DateTime.tryParse(json['frame_at'].toString()) ?? DateTime.now()
              : DateTime.now()),
    );
  }
}
