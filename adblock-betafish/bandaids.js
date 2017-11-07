
// PornHub - related code in this file based on code from uBlockOrigin GPLv3.
// and available at https://github.com/uBlockOrigin/uAssets/blob/master/filters/filters.txt
// and https://github.com/uBlockOrigin/uAssets/blob/master/filters/resources.txt

var hostname = window.location.hostname;

var abort = (function() {
    'use strict';

    var doc = document;
    if (doc instanceof HTMLDocument === false) {
        if (doc instanceof XMLDocument === false ||
            doc.createElement('div') instanceof HTMLDivElement === false) {
            return true;
        }
    }
    if ((doc.contentType || '').lastIndexOf('image/', 0) === 0 ) {
        return true;
    }
    return false;
})();


if ( !abort ) {
    if (hostname === '') {
        hostname = (function() {
            var win = window, hn = '', max = 10;
            try {
                for (;;) {
                    hn = win.location.hostname;
                    if ( hn !== '' ) { return hn; }
                    if ( win.parent === win ) { break; }
                    win = win.parent;
                    if ( !win ) { break; }
                    if ( (max -= 1) === 0 ) { break; }
                }
            } catch(ex) {
            }
            return hn;
        })();
    }
    // Don't inject if document is from local network.
    abort = /^192\.168\.\d+\.\d+$/.test(hostname);
}

var instartLogicBusterV3 = function() {
  (function() {
    document.cookie = "morphi10c=1;max-age=86400";
    var mutationObserver = window.MutationObserver || window.WebKitMutationObserver || window.MozMutationObserver;
    DOMParser.prototype.parseFromString = function() { };
    document.createRange = function() { };
    var abCreateElement = document.createElement;
    var abCreateElementNS = document.createElementNS;
    var addEmptyAccessors = function(newElement, args) {
      var abAddEventListener = newElement.addEventListener;
      newElement.addEventListener = function() {
        var eventArgs = Array.prototype.slice.call(arguments);
        if (eventArgs &&
            eventArgs.length &&
            typeof eventArgs[0] === "string" &&
            (eventArgs[0].toUpperCase() !== "ERROR")) {
          abAddEventListener.apply(this, eventArgs);
        }
      };
    };
    var addObserver = function(newElement) {
        var observer = new mutationObserver(function(mutations) {
          mutations.forEach(function(mutation) {
            if (mutation.target &&
                       mutation.target.id &&
                       mutation.target.parentNode &&
                       (mutation.target.id.indexOf("_ads") > -1 ||
                        mutation.target.id.indexOf("google") > -1 ||
                        mutation.target.id.indexOf("zbi") > -1 ||
                        mutation.target.id.indexOf("fb_xdm_frame") > -1)) {
              mutation.target.parentNode.removeChild(mutation.target);
            }
          });
        });
        observer.observe(newElement, {
          'attributes': true
        });
    };
    var checkIfFrame = function(newElement, args) {
      if (args &&
          args.length &&
          typeof args[0] === "string" &&
          (args[0].toUpperCase() === "IFRAME" ||
           args[0].toUpperCase() === "DIV")) {
        addObserver(newElement);
      }
      if (args &&
          args.length > 1 &&
          typeof args[1] === "string" &&
          (args[1].toUpperCase() === "IFRAME" ||
           args[1].toUpperCase() === "DIV")) {
        addObserver(newElement);
      }
    };
    document.createElement = function() {
      var args = Array.prototype.slice.call(arguments);
      var newElement = abCreateElement.apply(this, args);
      addEmptyAccessors(newElement, args);
      checkIfFrame(newElement, args);
      return newElement;
    };
    document.createElementNS = function() {
      var args = Array.prototype.slice.call(arguments);
      var newElement = abCreateElementNS.apply(this, args);
      addEmptyAccessors(newElement, args);
      checkIfFrame(newElement, args);
      return newElement;
    };
  })();
};

var instartLogicBusterV2DomainsRegEx = /(^|\.)(calgaryherald\.com|edmontonjournal\.com|edmunds\.com|financialpost\.com|leaderpost\.com|montrealgazette\.com|nationalpost\.com|ottawacitizen\.com|theprovince\.com|thestarphoenix\.com|windsorstar.com)$/;

