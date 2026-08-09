// 爬虫学堂 · <py-code-exercise> 自定义元素
// 在 CodeRunner 基础上加入自动判题:
// 学生代码运行后,自动追加隐藏的校验代码;校验通过打印 PASS 标记并计分。

import type { RecordKind } from '../lib/types';
import { buildAttempt } from '../lib/scoring';
import { store } from '../lib/store';
import { runPython, type OutputChunk } from './runner-runtime';

const PASS_MARK = '__GRADE__PASS';
const FAIL_MARK = '__GRADE__FAIL:';

class PyCodeExercise extends HTMLElement {
  private id = '';
  private title = '代码练习';
  /** 完整题干(HTML,显示在代码区外,不含参考答案) */
  private question = '';
  private starter = '';
  private check = '';
  private hint = '';
  private hintSteps: string[] = [];
  private explanation = '';
  private skills: string[] = [];
  private maxScore = 10;
  private recordKey: RecordKind = 'exercise';
  private lessonId = '';
  /** starter 中 # TODO 占位符的初始数量(检测学生是否动过手) */
  private starterTodoCount = 0;

  private editorEl!: HTMLPreElement;
  private runBtn!: HTMLButtonElement;
  private resetBtn!: HTMLButtonElement;
  private consoleEl!: HTMLElement;
  private statusEl!: HTMLElement;
  private feedbackEl!: HTMLElement;

  connectedCallback() {
    if (this.dataset.built) return;
    this.dataset.built = '1';
    this.readConfig();
    this.build();
  }

