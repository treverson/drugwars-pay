const express = require('express');
const Promise = require('bluebird');
const client = require('./helpers/client');
const redis = require('./helpers/redis');

const app = express();
const port = process.env.PORT || 4000;
const server = app.listen(port, () => console.log(`Listening on ${port}`));

let inProcess = false;
let isInit = false;
let lastJackpotDate = false;
let lastHours = new Date().getUTCHours();

redis.flushall();

const getLastJackpotDate = () => redis.getAsync('last_jackpot_date');

const setLastJackpotDate = (date) => redis.setAsync('last_jackpot_date', date);

/** Process daily jackpot payments */
const processJackpot = () => Promise.delay(5000);

/** Get last jackpot date */
const init = () => new Promise((resolve, reject) => {
  getLastJackpotDate().then(date => {
    if (date) {
      // console.log('Last jackpot date is', date);
      resolve(parseInt(date));
    } else {
      const lastDate = new Date().getUTCDate() - 1;
      setLastJackpotDate(lastDate).then(result => {
        // console.log('Set last jackpot date to', lastDate, result);
        resolve(lastDate);
      }).catch(err => {
        console.error('Set last jackpot date failed', err);
        reject();
      });
    }
  }).catch(err => {
    console.error('Get last jackpot date failed', err);
    reject();
  });
});

console.log('Start jackpot process');

init().then(date => {
  lastJackpotDate = date;
  isInit = true;
  console.log('Init done with last jackpot date', lastJackpotDate);
}).catch(err => {
  console.error('Init failed', err);
});

const stream = setInterval(() => {
  const currentDate = new Date().getUTCDate();
  const currentHours = new Date().getUTCHours();
  if (isInit && lastHours !== currentHours) {
    lastHours = currentHours;
    console.log('Current date is', currentDate, 'last jackpot date is', lastJackpotDate, 'current hours', currentHours);
  }
  if (isInit && lastJackpotDate !== currentDate && !inProcess) {
    inProcess = true;
    console.log('Processing jackpot', lastJackpotDate, currentDate);
    processJackpot().then(() => {
      console.log('Jackpot payments sent');
      setLastJackpotDate(currentDate).then(result => {
        console.log('Set last jackpot date to', currentDate, result);
        lastJackpotDate = currentDate;
        inProcess = false;
      }).catch(err => {
        console.error('Set last jackpot date failed', err);
      });
    }).catch(err => {
      console.error('Process jackpot failed', err);
    });
  }
}, 10000);
