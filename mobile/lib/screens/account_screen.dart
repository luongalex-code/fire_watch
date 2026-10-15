import 'package:flutter/material.dart';
import '../models/user_profile.dart';
import '../services/api_service.dart';
import '../services/config_service.dart';
import '../services/websocket_service.dart';

class AccountScreen extends StatefulWidget {
  final ConfigService config;
  final ApiService api;
  final WebSocketService ws;

  const AccountScreen({
    super.key,
    required this.config,
    required this.api,
    required this.ws,
  });

  @override
  State<AccountScreen> createState() => _AccountScreenState();
}

class _AccountScreenState extends State<AccountScreen> {
  // Login form controllers
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isLoggingIn = false;
  String? _loginError;

  // LAN network configuration controllers
  late final TextEditingController _backendUrlController;
  late final TextEditingController _cameraStreamUrlController;
  late final TextEditingController _areaCodeController;
  late final TextEditingController _areaNameController;
  late final TextEditingController _cameraIdController;

  bool _isTestingConnection = false;
  String? _testConnectionResult;
  bool? _isConnectionSuccess;

  @override
  void initState() {
    super.initState();
    _backendUrlController = TextEditingController(text: widget.config.backendUrl);
    _cameraStreamUrlController = TextEditingController(text: widget.config.cameraStreamUrl);
    _areaCodeController = TextEditingController(text: widget.config.areaCode);
    _areaNameController = TextEditingController(text: widget.config.areaName);
    _cameraIdController = TextEditingController(text: widget.config.cameraId);
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _backendUrlController.dispose();
    _cameraStreamUrlController.dispose();
    _areaCodeController.dispose();
    _areaNameController.dispose();
    _cameraIdController.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    final email = _emailController.text.trim();
    final password = _passwordController.text;

    if (email.isEmpty || password.isEmpty) {
      setState(() => _loginError = 'Vui lòng nhập đầy đủ email và mật khẩu');
      return;
    }

    setState(() {
      _isLoggingIn = true;
      _loginError = null;
    });

    try {
      final user = await widget.api.login(email, password);
      await widget.config.saveUserSession(user);
      _passwordController.clear();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: const Color(0xFF10B981),
            content: Text('Đăng nhập thành công: ${user.fullName ?? user.email}'),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _loginError = e.toString().replaceFirst('Exception: ', '');
        });
      }
    } finally {
      if (mounted) {
        setState(() => _isLoggingIn = false);
      }
    }
  }

  Future<void> _handleLogout() async {
    await widget.config.clearUserSession();
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Đã đăng xuất khỏi tài khoản'),
        ),
      );
    }
  }

  Future<void> _handleSaveConfig() async {
    final backend = _backendUrlController.text.trim();
    final camera = _cameraStreamUrlController.text.trim();

    if (backend.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Địa chỉ Backend không được để trống')),
      );
      return;
    }

    await widget.config.updateNetworkConfig(
      backendUrl: backend,
      cameraStreamUrl: camera,
      areaCode: _areaCodeController.text.trim(),
      areaName: _areaNameController.text.trim(),
      cameraId: _cameraIdController.text.trim(),
    );

    widget.ws.reconnect();

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          backgroundColor: Color(0xFF10B981),
          content: Text('Đã lưu cấu hình mạng LAN thành công!'),
        ),
      );
    }
  }

  Future<void> _handleTestConnection() async {
    setState(() {
      _isTestingConnection = true;
      _testConnectionResult = null;
      _isConnectionSuccess = null;
    });

    // Temporarily save to test
    await widget.config.updateNetworkConfig(
      backendUrl: _backendUrlController.text.trim(),
      cameraStreamUrl: _cameraStreamUrlController.text.trim(),
    );

    final ok = await widget.api.checkHealth();

    if (mounted) {
      setState(() {
        _isTestingConnection = false;
        _isConnectionSuccess = ok;
        _testConnectionResult = ok
            ? 'Kết nối backend thành công (HTTP 200 OK)'
            : 'Không thể kết nối! Kiểm tra IP máy tính và đảm bảo backend đang chạy.';
      });
    }
  }

  void _applyPreset(String ip) {
    setState(() {
      _backendUrlController.text = 'http://$ip:8000';
      _cameraStreamUrlController.text = 'http://$ip:8090/stream';
    });
  }

  @override
  Widget build(BuildContext context) {
    final user = widget.config.currentUser;

    return Scaffold(
      backgroundColor: const Color(0xFF11141A),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header
              const Row(
                children: [
                  Icon(Icons.manage_accounts_rounded, color: Color(0xFFEF4444), size: 28),
                  SizedBox(width: 10),
                  Text(
                    'Tài khoản & Cấu hình',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // Account Information Section
              _buildSectionTitle('Thông tin người dùng', Icons.person_rounded),
              const SizedBox(height: 10),
              if (user != null) _buildLoggedInCard(user) else _buildLoginForm(),

              const SizedBox(height: 24),

              // LAN Configuration Section
              _buildSectionTitle('Cấu hình mạng LAN (Điện thoại kết nối Backend)', Icons.wifi_rounded),
              const SizedBox(height: 6),
              const Text(
                'Điện thoại và máy tính cần chung mạng Wi-Fi/LAN. Nhập địa chỉ IP máy tính (VD: 192.168.1.x) thay vì 127.0.0.1.',
                style: TextStyle(color: Colors.white54, fontSize: 12),
              ),
              const SizedBox(height: 12),
              _buildLanConfigCard(),

              const SizedBox(height: 24),

              // App Information & Background Notification Note
              _buildSectionTitle('Thông tin hệ thống Fire-Watch', Icons.info_outline_rounded),
              const SizedBox(height: 10),
              _buildAppInfoCard(),
              const SizedBox(height: 20),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSectionTitle(String title, IconData icon) {
    return Row(
      children: [
        Icon(icon, color: const Color(0xFFF97316), size: 18),
        const SizedBox(width: 8),
        Text(
          title,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 15,
            fontWeight: FontWeight.bold,
          ),
        ),
      ],
    );
  }

  Widget _buildLoggedInCard(UserProfile user) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1E222B),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withOpacity(0.08)),
      ),
      child: Column(
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 28,
                backgroundColor: const Color(0xFFEF4444).withOpacity(0.2),
                child: Text(
                  (user.fullName?.isNotEmpty == true
                          ? user.fullName![0]
                          : user.email[0])
                      .toUpperCase(),
                  style: const TextStyle(
                    color: Color(0xFFEF4444),
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      user.fullName ?? 'Người vận hành',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      user.email,
                      style: const TextStyle(
                        color: Colors.white70,
                        fontSize: 13,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: const Color(0xFF3B82F6).withOpacity(0.2),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        'Vai trò: ${user.role.toUpperCase()}',
                        style: const TextStyle(
                          color: Color(0xFF60A5FA),
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          const Divider(color: Colors.white12),
          const SizedBox(height: 8),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: _handleLogout,
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(0xFFEF4444),
                side: const BorderSide(color: Color(0xFFEF4444)),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                padding: const EdgeInsets.symmetric(vertical: 10),
              ),
              icon: const Icon(Icons.logout_rounded, size: 18),
              label: const Text('Đăng xuất'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLoginForm() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1E222B),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withOpacity(0.08)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Đăng nhập tài khoản hệ thống',
            style: TextStyle(
              color: Colors.white,
              fontSize: 14,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            'Sử dụng tài khoản đã đăng ký trên backend để xác thực người giám sát.',
            style: TextStyle(color: Colors.white54, fontSize: 12),
          ),
          const SizedBox(height: 14),
          TextField(
            controller: _emailController,
            keyboardType: TextInputType.emailAddress,
            style: const TextStyle(color: Colors.white, fontSize: 13),
            decoration: _inputDecoration('Email', Icons.email_outlined),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _passwordController,
            obscureText: true,
            style: const TextStyle(color: Colors.white, fontSize: 13),
            decoration: _inputDecoration('Mật khẩu', Icons.lock_outline_rounded),
          ),
          if (_loginError != null) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Colors.red.withOpacity(0.15),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  const Icon(Icons.error_outline, color: Colors.redAccent, size: 16),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      _loginError!,
                      style: const TextStyle(color: Colors.redAccent, fontSize: 12),
                    ),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: _isLoggingIn ? null : _handleLogin,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFEF4444),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                padding: const EdgeInsets.symmetric(vertical: 12),
              ),
              icon: _isLoggingIn
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : const Icon(Icons.login_rounded, size: 18),
              label: Text(
                _isLoggingIn ? 'Đang xác thực...' : 'Đăng nhập',
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLanConfigCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1E222B),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withOpacity(0.08)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Quick presets
          const Text(
            'Chọn nhanh mẫu địa chỉ:',
            style: TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 6,
            children: [
              _presetChip('Android Emulator (10.0.2.2)', () => _applyPreset('10.0.2.2')),
              _presetChip('Wi-Fi LAN (192.168.1.100)', () => _applyPreset('192.168.1.100')),
              _presetChip('Localhost (127.0.0.1)', () => _applyPreset('127.0.0.1')),
            ],
          ),
          const SizedBox(height: 14),

          // Backend URL
          const Text('Địa chỉ Backend API:', style: TextStyle(color: Colors.white70, fontSize: 12)),
          const SizedBox(height: 4),
          TextField(
            controller: _backendUrlController,
            style: const TextStyle(color: Colors.white, fontSize: 13, fontFamily: 'monospace'),
            decoration: _inputDecoration('http://<IP_MAY_TINH>:8000', Icons.dns_rounded),
          ),
          const SizedBox(height: 12),

          // Camera Stream URL
          const Text('Luồng Camera MJPEG (Port 8090):', style: TextStyle(color: Colors.white70, fontSize: 12)),
          const SizedBox(height: 4),
          TextField(
            controller: _cameraStreamUrlController,
            style: const TextStyle(color: Colors.white, fontSize: 13, fontFamily: 'monospace'),
            decoration: _inputDecoration('http://<IP_MAY_TINH>:8090/stream', Icons.videocam_rounded),
          ),
          const SizedBox(height: 12),

          // Area Code & Area Name
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Mã khu vực:', style: TextStyle(color: Colors.white70, fontSize: 12)),
                    const SizedBox(height: 4),
                    TextField(
                      controller: _areaCodeController,
                      style: const TextStyle(color: Colors.white, fontSize: 13),
                      decoration: _inputDecoration('default', Icons.tag_rounded),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Mã Camera:', style: TextStyle(color: Colors.white70, fontSize: 12)),
                    const SizedBox(height: 4),
                    TextField(
                      controller: _cameraIdController,
                      style: const TextStyle(color: Colors.white, fontSize: 13),
                      decoration: _inputDecoration('camera-01', Icons.camera_alt_outlined),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          const Text('Tên khu vực hiển thị:', style: TextStyle(color: Colors.white70, fontSize: 12)),
          const SizedBox(height: 4),
          TextField(
            controller: _areaNameController,
            style: const TextStyle(color: Colors.white, fontSize: 13),
            decoration: _inputDecoration('Phòng Thủ Dầu Một', Icons.location_city_rounded),
          ),
          const SizedBox(height: 16),

          // Test Connection Result
          if (_testConnectionResult != null) ...[
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: _isConnectionSuccess == true
                    ? const Color(0xFF10B981).withOpacity(0.15)
                    : const Color(0xFFEF4444).withOpacity(0.15),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: _isConnectionSuccess == true
                      ? const Color(0xFF10B981).withOpacity(0.4)
                      : const Color(0xFFEF4444).withOpacity(0.4),
                ),
              ),
              child: Row(
                children: [
                  Icon(
                    _isConnectionSuccess == true ? Icons.check_circle : Icons.error,
                    color: _isConnectionSuccess == true ? const Color(0xFF10B981) : const Color(0xFFEF4444),
                    size: 18,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      _testConnectionResult!,
                      style: TextStyle(
                        color: _isConnectionSuccess == true ? const Color(0xFF10B981) : const Color(0xFFEF4444),
                        fontSize: 12,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
          ],

          // Action Buttons: Test Connection & Save
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _isTestingConnection ? null : _handleTestConnection,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.white70,
                    side: const BorderSide(color: Colors.white24),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                  icon: _isTestingConnection
                      ? const SizedBox(
                          width: 14,
                          height: 14,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white70),
                        )
                      : const Icon(Icons.network_check_rounded, size: 18),
                  label: const Text('Thử kết nối', style: TextStyle(fontSize: 13)),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: _handleSaveConfig,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF3B82F6),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                  icon: const Icon(Icons.save_rounded, size: 18),
                  label: const Text('Lưu cấu hình', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _presetChip(String label, VoidCallback onTap) {
    return ActionChip(
      onPressed: onTap,
      label: Text(label),
      labelStyle: const TextStyle(color: Colors.white70, fontSize: 11),
      backgroundColor: Colors.white.withOpacity(0.06),
      side: BorderSide(color: Colors.white.withOpacity(0.1)),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 0),
    );
  }

  Widget _buildAppInfoCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1E222B),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withOpacity(0.08)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _infoRow('Ứng dụng', 'Fire-Watch Mobile Client (Giám sát)'),
          const SizedBox(height: 8),
          _infoRow('Phiên bản', 'v1.0.0 (Flutter 3 / Dart 3)'),
          const SizedBox(height: 8),
          _infoRow('Luồng kết nối', 'REST API + WebSocket (/ws) + MJPEG (8090)'),
          const SizedBox(height: 8),
          _infoRow('Trạng thái điều khiển', 'Chế độ chỉ đọc (Read-only monitoring)'),
          const SizedBox(height: 12),
          const Divider(color: Colors.white12),
          const SizedBox(height: 10),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.notifications_active_outlined, color: Colors.amber, size: 18),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Cơ chế thông báo cảnh báo:',
                      style: TextStyle(
                        color: Colors.amber,
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '• Bật quyền thông báo để cảnh báo xuất hiện trên thanh thông báo Android. Chạm thông báo để mở lại ứng dụng.\n'
                      '• Ứng dụng phải còn kết nối để nhận cảnh báo mới. Nhận cảnh báo khi ứng dụng đã bị đóng hẳn chưa được hỗ trợ.',
                      style: TextStyle(
                        color: Colors.white.withOpacity(0.7),
                        fontSize: 11,
                        height: 1.4,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _infoRow(String label, String value) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 110,
          child: Text(
            label,
            style: const TextStyle(color: Colors.white54, fontSize: 12),
          ),
        ),
        Expanded(
          child: Text(
            value,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 12,
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
      ],
    );
  }

  InputDecoration _inputDecoration(String hint, IconData icon) {
    return InputDecoration(
      isDense: true,
      hintText: hint,
      hintStyle: const TextStyle(color: Colors.white30, fontSize: 12),
      prefixIcon: Icon(icon, color: Colors.white54, size: 18),
      filled: true,
      fillColor: const Color(0xFF14171E),
      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: BorderSide(color: Colors.white.withOpacity(0.1)),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: BorderSide(color: Colors.white.withOpacity(0.1)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Color(0xFF3B82F6), width: 1.5),
      ),
    );
  }
}
