// Disable routes that require browsers not installed in this Docker image
// This image only has Chromium installed, not Chrome or Edge

export default [
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
];