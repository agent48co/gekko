// MACD Cross
// Created by Ash
// Version 1
//
//



const CandleBatcher = require('../core/candleBatcher');
const DependenciesManager = require('../plugins/dependencyManager/web');

let strat = {};

// seal everything into init to have the ability to use local variables unique for each strat instance
// , instead of using 'this.someVar', to optimize performance:
strat.init = function(options = {}) {
  this.debug = false;

  // performance
  this.config.backtest.batchSize = 1000; // increase performance
  this.config.silent = false;
  this.config.debug = true;

  // let aaatIndLow = new AAAT();
  this.addIndicator('aaatIndLow', 'Adaptive-ATR-ADX-Trend', { debug: false, useHeiken: this.settings.aaat.USE_HEIKEN });

  if (this.config.tradingAdvisor.candleSize !== 60) {
    /*throw {
      error: "This strategy must run with candleSize=60"
    };*/
  }

  this.update = function(candle = {}) {
    this.consoleLog(this.indicators.aaatIndLow.result);
    if(this.debug) {
      this.consoleLog(`strat update:: candle.start: ${ JSON.stringify(candle.start) }, advised: ${ this.advised }, tradeInitiated: ${ this.tradeInitiated }`);
    }

    // test deps:
    res = DependenciesManager.getClosestResult(candle.start, this.config.dependencyResults.results);
  };

  this.check = function(candle) {
    if (this.debug) {
      this.consoleLog(`strat check:: ${''
      } candle.close: ${candle.close
      }`);
    }
    if (!this.advised && this.buysAmount < 3) {
      this.buysAmount++;
      // this.buy('test long');
    } else {
      // this.sell('test short');
    }
  };

  this.onPendingTrade = function(pendingTrade) {
    this.consoleLog('onPendingTrade:: pendingTrade: ' + JSON.stringify(pendingTrade));
  }

  this.onTrade = function(trade = {}) {
    this.consoleLog('onTrade:: trade: ' + JSON.stringify(trade && trade.action));
  }
  this.onTerminatedTrades = function(terminatedTrades = {}) {
    this.consoleLog('onTerminatedTrades:: Trade failed. Reason: ' + terminatedTrades.reason);
  }
  this.onPortfolioChange = function(portfolio) {
    this.consoleLog(`onPortfolioChange:: Portfolio: ${ JSON.stringify(portfolio) }`);
  }
  this.onPortfolioValueChange = function(portfolio) {
    // this.consoleLog(`onPortfolioValueChange, portfolio: ${ JSON.stringify(portfolio) }`);
  }
  this.onTriggerFired = function(data) {
    this.consoleLog(`onTriggerFired, data: ${ JSON.stringify(data) }`);
  }
  this.onCommand = function(command) {
    this.consoleLog(`onCommand::command: ${ JSON.stringify(command) }`);
  }
  this.end = function() {
    this.consoleLog(`gekko end, trades: ${ JSON.stringify(this.tradesArr) }`);
    this.consoleLog(`           total trades: ${ this.tradesArr.length }`);
  }
}

strat.check = function(){
  // gekko stub (DO NOT REMOVE!!)
}

module.exports = strat;
