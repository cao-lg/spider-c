"""生成新版 courseTestTasks:题干移至 question(代码区外),check 升级为测试用例式。
测试用例式判定:判分时重新请求靶站,解析真实数据,与学生变量逐项比对——
学生无法靠"打开网站数行数"或伪造变量蒙混,必须真正写解析代码。"""
import json

TESTS = [
    ("01", "城市气候观测", "城市", "城市数据"),
    ("02", "数码配件行情", "商品", "智能硬件城"),
    ("03", "股票行情速览", "股票", "金融数据局"),
    ("04", "经典影片榜单", "电影", "光影档案馆"),
    ("05", "人气餐厅推荐", "餐厅", "食味地图"),
    ("06", "健身器材精选", "器材", "运动装备库"),
    ("07", "热门景点排行", "景点", "旅行者指南"),
    ("08", "宠物好物推荐", "商品", "萌宠用品店"),
    ("09", "专辑热度榜", "专辑", "音乐唱片行"),
    ("10", "家居好物甄选", "商品", "生活美学馆"),
]

# 每个靶站列: 0编号 1名称 2类别 3品牌 4价格 5评分
NAME_TD, PRICE_TD = 1, 4


def esc(s):
    return s.replace('"', '&quot;')


def q_common(topic, noun, site, base):
    """题干公共部分"""
    return (f"<h4>任务:抓取「{topic}」榜单</h4>"
            f"<p>请求 <code>{base}</code>,用 Python 爬虫解析页面数据。</p>"
            f"<p><strong>要点:</strong></p><ul>"
            f"<li>靶站为静态 HTML 表格,数据为虚构教学数据</li>"
            f"<li>判分器会<strong>独立重新抓取靶站</strong>生成期望值,与你提交的结果<strong>逐项比对</strong>,无法靠数行数或伪造变量通过</li>"
            f"<li>注意编码:<code>r.encoding = \"utf-8\"</code> 避免中文乱码</li></ul>")


def make_t1(num, topic, noun, site):
    base = f"SITE_BASE + \"/practice/course-test-{num}/\""
    question = (q_common(topic, noun, site, base)
                + f"<p><strong>要求:</strong>用 CSS 选择器提取表格中所有行,存入变量 <code>rows</code>。</p>"
                + f"<p class=\"ce-q-spec\">判定标准:rows 数量与顺序必须和靶站真实表格行完全一致(24 行);且每行必须是 BeautifulSoup 解析出的对象。</p>")
    starter = f"""import requests
from bs4 import BeautifulSoup

r = requests.get({base}, timeout=10)
r.encoding = "utf-8"
soup = BeautifulSoup(r.text, "html.parser")

# TODO: 用 CSS 选择器把表格中所有行存入变量 rows(提示: tbody tr)
# rows = ..."""
    check = f"""import requests as _rq
from bs4 import BeautifulSoup as _bs
_src = _rq.get({base}, timeout=10)
_src.encoding = "utf-8"
_soup = _bs(_src.text, "html.parser")
_expect = [_tr.select("td")[{NAME_TD}].get_text().strip() for _tr in _soup.select("tbody tr")]
assert 'rows' in globals(), "未定义变量 rows,请先把表格行存入 rows"
assert isinstance(rows, list) and len(rows) == len(_expect), f"行数应为 {{len(_expect)}},实际 {{len(rows)}}"
assert hasattr(rows[0], "select"), "rows 元素应为 BeautifulSoup 解析出的行对象,请用 soup.select() 提取"
_got = [row.select("td")[{NAME_TD}].get_text().strip() for row in rows]
assert _got == _expect, "提取的名称与靶站真实数据不一致,请检查选择器与下标" """
    return {
        "id": f"course-test-{num}-t1",
        "title": f"实操题 1:抓取「{topic}」列表",
        "skills": ["请求", "解析"], "maxScore": 10,
        "question": question, "starter": starter, "check": check,
        "hintSteps": [
            "表格行在 <tbody> 里,每行是 <tr>。soup.select('tbody tr') 是标准做法。",
            "判分器会重新抓靶站逐行比对——所以必须真实解析,不能伪造列表。",
            "运行后应看到 '抓到行数: 24'。",
        ],
        "explanation": f"「{topic}」列表页是单页表格。测试用例式判定要求你真正解析出与靶站一致的数据——这是爬虫的核心:让代码与页面结构精确对应。",
    }


