import { D1CourseStore, archiveReport, listArchives, readArchive } from '../_shared/backend.ts';
import { auth, query, readBody, toResponse, type PagesContext } from '../_shared/http.ts';

export const onRequestGet = async ({ request, env }: PagesContext): Promise<Response> => {
  const key = query(request, 'key');
  if (key) return toResponse(await readArchive(new D1CourseStore(env.DB), env, auth(request), key));
  return toResponse(await listArchives(new D1CourseStore(env.DB), env, auth(request), query(request, 'classId')));
};

export const onRequestPost = async ({ request, env }: PagesContext): Promise<Response> => {
  const body = await readBody(request);
  if (!body.ok) return body.response;
  return toResponse(await archiveReport(new D1CourseStore(env.DB), env, auth(request), body.body));
};