  private readConfig() {
    const attr = (k: string) => this.getAttribute(k) ?? '';
    this.id = attr('data-id');
    this.title = attr('data-title') || '代码练习';
    this.question = this.decode(attr('data-question'));
    this.starter = this.decode(attr('data-starter'));
    this.check = this.decode(attr('data-check'));
    this.hint = this.decode(attr('data-hint'));
    this.explanation = this.decode(attr('data-explanation'));
    const stepsRaw = this.decode(attr('data-hint-steps') || '[]');
    try {
      this.hintSteps = Array.isArray(stepsRaw) ? stepsRaw.filter((s) => typeof s === 'string') : [];
    } catch {
      this.hintSteps = [];
    }
    this.skills = (this.getAttribute('data-skills') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    this.maxScore = parseInt(attr('data-max-score') || '10', 10) || 10;
    this.recordKey = (attr('data-record-key') as RecordKind) || 'exercise';
    this.lessonId = attr('data-lesson');
    this.starterTodoCount = (this.starter.match(/#\s*TODO\b/g) ?? []).length;
  }

  private decode(s: string): string {
    try {
      return JSON.parse(s);
    } catch {
      return s;
    }
  }

  private build() {
    this.innerHTML = '';

    const root = document.createElement('div');
    root.className = 'code-exercise';

    // 头部
    const head = document.createElement('div');
    head.className = 'code-exercise-head';
    const titleEl = document.createElement('span');
    titleEl.className = 'code-exercise-title';
    titleEl.textContent = this.title;
    head.appendChild(titleEl);
    const scoreTag = document.createElement('span');
    scoreTag.className = 'code-exercise-score';
    scoreTag.textContent = `通过得 ${this.maxScore} 分`;
    head.appendChild(scoreTag);
    root.appendChild(head);

    // 题干区(代码区外,完整题目说明;不包含答案)
    if (this.question) {
      const q = document.createElement('div');
      q.className = 'ce-question';
      q.innerHTML = this.question;
      root.appendChild(q);
    }

    // 任务前提示:刻意练习引导
    if (this.starterTodoCount > 0) {
      const prompt = document.createElement('div');
      prompt.className = 'ce-prompt';
      prompt.innerHTML =
        `<strong>🎯 学习节奏</strong>:` +
        `① 先想清楚思路 → ② 填入 <code># TODO</code> 处 → ③ 点击「运行并判题」`;
      root.appendChild(prompt);
    }

    // 运行器外壳
    const runner = document.createElement('div');
    runner.className = 'py-runner';

    const rhead = document.createElement('div');
    rhead.className = 'py-runner-head';
    const rtitle = document.createElement('span');
    rtitle.className = 'py-runner-title';
    rtitle.textContent = '编写你的代码,然后点「运行并判题」';
    rhead.appendChild(rtitle);
    const actions = document.createElement('div');
    actions.className = 'py-runner-actions';
    this.resetBtn = document.createElement('button');
    this.resetBtn.className = 'btn sm py-runner-reset';
    this.resetBtn.textContent = '重置';
    actions.appendChild(this.resetBtn);
    this.runBtn = document.createElement('button');
    this.runBtn.className = 'btn primary sm py-runner-run';
    this.runBtn.textContent = '▶ 运行并判题';
    actions.appendChild(this.runBtn);
    rhead.appendChild(actions);
    runner.appendChild(rhead);

    this.editorEl = document.createElement('pre');
    this.editorEl.className = 'py-runner-editor';
    this.editorEl.setAttribute('contenteditable', 'true');
    this.editorEl.setAttribute('spellcheck', 'false');
    this.editorEl.textContent = this.starter;
    runner.appendChild(this.editorEl);

    this.consoleEl = document.createElement('div');
    this.consoleEl.className = 'py-runner-console';
    this.consoleEl.style.display = 'none';
    runner.appendChild(this.consoleEl);

    this.statusEl = document.createElement('div');
    this.statusEl.className = 'py-runner-status';
    this.statusEl.textContent = '完成练习后点击「运行并判题」自动评分。';
    runner.appendChild(this.statusEl);

    root.appendChild(runner);

    // 反馈区
    this.feedbackEl = document.createElement('div');
    this.feedbackEl.className = 'code-exercise-feedback';
    this.feedbackEl.hidden = true;
    root.appendChild(this.feedbackEl);

    this.appendChild(root);
    this.bind();
  }

  private bind() {
    this.runBtn.addEventListener('click', () => this.run());
    this.resetBtn.addEventListener('click', () => {
      this.editorEl.textContent = this.starter;
      this.consoleEl.style.display = 'none';
      this.consoleEl.textContent = '';
      this.statusEl.textContent = '已重置为初始代码。';
      this.feedbackEl.hidden = true;
    });
    this.editorEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.run();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        document.execCommand('insertText', false, '    ');
      }
    });
  }

  private log(text: string, isError = false) {
    this.consoleEl.style.display = 'block';
    const line = document.createElement('div');
    if (isError) line.className = 'err';
    line.textContent = text;
    this.consoleEl.appendChild(line);
    this.consoleEl.scrollTop = this.consoleEl.scrollHeight;
  }

  private setStatus(t: string) {
    this.statusEl.textContent = t;
  }

