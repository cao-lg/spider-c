import { D1CourseStore, deleteStudent } from '../_shared/backend.ts';
import { auth, query, toResponse, type PagesContext } from '../_shared/http.ts';

export const onRequestDelete = async ({ request, env }: PagesContext): Promise<Response> =>
  toResponse(await deleteStudent(new D1CourseStore(env.DB), env, auth(request), query(request, 'id')));
