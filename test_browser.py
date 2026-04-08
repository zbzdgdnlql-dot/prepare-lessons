import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        
        page.on("console", lambda msg: print(f"Console: {msg.text}"))
        page.on("pageerror", lambda err: print(f"Page Error: {err.message}"))
        
        print("Navigating to http://localhost:5173")
        await page.goto("http://localhost:5173")
        await asyncio.sleep(2)
        
        # Click through step 1
        print("Filling textarea")
        await page.fill('textarea', 'test content')
        print("Clicking extract outline")
        await page.click('button:has-text("提取核心知识大纲")')
        await asyncio.sleep(2)
        
        # Click through step 2
        print("Clicking confirm outline")
        await page.click('button:has-text("确认无误，生成所选模块")')
        await asyncio.sleep(5)
        
        print("Waiting to see if white screen happens")
        await asyncio.sleep(5)
        
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())