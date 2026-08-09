"""L4/L6 · 学习中心统计/图表/最近动态 + 导出/导入/重置/昵称 + 数据层结构。"""
import sys
import os
import json
sys.path.insert(0, os.path.dirname(__file__))
from common import Server, open_browser, record, summary, BASE

SERVER = Server()

T1, T2, T3, T4 = 1_700_000_000_000, 1_700_000_010_000, 1_700_000_020_000, 1_700_000_030_000


def seed():
    return {
        "schemaVersion": 1,
        "profile": {"name": "", "createdAt": T1},
        "lessons": {
            "01-environment": {"status": "completed", "mastery": 0.5, "completedAt": T1, "lastVisitedAt": T1},
            "02-http-basics": {"status": "completed", "mastery": 0.8, "completedAt": T2, "lastVisitedAt": T2},
        },
        "exercises": {"quiz-01-environment": [{"ts": T1, "score": 5, "maxScore": 5, "ratio": 1, "passed": True, "skills": []}]},
        "practice": {"ex-03-requests": [{"ts": T2, "score": 8, "maxScore": 10, "ratio": 0.8, "passed": False, "skills": ["请求"]}]},
        "unitTests": {"unit-test-1-t1": [{"ts": T3, "score": 10, "maxScore": 10, "ratio": 1, "passed": True, "skills": ["请求"]}]},
    }


def inject(page, data):
    page.evaluate("(d) => localStorage.setItem('crawler-course:v1', JSON.stringify(d))", data)


def do_import(page, text, mode):
    page.set_input_files("#import-file", files=[{
        "name": "backup.json", "mimeType": "application/json", "buffer": text.encode("utf-8"),
    }])
    page.check(f'input[name="import-mode"][value="{mode}"]')
    page.click("#btn-import-go")


def main():
    SERVER.start()
    p, browser, ctx, page = open_browser()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))

    try:
        # ---- 空态 ----
        page.goto(BASE + "/report/", wait_until="networkidle")
        record("T-028 空态提示可见", page.locator("#report-empty").is_visible())
        record("T-028b 空态统计 0/13", page.locator("#stat-lessons").inner_text() == "0 / 13")
        record("T-028c 趋势图空态文案", "得分率随时间" in page.locator("#trend-chart").inner_text())

        # ---- 有数据:统计/进度/图表/最近动态 ----
        inject(page, seed())
        page.reload(wait_until="networkidle")
        record("T-029 课程完成 2/13", page.locator("#stat-lessons").inner_text() == "2 / 13")
        record("T-029b 累计作答 3", page.locator("#stat-attempts").inner_text() == "3")
        record("T-029c 平均得分率 93%", page.locator("#stat-avg").inner_text() == "93%")
        record("T-029d 单元测最佳 100%", page.locator("#stat-unit").inner_text() == "100%")
        w = page.locator("#unit-progress .unit-progress").first.locator(".progress-fill").get_attribute("style")
        record("T-030 单元1进度 67%", "67%" in w, w)
        record("T-031 雷达图 polygon", page.locator("#radar-chart svg polygon[fill-opacity='0.22']").count() == 1)
        record("T-031b 趋势图 polyline", page.locator("#trend-chart svg polyline").count() == 1)
        recent = [page.locator("#recent-list .recent-item").nth(i).inner_text() for i in range(3)]
        record("T-032 最近动态①实操#1", "实操#1" in recent[0], recent[0].replace("\n", " "))
        record("T-032b 最近动态②代码实战", "代码实战" in recent[1], recent[1].replace("\n", " "))
        record("T-032c 最近动态③小测", "小测" in recent[2], recent[2].replace("\n", " "))

        # ---- 昵称 ----
        page.fill("#profile-name", "小明")
        page.click("#profile-save")
        data = inject_and_read(page)
        record("T-021 昵称已保存", data.get("profile", {}).get("name") == "小明")

        # ---- T-016 数据结构 ----
        keys = sorted(data.keys())
        need = ["schemaVersion", "profile", "lessons", "exercises", "unitTests", "practice"]
        record("T-016 数据表齐全", all(k in data for k in need) and data["schemaVersion"] == 1, str(keys))

        # ---- 导出 ----
        with page.expect_download() as dl:
            page.click("#btn-export")
        dl = dl.value
        raw = dl.path()
        with open(raw, "r", encoding="utf-8") as f:
            exported = json.load(f)
        record("T-018 导出为合法 JSON", isinstance(exported, dict))
        record("T-018b 导出不含 pendingLesson", "pendingLesson" not in exported)

        # ---- 重置 ----
        page.once("dialog", lambda d: d.accept())
        page.click("#btn-reset")
        data = inject_and_read(page)
        empty = not data["lessons"] and not data["exercises"] and not data["practice"] and not data["unitTests"]
        record("T-019 重置后数据清空", empty)

        # ---- 覆盖导入恢复 ----
        do_import(page, json.dumps(seed()), "replace")
        data = inject_and_read(page)
        record("T-019b 覆盖导入恢复 2 课", len(data["lessons"]) == 2 and len(data["unitTests"]) == 1,
               f"lessons={len(data['lessons'])} ut={len(data['unitTests'])}")

        # ---- 合并导入去重 ----
        cur = inject_and_read(page)
        extra = {"ts": 1_700_000_005_000, "score": 5, "maxScore": 5, "ratio": 1, "passed": True, "skills": []}
        cur["exercises"]["quiz-01-environment"].append(extra)
        inject(page, cur)
        # 刷新页面让 store 重新读取 localStorage,否则合并基于内存旧快照
        page.reload(wait_until="networkidle")
        merge_file = json.dumps({
            "schemaVersion": 1, "profile": {"name": "旧设备", "createdAt": T1},
            "exercises": {"quiz-01-environment": [{"ts": T1, "score": 5, "maxScore": 5, "ratio": 1, "passed": True, "skills": []},
                                                  {"ts": 1_700_000_006_000, "score": 5, "maxScore": 5, "ratio": 1, "passed": True, "skills": []}]},
        })
        do_import(page, merge_file, "merge")
        data = inject_and_read(page)
        n = len(data["exercises"]["quiz-01-environment"])
        record("T-020 合并导入按 ts 去重", n == 3, f"attempts={n}")

        record("T-033 无 pageerror(学习中心)", len(errors) == 0, " | ".join(errors[:3]))
    finally:
        browser.close()
        p.stop()
        SERVER.stop()

    sys.exit(0 if summary() else 1)


def inject_and_read(page):
    return page.evaluate("() => JSON.parse(localStorage.getItem('crawler-course:v1'))")


if __name__ == "__main__":
    main()
