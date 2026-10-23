import 'package:hive_flutter/hive_flutter.dart';

import 'api_client.dart';
import 'offline_queue.dart';
import 'repository.dart';
import 'session.dart';

/// App-wide singletons. Small enough that a locator is clearer than a DI package.
class Services {
  static late final Session session;
  static late final ApiClient api;
  static late final OfflineQueue queue;
  static late final SyncEngine sync;
  static late final Repository repo;

  static Future<void> init() async {
    await Hive.initFlutter();
    session = Session();
    api = ApiClient(session);
    queue = OfflineQueue(session);
    sync = SyncEngine(queue, api, session);
    repo = Repository(api, queue, session);
    await session.init();
    await queue.init();
  }
}
