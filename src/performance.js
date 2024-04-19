function time_ago(time) {
    switch (typeof time) {
        case 'number':
            break;
        case 'string':
            time = +new Date(time);
            break;
        case 'object':
            if (time.constructor === Date) time = time.getTime();
            break;
        default:
            time = +new Date();
    }
    const time_formats = [
        [60, 'seconds', 1], // 60
        [120, '1 minute ago', '1 minute from now'], // 60*2
        [3600, 'minutes', 60], // 60*60, 60
        [7200, '1 hour ago', '1 hour from now'], // 60*60*2
        [86400, 'hours', 3600], // 60*60*24, 60*60
        [172800, 'Yesterday', 'Tomorrow'], // 60*60*24*2
        [604800, 'days', 86400], // 60*60*24*7, 60*60*24
        [1209600, 'Last week', 'Next week'], // 60*60*24*7*4*2
        [2419200, 'weeks', 604800], // 60*60*24*7*4, 60*60*24*7
        [4838400, 'Last month', 'Next month'], // 60*60*24*7*4*2
        [29030400, 'months', 2419200], // 60*60*24*7*4*12, 60*60*24*7*4
        [58060800, 'Last year', 'Next year'], // 60*60*24*7*4*12*2
        [2903040000, 'years', 29030400], // 60*60*24*7*4*12*100, 60*60*24*7*4*12
        [5806080000, 'Last century', 'Next century'], // 60*60*24*7*4*12*100*2
        [58060800000, 'centuries', 2903040000] // 60*60*24*7*4*12*100*20, 60*60*24*7*4*12*100
    ];

    const seconds = (+new Date() - time) / 1000,
        token = 'ago',
        list_choice = 1;

    if (seconds == 0) {
        return 'Just now'
    }
    if (seconds < 0) {
        seconds = Math.abs(seconds);
        token = 'from now';
        list_choice = 2;
    }
    let i = 0,
        format;
    while (format = time_formats[i++])
        if (seconds < format[0]) {
            if (typeof format[2] == 'string')
                return format[list_choice];
            else
                return Math.floor(seconds / format[2]) + ' ' + format[1] + ' ' + token;
        }
    return time;
}

class Metric {
    constructor({ label, first_seen, id, response = null, result = null }) {
        if (!label || !first_seen || !id) throw Error("Invalid metric")

        this.label = label
        this.first_seen = first_seen
        this.transactionId = id
        this.response_time = response || 0
        this.result = result
    }
}

export class MessageMetricsTracker {
    MAX_HISTORY = 300
    _AVERAGE_PROCESS_DURATIONS = []
    _LAST_MESSAGE_RECEIVED_TIME = 0
    _LAST_METRIC_PRINTED_TIME = 0

    constructor() {
        setInterval(() => {
            if ((new Date().getTime() - this._LAST_MESSAGE_RECEIVED_TIME) < 2000) {
                this.printMetrics()
            }
        }, 1000)

        setInterval(() => {
            if ((new Date().getTime() - this._LAST_METRIC_PRINTED_TIME) < 50000) {
                this.printMetrics('[PERIODIC]')
            }
        }, 60000)
    }

    _addMetric(item) {
        if (this._AVERAGE_PROCESS_DURATIONS.length > this.MAX_HISTORY) this._AVERAGE_PROCESS_DURATIONS.shift();
        this._AVERAGE_PROCESS_DURATIONS.push(item);
    }

