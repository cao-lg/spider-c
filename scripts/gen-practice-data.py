#!/usr/bin/env python3
"""生成靶向练习站(public/practice/)的数据与页面。

仅使用 Python 标准库。确定性随机种子,可重复生成。
产出:
  level1-books/            单页表格(24 本)
  level2-pagination/       路径分页,10 页 × 10 本
  level3-detail/           列表页 + 20 个详情页
  level4-json-api/         JSON 接口文档 + 10 个 JSON 分页文件(200 本)
  level5-dynamic/          JS 动态渲染页 + JSON 数据(12 本)
"""

import html
import json
import os
import random

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', 'public', 'practice'))

rng = random.Random(20260808)

TOPICS = [
    ('Python 开发', 'Python'), ('数据分析', 'Python'), ('网络爬虫', 'Python'),
    ('Web 开发', 'Python'), ('机器学习', 'AI'), ('深度学习', 'AI'),
    ('算法与数据结构', '算法'), ('操作系统', '系统'), ('计算机网络', '网络'),
    ('数据库', '数据库'), ('DevOps', '运维'), ('云计算', '运维'),
    ('前端开发', '前端'), ('后端工程', '后端'), ('安全攻防', '安全'),
    ('Go 语言', '后端'), ('Rust 语言', '后端'), ('Java 工程', '后端'),
    ('软件测试', '工程'), ('性能优化', '工程'),
]
STYLES = [
    '入门到实践', '从零开始', '实战指南', '核心原理', '权威指南',
    '高效编程', '进阶之路', '设计模式', '项目实战', '源码剖析',
    '工程师手册', '快速上手', '深入学习', '编程之道', '企业级应用',
    '最佳实践', '面试宝典', '开发日志', '零基础教程', '全栈之路',
]
AUTHORS = ['李强', '王磊', '张伟', '刘洋', '陈静', '杨帆', '赵敏', '黄俊',
           '周涛', '吴倩', '徐磊', '孙悦', '马超', '朱琳', '胡军', '郭涛',
           '何娜', '高翔', '林峰', '罗雪', '苏晴', '韩雪', '秦峰', '曹阳']
PUBLISHERS = ['人民邮电出版社', '电子工业出版社', '机械工业出版社', '清华大学出版社',
              '北京大学出版社', '异步图书', '博文视点', '图灵教育', '中国电力出版社',
              '清华-伯克利出版中心']
DESC_POOL = [
    '系统讲解基础概念与进阶技巧,配以大量可运行的示例代码。',
    '结合真实项目案例,深入剖析背后的原理与最佳实践。',
    '从零构建完整的实战项目,涵盖开发、测试与部署全流程。',
    '适合入门读者循序渐进地学习,也适合进阶读者查漏补缺。',
    '聚焦生产环境中的常见问题与解决方案,即学即用。',
    '丰富的图表与代码演示,让抽象概念变得直观易懂。',
    '汇集一线工程师多年经验,内容贴近企业真实研发场景。',
    '配套在线练习与配套资料,帮助你巩固所学知识点。',
]


class Book:
    __slots__ = ('id', 'title', 'author', 'publisher', 'price', 'rating',
                 'pubdate', 'isbn', 'category', 'description')

    def __init__(self, bid, topic, style, author, publisher, price, rating,
                 pubdate, isbn, category, description):
        self.id = bid
        self.title = f'{topic} · {style}'
        self.author = author
        self.publisher = publisher
        self.price = price
        self.rating = rating
        self.pubdate = pubdate
        self.isbn = isbn
        self.category = category
        self.description = description

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'author': self.author,
            'publisher': self.publisher,
            'price': self.price,
            'rating': self.rating,
            'pubdate': self.pubdate,
            'isbn': self.isbn,
            'category': self.category,
            'description': self.description,
        }


def make_books(n):
    books = []
    used_titles = set()
    while len(books) < n:
        topic, category = rng.choice(TOPICS)
        style = rng.choice(STYLES)
        title = f'{topic} · {style}'
        if title in used_titles:
            continue
        used_titles.add(title)
        bid = f'B{len(books) + 1:04d}'
        books.append(Book(
            bid,
            topic, style,
            rng.choice(AUTHORS),
            rng.choice(PUBLISHERS),
            rng.choice([39, 49, 59, 69, 79, 89, 99, 109, 129, 139]),
            round(rng.uniform(3.8, 5.0), 1),
            f'{rng.randint(2016, 2025)}-{rng.randint(1, 12):02d}',
            f'978-7-{rng.randint(100, 999)}-{rng.randint(10000, 99999)}-{rng.randint(0, 9)}',
            category,
            rng.choice(DESC_POOL),
        ))
    return books


