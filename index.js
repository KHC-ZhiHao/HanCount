// ==========================
//
// system
//
var SpeechApiSample = require("./SpeechApiSample.js")
const fs = require('fs')
const env = require('./env')
const reg = new RegExp(env.keywords, 'g')


let audioFile = 'audios'
let recoreFile = 'minute.json'
let backupFile = 'files'

if (fs.existsSync(recoreFile) === false) {
    fs.writeFileSync(recoreFile, JSON.stringify({ text: '', count: 0 }))
}

if (fs.existsSync(audioFile) === false) {
    fs.mkdirSync(audioFile)
}

if (fs.existsSync(backupFile) === false) {
    fs.mkdirSync(backupFile)
}

let recore = require('./' + recoreFile)
let count = recore.count || 0
let views = recore.views || 0
let reads = recore.reads || 0

// ==========================
//
// server
//

const ip = env.ip === 'auto' ? require('ip').address() : env.ip
const publicIp = env.publicIp ? env.publicIp : null
const http = require('http')
const express = require('express')
const app = express()
const server = http.createServer(app)
const io = require('socket.io')(server)

server.listen(80, ip)

app.use(express.static('./public'));
app.get('/', (request, response) => {
    let html = fs.readFileSync('./index.html', 'utf8')
    html = html.replace('--ip--', publicIp || ip).replace('--begin--', env.startTime)
    response.write(html)
    response.end()
})

io.on('connection', (socket) => {
    views += 1
    socket.emit('update', { text: '即時字幕載入中...', count })
})

console.log(`< http://${publicIp || ip} >`)

// ==========================
//
// main
//

const url = env.youtubeUrl
const apiKey = env.apiKey
const ytdl = require('ytdl-core')
const request = require('request')
const ffmpeg = require('fluent-ffmpeg')
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg')
const ytdlOption = {
    liveBuffer: 10000
}

ffmpeg.setFfmpegPath(ffmpegInstaller.path)

let oldNow = Date.now()
let oldBase = null
let files = fs.readdirSync(audioFile)

for (let file of files) {
    fs.unlinkSync('./' + audioFile + '/' + file)
}

var speechApi = new SpeechApiSample();
speechApi.setLocalization(env.api_base_url);
speechApi.setAuthorization(env.appKey, env.appSecret);

function action() {
    let now = Date.now()
    let fileName = `./${audioFile}/${now}.wav`
    let stream = ytdl(url, ytdlOption)
    new ffmpeg(stream).duration(10).audioChannels(1).audioFrequency(16000).format('wav').save(fileName).on('end', () => {
        stream.end()
        /*
        let buffer = fs.readFileSync(fileName)
        let base = buffer.toString('base64')
        if (oldBase === base) return
        oldBase = base
        */
        // Start sending audio file for recognition

        speechApi.sendAudioFile('asr', 'nli', true, fileName, false, function (text) {
            try {
                let match = text.match(reg)
                if (match) {
                    count += match.length
                }
                let output = { text, count, views, reads }
                console.log('語音 : ', text)
                console.log('計數 : ', count)
                reads += 1
                io.emit('update', output)
                fs.writeFileSync(recoreFile, JSON.stringify({ output }))
                if (now - oldNow > 1800000) {
                    oldNow = now
                    fs.writeFileSync(`./${backupFile}/${now}.json`, JSON.stringify({ output }))
                }
            } catch (e) { }
            try {
                fs.unlinkSync(fileName)
            }
            catch (e) { }
        });

        /*

        request({
            uri: 'https://speech.googleapis.com/v1/speech:recognize?key=' + apiKey,
            method: 'POST',
            json: {
                audio: {
                    content: base
                },
                config: {
                    encoding: 'LINEAR16',
                    sampleRateHertz: 16000,
                    languageCode: 'zh-TW'
                }
            }
        }, (error, response, body) => {
            try {
                let text = body.results[0].alternatives[0].transcript
                let match = text.match(reg)
                if (match) {
                    count += match.length
                }
                let output = { text, count, views, reads }
                console.log('語音 : ', text)
                console.log('計數 : ', count)
                reads += 1
                io.emit('update', output)
                fs.writeFileSync(recoreFile, JSON.stringify({ output }))
                if (now - oldNow > 1800000) {
                    oldNow = now
                    fs.writeFileSync(`./${backupFile}/${now}.json`, JSON.stringify({ output }))
                }
            } catch (e) { }
            fs.unlinkSync(fileName)
            
        })*/
    })
}

setInterval(action, 10000)
