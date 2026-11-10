import { toResponse } from '../_shared/http.ts';

/** 不鉴权的存活探针:教师端可据此区分「未部署 Functions」与「口令错误」 */
export const onRequestGet = () => toResponse({ status: 200, body: { ok: true, service: 'spider-c-functions', phase: '1+2' } });
