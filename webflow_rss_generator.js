// Webflow Custom RSS Feed Generator
// This function fetches blog posts from Webflow API and generates a full-content RSS feed

const WEBFLOW_API_TOKEN = process.env.WEBFLOW_API_TOKEN;
const SITE_ID = process.env.WEBFLOW_SITE_ID;
const COLLECTION_ID = process.env.WEBFLOW_COLLECTION_ID;
const SITE_URL = process.env.SITE_URL || 'https://yoursite.com';
const SITE_NAME = process.env.SITE_NAME || 'Your Blog';
const SITE_DESCRIPTION = process.env.SITE_DESCRIPTION || 'Latest blog posts';

// Main handler function (works with Vercel, Netlify, etc.)
export default async function handler(req, res) {
  try {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
    
    // Fetch blog posts from Webflow
    const posts = await fetchWebflowPosts();
    
    // Generate RSS XML
    const rssXml = generateRSS(posts);
    
    // Return RSS feed
    res.status(200).send(rssXml);
    
  } catch (error) {
    console.error('Error generating RSS feed:', error);
    res.status(500).json({ error: 'Failed to generate RSS feed' });
  }
}

// Fetch posts from Webflow API
async function fetchWebflowPosts() {
  const url = `https://api.webflow.com/v2/collections/${COLLECTION_ID}/items`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${WEBFLOW_API_TOKEN}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Webflow API error: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.items || [];
}

// Generate RSS XML from posts
function generateRSS(posts) {
  const now = new Date().toUTCString();
  
  const rssItems = posts.map(post => {
    const postDate = post.createdOn ? new Date(post.createdOn).toUTCString() : now;
    const postUrl = `${SITE_URL}/blog/${post.fieldData?.slug || post.id}`;
    
    // Extract and clean content
    const title = escapeXml(post.fieldData?.name || post.fieldData?.title || 'Untitled Post');
    const description = escapeXml(post.fieldData?.summary || post.fieldData?.excerpt || '');
    const content = extractFullContent(post.fieldData);
    const author = escapeXml(post.fieldData?.author || '');
    
    return `
    <item>
      <title>${title}</title>
      <link>${postUrl}</link>
      <guid isPermaLink="true">${postUrl}</guid>
      <pubDate>${postDate}</pubDate>
      ${author ? `<author>${author}</author>` : ''}
      <description><![CDATA[${description}]]></description>
      <content:encoded><![CDATA[${content}]]></content:encoded>
    </item>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" 
     xmlns:content="http://purl.org/rss/1.0/modules/content/"
     xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(SITE_NAME)}</title>
    <link>${SITE_URL}</link>
    <description>${escapeXml(SITE_DESCRIPTION)}</description>
    <language>en-us</language>
    <lastBuildDate>${now}</lastBuildDate>
    <atom:link href="${SITE_URL}/api/rss" rel="self" type="application/rss+xml" />
    ${rssItems}
  </channel>
</rss>`;
}

// Extract full content from Webflow post data
function extractFullContent(fieldData) {
  if (!fieldData) return '';
  
  // Common field names for blog content in Webflow
  const contentFields = [
    'content',
    'body', 
    'post-body',
    'main-content',
    'rich-text',
    'blog-content'
  ];
  
  let fullContent = '';
  
  // Try to find the main content field
  for (const fieldName of contentFields) {
    if (fieldData[fieldName]) {
      fullContent = fieldData[fieldName];
      break;
    }
  }
  
  // If no content found, try to concatenate all rich text fields
  if (!fullContent) {
    Object.values(fieldData).forEach(value => {
      if (typeof value === 'string' && value.length > 100 && isLikelyContent(value)) {
        fullContent += value + '\n\n';
      }
    });
  }
  
  // Process rich text content
  if (fullContent) {
    fullContent = processRichTextContent(fullContent);
  }
  
  return fullContent;
}

// Check if a string is likely to be main content
function isLikelyContent(str) {
  // Basic heuristics to identify content vs metadata
  return str.includes('<p>') || str.includes('<h') || str.includes('<div') || 
         (str.split(' ').length > 20 && !str.includes('@') && !str.includes('http'));
}

// Process Webflow's rich text content
function processRichTextContent(content) {
  if (!content) return '';
  
  // If it's already HTML, return as-is
  if (content.includes('<') && content.includes('>')) {
    return content;
  }
  
  // If it's plain text, convert line breaks to HTML
  return content.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>');
}

// Escape XML special characters
function escapeXml(str) {
  if (!str) return '';
  return str.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Alternative export for different serverless platforms
export { handler as webflowRssFeed };

// For testing locally
if (process.env.NODE_ENV === 'development') {
  // Local testing function
  async function testRssFeed() {
    try {
      const posts = await fetchWebflowPosts();
      console.log(`Found ${posts.length} posts`);
      const rss = generateRSS(posts.slice(0, 3)); // Test with first 3 posts
      console.log(rss);
    } catch (error) {
      console.error('Test failed:', error);
    }
  }
  
  // Uncomment to test locally
  // testRssFeed();
}