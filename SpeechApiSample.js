
var http = require('http');
var request = require('request');
var BufferHelper = require('bufferhelper');
var iconv = require('iconv-lite');
var url = require('url');
var md5 = require('md5');
var urlencode = require('urlencode');
var fs = require('fs');
var delayed = require('delayed');

var apiBaseUrl = '';
var appKey = '';
var appSecret = '';
var cookies;

function SpeechApiSample() {

}

/**
 * Setup your authorization information to access OLAMI services.
 *
 * @param appKey the AppKey you got from OLAMI developer console.
 * @param appSecret the AppSecret you from OLAMI developer console.
 */
SpeechApiSample.prototype.setAuthorization = function (appKey, appSecret) {
	this.appKey = appKey;
	this.appSecret = appSecret;
}

/**
 * Setup localization to select service area, this is related to different
 * server URLs or languages, etc.
 *
 * @param apiBaseURL URL of the API service.
 */
SpeechApiSample.prototype.setLocalization = function (apiBaseURL) {
	this.apiBaseUrl = apiBaseURL;
}

/**
 * Send an audio file to speech recognition service.
 *
 * @param apiName the API name for 'api=xxx' HTTP parameter.
 * @param seqValue the value of 'seq' for 'seq=xxx' HTTP parameter.
 * @param finished TRUE to finish upload or FALSE to continue upload.
 * @param filePath the path of the audio file you want to upload.
 * @param compressed TRUE if the audio file is a Speex audio.
 */
var last_sentence = '';
SpeechApiSample.prototype.sendAudioFile = function (apiName, seqValue,
		finished, filePath, compressed, end_action) {

	var _this = this;

	// Read the input audio file
	fs.readFile(filePath, function(err, audioData) {
		if (err) {
			console.log(err);
			throw err;
		}

		var url = _this.getBaseQueryUrl(apiName, seqValue);
		url += '&compress=';
		url += compressed ? '1' : '0';
		url += '&stop=';
		url += finished ? '1' : '0';

		// Request speech recognition service by HTTP POST
		request.post({
			url: url,
			body: audioData,
			headers: {
				'Content-Type': 'application/octet-stream',
				'Connection': 'Keep-Alive',
				'Content-Length' : audioData.length
			}
		}, function(err, res, body) {
			if (err) {
				console.log(err);
				throw err;
			}
		}).on('response', function(response) {
			var body = "";
			response.on('data', function(data) {
					body += data;
			});
			response.on('end', function() {
				_this.cookies = response.headers['set-cookie'];
				/*
				console.log("\n----- Test Speech API, seq=seg -----\n");
				console.log("\nSend audio file... \n");
				console.log('Result: '+ body);
				console.log('Cookie: '+ _this.cookies);	
				*/
				delayed.delay(function () {
					_this.getRecognitionResult('asr', 'seg', end_action, 0);
				}, 500);
			});
		});
	});
}

/**
 * Get the speech recognition result for the audio you sent.
 *
 * @param apiName the API name for 'api=xxx' HTTP parameter.
 * @param seqValue the value of 'seq' for 'seq=xxx' HTTP parameter.
 */
SpeechApiSample.prototype.getRecognitionResult = function (apiName, seqValue, end_action, failCount) {
	
	if (failCount >= 18) {
		console.log("request failed. quit this sentense.");
		end_action('解析失敗！');
		return;
	}
	var _this = this;
	var url = this.getBaseQueryUrl(apiName, seqValue);
	url += '&stop=1';
	// Request speech recognition service by HTTP GET
	request.get({
		url: url,
		headers: {
			'Cookie': this.cookies
		}
		
	}, function(err, res, body) {
		if (err) {
			console.log(err);
		}
	}).on('response', function(response) {
		var bufferhelper = new BufferHelper();
		response.on('data', function(chunk) {
			bufferhelper.concat(chunk);
		});

		response.on('end', function() {
			var body = iconv.decode(bufferhelper.toBuffer(), 'UTF-8');
			var result = JSON.parse(body);
			var return_status = result['data']['asr']['final'];
			// Try to get recognition result if uploaded successfully.
			// We just check the state by a lazy way :P , you should do it by JSON.
			if (!return_status) {
				//console.log("\n----- Get Recognition Result -----\n");
				//console.log("TMP:\n\n" + body);
				// Well, check by lazy way...again :P , do it by JSON please.
				delayed.delay(function () {
					_this.getRecognitionResult(apiName, seqValue, end_action, failCount + 1);
				}, 500);
			} else {
				//console.log("\n----- Get Recognition Result -----\n");
				//console.log("Result:\n\n" + body);
				result_sentence = result.data.asr.result
				if (result_sentence == last_sentence) return;
				last_sentence = result_sentence
				end_action(result_sentence)
				
			}
		});
	});
}

/**
 * Generate and get a basic HTTP query string
 *
 * @param apiName the API name for 'api=xxx' HTTP parameter.
 * @param seqValue the value of 'seq' for 'seq=xxx' HTTP parameter.
 */
SpeechApiSample.prototype.getBaseQueryUrl = function (apiName, seqValue) {
	var dateTime = Date.now();
	timestamp  = dateTime;

	var sign = '';
	sign += this.appSecret;
	sign += 'api=';
	sign += apiName;
	sign += 'appkey=';
	sign += this.appKey;
	sign += 'timestamp=';
	sign += timestamp;
	sign += this.appSecret;
	// Generate MD5 digest.
	sign = md5(sign);

	// Assemble all the HTTP parameters you want to send
	var url = '';
	url += this.apiBaseUrl +'?_from=nodejs';
	url += '&appkey='+ this.appKey;
	url += '&api=';
	url += apiName;
	url += '&timestamp='+ timestamp;
	url += '&sign='+ sign;
	url += '&seq='+ seqValue;

	return url;
}

module.exports = SpeechApiSample;