var instartLogicBusterV1DomainsRegEx = /(^|\.)(baltimoresun\.com|boston\.com|capitalgazette\.com|carrollcountytimes\.com|celebuzz\.com|celebslam\.com|chicagotribune\.com|computershopper\.com|courant\.com|dailypress\.com|deathandtaxesmag\.com|extremetech\.com|gamerevolution\.com|geek\.com|gofugyourself\.com|hearthhead\.com|infinitiev\.com|lolking.net|mcall\.com|mmo-champion\.com|nasdaq\.com|orlandosentinel\.com|pcmag\.com|ranker\.com|sandiegouniontribune\.com|saveur\.com|sherdog\.com|\.spin\.com|sporcle\.com|stereogum\.com|sun-sentinel\.com|thefrisky\.com|thesuperficial\.com|timeanddate\.com|tmn\.today|twincities\.com|vancouversun\.com|vibe\.com|weather\.com)$/;

var getAdblockDomain = function() {
  adblock_installed = true;
};

var getAdblockDomainWithUserID = function(userid) {
  adblock_userid = userid;
};

(function() {
    'use strict';

    if ( abort ) {
      return;
    }

    // Only for dynamically created frames and http/https documents.
    if ( /^(https?:|about:)/.test(window.location.protocol) !== true ) {
      return;
    }

    // https://bugs.chromium.org/p/chromium/issues/detail?id=129353
    // Trap calls to WebSocket constructor, and expose websocket-based network
    // requests to AdBlock

    // Fix won't be applied on older versions of Chromium.
    if ( window.WebSocket instanceof Function === false ) {
      return;
    }

    var doc = document;
    var parent = doc.head || doc.documentElement;
    if ( parent === null ) {
      return;
    }

    var scriptText = [];

    // Have the script tag remove itself once executed (leave a clean
    // DOM behind).
    var cleanup = function() {
        var c = document.currentScript, p = c && c.parentNode;
        if ( p ) {
            p.removeChild(c);
        }
    };

    if (instartLogicBusterV2DomainsRegEx.test(hostname) === true ) {
      scriptText.push('(' + instartLogicBusterV3.toString() + ')();');
    }
    else if (instartLogicBusterV1DomainsRegEx.test(hostname) === true ) {
      scriptText.push('(' + instartLogicBusterV3.toString() + ')();');
    }
    else if ('getadblock.com' === document.location.hostname ||
        'dev.getadblock.com' === document.location.hostname) {
      scriptText.push('(' + getAdblockDomain.toString() + ')();');
      chrome.storage.local.get('userid', function (response) {
        var adblock_user_id = response['userid'];
        var elem = document.createElement('script');
        scriptText.push('(' + getAdblockDomainWithUserID.toString() + ')(\'' + adblock_user_id + '\');' +
        '(' + cleanup.toString() + ')();');
        elem.appendChild(document.createTextNode(scriptText.join('\n')));
        try {
            (document.head || document.documentElement).appendChild(elem);
        } catch(ex) {
        }
      });
      return;
    }

    if ( scriptText.length === 0 ) { return; }

    scriptText.push('(' + cleanup.toString() + ')();');
    var elem = document.createElement('script');
    elem.appendChild(document.createTextNode(scriptText.join('\n')));
    try {
        (document.head || document.documentElement).appendChild(elem);
    } catch(ex) {
    }
})();

