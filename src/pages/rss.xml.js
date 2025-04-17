import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { marked } from 'marked';

export async function GET(context) {
  let posts = [];

  try {
    posts = await getCollection('posts');
    // 确保日期是有效的 Date 对象，并按日期降序排序（最新的在前面）
    posts = posts
      .filter(post => post.data.date) // 过滤掉没有日期的文章
      .sort((a, b) => {
        // 确保转换为 Date 对象进行比较
        const dateA = new Date(a.data.date);
        const dateB = new Date(b.data.date);

        // 检查日期是否有效
        if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) {
          console.warn('警告: 文章日期格式无效', {
            a: a.id, dateA: a.data.date,
            b: b.id, dateB: b.data.date
          });
          return 0; // 如果日期无效，保持原顺序
        }

        // 降序排序（最新的在前面）
        return dateB.getTime() - dateA.getTime();
      });

    // console.log('排序后的文章顺序:', posts.map(p => ({ id: p.id, date: p.data.date })));
  } catch (error) {
    console.warn('警告: 无法获取文章集合，可能集合不存在或为空', error);
  }

  return rss({
    title: '小盛律师-广州盛律师',
    description: '小盛律师的个人主页和法律科普',
    site: context.site,
    items: posts.map((post) => ({
      title: post.data.title,
      pubDate: post.data.date,
      description: post.data.description || '',
      ...(post.body && {
        content: marked.parse(post.body),
      }),
      link: `/${post.id}/`,
    })),
    customData: `<language>zh-cn</language>`,
  });
} 