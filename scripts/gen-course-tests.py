"""生成 courseTestTasks 的 TS 代码片段(10 套 × 3 题,统一模式保证难度相当)。"""
import json

TESTS = [
    ("01", "城市气候观测", "城市", "城市数据", "36"),   # 站点: 列表24行/json40条/详情8个
    ("02", "数码配件行情", "商品", "数码配件", "36"),
    ("03", "股票行情速览", "股票", "金融数据", "36"),
    ("04", "经典影片榜单", "电影", "光影档案", "36"),
    ("05", "人气餐厅推荐", "餐厅", "食味地图", "36"),
    ("06", "健身器材精选", "器材", "运动装备", "36"),
    ("07", "热门景点排行", "景点", "旅行指南", "36"),
    ("08", "宠物好物推荐", "商品", "萌宠用品", "36"),
    ("09", "专辑热度榜", "专辑", "音乐唱片", "36"),
    ("10", "家居好物甄选", "商品", "生活美学", "36"),
]

# 统一断言主题(每套微调,保证难度相当): 列表24行 / JSON 40条 / 详情8个
def make_task_set(num, topic, noun, site, seed):
    ct = f"course-test-{num}"
    base = f'SITE_BASE + "/practice/{ct}/"'
    title = f"综合测试 {int(num)}: {topic}"
    t1 = {
        "id": f"course-test-{num}-t1",
        "title": f"实操题 1:抓取「{topic}」列表",
        "skills": ["请求", "解析"],
        "maxScore": 10,
        "starter": f"""import requests
from bs4 import BeautifulSoup

r = requests.get({base}, timeout=10)
r.encoding = "utf-8"
soup = BeautifulSoup(r.text, "html.parser")

# TODO 1: 用 CSS 选择器提取所有表格行,存入变量 rows(提示:tbody tr)
# rows = ...

print("抓到行数:", len(rows))""",
        "check": """assert 'rows' in globals(), "未定义变量 rows,请先把表格行存入 rows"
assert len(rows) == 24, f"应抓到 24 行,实际 {len(rows)}" """.strip(),
        "hintSteps": [
            "表格行在 <tbody> 里,每行是 <tr>。CSS 选择器怎么写?",
            "soup.select('tbody tr') 会返回所有表格行,直接赋给 rows 即可。",
            "运行后应看到 '抓到行数: 24'。",
        ],
        "explanation": f"「{topic}」列表页是单页表格,核心套路:requests 请求 → r.encoding 修正编码 → BeautifulSoup 定位 → select 提取。这是所有爬虫的第一步。",
    }
    t2 = {
        "id": f"course-test-{num}-t2",
        "title": f"实操题 2:提取「{noun}」名称与价格",
        "skills": ["解析"],
        "maxScore": 10,
        "starter": f"""import requests
from bs4 import BeautifulSoup

r = requests.get({base}, timeout=10)
r.encoding = "utf-8"
soup = BeautifulSoup(r.text, "html.parser")
rows = soup.select("tbody tr")

# TODO 1: 遍历 rows,把每行的第 2 个 td(名称)与第 5 个 td(价格)提取为元组
# 全部存入变量 items(提示:row.select("td") 取该行的单元格)
# items = ...

print("条目数:", len(items))
print("样例:", items[0] if items else None)""",
        "check": """assert 'items' in globals() and isinstance(items, list), "请把提取结果存入变量 items"
assert len(items) == 24, f"应提取 24 条,实际 {len(items)}"
name, price = items[0]
assert isinstance(name, str) and price.startswith("¥"), "第 1 条应为 (名称, 价格) 元组且价格以 ¥ 开头" """.strip(),
        "hintSteps": [
            "每行有 6 个 td:编号/名称/类别/品牌/价格/评分。名称是第 2 个(td[1]),价格是第 5 个(td[4])。",
            "列表推导式 [ (row.select('td')[1].get_text(), row.select('td')[4].get_text()) for row in rows ]。",
            "用 .strip() 去掉首尾空白,价格单元格里有 ¥ 前缀。",
        ],
        "explanation": f"字段提取的关键是定位列位置:{noun}名称在第 2 列、价格在第 5 列。列位置一变,选择器或下标就要跟着变——这是真实爬虫里最常见的坑。",
    }
    t3 = {
        "id": f"course-test-{num}-t3",
        "title": f"实操题 3:直连「{topic}」JSON 接口",
        "skills": ["请求", "存储"],
        "maxScore": 10,
        "starter": f"""import requests

# TODO 1: 请求 JSON 接口(路径 /api/items.json,拼接在靶站 base 后),用 .json() 解析
# 把 data 字段存入变量 items,把 total 字段存入变量 total
# URL = SITE_BASE + "/practice/{ct}/api/items.json"
# data = ...
# items = ...
# total = ...

print("total:", total)
print("条目数:", len(items))""",
        "check": """assert 'items' in globals() and len(items) == 40, f"JSON 接口应返回 40 条,实际 {len(items)}"
assert 'total' in globals() and total == 40, f"total 应为 40,实际 {total}"
assert isinstance(items[0], dict) and 'name' in items[0], "条目应为字典且包含 name 字段" """.strip(),
        "hintSteps": [
            "JSON 接口返回结构: code / message / total / data[]。",
            "data = requests.get(url, timeout=10).json() 一步拿到整个字典。",
            "items = data['data'],total = data['total'],然后打印验证。",
        ],
        "explanation": "直连 JSON 接口是效率最高的方式:返回结构即数据本身,无需解析 HTML。判断一个页面是静态还是动态,先在 Network 面板找 JSON 请求是最快的路径。",
    }
    return [t1, t2, t3]


def main():
    blocks = []
    for num, topic, noun, site, seed in TESTS:
        tasks = make_task_set(num, topic, noun, site, seed)
        entries = []
        for t in tasks:
            entries.append(
                "    {\n"
                f"      id: '{t['id']}',\n"
                f"      title: '{t['title']}',\n"
                f"      skills: {json.dumps(t['skills'], ensure_ascii=False)},\n"
                f"      maxScore: {t['maxScore']},\n"
                f"      starter: `{t['starter']}`,\n"
                f"      check: `{t['check']}`,\n"
                f"      hintSteps: {json.dumps(t['hintSteps'], ensure_ascii=False)},\n"
                f"      explanation: '{t['explanation']}',\n"
                "    }"
            )
        blocks.append(f"  '{num}': [\n" + ",\n".join(entries) + "\n  ]")
    out = "export const courseTestTasks: Record<string, TaskDef[]> = {\n" + ",\n".join(blocks) + "\n};\n"
    with open("course-tests.ts.tmp", "w", encoding="utf-8") as f:
        f.write(out)
    print("written course-tests.ts.tmp")


if __name__ == "__main__":
    main()