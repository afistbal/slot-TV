import { chromium } from "playwright";

const browser = await chromium.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
const requests = [];

page.on("request", (request) => {
  const url = request.url();
  const host = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return "";
    }
  })();
  if (
    /facebook\.com|facebook\.net|airwallex\.com|sardine\.ai/i.test(host) ||
    host === "i.soulshort.com"
  ) {
    requests.push({
      method: request.method(),
      resourceType: request.resourceType(),
      url,
    });
  }
});

let gotoError = null;
try {
  await page.goto("https://soulshort.com/?s=A100B100", {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await page.waitForTimeout(5000);
  requests.length = 0;
  await page.goto("https://soulshort.com/shopping", {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
} catch (error) {
  gotoError = error instanceof Error ? error.message : String(error);
}
await page.waitForTimeout(12000);

const fbEvents = requests
  .filter((request) => /facebook\.com\/tr/i.test(request.url))
  .map((request) => {
    const url = new URL(request.url);
    return {
      event: url.searchParams.get("ev"),
      eventId: url.searchParams.get("eid"),
      documentUrl: url.searchParams.get("dl"),
    };
  });
const hostCounts = {};
for (const request of requests) {
  const host = new URL(request.url).hostname;
  hostCounts[host] = (hostCounts[host] ?? 0) + 1;
}
const sardinePaths = {};
for (const request of requests.filter((item) => /sardine\.ai/i.test(item.url))) {
  const url = new URL(request.url);
  const key = `${request.method} ${url.pathname}${url.search}`;
  sardinePaths[key] = (sardinePaths[key] ?? 0) + 1;
}
const airwallexPaths = {};
for (const request of requests.filter((item) => /airwallex\.com/i.test(item.url))) {
  const url = new URL(request.url);
  const key = `${request.method} ${url.hostname}${url.pathname}`;
  airwallexPaths[key] = (airwallexPaths[key] ?? 0) + 1;
}
const appApiPaths = requests
  .filter((item) => new URL(item.url).hostname === "i.soulshort.com")
  .map((item) => `${item.method} ${new URL(item.url).pathname}`);
const buttons = await page
  .locator("button")
  .evaluateAll((elements) =>
    elements.slice(0, 30).map((element) => ({
      text: element.textContent?.trim().slice(0, 100) ?? "",
      ariaLabel: element.getAttribute("aria-label"),
      disabled: element.disabled,
    })),
  );

console.log(
  JSON.stringify(
    {
      finalUrl: page.url(),
      title: await page.title(),
      gotoError,
      fbEvents,
      hostCounts,
      sardinePaths,
      airwallexPaths,
      appApiPaths,
      buttons,
    },
    null,
    2,
  ),
);
await browser.close();
