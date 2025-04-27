import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
// 使用原生 fetch API 替代 node-fetch
// Node.js v18+ 原生支持 fetch API

/**
 * Astro集成：自动将新文章提交到Bing IndexNow
 * 
 * 功能：
 * 1. 从sitemap中提取URL
 * 2. 筛选出今天创建或更新的文章URL（基于文章内容中的创建时间）
 * 3. 提交这些URL到Bing IndexNow API
 */
export default function astroIndexNow(options = {}) {
  const domain = options.domain || 'shenglvshi.cn';
  const apiKey = options.apiKey || '3d5ccd74d1ec4e01980a263f35f03aad';
  const keyLocation = `https://${domain}/${apiKey}.txt`;
  
  if (!apiKey) {
    console.warn('未配置Bing API密钥，Bing IndexNow集成将不会生效');
  }
  
  return {
    name: 'astro-bing-indexnow',
    hooks: {
      'astro:build:done': async ({ dir, pages }) => {
        if (!apiKey) return;
        
        try {
          // 处理目录路径 - 如果是URL对象，转换为字符串
          const outputDir = typeof dir === 'string' ? dir : fileURLToPath(dir);
          
          // 从sitemap获取所有URL
          let allUrls = [];
          try {
            const sitemapPath = join(outputDir, 'sitemap-0.xml');
            const sitemapContent = readFileSync(sitemapPath, 'utf8');
            
            // 从sitemap中提取URL
            const urlRegex = /<loc>(https?:\/\/[^<]+)<\/loc>/g;
            let match;
            while ((match = urlRegex.exec(sitemapContent)) !== null) {
              allUrls.push(match[1]);
            }
            
            console.log(`从Sitemap中找到 ${allUrls.length} 个URL`);
          } catch (e) {
            console.error('读取Sitemap出错:', e);
          }
          
          // 如果找不到URL，尝试从页面列表生成
          if (allUrls.length === 0) {
            allUrls = pages.map(page => `https://${domain}/${page.pathname}`);
            console.log(`从页面列表生成了 ${allUrls.length} 个URL`);
          }
          
          if (allUrls.length === 0) {
            console.log('没有找到可提交的URL');
            return;
          }
          
          // 过滤掉tags和categories目录下的URL
          const contentUrls = allUrls.filter(url => {
            const path = url.replace(`https://${domain}/`, '');
            return !path.startsWith('tags/') && !path.startsWith('categories/');
          });
          
          console.log(`过滤掉tags和categories后剩余 ${contentUrls.length} 个URL`);
          
          // 获取今天的日期
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          // 过滤出今天创建的文章（根据文章内容中的date字段）
          const todayUrls = await filterTodayCreatedUrls(contentUrls, outputDir, domain, today);
          
          if (todayUrls.length === 0) {
            console.log('今天没有新增或更新的文章，不需要提交');
            return;
          }
          
          console.log(`准备提交 ${todayUrls.length} 个今天创建的URL到Bing IndexNow`);
          
          // 提交到Bing IndexNow
          const payload = {
            host: domain,
            key: apiKey,
            keyLocation,
            urlList: todayUrls
          };
          
          // 使用全局 fetch API (Node.js 18+)
          console.log('开始提交到 Bing IndexNow...');
          
          // 将 fetch 请求移到构建结束后的单独进程执行
          setTimeout(async () => {
            try {
              const response = await fetch('https://api.indexnow.org/IndexNow', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json; charset=utf-8'
                },
                body: JSON.stringify(payload)
              });
              
              if (response.status === 200) {
                console.log('✅ 成功提交今日创建的URL到Bing IndexNow');
              } else {
                console.error(`❌ 提交失败，状态码: ${response.status}`);
                
                // 尝试读取错误信息
                try {
                  const errorData = await response.text();
                  console.error('错误详情:', errorData);
                } catch (e) {
                  // 忽略读取错误
                }
              }
            } catch (submitError) {
              console.error('提交到Bing时出错:', submitError);
            }
          }, 100);
          
        } catch (error) {
          console.error('Bing IndexNow集成出错:', error);
        }
      }
    }
  };
}

/**
 * 根据文章内容中的创建日期筛选今天创建的URL
 * @param {string[]} urls 所有URL
 * @param {string} outputDir 输出目录
 * @param {string} domain 域名
 * @param {Date} today 今天日期对象
 * @returns {Promise<string[]>} 今天创建的URL
 */
async function filterTodayCreatedUrls(urls, outputDir, domain, today) {
  // 跟踪今天更新的URL
  const todayUrls = [];
  
  // 找到源文件目录
  const srcDir = resolve(process.cwd(), 'src');
  const contentDir = join(srcDir, 'content', 'posts');
  
  for (const url of urls) {
    try {
      // 从URL提取路径
      const urlPath = url.replace(`https://${domain}/`, '').replace(/\/$/, '');
      
      // 忽略非文章页面
      if (!urlPath || urlPath === 'index.html' || urlPath === 'posts' || 
          urlPath.includes('tags/') || urlPath.includes('categories/') ||
          urlPath.includes('search') || urlPath.includes('page/')) {
        continue;
      }
      
      // 尝试查找源Markdown文件
      const mdFile = `${urlPath}.md`;
      const mdxFile = `${urlPath}.mdx`;
      
      // 查找源文件
      let sourceFilePath;
      // 首先在posts目录查找
      if (existsSync(join(contentDir, mdFile))) {
        sourceFilePath = join(contentDir, mdFile);
      } else if (existsSync(join(contentDir, mdxFile))) {
        sourceFilePath = join(contentDir, mdxFile);
      } else {
        // 如果在posts目录找不到，可能是其他位置的内容
        continue;
      }
      
      // 读取文件内容
      const fileContent = readFileSync(sourceFilePath, 'utf8');
      
      // 提取日期
      const dateMatch = fileContent.match(/date:\s*(.+?)(\n|$)/);
      if (dateMatch && dateMatch[1]) {
        const postDate = new Date(dateMatch[1].trim());
        
        // 检查日期是否有效
        if (!isNaN(postDate.getTime())) {
          // 设置日期的时区为本地时区
          const postDateLocal = new Date(postDate.getTime());
          
          // 如果文章的创建日期是今天或将来（未来发布）
          if (postDateLocal >= today) {
            todayUrls.push(url);
            console.log(`找到今日创建的文章: ${urlPath}, 日期: ${postDateLocal.toISOString()}`);
          }
        }
      }
    } catch (error) {
      console.error(`处理URL时出错: ${url}`, error);
    }
  }
  
  return todayUrls;
} 