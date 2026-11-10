import { D1CourseStore, enroll } from '../_shared/backend.ts';
import { readBody, toResponse, type PagesContext } from '../_shared/http.ts';

export const onRequestPost = async ({ request, env }: PagesContext): Promise<Response> => {
  const body = await readBody(request);
  if (!body.ok) return body.response;
  return toResponse(await enroll(new D1CourseStore(env.DB), env, body.body));
};
