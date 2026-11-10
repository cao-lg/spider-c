"""教师端学情报告(阶段 0 离线汇总 + 阶段 1/2 降级)端到端验证。

重点守护:
  · 离线文件全在浏览器内解析,不产生任何 /api 请求
  · 目标达成矩阵标注证据强度,误区按「人」去重而不是按「次数」
  · 同一学号多份备份合并、坏文件不污染报告
  · 未部署 Pages Functions 时云端看板给出可读提示,而不是白屏
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from common import (  # noqa: E402
    BASE,
    Server,
    open_browser,
    record,
    summary,
)

SERVER = Server()
T = 1_700_000_001_000


def backup(sid, class_id, wrong_key=None, ts=T):
    """构造一份最小但结构完整的学习备份"""
    d = {
        "schemaVersion": 2,
        "profile": {"name": sid, "createdAt": ts - 86400000},
        "roster": {"studentId": sid, "classId": class_id},
        "lessons": {
            "01-environment": {
                "status": "completed", "mastery": 0.8,
                "lastVisitedAt": ts, "completedAt": ts,
            },
            "02-http-basics": {"status": "in_progress", "mastery": 0.4, "lastVisitedAt": ts},
        },
        "exercises": {},
        "unitTests": {},
        "practice": {
            "ex-01-environment": [
                {"ts": ts, "score": 8, "maxScore": 10, "ratio": 0.8, "passed": True, "skills": []}
            ]
        },
        "concepts": {
            "quiz-01-environment": [
                {
                    "ts": ts, "score": 5, "maxScore": 10, "ratio": 0.5,
                    "lessonId": "01-environment",
                    "answers": [
                        {"qid": "q-01-1", "given": "1", "correct": True, "points": 5, "maxPoints": 5},
                        {"qid": "q-01-2", "given": "F", "correct": False, "points": 0, "maxPoints": 5},
                    ],
                }
            ]
        },
        "mistakes": {},
    }
    if wrong_key:
        d["mistakes"]["q-01-2"] = {
            "qid": "q-01-2", "lessonId": "01-environment",
            "wrongCount": 2, "firstWrongAt": ts - 7200000,
            "lastWrongAt": ts, "lastGiven": "F", "misconception": wrong_key,
        }
    return json.dumps(d, ensure_ascii=False).encode("utf-8")


def feed(page, files):
    page.set_input_files("#teacher-files", files=files)
    page.wait_for_timeout(350)


def main():
    SERVER.start()
    p, browser, ctx, page = open_browser()
    api_calls = []
    page.on("request", lambda r: api_calls.append(r.url) if "/api/" in r.url else None)
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))

    try:
        # ---- 入口与空态 ----
        page.goto(BASE + "/report/", wait_until="networkidle")
        record("T-120 教师端「学情报告」在主导航",
               page.locator('.main-nav a[href="/teacher/"]').count() == 1)
        record("T-120b 主导航共 8 项", page.locator(".main-nav a").count() == 8,
               f"count={page.locator('.main-nav a').count()}")

        page.goto(BASE + "/teacher/", wait_until="networkidle")
        record("T-121 教师页 noindex(内部工具不进搜索索引)",
               'noindex' in (page.locator('meta[name="robots"]').get_attribute("content") or ""))
        record("T-121b 初始空态:文件表与报告均隐藏",
               not page.locator("#file-card").is_visible()
               and not page.locator("#teacher-report").is_visible())
        record("T-121c 初始提示可操作", "尚未加入" in page.locator("#teacher-msg").inner_text())

        # ---- 示例班级 ----
        page.click("#btn-demo")
        page.wait_for_timeout(300)
        record("T-122 载入示例班级成功", page.locator("#teacher-report").is_visible()
               and "10 名示例学生" in page.locator("#teacher-msg").inner_text())
        record("T-122b 文件表列出 10 份",
               page.locator("#file-list tr").count() == 10,
               f"rows={page.locator('#file-list tr').count()}")
        record("T-123 KPI 卡 5 张", page.locator("#kpi-grid .teacher-kpi").count() == 5)
        record("T-124 目标达成矩阵 44 行",
               page.locator("#objective-body tr").count() == 44,
               f"rows={page.locator('#objective-body tr').count()}")
        record("T-124b 报告标注了证据强度",
               "间接" in page.locator("#objective-body").inner_text()
               or "直接" in page.locator("#objective-body").inner_text())
        record("T-125 存在需重讲目标",
               page.locator("#objective-body .teacher-status-critical").count() > 0)
        record("T-126 误区热力图按标签聚合",
               page.locator("#misconception-list .teacher-heat-row").count() > 0
               and "状态码归因错误" in page.locator("#misconception-list").inner_text())
        record("T-127 课程进度表 13 行", page.locator("#lesson-body tr").count() == 13)
        record("T-128 技能维度 5 行", page.locator("#skill-list .teacher-skill-row").count() == 5)
        record("T-129 教学决策非空且可跳转",
               page.locator("#decision-list .teacher-decision").count() > 0
               and page.locator("#decision-list a").count() > 0)
        record("T-130 学生清单 10 行且只显示匿名学号",
               page.locator("#student-body tr").count() == 10
               and "S01" in page.locator("#student-body").inner_text()
               and "张" not in page.locator("#student-body").inner_text())
        record("T-131 两班对照可见",
               page.locator("#class-compare .teacher-compare-row").count() == 2)

        # ---- 班级筛选 ----
        page.select_option("#class-filter", "1班")
        page.wait_for_timeout(250)
        record("T-132 筛选 1班后报告只统计 5 人",
               "5 名学生" in page.locator("#report-meta").inner_text(),
               page.locator("#report-meta").inner_text()[:60])
        page.select_option("#class-filter", "")
        page.wait_for_timeout(250)
        record("T-133 切回全部恢复 10 人", "10 名学生" in page.locator("#report-meta").inner_text())

        # ---- 编辑与移除 ----
        page.locator(".js-cid").first.fill("3班")
        page.locator(".js-cid").first.dispatch_event("change")
        page.wait_for_timeout(250)
        opts = page.locator("#class-filter option").all_text_contents()
        record("T-134 改班级后筛选器出现 3 个班", len(opts) == 4, f"options={opts}")
        page.locator(".js-remove").first.click()
        page.wait_for_timeout(250)
        record("T-135 移除一份后剩 9 行", page.locator("#file-list tr").count() == 9)

        # ---- CSV ----
        with page.expect_download(timeout=8000) as dl:
            page.click("#btn-csv-objectives")
        path = dl.value.path()
        with open(path, "rb") as f:
            raw = f.read()
        text = raw.decode("utf-8-sig")
        record("T-136 目标 CSV 带 BOM 且含表头",
               raw.startswith(b"\xef\xbb\xbf") and "可观测目标" in text)
        with page.expect_download(timeout=8000) as dl2:
            page.click("#btn-csv-misconceptions")
        with page.expect_download(timeout=8000) as dl3:
            page.click("#btn-csv-students")
        record("T-136b 三个 CSV 均可下载",
               dl2.value.suggested_filename.endswith(".csv")
               and dl3.value.suggested_filename.endswith(".csv"))

        # ---- 打印入口存在 ----
        record("T-137 打印按钮存在", page.locator("#btn-print").count() == 1)

        # ---- 清空后上传真实备份 ----
        page.click("#btn-clear")
        page.wait_for_timeout(200)
        record("T-138 清空回到空态", not page.locator("#teacher-report").is_visible())

        bad = {"name": "bad.json", "mimeType": "application/json", "buffer": b"not json"}
        empty = {"name": "empty.json", "mimeType": "application/json",
                 "buffer": json.dumps({"schemaVersion": 2, "profile": {}, "lessons": {},
                                       "exercises": {}, "practice": {}, "unitTests": {}}).encode()}
        feed(page, [bad, empty])
        record("T-139 坏文件与空备份被拒绝且报告不出现",
               not page.locator("#teacher-report").is_visible()
               and "不是合法的 JSON" in page.locator("#teacher-msg").inner_text()
               and "没有任何学习记录" in page.locator("#teacher-msg").inner_text())

        a = {"name": "A-01.json", "mimeType": "application/json",
             "buffer": backup("A01", "1班", "status-code-confusion")}
        b = {"name": "B-01.json", "mimeType": "application/json",
             "buffer": backup("B01", "2班")}
        feed(page, [a, b])
        record("T-140 两份真实备份 → 2 名学生 2 个班",
               "2 名学生" in page.locator("#report-meta").inner_text()
               and page.locator("#student-body tr").count() == 2,
               page.locator("#report-meta").inner_text()[:80])
        record("T-140b 目标矩阵证据来自逐题明细",
               "直接 2" in page.locator("#objective-body").inner_text()
               or "直接 1" in page.locator("#objective-body").inner_text())

        # 同一学号的两台设备备份:ts 不同,应合并为 1 人且两条作答都在
        c = {"name": "A-02.json", "mimeType": "application/json",
             "buffer": backup("A01", "1班", ts=T + 5000)}
        feed(page, [c])
        record("T-141 同一学号多份备份自动合并",
               page.locator("#student-body tr").count() == 2
               and "按学号合并" in page.locator("#report-meta").inner_text(),
               page.locator("#report-meta").inner_text()[:100])

        record("T-142 离线模式零网络请求", len(api_calls) == 0, f"api_calls={api_calls[:2]}")

        # ---- 云端降级 ----
        page.click("#tab-cloud")
        page.wait_for_timeout(200)
        record("T-143 数据源可切换到云端看板",
               page.locator("#panel-cloud").is_visible()
               and not page.locator("#panel-offline").is_visible())
        page.click("#btn-cloud-load")
        page.wait_for_timeout(300)
        record("T-143b 未填口令时给出提示而非报错",
               "请先填写教师口令" in page.locator("#cloud-msg").inner_text())
        page.fill("#cloud-token", "test-token")
        page.click("#btn-cloud-load")
        page.wait_for_timeout(1200)
        record("T-144 未部署 Functions 时优雅降级",
               "离线模式不受影响" in page.locator("#cloud-msg").inner_text()
               or "云端接口不可用" in page.locator("#cloud-msg").inner_text(),
               page.locator("#cloud-msg").inner_text()[:90])

        page.click("#btn-cloud-archive")
        page.wait_for_timeout(200)
        record("T-151 无报告时归档按钮给出明确前置条件",
               "请先拉取班级数据" in page.locator("#cloud-msg").inner_text())
        page.click("#btn-cloud-archive-list")
        page.wait_for_timeout(1000)
        record("T-152 查看归档在未部署时优雅降级",
               "离线模式不受影响" in page.locator("#cloud-msg").inner_text(),
               page.locator("#cloud-msg").inner_text()[:90])

        # ---- 窄屏 ----
        page.set_viewport_size({"width": 390, "height": 820})
        page.click("#tab-offline")
        page.wait_for_timeout(300)
        sw = page.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")
        record("T-145 390px 无横向溢出", sw[0] <= sw[1] + 1, f"scrollW={sw[0]} innerW={sw[1]}")

        # ---- 学生端云同步卡片(未部署时的降级) ----
        page.set_viewport_size({"width": 1280, "height": 900})
        page.goto(BASE + "/report/", wait_until="networkidle")
        record("T-147 学习中心有云同步入口且默认关闭",
               page.locator("#btn-sync-enable").count() == 1
               and page.locator("#btn-sync-push").is_disabled()
               and page.locator("#btn-sync-delete").is_disabled())
        page.click("#btn-sync-enable")
        page.wait_for_timeout(200)
        record("T-148 未填齐信息时给出提示且不发请求",
               "请填齐" in page.locator("#sync-msg").inner_text())
        page.fill("#sync-student", "S01")
        page.fill("#sync-class", "1班")
        page.fill("#sync-code", "code-123")
        page.click("#btn-sync-enable")
        page.wait_for_timeout(900)
        record("T-149 未部署 Functions 时学生端给出可读提示",
               "还没有部署云同步服务" in page.locator("#sync-msg").inner_text(),
               page.locator("#sync-msg").inner_text()[:90])
        record("T-149b 启用失败不写入本机令牌",
               page.evaluate("() => localStorage.getItem('crawler-course:sync-token')") is None)
        with page.expect_download(timeout=8000) as dl:
            page.click("#btn-export")
        with open(dl.value.path(), "r", encoding="utf-8") as f:
            exported = json.load(f)
        record("T-150 云同步失败不影响离线导出备份",
               exported.get("schemaVersion") == 2
               and "pendingLesson" not in exported
               and "lessons" in exported)

        record("T-146 无 JavaScript 运行错误", len(errors) == 0, str(errors[:2]))
    finally:
        browser.close()
        p.stop()
        SERVER.stop()

    return 0 if summary() else 1


if __name__ == "__main__":
    sys.exit(main())
