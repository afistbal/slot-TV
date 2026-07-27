import { chromium } from "playwright";

const browser = await chromium.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();
const requests = [];
const navigations = [];

page.on("request", (request) => {
  const url = request.url();
  if (/facebook\.com|facebook\.net|connect\.facebook|i\.soulshort\.com/i.test(url)) {
    requests.push({
      method: request.method(),
      resourceType: request.resourceType(),
      url,
      postData: request.postData(),
      headers: request.headers(),
    });
  }
  if (request.isNavigationRequest()) {
    navigations.push(url);
  }
});

let gotoError = null;
try {
  await page.goto("https://soulshort.com/?s=A100B100", {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
} catch (error) {
  gotoError = error instanceof Error ? error.message : String(error);
}
await page.waitForTimeout(8000);

const metaEvents = requests
  .filter((request) => /facebook\.com\/tr/i.test(request.url))
  .map((request) => {
    const url = new URL(request.url);
    return {
      event: url.searchParams.get("ev"),
      eventId: url.searchParams.get("eid"),
      pixelId: url.searchParams.get("id"),
      documentUrl: url.searchParams.get("dl"),
      requestUrl: request.url,
    };
  });

console.log(
  JSON.stringify(
    {
      finalUrl: page.url(),
      title: await page.title(),
      gotoError,
      navigations,
      metaEvents,
      relevantRequests: requests,
    },
    null,
    2,
  ),
);

await browser.close();
