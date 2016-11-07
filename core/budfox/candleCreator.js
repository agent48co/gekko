// The CandleCreator creates one minute candles based on trade batches. Note
// that it also adds empty candles to fill gaps with no volume.
//
// Expects trade batches to be written like:
//
// {
//   amount: x,
//   start: (moment),
//   end: (moment),
//   first: (trade),
//   last: (trade),
//   timespan: x,
//   all: [
//      // batch of new trades with
//      // moments instead of timestamps
//   ]
// }
//
// Emits 'new candles' event with:
//
// [
//     {
//       start: (moment),
//       end: (moment),
//       high: (float),
//       open: (float),
//       low: (float),
//       close: (float)
//       volume: (float)
//       vwp: (float) // volume weighted price
//       trades: (integer) // no. of all trades
//       volume_buy: (float) // volume of buy trades
//       trades_buy: (integer) // no. of buy trades
//       lag: (integer) // avg lag to exchange
//    },
//    {
//       start: (moment), // + 1
//       end: (moment),
//       high: (float),
//       open: (float),
//      low: (float),
//      close: (float)
//       volume: (float)
//       vwp: (float) // volume weighted price
//       trades: (integer) // no. of all trades
//       volume_buy: (float) // volume of buy trades
//       trades_buy: (integer) // no. of buy trades
//       lag: (integer) // avg lag to exchange
//    }
//    // etc.
// ]
//

var _ = require('lodash');
var moment = require('moment');

var util = require(__dirname + '/../util');

var CandleCreator = function() {
  _.bindAll(this);

  // TODO: remove fixed date
  this.threshold = moment("1970-01-01", "YYYY-MM-DD");

  // This also holds the leftover between fetches
  this.buckets = {};

  // last price to properly calculate buy / sell trades
  // the first calculation is wrong
  // TODO: fetch last known price from db
  this.lastPrice = 0.0;
  this.lastAction = ''; // sell

  // tomih: add lag for exchanges
  this.lag = 0;
}

util.makeEventEmitter(CandleCreator);

CandleCreator.prototype.write = function(batch) {
  var trades = batch.data;

  if(_.isEmpty(trades))
    return;

  // tomih: add lag
  // this adds lag from last fetch per candle
  // maybe avg it accross fetches?
  this.lag = batch.lag;

  trades = this.filter(trades);
  this.fillBuckets(trades);
  var candles = this.calculateCandles();

  candles = this.addEmptyCandles(candles);

  // the last candle is not complete
  this.threshold = candles.pop().start;

  this.emit('candles', candles);
}

CandleCreator.prototype.filter = function(trades) {
  // make sure we only include trades more recent
  // than the previous emitted candle
  return _.filter(trades, function(trade) {
    return trade.date > this.threshold;
  }, this);
}

// put each trade in a per minute bucket
CandleCreator.prototype.fillBuckets = function(trades) {
  _.each(trades, function(trade) {
    var minute = trade.date.format('YYYY-MM-DD HH:mm');

    if(!(minute in this.buckets))
      this.buckets[minute] = [];

    this.buckets[minute].push(trade);
  }, this);

  this.lastTrade = _.last(trades);
}

// convert each bucket into a candle
CandleCreator.prototype.calculateCandles = function() {
  var minutes = _.size(this.buckets);

  // catch error from high volume getTrades
  if (this.lastTrade !== undefined)
    // create a string referencing to minute this trade happened in
    var lastMinute = this.lastTrade.date.format('YYYY-MM-DD HH:mm');

  var candles = _.map(this.buckets, function(bucket, name) {
    var candle = this.calculateCandle(bucket);

    // clean all buckets, except the last one:
    // this candle is not complete
    if(name !== lastMinute)
      delete this.buckets[name];

    return candle;
  }, this);

  return candles;
}

CandleCreator.prototype.calculateCandle = function(trades) {
  var first = _.first(trades);

  var f = parseFloat;

  var candle = {
    start: first.date.clone().startOf('minute'),
    open: f(first.price),
    high: f(first.price),
    low: f(first.price),
    close: f(_.last(trades).price),
    vwp: 0,
    volume: 0,
    trades: _.size(trades),
    volume_buy: 0,
    trades_buy: 0,
    lag: this.lag,
    raw: ''
  };

  _.each(trades, function(trade) {
    candle.high = _.max([candle.high, f(trade.price)]);
    candle.low = _.min([candle.low, f(trade.price)]);
    candle.volume += f(trade.amount);
    candle.vwp += f(trade.price) * f(trade.amount);
    // if this price is higher then the old one or the price is the same
    // and the last action was BUY, we consider it as BUY trade
    var isBuy = (this.lastPrice<trade.price || (this.lastPrice==trade.price && this.lastAction=='buy'));
    if (isBuy)   {
      candle.volume_buy += f(trade.amount);
      candle.trades_buy += 1;
      this.lastAction = 'buy';
    } else
      this.lastAction = '';

    this.lastPrice = trade.price;
  });

  candle.vwp /= candle.volume;
  // add all trades from this batch
  candle.raw = trades;

  return candle;
}

// Gekko expects a candle every minute, if nothing happened
// during a particilar minute Gekko will add empty candles with:
//
// - open, high, close, low, vwp are the same as the close of the previous candle.
// - trades, volume are 0
CandleCreator.prototype.addEmptyCandles = function(candles) {
  var amount = _.size(candles);
  if(!amount)
    return candles;

  // iterator
  var start = _.first(candles).start.clone();
  var end = _.last(candles).start;
  var i, j = -1;

  var minutes = _.map(candles, function(candle) {
    return +candle.start;
  });

  while(start < end) {
    start.add('minute', 1);
    i = +start;
    j++;

    if(_.contains(minutes, i))
      continue; // we have a candle for this minute

    var lastPrice = candles[j].close;

    candles.splice(j + 1, 0, {
      start: start.clone(),
      open: lastPrice,
      high: lastPrice,
      low: lastPrice,
      close: lastPrice,
      vwp: lastPrice,
      volume: 0,
      trades: 0,
      volume_buy: 0,
      trades_buy: 0,
      lag: this.lag,
      raw: ''
    });
  }
  return candles;
}

module.exports = CandleCreator;
