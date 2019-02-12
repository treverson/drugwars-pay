const Promise = require('bluebird');
const { PrivateKey } = require('dsteem');
const redis = require('./redis');
const db = require('./db');
const client = require('./client');

const username = process.env.STEEM_USERNAME;
const privateKey = process.env.STEEM_WIF;
const pay = parseInt(process.env.PAYMENT) || 0;
const payPercentProd = parseFloat(process.env.PAYMENT_PERCENT_PROD) || 1;
const payPercentBurn = parseFloat(process.env.PAYMENT_PERCENT_BURN) || 1;
const memoProd = 'Here is your cut based on your drug production';
const memoBurn = 'Heist! We got that for you';

// redis.flushall();

const getLastPayment = () => redis.getAsync('last_payment');

const setLastPayment = (date) => redis.setAsync('last_payment', date);

const processPayments = () => {
  return new Promise((resolve, reject) => {
    const query = 'SELECT * FROM users ORDER BY drug_production_rate DESC; \n\
      SELECT SUM(drug_production_rate) AS totalProd FROM users; \n\
      SELECT * FROM heist ORDER BY drugs DESC; \n\
      SELECT SUM(drugs) AS totalBurn FROM heist';

    Promise.all([
      db.queryAsync(query),
      client.database.getAccounts([username]),
    ]).then(result => {
      const daily = [];
      const heist = [];
      let body = '';

      /** Create transfer ops based on prod rate */
      body += '\n\n#### Here is the drug production rate payroll:\n\n';
      const totalPotProd = parseFloat(result[1][0].balance) / 100 * payPercentProd;
      const totalProd = result[0][1][0].totalProd;
      let i = 0;
      result[0][0].forEach(user => {
        const amount = parseFloat(totalPotProd / totalProd * user.drug_production_rate).toFixed(3);
        if (amount >= 0.001) {
          i++;
          body += `${i}. @${user.username} +${amount} STEEM \n`;
          daily.push(['transfer', {
            from: username,
            to: user.username,
            amount: `${amount} STEEM`,
            memo: memoProd,
          }]);
        }
      });

      /** Create transfer ops based on heist */
      body += '\n\n#### Here is the heist payroll:\n\n';
      const totalBurnProd = parseFloat(result[1][0].balance) / 100 * payPercentBurn;
      const totalBurn = result[0][3][0].totalBurn;
      i = 0;
      result[0][2].forEach(user => {
        const amount = parseFloat(totalBurnProd / totalBurn * user.drugs).toFixed(3);
        if (amount >= 0.001 && user.username) {
          i++;
          body += `${i}. @${user.username} +${amount} STEEM \n`;
          heist.push(['transfer', {
            from: username,
            to: user.username,
            amount: `${amount} STEEM`,
            memo: memoBurn,
          }]);
        }
      });

      /** Create post op */
      const post = [['comment', {
        parent_author: '',
        parent_permlink: 'drugwars',
        author: username,
        permlink: `drugwars-pay-${new Date().getTime()}`,
        title: 'DrugWars daily payroll',
        body,
        json_metadata: JSON.stringify({}),
      }]];

      if (pay) {
        /** Broadcast transfers */
        client.broadcast.sendOperations(daily, PrivateKey.fromString(privateKey)).then(result => {
          console.log('Broadcast daily transfers done', result);

          /** Broadcast transfers */
          client.broadcast.sendOperations(heist, PrivateKey.fromString(privateKey)).then(result => {
            console.log('Broadcast heist transfers done', result);

            /** Broadcast post */
            client.broadcast.sendOperations(post, PrivateKey.fromString(privateKey)).then(result => {
              console.log('Broadcast post done', result);

              /** Clear table heist */
              db.queryAsync('TRUNCATE TABLE heist').then(result => {
                console.log('Clear table done');
                resolve();

              }).catch((e) => {
                console.error('Clear table heist failed', e);
                reject();
              })

            }).catch(err => {
              console.error('Broadcast post failed', err);
              reject();
            });

          }).catch(err => {
            console.error('Broadcast post failed', err);
            reject();
          });

        }).catch(err => {
          console.error('Broadcast transfers failed', err);
          reject();
        });

      } else {
        console.log('Payment disabled');
        resolve();
      }

    }).catch(err => {
      console.error('Process loading data failed', err);
      reject();
    });
  });
};

module.exports = {
  getLastPayment,
  setLastPayment,
  processPayments,
};
