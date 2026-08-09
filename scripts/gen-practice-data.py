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


# ---------------------------------------------------------------------------
# 课程综合测试靶站(course-test-01 ~ course-test-10)
# 10 个同构靶站:结构、数据量、难度完全一致,仅主题内容不同。
# 每个靶站包含:
#   index.html        列表页(24 行表格, 列: 编号/名称/类别/品牌/价格/评分)
#   api/items.json    JSON 接口(40 条, 供直连接口练习)
#   detail/*.html     8 个详情页(供列表+详情两级抓取)
# ---------------------------------------------------------------------------

COURSE_TESTS = [
    {
        'id': 'course-test-01', 'site': '城市数据站', 'topic': '城市气候观测',
        'columns': ['编号', '城市', '气候带', '监测站', '年均温', '评分'],
        'price_col': 4, 'name_col': 1,
        'n_list': 24, 'n_json': 40, 'n_detail': 8,
        'names': ['北京', '上海', '广州', '深圳', '成都', '杭州', '武汉', '西安',
                  '南京', '重庆', '苏州', '天津', '长沙', '郑州', '青岛', '大连',
                  '厦门', '昆明', '哈尔滨', '乌鲁木齐', '拉萨', '兰州', '海口', '桂林'],
        'cats': ['温带季风', '亚热带季风', '热带季风', '高原气候', '温带大陆'],
        'brands': ['华北站', '华东站', '华南站', '西南站', '西北站', '东北站'],
        'desc_pool': ['全年气温记录完整,数据由自动气象站采集。',
                      '气候特征典型,适合分析季节变化规律。',
                      '历史数据丰富,覆盖近十年的观测记录。',
                      '站点维护良好,数据质量经过人工复核。'],
    },
    {
        'id': 'course-test-02', 'site': '智能硬件城', 'topic': '数码配件行情',
        'columns': ['编号', '商品', '品类', '品牌', '价格', '评分'],
        'price_col': 4, 'name_col': 1,
        'n_list': 24, 'n_json': 40, 'n_detail': 8,
        'names': ['无线蓝牙耳机', '机械键盘', '人体工学鼠标', '4K 显示器', '移动固态硬盘',
                  'USB-C 扩展坞', '降噪头戴耳机', '便携充电宝', '智能手环', '桌面音响',
                  '网络摄像头', '无线充电器', '电竞游戏耳机', '数位板', '笔记本支架',
                  'Type-C 数据线', '空气净化器', '智能台灯', '电动牙刷', '筋膜枪',
                  '扫地机器人', '投影仪', '行车记录仪', '电子墨水屏'],
        'cats': ['音频', '外设', '存储', '智能家居', '办公'],
        'brands': ['星环科技', '极光电子', '云雀创新', '锐峰数码', '蓝鲸智造'],
        'desc_pool': ['销量稳定,口碑良好,支持七天无理由退货。',
                      '性价比突出,常驻热门榜单。',
                      '做工扎实,提供两年质保服务。',
                      '新品上市,功能全面,支持固件升级。'],
    },
    {
        'id': 'course-test-03', 'site': '金融数据局', 'topic': '股票行情速览',
        'columns': ['编号', '股票名称', '行业', '交易所', '收盘价', '评分'],
        'price_col': 4, 'name_col': 1,
        'n_list': 24, 'n_json': 40, 'n_detail': 8,
        'names': ['蓝海科技', '星辰生物', '大地能源', '云帆软件', '金穗农业',
                  '远航物流', '磐石建设', '晨光传媒', '恒信金融', '绿洲环保',
                  '璀璨光电', '祥云医疗', '领航教育', '稳健制造', '腾飞汽车',
                  '晶彩半导体', '天穹航天', '润泽水务', '鼎新化工', '华美纺织',
                  '启明智能', '双塔食品', '龙腾影视', '骏马钢铁'],
        'cats': ['科技', '医药', '能源', '消费', '制造', '金融'],
        'brands': ['沪市', '深市'],
        'desc_pool': ['近期成交活跃,换手率处于合理区间。',
                      '业绩稳健,机构持仓比例上升。',
                      '波动适中,适合中长线跟踪。',
                      '市场关注度高,分析师评级为买入。'],
    },
    {
        'id': 'course-test-04', 'site': '光影档案馆', 'topic': '经典影片榜单',
        'columns': ['编号', '电影名称', '类型', '发行公司', '票价', '评分'],
        'price_col': 4, 'name_col': 1,
        'n_list': 24, 'n_json': 40, 'n_detail': 8,
        'names': ['星海彼岸', '风起云涌', '旧城往事', '荒野之歌', '时间之沙',
                  '雾都迷踪', '春日来信', '南方车站', '暗夜行舟', '山河入梦',
                  '孤岛灯塔', '无界行者', '月落长安', '回声山谷', '纸飞机',
                  '深海回响', '零点之前', '远方来客', '暴雨将至', '候鸟迁徙',
                  '雪落无声', '环形日记', '黎明之前', '午后咖啡'],
        'cats': ['剧情', '悬疑', '科幻', '爱情', '动作', '文艺'],
        'brands': ['星光影业', '曙光发行', '云图传媒', '琥珀影视'],
        'desc_pool': ['口碑与票房双丰收,观众评分持续走高。',
                      '叙事扎实,摄影与配乐广受好评。',
                      '入选年度佳作,展映场次常满。',
                      '题材新颖,引发热烈讨论。'],
    },
    {
        'id': 'course-test-05', 'site': '食味地图', 'topic': '人气餐厅推荐',
        'columns': ['编号', '餐厅名称', '菜系', '连锁品牌', '人均消费', '评分'],
        'price_col': 4, 'name_col': 1,
        'n_list': 24, 'n_json': 40, 'n_detail': 8,
        'names': ['老巷小馆', '江南人家', '川香居', '粤味轩', '湘里人家',
                  '东北饺子王', '西北面馆', '沪上小笼', '闽南渔村', '徽州食府',
                  '潮汕牛肉锅', '新疆烤串', '云南过桥米线', '贵州酸汤鱼', '兰州拉面',
                  '重庆小面', '成都冒菜', '武汉热干面', '沙县小吃', '天津狗不理',
                  '北京烤鸭店', '澳门猪扒包', '港式茶餐厅', '台湾卤肉饭'],
        'cats': ['川菜', '粤菜', '湘菜', '东北菜', '西北菜', '本帮菜'],
        'brands': ['巷子餐饮', '一味集团', '舌尖餐饮', '灶火餐饮'],
        'desc_pool': ['环境干净卫生,高峰期需排队等位。',
                      '招牌菜口碑极佳,回头客众多。',
                      '价格实惠,分量十足。',
                      '食材新鲜,出餐速度快。'],
    },
    {
        'id': 'course-test-06', 'site': '运动装备库', 'topic': '健身器材精选',
        'columns': ['编号', '器材名称', '类别', '品牌', '价格', '评分'],
        'price_col': 4, 'name_col': 1,
        'n_list': 24, 'n_json': 40, 'n_detail': 8,
        'names': ['可调节哑铃', '瑜伽垫', '跑步机', '动感单车', '杠铃套装',
                  '健腹轮', '跳绳', '阻力带', '椭圆机', '划船机',
                  '俯卧撑支架', '引体向上杆', '壶铃', '沙袋', '握力器',
                  '泡沫轴', '弹力绳', '负重背心', '拳击手套', '运动手环',
                  '篮球', '羽毛球拍', '乒乓球桌', '网球拍'],
        'cats': ['力量训练', '有氧运动', '瑜伽拉伸', '球类运动', '户外装备'],
        'brands': ['力拓体育', '驰风运动', '劲能健身', '跃动装备'],
        'desc_pool': ['用料扎实,承重能力强,适合家用训练。',
                      '符合国际安全标准,通过质量认证。',
                      '轻便易收纳,不占空间。',
                      '多档可调,满足不同强度训练需求。'],
    },
    {
        'id': 'course-test-07', 'site': '旅行者指南', 'topic': '热门景点排行',
        'columns': ['编号', '景点名称', '类型', '运营方', '门票价格', '评分'],
        'price_col': 4, 'name_col': 1,
        'n_list': 24, 'n_json': 40, 'n_detail': 8,
        'names': ['云海天池', '古寺钟声', '翡翠峡谷', '月光沙滩', '千年古镇',
                  '森林氧吧', '雪山之巅', '碧波湖泊', '红色圣地', '温泉小镇',
                  '大漠孤烟', '梯田风光', '海滨栈道', '岩溶奇洞', '星空营地',
                  '湿地公园', '茶园山丘', '峡谷漂流', '空中走廊', '民俗村落',
                  '灯塔海岸', '雨林探秘', '冰川遗迹', '火山地貌'],
        'cats': ['自然风光', '人文古迹', '主题乐园', '休闲度假', '户外探险'],
        'brands': ['景区管委会', '文旅集团', '旅游开发公司'],
        'desc_pool': ['景色优美,四季皆宜游览。',
                      '配套设施完善,交通便利。',
                      '历史文化底蕴深厚,讲解服务专业。',
                      '游客体验良好,节假日人流量大。'],
    },
    {
        'id': 'course-test-08', 'site': '萌宠用品店', 'topic': '宠物好物推荐',
        'columns': ['编号', '商品名称', '适用宠物', '品牌', '价格', '评分'],
        'price_col': 4, 'name_col': 1,
        'n_list': 24, 'n_json': 40, 'n_detail': 8,
        'names': ['猫粮', '狗粮', '猫砂', '宠物玩具', '牵引绳',
                  '宠物窝', '自动喂食器', '饮水机', '宠物梳子', '指甲剪',
                  '宠物背包', '训练零食', '宠物洗护液', '除毛器', '宠物帐篷',
                  '猫咪爬架', '狗狗雨衣', '宠物凉席', '宠物垫', '喂药器',
                  '宠物监控摄像头', '超声波驱虫器', '宠物自动门', '宠物推车'],
        'cats': ['食品', '用品', '玩具', '护理', '出行'],
        'brands': ['爪爪宠物', '毛球之家', '旺财宠物', '喵喵优品'],
        'desc_pool': ['原料安全,经过严格质检。',
                      '使用体验好,宠物接受度高。',
                      '性价比高,复购率稳定。',
                      '环保材质,对宠物健康友好。'],
    },
    {
        'id': 'course-test-09', 'site': '音乐唱片行', 'topic': '专辑热度榜',
        'columns': ['编号', '专辑名称', '音乐类型', '唱片公司', '售价', '评分'],
        'price_col': 4, 'name_col': 1,
        'n_list': 24, 'n_json': 40, 'n_detail': 8,
        'names': ['无声告白', '城市之光', '远方的风', '深海梦境', '夏日序曲',
                  '月光小调', '霓虹都市', '原野回声', '蓝色街灯', '纸船漂流',
                  '星河漫步', '半山听雨', '候鸟归途', '梦里花开', '尘埃之舞',
                  '午夜电台', '青色季节', '逆光而行', '晚风轻抚', '平行时空',
                  '微光之城', '云端漫步', '枕边童话', '时光机'],
        'cats': ['流行', '摇滚', '民谣', '电子', '古典', '爵士'],
        'brands': ['风铃唱片', '音符国际', '星轨音乐', '回声录音'],
        'desc_pool': ['编曲精良,制作水准在线。',
                      '主打歌传唱度高,听众口碑一致好评。',
                      '风格独特,是乐迷必入的收藏之作。',
                      '发行首周即登顶热度榜。'],
    },
    {
        'id': 'course-test-10', 'site': '生活美学馆', 'topic': '家居好物甄选',
        'columns': ['编号', '商品名称', '品类', '品牌', '价格', '评分'],
        'price_col': 4, 'name_col': 1,
        'n_list': 24, 'n_json': 40, 'n_detail': 8,
        'names': ['北欧风沙发', '实木餐桌', '记忆棉床垫', '落地灯', '陶瓷餐具',
                  '香薰蜡烛', '加湿器', '收纳箱', '装饰画', '懒人沙发',
                  '全棉四件套', '地毯', '窗帘', '绿植盆栽', '咖啡机',
                  '空气炸锅', '保温杯', '餐具消毒柜', '智能门锁', '指纹保险箱',
                  '无火香薰', '懒人桌', '墙面置物架', '人体工学椅'],
        'cats': ['家具', '灯具', '家纺', '厨具', '收纳', '装饰'],
        'brands': ['栖居生活', '简素家居', '暖巢家居', '匠心木作'],
        'desc_pool': ['设计简约大方,融入各种家居风格。',
                      '用料环保,做工精细。',
                      '功能实用,提升生活品质。',
                      '好评如潮,是家居博主的常客单品。'],
    },
]


