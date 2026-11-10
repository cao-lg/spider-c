import { D1CourseStore, classData } from '../_shared/backend.ts';
import { auth, query, toResponse, type PagesContext } from '../_shared/http.ts';

export const onRequestGet = async ({ request, env }: PagesContext): Promise<Response> =>
  toResponse(await classData(new D1CourseStore(env.DB), env, auth(request), query(request, 'classId')));
