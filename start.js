const express = require('express');
const Promise = require('bluebird');
const {
  getLastPayment,
  setLastPayment,
  processPayments,
  processQueue,
} = require('./helpers/utils');

const app = express();
const port = process.env.PORT || 4000;
const server = app.listen(port, () => console.log(`Listening on ${port}`));

process.on('uncaughtException', function (err) {
  console.error('Uncaught exception', err);
});

let isReady = false;
let isProcessing = false;
let lastPayment = null;

/** Get or set last payments date and hours */
const start = () => {
  getLastPayment().then(payments => {
    if (payments) {
      lastPayment = parseInt(payments);
      isReady = true;
      console.log('Ready');
    } else {
      lastPayment = new Date().getUTCDate();
      setLastPayment(lastPayment).then(() => {
        isReady = true;
        console.log('Ready');
      }).catch(err => {
        console.error('Set last payment failed', err);
      });
    }
  }).catch(err => {
    console.error('Get last payment failed', err);
  });
};

/** Check for date change to process payment */
const check = setInterval(() => {
  if (isReady && !isProcessing) {
    const currentDate = new Date().getUTCDate();
    console.log('...', currentDate);

    if (currentDate !== lastPayment) {
      isProcessing = true;
      console.log('1/3 Start payment process', currentDate);

      processPayments().then(() => {
        lastPayment = currentDate;
        console.log('2/3 Payments done', lastPayment);
        setLastPayment(lastPayment).then(() => {
          isReady = true;
          isProcessing = false;
          console.log('3/3 Last prod payment set on db', lastPayment);
        }).catch(err => {
          console.error('Set last prod payment failed, action required', err);
        });
      });
    }
  }
}, 1000 * 5);

start();

/** Process pending payments queue then wait 5 sec */
const processQueueLoop = () => {
  processQueue().then(
    () => Promise.delay(10000).then(
      () => processQueueLoop()
    ));
};

processQueueLoop();
