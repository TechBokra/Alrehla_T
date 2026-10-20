import 'server-only';
import { getAdminBlogPosts } from '@/data/domains/(admin)/content/blog';
import { getServerNow } from '@/data/server-time';
import { blogPublicationData } from '@/data/domains/(shared)/content/timing';

export async function getAdminBlogPublicationData() {
  return blogPublicationData(await getAdminBlogPosts(), getServerNow());
}
