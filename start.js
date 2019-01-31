const express = require('express');
const Promise = require('bluebird');
const {
  getLastDailyJackpot,
  setLastDailyJackpot,
  getLastHourlyJackpot,
  setLastHourlyJackpot,
  processDailyJackpot,
  processHourlyJackpot,
} = require('./helpers/utils');

const app = express();
const port = process.env.PORT || 4000;
const server = app.listen(port, () => console.log(`Listening on ${port}`));

process.on('uncaughtException', function (err) {
  console.error('Uncaught exception', err);
});

let isReady = false;
let isProcessing = false;
let lastDailyJackpot = null;
let lastHourlyJackpot = null;

/** Get or set last jackpots date and hours */
Promise.all([
  getLastDailyJackpot(),
  getLastHourlyJackpot(),
]).then(jackpots => {
  if (jackpots[0] && jackpots[1]) {
    lastDailyJackpot = parseInt(jackpots[0]);
    lastHourlyJackpot = parseInt(jackpots[1]);
    isReady = true;
    console.log('Ready');
  } else {
    lastDailyJackpot = new Date().getUTCDate();
    lastHourlyJackpot = new Date().getUTCHours();
    Promise.all([
      setLastDailyJackpot(lastDailyJackpot),
      setLastHourlyJackpot(lastHourlyJackpot),
    ]).then(() => {
      isReady = true;
      console.log('Ready');
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
    console.log('...');
    const currentDate = new Date().getUTCDate();
    const currentHours = new Date().getUTCHours();
    // console.log('daily-pot: Last daily jackpot was on', lastDailyJackpot);
    // console.log('hourly-pot: Last hourly jackpot was on', lastHourlyJackpot);
    if (currentDate !== lastDailyJackpot) {
      isProcessing = true;
      console.log('daily-pot: 1/3 Start payment process', currentDate);
      processDailyJackpot().then(() => {
        lastDailyJackpot = currentDate;
        console.log('daily-pot: 2/3 Payments done', lastDailyJackpot);
        setLastDailyJackpot(lastDailyJackpot).then(() => {
          isReady = true;
          isProcessing = false;
          console.log('daily-pot: 3/3 Last daily jackpot set on db', lastDailyJackpot);
        }).catch(err => {
          console.error('daily-pot: Set last daily jackpot failed, action required', err);
        });
      });
    } else if (currentHours !== lastHourlyJackpot) {
      isProcessing = true;
      console.log('hourly-pot: 1/3 Start payment process', currentHours);
      processHourlyJackpot().then(() => {
        lastHourlyJackpot = currentHours;
        console.log('hourly-pot: 2/3 Payments done', lastHourlyJackpot);
        setLastHourlyJackpot(lastHourlyJackpot).then(() => {
          isReady = true;
          isProcessing = false;
          console.log('hourly-pot: 3/3 Last hourly jackpot set on db', lastHourlyJackpot);
        }).catch(err => {
          console.error('hourly-pot: Set last hourly jackpot failed, action required', err);
        });
      });
    }
  }
}, 1000 * 30);
