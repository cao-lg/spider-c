import { D1CourseStore, deleteOwn, pullSnapshot, pushSnapshot } from '../_shared/backend.ts';
import { auth, readBody, toResponse, type PagesContext } from '../_shared/http.ts';

export const onRequestGet = async ({ request, env }: PagesContext): Promise<Response> =>
  toResponse(await pullSnapshot(new D1CourseStore(env.DB), env, auth(request)));

export const onRequestPost = async ({ request, env }: PagesContext): Promise<Response> => {
  const body = await readBody(request);
  if (!body.ok) return body.response;
  return toResponse(await pushSnapshot(new D1CourseStore(env.DB), env, auth(request), body.body));
};

export const onRequestDelete = async ({ request, env }: PagesContext): Promise<Response> =>
  toResponse(await deleteOwn(new D1CourseStore(env.DB), env, auth(request)));