var run_bandaids = function()
{
  // Tests to determine whether a particular bandaid should be applied
  var apply_bandaid_for = "";
  if (/pornhub\.com/.test(document.location.hostname))
  {
    apply_bandaid_for = "pornhub";
  }
  else if (/mail\.live\.com/.test(document.location.hostname))
  {
    apply_bandaid_for = "hotmail";
  }
  else if (("getadblock.com" === document.location.hostname ||
            "dev.getadblock.com" === document.location.hostname) &&
           (window.top === window.self))
  {
    if (/\/question\/$/.test(document.location.pathname))
    {
      apply_bandaid_for = "getadblockquestion";
    }
    else
    {
      apply_bandaid_for = "getadblock";
    }
  }
  else if (/mobilmania\.cz|zive\.cz|doupe\.cz|e15\.cz|sportrevue\.cz|autorevue\.cz/.test(document.location.hostname))
  {
    apply_bandaid_for = "czech_sites";
  }
  else
  {
    var hosts = [/mastertoons\.com$/];
    hosts = hosts.filter(function(host)
    {
      return host.test(document.location.hostname);
    });
    if (hosts.length > 0)
    {
      apply_bandaid_for = "noblock";
    }
  }
  var bandaids = {
    noblock : function()
    {
      var styles = document.querySelectorAll("style");
      var re = /#(\w+)\s*~\s*\*\s*{[^}]*display\s*:\s*none/;
      for (var i = 0; i < styles.length; i++)
      {
        var id = styles[i].innerText.match(re);
        if (id)
        {
          styles[i].innerText = '#' + id[1] + ' { display: none }';
        }
      }
    },
    hotmail : function()
    {
      // removing the space remaining in Hotmail/WLMail
      var css_chunk = document.createElement("style");
      css_chunk.type = "text/css";
      (document.head || document.documentElement).insertBefore(css_chunk, null);
      css_chunk.sheet.insertRule(".WithRightRail { right:0px !important; }", 0);
      css_chunk.sheet.insertRule("#RightRailContainer  { display:none !important; visibility: none !important; orphans: 4321 !important; }", 0);
    },
    getadblockquestion : function()
    {
      BGcall('addGABTabListeners');
      var personalBtn = document.getElementById("personal-use");
      var enterpriseBtn = document.getElementById("enterprise-use");
      var buttonListener = function(event)
      {
        BGcall('removeGABTabListeners', true);
        if (enterpriseBtn)
        {
          enterpriseBtn.removeEventListener("click", buttonListener);
        }
        if (personalBtn)
        {
          personalBtn.removeEventListener("click", buttonListener);
        }
      };
      if (personalBtn)
      {
        personalBtn.addEventListener("click", buttonListener);
      }
      if (enterpriseBtn)
      {
        enterpriseBtn.addEventListener("click", buttonListener);
      }
    },
    getadblock : function()
    {
      chrome.storage.local.get("userid", function(response)
      {
        if (response.userid)
        {
          var elemDiv = document.createElement("div");
          elemDiv.id = "adblock_user_id";
          elemDiv.innerText = response.userid;
          elemDiv.style.display = "none";
          document.body.appendChild(elemDiv);
        }
      });
      if (document.getElementById("enable_show_survey"))
      {
        document.getElementById("enable_show_survey").onclick = function(event)
        {
          BGcall("setSetting", "show_survey", !document.getElementById("enable_show_survey").checked, true);
        };
      }
      var aaElements = document.querySelectorAll("#disableacceptableads");
      if (aaElements &&
          aaElements.length)
      {
        for (i = 0; i < aaElements.length; ++i)
        {
          aaElements[i].onclick = function(event)
          {
            if (event.isTrusted === false) {
              return;
            }
            event.preventDefault();
            BGcall("unsubscribe", {
              id : "acceptable_ads",
              del : false
            }, function()
            {
              BGcall("recordGeneralMessage", "disableacceptableads clicked", undefined, function()
              {
                BGcall("openTab", "options.html?tab=0&aadisabled=true");
              });
              // Rebuild the rules if running in Safari
              if (SAFARI)
              {
                // TODO: handle this background page call
                BGcall("update_subscriptions_now");
              }
            });
          }
        }
      }
    },
    czech_sites : function()
    {
      var player = document.getElementsByClassName("flowplayer");
      // Remove data-ad attribute from videoplayer
      if (player)
      {
        for (var i = 0; i < player.length; i++)
        {
          player[i].removeAttribute("data-ad");
        }
      }
    },
    pornhub: function() {
      (function() {
      	var w = window;
      	var count = Math.ceil(8+Math.random()*4);
      	var tomorrow = new Date(Date.now() + 86400);
      	var expire = tomorrow.toString();
      	document.cookie = 'FastPopSessionRequestNumber=' + count + '; expires=' + expire;
      	var db;
      	if ( (db = w.localStorage) ) {
      		db.setItem('InfNumFastPops', count);
      		db.setItem('InfNumFastPopsExpire', expire);
      	}
      	if ( (db = w.sessionStorage) ) {
      		db.setItem('InfNumFastPops', count);
      		db.setItem('InfNumFastPopsExpire', expire);
      	}
      })();
      (function() {
      	var removeAdFrames = function(aa) {
      		var el;
      		for ( var i = 0; i < aa.length; i++ ) {
      			el = document.getElementById(aa[i]);
      			if ( el !== null ) {
      				el.parentNode.removeChild(el);
      			}
      		}
      	};
      	Object.defineProperty(window, 'block_logic', {
      		get: function() { return removeAdFrames; },
      		set: function() {}
      	});
      })();
    },
  }; // end bandaids

  if (apply_bandaid_for)
  {
    bandaids[apply_bandaid_for]();
  }

};
