# Slack Web Scraper - Maintained Fork

> **Note:** This is an actively maintained fork of the [original slack-web-scraper](https://github.com/iulspop/slack-web-scraper) which was archived in September 2024.

## ⚠️ Original Scraper No Longer Works

**The original scraper stopped working with modern Slack** due to significant UI changes. When you run the original version:
- ❌ Scrapes only ~200 messages then stops immediately
- ❌ Mouse wheel scrolling does nothing (scroll position stays at 0)
- ❌ Claims it "reached the end" after collecting only a tiny fraction of messages
- ❌ Completely broken with virtualized scrolling

**This fork makes it functional again.**

## 🎯 What's Fixed in This Fork

I identified and fixed the core issues that broke the scraper:

✅ **Keyboard-Based Scrolling** - Uses PageDown events instead of broken mouse wheel scrolling  
✅ **Persistent Message Tracking** - Tracks messages by unique ID, survives DOM recreation  
✅ **Content-Based Stop Detection** - Stops when no new messages found, not DOM boundaries  
✅ **Successfully Tested** - Verified with 2,500+ message channels in 2026

### Why It Stopped Working

Modern Slack (2024-2026) uses **virtualized lists** that only render ~200 messages in the DOM at once. The original scraper fails because:

1. **Mouse wheel events don't work** - `page.mouse.wheel()` targets the wrong element (Slack's scroll container changed)
2. **DOM properties get lost** - Slack destroys and recreates DOM nodes during scrolling, losing the `isScraped` property
3. **False "end" detection** - DOM size stays constant at ~200 elements, so scraper thinks it reached the end immediately

**Result:** The scraper would collect ~200 messages, think it's done, and stop. Channels with thousands of messages would only yield a fraction.

### How I Fixed It

I debugged the scraper and discovered:
- Scroll position was stuck at 0 (mouse wheel events not working)
- Message count plateaued at ~200 (DOM tracking failing)
- Slack was recreating DOM elements during virtual scrolling

The fixes make it work reliably with modern Slack in 2026.

---

# Slack Web Scraper

![][slack_messages_to_parsed_posts]

A web scraper that navigates to a Slack workspace and saves the posts and threads of a given channel or DM.

