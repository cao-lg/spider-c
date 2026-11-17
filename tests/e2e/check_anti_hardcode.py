"""针对性验证:防硬编码 guard 生效,且不误伤正确解法。"""
import sys, os, time
sys.path.insert(0, os.path.dirname(__file__))
from common import Server, open_browser, run_runner, feedback_kind, BASE

SERVER = Server()

# t1 正确解法(status 来自 r.status_code)与硬编码解法(写死 200)
T1_GOOD = 'status = r.status_code\nprint("状态码:", status)'
T1_CHEAT = 'status = 200\nprint("状态码:", status)'


def set_code(ex, code):
    editor = ex.locator(".ce-input").first
    val = editor.input_value()
    # starter 末尾是 "# === TODO 补全 ===",替换之
    if "# === TODO 补全 ===" in val:
        val = val.replace("# === TODO 补全 ===", code)
    else:
        val = val + "\n" + code
    editor.fill(val)


def main():
    results = []
    SERVER.start()
    p, browser, ctx, page = open_browser()
    try:
        page.goto(f"{BASE}/tests/unit-1/", wait_until="networkidle")
        ex = page.locator("py-code-exercise").first  # unit-test-1-t1

        # 1) 硬编码 status=200 应被拒
        set_code(ex, T1_CHEAT)
        st = run_runner(ex, timeout=180)
        kind = feedback_kind(ex)
        ok = "未通过" in st or kind == "fail"
        results.append(("硬编码 status=200 被拒绝", ok, f"status={st} kind={kind}"))
        if ok:
            detail = ex.locator(".ce-detail").inner_text() if ex.locator(".ce-detail").count() else ""
            print("   拦截提示:", detail[:120])

        # 2) 正确解法 status=r.status_code 应通过
        set_code(ex, T1_GOOD)
        st = run_runner(ex, timeout=180)
        kind = feedback_kind(ex)
        ok2 = "通过" in st and "未通过" not in st and kind == "pass"
        results.append(("正确解法 status=r.status_code 通过", ok2, f"status={st} kind={kind}"))

        for name, ok, detail in results:
            print(f"[{'PASS' if ok else 'FAIL'}] {name} — {detail}")
        sys.exit(0 if all(r[1] for r in results) else 1)
    finally:
        browser.close(); p.stop(); SERVER.stop()


if __name__ == "__main__":
    main()
