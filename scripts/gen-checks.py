"""为 lessonTasks / unitTestTasks 的目标题重写 check(测试用例式)。
逐题精确定制:判分时重新请求靶站解析真实数据,与学生变量比对。"""
import re

L1 = 'SITE_BASE + "/practice/level1-books/"'
L2 = 'SITE_BASE + "/practice/level2-pagination/"'
L3 = 'SITE_BASE + "/practice/level3-detail/"'
L4 = 'SITE_BASE + "/practice/level4-json-api/api/books/page-"'
L5 = 'SITE_BASE + "/practice/level5-dynamic/api/books.json"'

# (task_id, new_check) 完整替换
CHECKS = {
    # ===== lessonTasks =====
    'ex-03-requests': f"""import requests as _rq
from bs4 import BeautifulSoup as _bs
_src = _rq.get({L1}, timeout=10)
_src.encoding = "utf-8"
_soup = _bs(_src.text, "html.parser")
_expect = [_tr.select("td")[1].get_text().strip() for _tr in _soup.select("tbody tr")]
assert r.status_code == 200, "请求失败"
assert 'python-requests' not in r.request.headers.get('User-Agent', ''), "请设置自定义 User-Agent"
assert 'rows' in globals() and isinstance(rows, list), "请把表格行存入变量 rows"
assert len(rows) == len(_expect), f"应抓到 {{len(_expect)}} 行,实际 {{len(rows)}}"
_got = [row.select("td")[1].get_text().strip() for row in rows]
assert _got == _expect, "提取的行与靶站真实数据不一致,请检查解析逻辑" """,

    'ex-04-level1': f"""import requests as _rq
from bs4 import BeautifulSoup as _bs
_src = _rq.get({L1}, timeout=10)
_src.encoding = "utf-8"
_soup = _bs(_src.text, "html.parser")
_expect = [_tr.select("td")[1].get_text().strip() for _tr in _soup.select("tbody tr")]
assert 'titles' in globals() and isinstance(titles, list), "请把书名存入变量 titles"
assert len(titles) == len(_expect), f"应提取 {{len(_expect)}} 个书名,实际 {{len(titles)}}"
assert titles == _expect, "书名与靶站真实数据不一致,请检查选择器与去空白" """,

    'ex-05-xpath': f"""import requests as _rq
from bs4 import BeautifulSoup as _bs
_src = _rq.get({L1}, timeout=10)
_src.encoding = "utf-8"
_soup = _bs(_src.text, "html.parser")
_expect = [_tr.select("td")[1].get_text().strip() for _tr in _soup.select("tbody tr")]
assert 'titles' in globals() and isinstance(titles, list), "请把书名存入变量 titles"
assert len(titles) == len(_expect), f"XPath 应提取 {{len(_expect)}} 个书名,实际 {{len(titles)}}"
assert titles == _expect, "XPath 提取的书名与靶站真实数据不一致" """,

    'ex-07-level2': f"""import requests as _rq
from bs4 import BeautifulSoup as _bs
_expect = []
for _p in range(1, 11):
    _src = _rq.get(f"{{SITE_BASE}}/practice/level2-pagination/page/{{_p}}.html", timeout=10)
    _src.encoding = "utf-8"
    for _tr in _bs(_src.text, "html.parser").select("tbody tr"):
        _expect.append(_tr.select("td")[1].get_text().strip())
assert 'total' in globals() and total == 100, f"应累计 100 本,实际 {{total}}"
assert 'all_titles' in globals() and isinstance(all_titles, list), "请把书名收集到变量 all_titles"
assert len(all_titles) == len(_expect), f"应收集 {{len(_expect)}} 本,实际 {{len(all_titles)}}"
assert all_titles == _expect, "书名序列与靶站真实数据不一致"
assert len(set(all_titles)) == 100, "书名存在重复" """,

    'ex-08-level3': f"""import requests as _rq
from bs4 import BeautifulSoup as _bs
_src = _rq.get({L3} + "books.html", timeout=10)
_src.encoding = "utf-8"
_soup = _bs(_src.text, "html.parser")
_expect = [a.get("href") for a in _soup.select("tbody tr td:first-child a")]
assert 'links' in globals() and isinstance(links, list), "请把详情链接存入变量 links"
assert len(links) == len(_expect), f"应提取 {{len(_expect)}} 个详情链接,实际 {{len(links)}}"
assert links == _expect, "详情链接与靶站真实数据不一致"
assert 'details' in globals() and len(details) == 20, f"应抓取 20 个详情页,实际 {{len(details)}}"
assert all(d["书名"] and d["价格"].startswith("¥") for d in details), "详情字段提取有误" """,

    'ex-09-level4': f"""import requests as _rq
_expect = []
for _p in range(1, 11):
    _exp = _rq.get(f"{{SITE_BASE}}/practice/level4-json-api/api/books/page-{{_p}}.json", timeout=10).json()
    _expect.extend(_exp["data"]["list"])
assert 'books' in globals() and isinstance(books, list), "请把图书列表存入变量 books"
assert len(books) == len(_expect), f"应收集 {{len(_expect)}} 本,实际 {{len(books)}}"
assert books == _expect, "图书数据与接口真实返回不一致" """,

    'ex-10-level5': f"""import requests as _rq
_exp = _rq.get({L5}, timeout=10).json()
_expect = _exp["data"]
assert in_html == 0, "页面源码里不应直接包含书籍数据(动态渲染)"
assert 'books' in globals() and isinstance(books, list), "请把接口数据存入变量 books"
assert len(books) == len(_expect), f"接口应返回 {{len(_expect)}} 本,实际 {{len(books)}}"
assert books == _expect, "接口数据与真实返回不一致" """,

    # ===== unitTestTasks =====
    'unit-test-1-t2': f"""import requests as _rq
from bs4 import BeautifulSoup as _bs
_src = _rq.get({L1}, timeout=10)
_src.encoding = "utf-8"
_soup = _bs(_src.text, "html.parser")
_expect = [_tr.select("td")[1].get_text().strip() for _tr in _soup.select("tbody tr")]
assert 'python-requests' not in r.request.headers.get('User-Agent', ''), "请设置自定义 User-Agent"
assert 'titles' in globals() and isinstance(titles, list), "请把书名存入变量 titles"
assert len(titles) == len(_expect), f"应提取 {{len(_expect)}} 个书名,实际 {{len(titles)}}"
assert titles == _expect, "书名与靶站真实数据不一致" """,

    'unit-test-1-t3': f"""import requests as _rq
from bs4 import BeautifulSoup as _bs
_src = _rq.get({L1}, timeout=10)
_src.encoding = "utf-8"
_soup = _bs(_src.text, "html.parser")
_expect = [_tr.select("td")[5].get_text().strip() for _tr in _soup.select("tbody tr")][:5]
assert 'prices' in globals() and isinstance(prices, list), "请把价格存入变量 prices"
assert len(prices) == 5, f"应取前 5 行价格,实际 {{len(prices)}} 条"
assert prices == _expect, "价格与靶站真实数据不一致" """,

    'unit-test-1-t5': f"""import requests as _rq
from bs4 import BeautifulSoup as _bs
_src = _rq.get({L1}, timeout=10)
_src.encoding = "utf-8"
_soup = _bs(_src.text, "html.parser")
_expect = list({{_tr.select("td")[3].get_text().strip() for _tr in _soup.select("tbody tr")}})
assert 'pubs' in globals() and isinstance(pubs, list), "请把出版社存入变量 pubs"
assert set(pubs) == set(_expect), "出版社集合与靶站真实数据不一致"
assert len(pubs) == len(set(pubs)), "pubs 应无重复" """,

    'unit-test-2-t4': f"""import requests as _rq
from bs4 import BeautifulSoup as _bs
_src = _rq.get({L1}, timeout=10)
_src.encoding = "utf-8"
_soup = _bs(_src.text, "html.parser")
_expect = [_tr.select("td")[2].get_text().strip() for _tr in _soup.select("tbody tr")]
assert 'authors' in globals() and isinstance(authors, list), "请把作者存入变量 authors"
assert len(authors) == len(_expect), f"应提取 {{len(_expect)}} 个作者,实际 {{len(authors)}}"
assert authors == _expect, "作者与靶站真实数据不一致" """,

    'unit-test-2-t2': f"""import requests as _rq
from bs4 import BeautifulSoup as _bs
_src = _rq.get({L1}, timeout=10)
_src.encoding = "utf-8"
_soup = _bs(_src.text, "html.parser")
_expect = [_tr.select("td")[1].get_text().strip() for _tr in _soup.select("tbody tr")]
assert 'titles' in globals() and isinstance(titles, list), "请把书名存入变量 titles"
assert len(titles) == len(_expect), f"应提取 {{len(_expect)}} 个书名,实际 {{len(titles)}}"
assert titles == _expect, "XPath 书名与靶站真实数据不一致" """,

    'unit-test-2-t3': f"""import requests as _rq
from bs4 import BeautifulSoup as _bs
_src = _rq.get({L3} + "books.html", timeout=10)
_src.encoding = "utf-8"
_soup = _bs(_src.text, "html.parser")
_expect = [a.get("href") for a in _soup.select("tbody tr td:first-child a")]
assert 'links' in globals() and isinstance(links, list), "请把详情链接存入变量 links"
assert len(links) == len(_expect), f"应提取 {{len(_expect)}} 个链接,实际 {{len(links)}}"
assert links == _expect, "详情链接与靶站真实数据不一致" """,

    'unit-test-3-t4': f"""import requests as _rq
from bs4 import BeautifulSoup as _bs
_src = _rq.get({L3} + "books.html", timeout=10)
_src.encoding = "utf-8"
_soup = _bs(_src.text, "html.parser")
_links = [a.get("href") for a in _soup.select("tbody tr td:first-child a")]
_expect = []
for _href in _links:
    _d = _rq.get({L3} + _href, timeout=10)
    _d.encoding = "utf-8"
    _doc = _bs(_d.text, "html.parser")
    _expect.append((_doc.select_one("h2").get_text().strip(), _doc.select_one("td.rating").get_text().strip()))
assert 'scores' in globals() and isinstance(scores, list), "请把 (书名, 评分) 存入变量 scores"
assert len(scores) == len(_expect), f"应抓取 {{len(_expect)}} 条,实际 {{len(scores)}}"
assert scores == _expect, "(书名, 评分) 与靶站真实数据不一致" """,
}


def main():
    with open('src/data/tasks.ts', 'r', encoding='utf-8') as f:
        content = f.read()

    for tid, new in CHECKS.items():
        start = content.index(f"id: '{tid}',")
        ck = content.index('check: `', start)
        end = content.index('`', ck + len('check: `'))
        content = content[:ck] + 'check: `' + new + '`' + content[end + 1:]
        print('check upgraded:', tid)

    with open('src/data/tasks.ts', 'w', encoding='utf-8') as f:
        f.write(content)
    print('done')


if __name__ == '__main__':
    main()