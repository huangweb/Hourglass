var BUSY = 'BUSY';
var CHECK_VIDEO_STATUS = 'CHECK_VIDEO_STATUS';
var fnDebouncerTimer = null;

document.addEventListener('mousemove', delayFnExecute);
document.addEventListener('scroll', delayFnExecute);
document.addEventListener('keydown', delayFnExecute);

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.content === CHECK_VIDEO_STATUS) {
        var videos = Array.prototype.slice.call(document.querySelectorAll('video'));
        var isVideoPlaying = videos.some(function (video) {
            return !video.paused;
        });
        var message = {
            source: 'contentJS',
            target: 'background',
            content: {
                isVideoPlaying: isVideoPlaying
            }
        };
        sendResponse(message);
    }
});

function delayFnExecute () {
    clearTimeout(fnDebouncerTimer);
    fnDebouncerTimer = setTimeout(function() {
        var hostname = window.location.hostname
        sendMessage({
            pageStatus: BUSY,
            hostname: hostname
        });
    }, 500);
}

function sendMessage(content) {
    var message = {
        source: 'contentJS',
        content: content
    };

    try {
        chrome.runtime.sendMessage(message);
    } catch(e) {
        if (e.message.match(/Invocation of form runtime\.connect/) &&
            e.message.match(/doesn't match definition runtime\.connect/)) {
            console.error('Chrome extension has been reloaded. Please refresh the page');
        } else {
            throw(e);
        }
    }
}