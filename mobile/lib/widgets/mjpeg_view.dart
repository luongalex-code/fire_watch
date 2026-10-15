import 'dart:async';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

class MjpegView extends StatefulWidget {
  final String streamUrl;
  final double? height;
  final BoxFit fit;

  const MjpegView({
    super.key,
    required this.streamUrl,
    this.height = 220,
    this.fit = BoxFit.cover,
  });

  @override
  State<MjpegView> createState() => _MjpegViewState();
}

class _MjpegViewState extends State<MjpegView> {
  Uint8List? _currentFrame;
  bool _isLoading = true;
  bool _hasError = false;
  String _errorMessage = '';
  http.Client? _client;
  StreamSubscription? _subscription;
  Timer? _reconnectTimer;
  bool _isDisposed = false;

  @override
  void initState() {
    super.initState();
    _startStream();
  }

  @override
  void didUpdateWidget(covariant MjpegView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.streamUrl != widget.streamUrl) {
      _restartStream();
    }
  }

  void _restartStream() {
    _stopStream();
    _startStream();
  }

  void _stopStream() {
    _reconnectTimer?.cancel();
    _subscription?.cancel();
    _subscription = null;
    _client?.close();
    _client = null;
  }

  Future<void> _startStream() async {
    if (_isDisposed) return;

    if (widget.streamUrl.trim().isEmpty) {
      setState(() {
        _isLoading = false;
        _hasError = true;
        _errorMessage = 'Chưa cấu hình URL camera';
      });
      return;
    }

    setState(() {
      _isLoading = true;
      _hasError = false;
      _errorMessage = '';
    });

    try {
      _client = http.Client();
      final request = http.Request('GET', Uri.parse(widget.streamUrl));
      request.headers['Cache-Control'] = 'no-cache';
      request.headers['Pragma'] = 'no-cache';

      final response = await _client!.send(request).timeout(const Duration(seconds: 8));

      if (response.statusCode != 200) {
        throw Exception('Mã phản hồi HTTP: ${response.statusCode}');
      }

      final buffer = BytesBuilder(copy: false);
      _subscription = response.stream.listen(
        (chunk) {
          if (_isDisposed) return;
          buffer.add(chunk);
          final bytes = buffer.toBytes();

          // Find JPEG Start Of Image (0xFF, 0xD8) and End Of Image (0xFF, 0xD9)
          int start = -1;
          for (int i = 0; i < bytes.length - 1; i++) {
            if (bytes[i] == 0xFF && bytes[i + 1] == 0xD8) {
              start = i;
              break;
            }
          }

          if (start != -1) {
            int end = -1;
            for (int i = start + 2; i < bytes.length - 1; i++) {
              if (bytes[i] == 0xFF && bytes[i + 1] == 0xD9) {
                end = i + 2;
                break;
              }
            }

            if (end != -1) {
              final frameBytes = Uint8List.sublistView(bytes, start, end);
              buffer.clear();
              if (end < bytes.length) {
                buffer.add(bytes.sublist(end));
              }

              if (mounted) {
                setState(() {
                  _currentFrame = frameBytes;
                  _isLoading = false;
                  _hasError = false;
                });
              }
            }
          }

          // Safety reset if buffer exceeds 3MB without valid JPEG frame
          if (buffer.length > 3 * 1024 * 1024) {
            buffer.clear();
          }
        },
        onError: (err) {
          _handleStreamError('Lỗi luồng: $err');
        },
        onDone: () {
          _handleStreamError('Luồng camera đã kết thúc');
        },
        cancelOnError: true,
      );
    } catch (e) {
      _handleStreamError('Không thể kết nối camera: $e');
    }
  }

  void _handleStreamError(String message) {
    if (_isDisposed || !mounted) return;
    setState(() {
      _isLoading = false;
      _hasError = true;
      _errorMessage = 'Mất kết nối camera stream';
    });

    _reconnectTimer?.cancel();
    _reconnectTimer = Timer(const Duration(seconds: 4), () {
      if (mounted && !_isDisposed) {
        _startStream();
      }
    });
  }

  @override
  void dispose() {
    _isDisposed = true;
    _stopStream();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: widget.height,
      width: double.infinity,
      decoration: BoxDecoration(
        color: const Color(0xFF1E222B),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: _hasError ? Colors.red.withOpacity(0.4) : Colors.white12,
          width: 1.5,
        ),
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        fit: StackFit.expand,
        children: [
          if (_currentFrame != null && !_hasError)
            Image.memory(
              _currentFrame!,
              fit: widget.fit,
              gaplessPlayback: true,
            ),
          if (_isLoading && _currentFrame == null)
            Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const SizedBox(
                    width: 32,
                    height: 32,
                    child: CircularProgressIndicator(
                      strokeWidth: 3,
                      valueColor: AlwaysStoppedAnimation<Color>(Colors.orangeAccent),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'Đang kết nối camera trực tiếp...',
                    style: TextStyle(
                      color: Colors.white.withOpacity(0.8),
                      fontSize: 13,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    widget.streamUrl,
                    style: TextStyle(
                      color: Colors.white.withOpacity(0.4),
                      fontSize: 11,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          if (_hasError)
            Center(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.red.withOpacity(0.15),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.videocam_off_rounded,
                        color: Colors.redAccent,
                        size: 36,
                      ),
                    ),
                    const SizedBox(height: 10),
                    const Text(
                      'Mất kết nối camera',
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 14,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _errorMessage.isNotEmpty
                          ? _errorMessage
                          : 'Kiểm tra service fire_ai hoặc IP LAN tại trang Tài khoản',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: Colors.white.withOpacity(0.6),
                        fontSize: 12,
                      ),
                    ),
                    const SizedBox(height: 10),
                    ElevatedButton.icon(
                      onPressed: _restartStream,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.white12,
                        foregroundColor: Colors.white,
                        elevation: 0,
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8),
                        ),
                      ),
                      icon: const Icon(Icons.refresh, size: 16),
                      label: const Text('Thử lại', style: TextStyle(fontSize: 12)),
                    ),
                  ],
                ),
              ),
            ),
          // Live status badge overlay on top left
          Positioned(
            top: 12,
            left: 12,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                color: Colors.black.withOpacity(0.65),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: Colors.white12),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: (!_hasError && _currentFrame != null)
                          ? const Color(0xFF00E676)
                          : (_isLoading ? Colors.amber : Colors.red),
                    ),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    (!_hasError && _currentFrame != null) ? 'TRỰC TIẾP' : (_isLoading ? 'ĐANG TẢI' : 'MẤT KẾT NỐI'),
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 0.5,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