It uses [Puppeteer headless browser](https://puppeteer.github.io/puppeteer/) for loading and interacting with Slack. It doesn't depend on installing an app in the Slack workspace or aquiring an API key. Instead, it logins to your Slack account and uses that to access the channel or DM.

It's helpful for saving information from a channel or DM without needing to ask a workspace administrator to export the data.

For example, if you're in the process of leaving your current company to join another, this tool is a great way to archive everything you've said and done on Slack.

## How to collect Slack data?

1. Run `npm install` to install the dependencies.
2. Copy the `.example.env` file in the project root folder and rename it to `.env`. Then modify following environment variables in `.env`:

- `SLACK_WORKSPACE_URL`, `SLACK_EMAIL` and `SLACK_PASSWORD` are required.

  - `SLACK_WORKSPACE_URL` must be the URL you login to the workspace not `app.slack.com`. Example: `SLACK_WORKSPACE_URL=cloud-native.slack.com`. Note environment variables are set without quotes.
  - `SLACK_EMAIL` and `SLACK_PASSWORD` are credentials used to login into the workspace.

- You must set one of `CONVERSATION_NAMES` or `CHANNEL_NAMES` or both.

  - The collect script will scrape the list of conversations first, then the list of channels. The list must a valid JSON array: `["element1", "element2"]`. The array elements are double quoted and the last element doesn't have a trailing comma. You can escape a double quote in a string in JSON like this: `["string\"hello"]`
  - Set `CONVERSATION_NAMES` to scrape a DM or group chat. The value is the name tag of the person or group chat name as is written under "Direct Messages" in Slack. Example: `CONVERSATION_NAMES=["Iuliu Pop (Core Grad)", "John Doe"]`.
  - Set `CHANNEL_NAMES` to scrape a public or private channels. It's the name you see under "channels" side tab in Slack. Example: `CHANNEL_NAMES=["general", "random"]`.
  - The name doesn't need to be an exact match, it must only match part of the name. For example, if a name tag includes an emoji, you can only write the part of the name tag without it and it should work.
  - The channel or the conversation must be in the list of channels or DMs in the left sidebar before running the collect script.

- `SCROLL_UP_TIMEOUT` is optional.

  - A timeout in seconds for when to stop scrolling up the channel history and start scraping posts. Useful when scraping channels with a long history but don't need to scrape it all. For a very active channel, it could take 60 seconds to scroll up half a year then ~20min to scrape it. Example: `SCROLL_UP_TIMEOUT=30`

- `HEADLESS_MODE` is optional.

  - Set to `true` to scrape with the browser in headless mode. Example: `HEADLESS_MODE=true`.
  - Helpful for scraping long channel/conversation histories, since the browser runs with a larger vertical viewport so can scrape it larger batches at a time. I recommend you start without running headless mode with one conversation or channel since you can see clearer if the collect scraper is working or not.

- `SKIP_THREADS` is optional.

  - Set to `true` to disable scraping threads on messages that are in channels or conversations. Example: `SKIP_THREADS=true`.
  - Helpful if you do not want to scrape all the replies that are made on a message but just have the main message.

3. Before starting the scrape, make sure the Slack App language is set to English. You can reset it once the scrape is finished.

4. Run `npm run collect`. You will see the browser open and start scraping data unless you set `HEADLESS_MODE` to `true`. In headless mode you will see status updates on the scraping process in the console output.

### Tip for collecting data with Windows Subsystem for Linux

You need to configure WSL to connect to a GUI even if the browser launches in headless mode. Use [this guide](https://nickymeuleman.netlify.app/blog/gui-on-wsl2-cypress) to configure WSL to connect to an X server installed on Windows. Before running the collect script, the X server must be open and WSL correctly configured to connect to it, or Puppeteer will fail to launch the browser.

## How to parse Slack data?

1. Assuming you already ran `npm run collect`, you can now run `npm run parse`. You will be prompted to select the file to parse from the `slack-data/` folder. Once the parsing is complete, a `slack-data/x.json` file with same name as the source HTML file will be output with the parsed posts/threads.

## 🔧 Technical Improvements in This Fork

### Fixes for Virtualized Scrolling

**Problem:** Slack's modern UI uses virtualized lists where only visible messages exist in the DOM. The original scraper failed because:
1. Mouse wheel events don't work on Slack's scroll container
2. DOM properties are lost when Slack recreates elements
3. Scraper stops immediately thinking it reached the end

**Solution:**

**1. Keyboard-Based Scrolling** (`scrollFeed.js`)
```javascript
// Old: Mouse wheel (doesn't work)
await page.mouse.wheel({ deltaY: 4000 })

// New: Keyboard events (works!)
await page.keyboard.press('PageDown')
```

**2. Persistent Message Tracking** (`extractPostsHTML.js`)
```javascript
// Old: DOM property (lost on recreation)
await postHandle.evaluate(post => post.isScraped = true)

// New: Unique ID tracking (survives recreation)
const messageId = await postHandle.evaluate(post => 
  post.getAttribute('data-item-key')
)
scrapedMessageIds.add(messageId)
```

**3. Content-Based Stop Detection** (`scrollFeed.js`)
```javascript
// Stops after 3 scrolls with no new messages
// Not based on DOM boundaries
if (noNewMessagesCount >= 3) break
```

### Files Changed
- `src/collectData/utils/scrape/collectPosts/scrollFeed.js` - Keyboard scrolling
- `src/collectData/utils/scrape/collectPosts/extractPostsHTML.js` - ID-based tracking
- `src/collectData/utils/scrape/collectPosts/index.js` - Message count tracking

## Contributors ✨

Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tbody>
    <tr>
      <td align="center"><a href="https://github.com/iulspop"><img src="https://avatars.githubusercontent.com/u/53665722?v=4?s=100" width="100px;" alt="Iuliu Pop"/><br /><sub><b>Iuliu Pop</b></sub></a><br /><a href="#ideas-iulspop" title="Ideas, Planning, & Feedback">🤔</a> <a href="https://github.com/iulspop/slack-web-scraper/commits?author=iulspop" title="Code">💻</a> <a href="https://github.com/iulspop/slack-web-scraper/commits?author=iulspop" title="Documentation">📖</a> <a href="https://github.com/iulspop/slack-web-scraper/pulls?q=is%3Apr+reviewed-by%3Aiulspop" title="Reviewed Pull Requests">👀</a> <a href="#question-iulspop" title="Answering Questions">💬</a></td>
      <td align="center"><a href="https://williamdes.eu/en/"><img src="https://avatars.githubusercontent.com/u/7784660?v=4?s=100" width="100px;" alt="William Desportes"/><br /><sub><b>William Desportes</b></sub></a><br /><a href="https://github.com/iulspop/slack-web-scraper/commits?author=williamdes" title="Code">💻</a> <a href="https://github.com/iulspop/slack-web-scraper/issues?q=author%3Awilliamdes" title="Bug reports">🐛</a></td>
      <td align="center"><a href="http://notedwin.co"><img src="https://avatars.githubusercontent.com/u/54582223?v=4?s=100" width="100px;" alt="NotEdwin"/><br /><sub><b>NotEdwin</b></sub></a><br /><a href="https://github.com/iulspop/slack-web-scraper/issues?q=author%3AEdwin15857" title="Bug reports">🐛</a> <a href="https://github.com/iulspop/slack-web-scraper/commits?author=Edwin15857" title="Code">💻</a></td>
    </tr>
  </tbody>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind welcome!

## Contributing

Very open to contributions to this project! If you have questions, bug reports or features you want to see, please open an issue. If you want to contribute code, open a pull request and I'll review ASAP.

## License

[MIT][license]

<!-- Links -->

[license]: https://github.com/iulspop/slack-web-scraper/blob/master/LICENSE.md

<!-- Demo images -->

[slack_messages_to_parsed_posts]: https://github.com/iulspop/slack-web-scraper/blob/master/docs/images/slack-messages-to-parsed-posts.jpg?raw=true
