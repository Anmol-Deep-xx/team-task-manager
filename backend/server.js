const app = require("./app");
const { testConnection } = require("./config/database");
const logger = require("./utils/logger");
const { startOverdueNotificationJob } = require("./services/overdueNotifier");

const PORT = process.env.PORT || 5000;

async function bootstrap() {
  try {
    await testConnection();

    startOverdueNotificationJob();

    const server = app.listen(PORT, "0.0.0.0", () => {
      logger.info(`Server running on port ${PORT}`);
    });

    server.on("error", (error) => {
      logger.error(`Server error: ${error.message}`);
      process.exit(1);
    });
  } catch (error) {
    logger.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
}

bootstrap();