PAGE_CSS = """
  body { font-family: "PingFang SC","Microsoft YaHei",sans-serif; margin: 0; background: #f4f1ea; color: #333; }
  .wrap { max-width: 920px; margin: 0 auto; padding: 24px 16px 60px; }
  header.site { background: #2b3a4a; color: #fff; padding: 14px 24px; }
  header.site h1 { margin: 0; font-size: 20px; font-weight: 600; }
  header.site .sub { font-size: 13px; opacity: .85; margin-top: 2px; }
  .panel { background: #fff; border: 1px solid #ddd; border-radius: 6px; padding: 18px; margin-top: 18px; box-shadow: 0 1px 3px rgba(0,0,0,.06); }
  h2 { font-size: 17px; margin: 0 0 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th, td { border-bottom: 1px solid #e5e5e5; padding: 9px 8px; text-align: left; }
  th { background: #f0f0f0; font-weight: 600; }
  tr:hover td { background: #faf7f0; }
  .price { color: #c0392b; font-weight: 600; }
  .rating { color: #b9770e; }
  .pager { margin-top: 16px; display: flex; gap: 6px; align-items: center; justify-content: center; font-size: 14px; }
  .pager a, .pager span { padding: 5px 10px; border: 1px solid #ccc; border-radius: 4px; background: #fff; text-decoration: none; color: #2b3a4a; }
  .pager span.cur { background: #2b3a4a; color: #fff; }
  .footer { margin-top: 30px; font-size: 12px; color: #999; text-align: center; }
  .meta { color: #777; font-size: 13px; }
  a { color: #1a5276; }
"""


def page_header(title, sub):
    return f'''<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>{html.escape(title)}</title>
<style>{PAGE_CSS}</style>
</head>
<body>
<header class="site"><div class="wrap" style="padding:0"><h1>{html.escape(title)}</h1><div class="sub">{html.escape(sub)}</div></div></header>
'''


def page_footer():
    return '<div class="footer">本站为爬虫课程练习靶站,仅用于学习爬虫技术</div>\n</body>\n</html>\n'


def book_row(b, with_id=False, link=None):
    lid = f'<td><a href="{link}">{html.escape(b.title)}</a></td>' if link else f'<td>{html.escape(b.title)}</td>'
    id_cell = f'<td>{html.escape(b.id)}</td>' if with_id else ''
    return (f'<tr>{id_cell}{lid}'
            f'<td>{html.escape(b.author)}</td>'
            f'<td>{html.escape(b.publisher)}</td>'
            f'<td>{b.pubdate}</td>'
            f'<td class="price">¥{b.price}</td>'
            f'<td class="rating">{b.rating}</td></tr>')


def write(path, content):
    full = os.path.join(ROOT, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, 'w', encoding='utf-8') as f:
        f.write(content)
    print('  wrote', os.path.relpath(full, ROOT))


def gen_level1(books):
    head = page_header('知墨书店 · 本周热销', '共 {} 本图书 · 教学靶站 Level 1'.format(len(books)))
    rows = ''.join(book_row(b, with_id=True) for b in books)
    body = f'''<div class="wrap">
  <div class="panel">
    <h2>热销图书榜</h2>
    <table>
      <thead><tr><th>编号</th><th>书名</th><th>作者</th><th>出版社</th><th>出版日期</th><th>价格</th><th>评分</th></tr></thead>
      <tbody>{rows}</tbody>
    </table>
  </div>
{page_footer()}'''
    write('level1-books/index.html', head + body)


def gen_level2(books, page_size=10):
    head = page_header('知墨书店 · 全部图书', '路径分页 · 教学靶站 Level 2')
    pages = [books[i:i + page_size] for i in range(0, len(books), page_size)]
    write('level2-pagination/index.html', '<meta http-equiv="refresh" content="0; url=./page/1.html">')
    for idx, chunk in enumerate(pages, 1):
        rows = ''.join(book_row(b, with_id=True) for b in chunk)
        pager = []
        for n in range(1, len(pages) + 1):
            if n == idx:
                pager.append(f'<span class="cur">{n}</span>')
            else:
                pager.append(f'<a href="./{n}.html">{n}</a>')
        nav = ('<div class="pager">'
               + (f'<a href="./{idx-1}.html">上一页</a>' if idx > 1 else '<span>上一页</span>')
               + ' '.join(pager)
               + (f'<a href="./{idx+1}.html">下一页</a>' if idx < len(pages) else '<span>下一页</span>')
               + '</div>')
        body = f'''<div class="wrap">
  <div class="panel">
    <h2>全部图书 <span class="meta">第 {idx} / {len(pages)} 页</span></h2>
    <table>
      <thead><tr><th>编号</th><th>书名</th><th>作者</th><th>出版社</th><th>出版日期</th><th>价格</th><th>评分</th></tr></thead>
      <tbody>{rows}</tbody>
    </table>
    {nav}
  </div>
{page_footer()}'''
        write(f'level2-pagination/page/{idx}.html', head + body)


