const app = require('./src/app');
const { initTourScheduler } = require('./src/services/tourScheduler');
const { initNotificationScheduler } = require('./src/services/notificationSchedulerService');
const { initPopularPackagesScheduler } = require('./src/services/popularPackagesService');
const { initSocket } = require('./src/services/socketService');

const startServer = async () => {
  try {
    await app.connectDB();
    initTourScheduler();
    initNotificationScheduler();
    initPopularPackagesScheduler();
    initSocket(app.server);

    app.server.listen(14000, '0.0.0.0', () => {
      console.log("connect to port number 14000");
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
};

startServer();
