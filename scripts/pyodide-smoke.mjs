import { loadPyodide } from 'pyodide';

const pyodide = await loadPyodide();

// 1) 加载解析包
console.log('-- loadPackage bs4/lxml/requests --');
await pyodide.loadPackage(['beautifulsoup4', 'soupsieve', 'lxml', 'requests']);
console.log('loaded packages:', Object.keys(pyodide.loadedPackages).join(', '));

// 2) BeautifulSoup 解析
console.log('-- BeautifulSoup --');
await pyodide.runPythonAsync(`
from bs4 import BeautifulSoup
html = "<div class='book'><span class='title'>Python 入门</span><span class='price'>59</span></div>"
soup = BeautifulSoup(html, "html.parser")
print("title =", soup.select_one(".title").get_text())
print("price =", soup.select_one(".price").get_text())
`);

// 3) lxml / XPath
console.log('-- lxml XPath --');
await pyodide.runPythonAsync(`
from lxml import html as lh
doc = lh.fromstring("<ul><li class='item'>A</li><li class='item'>B</li></ul>")
print("items =", doc.xpath("//li[@class='item']/text()"))
`);

// 4) requests 网络请求(在 Node 环境测试网络能力)
console.log('-- requests --');
await pyodide.runPythonAsync(`
try:
    import requests
    r = requests.get("https://example.com", timeout=10)
    print("requests status =", r.status_code)
    print("has body =", "Example Domain" in r.text)
except Exception as e:
    print("requests FAILED:", repr(e))
`);

// 5) 全局变量持久化
console.log('-- persistence --');
await pyodide.runPythonAsync('x = 42');
await pyodide.runPythonAsync('print("x persisted =", x)');
