from playwright.sync_api import sync_playwright

URL = "http://localhost:4321/tutorials/01-environment/"

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            executable_path=r"C:\Program Files\Google\Chrome\Application\chrome.exe",
            args=["--no-sandbox"],
        )
        page = browser.new_page()
        page.on("pageerror", lambda e: print("PAGEERROR:", e))
        page.goto(URL, wait_until="load", timeout=60000)
        page.wait_for_selector("py-code-exercise .py-runner-run", timeout=15000)

        print(">> 点击练习区运行按钮 (py-code-exercise .py-runner-run)")
        page.click("py-code-exercise .py-runner-run")

        settled = False
        for i in range(100):  # 最多 50s
            page.wait_for_timeout(500)
            st = page.eval_on_selector("py-code-exercise", "el => el.querySelector('.py-runner-status')?.textContent")
            if st and "运行中" not in st:
                print(f">> 练习运行后状态({i*0.5:.1f}s): {st}")
                settled = True
                break
        if not settled:
            st = page.eval_on_selector("py-code-exercise", "el => el.querySelector('.py-runner-status')?.textContent")
            print("!! 练习 50s 仍卡在:", st)

        # 读取练习控制台(判题输出)
        out = page.eval_on_selector("py-code-exercise", "el => el.querySelector('.py-runner-console')?.textContent")
        print(">> 练习控制台:", repr(out))
        browser.close()
    print("DONE")

if __name__ == "__main__":
    main()
