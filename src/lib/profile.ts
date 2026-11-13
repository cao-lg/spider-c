/**
 * 学生档案(班级 / 学号 / 姓名)的统一读取与绑定状态广播。
 *
 * 为什么单独抽一层:
 *  - 全站登录条、我的档案、在线考试三处都要判断「这个账号绑定了没有」,
 *    各写一份查询很容易出现「档案页显示已绑定、考试页却说没绑定」。
 *  - 查询失败(断网 / RLS 报错)和「确实没绑定」是两回事:前者不能弹
 *    「请先绑定」去误导学生,所以用 known 区分。
 *  - 缓存放在 sessionStorage:跨页面复用一次查询结果,关掉标签页自然失效,
 *    退出登录或保存档案后由 invalidateProfile 显式清除。
 */
import { cloud, realUid } from './cloud';
import type { CloudSessionData } from './cloud';

export interface StudentProfile {
  id: number | string;
  class_id: string;
  student_no: string;
  real_name: string;
}

export interface ProfileState {
  /** false = 查询失败 / 无法判定,此时不应显示绑定提示 */
  known: boolean;
  profile: StudentProfile | null;
}

export const PROFILE_EVENT = 'crawler-course:profile-changed';
const CACHE_PREFIX = 'crawler-course:profile:';

function cacheKey(uid: string): string {
  return `${CACHE_PREFIX}${uid}`;
}

/** 档案保存 / 删除后调用:清缓存并通知全站重新判定绑定状态。 */
export function invalidateProfile(uid: string, profile: StudentProfile | null = null): void {
  try {
    sessionStorage.removeItem(cacheKey(uid));
  } catch {
    /* 隐私模式下 sessionStorage 可能不可写,忽略即可 */
  }
  document.dispatchEvent(new CustomEvent<StudentProfile | null>(PROFILE_EVENT, { detail: profile }));
}

export function onProfileChange(handler: (profile: StudentProfile | null) => void): void {
  document.addEventListener(PROFILE_EVENT, (event) => {
    handler((event as CustomEvent<StudentProfile | null>).detail);
  });
}

function readCache(uid: string): StudentProfile | null | undefined {
  try {
    const raw = sessionStorage.getItem(cacheKey(uid));
    if (raw === null) return undefined;
    return raw === 'null' ? null : (JSON.parse(raw) as StudentProfile);
  } catch {
    return undefined;
  }
}

function writeCache(uid: string, profile: StudentProfile | null): void {
  try {
    sessionStorage.setItem(cacheKey(uid), profile ? JSON.stringify(profile) : 'null');
  } catch {
    /* ignore */
  }
}

/**
 * 未登录一律返回「已知 + 无档案」:不登录是正常学习路径,不该被当成待绑定。
 * 云端查询只按 owner_id 读自己那一行,RLS 已限制他人不可见。
 */
export async function loadProfile(session: CloudSessionData): Promise<ProfileState> {
  const uid = realUid(session);
  if (!uid) return { known: true, profile: null };

  const cached = readCache(uid);
  if (cached !== undefined) return { known: true, profile: cached };

  try {
    const { data, error } = await cloud.database
      .from('student_profiles')
      .select('id, class_id, student_no, real_name')
      .eq('owner_id', uid)
      .maybeSingle();
    if (error) {
      console.warn('[cloud] 档案读取失败', error);
      return { known: false, profile: null };
    }
    const profile = (data ?? null) as StudentProfile | null;
    writeCache(uid, profile);
    return { known: true, profile };
  } catch (error) {
    console.warn('[cloud] 档案读取异常', error);
    return { known: false, profile: null };
  }
}
