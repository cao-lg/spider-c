/**
 * 云服务公开配置 —— 由云环境激活时返回,可安全随前端分发。
 *
 * - publishableKey 只标识应用,本身不带任何权限;服务端会做精确 Origin 校验。
 * - endpoint / oauthRelayBaseUrl 必须来自云环境返回值,不要从 location.origin 推导,
 *   也不要改成字面量猜测值,否则重新发布后 Origin 校验会失败。
 * - 这里永远不要放 AppSecret、服务角色密钥或教师口令。
 */
export const publicConfig = {
  endpoint: 'https://crawler-course.app.workbuddy.host',
  oauthRelayBaseUrl: 'https://www.workbuddy.cn/v2/as/genie-baas/oauth',
  publishableKey: 'wbpk_pIWtA1s824YYLh2DRPG7Ck_rc0TEPbaxdxBokT49NxBIM4dwL0oo4BK',
} as const;
