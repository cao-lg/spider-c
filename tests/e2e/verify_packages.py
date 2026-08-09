from playwright.sync_api import sync_playwright

URL = "http://localhost:4321/tutorials/01-environment/"

def main():
    resp_log = []
    fail_log = []

    def on_response(resp):
        u = resp.url
        if "/pyodide/" in u:
            resp_log.append(f"RESP {resp.status} {u.split('/pyodide/')[-1]}")

    def on_reqfailed(req):
        u = req.url
        if "/pyodide/" in u:
            fail_log.append(f"FAIL {u.split('/pyodide/')[-1]} :: {req.failure}")

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            executable_path=r"C:\Program Files\Google\Chrome\Application\chrome.exe",
            args=["--no-sandbox"],
        )
        page = browser.new_page()
        page.on("response", on_response)
        page.on("requestfailed", on_reqfailed)

        page.goto(URL, wait_until="load", timeout=60000)
        page.wait_for_selector("button.py-runner-run", timeout=15000)

        # 展开再运行
        try:
            rev = page.query_selector("button.py-runner-reveal")
            if rev:
                rev.click(); page.wait_for_timeout(300)
        except Exception:
            pass

        page.click("button.py-runner-run")
        # 等到完成
        for _ in range(80):
            page.wait_for_timeout(500)
            st = page.eval_on_selector("button.py-runner-run", "el => el.closest('.py-runner').querySelector('.py-runner-status')?.textContent")
            if st and "运行中" not in st and "正在启动" not in st and "正在加载" not in st and "点击" not in st:
                print(">> 教程最终状态:", st)
                break

        browser.close()

    print("\n===== pyodide 网络响应(按出现顺序) =====")
    for r in resp_log:
        print(r)
    print("\n===== 失败的请求 =====")
    for f in fail_log:
        print(f)
    print("\nDONE")

if __name__ == "__main__":
    main()
