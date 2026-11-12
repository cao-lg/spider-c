/**
 * 云服务客户端单例。
 *
 * 全站只在这里 createWorkBuddyCloud 一次;认证、数据库都复用同一个实例,
 * 登录后 SDK 会自动把会话附加到数据库请求上,前端绝不手工传 owner_id 或 token。
 */
import { createWorkBuddyCloud } from '@tencent-ai/workbuddy-cloud-sdk';
import type { CloudSession } from '@tencent-ai/workbuddy-cloud-sdk';
import { publicConfig } from './cloud-config';

/**
 * 未传 Database 泛型时,该 SDK 版本把 PostgREST 行类型收窄成 never,
 * 导致所有 insert/update 都无法通过类型检查。这里用宽松泛型保留运行时能力,
 * 业务层再用各自的 Row 接口做断言(见 account-client / exam-*-client)。
 * 认证侧仍使用 SDK 的精确 CloudSession 类型。
 */
export const cloud = createWorkBuddyCloud<any>({
  endpoint: publicConfig.endpoint,
  oauthRelayBaseUrl: publicConfig.oauthRelayBaseUrl,
  publishableKey: publicConfig.publishableKey,
});

export type CloudSessionData = CloudSession | null;

/** 页面级登录态变化事件,供档案页 / 考试页刷新界面。 */
export const AUTH_EVENT = 'crawler-course:auth-changed';

/**
 * 该云环境的匿名上下文里 auth.uid() 返回字符串 'anon'。
 * 把它当成真实用户会让档案 / 学习快照写进所有人共享的 'anon' 行,
 * 也可能被用来抢注学号,因此前端一律按「未登录」处理。
 */
export function realUid(session: CloudSessionData): string | null {
  const uid = session?.user?.id;
  if (!uid || uid === 'anon' || uid === 'anonymous') return null;
  return uid;
}

export async function currentSession(): Promise<CloudSessionData> {
  try {
    const { data, error } = await cloud.auth.getSession();
    if (error) {
      // 网络类错误保留提示,但不假装"已登录"。
      console.warn('[cloud] 会话恢复失败', error.kind ?? 'unknown');
      return null;
    }
    return realUid(data) ? data : null;
  } catch (error) {
    // 本地预览 / 断网时数据面不可达,按"未登录"处理,页面其余功能不受影响。
    console.warn('[cloud] 会话恢复异常', errorMessage(error));
    return null;
  }
}

export function emitAuth(session: CloudSessionData): void {
  document.dispatchEvent(new CustomEvent<CloudSessionData>(AUTH_EVENT, { detail: session }));
}

export function onAuthChange(handler: (session: CloudSessionData) => void): void {
  document.addEventListener(AUTH_EVENT, (event) => {
    handler((event as CustomEvent<CloudSessionData>).detail);
  });
}

/** 教师白名单判定:只读 teacher_roles 中自己的那一行,不依赖前端缓存。 */
export async function isTeacher(session: CloudSessionData): Promise<boolean> {
  const uid = realUid(session);
  if (!uid) return false;
  try {
    const { data, error } = await cloud.database
      .from('teacher_roles')
      .select('owner_id')
      .eq('owner_id', uid)
      .maybeSingle();
    return !error && Boolean(data);
  } catch {
    return false;
  }
}

export function errorMessage(error: unknown, fallback = '操作失败,请稍后重试'): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}
