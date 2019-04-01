// ==========================
//
// system
//

const fs = require('fs')
const moment = require('moment')
moment.locale('zh-tw');
const env = process.env
const reg = new RegExp(env.KEYWORDS, 'g')

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
// const ip = env.ip === 'auto' ? require('ip').address() : env.ip
const publicIp = env.publicIp ? env.publicIp : null
const http = require('http')
const express = require('express')
const app = express()
const server = http.createServer(app)
const io = require('socket.io')(server)
const PORT = env.PORT || 3000
server.listen(PORT)

const startTime = moment().format('LLL')
app.use(express.static('./public'))
app.set('view engine', 'pug')

// index page
app.get('/', (request, res) => {
  res.render('index', {
    startTime, publicIp, YOUTUBE_VIDEO_ID
  })
})

io.on('connection', (socket) => {
  views += 1
  let date = moment().format('LLL')
  socket.emit('update', { text: '即時字幕載入中...', count, date })
})

// console.log(`< http://${publicIp || ip}:${PORT} >`)

console.log(`< http://localhost:${PORT} >`)

// ==========================
//
// main
//
const { YOUTUBE_VIDEO_ID, API_KEY } = env
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

function action() {
  let now = Date.now()
  let fileName = `./${audioFile}/${now}.wav`
  let stream = ytdl(`https://www.youtube.com/watch?v=${YOUTUBE_VIDEO_ID}`, ytdlOption)
  new ffmpeg(stream).duration(10).audioChannels(1).audioFrequency(16000).format('wav').save(fileName).on('end', () => {
    stream.end()
    let buffer = fs.readFileSync(fileName)
    let base = buffer.toString('base64')
    if (oldBase === base) return
    oldBase = base
    request({
      uri: 'https://speech.googleapis.com/v1/speech:recognize?key=' + API_KEY,
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
        let date = moment().format('LLL')
        let output = { text, count, views, reads, date }
        console.log(date, '計數 :', count, text)
        reads += 1
        io.emit('update', output)
        fs.writeFileSync(recoreFile, JSON.stringify({ output }))
        if (now - oldNow > 1800000) {
          oldNow = now
          fs.writeFileSync(`./${backupFile}/${now}.json`, JSON.stringify({ output }))
        }
      } catch (e) {
        // console.error(e)
      }
      fs.unlinkSync(fileName)

      setTimeout(action, 10000)
    })
  })
}

action()

// setInterval(action, 10000)
