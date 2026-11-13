#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""校验 src/data/tasks.ts 中每个 starter / check 模板字符串是合法 Python 语法。

为什么需要它:
    实操题的判分逻辑写在 check 字符串里,由浏览器内 Pyodide 直接 exec。
    一旦某个 check(或 starter)本身有语法错误,整道题会直接抛异常、学生无法判题,
    而构建/类型检查都发现不了——因为它是被当成普通字符串存储的。
    本脚本在 prebuild/verify 阶段用 ast.parse 把每段 Python 源码编译一遍,
    把"判题代码自己写错"这类问题挡在发布之前。

运行: python scripts/check-task-checks.py
"""

import ast
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TARGET = ROOT / "src" / "data" / "tasks.ts"

# starter / check 都是反引号模板字符串,且内部不含反引号
_PATTERN = re.compile(r"(starter|check):\s*`([^`]*)`")


def main() -> int:
    if not TARGET.exists():
        print(f"❌ 找不到 {TARGET}")
        return 1

    text = TARGET.read_text(encoding="utf-8")
    errors: list[str] = []
    checked = 0

    for m in _PATTERN.finditer(text):
        kind = m.group(1)          # "starter" / "check"
        body = m.group(2)          # Python 源码
        # 字符串在源文件中的起始行(1-based)
        start_line = text.count("\n", 0, m.start(2)) + 1
        checked += 1
        try:
            ast.parse(body, filename=f"tasks.ts:{kind}:{start_line}")
        except SyntaxError as e:
            # e.lineno 是相对模板串内部的行号
            abs_line = start_line + (e.lineno or 1) - 1
            snippet = (e.text or "").strip()
            errors.append(f"[{kind}] 第 {abs_line} 行: {e.msg} -> {snippet}")

    if errors:
        print(f"❌ 发现 {len(errors)} 处 Python 语法错误(共校验 {checked} 段 starter/check):")
        for err in errors:
            print("   -", err)
        return 1

    print(f"✅ 校验通过:共 {checked} 段 starter/check 均为合法 Python 语法。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
