const express = require('express');
const Promise = require('bluebird');
const {
  getLastJackpotDate,
  setLastJackpotDate,
  getLastJackpotHours,
  setLastJackpotHours,
  processDailyJackpot,
  processHourlyJackpot,
} = require('./helpers/utils');

const app = express();
const port = process.env.PORT || 4000;
const server = app.listen(port, () => console.log(`Listening on ${port}`));

process.on('uncaughtException', function (err) {
  console.error('Uncaught exception', err);
});

/** Prevent server idle */
const heartbeat = setInterval(() => {
  console.log('Heartbeat');
}, 1000 * 60 * 5);

let isReady = false;
let isProcessing = false;
let lastDailyJackpot = null;
let lastHourlyJackpot = null;

/** Get or set last jackpots date and hours */
Promise.all([
  getLastJackpotDate(),
  getLastJackpotHours(),
]).then(jackpots => {
  if (jackpots[0] && jackpots[1]) {
    lastDailyJackpot = parseInt(jackpots[0]);
    lastHourlyJackpot = parseInt(jackpots[1]);
    isReady = true;
  } else {
    lastDailyJackpot = new Date().getUTCDate() - 1;
    lastHourlyJackpot = new Date().getUTCHours() - 1;
    Promise.all([
      setLastJackpotDate(lastDailyJackpot),
      setLastJackpotHours(lastHourlyJackpot),
    ]).then(() => {
      isReady = true;
    }).catch(err => {
      console.error('Set last jackpots failed', err);
    });
  }
}).catch(err => {
  console.error('Get last jackpots failed', err);
});

/** Check for date or hours change to process jackpot */
const check = setInterval(() => {
  if (isReady && !isProcessing) {
    const currentDate = new Date().getUTCDate();
    const currentHours = new Date().getUTCHours();
    console.log('Last daily jackpot was', lastDailyJackpot);
    console.log('Last hourly jackpot was', lastHourlyJackpot);
    if (currentDate !== lastDailyJackpot) {
      isProcessing = true;
      console.log('Start process daily jackpot', currentDate);
      processDailyJackpot().then(() => {
        lastDailyJackpot = currentDate;
        isProcessing = false;
        console.log('Process daily jackpot done', lastDailyJackpot);
      });
    }
    if (currentHours !== lastHourlyJackpot) {
      isProcessing = true;
      console.log('Start process hourly jackpot', currentHours);
      processHourlyJackpot().then(() => {
        lastHourlyJackpot = currentHours;
        isProcessing = false;
        console.log('Process hourly jackpot done', lastHourlyJackpot);
      });
    }
  }
}, 1000 * 60 * 10);