def gen_level3(books):
    head = page_header('知墨书店 · 图书详情', '列表页 + 详情页 · 教学靶站 Level 3')
    rows = ''.join(
        f'<tr><td><a href="books/{b.id}.html">{html.escape(b.title)}</a></td>'
        f'<td>{html.escape(b.author)}</td>'
        f'<td class="price">¥{b.price}</td>'
        f'<td class="rating">{b.rating}</td></tr>'
        for b in books)
    body = f'''<div class="wrap">
  <div class="panel">
    <h2>图书列表</h2>
    <table>
      <thead><tr><th>书名</th><th>作者</th><th>价格</th><th>评分</th></tr></thead>
      <tbody>{rows}</tbody>
    </table>
  </div>
{page_footer()}'''
    write('level3-detail/books.html', head + body)

    for b in books:
        detail_head = page_header(b.title, '图书详情页 · 教学靶站 Level 3')
        detail = f'''<div class="wrap">
  <div class="panel">
    <h2>{html.escape(b.title)}</h2>
    <p class="meta">编号: {b.id} · ISBN: {b.isbn} · 分类: {html.escape(b.category)}</p>
    <table>
      <tr><th>作者</th><td>{html.escape(b.author)}</td></tr>
      <tr><th>出版社</th><td>{html.escape(b.publisher)}</td></tr>
      <tr><th>出版日期</th><td>{b.pubdate}</td></tr>
      <tr><th>价格</th><td class="price">¥{b.price}</td></tr>
      <tr><th>评分</th><td class="rating">{b.rating}</td></tr>
    </table>
    <h3>内容简介</h3>
    <p>{html.escape(b.description)}</p>
    <p style="margin-top:18px"><a href="../books.html">← 返回列表</a></p>
  </div>
{page_footer()}'''
        write(f'level3-detail/books/{b.id}.html', detail_head + detail)


def gen_level4(books, page_size=20):
    head = page_header('知墨书店 · 开放接口', 'JSON API · 教学靶站 Level 4')
    pages = [books[i:i + page_size] for i in range(0, len(books), page_size)]
    api_index = []
    for idx, chunk in enumerate(pages, 1):
        payload = {
            'code': 0,
            'message': 'success',
            'data': {
                'page': idx,
                'pageSize': page_size,
                'total': len(books),
                'totalPages': len(pages),
                'list': [b.to_dict() for b in chunk],
            },
        }
        write(f'level4-json-api/api/books/page-{idx}.json', json.dumps(payload, ensure_ascii=False, indent=2))
        api_index.append(f'  <li><code>GET /practice/level4-json-api/api/books/page-{idx}.json</code> — 第 {idx} 页</li>')

    endpoints = '\n'.join(api_index)
    body = f'''<div class="wrap">
  <div class="panel">
    <h2>接口说明</h2>
    <p>本接口为教学用 JSON 接口,返回图书分页数据。共 {len(books)} 条,每页 {page_size} 条,{len(pages)} 页。</p>
    <h3>接口列表</h3>
    <ul>
{endpoints}
    </ul>
    <h3>返回结构示例</h3>
    <pre>{html.escape(json.dumps({'code': 0, 'message': 'success', 'data': {'page': 1, 'pageSize': 20, 'total': 200, 'totalPages': 10, 'list': [books[0].to_dict()]}}, ensure_ascii=False, indent=2))}</pre>
  </div>
{page_footer()}'''
    write('level4-json-api/index.html', head + body)


def gen_level5(books):
    payload = {'code': 0, 'message': 'success', 'data': [b.to_dict() for b in books]}
    write('level5-dynamic/api/books.json', json.dumps(payload, ensure_ascii=False, indent=2))

    head = page_header('知墨书店 · 动态加载', 'JS 渲染页面 · 教学靶站 Level 5')
    body = f'''<div class="wrap">
  <div class="panel">
    <h2>推荐书目</h2>
    <p class="meta">本页数据由 JavaScript 动态加载,直接查看页面源代码看不到图书数据。</p>
    <ul id="book-list"></ul>
  </div>
{page_footer()}
<script>
  fetch('api/books.json')
    .then(function (r) {{ return r.json(); }})
    .then(function (d) {{
      var ul = document.getElementById('book-list');
      d.data.forEach(function (b) {{
        var li = document.createElement('li');
        li.textContent = b.title + ' — ' + b.author + ' (¥' + b.price + ', 评分 ' + b.rating + ')';
        ul.appendChild(li);
      }});
    }});
</script>'''
    write('level5-dynamic/index.html', head + body)


def main():
    print('生成靶站数据…')
    books = make_books(400)
    print(f'共生成 {len(books)} 本图书')
    gen_level1(books[:24])
    gen_level2(books[24:124])
    gen_level3(books[124:144])
    gen_level4(books[144:344])
    gen_level5(books[344:400])
    print('完成。')


if __name__ == '__main__':
    main()
