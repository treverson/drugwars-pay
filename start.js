const express = require('express');
const Promise = require('bluebird');
const {
  getLastProdPayment,
  setLastProdPayment,
  getLastBurnPayment,
  setLastBurnPayment,
  processProdPayment,
  processBurnPayment,
} = require('./helpers/utils');

const app = express();
const port = process.env.PORT || 4000;
const server = app.listen(port, () => console.log(`Listening on ${port}`));

process.on('uncaughtException', function (err) {
  console.error('Uncaught exception', err);
});

let isReady = false;
let isProcessing = false;
let lastProdPayment = null;
let lastBurnPayment = null;

/** Get or set last payments date and hours */
const start = () => Promise.all([
  getLastProdPayment(),
  getLastBurnPayment(),
]).then(payments => {
  if (payments[0] && payments[1]) {
    lastProdPayment = parseInt(payments[0]);
    lastBurnPayment = parseInt(payments[1]);
    isReady = true;
    console.log('Ready');
  } else {
    lastProdPayment = new Date().getUTCDate();
    lastBurnPayment = new Date().getUTCDate();
    Promise.all([
      setLastProdPayment(lastProdPayment),
      setLastBurnPayment(lastBurnPayment),
    ]).then(() => {
      isReady = true;
      console.log('Ready');
    }).catch(err => {
      console.error('Set last payments failed', err);
    });
  }
}).catch(err => {
  console.error('Get last payments failed', err);
});

/** Check for date or hours change to process payment */
const check = setInterval(() => {
  if (isReady && !isProcessing) {
    const currentDate = new Date().getUTCDate();
    console.log('...', currentDate);
    // console.log('prod-pool: Last prod payment was on', lastProdPayment);
    // console.log('burn-pool: Last burn payment was on', lastBurnPayment);
    if (currentDate !== lastProdPayment) {
      isProcessing = true;
      console.log('prod-pool: 1/3 Start payment process', currentDate);
      processProdPayment().then(() => {
        lastProdPayment = currentDate;
        console.log('prod-pool: 2/3 Payments done', lastProdPayment);
        setLastProdPayment(lastProdPayment).then(() => {
          isReady = true;
          isProcessing = false;
          console.log('prod-pool: 3/3 Last prod payment set on db', lastProdPayment);
        }).catch(err => {
          console.error('prod-pool: Set last prod payment failed, action required', err);
        });
      });
    } else if (currentDate !== lastBurnPayment) {
      isProcessing = true;
      console.log('burn-pool: 1/3 Start payment process', currentDate);
      processBurnPayment().then(() => {
        lastBurnPayment = currentDate;
        console.log('burn-pool: 2/3 Payments done', lastBurnPayment);
        setLastBurnPayment(lastBurnPayment).then(() => {
          isReady = true;
          isProcessing = false;
          console.log('burn-pool: 3/3 Last burn payment set on db', lastBurnPayment);
        }).catch(err => {
          console.error('burn-pool: Set last burn payment failed, action required', err);
        });
      });
    }
  }
}, 1000 * 5);

start();
