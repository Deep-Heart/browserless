import { Browserless, Logger } from '@browserless.io/browserless';

(async () => {
  const browserless = new Browserless();
  const logger = new Logger('index.js');

  // Disable routes for browsers not installed in this Docker image
  // This image only has Chromium installed, not Chrome or Edge
  browserless.disableRoutes(
    // Chrome HTTP routes
    'ChromeContentPostRoute',
    'ChromeDownloadPostRoute',
    'ChromeFunctionPostRoute',
    'ChromePDFPostRoute',
    'ChromePerformancePostRoute',
    'ChromeScrapePostRoute',
    'ChromeScreenshotPostRoute',

    // Chrome WebSocket routes
    'ChromeCDPRoute',
    'ChromePlaywrightRoute',

    // Edge HTTP routes
    'EdgeContentPostRoute',
    'EdgeDownloadPostRoute',
    'EdgeFunctionPostRoute',
    'EdgePDFPostRoute',
    'EdgePerformancePostRoute',
    'EdgeScrapePostRoute',
    'EdgeScreenshotPostRoute',

    // Edge WebSocket routes
    'EdgeCDPRoute',
    'EdgePlaywrightRoute',

    // Firefox routes (not installed)
    'FirefoxPlaywrightRoute',

    // WebKit routes (not installed)
    'WebKitPlaywrightRoute',
  );

  browserless.start();

  process
    .on('unhandledRejection', async (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    })
    .once('uncaughtException', async (err, origin) => {
      console.error('Unhandled exception at:', origin, 'error:', err);
      await browserless.stop();
      process.exit(1);
    })
    .once('SIGTERM', async () => {
      logger.info(`SIGTERM received, saving and closing down`);
      await browserless.stop();
      process.exit(0);
    })
    .once('SIGINT', async () => {
      logger.info(`SIGINT received, saving and closing down`);
      await browserless.stop();
      process.exit(0);
    })
    .once('SIGHUP', async () => {
      logger.info(`SIGHUP received, saving and closing down`);
      await browserless.stop();
      process.exit(0);
    })
    .once('SIGUSR2', async () => {
      logger.info(`SIGUSR2 received, saving and closing down`);
      await browserless.stop();
      process.exit(0);
    })
    .once('exit', () => {
      logger.info(`Process is finished, exiting`);
      process.exit(0);
    });
})();