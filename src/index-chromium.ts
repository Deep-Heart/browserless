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
    'ChromeJSONListGetRoute',
    'ChromeJSONNewPutRoute',
    'ChromeJSONProtocolGetRoute',
    'ChromeJSONVersionGetRoute',

    // Chrome WebSocket routes
    'ChromeBrowserWebSocketRoute',
    'ChromeCDPWebSocketRoute',
    'ChromePlaywrightWebSocketRoute',
    'ChromePageWebSocketRoute',
    'ChromeFunctionConnectWebSocketRoute',

    // Edge HTTP routes
    'EdgeContentPostRoute',
    'EdgeDownloadPostRoute',
    'EdgeFunctionPostRoute',
    'EdgePDFPostRoute',
    'EdgePerformancePostRoute',
    'EdgeScrapePostRoute',
    'EdgeScreenshotPostRoute',
    'EdgeJSONListGetRoute',
    'EdgeJSONNewPutRoute',
    'EdgeJSONProtocolGetRoute',
    'EdgeJSONVersionGetRoute',

    // Edge WebSocket routes
    'EdgeBrowserWebSocketRoute',
    'EdgeCDPWebSocketRoute',
    'EdgePlaywrightWebSocketRoute',
    'EdgePageWebSocketRoute',
    'EdgeFunctionConnectWebSocketRoute',

    // Firefox routes (not installed)
    'FirefoxPlaywrightWebSocketRoute',

    // WebKit routes (not installed)
    'WebKitPlaywrightWebSocketRoute',
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