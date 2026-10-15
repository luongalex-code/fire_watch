import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'screens/account_screen.dart';
import 'screens/home_screen.dart';
import 'services/api_service.dart';
import 'services/config_service.dart';
import 'services/websocket_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Dark navigation & status bar style
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
      systemNavigationBarColor: Color(0xFF11141A),
      systemNavigationBarIconBrightness: Brightness.light,
    ),
  );

  final configService = ConfigService();
  await configService.init();

  final apiService = ApiService(config: configService);
  final webSocketService = WebSocketService(config: configService);

  runApp(FireWatchApp(
    config: configService,
    api: apiService,
    ws: webSocketService,
  ));
}

class FireWatchApp extends StatelessWidget {
  final ConfigService config;
  final ApiService api;
  final WebSocketService ws;

  const FireWatchApp({
    super.key,
    required this.config,
    required this.api,
    required this.ws,
  });

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Fire-Watch',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF11141A),
        primaryColor: const Color(0xFFEF4444),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFFEF4444),
          secondary: Color(0xFFF97316),
          surface: Color(0xFF1E222B),
        ),
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xFF11141A),
          elevation: 0,
        ),
        useMaterial3: true,
      ),
      home: MainNavigationContainer(
        config: config,
        api: api,
        ws: ws,
      ),
    );
  }
}

class MainNavigationContainer extends StatefulWidget {
  final ConfigService config;
  final ApiService api;
  final WebSocketService ws;

  const MainNavigationContainer({
    super.key,
    required this.config,
    required this.api,
    required this.ws,
  });

  @override
  State<MainNavigationContainer> createState() => _MainNavigationContainerState();
}

class _MainNavigationContainerState extends State<MainNavigationContainer> {
  int _currentIndex = 0;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF11141A),
      body: IndexedStack(
        index: _currentIndex,
        children: [
          HomeScreen(
            config: widget.config,
            api: widget.api,
            ws: widget.ws,
          ),
          AccountScreen(
            config: widget.config,
            api: widget.api,
            ws: widget.ws,
          ),
        ],
      ),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: const Color(0xFF171A21),
          border: Border(
            top: BorderSide(
              color: Colors.white.withOpacity(0.08),
              width: 1,
            ),
          ),
        ),
        child: NavigationBarTheme(
          data: NavigationBarThemeData(
            backgroundColor: const Color(0xFF171A21),
            indicatorColor: const Color(0xFFEF4444).withOpacity(0.18),
            labelTextStyle: MaterialStateProperty.resolveWith((states) {
              final isSelected = states.contains(MaterialState.selected);
              return TextStyle(
                color: isSelected ? const Color(0xFFEF4444) : Colors.white54,
                fontSize: 12,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
              );
            }),
            iconTheme: MaterialStateProperty.resolveWith((states) {
              final isSelected = states.contains(MaterialState.selected);
              return IconThemeData(
                color: isSelected ? const Color(0xFFEF4444) : Colors.white54,
                size: 24,
              );
            }),
          ),
          child: NavigationBar(
            selectedIndex: _currentIndex,
            onDestinationSelected: (index) {
              setState(() => _currentIndex = index);
            },
            destinations: const [
              NavigationDestination(
                icon: Icon(Icons.home_outlined),
                selectedIcon: Icon(Icons.home_rounded),
                label: 'Trang chủ',
              ),
              NavigationDestination(
                icon: Icon(Icons.person_outline_rounded),
                selectedIcon: Icon(Icons.person_rounded),
                label: 'Tài khoản',
              ),
            ],
          ),
        ),
      ),
    );
  }
}
