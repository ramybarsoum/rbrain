#!/usr/bin/env node
/**
 * X-to-Brain Collector — deterministic tweet collection, deletion detection, engagement tracking.
 * No LLM calls. Outputs structured JSON for agent enrichment.
 * 
 * Usage: node x-collector.mjs collect
 */

import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const DATA = join(ROOT, 'data');
const CONFIG_PATH = join(ROOT, 'config.json');
const STATE_PATH = join(DATA, 'state.json');

// ─── Helpers ──────────────────────────────────────────────────────────────

function atomicWrite(path, obj) {
  const tmp = path + '.tmp';
  writeFileSync(tmp, JSON.stringify(obj, null, 2));
  renameSync(tmp, path);
}

function loadJSON(path, fallback = {}) {
  if (!existsSync(path)) return fallback;
  try { return JSON.parse(readFileSync(path, 'utf8')); }
  catch { return fallback; }
}

async function xFetch(url, token) {
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  // Track rate limits
  const remaining = parseInt(res.headers.get('x-rate-limit-remaining') || '999');
  const resetAt = parseInt(res.headers.get('x-rate-limit-reset') || '0');
  
  if (res.status === 429) {
    console.log(`RATE_LIMITED:${url}:resets_at_${resetAt}`);
    return null;
  }
  if (!res.ok) {
    console.log(`HTTP_ERROR:${res.status}:${url}`);
    return null;
  }
  
  return { data: await res.json(), remaining, resetAt };
}

// ─── State Management ─────────────────────────────────────────────────────

function loadState() {
  return loadJSON(STATE_PATH, {
    last_run: null,
    own_timeline: { pagination_token: null, tweet_ids: [] },
    mentions: { pagination_token: null, tweet_ids: [] },
    searches: {},
    rate_limits: {}
  });
}

function saveState(state) {
  state.last_run = new Date().toISOString();
  atomicWrite(STATE_PATH, state);
}

// ─── Collection Streams ───────────────────────────────────────────────────

async function collectOwnTimeline(config, token, state) {
  const userId = config.user_id;
  const maxResults = config.collection?.own_timeline_max || 100;
  
  let url = `https://api.x.com/2/users/${userId}/tweets?max_results=${maxResults}&tweet.fields=created_at,text,public_metrics,author_id,in_reply_to_user_id,referenced_tweets,entities`;
  
  if (state.own_timeline?.pagination_token) {
    url += `&pagination_token=${state.own_timeline.pagination_token}`;
  }
  
  const result = await xFetch(url, token);
  if (!result) return { total: 0, new: 0 };
  
  const tweets = result.data?.data || [];
  let newCount = 0;
  
  const prevIds = new Set(state.own_timeline?.tweet_ids || []);
  const currentIds = [];
  
  for (const tweet of tweets) {
    currentIds.push(tweet.id);
    const tweetPath = join(DATA, 'tweets', 'own', `${tweet.id}.json`);
    
    if (existsSync(tweetPath)) {
      // Update engagement snapshot
      await trackEngagement(tweet);
      continue;
    }
    
    atomicWrite(tweetPath, {
      ...tweet,
      _collected_at: new Date().toISOString(),
      _stream: 'own'
    });
    newCount++;
  }
  
  // Save pagination token for next run
  if (!state.own_timeline) state.own_timeline = {};
  state.own_timeline.pagination_token = result.data?.meta?.next_token || null;
  state.own_timeline.tweet_ids = currentIds;
  
  // Deletion detection
  const deleted = detectDeletions(prevIds, new Set(currentIds), 'own');
  
  return { total: tweets.length, new: newCount, deleted };
}

async function collectMentions(config, token, state) {
  const userId = config.user_id;
  const maxResults = config.collection?.mentions_max || 100;
  
  let url = `https://api.x.com/2/users/${userId}/mentions?max_results=${maxResults}&tweet.fields=created_at,text,public_metrics,author_id,in_reply_to_user_id,referenced_tweets,entities&expansions=author_id&user.fields=username,name`;
  
  if (state.mentions?.pagination_token) {
    url += `&pagination_token=${state.mentions.pagination_token}`;
  }
  
  const result = await xFetch(url, token);
  if (!result) return { total: 0, new: 0 };
  
  const tweets = result.data?.data || [];
  const users = {};
  for (const u of (result.data?.includes?.users || [])) {
    users[u.id] = u;
  }
  
  let newCount = 0;
  const prevIds = new Set(state.mentions?.tweet_ids || []);
  const currentIds = [];
  
  for (const tweet of tweets) {
    currentIds.push(tweet.id);
    const tweetPath = join(DATA, 'tweets', 'mentions', `${tweet.id}.json`);
    
    // Enrich with author info
    const author = users[tweet.author_id];
    if (author) tweet._author = author;
    
    if (existsSync(tweetPath)) {
      await trackEngagement(tweet);
      continue;
    }
    
    atomicWrite(tweetPath, {
      ...tweet,
      _collected_at: new Date().toISOString(),
      _stream: 'mentions'
    });
    newCount++;
  }
  
  if (!state.mentions) state.mentions = {};
  state.mentions.pagination_token = result.data?.meta?.next_token || null;
  state.mentions.tweet_ids = currentIds;
  
  const deleted = detectDeletions(prevIds, new Set(currentIds), 'mentions');
  
  return { total: tweets.length, new: newCount, deleted };
}