class CtItem:
    """综合测试靶站的条目(城市/商品/电影等,同构字段: 名称/类别/品牌/价格/评分/描述)"""
    __slots__ = ('id', 'name', 'category', 'brand', 'price', 'rating', 'desc')

    def __init__(self, iid, name, category, brand, price, rating, desc):
        self.id = iid
        self.name = name
        self.category = category
        self.brand = brand
        self.price = price
        self.rating = rating
        self.desc = desc

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'category': self.category,
            'brand': self.brand,
            'price': self.price,
            'rating': self.rating,
            'desc': self.desc,
        }


def make_ct_items(cfg, n):
    r = random.Random(20260101 + int(cfg['id'].split('-')[-1]))
    items = []
    names = cfg['names']
    for i in range(n):
        name = names[i % len(names)] + ('' if i < len(names) else f' {i // len(names) + 1} 号')
        items.append(CtItem(
            f'{cfg["id"].split("-")[-1]}-{i + 1:04d}',
            name,
            r.choice(cfg['cats']),
            r.choice(cfg['brands']),
            r.choice([29, 39, 49, 59, 69, 79, 89, 99, 119, 139]),
            round(r.uniform(3.6, 5.0), 1),
            r.choice(cfg['desc_pool']),
        ))
    return items


def gen_course_test(cfg):
    prefix = cfg['id']  # course-test-01
    site_title = f'{cfg["site"]} · {cfg["topic"]}'
    cols = cfg['columns']
    price_col = cfg['price_col']
    name_col = cfg['name_col']

    # 列表页(index.html): 24 行
    items_list = make_ct_items(cfg, cfg['n_list'])
    head = page_header(site_title, f'{cfg["topic"]} · 课程综合测试靶站 {prefix}')
    th = ''.join(f'<th>{c}</th>' for c in cols)
    rows = ''.join(
        f'<tr><td>{b.id}</td>'
        f'<td>{html.escape(b.name)}</td>'
        f'<td>{html.escape(b.category)}</td>'
        f'<td>{html.escape(b.brand)}</td>'
        f'<td class="price">¥{b.price}</td>'
        f'<td class="rating">{b.rating}</td></tr>'
        for b in items_list)
    body = f'''<div class="wrap">
  <div class="panel">
    <h2>{cfg["topic"]}榜单 <span class="meta">共 {cfg['n_list']} 条</span></h2>
    <table>
      <thead><tr>{th}</tr></thead>
      <tbody>{rows}</tbody>
    </table>
  </div>
{page_footer()}'''
    write(f'{prefix}/index.html', head + body)

    # JSON 接口(api/items.json): 40 条
    items_json = make_ct_items(cfg, cfg['n_json'])
    payload = {'code': 0, 'message': 'success', 'total': len(items_json),
               'data': [b.to_dict() for b in items_json]}
    write(f'{prefix}/api/items.json', json.dumps(payload, ensure_ascii=False, indent=2))
    api_doc = f'''<div class="wrap">
  <div class="panel">
    <h2>接口说明</h2>
    <p>GET <code>/practice/{prefix}/api/items.json</code> — 返回 {cfg['n_json']} 条{cfg['topic']}数据。</p>
    <p class="meta">返回结构: code / message / total / data[];每条含 id、name、category、brand、price、rating、desc。</p>
  </div>
{page_footer()}'''
    write(f'{prefix}/api/index.html', page_header(f'{site_title} · JSON 接口', '课程综合测试靶站') + api_doc)

    # 详情页(detail/*.html): 8 个
    items_detail = make_ct_items(cfg, cfg['n_detail'])
    head_detail = page_header(f'{site_title} · 详情页', '课程综合测试靶站')
    rows = ''.join(
        f'<tr><td><a href="detail/{b.id}.html">{html.escape(b.name)}</a></td>'
        f'<td>{html.escape(b.category)}</td>'
        f'<td class="price">¥{b.price}</td>'
        f'<td class="rating">{b.rating}</td></tr>'
        for b in items_detail)
    body = f'''<div class="wrap">
  <div class="panel">
    <h2>列表页(详情入口)</h2>
    <table>
      <thead><tr><th>{cols[name_col]}</th><th>{cols[2]}</th><th>{cols[price_col]}</th><th>{cols[5]}</th></tr></thead>
      <tbody>{rows}</tbody>
    </table>
  </div>
{page_footer()}'''
    write(f'{prefix}/detail/index.html', head_detail + body)
    for b in items_detail:
        detail = f'''<div class="wrap">
  <div class="panel">
    <h2>{html.escape(b.name)}</h2>
    <table>
      <tr><th>{cols[name_col]}</th><td>{html.escape(b.name)}</td></tr>
      <tr><th>{cols[2]}</th><td>{html.escape(b.category)}</td></tr>
      <tr><th>{cols[3]}</th><td>{html.escape(b.brand)}</td></tr>
      <tr><th>{cols[price_col]}</th><td class="price">¥{b.price}</td></tr>
      <tr><th>{cols[5]}</th><td class="rating">{b.rating}</td></tr>
    </table>
    <h3>详情</h3>
    <p>{html.escape(b.desc)}</p>
    <p style="margin-top:18px"><a href="../index.html">← 返回列表</a></p>
  </div>
{page_footer()}'''
        write(f'{prefix}/detail/{b.id}.html', detail)


def main():
    print('生成靶站数据…')
    books = make_books(400)
    print(f'共生成 {len(books)} 本图书')
    gen_level1(books[:24])
    gen_level2(books[24:124])
    gen_level3(books[124:144])
    gen_level4(books[144:344])
    gen_level5(books[344:400])
    print('生成课程综合测试靶站…')
    for cfg in COURSE_TESTS:
        gen_course_test(cfg)
    print('完成。')


if __name__ == '__main__':
    main()
