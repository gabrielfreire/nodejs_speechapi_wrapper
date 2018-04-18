const key = require('./../key');
const fs = require('fs');
const path = require('path');
const needle = require('needle');
const FILE_PATH_EX = path.join(__dirname, '../uploads/example.wav');

class SpeechService  {
    constructor(io) {
        this.filePath = path.join(__dirname, '../uploads/a-.wav');
        this.SpeechAPIURL = "https://speech.platform.bing.com/speech/recognition/dictation/cognitiveservices/v1?language=en-US&format=simple";
        io.on('connect', (client) => {
            console.log('Someone connected');
            let self = this;
            client.on('message', function(data) {
                self.clientOnMessage(data, client);
            });
            client.on('disconnect', self.clientOnDisconnect);
        });
    }

    speak() {
        return new Promise((resolve, reject) => {
            const input = fs.createReadStream(this.filePath);
            needle.post(this.SpeechAPIURL, input, this.getOptions(), (err, res, body) => {
                if (err) {
                    reject(err);
                }
                if (res.statusCode !== 200) {
                    reject(new Error(`Wrong status code ${res.statusCode} and message ${res.statusMessage} in Bing Speech API / synthesize`));
                }
                resolve(body);
            });
        });
    }

    getOptions() {
        let options = {};
        let headers = {};
        headers["Ocp-Apim-Subscription-Key"] = key;
        headers["Content-Type"] = 'audio/wav; codec="audio/pcm"; samplerate=16000';
        options['headers'] = headers;
        return options;
    }

    async clientOnMessage (data, client) {
        let fileName = 'a-';
        let result;
        this.writeToDisk(data.audio.dataURL, fileName + '.wav');
        result = await this.speak();
        if(result) {
            client.emit('result', result);
        }
    }
    clientOnDisconnect () {
        console.log('Someone disconnected');
    }

    writeToDisk(dataURL, fileName) {
        const fileExtension = fileName.split('.').pop();
        const fileRootNameWithBase = path.join(__dirname, '../uploads/' + fileName);
        const filePath = fileRootNameWithBase;
        let fileBuffer;
        let fileID = 2;
        // For now i'll just replace old files
        // while (fs.existsSync(filePath)) {
        //     filePath = fileRootNameWithBase + '(' + fileID + ').' + fileExtension;
        //     fileID += 1;
        // }
        dataURL = dataURL.split(',').pop();
        fileBuffer = new Buffer(dataURL, 'base64');
        fs.writeFileSync(filePath, fileBuffer);
        this.filePath = filePath;   
        console.log('File saved at:', filePath);
    }
}

module.exports = SpeechService;