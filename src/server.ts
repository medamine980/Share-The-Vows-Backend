import App from './app';
import config from './config';

const app = new App();

const server = app.app.listen(config.port, config.host, () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║   Wedding Photo Upload API - Server Started          ║
╚═══════════════════════════════════════════════════════╝

🚀 Server running on: http://${config.host}:${config.port}
🌍 Environment: ${config.nodeEnv}
📁 Upload directory: ${config.uploadDir}
💾 Database: ${config.dbPath}
📦 Max storage: ${config.maxStorageGB} GB
📤 Max file size: ${(config.maxFileSize / 1024 / 1024).toFixed(2)} MB
🔒 CORS origin: ${config.corsOrigin}

Health check: http://${config.host}:${config.port}/health
  `);
});

// Graceful shutdown
const gracefulShutdown = (signal: string) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);
  
  server.close(() => {
    console.log('HTTP server closed.');
    app.close();
    console.log('Database connections closed.');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('Forcing shutdown...');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  console.error('Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

export default server;
