"""E2E 测试公共助手:启动预览服务器、浏览器、运行器判分工具。"""
import json
import os
import subprocess
import time
import sys
from playwright.sync_api import sync_playwright, Page

# 由文件位置推导项目根目录,避免硬编码个人路径(原为 C:\crawler-course)
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PORT = 4321
BASE = f"http://localhost:{PORT}"
CHROME = os.environ.get("CHROME_PATH", r"C:\Program Files\Google\Chrome\Application\chrome.exe")

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


STORAGE_KEY = "crawler-course:v2"
LEGACY_KEY = "crawler-course:v1"

# 代码编辑器已从 contenteditable <pre> 换成 textarea(.ce-input),
# 用 fill() 写入会同时触发 input 事件,高亮层随之刷新。
EDITOR = ".ce-input"


def set_code(container, code: str):
    """把代码写入容器内的编辑器"""
    container.locator(EDITOR).first.fill(code)


def get_code(container) -> str:
    return container.locator(EDITOR).first.input_value()


def store_data(page: Page):
    """读取学习数据(优先 v2,回落 v1,便于验证迁移场景)"""
    raw = page.evaluate(
        "([k1, k2]) => localStorage.getItem(k1) || localStorage.getItem(k2)",
        [STORAGE_KEY, LEGACY_KEY],
    )
    return json.loads(raw) if raw else None


def fill_todo(container, answer: str):
    """把 starter 里的 TODO 占位符替换为答案后写回编辑器"""
    code = get_code(container)
    new_code = code.replace("# === TODO 补全 ===", answer)
    set_code(container, new_code)
    return new_code


def summary():
    ok = sum(1 for _, passed, _ in RESULTS if passed)
    print(f"\n===== 结果: {ok}/{len(RESULTS)} 通过 =====")
    for name, passed, detail in RESULTS:
        if not passed:
            print(f"  FAIL {name} — {detail}")
    return ok == len(RESULTS)
