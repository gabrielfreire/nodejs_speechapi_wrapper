"use strict";
function SpeechRecognizerAPI(textElement) {
    var url = 'http://localhost:3000';
    this.textElement = textElement;
    this.mediaStream = null;
    this.context = null;
    this.outputBuffer = [];
    this.micInput = null;
    this.scriptNode = null;
    this.numChannels = 1;
    this.recLength = 0;
    this.waveStreamEncoder = new WaveEncoder();
    this.isRecording = false;
    
    this.socket = io(url);
    this.socket.on('connect', function(){
        console.log('connected to localhost:3000');
    });
    this.socket.on('disconnect', function(){
        console.log('disconnected from localhost:3000');
    });
}
/**
 * Initialize outputBuffer to receive Audio information
 */
SpeechRecognizerAPI.prototype.initBuffers = function() {
    if(this.numChannels > 1) {
        for(var channel = 0; channel < this.numChannels; channel++) {
            this.outputBuffer[channel] = [];
        }
    } else {
        this.outputBuffer[0] = [];
    }
}
/**
 * merge all the buffers into one big buffer
 * @param {Float32Array} recBuffers 
 * @param {number} recLength 
 */
SpeechRecognizerAPI.prototype.mergeBuffers = function(recBuffers, recLength) {
    var result = new Float32Array(recLength);
    var offset = 0;
    for (var i = 0; i < recBuffers.length; i++) {
        result.set(recBuffers[i], offset);
        offset += recBuffers[i].length;
    }
    return result;
}

/**
 * Method for changing the sampling rate
 * @param {Float32Array} data - Float32Array with audio information
 * @param {number} newSampleRate - the desired sample rate
 * @param {number} oldSampleRate - the old sample rate from AudioContext
 */
SpeechRecognizerAPI.prototype.interpolateArray = function(data, newSampleRate, oldSampleRate) {
    var fitCount = Math.round(data.length*(newSampleRate/oldSampleRate));
    var newData = new Array();
    var springFactor = new Number((data.length - 1) / (fitCount - 1));
    newData[0] = data[0]; // for new allocation
    for ( var i = 1; i < fitCount - 1; i++) {
        var tmp = i * springFactor;
        var before = new Number(Math.floor(tmp)).toFixed();
        var after = new Number(Math.ceil(tmp)).toFixed();
        var atPoint = tmp - before;
        newData[i] = this.linearInterpolate(data[before], data[after], atPoint);
    }
    newData[fitCount - 1] = data[data.length - 1]; // for new allocation
    return newData;
};
/**
 * Interpolate form different indexes
 * @param {number} before 
 * @param {number} after 
 * @param {number} atPoint 
 */
SpeechRecognizerAPI.prototype.linearInterpolate = function(before, after, atPoint) {
    return before + (after - before) * atPoint;
};
/**
 * Make a WAV blob
 * @param {Array} recBuffer - the output buffer containing audio information
 * @param {string} type - file type 'audio/wav'
 * @param {number} desiredSampleRate - The desired sampling rate to apply to the audio. using 16000 in this case
 */
SpeechRecognizerAPI.prototype.exportWAV = function(recBuffer, type, desiredSampleRate) {
    var self = this;
    var buffers = [];
    var merged = this.mergeBuffers(recBuffer[0], this.recLength);
    merged = this.interpolateArray(merged, desiredSampleRate, this.context.sampleRate);
    buffers.push(merged);
    // TODO logic if we work with more than one channel, for now it isn't necessary since we're working with only 1 channel
    var interleaved = buffers[0];
    var data = this.waveStreamEncoder.encode(interleaved, this.context.sampleRate, desiredSampleRate);
    var audioBlob = new Blob([data.view], {type: type});
    return audioBlob;
}
/**
 * Setup script processor, handle audio processing and save frames to outputBuffer
 * @param {MediaStreamSource} source - MediaStreamSource from AudioContext
 * @param {MediaStream} mediaStream - stream of audio 
 */
