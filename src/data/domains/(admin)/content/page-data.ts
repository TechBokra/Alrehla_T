import 'server-only';
import { getBlogPosts } from '@/data/domains/(shared)/content/blog';
import { getServerNow } from '@/data/server-time';
import { blogPublicationData } from '@/data/domains/(shared)/content/timing';

export async function getAdminBlogPublicationData() {
  return blogPublicationData(await getBlogPosts({ includeDrafts: true }), getServerNow());
}
