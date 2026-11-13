/**
 * 免登录的本机身份(班级 / 学号)。
 *
 * 设计要点:
 *  - 完全不碰网络、不碰云 SDK,只写 localStorage 的 roster 字段;
 *  - 不收集真实姓名(隐私最小化),真实姓名只在微信登录后的云端档案里登记;
 *  - 写进 roster 后,「导出备份」的 JSON 自带身份,教师离线汇总不必再逐份手填;
 *  - 与阶段 1 的学号口令同步共用同一个 roster 字段,后写覆盖,口径一致。
 */
import { store } from '../lib/store';

function el<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`缺少元素 #${id}`);
  return node as T;
}

function msg(text: string, kind: 'info' | 'error' = 'info'): void {
  const node = el('local-roster-msg');
  node.textContent = text;
  node.dataset.kind = kind;
}

function fill(): void {
  const roster = store.getData().roster;
  if (roster?.classId) el<HTMLSelectElement>('local-class').value = roster.classId;
  if (roster?.studentId) el<HTMLInputElement>('local-no').value = roster.studentId;
  msg(
    roster?.studentId
      ? `已登记 ${roster.classId || '未填班级'} · ${roster.studentId}。这份身份只保存在本机,导出的备份会自动带上。`
      : '尚未填写。不填也能正常上课,只是交给教师的备份需要教师手动补学号。',
  );
}

function save(): void {
  const classId = el<HTMLSelectElement>('local-class').value.trim();
  const studentNo = el<HTMLInputElement>('local-no').value.trim();
  if (!/^[12]班$/.test(classId) || !studentNo || studentNo.length > 24 || /\s/.test(studentNo)) {
    msg('请选择班级,并填写不含空格的学号(最多 24 个字符)。', 'error');
    return;
  }
  store.setRoster(studentNo, classId);
  msg(`已保存 ${classId} · ${studentNo}。之后点「导出备份」即可直接交给教师。`);
}

function clear(): void {
  store.setRoster('', '');
  el<HTMLInputElement>('local-no').value = '';
  msg('已清除本机身份。学习记录不受影响。');
}

fill();
el<HTMLButtonElement>('local-roster-save').addEventListener('click', save);
el<HTMLButtonElement>('local-roster-clear').addEventListener('click', clear);