def make_t2(num, topic, noun, site):
    base = f"SITE_BASE + \"/practice/course-test-{num}/\""
    question = (q_common(topic, noun, site, base)
                + f"<p><strong>要求:</strong>遍历表格行,把每行的<strong>名称</strong>(第 2 个 td)与<strong>价格</strong>(第 5 个 td)提取为元组,全部存入变量 <code>items</code>。</p>"
                + f"<p class=\"ce-q-spec\">判定标准:items 必须与靶站真实数据<strong>逐条完全一致</strong>(名称与价格,含顺序)。</p>")
    starter = f"""import requests
from bs4 import BeautifulSoup

r = requests.get({base}, timeout=10)
r.encoding = "utf-8"
soup = BeautifulSoup(r.text, "html.parser")
rows = soup.select("tbody tr")

# TODO: 遍历 rows,提取每行的名称(td 第 2 列)与价格(td 第 5 列)为 (名称, 价格) 元组,
# 全部存入变量 items(提示: row.select("td") 取该行单元格)
# items = ...

print("条目数:", len(items))
print("样例:", items[0] if items else None)"""
    check = f"""import requests as _rq
from bs4 import BeautifulSoup as _bs
_src = _rq.get({base}, timeout=10)
_src.encoding = "utf-8"
_soup = _bs(_src.text, "html.parser")
_expect = [(_tr.select("td")[{NAME_TD}].get_text().strip(), _tr.select("td")[{PRICE_TD}].get_text().strip())
           for _tr in _soup.select("tbody tr")]
assert 'items' in globals() and isinstance(items, list), "请把提取结果存入变量 items"
assert len(items) == len(_expect), f"应提取 {{len(_expect)}} 条,实际 {{len(items)}}"
assert items == _expect, "提取的 (名称, 价格) 与靶站真实数据不一致,请检查列下标与去空白" """
    return {
        "id": f"course-test-{num}-t2",
        "title": f"实操题 2:提取「{noun}」名称与价格",
        "skills": ["解析"], "maxScore": 10,
        "question": question, "starter": starter, "check": check,
        "hintSteps": [
            "每行有 6 个 td:编号/名称/类别/品牌/价格/评分。名称是第 2 个(td[1]),价格是第 5 个(td[4])。",
            "列表推导式 [ (row.select('td')[1].get_text().strip(), row.select('td')[4].get_text().strip()) for row in rows ]。",
            "用 .strip() 去掉首尾空白——判分器比对的是精确值,多余空格会导致不一致。",
        ],
        "explanation": f"字段提取的关键是列定位:名称第 2 列、价格第 5 列。判定器用靶站真实数据逐条比对,这正是生产环境校验爬虫输出的方式。",
    }


def make_t3(num, topic, noun, site):
    base = f"f\"{{SITE_BASE}}/practice/course-test-{num}/api/items.json\""
    question = (f"<h4>任务:直连「{topic}」JSON 接口</h4>"
                f"<p>请求 <code>/practice/course-test-{num}/api/items.json</code>,解析 JSON 数据。</p>"
                f"<p><strong>要求:</strong></p><ul>"
                f"<li>把 <code>data</code> 字段(条目列表)存入变量 <code>items</code></li>"
                f"<li>把 <code>total</code> 字段(总数)存入变量 <code>total</code></li></ul>"
                f"<p class=\"ce-q-spec\">判定标准:items 必须与接口真实返回的 40 条数据完全一致;total == 40。判分器会独立请求接口比对。</p>")
    starter = f"""import requests

# TODO: 请求 JSON 接口,用 .json() 解析
# 把 data 字段(列表)存入变量 items,把 total 字段存入变量 total
# data = requests.get({base.replace('{SITE_BASE}', 'SITE_BASE')}, timeout=10).json()
# items = ...
# total = ...

print("total:", total)
print("条目数:", len(items))"""
    check = f"""import requests as _rq
_exp = _rq.get(SITE_BASE + "/practice/course-test-{num}/api/items.json", timeout=10).json()
assert 'items' in globals() and isinstance(items, list), "请把 data 字段存入变量 items"
assert 'total' in globals(), "请把 total 字段存入变量 total"
assert total == _exp["total"], f"total 应为 {{_exp['total']}},实际 {{total}}"
assert len(items) == len(_exp["data"]), f"应返回 {{len(_exp['data'])}} 条,实际 {{len(items)}}"
assert items == _exp["data"], "items 与接口真实数据不一致,请检查取的是否为 data 字段" """
    return {
        "id": f"course-test-{num}-t3",
        "title": f"实操题 3:直连「{topic}」JSON 接口",
        "skills": ["请求", "存储"], "maxScore": 10,
        "question": question, "starter": starter, "check": check,
        "hintSteps": [
            "JSON 接口返回结构: code / message / total / data[]。",
            "data = requests.get(url, timeout=10).json() 一步拿到整个字典。",
            "items = data['data']; total = data['total'],然后打印验证。",
        ],
        "explanation": "直连 JSON 接口是效率最高的方式。判定器独立请求接口并逐条比对,确保你的解析与真实数据结构完全吻合。",
    }


def main():
    blocks = []
    for num, topic, noun, site in TESTS:
        makers = [make_t1, make_t2, make_t3]
        tasks = [m(num, topic, noun, site) for m in makers]
        entries = []
        for t in tasks:
            entries.append(
                "    {\n"
                f"      id: '{t['id']}',\n"
                f"      title: '{t['title']}',\n"
                f"      skills: {json.dumps(t['skills'], ensure_ascii=False)},\n"
                f"      maxScore: {t['maxScore']},\n"
                f"      question: `{t['question']}`,\n"
                f"      starter: `{t['starter']}`,\n"
                f"      check: `{t['check']}`,\n"
                f"      hintSteps: {json.dumps(t['hintSteps'], ensure_ascii=False)},\n"
                f"      explanation: '{t['explanation']}',\n"
                "    }"
            )
        blocks.append(f"  '{num}': [\n" + ",\n".join(entries) + "\n  ]")
    out = "export const courseTestTasks: Record<string, TaskDef[]> = {\n" + ",\n".join(blocks) + "\n};\n"
    with open("course-tests-v2.ts.tmp", "w", encoding="utf-8") as f:
        f.write(out)
    print("written course-tests-v2.ts.tmp")


if __name__ == "__main__":
    main()