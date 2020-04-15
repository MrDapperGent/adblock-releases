/** @module adblock-betafish/alias/subscriptionInit */

"use strict";

const {Subscription,
       DownloadableSubscription,
       SpecialSubscription} =
  require("subscriptionClasses");
const {filterStorage} = require("filterStorage");
const {filterNotifier} = require("filterNotifier");
const {recommendations} = require("./recommendations.js");
const info = require("info");
const {port} = require("../../adblockpluschrome/lib/messaging");
const {Prefs} = require("prefs");
const {synchronizer} = require("synchronizer");
const {initNotifications} = require("notificationHelper");
const {updatesVersion} = require("../../adblockpluschrome/adblockplusui/lib/prefs");

let firstRun;
let subscriptionsCallback = null;
let reinitialized = false;
let dataCorrupted = false;

/**
 * If there aren't any filters, the default subscriptions are added.
 * However, if patterns.ini already did exist and/or any preference
 * is set to a non-default value, this indicates that this isn't the
 * first run, but something went wrong.
 *
 * This function detects the first run, and makes sure that the user
 * gets notified (on the first run page) if the data appears incomplete
 * and therefore will be reinitialized.
 */
function detectFirstRun()
{
  return new Promise((resolve) => {
    firstRun = filterStorage.getSubscriptionCount() == 0;

    if (firstRun && (!filterStorage.firstRun || Prefs.currentVersion)) {
      reinitialized = true;
    }
    Prefs.currentVersion = info.addonVersion;

    browser.storage.local.get(null).then((currentData) => {
      const edgeMigrationNeeded = currentData.filter_lists;
      if (edgeMigrationNeeded && firstRun) {
        firstRun = false;
      }
      resolve();
    });
  });
}

/**
 * Determines whether to add the default ad blocking subscriptions.
 * Returns true, if there are no filter subscriptions besides those
 * other subscriptions added automatically, and no custom filters.
 *
 * On first run, this logic should always result in true since there
 * is no data and therefore no subscriptions. But it also causes the
 * default ad blocking subscriptions to be added again after some
 * data corruption or misconfiguration.
 *
 * @return {boolean}
 */
function shouldAddDefaultSubscriptions()
{
  for (let subscription of filterStorage.subscriptions())
  {
    if (subscription instanceof DownloadableSubscription &&
        subscription.url != Prefs.subscriptions_exceptionsurl &&
        subscription.url != Prefs.subscriptions_antiadblockurl &&
        subscription.type != "circumvention")
      return false;

    if (subscription instanceof SpecialSubscription &&
        subscription.filterCount > 0)
      return false;
  }

  return true;
}

/**
 * Finds the elements for the default ad blocking filter subscriptions based
 * on the user's locale.
 *
 * @param {Array.<object>} subscriptions
 * @return {Map.<string, object>}
 */
function chooseFilterSubscriptions(subscriptions)
{
  let chosenSubscriptions = new Map();

  let selectedLanguage = null;
  let matchCount = 0;

  for (let subscription of subscriptions)
  {
    let {languages, type} = subscription;
    let language = languages && languages.find(
      lang => new RegExp("^" + lang + "\\b").test(browser.i18n.getUILanguage())
    );

    if ((type == "ads" || type == "circumvention") &&
        !chosenSubscriptions.has(type))
    {
      chosenSubscriptions.set(type, subscription);
    }

    if (language)
    {
      // The "ads" subscription is the one driving the selection.
      if (type == "ads")
      {
        if (!selectedLanguage || selectedLanguage.length < language.length)
        {
          chosenSubscriptions.set(type, subscription);
          selectedLanguage = language;
          matchCount = 1;
        }
        else if (selectedLanguage && selectedLanguage.length == language.length)
        {
          matchCount++;

          // If multiple items have a matching language of the same length:
          // Select one of the items randomly, probability should be the same
          // for all items. So we replace the previous match here with
          // probability 1/N (N being the number of matches).
          if (Math.random() * matchCount < 1)
          {
            chosenSubscriptions.set(type, subscription);
            selectedLanguage = language;
          }
        }
      }
      else if (type == "circumvention")
      {
        chosenSubscriptions.set(type, subscription);
      }
    }
  }

  return chosenSubscriptions;
}

/**
 * Gets the filter subscriptions to be added when the extnesion is loaded.
 *
 * @return {Promise|Subscription[]}
 */
