import sys
from playwright.sync_api import sync_playwright

URL = "http://localhost:4321/tutorials/01-environment/"

def main():
    console_logs = []
    page_errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.on("console", lambda m: console_logs.append(f"[{m.type}] {m.text}"))
        page.on("pageerror", lambda e: page_errors.append(str(e)))

        print(">> goto", URL)
        page.goto(URL, wait_until="load", timeout=60000)

        # 找到教程演示区的运行按钮(.py-runner-run)与练习区的运行按钮
        page.wait_for_selector("button.py-runner-run", timeout=15000)
        print(">> 找到 py-runner-run 按钮")

        # ---- 测试 1: 教程演示 CodeRunner ----
        # 展开(若是折叠的 guided/challenge)
        try:
            reveal = page.query_selector("button.py-runner-reveal")
            if reveal:
                reveal.click()
                page.wait_for_timeout(300)
        except Exception as e:
            print("   (reveal 点击异常,忽略)", e)

        before = page.eval_on_selector("button.py-runner-run", "el => el.closest('.py-runner').querySelector('.py-runner-status')?.textContent")
        print(">> 点击教程运行前状态:", before)
        page.click("button.py-runner-run")

        # 等待状态不再是"运行中/正在启动/正在加载",最多 40s
        settled = False
        for _ in range(80):
            page.wait_for_timeout(500)
            st = page.eval_on_selector("button.py-runner-run", "el => el.closest('.py-runner').querySelector('.py-runner-status')?.textContent")
            if st and ("运行中" not in st) and ("正在启动" not in st) and ("正在加载" not in st) and ("点击" not in st):
                print(">> 教程运行后状态:", st)
                settled = True
                break
        if not settled:
            st = page.eval_on_selector("button.py-runner-run", "el => el.closest('.py-runner').querySelector('.py-runner-status')?.textContent")
            print("!! 教程运行 40s 后仍卡住:", st)

        # 读取控制台是否有输出
        out = page.eval_on_selector("button.py-runner-run", "el => el.closest('.py-runner').querySelector('.py-runner-console')?.textContent")
        print(">> 教程运行控制台输出:", repr(out))

        # ---- 测试 2: 底部练习 CodeExercise ----
        ex_run = page.query_selector("py-code-exercise button.ce-run, py-code-exercise button[class*='run']")
        if ex_run:
            print(">> 找到练习运行按钮,点击")
            # 先展开参考代码(details)以便运行
            try:
                det = page.query_selector("py-code-exercise details summary button")
                if det:
                    det.click(); page.wait_for_timeout(300)
            except Exception:
                pass
            ex_run.click()
            ex_settled = False
            for _ in range(80):
                page.wait_for_timeout(500)
                st2 = page.eval_on_selector("py-code-exercise", "el => el.querySelector('.ce-status')?.textContent")
                if st2 and ("运行中" not in st2) and ("正在启动" not in st2) and ("正在加载" not in st2):
                    print(">> 练习运行后状态:", st2)
                    ex_settled = True
                    break
            if not ex_settled:
                st2 = page.eval_on_selector("py-code-exercise", "el => el.querySelector('.ce-status')?.textContent")
                print("!! 练习运行 40s 后仍卡住:", st2)
        else:
            print("!! 未找到练习运行按钮")

        browser.close()

    print("\n===== CONSOLE LOGS =====")
    for l in console_logs[:60]:
        print(l)
    print("\n===== PAGE ERRORS =====")
    for e in page_errors[:20]:
        print(e)
    print("\nDONE")

if __name__ == "__main__":
    main()