  private showFeedback(kind: 'pass' | 'fail' | 'error', title: string, detail: string) {
    this.feedbackEl.hidden = false;
    this.feedbackEl.className = `code-exercise-feedback ${kind}`;
    this.feedbackEl.innerHTML = '';
    const h = document.createElement('strong');
    h.textContent = title;
    this.feedbackEl.appendChild(h);
    const d = document.createElement('div');
    d.className = 'ce-detail';
    d.textContent = detail;
    this.feedbackEl.appendChild(d);

    // 分步提示(优先)或单条提示
    const steps = this.hintSteps.length > 0 ? this.hintSteps : (this.hint ? [this.hint] : []);
    if (steps.length > 0 && kind !== 'pass') {
      const hintBox = document.createElement('div');
      hintBox.className = 'ce-hint-box';
      const label = document.createElement('div');
      label.className = 'ce-hint-label';
      label.textContent = '💡 提示(按顺序思考,不要急于看完整答案)';
      hintBox.appendChild(label);
      const ol = document.createElement('ol');
      ol.className = 'ce-hint-steps';
      steps.forEach((step, i) => {
        const li = document.createElement('li');
        li.textContent = step;
        li.dataset.idx = String(i);
        // 前 1 步自动展开;其余折叠
        li.classList.add('ce-hint-step');
        if (i > 0) li.classList.add('ce-hint-collapsed');
        const btn = document.createElement('button');
        btn.className = 'btn xs ce-hint-reveal';
        btn.textContent = i === 0 ? '查看' : `展开第 ${i + 1} 步`;
        btn.addEventListener('click', () => {
          li.classList.remove('ce-hint-collapsed');
          btn.disabled = true;
          btn.textContent = '已展开';
        });
        li.appendChild(btn);
        ol.appendChild(li);
      });
      hintBox.appendChild(ol);
      this.feedbackEl.appendChild(hintBox);
    }

    if (this.explanation && kind === 'pass') {
      const ex = document.createElement('div');
      ex.className = 'ce-explanation';
      const label = document.createElement('strong');
      label.textContent = '🎉 解题思路';
      ex.appendChild(label);
      const txt = document.createElement('p');
      txt.textContent = this.explanation;
      ex.appendChild(txt);
      this.feedbackEl.appendChild(ex);
    }

    this.feedbackEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  private async run() {
    const student = this.editorEl.textContent ?? '';
    const full = `${student}\n\n# ==== 自动判题(隐藏) ====\ntry:\n    ${this.check
      .split('\n')
      .join('\n    ')}\n    print("${PASS_MARK}")\nexcept Exception as __ce_err__:\n    print("${FAIL_MARK}", __ce_err__)`;

    this.runBtn.disabled = true;
    this.resetBtn.disabled = true;
    this.consoleEl.style.display = 'block';
    this.consoleEl.textContent = '';
    this.feedbackEl.hidden = true;
    this.setStatus('运行中…');

    let grade: { pass: boolean; message: string } | null = null;
    const start = performance.now();

    const result = await runPython(full, {
      onStatus: (s) => this.setStatus(s),
      onOutput: (c: OutputChunk) => {
        this.log(c.text, c.isError);
        if (!c.isError) {
          if (c.text.includes(PASS_MARK)) grade = { pass: true, message: '' };
          const failIdx = c.text.indexOf(FAIL_MARK);
          if (failIdx >= 0) {
            grade = { pass: false, message: c.text.slice(failIdx + FAIL_MARK.length).trim() };
          }
        }
      },
    });

    this.runBtn.disabled = false;
    this.resetBtn.disabled = false;

    if (!result.ok) {
      this.setStatus('✘ 代码运行出错,请检查后重试');
      this.showFeedback('error', '运行出错', result.error ?? '未知错误');
      return;
    }

    if (grade && grade.pass) {
      const attempt = buildAttempt(this.maxScore, this.maxScore, { passed: true });
      store.recordAttempt(this.recordKey, this.id, attempt, this.skills);
      if (this.lessonId) store.recordLessonCompleted(this.lessonId);
      this.setStatus(`✔ 通过!用时 ${((performance.now() - start) / 1000).toFixed(1)} 秒,获得 ${this.maxScore} 分`);
      this.showFeedback('pass', `✔ 通过,获得 ${this.maxScore} 分`, '全部校验用例通过。');
    } else if (grade) {
      const attempt = buildAttempt(0, this.maxScore, { passed: false });
      store.recordAttempt(this.recordKey, this.id, attempt, this.skills);
      this.setStatus('✘ 未通过校验,请检查输出与要求');
      this.showFeedback('fail', '✘ 未通过', grade.message || '校验未通过,请对照题目要求检查。');
    } else {
      this.setStatus('⚠ 未检测到自动判题标记,请确认代码执行了完整流程');
      this.showFeedback('fail', '⚠ 无法自动判定', '校验代码未能执行完成,请检查是否有异常或死循环。');
    }
  }
}

customElements.define('py-code-exercise', PyCodeExercise);
