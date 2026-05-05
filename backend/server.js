const app = require("./app");
const { testConnection } = require("./config/database");
const logger = require("./utils/logger");
const { startOverdueNotificationJob } = require("./services/overdueNotifier");

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

async function bootstrap() {
  try {
    await testConnection();
    startOverdueNotificationJob();
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });
  } catch (error) {
    logger.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
}

bootstrap();
