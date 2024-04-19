import { MessageMetricsTracker } from './performance.js'

function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function randomIntFromInterval(min, max) { // min and max included 
    return Math.floor(Math.random() * (max - min + 1) + min)
}

const metrics = new MessageMetricsTracker()


function randomState () {
    const rndInt = randomIntFromInterval(1, 5)

    switch (rndInt) {
        case 1:
            return  "success"
        case 2:
            return "pending"
        case 3:
            return "timeout"
        case 4:
            return "error"
        case 5:
            return "stale"
    }
}

function promisifySetInterval(time) {
    setInterval(async () => {
        return new Promise(async (resolve) => {
            const uuid = "test_" + uuidv4()
            
            console.log("Collecting metrics...", uuid)
            metrics.init({ id: uuid, label: "test" })
            
            await new Promise(resolve => setTimeout(resolve, 2000));
            console.log("Done...", uuid)
            
            metrics.collect({ id: uuid, result: randomState() })
            resolve()
        })
    }, time);
}

promisifySetInterval(5000)