function getSubscriptions()
{
  let subscriptions = [];

  // Add pre-configured subscriptions
  for (let url of Prefs.additional_subscriptions)
    subscriptions.push(Subscription.fromURL(url));

  // Add "acceptable ads", "AdBlock Custom", and "BitCoing Mining Protection List" subscriptions
  if (firstRun)
  {
    if (info.platform !== "gecko") {
      let acceptableAdsSubscription = Subscription.fromURL(
        Prefs.subscriptions_exceptionsurl
      );
      acceptableAdsSubscription.title = "Allow non-intrusive advertising";
      subscriptions.push(acceptableAdsSubscription);
    }

    let abcSubscription = Subscription.fromURL('https://cdn.adblockcdn.com/filters/adblock_custom.txt');
    abcSubscription.title = "AdBlock custom filters";
    subscriptions.push(abcSubscription);

    let cplSubscription = Subscription.fromURL('https://raw.githubusercontent.com/hoshsadiq/adblock-nocoin-list/master/nocoin.txt');
    cplSubscription.title = "Cryptocurrency (Bitcoin) Mining Protection List";
    subscriptions.push(cplSubscription);

  }

  // Add default ad blocking subscriptions (e.g. EasyList, Anti-Circumvention)
  let addDefaultSubscription = shouldAddDefaultSubscriptions();
  if (addDefaultSubscription || !Prefs.subscriptions_addedanticv)
  {
    for (let [, value] of chooseFilterSubscriptions(recommendations()))
    {
      let {url, type, title, homepage} = value;

      // Make sure that we don't add Easylist again if we want
      // to just add the Anti-Circumvention subscription.
      if (!addDefaultSubscription && type != "circumvention")
        continue;

      let subscription = Subscription.fromURL(url);
      subscription.disabled = false;
      subscription.title = title;
      subscription.homepage = homepage;
      subscriptions.push(subscription);

      if (subscription.type == "circumvention")
        Prefs.subscriptions_addedanticv = true;
    }

    return subscriptions;
  }

  return subscriptions;
}

function removeSubscriptions() {
  return new Promise(function(resolve, reject) {
    if ("managed" in browser.storage)
    {
      browser.storage.managed.get(null).then(
        items =>
        {
          for (let key in items)
          {
            if (key === "remove_subscriptions" && Array.isArray(items[key]) && items[key].length)
            {
              for (let inx = 0; inx < items[key].length; inx++)
              {
                let subscription = Subscription.fromURL(items[key][inx]);
                filterStorage.removeSubscription(subscription);
              }
            }
          }
          resolve();
        },

        // Opera doesn't support browser.storage.managed, but instead of simply
        // removing the API, it gives an asynchronous error which we ignore here.
        () => {}
      );
    }
    else
    {
      resolve();
    }
  });
}

function addSubscriptionsAndNotifyUser(subscriptions)
{
  if (subscriptionsCallback)
    subscriptions = subscriptionsCallback(subscriptions);

  for (let subscription of subscriptions)
  {
    filterStorage.addSubscription(subscription);
    if (subscription instanceof DownloadableSubscription &&
        !subscription.lastDownload)
      synchronizer.execute(subscription);
  }

  // Show first run page or the updates page. The latter is only shown
  // on Chromium (since the current updates page announces features that
  // aren't new to Firefox users), and only if this version of the
  // updates page hasn't been shown yet.
  if (firstRun || info.platform == "chromium" &&
                  updatesVersion > Prefs.last_updates_page_displayed)
  {
    return Prefs.set("last_updates_page_displayed", updatesVersion).catch(() =>
    {
      dataCorrupted = true;
    }).then(() =>
    {
      if (!Prefs.suppress_first_run_page)
      {
        // Always show the first run page if a data corruption was detected
        // (either through failure of reading from or writing to storage.local).
        // The first run page notifies the user about the data corruption.
        let url;
        if (firstRun || dataCorrupted) {
          STATS.untilLoaded(function(userID)
          {
            browser.tabs.create({url: "https://getadblock.com/installed/?u=" + userID + "&lg=" + browser.i18n.getUILanguage() + "&dc=" + dataCorrupted });
          });
        }
      }
    });
  }
}

Promise.all([
  filterNotifier.once("ready"),
  Prefs.untilLoaded.catch(() => { dataCorrupted = true; })
]).then(detectFirstRun)
  .then(getSubscriptions)
  .then(addSubscriptionsAndNotifyUser)
  .then(removeSubscriptions)
  // We have to require the "uninstall" module on demand,
  // as the "uninstall" module in turn requires this module.
  .then(() => { require("./uninstall").setUninstallURL(); })
  .then(() => initNotifications(firstRun));

/**
 * Gets a value indicating whether a data corruption was detected.
 *
 * @return {boolean}
 */
exports.isDataCorrupted = () => dataCorrupted;

/**
 * Sets a callback that is called with an array of subscriptions to be added
 * during initialization. The callback must return an array of subscriptions
 * that will effectively be added.
 *
 * @param {function} callback
 */
exports.setSubscriptionsCallback = callback =>
{
  subscriptionsCallback = callback;
};

// Exports for tests only
exports.chooseFilterSubscriptions = chooseFilterSubscriptions;

/**
 * @typedef {object} subscriptionsGetInitIssuesResult
 * @property {boolean} dataCorrupted
 *   true if it appears that the user's extension data was corrupted.
 * @property {boolean} reinitialized
 *   true if we have reset the user's settings due to data corruption.
 */

/**
 * Returns an Object with boolean flags for any subscription initialization
 * issues.
 *
 * @event "subscriptions.getInitIssues"
 * @returns {subscriptionsGetInitIssuesResult}
 */
port.on("subscriptions.getInitIssues",
        (message, sender) => ({dataCorrupted, reinitialized}));
