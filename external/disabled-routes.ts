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
];