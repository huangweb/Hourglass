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
var month = formateNum(date.getMonth() + 1);
var day = formateNum(date.getDate());
var today = date.getFullYear() + '-' + month + '-' + day;

// only for debugging
var browsingTimeRecordTimerTemp = [];
var pageIdleTimeTemp = [];
// only for debugging

init();

function init() {
    addEventListener();
    initBroweringTimeData();
}

function formateNum(num){
    return num < 10 ? '0'+ num : num;
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
            console.error('页面onUpdated');  //only for debugging
            resetActivePageIdleTimer();
            countActivePageBrowsingtime();
        }
    });

    chrome.tabs.onActivated.addListener(function() {
        console.error('页面onActivated');   //only for debugging
        resetActivePageIdleTimer();
        countActivePageBrowsingtime();
    });

    chrome.tabs.onRemoved.addListener(function() {
        console.error('页面removed');   //only for debugging
        stopCountingBrowsingTime();
        stopCountingPageIdleTime();
    });
}

function countActivePageBrowsingtime() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs){
        stopCountingBrowsingTime();
        console.log('tabs',tabs);  //only for debugging
        if (!tabs.length)
            return;
        var currentTabId = tabs[0].id;
        chrome.tabs.get(currentTabId, function(tab) {
            stopCountingBrowsingTime();
            console.log('currentTabId', currentTabId)  //only for debugging
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

            //only for debugging
            console.log('开始计时, hostname:', hostname);
            console.log('浏览时间计时器数组', browsingTimeRecordTimerTemp);
            console.log('空闲时间计时器数组', pageIdleTimeTemp);
            //only for debugging

            var date = new Date();
            var month = formateNum(date.getMonth() + 1);
            var day = formateNum(date.getDate());
            var today = date.getFullYear() + '-' + month + '-' + day;
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

    //only for debugging
    browsingTimeRecordTimerTemp.push(browsingTimeRecordTimer);
    //only for debugging
}

function stopCountingPageIdleTime() {
    console.error('停止统计空闲时间');   //only for debugging
    clearInterval(activePageIdleTimer);

    //only for debugging
    pageIdleTimeTemp = pageIdleTimeTemp.filter(function (item) {
        return item !== activePageIdleTimer;
    })
    //only for debugging

    activePageIdleTimer = null;
}

function stopCountingBrowsingTime() {
    console.error('停止统计网页浏览时间'); //only for debugging
    clearInterval(browsingTimeRecordTimer);

    //only for debugging
    browsingTimeRecordTimerTemp = browsingTimeRecordTimerTemp.filter(function (item) {
        return item !== browsingTimeRecordTimer;
    });
    //only for debugging

    browsingTimeRecordTimer = null;
}

function resetActivePageIdleTimer() {
    console.error('复位空间时间统计');   //only for debugging
    clearInterval(activePageIdleTimer);

    //only for debugging
    pageIdleTimeTemp = pageIdleTimeTemp.filter(function (item) {
        return item !== activePageIdleTimer;
    })
    //only for debugging

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

    //only for debugging
    pageIdleTimeTemp.push(activePageIdleTimer);
    //only for debugging
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