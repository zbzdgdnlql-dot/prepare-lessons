import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

  console.log("Navigating...");
  await page.goto('http://localhost:5173');
  
  await new Promise(r => setTimeout(r, 2000));
  console.log("Filling textarea...");
  await page.type('textarea', '这是一篇测试课文。');
  
  console.log("Clicking extract...");
  await page.click('button:has-text("提取核心知识大纲")');
  await new Promise(r => setTimeout(r, 5000));
  
  console.log("Clicking confirm...");
  await page.click('button:has-text("确认无误，生成所选模块")');
  
  console.log("Waiting 10s...");
  await new Promise(r => setTimeout(r, 10000));
  
  const content = await page.content();
  if (content.includes("备课包已生成") || content.includes("备课包生成中")) {
    console.log("Success: found expected text");
  } else {
    console.log("Error: did not find expected text, possible white screen");
  }
  
  await browser.close();
})();