"""E2E 测试公共助手:启动预览服务器、浏览器、运行器判分工具。"""
import subprocess
import time
import sys
from playwright.sync_api import sync_playwright, Page

ROOT = r"C:\crawler-course"
PORT = 4321
BASE = f"http://localhost:{PORT}"
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

RESULTS = []


def record(name: str, ok: bool, detail: str = ""):
    RESULTS.append((name, ok, detail))
    tag = "PASS" if ok else "FAIL"
    print(f"[{tag}] {name}" + (f" — {detail}" if detail else ""))


class Server:
    def __init__(self):
        self.proc = None

    def start(self):
        self.proc = subprocess.Popen(
            f"npm run preview -- --port {PORT}", shell=True, cwd=ROOT,
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        time.sleep(4)

    def stop(self):
        if self.proc:
            self.proc.terminate()
            self.proc = None


def open_browser():
    p = sync_playwright().start()
    browser = p.chromium.launch(headless=True, executable_path=CHROME, args=["--no-sandbox"])
    ctx = browser.new_context(accept_downloads=True)
    page = ctx.new_page()
    return p, browser, ctx, page


def run_runner(runner, timeout=150):
    runner.locator(".py-runner-run").click()
    start = time.time()
    while time.time() - start < timeout:
        st = runner.locator(".py-runner-status").inner_text()
        if "通过" in st or "出错" in st or "未通过" in st:
            return st
        time.sleep(2)
    return "TIMEOUT"


def feedback_kind(runner):
    fb = runner.locator(".code-exercise-feedback")
    if fb.count() > 0 and not fb.get_attribute("hidden"):
        return fb.get_attribute("class").replace("code-exercise-feedback ", "")
    return "?"


def store_data(page: Page):
    return page.evaluate("() => JSON.parse(localStorage.getItem('crawler-course:v1'))")


def fill_todo(editor, answer: str):
    code = editor.inner_text()
    new_code = code.replace("# === TODO 补全 ===", answer)
    editor.evaluate("(el, c) => { el.textContent = c; }", new_code)
    return new_code


def summary():
    ok = sum(1 for _, passed, _ in RESULTS if passed)
    print(f"\n===== 结果: {ok}/{len(RESULTS)} 通过 =====")
    for name, passed, detail in RESULTS:
        if not passed:
            print(f"  FAIL {name} — {detail}")
    return ok == len(RESULTS)
