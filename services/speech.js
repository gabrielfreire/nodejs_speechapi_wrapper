const SDK = require('microsoft-speech-browser-sdk');
const key = require('./../key');
class SpeechService  {
    constructor(io) {
        const SUB_KEY = key;
        const recognitionMode = "Dictation";
        const enLanguage = "en-US";
        this.value = '';
        this.SDK = SDK;
        this.recognizer = this._azureRecognizerSetup(this.SDK, recognitionMode, enLanguage, this.SDK.SpeechResultFormat.Simple, SUB_KEY);
        io.on('connect', (client) => {
            console.log('Someone connected');
            this.clientOnSpeaking(client)
            client.on('speaking', function(message) {
                console.log('MESSAGE', message);
            });
            client.on('disconnect', this.clientOnDisconnect);
        });
    }

    _azureRecognizerSetup(SDK, recognitionMode, language, format, subscriptionKey) {
        switch (recognitionMode) {
            case "Interactive" :
                recognitionMode = SDK.RecognitionMode.Interactive;    
                break;
            case "Conversation" :
                recognitionMode = SDK.RecognitionMode.Conversation;    
                break;
            case "Dictation" :
                recognitionMode = SDK.RecognitionMode.Dictation;    
                break;
            default:
                recognitionMode = SDK.RecognitionMode.Interactive;
        }
        var recognizerConfig = new SDK.RecognizerConfig(
            new SDK.SpeechConfig(
                new SDK.Context(
                    null, 
                    new SDK.Device("SpeechSample", "SpeechSample", "1.0.00000"))),
            recognitionMode,
            language, // Supported languages are specific to each recognition mode. Refer to docs.
            format); // SDK.SpeechResultFormat.Simple (Options - Simple/Detailed)
        
        return SDK.CreateRecognizer(recognizerConfig, new SDK.CognitiveSubscriptionKeyAuthentication(subscriptionKey));
    }

    speak(client) {
        var self = this;
        if(!this.native) {
            this.recognizer.Recognize(function(event) {
                /*
                    All available events
                */
                switch (event.Name) {
                    case "RecognitionTriggeredEvent" :
                        console.log("Initializing");
                        break;
                    case "ListeningStartedEvent" :
                        console.log("Listening");
                        break;
                    case "RecognitionStartedEvent" :
                        console.log("Listening_Recognizing");
                        break;
                    case "SpeechStartDetectedEvent" :
                        console.log("Listening_DetectedSpeech_Recognizing");
                        console.log(JSON.stringify(event.Result)); // check console for other information in result
                        break;
                    case "SpeechHypothesisEvent" :
                        console.log('Hypoteses ->', event.Result.Text);
                        console.log(JSON.stringify(event.Result)); // check console for other information in result
                        break;
                    case "SpeechFragmentEvent" :
                        console.log('Hypoteses ->', event.Result.Text);
                        console.log(JSON.stringify(event.Result)); // check console for other information in result
                        break;
                    case "SpeechEndDetectedEvent" :
                        console.log('Speech end detected');
                        console.log("Processing_Adding_Final_Touches");
                        console.log(JSON.stringify(event.Result)); // check console for other information in result
                        break;
                    case "SpeechSimplePhraseEvent" :
                        console.log('Recognized phrase SIMPLE ->', JSON.stringify(event.Result, null, 3));
                        // TODO emit messages by event
                        if(event.Result.RecognitionStatus == 'Success') {
                            // TODO send predicted text message back
                            self.value += ' ' + event.Result.DisplayText;
                            client.emit('speaking', self.value);
                        } else {
                            self.value = '';
                        }
                        break;
                    case "SpeechDetailedPhraseEvent" :
                        console.log('Recognized phrase DETAILED ->', JSON.stringify(event.Result, null, 3));
                        if(event.Result.RecognitionStatus == 'Success') {
                            // TODO send predicted text message back
                            self.value += ' ' + event.Result.DisplayText;
                            client.emit('speaking', self.value);
                        } else {
                            self.value = '';
                        }
                        break;
                    case "RecognitionEndedEvent" :
                        console.log('Completed');
                        console.log("Idle");
                        console.log(JSON.stringify(event)); // Debug information
                        client.disconnect();
                        break;
                }
            })
            .On(function() {
                // The request succeeded. Nothing to do here.
                // TODO send oncomplete message
                console.log('Success!');
            }, function (error) {
                console.log('ERROR');
                console.error(error);
            });
        }
    }

    stop() {
        this.value = '';
        // recognizer.AudioSource.Detach(audioNodeId) can be also used here. (audioNodeId is part of ListeningStartedEvent)
        this.recognizer.AudioSource.TurnOff();
        // TODO send stop message
    }

    clientOnSpeaking (message, client) {
        console.log('Message sent', message);
        this.speak(client);
    }
    clientOnDisconnect () {
        console.log('Someone disconnected');
    }
}

module.exports = SpeechService;