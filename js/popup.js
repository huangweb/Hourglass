window.onload = function () {
    var myChart = echarts.init(document.getElementById('main'));
    var backgroundPage = chrome.extension.getBackgroundPage();
    var MAX_TIME_RECORDS_SHOWN_NUM = 7;
    var browsingTimeRecords;
    var date = new Date();
    var month = formateNum(date.getMonth() + 1);
    var day = formateNum(date.getDate());
    var today = date.getFullYear() + '-' + month + '-' + day;

    var echartsOption = {
        baseOption: {
            timeline : {
                data : [],
                axisType: 'category',
                controlStyle: {
                    showPlayBtn: false
                },
                label: {
                    formatter : function(time) {
                        var date = new Date(time);
                        return formateNum(date.getMonth() + 1) + '-' + formateNum(date.getDate()) + '\n' + date.getFullYear();
                    }
                },
                currentIndex: 0
            },
            tooltip : {
                trigger: 'item',
                formatter: function (params) {
                    var data = params.data;
                    return data.standardTime + '<br/>' + '(' + data.percentage.toFixed(2) + '%)';
                }
            }
        },
        options : []
    };

    backgroundPage.sendBrowsingTimeRecords();

    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.target === 'popup' && request.source === 'background') {
            browsingTimeRecords = request.content.browsingTimeRecords;
            if (!browsingTimeRecords)
                return;
            sortDailyBrowsingTime(browsingTimeRecords);
            initEchartsOption(echartsOption, browsingTimeRecords);
            myChart.setOption(echartsOption);
        }
    });

    function formateNum(num){
        return num < 10 ? '0'+ num : num;
    }

    function sortDailyBrowsingTime(browsingTimeRecords) {
        browsingTimeRecords.forEach(function(browsingTimeRecord) {
            browsingTimeRecord.dailyTimeRecords.sort(compare);

            function compare(prev, next) {
                return next.browsingTime - prev.browsingTime;
            }
        });
    }

    function initEchartsOption(echartsOption, browsingTimeRecords) {
        initTimeline(echartsOption, browsingTimeRecords);
        initOptions(echartsOption.options, browsingTimeRecords);
    }

    function initTimeline(echartsOption, browsingTimeRecords) {
        browsingTimeRecords.forEach(function (browsingTimeRecord, index) {
            if (browsingTimeRecord.date === today) {
                echartsOption.baseOption.timeline.currentIndex = index;
                echartsOption.baseOption.timeline.data.push({
                    value: browsingTimeRecord.date,
                    tooltip: {
                        formatter: function () {
                            return "Today's time record";
                        }
                    },
                    symbol: 'diamond',
                    symbolSize: 18
                });
            } else {
                echartsOption.baseOption.timeline.data.push(browsingTimeRecord.date);
            }
        });
    }

    function initOptions(options, browsingTimeRecords) {
        browsingTimeRecords.forEach(function (browsingTimeRecord) {
            var date = browsingTimeRecord.date;
            var firstFewBrowsingTimeRecords = browsingTimeRecord.dailyTimeRecords.splice(0, MAX_TIME_RECORDS_SHOWN_NUM);
            formateDailyBrowsingTime(firstFewBrowsingTimeRecords, date);
            var option = {
                title : {
                    text: 'Time spent on the browser:',
                    subtext: 'TOP 7',
                    x:'right'
                },
                legend: {
                    orient: 'vertical',
                    left: 'left',
                    selectedMode: false,
                    data: getLendData()
                },
                series : [
                    {
                        name:'Time spent on the browser:',
                        type:'pie',
                        center: ['60%', '45%'],
                        radius: '50%',
                        data:firstFewBrowsingTimeRecords,
                    }
                ]
            };
            options.push(option);

            function getLendData() {
                return firstFewBrowsingTimeRecords.map(function (item) {
                    return item.hostname;
                })
            }
        })
    }

    function formateDailyBrowsingTime(firstFewBrowsingTimeRecords) {
        var totalBrowsingTime = 0;
        firstFewBrowsingTimeRecords.forEach(function(hostnameTimeRecord) {
            addStandardTime(hostnameTimeRecord);
            addValue(hostnameTimeRecord);
            addName(hostnameTimeRecord);
            totalBrowsingTime += hostnameTimeRecord.browsingTime;
        });
        firstFewBrowsingTimeRecords.forEach(function(hostnameTimeRecord) {
            addPercentage(hostnameTimeRecord, totalBrowsingTime)
        });
    }

    function addStandardTime(hostnameTimeRecord) {
        hostnameTimeRecord.standardTime = getStandardTime(hostnameTimeRecord.browsingTime);
    }

    function addPercentage(hostnameTimeRecord, totalBrowsingTime) {
        hostnameTimeRecord.percentage = (hostnameTimeRecord.browsingTime / totalBrowsingTime) * 100;
    }

    function addValue(hostnameTimeRecord) {
        hostnameTimeRecord.value = hostnameTimeRecord.browsingTime;
    }

    function addName(hostnameTimeRecord) {
        hostnameTimeRecord.name = hostnameTimeRecord.hostname;
    }

    function getStandardTime(time) {
        var hours = parseInt(time / 3600);
        var minutes = parseInt((time % 3600) / 60);
        var seconds = time - hours * 3600 - minutes * 60;
        return hours + 'hr ' + minutes + 'min ' + seconds + 'sec';
    }
}