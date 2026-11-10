import { D1CourseStore, overview } from '../_shared/backend.ts';
import { auth, toResponse, type PagesContext } from '../_shared/http.ts';

export const onRequestGet = async ({ request, env }: PagesContext): Promise<Response> =>
  toResponse(await overview(new D1CourseStore(env.DB), env, auth(request)));