SpeechRecognizerAPI.prototype.record = function(source, mediaStream) {
    var self = this;
    var desiredSampleRate = 16 * 1000;
    var context = source.context;
    "https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/createScriptProcessor"
    this.scriptNode = (function(){
        var bufferSize = 0;
        try {
            return context.createScriptProcessor(bufferSize, 1, 1);
        } catch (error) {
            bufferSize = 2048;
            let audioSampleRate = context.sampleRate;
            while (bufferSize < 16384 && audioSampleRate >= (2 * desiredSampleRate)) {
                bufferSize <<= 1;
                audioSampleRate >>= 1;
            }
            return context.createScriptProcessor(bufferSize, 1, 1);
        }
    })();
    // process the audio
    this.scriptNode.onaudioprocess = function(event) {
        if(!self.isRecording) return;
        var inputFrame = event.inputBuffer.getChannelData(0);
        // if you wish to hear yourself while recording
        // var outputFrame = event.outputBuffer.getChannelData(0);
        var buffer = [];
        for(var i = 0; i < inputFrame.length; i++) {
            // if you wish to hear yourself while recording
            // outputFrame[i] = inputFrame[i];
            buffer.push(inputFrame[i]);
        }
        self.outputBuffer[0].push(buffer);
        self.recLength += buffer.length;
    };
    source.connect(this.scriptNode);
    this.scriptNode.connect(context.destination);
}
/**
 * Method used by UI to activate microphone and record
 */
SpeechRecognizerAPI.prototype.speak = function() {
    var self = this;
    var nav = window.navigator;
    this.initBuffers();
    this.textElement.value = '';
    this.context = new AudioContext();
    nav.getUserMedia = (nav.getUserMedia ||
        nav.webkitGetUserMedia ||
        nav.mozGetUserMedia ||
        nav.msGetUserMedia);
    this.isRecording = true;
    nav.getUserMedia({
        audio: true
    }, function(stream) {
        self.mediaStream = stream;
        // "https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/createMediaStreamSource"
        self.micInput = self.context.createMediaStreamSource(stream);
        self.record(self.micInput, self.mediaStream);
    }, function(error) {
        console.error(JSON.stringify(error));
    });
}
/**
 * Method used by UI to stop the recording and get answer from API
 * @param {CNFormManager} formManager - CN_FormManager to activate search using lightPostData method
 * @param {string} elementId - the elementId for lightPostData
 */
SpeechRecognizerAPI.prototype.stop = function(formManager) {
    var self = this;
    this.isRecording = false;
    var blob = this.exportWAV(this.outputBuffer, 'audio/wav', 16 * 1000);
    this.getFileFromBlob(blob, function(file) {
        self.socket.emit('message', file);
        self.socket.on('result', function(data){
            console.log('Result from Speech API ->', data);
            data = JSON.parse(data);
            var value = data.DisplayText.replace('.','');
            self.textElement.value += value;
        });
        self.clear();
    });
}
/**
 * Make a File from a Blob to send to the server
 * @param {Blob} blob - blob from where to make the file
 * @param {Function} callback - function to be executed after the file is ready
 */
SpeechRecognizerAPI.prototype.getFileFromBlob = function(blob, callback) {
    if(!callback) throw new Error("1 Callback expected");
    var reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onload = function(event) {
        var file = {
            audio: {
                type: 'audio',
                dataURL: event.target.result
            }
        }
        URL.revokeObjectURL(blob);
        callback(file);
    };
}
/**
 * Disconnect microphone, node, clear and close context
 */
SpeechRecognizerAPI.prototype.clear = function() {
    this.recLength = 0;
    this.outputBuffer = [];
    this.micInput.disconnect(this.scriptNode);
    this.scriptNode.disconnect(this.context.destination);
    if(this.context.close) {
        this.context.close();
        this.context = null;
    } else if (this.context.state === "running") {
        this.context.suspend();
    }
    this.initBuffers();
}
