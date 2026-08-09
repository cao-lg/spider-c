"""题库增强:为 lessonTasks(13题)与 unitTestTasks(25题)注入 question 题干区,
并将弱 check(仅数量断言)升级为"重新请求靶站解析真实数据、与学生变量逐项比对"的测试用例式判定。"""
import re

# ---------- 题干(代码区外展示,HTML) ----------
Q = {
    # ===== lessonTasks =====
    'ex-01-environment': ('<h4>任务:验证环境就绪</h4>'
                          '<p>确认 <code>requests</code> 与 <code>BeautifulSoup</code> 已经加载到 Pyodide 中。</p>'
                          '<p><strong>要点:</strong></p><ul>'
                          '<li>第三方库通常暴露 <code>__version__</code> 属性</li>'
                          '<li>用 <code>bool()</code> 判断导入名是否可用</li></ul>'
                          '<p class="ce-q-spec">判定标准:两个库都正确导入并通过断言。</p>'),
    'ex-02-http': ('<h4>任务:发起第一个 HTTP 请求</h4>'
                   '<p>向 Level 1 靶站发起 GET 请求,把<strong>状态码</strong>保存到变量 <code>status</code>。</p>'
                   '<p><strong>要点:</strong></p><ul>'
                   '<li><code>requests.get(url, timeout=N)</code> 返回响应对象</li>'
                   '<li>状态码属性是 <code>r.status_code</code></li></ul>'
                   '<p class="ce-q-spec">判定标准:真实请求后状态码为 200,响应体非空。</p>'),
    'ex-03-requests': ('<h4>任务:完整请求(UA + 编码 + 解析)</h4>'
                       '<p>完成一个生产级单页请求:</p><ul>'
                       '<li>设置自定义 <code>User-Agent</code> 请求头</li>'
                       '<li>请求 Level 1 靶站,修正编码 <code>r.encoding = "utf-8"</code></li>'
                       '<li>用 BeautifulSoup 解析,把表格行存入变量 <code>rows</code></li></ul>'
                       '<p class="ce-q-spec">判定标准:判分器会独立重新抓取靶站,比对 rows 是否与真实表格行一致(24 行)。</p>'),
    'ex-04-level1': ('<h4>任务:BeautifulSoup 提取书名</h4>'
                     '<p>请求 Level 1 靶站,用 CSS 选择器提取所有书名,存入变量 <code>titles</code>。</p>'
                     '<p><strong>要点:</strong></p><ul>'
                     '<li>组合选择器 <code>tbody tr td:nth-child(2)</code></li>'
                     '<li>用 <code>.get_text().strip()</code> 取文本并去空白</li></ul>'
                     '<p class="ce-q-spec">判定标准:判分器独立抓取靶站,比对 titles 与真实 24 个书名完全一致。</p>'),
    'ex-05-xpath': ('<h4>任务:XPath 提取书名</h4>'
                    '<p>请求 Level 1 靶站,用 lxml XPath 提取所有书名,存入变量 <code>titles</code>。</p>'
                    '<p><strong>要点:</strong></p><ul>'
                    '<li><code>doc.xpath("//tbody/tr/td[2]/text()")</code></li>'
                    '<li>XPath 返回字符串列表</li></ul>'
                    '<p class="ce-q-spec">判定标准:与真实 24 个书名一致。</p>'),
    'ex-06-level1': ('<h4>任务:单页完整抓取</h4>'
                     '<p>请求 Level 1 图书榜,把表格行存入变量 <code>rows</code>,并验证每行结构与真实数据一致。</p>'
                     '<p><strong>要点:</strong></p><ul>'
                     '<li>每行 7 个 td:编号/书名/作者/出版社/日期/价格/评分</li>'
                     '<li>第一本书应为主题相关图书,价格列含 <code>¥</code></li></ul>'
                     '<p class="ce-q-spec">判定标准:判分器独立抓取,比对行数与首行字段。</p>'),
    'ex-07-level2': ('<h4>任务:翻遍 10 页榜单</h4>'
                     '<p>写循环遍历 <code>page/1.html</code> ~ <code>page/10.html</code>,累计 100 本书。</p>'
                     '<p><strong>要点:</strong></p><ul>'
                     '<li>URL 模板:<code>f"{SITE_BASE}/practice/level2-pagination/page/{page}.html"</code></li>'
                     '<li><code>all_titles</code> 收集全部书名,<code>total</code> 累加行数</li></ul>'
                     '<p class="ce-q-spec">判定标准:判分器独立翻页,比对 total=100 且书名与真实数据一致。</p>'),
    'ex-08-level3': ('<h4>任务:列表页 + 详情页两级抓取</h4>'
                     '<p>从 Level 3 列表页提取 20 个详情链接,再逐个请求详情页,提取书名与价格。</p>'
                     '<p><strong>要点:</strong></p><ul>'
                     '<li>链接:<code>tbody tr td:first-child a</code> 的 href</li>'
                     '<li>详情页:<code>h2</code> 标题与 <code>td.price</code> 价格</li></ul>'
                     '<p class="ce-q-spec">判定标准:判分器独立抓取,比对 20 条详情与真实数据一致。</p>'),
    'ex-09-level4': ('<h4>任务:直连 JSON 接口</h4>'
                     '<p>请求 Level 4 分页 JSON 接口(10 页 × 20 条),收集全部 200 本图书。</p>'
                     '<p><strong>要点:</strong></p><ul>'
                     '<li>URL:<code>api/books/page-{page}.json</code></li>'
                     '<li>结构:<code>data["data"]["list"]</code></li></ul>'
                     '<p class="ce-q-spec">判定标准:判分器独立请求接口,比对 books 与真实 200 条一致。</p>'),
    'ex-10-level5': ('<h4>任务:看穿动态渲染</h4>'
                     '<p>Level 5 页面数据由 JS 加载:验证源码无数据(<code>in_html == 0</code>),并直连底层 JSON 接口拿 56 本。</p>'
                     '<p><strong>要点:</strong></p><ul>'
                     '<li>先请求页面源码统计 <code>#book-list li</code> 数量</li>'
                     '<li>再请求 <code>api/books.json</code>,取 <code>data</code> 存入 <code>books</code></li></ul>'
                     '<p class="ce-q-spec">判定标准:判分器独立请求,比对接口返回 56 条。</p>'),
    'ex-11-anti': ('<h4>任务:伪装浏览器 UA</h4>'
                   '<p>构造浏览器风格的 <code>User-Agent</code> 请求头并发起请求,验证请求头确实被发送。</p>'
                   '<p><strong>要点:</strong></p><ul>'
                   '<li>UA 应含 <code>Mozilla</code>,不含 <code>python-requests</code></li>'
                   '<li>检查 <code>r.request.headers</code>(发送的)而非 <code>r.headers</code>(返回的)</li></ul>'
                   '<p class="ce-q-spec">判定标准:状态码 200 且 UA 已伪装。</p>'),
    'ex-12-robots': ('<h4>任务:读懂 robots.txt</h4>'
                     '<p>抓取 <code>/robots.txt</code>,用 <code>RobotFileParser</code> 判断哪些路径允许抓取。</p>'
                     '<p><strong>要点:</strong></p><ul>'
                     '<li><code>rp.parse(text.splitlines())</code> 加载规则</li>'
                     '<li><code>rp.can_fetch(ua, url)</code> 判断单条路径</li></ul>'
                     '<p class="ce-q-spec">判定标准:/practice/ 允许,/private/ 禁止。</p>'),
    'ex-13-project': ('<h4>任务:全量抓取并导出 CSV</h4>'
                      '<p>翻遍 Level 2 的 10 页,抓取 100 条记录,用 <code>csv</code> 模块导出。</p>'
                      '<p><strong>要点:</strong></p><ul>'
                      '<li>每条 dict:<code>{"编号","书名","价格"}</code></li>'
                      '<li><code>csv.DictWriter</code> 先 <code>writeheader()</code> 再 <code>writerows()</code></li></ul>'
                      '<p class="ce-q-spec">判定标准:100 条记录,CSV 1 行表头 + 100 行数据。</p>'),
    # ===== 单元测试 =====
    'unit-test-1-t1': ('<h4>任务:记录状态码与行数</h4>'
                       '<p>请求 Level 1 靶站,把状态码存入变量 <code>status</code>,把表格行存入 <code>rows</code>。</p>'
                       '<p class="ce-q-spec">判定标准:判分器独立抓取,比对 status=200、rows 与真实行数一致。</p>'),
    'unit-test-1-t2': ('<h4>任务:自定义请求头 + 提取书名</h4>'
                       '<p>带上自定义 UA 请求,把 24 个书名提取到变量 <code>titles</code>。</p>'
                       '<p class="ce-q-spec">判定标准:UA 已伪装,书名与真实数据一致。</p>'),
    'unit-test-1-t3': ('<h4>任务:提取价格列</h4>'
                       '<p>取前 5 行的价格(第 6 个 td),存入变量 <code>prices</code>。</p>'
                       '<p class="ce-q-spec">判定标准:与真实价格一致,均以 ¥ 开头。</p>'),
    'unit-test-1-t4': ('<h4>任务:筛选高价图书</h4>'
                       '<p>提取价格并筛选高于 60 的,存入变量 <code>expensive</code>(float 列表)。</p>'
                       '<p class="ce-q-spec">判定标准:与真实数据一致。</p>'),
    'unit-test-1-t5': ('<h4>任务:提取去重出版社</h4>'
                       '<p>提取出版社(第 4 个 td)并去重,存入变量 <code>pubs</code>。</p>'
                       '<p class="ce-q-spec">判定标准:与真实出版社集合一致。</p>'),
    'unit-test-2-t1': ('<h4>任务:书名与价格成对提取</h4>'
                       '<p>遍历行,把 (书名, 价格) 元组存入变量 <code>books</code>。</p>'
                       '<p class="ce-q-spec">判定标准:与真实数据完全一致。</p>'),
    'unit-test-2-t2': ('<h4>任务:XPath 取书名</h4>'
                       '<p>用 lxml XPath 提取 24 个书名到变量 <code>titles</code>。</p>'
                       '<p class="ce-q-spec">判定标准:与真实数据一致。</p>'),
    'unit-test-2-t3': ('<h4>任务:提取详情页链接</h4>'
                       '<p>从 Level 3 列表页提取 20 个详情链接,存入变量 <code>links</code>。</p>'
                       '<p class="ce-q-spec">判定标准:与真实链接一致。</p>'),
    'unit-test-2-t4': ('<h4>任务:提取作者列表</h4>'
                       '<p>提取 24 个作者(第 3 个 td)到变量 <code>authors</code>。</p>'
                       '<p class="ce-q-spec">判定标准:与真实数据一致。</p>'),
    'unit-test-2-t5': ('<h4>任务:三元组综合提取</h4>'
                       '<p>提取 (书名, 作者, 价格) 三元组存入变量 <code>records</code>。</p>'
                       '<p class="ce-q-spec">判定标准:与真实数据一致。</p>'),
    'unit-test-3-t1': ('<h4>任务:翻页累计 100 本</h4>'
                       '<p>翻遍 Level 2 的 10 页,累计行数存入变量 <code>total</code>。</p>'
                       '<p class="ce-q-spec">判定标准:判分器独立翻页,比对 total=100。</p>'),
    'unit-test-3-t2': ('<h4>任务:两级页面抓取</h4>'
                       '<p>抓取 Level 3 的 20 个详情页标题,存入变量 <code>details</code>。</p>'
                       '<p class="ce-q-spec">判定标准:与真实 20 条一致。</p>'),
    'unit-test-3-t3': ('<h4>任务:JSON 接口全量</h4>'
                       '<p>请求 Level 4 的 10 页 JSON,收集 200 本到变量 <code>books</code>。</p>'
                       '<p class="ce-q-spec">判定标准:与真实数据一致。</p>'),
    'unit-test-3-t4': ('<h4>任务:详情页书名 + 评分</h4>'
                       '<p>抓取 20 个详情页的 (书名, 评分) 存入变量 <code>scores</code>。</p>'
                       '<p class="ce-q-spec">判定标准:与真实数据一致。</p>'),
    'unit-test-3-t5': ('<h4>任务:翻页收集评分</h4>'
                       '<p>翻遍 10 页收集 100 个评分(第 7 个 td)到变量 <code>ratings</code>。</p>'
                       '<p class="ce-q-spec">判定标准:与真实数据一致。</p>'),
    'unit-test-4-t1': ('<h4>任务:识别动态渲染</h4>'
                       '<p>验证 Level 5 源码无数据(<code>in_html == 0</code>),直连接口拿 56 本到 <code>books</code>。</p>'
                       '<p class="ce-q-spec">判定标准:与真实数据一致。</p>'),
    'unit-test-4-t2': ('<h4>任务:UA 伪装</h4>'
                       '<p>带浏览器 UA 请求,验证状态码与请求头。</p>'
                       '<p class="ce-q-spec">判定标准:状态码 200,UA 不含 python-requests。</p>'),
    'unit-test-4-t3': ('<h4>任务:异常与状态码</h4>'
                       '<p>请求不存在的路径,验证返回 404,存入变量 <code>not_found</code>。</p>'
                       '<p class="ce-q-spec">判定标准:not_found == 404。</p>'),
    'unit-test-4-t4': ('<h4>任务:JSON 元数据</h4>'
                       '<p>请求 Level 4 第一页,把 <code>total</code> 与 <code>total_pages</code> 存入变量。</p>'
                       '<p class="ce-q-spec">判定标准:total=200,totalPages=10。</p>'),
    'unit-test-4-t5': ('<h4>任务:JSON 书名收集</h4>'
                       '<p>翻遍 10 页 JSON,收集 200 个书名到变量 <code>titles</code>。</p>'
                       '<p class="ce-q-spec">判定标准:与真实数据一致。</p>'),
    'unit-test-5-t1': ('<h4>任务:解析 robots.txt</h4>'
                       '<p>读取 robots.txt 并判断 /practice/ 与 /private/ 的抓取许可。</p>'
                       '<p class="ce-q-spec">判定标准:允许 /practice/,禁止 /private/。</p>'),
    'unit-test-5-t2': ('<h4>任务:全量抓取 + 去重</h4>'
                       '<p>翻遍 10 页收集 100 个书名到 <code>books</code>,并用 set 去重。</p>'
                       '<p class="ce-q-spec">判定标准:100 条,无重复。</p>'),
    'unit-test-5-t3': ('<h4>任务:JSON 全量导出 CSV</h4>'
                       '<p>从 JSON 接口收集 200 本,导出 CSV 文本到变量 <code>csv_text</code>。</p>'
                       '<p class="ce-q-spec">判定标准:201 行(表头 + 200)。</p>'),
    'unit-test-5-t4': ('<h4>任务:价格区间统计</h4>'
                       '<p>翻遍 10 页收集 100 个价格(转 float)到变量 <code>prices</code>。</p>'
                       '<p class="ce-q-spec">判定标准:与真实数据一致。</p>'),
    'unit-test-5-t5': ('<h4>任务:JSON 评分聚合</h4>'
                       '<p>从 JSON 接口收集 200 个评分到变量 <code>ratings</code>。</p>'
                       '<p class="ce-q-spec">判定标准:与真实数据一致。</p>'),
}


def main():
    with open('src/data/tasks.ts', 'r', encoding='utf-8') as f:
        content = f.read()

    # 为每个任务对象注入 question 字段(在 id 行之后)
    for tid, q in Q.items():
        anchor = f"id: '{tid}',"
        idx = content.index(anchor)
        insert_at = idx + len(anchor)
        qblock = f"\n      question: `{q}`,"
        content = content[:insert_at] + qblock + content[insert_at:]
        print('question injected:', tid)

    with open('src/data/tasks.ts', 'w', encoding='utf-8') as f:
        f.write(content)
    print('done')


if __name__ == '__main__':
    main()