async function collectSearches(config, token, state) {
  if (!config.searches?.length) return { results: [] };
  
  const results = [];
  
  for (let i = 0; i < config.searches.length; i++) {
    const query = config.searches[i];
    const maxResults = config.collection?.search_max || 100;
    
    const url = `https://api.x.com/2/tweets/search/recent?query=${encodeURIComponent(query)}&max_results=${Math.min(maxResults, 100)}&tweet.fields=created_at,text,public_metrics,author_id,referenced_tweets,entities&expansions=author_id&user.fields=username,name`;
    
    const result = await xFetch(url, token);
    if (!result) {
      results.push({ query, total: 0, new: 0 });
      continue;
    }
    
    const tweets = result.data?.data || [];
    const users = {};
    for (const u of (result.data?.includes?.users || [])) {
      users[u.id] = u;
    }
    
    let newCount = 0;
    const searchDir = join(DATA, 'tweets', 'searches', `search_${i}`);
    if (!existsSync(searchDir)) mkdirSync(searchDir, { recursive: true });
    
    for (const tweet of tweets) {
      const tweetPath = join(searchDir, `${tweet.id}.json`);
      const author = users[tweet.author_id];
      if (author) tweet._author = author;
      
      if (existsSync(tweetPath)) continue;
      
      atomicWrite(tweetPath, {
        ...tweet,
        _collected_at: new Date().toISOString(),
        _stream: `search_${i}`,
        _search_query: query
      });
      newCount++;
    }
    
    results.push({ query: query.substring(0, 50), total: tweets.length, new: newCount });
  }
  
  return { results };
}

// ─── Deletion Detection ───────────────────────────────────────────────────

function detectDeletions(prevIds, currentIds, stream) {
  const deleted = [];
  const now = new Date();
  
  for (const id of prevIds) {
    if (currentIds.has(id)) continue;
    
    const tweetPath = join(DATA, 'tweets', stream, `${id}.json`);
    if (!existsSync(tweetPath)) continue;
    
    const tweet = loadJSON(tweetPath);
    const age = now - new Date(tweet.created_at);
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    
    if (age > sevenDays) continue;
    
    // Mark as potentially deleted
    const deletionPath = join(DATA, 'deletions', `${id}.json`);
    if (existsSync(deletionPath)) continue;
    
    atomicWrite(deletionPath, {
      id,
      text: tweet.text?.substring(0, 200),
      author_id: tweet.author_id,
      created_at: tweet.created_at,
      deleted_detected_at: now.toISOString(),
      stream,
      status: 'pending_verification'
    });
    
    deleted.push({ id, preview: tweet.text?.substring(0, 80) });
    console.log(`DELETION_DETECTED:${id}:${stream}:${tweet.text?.substring(0, 60)}`);
  }
  
  return deleted;
}

// ─── Engagement Tracking ──────────────────────────────────────────────────

async function trackEngagement(tweet) {
  if (!tweet.public_metrics) return;
  
  const engPath = join(DATA, 'engagement', `${tweet.id}.json`);
  const existing = loadJSON(engPath, { snapshots: [] });
  
  const last = existing.snapshots[existing.snapshots.length - 1];
  const current = {
    timestamp: new Date().toISOString(),
    likes: tweet.public_metrics.like_count || 0,
    retweets: tweet.public_metrics.retweet_count || 0,
    replies: tweet.public_metrics.reply_count || 0,
    quotes: tweet.public_metrics.quote_count || 0,
    impressions: tweet.public_metrics.impression_count || 0
  };
  
  // Only write if metrics changed
  if (last && last.likes === current.likes && last.retweets === current.retweets && last.replies === current.replies) {
    return;
  }
  
  existing.snapshots.push(current);
  if (existing.snapshots.length > 100) existing.snapshots = existing.snapshots.slice(-100);
  
  atomicWrite(engPath, existing);
  
  // Alert conditions
  if (last) {
    const oldLikes = last.likes;
    const newLikes = current.likes;
    
    if (oldLikes >= 50 && newLikes >= oldLikes * 2) {
      console.log(`VELOCITY_ALERT:${tweet.id}:likes:${oldLikes}->${newLikes}:2x`);
    } else if ((newLikes - oldLikes) > 100) {
      console.log(`VELOCITY_ALERT:${tweet.id}:likes:${oldLikes}->${newLikes}:jump100`);
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function main() {
  const command = process.argv[2] || 'collect';
  if (command !== 'collect') {
    console.error(`Unknown command: ${command}. Use: collect`);
    process.exit(1);
  }
  
  // Load config and token
  const config = loadJSON(CONFIG_PATH);
  const token = process.env.X_BEARER_TOKEN;
  if (!token) {
    console.error('X_BEARER_TOKEN not set in environment');
    process.exit(1);
  }
  
  const state = loadState();
  
  console.log(`RUN_START:${new Date().toISOString()}`);
  
  // Collect all streams
  const own = await collectOwnTimeline(config, token, state);
  console.log(`OWN_TWEETS:${own.total} (${own.new} new)`);
  
  const mentions = await collectMentions(config, token, state);
  console.log(`MENTIONS:${mentions.total} (${mentions.new} new)`);
  
  const searches = await collectSearches(config, token, state);
  for (const s of searches.results) {
    console.log(`SEARCH:${s.query.replace(/\s+/g, '_').substring(0, 30)}:${s.total} (${s.new} new)`);
  }
  
  // Save state
  saveState(state);
  
  const totalDeleted = (own.deleted?.length || 0) + (mentions.deleted?.length || 0);
  const totalNew = own.new + mentions.new + searches.results.reduce((a, r) => a + r.new, 0);
  const totalStored = own.total + mentions.total + searches.results.reduce((a, r) => a + r.total, 0);
  
  console.log(`RUN_COMPLETE:${new Date().toISOString()}:tweets_stored=${totalNew}:deletions=${totalDeleted}:total_seen=${totalStored}`);
}

main().catch(e => {
  console.error(`FATAL:${e.message}`);
  process.exit(1);
});