    _getAverageFrequencyDurations() {
        const typeIndexTracker = {};

        // [Metric { type: 'RealtimeDiagnostics', first_seen: 1703182172633 }, {...}]    
        const averages = this._AVERAGE_PROCESS_DURATIONS.reduce((avgs, item, _, arr) => {
            //console.log(avgs, item)
            let previousByTypeIndex;
            let frequency;
            // Filter array by current type
            const arr_by_type = arr.filter(i => i.label === item.label);

            // Start with zero
            if (!(item.label in avgs)) {
                typeIndexTracker[item.label] = 0;
                avgs[item.label] = {
                    frequency: 0,
                    last_seen: item.first_seen,
                    count: 0,
                    response_time: 0,
                    response_time_min: 0,
                    response_time_max: 0,
                    timeouts: 0,
                    successes: 0,
                    stales: 0,
                    errors: 0,
                    pendings: 0
                };
                console.log(avgs)
            }

            // frequency requires previous item in order to calculate
            if (typeIndexTracker[item.label] > 0) {
                previousByTypeIndex = typeIndexTracker[item.label] - 1;
                frequency = item.first_seen - arr_by_type[previousByTypeIndex].first_seen;
                avgs[item.label].frequency = avgs[item.label].frequency + frequency;
            }

            // Collect response time, timeouts, successes, errors, pendings, stales
            console.log(item.first_seen);
            const response_time = item.response_time ? item.response_time - item.first_seen : 0;
            console.log(">>>", response_time, item.response_time)
            const response_time_min = response_time < item.response_time ? response_time : item.response_time;
            const response_time_max = response_time > item.response_time ? response_time : item.response_time;
            const timeout = item.result === 'timeout' ? 1 : 0;
            const success = item.result === 'success' ? 1 : 0;
            const pending = item.result === 'pending' ? 1 : 0;
            const stale = item.result === 'stale' ? 1 : 0;
            const error = item.result === 'error' ? 1 : 0;

            // Summation (before calculating average)
            avgs[item.label].response_time = avgs[item.label].response_time + response_time;
            
            console.log(">>>", response_time_min, response_time_max)

            // Get min and max
            avgs[item.label].response_time_min = response_time_min;
            avgs[item.label].response_time_max = response_time_max;

            // Count
            avgs[item.label].timeouts = avgs[item.label].timeouts + timeout;
            avgs[item.label].successes = avgs[item.label].successes + success;
            avgs[item.label].errors = avgs[item.label].errors + error;
            avgs[item.label].stales = avgs[item.label].stales + stale;
            avgs[item.label].pendings = avgs[item.label].pendings + pending;

            //console.log(`[METRICS TEST 1]: index: ${typeIndexTracker[item.label]} | ARRAY BY TYPE: ${JSON.stringify(arr_by_type, null, 2)}, Last_seen: ${item.first_seen} | Previous last seen: ${arr_by_type[previousByTypeIndex].first_seen}, duration: ${item.first_seen - arr_by_type[previousByTypeIndex].first_seen}\n`)

            // Create new key 'last_seen' (avgs[item.label].last_seen) to first_seen value of last item item
            if (typeIndexTracker[item.label] === arr_by_type.length - 1) {
                avgs[item.label].last_seen = item.first_seen
                avgs[item.label].count = typeIndexTracker[item.label] + 1;
            }

            // Increment index for each type
            typeIndexTracker[item.label]++;

            return avgs;
        }, {});

        return averages;
    }

    // Collect messages by type and time sent so we can calculate frequency
    init({ id, label }) {
        this._LAST_MESSAGE_RECEIVED_TIME = new Date().getTime()
        this._addMetric(new Metric({ label, first_seen: new Date().getTime(), id }))
    }

    collect({ id, result }) {
        const index = this._AVERAGE_PROCESS_DURATIONS.findIndex(i => i.transactionId === id)
        if (index > -1) {
            // Update response time and result
            this._AVERAGE_PROCESS_DURATIONS[index].response_time = new Date().getTime()
            this._AVERAGE_PROCESS_DURATIONS[index].result = result
        }
    }

    printMetrics(reason = false) {
        /*
        Metric {
          type: 'RealtimeDiagnostics',
          first_seen: 1703200673026,
          transactionId: 'a62ffdaa-48ad-4515-a97e-602479f01618',
          response_time: 1703200673086,
          result: 'success'
        }
        */

        const metrics = Object.entries(this._getAverageFrequencyDurations())
            .sort((a, b) => {
                return a[1].last_seen - b[1].last_seen
            })
            .map(([key, value]) => {
                console.log(value)
                return {
                    type: key,

                    // Frequency
                    count: value.count,
                    frequency: value.frequency ? `${(value.frequency / 1000 / value.count).toFixed(2)} secs` : `once`,
                    last_seen: time_ago(value.last_seen),

                    // Metrics
                    response_time_min: `${(value.response_time_min).toFixed(2)} secs`,
                    response_time_max: `${(value.response_time_max).toFixed(2)} secs`,
                    response_time_avg: `${(value.response_time / 1000 / value.count).toFixed(2)} secs`,

                    // Statuses
                    success: `${(value.successes / value.count * 100).toFixed(2)}% (${value.successes})`,
                    pending: `${(value.pendings / value.count * 100).toFixed(2)}% (${value.pendings})`,
                    timeout: `${(value.timeouts / value.count * 100).toFixed(2)}% (${value.timeouts})`,
                    error: `${(value.errors / value.count * 100).toFixed(2)}% (${value.errors})`,
                    stale: `${(value.stales / value.count * 100).toFixed(2)}% (${value.stales})`,

                    // Debug
                    test: value,
                }
            })

        this._LAST_METRIC_PRINTED_TIME = new Date().getTime()
        console.log("\n\n\n-----------------------------------")
        console.log(`[API METRICS]${reason ? ' -> Reason: ' + reason + ':' : ':'}\n`, metrics)
        console.log("-----------------------------------\n\n\n")
    }
}