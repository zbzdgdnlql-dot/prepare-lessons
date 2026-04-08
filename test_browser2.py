import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        
        page.on("console", lambda msg: print(f"[Browser Console] {msg.type}: {msg.text}"))
        page.on("pageerror", lambda err: print(f"[Browser PageError] {err.message}"))
        
        print("Navigating to http://localhost:5173")
        try:
            await page.goto("http://localhost:5173")
            await asyncio.sleep(2)
            
            print("Filling textarea")
            await page.fill('textarea', '这是一篇测试课文，包含一些词汇和语法。')
            print("Clicking extract outline")
            await page.click('button:has-text("提取核心知识大纲")')
            await asyncio.sleep(5)
            
            print("Clicking confirm outline")
            await page.click('button:has-text("确认无误，生成所选模块")')
            
            print("Waiting for generation...")
            await asyncio.sleep(10)
            
            # Check if there's any error rendered on screen
            content = await page.content()
            if "备课包已生成" in content or "备课包生成中" in content:
                print("Success: Found expected text in step 3")
            else:
                print("Error: Did not find expected text in step 3. Possible white screen.")
        except Exception as e:
            print(f"Exception during test: {e}")
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(main())