import { mkdirSync, writeFileSync } from "node:fs";

import { chromium } from "playwright";

async function scrapeSearchResultsPage() {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return {
        products: Array.from(
            document.querySelectorAll("div.photo-tile"),
            el => ({
                url: el.querySelector("a.photo-tile__image-wrapper").href,
                imageName: el.querySelector("p.photo-tile__title").textContent,
            }),
        ),
        nextPageUrl: document.querySelector("li.next a")?.href,
    };
}

async function scrapeItemPage() {
    await new Promise(resolve => setTimeout(resolve, 1000));
    const metadata = Object.fromEntries(Array.from(
        document.querySelectorAll("p.photo__meta"),
        p => [
            p.querySelector("b").textContent.split(":")[0],
            Array.from(p.querySelectorAll("a"), a => a.textContent),
        ],
    ));
    return {
        description: document.querySelector("div.photo__info p").textContent.trim(),
        author: metadata["Photo by"][0],
        categories: metadata["Featured in"],
        license: metadata["License"][0],
    };
}

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext();
const page = await context.newPage();

await page.goto("https://www.shopify.com/stock-photos/product");

const products = [];

while (true) {
    const data = await page.evaluate(scrapeSearchResultsPage);
    products.push(...data.products);
    if (data.nextPageUrl) {
        await page.goto(data.nextPageUrl);
    } else {
        break;
    }
}

mkdirSync("products", { recursive: true });

for (const product of products) {
    await page.goto(product.url);
    Object.assign(product, await page.evaluate(scrapeItemPage));
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", {
        name: "Download free photo",
        exact: true,
    }).click();
    const download = await downloadPromise;
    product.imageName = download.suggestedFilename();
    await download.saveAs(`products/${product.imageName}`);
}

writeFileSync("products.json", JSON.stringify({ products }, null, 4));

await context.close();
await browser.close();
