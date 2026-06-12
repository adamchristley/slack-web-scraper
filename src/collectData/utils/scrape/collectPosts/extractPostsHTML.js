const { extractThreadHTML } = require('./extractThreadHTML')

// Track scraped message IDs across function calls (survives DOM recreation)
const scrapedMessageIds = new Set()

async function extractPostsHTML(page, postsSelector) {
  const postsHTML = []
  const SKIP_THREADS = process.env.SKIP_THREADS === 'true'

  // Starts at index 1 to skip first child element div.p-degraded_list__loading
  const postHandles = await page.$$(postsSelector)
  for (let i = 1; i < postHandles.length; i++) {
    const postHandle = postHandles[i]

    // Get unique ID for this message (survives DOM recreation in virtualized lists)
    const messageId = await postHandle.evaluate(post => {
      return post.getAttribute('data-item-key') ||
             post.getAttribute('data-qa-message-id') ||
             post.getAttribute('id')
    })

    if (!messageId || scrapedMessageIds.has(messageId)) continue

    try {
      const repliesButton = await postHandle.$('.c-message__reply_count')
      if (repliesButton && SKIP_THREADS === false) {
        const threadHTML = await extractThreadHTML(repliesButton, page)
        postsHTML.push(threadHTML)
      } else {
        const postHTML = await postHandle.evaluate(post => post.outerHTML)
        postsHTML.push(postHTML)
      }
    } catch (error) {
      if (error.message.match('Error scraping thread')) {
        console.error(error.message)
      } else {
        console.error(`\nError scraping post. Skipping this post. Error: ${error.message}.`)
      }
      continue
    }

    scrapedMessageIds.add(messageId)
  }

  return postsHTML
}

exports.extractPostsHTML = extractPostsHTML
