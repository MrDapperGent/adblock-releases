'use strict';

/* For ESLint: List any global identifiers used in this file below */
/* global browser, require, ext, exports, chromeStorageSetHelper, getSettings, adblockIsPaused,
   adblockIsDomainPaused, filterStorage, Filter, parseUri, settings, getAllSubscriptionsMinusText,
   getUserFilters, Utils, replacedCounts, setSetting */

const { extractHostFromFrame } = require('url');
const { ElemHideFilter } = require('filterClasses');
const { filterNotifier } = require('filterNotifier');
const { port } = require('messaging');
const info = require('../buildtools/info');

const LocalDataCollection = (function getLocalDataCollection() {
  const easyPrivacyURL = 'https://easylist-downloads.adblockplus.org/easyprivacy.txt';
  const FIFTEEN_MINS = 1000 * 60 * 15;
  let intervalFN;
  const EXT_STATS_KEY = 'ext_stats_key';

  // Setup memory cache
  let dataCollectionCache = {};
  dataCollectionCache.domains = {};

  const initializeDomainIfNeeded = function (domain) {
    if (!(domain in dataCollectionCache.domains)) {
      dataCollectionCache.domains[domain] = {};
      dataCollectionCache.domains[domain].ads = 0;
      dataCollectionCache.domains[domain].trackers = 0;
      dataCollectionCache.domains[domain].adsReplaced = 0;
    }
  };

  const handleTabUpdated = function (tabId, changeInfo, tabInfo) {
    if (browser.runtime.lastError) {
      return;
    }
    if (!tabInfo || !tabInfo.url || !tabInfo.url.startsWith('http') || tabInfo.incognito) {
      return;
    }
    if (
      getSettings().local_data_collection
      && !getSettings().data_collection_v2 // the content script will be injected from that module
      && !adblockIsPaused()
      && !adblockIsDomainPaused({ url: tabInfo.url, id: tabId })
      && changeInfo.status === 'complete'
    ) {
      browser.tabs.executeScript(tabId,
        {
          file: 'polyfill.js',
          allFrames: true,
        }).then(() => {
        browser.tabs.executeScript(tabId,
          {
            file: 'adblock-datacollection-contentscript.js',
            allFrames: true,
          });
      });
    }
  };

  const addFilterToCache = function (filter, page) {
    const validFilterText = filter && filter.text && (typeof filter.text === 'string');
    const validFilterType = (filter.type === 'blocking'
                             || filter.type === 'elemhide'
                             || filter.type === 'elemhideemulation'
                             || filter.type === 'snippet');
    if (validFilterType && validFilterText && page && page.url && page.url.hostname) {
      browser.tabs.get(page.id).then((tab) => {
        if (tab.incognito) {
          return;
        }
        const domain = page.url.hostname;
        initializeDomainIfNeeded(domain);
        const { text } = filter;
        let isAd = true;
        for (const sub of filterStorage.subscriptions(text)) {
          if (!sub.disabled && sub.url && sub.url === easyPrivacyURL) {
            isAd = false;
          }
        }
        if (isAd) {
          dataCollectionCache.domains[domain].ads += 1;
        } else {
          dataCollectionCache.domains[domain].trackers += 1;
        }
      });
    }
  };

  const addMessageListener = function () {
    port.on('datacollection.elementHide', (message, sender) => {
      const dataCollectionEnabled = getSettings().local_data_collection;
      const domainInfo = { url: sender.page.url, id: sender.page.id };
      if (dataCollectionEnabled && !adblockIsPaused() && !adblockIsDomainPaused(domainInfo)) {
        const { selectors } = message;
        const docDomain = extractHostFromFrame(sender.frame);
        for (const subscription of filterStorage.subscriptions()) { // test if we double count hits
          if (!subscription.disabled) {
            for (const text of subscription.filterText()) {
              const filter = Filter.fromText(text);
              // We only know the exact filter in case of element hiding emulation.
              // For regular element hiding filters, the content script only knows
              // the selector, so we have to find a filter that has an identical
              // selector and is active on the domain the match was reported from.
              const isActiveElemHideFilter = filter instanceof ElemHideFilter
                                           && selectors.includes(filter.selector)
                                           && filter.isActiveOnDomain(docDomain);
              if (isActiveElemHideFilter) {
                addFilterToCache(filter, sender.page);
              }
            }
          }
        }
      }
    });
    port.on('datacollection.exceptionElementHide', (message, sender) => {
      const domainInfo = { url: sender.page.url, id: sender.page.id };
      if (
        getSettings().local_data_collection
          && !adblockIsPaused()
          && !adblockIsDomainPaused(domainInfo)) {
        const selectors = message.exceptions;
        for (const text of selectors) {
          const filter = Filter.fromText(text);
          addFilterToCache(filter, sender.page);
        }
      }
    });
  };

  const filterListener = function (item, newValue, oldValue, tabIds) {
    if (getSettings().local_data_collection && !adblockIsPaused()) {
      for (const tabId of tabIds) {
        const page = new ext.Page({ id: tabId });
        if (page && page.url && !adblockIsDomainPaused({ url: page.url.href, id: page.id })) {
          addFilterToCache(item, page);
        }
      }
    } else if (!getSettings().local_data_collection) {
      LocalDataCollection.end();
    }
  };

  const adReplacedListener = function (tabId, url) {
    if (getSettings().local_data_collection && !adblockIsPaused()) {
      const domain = new URL(url).hostname;
      initializeDomainIfNeeded(domain);
      dataCollectionCache.domains[domain].adsReplaced += 1;
    } else if (!getSettings().local_data_collection) {
      LocalDataCollection.end();
    }
  };

  const clearCache = function () {
    dataCollectionCache = {};
    dataCollectionCache.domains = {};
  };

  const saveCacheData = function (callback) {
    if (getSettings().local_data_collection && !$.isEmptyObject(dataCollectionCache.domains)) {
      const hourSnapShot = JSON.parse(JSON.stringify({
        v: '1',
        doms: dataCollectionCache.domains,
      }));
      browser.storage.local.get(EXT_STATS_KEY).then((hourlyResponse) => {
        const savedData = hourlyResponse[EXT_STATS_KEY] || { };
        savedData[Date.now().toString()] = hourSnapShot;
        chromeStorageSetHelper(EXT_STATS_KEY, savedData, callback);
        clearCache();
      });
    } else {
      if (!getSettings().local_data_collection) {
        clearInterval(intervalFN);
      }
      if (typeof callback === 'function') {
        callback();
      }
    }
  };

  const startProcessInterval = function () {
    intervalFN = window.setInterval(() => {
      saveCacheData();
    }, FIFTEEN_MINS);
  };

  // If enabled at startup periodic saving of memory cache &
  // sending of data to the log server
  settings.onload().then(() => {
    if (getSettings().local_data_collection) {
      startProcessInterval();
      filterNotifier.on('filter.hitCount', filterListener);
      replacedCounts.adReplacedNotifier.on('adReplaced', adReplacedListener);
      browser.tabs.onUpdated.addListener(handleTabUpdated);
      addMessageListener();
    }
  });// End of then

  const returnObj = {};
  returnObj.EXT_STATS_KEY = EXT_STATS_KEY;
  returnObj.start = function returnObjStart(callback) {
    dataCollectionCache.domains = {};
    filterNotifier.on('filter.hitCount', filterListener);
    replacedCounts.adReplacedNotifier.on('adReplaced', adReplacedListener);
    browser.tabs.onUpdated.addListener(handleTabUpdated);
    addMessageListener();
    startProcessInterval();
    setSetting('local_data_collection', true, callback);
  };
  returnObj.end = function returnObjEnd(callback) {
    clearInterval(intervalFN);
    clearCache();
    filterNotifier.off('filter.hitCount', filterListener);
    replacedCounts.adReplacedNotifier.off('adReplaced', adReplacedListener);
    browser.tabs.onUpdated.removeListener(handleTabUpdated);
    setSetting('local_data_collection', false, callback);
  };
  returnObj.clearCache = clearCache;
  returnObj.getCache = function returnObjGetCache() {
    return dataCollectionCache;
  };
  returnObj.saveCacheData = saveCacheData;
  returnObj.easyPrivacyURL = easyPrivacyURL;
  returnObj.exportRawStats = function returnObjFilterStats(callback) {
    browser.storage.local.get(EXT_STATS_KEY).then((hourlyResponse) => {
      const savedData = hourlyResponse[EXT_STATS_KEY] || { };
      if (typeof callback === 'function') {
        callback(savedData);
      }
    });
  };
  returnObj.getRawStatsSize = function returnObjFilterStatsSize(callback) {
    LocalDataCollection.exportRawStats((rawStats) => {
      callback(JSON.stringify(rawStats).length);
    });
  };
  // Note: the following function is used for testing purposes
  // Import filter list statistics which will be converted to the format needed / used
  // by the 'stats' tab.
  // Inputs: filterStatsArray: array of stringified JSON filter list statistics data
  //         from the DataCollection V2 messages.
  // Returns: a Promise, resolved when complete
  returnObj.importFilterStats = function returnObjFilterStats(filterStatsArray) {
    return new Promise((resolve) => {
      let parsedfilterStats = {};
      try {
        parsedfilterStats = JSON.parse(filterStatsArray);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.log(e);
        resolve(`error : ${e.toString()}`);
        return;
      }
      browser.storage.local.get(EXT_STATS_KEY).then((hourlyResponse) => {
        const savedData = hourlyResponse[EXT_STATS_KEY] || { };
        for (let inx = 0; inx < parsedfilterStats.length; inx++) {
          const dupDataCache = parsedfilterStats[inx];
          // only process new data
          // don't overwrite existing data
          if (!savedData[Date.parse(dupDataCache.timeOfLastPush)]) {
            const hourSnapShot = {};
            const initializeDomainDataObject = function (domain) {
              hourSnapShot[domain] = {};
              hourSnapShot[domain].ads = 0;
              hourSnapShot[domain].trackers = 0;
              hourSnapShot[domain].adsReplaced = 0;
              if (dupDataCache.domains[domain] && typeof dupDataCache.domains[domain].adsReplaced === 'number') {
                hourSnapShot[domain].adsReplaced = dupDataCache.domains[domain].adsReplaced;
              }
            };
            for (const domain in dupDataCache.domains) {
              initializeDomainDataObject(domain);
            }
            const processDomainByFilterType = function (filter, domains, filterRequestType) {
              for (const domain in domains) {
                if (!hourSnapShot[domain]) {
                  initializeDomainDataObject(domain);
                }
                if (dupDataCache.filters[filter].subscriptions
                    && dupDataCache.filters[filter].subscriptions.length
                    && dupDataCache.filters[filter].subscriptions.includes(easyPrivacyURL)) {
                  hourSnapShot[domain].trackers
                    += dupDataCache.filters[filter][filterRequestType][domain].hits;
                } else {
                  hourSnapShot[domain].ads
                    += dupDataCache.filters[filter][filterRequestType][domain].hits;
                }
              }
            };
            for (const filter in dupDataCache.filters) {
              processDomainByFilterType(filter, dupDataCache.filters[filter].firstParty, 'firstParty');
              processDomainByFilterType(filter, dupDataCache.filters[filter].thirdParty, 'thirdParty');
            }
            savedData[Date.parse(dupDataCache.timeOfLastPush)] = JSON.parse(JSON.stringify({
              v: '1',
              doms: hourSnapShot,
            }));
          }
        }// end for loop
        chromeStorageSetHelper(EXT_STATS_KEY, savedData);
        resolve(' success! ');
      });
    });
  };
  return returnObj;
}());

exports.LocalDataCollection = LocalDataCollection;