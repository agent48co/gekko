// MACD Cross
// Created by Ash
// Version 1
//
// https://ru.tradingview.com/script/tDM3U5y7-Renko-MACD-Cross-Strategy/
//


const log = require('../core/log');
const config = require ('../core/util').getConfig();
const TradingView = require('./tools/tradingView');
const CandleBatcher = require('../core/candleBatcher');

let strat = {};

// seal everything into init to have the ability to use local variables unique for each strat instance
// , instead of using 'this.someVar', to optimize performance:
strat.init = function() {
  let currentCandle, currentPrice = 0.0, buyPrice = 0.0, advised = false, tradeInitiated = false, buyTs;

  // debug? set to false to disable all logging/messages/stats (improves performance in backtests)
  this.debug = false;

  // performance
  config.backtest.batchSize = 1000; // increase performance
  config.silent = true;
  config.debug = false;


  // What happens on every new candle?
  this.update = function(candle = {}) {
    consoleLog(`strat update:: advised: ${ advised }, tradeInitiated: ${ tradeInitiated }`);

    currentPrice = candle.close;
    currentCandle = candle;
    // if strat has DEPENDENCIES, notify them:
    // this.notify({
    //   type: 'dependency-...',
    //   reason: 'TREND CHANGE',
    //   data: this.curIndicator
    // });
  }

  this.check = function() {
    // time after last BUY:
    // if ((this.candle.start.diff(buyTs, 'minutes') > this.settings.TIMEOUT)) {
    //
    // }
    // if(!advised) {
    //   // can BUY
    //   this.buy(' ... reason ');
    // } else {
    //   // can SELL
    //   this.sell(' ... reason ');
    // }
  }

  this.sell = function(reason) {
    this.notify({
      type: 'sell advice',
      reason: reason,
    });
    this.advice('short');
    advised = false;
    buyPrice = 0;
    if (tradeInitiated) { // Add logic to use other indicators
      tradeInitiated = false;
    }
  }

  this.buy = function(reason) {
    advised = true;
    // If there are no active trades, send signal
    if (!tradeInitiated) { // Add logic to use other indicators
      this.notify({
        type: 'buy advice',
        reason: reason,
      });
      this.advice('long');
      buyTs = this.candle.start;
      buyPrice = currentPrice;
      tradeInitiated = true;
    }
  }
  this.onPendingTrade = function(pendingTrade) {
    tradeInitiated = true;
  }

  //
  // see https://www.youtube.com/watch?v=lc21W9_zdME
  this.onTrade = function(trade = {}) {
    tradeInitiated = false;
  }
  // Trades tht didn't complete with a buy/sell (see processTradeErrored in tradingAdvisor)
  this.onTerminatedTrades = function(terminatedTrades = {}) {
    tradeInitiated = false;
    consoleLog('onTerminatedTrades:: Trade failed. Reason: ' + terminatedTrades.reason);
  }

  this.onPortfolioChange = function(portfolio) {
    consoleLog(`onPortfolioChange, portfolio: ${ JSON.stringify(portfolio) }`);
  }
  this.onPortfolioValueChange = function(portfolio) {
    consoleLog(`onPortfolioValueChange, portfolio: ${ JSON.stringify(portfolio) }`);
  }

  this.end = function(a, b, c) {
    consoleLog('gekko end')
  }
  function consoleLog(msg = ''){
    if(config){
      currentCandle = currentCandle || {}
      const prefix = `${ config.gekkoId }, ${ JSON.stringify(currentCandle.start) || JSON.stringify(moment()) } -- `;
      console.log(prefix, msg);
      log.debug(prefix, msg);
    }
  }
}

strat.check = function(){
  // gekko stub (DO NOT REMOVE!!)
}

module.exports = strat;
