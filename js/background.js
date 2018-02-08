var tldjs = require('tldjs');
var BUSY = 'BUSY';
var IDLE = 'IDLE';
var CHECK_VIDEO_STATUS = 'CHECK_VIDEO_STATUS';
var MAX_BROWSING_TIME_RECORDS_LENGTH = 7;
var activeTabId;
var activePageHostname;
var todaysBrowsingTimeRecord;
var browsingTimeRecordTimer = null;
var activePageIdleTimer = null;
var date = new Date();
var today = date.getFullYear() + '-' +(date.getMonth() + 1) + '-' + date.getDate();

init();

function init() {
    addEventListener();
    initBroweringTimeData();
}

function addEventListener() {
    chrome.runtime.onInstalled.addListener(function(){
        chrome.notifications.create(null, {
            type: 'basic',
            iconUrl: '../img/icon_big.png',
            title: 'Hourglass installed',
            message: 'Please reload the page to get more accurate statistics:)'
        });
    });

    chrome.runtime.onMessage.addListener(function(request) {
        var content = request.content;
        if (request.source === 'contentJS' && content.pageStatus === BUSY) {
            resetActivePageIdleTimer();            
            if (activePageHostname !== content.hostname)
                stopCountingBrowsingTime();
            if (!browsingTimeRecordTimer)
                countActivePageBrowsingtime();
        }
    });

    chrome.tabs.onUpdated.addListener(function(tabId, changeInfo) {
        if (changeInfo.status === 'complete') {
            resetActivePageIdleTimer();
            countActivePageBrowsingtime();
        }
    });

    chrome.tabs.onActivated.addListener(function() {
        resetActivePageIdleTimer();
        countActivePageBrowsingtime();
    });

    chrome.tabs.onRemoved.addListener(function() {
        stopCountingBrowsingTime();
        stopCountingPageIdleTime();
    });
}

function countActivePageBrowsingtime() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs){
        stopCountingBrowsingTime();        
        if (!tabs.length)
            return;
        var currentTabId = tabs[0].id;
        chrome.tabs.get(currentTabId, function(tab) {
            stopCountingBrowsingTime();            
            if (!tab.url)
                return;
            var activeTabInfo = tldjs.parse(tab.url);
            if (activeTabInfo.isValid && activeTabInfo.domain) {
                activeTabId = currentTabId;                
                activePageHostname = activeTabInfo.hostname;
                startCountingBrowsingTime(activePageHostname);
            }
        });
    });
}

function startCountingBrowsingTime(hostname) {
    browsingTimeRecordTimer = setInterval(function() {
        chrome.storage.local.get('browsingTimeRecords', function (result) {
            var browsingTimeRecords = result.browsingTimeRecords;
            if (!browsingTimeRecords) {
                initBroweringTimeData();
                return;
            }
            var date = new Date();
            var today = date.getFullYear() + '-' +(date.getMonth() + 1) + '-' + date.getDate();
            addTodayRecordIfNeeded(browsingTimeRecords, today);
            var todaysTimeRecords = todaysBrowsingTimeRecord.dailyTimeRecords;
            var isHostnameExsited = todaysTimeRecords.some(function (hostnameTimeRecord) {
                if (hostnameTimeRecord.hostname === hostname) {
                    hostnameTimeRecord.browsingTime ++;
                    return true;
                }
            });
            if (!isHostnameExsited) {
                todaysTimeRecords.push({
                    hostname: hostname,
                    browsingTime: 1
                });
            }
            chrome.storage.local.set({
                browsingTimeRecords: browsingTimeRecords
            });
        })
    }, 1000);
}

function stopCountingPageIdleTime() {
    clearInterval(activePageIdleTimer);
    activePageIdleTimer = null;
}

function stopCountingBrowsingTime() {
    clearInterval(browsingTimeRecordTimer);
    browsingTimeRecordTimer = null;
}

function resetActivePageIdleTimer() {
    clearInterval(activePageIdleTimer);
    activePageIdleTimer = setInterval(function () {
        var message = {
            source: 'background',
            content: CHECK_VIDEO_STATUS
        };
        sendMessageToContentScript(message, function(response) {
            if (!response)
                return;
            if (response.target === 'background' && response.source === 'contentJS') {
                if (!response.content.isVideoPlaying) {
                    stopCountingBrowsingTime();
                    stopCountingPageIdleTime();
                }
            }
        });
    }, 60000);
}

function initBroweringTimeData() {
    chrome.storage.local.get('browsingTimeRecords', function (result) {
        if (!Object.getOwnPropertyNames(result).length) {
            chrome.storage.local.set({
                browsingTimeRecords: [{
                    date: today,
                    dailyTimeRecords: []
                }]
            });
        } else {
            var browsingTimeRecords = result.browsingTimeRecords;
            addTodayRecordIfNeeded(browsingTimeRecords, today);
            chrome.storage.local.set({
                browsingTimeRecords: browsingTimeRecords
            });
        }
    })
}

function addTodayRecordIfNeeded(browsingTimeRecords, today) {
    var isTodayRecordExisted = browsingTimeRecords.some(function(browsingTimeRecord) {
        if (browsingTimeRecord.date === today) {
            todaysBrowsingTimeRecord = browsingTimeRecord;
            return true;
        }
    });
    if (!isTodayRecordExisted) {
        todaysBrowsingTimeRecord = {
            date: today,
            dailyTimeRecords: []
        };
        if (browsingTimeRecords.length === MAX_BROWSING_TIME_RECORDS_LENGTH)
            browsingTimeRecords.shift();
        browsingTimeRecords.push(todaysBrowsingTimeRecord);
    }
}

function sendBrowsingTimeRecords() {
    chrome.storage.local.get('browsingTimeRecords', function (result) {
        var browsingTimeRecords = result.browsingTimeRecords;
        if (!browsingTimeRecords)
            return;
        sortBrowsingTimeRecords(browsingTimeRecords);
        var message = {
            source: 'background',
            target: 'popup',
            content: {
                browsingTimeRecords: browsingTimeRecords
            }
        };
        chrome.runtime.sendMessage(message);
        chrome.storage.local.set({
            browsingTimeRecords: browsingTimeRecords
        });

        function sortBrowsingTimeRecords(browsingTimeRecords) {
            if (!browsingTimeRecords.length)
                return;
            browsingTimeRecords.sort(compare);

            function compare(prev, next) {
                return prev.date > next.date;
            }
        }
    });
}

function sendMessageToContentScript(message, callback) {
    chrome.tabs.get(activeTabId, function(tab) {
        if (!tab.url)
            return;
        var activeTabInfo = tldjs.parse(tab.url);
        if (activeTabInfo.isValid && activeTabInfo.domain)
            chrome.tabs.sendMessage(activeTabId, message, function(response) {
                if(callback)
                    callback(response);
            });
    });
}