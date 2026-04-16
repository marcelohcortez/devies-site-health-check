'use strict';
/**
 * @audit-web/audit-core — public API
 *
 * Usage:
 *   const { scrape, interpret } = require('@audit-web/audit-core');
 *   const scrapedData = await scrape('https://example.com');
 *   const result      = interpret(scrapedData);
 */

const { scrape, crawl, scrapePage, discoverLinks } = require('./scraper/index.js');
const { interpret }  = require('./interpreter/index.js');

module.exports = { scrape, crawl, scrapePage, discoverLinks, interpret };
