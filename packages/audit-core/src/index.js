'use strict';
/**
 * @audit-web/audit-core — public API
 *
 * Usage:
 *   const { scrape, interpret } = require('@audit-web/audit-core');
 *   const scrapedData = await scrape('https://example.com');
 *   const result      = interpret(scrapedData);
 */

const { scrape }     = require('./scraper/index.js');
const { interpret }  = require('./interpreter/index.js');

module.exports = { scrape, interpret };
