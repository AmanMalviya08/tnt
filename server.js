const app = require('./src/app')
const { initTourScheduler } = require('./src/services/tourScheduler');
const { initNotificationScheduler } = require('./src/services/notificationSchedulerService');

// Initialize background tasks
initTourScheduler();
initNotificationScheduler();

app.listen(14000, '0.0.0.0', () => {
    console.log("connect to port number 14000");
})