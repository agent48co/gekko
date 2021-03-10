// MACD Cross
// Created by Ash
// Version 1
//
//


const log = require('../core/log');
const config = require ('../core/util').getConfig();
const moment = require('moment');

let strat = {};

// seal everything into init to have the ability to use local variables unique for each strat instance
// , instead of using 'this.someVar', to optimize performance:
strat.init = function(options = {}) {
  let startPrice, currentCandle, prevCandle, currentPrice = 0.0, buyPrice = 0.0, advised = false, advisedShort = false, tradeInitiated = false, buyTs, tradesCount = 0, tradesMaxCount = 0;
  let tradesArr = [];
  let UNDERVALUE = this.settings.UNDERVALUE || 0.94, THRESHOLD = this.settings.THRESHOLD, TAKE_PROFIT = this.settings.TAKE_PROFIT || 1.05,
    TIMEOUT_MINUTES = this.settings.TIMEOUT_MINUTES || 1440, TRAILING_STOP = this.settings.trailingStop || 5;
  const SINGLE_BET = 100; // 1%
  let curRenko, prevRenko = { isChanged: false };
  // const UNDERVALUE = 0.99, TAKE_PROFIT = 1.01, MIN_TIMEOUT_MINUTES = 1, SINGLE_BET = 10; // 1% // 15min

  // since we're relying on transforming 1 minute candles into renko candles
  // lets throw if the settings are wrong
  /*if (config.tradingAdvisor.candleSize !== 1) {
    throw {
      error: "This strategy must run with candleSize=1"
    };
  }*/

  // debug? set to false to disable all logging/messages/stats (improves performance in backtests)
  this.debug = true;

  // performance
  config.backtest.batchSize = 1000; // increase performance
  config.silent = false;
  config.debug = true;

  this.addIndicator('renko', '$lon-renko', {
    brickSize: this.settings.brickSize || 100,
    candleSize: this.settings.candleSize || 1
  });
  let hadDeal = false;

  // What happens on every new candle?
  this.update = function(candle = {}) {
    currentCandle = candle;
    curRenko = this.indicators.renko;
    if(this.debug) {
      if(curRenko.isChanged) {
        consoleLog(`strat update:: renko: ${ JSON.stringify(this.indicators.renko) }, candle.start: ${ JSON.stringify(candle.start) }`);
      }
      // consoleLog(`strat update:: renko: ${ JSON.stringify(this.indicators.renko) }, candle.start: ${ JSON.stringify(candle.start) }`);
      // consoleLog(`strat update:: renko: ${ JSON.stringify(this.indicators.renko) }, advised: ${ advised }, tradeInitiated: ${ tradeInitiated }`);
    }

  }

  this.check = function() {
    let time = JSON.stringify(this.candle.start);
/*    if(curRenko.isChanged && curRenko.direction === 'up' && !advised) {
      consoleLog(`currenko change up!!: ${ JSON.stringify(curRenko)}
      ${ JSON.stringify( prevRenko ) } `)
    }*/
    // if(prevRenko.isChanged && prevRenko.direction === 'up' && curRenko.direction === 'up' && !advised) { // 2 bricks up
    if(curRenko.isChanged && curRenko.direction === 'up' && !advised) {
      this.buy('renko direction change to UP', { limitPrice: curRenko.renkoClose })
    }
    /*if(curRenko.isChanged && curRenko.direction === 'dn' && advised) {
      consoleLog(`currenko change dn!!: ${ JSON.stringify(curRenko)}`)
    }*/
    // if(prevRenko.isChanged && prevRenko.direction === 'dn' && curRenko.direction === 'dn' && advised) {
    if(curRenko.isChanged && curRenko.direction === 'dn' && advised) {
      this.sell('renko direction change to DN', { limitPrice: curRenko.renkoClose })
    }
    // shorts:
    if(this.settings.margin && this.settings.margin.useShort) {
      if (curRenko.isChanged && curRenko.direction === 'dn' && !advisedShort) {
        this.buy('renko direction change to UP', { limitPrice: curRenko.renkoClose, margin: { type: 'short', limit: 1 } })
      }
      if (advisedShort) {
        /*if (curRenko.isChanged && curRenko.direction === 'up') {
          consoleLog(`currenko change dn!!: ${JSON.stringify(curRenko)}`)
        }*/
        // if(prevRenko.isChanged && prevRenko.direction === 'dn' && curRenko.direction === 'dn' && advised) {
        if (curRenko.isChanged && curRenko.direction === 'up') {
          this.sell('renko direction change to DN', { limitPrice: curRenko.renkoClose, margin: { type: 'short', limit: 1 } })
        }
      }
    }
    prevRenko = Object.assign({}, curRenko);
  }

  this.buy = function(reason, options = {}) {
    this.notify({
      type: 'buy advice',
      reason: reason,
    });
    consoleLog(`buy:: advice: long, margin: ${ !!options.margin }`);
    this.advice({
      limit: options.limitPrice,
      direction: 'long',
      margin: options.margin,
      trigger: {
        type: 'trailingStop',
        trailPercentage: TRAILING_STOP
      }
    });

    buyTs = this.candle.start;
    buyPrice = currentPrice;
    if(options.margin && options.margin.type === 'short') {
      advisedShort = true;
    } else {
      advised = true;
    }
    if(!hadDeal) {
      hadDeal = true; // only set once: strange startAt.unix() bug
    }
  }
  this.sell = function(reason, options = {}) {
    this.notify({
      type: 'sell advice',
      reason: reason,
    });
    consoleLog(`sell:: advice: short, margin: ${ !!options.margin }`);
    this.advice({
      direction: 'short',
      limit: options.limitPrice,
      margin: options.margin
    });
    if(options.margin && options.margin.type === 'short') {
      advisedShort = false;
    } else {
      advised = false;
    }
  }

  this.onPendingTrade = function(pendingTrade) {
    tradeInitiated = true;
  }

  //
  // see https://www.youtube.com/watch?v=lc21W9_zdME
  this.onTrade = function(trade = {}) {
    consoleLog('onTrade:: trade: ' + JSON.stringify(trade.action));
    if(trade.action === 'sell') {
      advised = false;
    }
    tradeInitiated = false;
  }
  // Trades tht didn't complete with a buy/sell (see processTradeErrored in tradingAdvisor)
  this.onTerminatedTrades = function(terminatedTrades = {}) {
    tradeInitiated = false;
    consoleLog('onTerminatedTrades:: Trade failed. Reason: ' + terminatedTrades.reason);
  }

  this.onPortfolioChange = function(portfolio) {
    // consoleLog(`onPortfolioChange, portfolio: ${ JSON.stringify(portfolio) }`);
  }
  this.onPortfolioValueChange = function(portfolio) {
    //consoleLog(`onPortfolioValueChange, portfolio: ${ JSON.stringify(portfolio) }`);
  }
  this.onTriggerFired = function(data) {
    // tradeInitiated = false;
    this.notify({
      type: 'sell advice',
      reason: 'trailing stop trigger fired',
    });
    consoleLog(`onTriggerFired, data: ${ JSON.stringify(data) }`);
  }

  this.end = function(a, b, c) {
    // consoleLog(`gekko end, trades: ${ JSON.stringify(tradesArr) }`);
    // consoleLog(`           total trades: ${ tradesArr.length }`);
    // const profitTrades = tradesArr.filter(t=>t.status === 'sold');
    // consoleLog(`           closed trades: ${ profitTrades.length }`);
    // const openTrades = tradesArr.filter(t=>t.status !== 'sold');
    // consoleLog(`           open trades: ${ openTrades.length }`);
    // consoleLog(`           startPrice: ${ startPrice }, current price: ${ currentPrice }`);
    // let profit = profitTrades.length * ((TAKE_PROFIT - 1) - 0.002) * SINGLE_BET;
    // let loss = 0;
    // openTrades.forEach(trade => {
    //   let res = (currentPrice - trade.price) / (trade.price) * SINGLE_BET;
    //   loss -= res;
    // })
    //
    // consoleLog(`  profit: ${ profit }$, loss: ${ loss }$, result: ${ profit - loss }$, capital: ${ SINGLE_BET * tradesArr.length }, tradesMaxCount: ${ tradesMaxCount }`);

  }
  function consoleLog(msg = ''){
    if(config){
      currentCandle = currentCandle || {}
      const prefix = `${ config.gekkoId }, ${ JSON.stringify(currentCandle.start) || JSON.stringify(moment()) } -- `;
      console.log(prefix, msg);
      //log.debug(prefix, msg);
    }
  }
}

strat.check = function(){
  // gekko stub (DO NOT REMOVE!!)
}

module.exports = strat;
