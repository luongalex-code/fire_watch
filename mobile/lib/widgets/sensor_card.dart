import 'package:flutter/material.dart';

class SensorCard extends StatelessWidget {
  final String title;
  final String? value;
  final String? unit;
  final IconData icon;
  final Color accentColor;
  final bool isWarning;
  final bool isStale;
  final String? statusLabel;

  const SensorCard({
    super.key,
    required this.title,
    this.value,
    this.unit,
    required this.icon,
    this.accentColor = const Color(0xFF3B82F6),
    this.isWarning = false,
    this.isStale = false,
    this.statusLabel,
  });

  @override
  Widget build(BuildContext context) {
    final effectiveColor = isWarning
        ? const Color(0xFFEF4444)
        : (isStale ? const Color(0xFF9CA3AF) : accentColor);

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF1E222B),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isWarning
              ? const Color(0xFFEF4444).withOpacity(0.8)
              : Colors.white.withOpacity(0.08),
          width: isWarning ? 1.8 : 1.0,
        ),
        boxShadow: isWarning
            ? [
                BoxShadow(
                  color: const Color(0xFFEF4444).withOpacity(0.25),
                  blurRadius: 12,
                  spreadRadius: 1,
                )
              ]
            : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: effectiveColor.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(
                  icon,
                  color: effectiveColor,
                  size: 20,
                ),
              ),
              if (isWarning)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEF4444).withOpacity(0.2),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: const Color(0xFFEF4444).withOpacity(0.5)),
                  ),
                  child: const Text(
                    'BÁO ĐỘNG',
                    style: TextStyle(
                      color: Color(0xFFEF4444),
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                )
              else if (isStale)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                  decoration: BoxDecoration(
                    color: Colors.amber.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: const Text(
                    'Dữ liệu cũ',
                    style: TextStyle(
                      color: Colors.amber,
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            title,
            style: TextStyle(
              color: Colors.white.withOpacity(0.7),
              fontSize: 12,
              fontWeight: FontWeight.w500,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 4),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(
                value ?? '--',
                style: TextStyle(
                  color: isStale && value != null ? Colors.white60 : Colors.white,
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                  letterSpacing: -0.5,
                ),
              ),
              if (unit != null && unit!.isNotEmpty) ...[
                const SizedBox(width: 4),
                Text(
                  unit!,
                  style: TextStyle(
                    color: Colors.white.withOpacity(0.6),
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 6),
          if (statusLabel != null)
            Text(
              statusLabel!,
              style: TextStyle(
                color: isWarning
                    ? const Color(0xFFEF4444)
                    : (isStale ? Colors.amber : Colors.white.withOpacity(0.5)),
                fontSize: 11,
                fontWeight: isWarning ? FontWeight.bold : FontWeight.normal,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
        ],
      ),
    );
  }
}
