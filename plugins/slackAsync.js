const moment = require('moment');
const tomlJs = require('toml-js');
const { WebClient } = require('@slack/web-api');
const _ = require('lodash');
const log = require('../core/log.js');
const util = require('../core/util.js');
const config = util.getConfig();
const slackConfig = config.slackAsync;
const WATCHER_TYPE = ' market watcher';

let buyReason;
let sellReason;
let optionsFromConfig;

const SlackAsync = function(done) {
  _.bindAll(this);

  // this.slack;
  this.price = 'N/A';

  this.done = done;
  this.setupWebApi();
  //this.setupRTM(); // todo
};
let gekkoNameHash, gekkoNameShort;

SlackAsync.prototype.setupWebApi = function() {

  let options = CreateOptionsFromConfig(config), text = '';
  gekkoNameHash = CreateNameHash({ options });
  gekkoNameShort = CreateNameShort();
  this.slack = new WebClient(slackConfig.token);
  let done = this.done;

  const setupSlack = function(error, result) {
    let attachments = [];

    if(options.strategy) {
      text = `Gekko started! (${ gekkoNameShort })`;
    } else {
      text = `Watcher started! (${ gekkoNameShort })`; // presumably this is a watcher
    }
    if (slackConfig.sendMessageOnStart) {
      if(config && config.tradingAdvisor && options.strategy){
        attachments.push(GEKKO_STRATEGY_SETTINGS());
      }
      const body = this.createResponse(
        attachments, [], text, {
          id: gekkoNameShort
        });
      try {
        this.send(body, gekkoNameHash);
      } catch(eeee){
        debugger;
        console.error(eeee);
      }
    } else {
      log.debug('Skipping Send message on startup');
    }
    done();
  };


  if(config.type !== WATCHER_TYPE && config.options && config.options.sendNotifications === true) {
    console.log(`slackAsync plugin:: run setupSlack, gekkoNameHash: ${ gekkoNameHash }, gekkoNameShort: ${ gekkoNameShort }, gekkoId: ${ config.gekkoId }`);
    // console.log(`slackAsync plugin:: run setupSlack, gekkoId: ${ JSON.stringify(config.gekkoId) }, type: ${ config.type }, sendNotifications: ${ config.options && config.options.sendNotifications }`);
    setupSlack.call(this);
  } else {
    done();
  }
};

// https://github.com/SlackAPI/node-slack-sdk#using-the-real-time-messaging-api
// https://api.slack.com/incoming-webhooks
SlackAsync.prototype.setupRTM = function(done) {
  const { RTMClient } = require('@slack/rtm-api');

  // An access token (from your Slack app or custom integration - usually xoxb)
  const token = process.env.SLACK_TOKEN;

  // The client is initialized and then started to get an active connection to the platform
  const rtm = new RTMClient(token);
  rtm.start().catch(console.error);

  // Calling `rtm.on(eventName, eventHandler)` allows you to handle events (see: https://api.slack.com/events)
  // When the connection is active, the 'ready' event will be triggered
  rtm.on('ready', async () => {

    // Sending a message requires a channel ID, a DM ID, an MPDM ID, or a group ID
    // The following value is used as an example
    const conversationId = 'C1232456';

    // The RTM client can send simple string messages
    const res = await rtm.sendMessage('Hello there', conversationId);

    // `res` contains information about the sent message
    // console.log('Message sent: ', res.ts);
  });

// After the connection is open, your app will start receiving other events.
  rtm.on('user_typing', (event) => {
    // The argument is the event as shown in the reference docs.
    // For example, https://api.slack.com/events/user_typing
    // console.log(event);
  });
};

SlackAsync.prototype.createResponse = function(attachments, blocks, text, gekkoObject) {
  attachments = attachments || [];
  blocks = blocks || [];
  text = text || ' ';
  gekkoObject = gekkoObject || {}

  const that = this;
  const options = CreateOptionsFromConfig(config);

  /*let mainSection = {
    "type": "section",
    "text": {
      "type": "mrkdwn",
      "text": `${ text }`
    }
  }*/
  // text && blocks.push(mainSection);
  blocks.push(DETAILS_OVERFLOW_TEMPLATE(options, this));

  attachments.unshift(ATTACHMENT_HEADER_TEMPLATE(gekkoObject, {
    pretext: text,
    text: '',
    // title: `${ gekkoObject.id } details`
  }));

  const template = {
    'username': that.createUserName(),
    'icon_url': that.createIconUrl(),
    'text': `${ text }`, // this is what is seen on mobile notifications

    'attachments': attachments,
    'blocks': blocks,
  };

  return template;
};
SlackAsync.prototype.processCandle = function(candle, done) {
  this.price = candle.close;
  done();
};

// processAdvice
// processTradeInitiated
// processPortfolioChange
// processPortfolioValueChange
// processTradeCompleted
let messagesHash = {}
let lastBuyTrade;
let initialBalance;

SlackAsync.prototype.processAdvice = function(advice) {
  return ; // don't show for now
  let text, color, options = {}, template;
  if (advice.recommendation === 'soft' && slackConfig.muteSoft) return;

  if (advice.recommendation === 'long') {
    color = 'good';
    text = `${ gekkoNameShort } Advised: BUY`;
  } else if (advice.recommendation === 'short') {
    color = 'danger';
    text = `${ gekkoNameShort } Advised: SELL`;
  } else {
    // warning
    color = 'warning';
  }
  color = '';
  options.color = color;
  Object.assign(options, advice);
  const body = this.createResponse([], [], text, advice);
  this.sendGekkoEvent(body, advice);
};

SlackAsync.prototype.processTradeInitiated = function(pendingTrade) {
  console.log('slackAsync::processTradeInitiated::', pendingTrade.id);
  const that = this;

  let text, color, options = {}, template, reason = 'N/A';
  if(!initialBalance){
    initialBalance = pendingTrade.balance;
  }

  if (pendingTrade.action === 'buy') {
    color = 'warning';
    text = `Trade Initiated: BUY`;
    reason = buyReason;
  } else if (pendingTrade.action === 'sell') {
    color = 'warning';
    text = `Trade Initiated: SELL`;
    reason = sellReason;
  } else {
    // warning
    color = 'warning';
  }
  color = '';
  options.color = color;
  Object.assign(options, pendingTrade);
  const body = this.createResponse([
    {
      "mrkdwn_in": [ "text" ],
      "color": color,
      "fields": [
        {
          "title": "Pair",
          "value": `${ that.createUserName() }`,
          "short": true
        },
        {
          "title": "Reason",
          "value": `${ reason }`,
          "short": true
        },
        {
          "title": "Asset",
          "value": `${ pendingTrade.portfolio.asset }`,
          "short": true
        },
        {
          "title": "Currency",
          "value": `${ pendingTrade.portfolio.currency }`,
          "short": true
        },
        {
          "title": "Balance",
          "value": `${ pendingTrade.balance }`,
          "short": false
        },
        {
          "title": "Date",
          "value": `${ pendingTrade.date }`,
          "short": false
        },
      ],
    }
  ], [], text, pendingTrade);
  this.sendGekkoEvent(body, pendingTrade);
};

SlackAsync.prototype.processTradeAborted = function(trade) {
  console.log('slackAsync::processTradeAborted::', trade.id);
  let text, color, options = {};

  text = 'Trade Aborted!';
  color = 'danger';
  options.color = color;
  Object.assign(options, trade);
  const body = this.createResponse([
    {
      "mrkdwn_in": [ "text" ],
      "color": color,
      "fields": [
        {
          "title": "JSON",
          "value": `${ JSON.stringify(trade) }`,
          "short": false
        },
      ],
    }
  ], [], text, trade);
  this.sendGekkoEvent(body, trade);
};

SlackAsync.prototype.processTradeCancelled = function(trade) {
  console.log('slackAsync::processTradeCancelled::', trade.id);
  let text, color, options = {};

  text = 'Trade Cancelled!';
  color = 'danger';
  options.color = color;
  Object.assign(options, trade);
  const body = this.createResponse([
    {
      "mrkdwn_in": [ "text" ],
      "color": color,
      "fields": [
        {
          "title": "JSON",
          "value": `${ JSON.stringify(trade) }`,
          "short": false
        },
      ],
    }
  ], [], text, trade);
  this.sendGekkoEvent(body, trade);
};

SlackAsync.prototype.processTradeErrored = function(trade) {
  console.log('slackAsync::processTradeErrored::', trade.id);
  let text, color, options = {};

  text = 'Trade Errored!';
  color = 'danger';
  options.color = color;
  Object.assign(options, trade);
  const body = this.createResponse([
    {
      "mrkdwn_in": [ "text" ],
      "color": color,
      "fields": [
        {
          "title": "JSON",
          "value": `${ JSON.stringify(trade) }`,
          "short": false
        },
      ],
    }
  ], [], text, trade);
  this.sendGekkoEvent(body, trade);
};

SlackAsync.prototype.processPortfolioChange = function(portfolio) {
  //{
  //   "asset": 0.017,
  //   "currency": 0
  // }
  //{
  //   "asset": 0,
  //   "currency": 0.00014828
  // }
  // console.log('processPortfolioChange');
};

SlackAsync.prototype.processPortfolioValueChange = function(portfolioValue) {
  // debugger;
  //console.log('processPortfolioValueChange');
};

SlackAsync.prototype.processTradeCompleted = function(trade) {
  console.log('slackAsync::processTradeCompleted::', trade.id);

  let text, color, options = {}, buyTrade, isTradeSuccess = true;

  if (trade.action === 'buy') {
    color = 'warning';
    text = `Trade Completed: BUY`;
    lastBuyTrade = trade;
  } else if (trade.action === 'sell') {
    color = 'warning';
    text = `Trade Completed: SELL`;
    buyTrade = lastBuyTrade || {};
    if(buyTrade.balance >= trade.balance){
      isTradeSuccess = false;
      color = 'danger';
    } else {
      isTradeSuccess = true;
      color = 'good';
    }
  } else {
    color = 'warning';
  }

  options.color = color;
  Object.assign(options, trade);
  const body = this.createResponse([
    {
      "mrkdwn_in": [ "text" ],
      "color": color,
      "fields": [
        {
          "title": "Pair",
          "value": `${ this.createUserName() }`,
          "short": false
        },
        {
          "title": "Cost",
          "value": `${ trade.cost }`,
          "short": false
        },
        {
          "title": "Amount",
          "value": `${ trade.amount }`,
          "short": false
        },
        {
          "title": "Price",
          "value": `${ trade.price }`,
          "short": false
        },
        {
          "title": "Effective Price",
          "value": `${ trade.effectivePrice }`,
          "short": false
        },
        {
          "title": "Fee Percent",
          "value": `${ trade.feePercent }`,
          "short": false
        },
        {
          "type": "divider",
        },
        {
          "title": "Balance",
          "value": trade.action === 'buy'?`${ trade.balance }`:
            `${ trade.balance } (${ ((trade.balance - buyTrade.balance) / buyTrade.balance * 100).toFixed(3) }%,
            total: ${ ((trade.balance - initialBalance) / initialBalance * 100).toFixed(3) }%)`,
          "short": false
        },
        {
          "title": "Date",
          "value": `${ trade.date }`,
          "short": false
        },
        {
          "title": "Asset",
          "value": `${ trade.portfolio.asset }`,
          "short": true
        },
        {
          "title": "Currency",
          "value": `${ trade.portfolio.currency }`,
          "short": true
        },
      ],
    }
  ], [], text, trade);
  this.sendGekkoEvent(body, trade);
};
SlackAsync.prototype.finalize = function(done) {
  console.log('slackAsync::finalize::');
  let text, color, options = {}, trade = {
    id: '-'
  };

  text = 'Finalized';
  color = 'warning';
  options.color = color;
  Object.assign(options, trade);
  const body = this.createResponse([
    {
      "mrkdwn_in": [ "text" ],
      "color": color,
      "fields": [
        {
          "title": "Gekko stopped",
          "value": `${ gekkoNameShort }`,
          "short": false
        },
        {
          "title": "JSON",
          "value": `${ JSON.stringify(trade) }`,
          "short": false
        },
      ],
    }
  ], [], text, trade);
  this.sendGekkoEvent(body, trade);
  done();
}
SlackAsync.prototype.processStratNotification = function({ content }) {
  console.log('slackAsync::processStratNotification::', content.type, content.reason);
  if(content.type === 'buy advice' ){
    buyReason = content.reason;
  } else if( content.type === 'sell advice'){
    sellReason = content.reason;
  }
};

SlackAsync.prototype.sendGekkoEvent = function(content, object) {
  (async () => {
    const id = object && object.id;
    const parentHash = CreateNameHash({ options: CreateOptionsFromConfig(config) });

    content['channel'] = slackConfig.channel;

    try {
      const res1 = await this.slack.chat.postMessage(content);
      // res.then((res1) => {
      let msgObj = {
        ts: res1.ts
      }
      if (id) {
        msgObj['gekkoId'] = parentHash;
        msgObj['object'] = object;
        messagesHash[id] = msgObj;
      }
      /*}).catch((err, a, b) => {
        debugger;
        console.error(err);
      }).finally((a,b,c)=>{
        debugger;
      });*/
    } catch (err1) {
      debugger;
      console.error(err1);
    }
    // same for response ( to show as replies of the corresponding 'Gekko Started' message)
    if(messagesHash[ parentHash ]){
      content['thread_ts'] = messagesHash[ parentHash ].ts;
      content['reply_broadcast'] = false;
      // content['as_user'] = true;
      // content['username'] = this.createUserName();
      const res1 = this.slack.chat.postMessage(content);
    }
  })();
}
SlackAsync.prototype.send = function(content, id) {
  (async () => {
    content['channel'] = slackConfig.channel;
    try {
      const res = await this.slack.chat.postMessage(content);
      //res.then((res1) => {
      // console.log('Message sent: ', res1);
      let msgObj = {
        ts: res.ts
      }
      if (id) {
        messagesHash[id] = msgObj;
      }
      //});
    } catch (err1) {
      debugger;
      console.error(err1);
    }
  })();
};

SlackAsync.prototype.checkResults = function(error) {
  if (error) {
    log.warn('error sending slack', error);
  } else {
    log.info('Send advice via slack.');
  }
};

SlackAsync.prototype.createUserName = function() {
  const serverName = config.name || 'unknown server';
  return config.watch.exchange[0].toUpperCase() + config.watch.exchange.slice(1) + '-' + config.watch.currency + '/' + config.watch.asset
   + `${ gekkoNameShort ? '(' + gekkoNameShort + ')' : '' }`;
  // + `(${serverName}): ${config.tradingAdvisor.method} `;
};

SlackAsync.prototype.createIconUrl = function() {
  const asset = config.watch.asset === 'XBT' ? 'btc' : config.watch.asset.toLowerCase();
  return 'https://github.com/cjdowner/cryptocurrency-icons/raw/master/128/icon/' + asset + '.png';
};

module.exports = SlackAsync;

// See: https://api.slack.com/methods/chat.postMessage
// https://api.slack.com/docs/message-buttons
// https://api.slack.com/docs/messages/builder

const ATTACHMENT_HEADER_TEMPLATE = (options, options2) => {
  options = options || {};
  const date = options.date || moment();
  return {
    'pretext': `${ options2.pretext || ''}`,
    'text': `${ options2.text || ''}`,
    'title': `${ options2.title || ''}`,
    'footer': `${ options.id ? 'Id ' +  options.id : ''}`,
    'footer_icon': 'https://platform.slack-edge.com/img/default_application_icon.png',
    'ts': date.unix(),
  };
};

function CreateOptionsFromConfig(config) {
  if(!optionsFromConfig) {
    const strategy = config.tradingAdvisor.method;
    let type = (!strategy) ? 'Watcher' : config.type === 'paper trader' ? 'Paper Trader' : 'TRADE BOT!';
    const options = {
      server: config.name,
      exchange: config.watch.exchange.toUpperCase(),
      strategy: strategy,
      pair: config.watch.currency + '/' + config.watch.asset,
      type: type
    }
    optionsFromConfig = options;
  }
  return optionsFromConfig;
}
const CreateNameShort = () => {
  let str = config.gekkoId;
  return str ? `${ GetCodeLetterForGekkoName(config) }-${ str.substr(str.length - 4, str.length) }`: '';
}
const CreateNameHash = ({ options }) => {
  options = options || CreateOptionsFromConfig(config) || {};
  let ret = `gekko_${ options.server }_${options.exchange}_${options.strategy}_${ options.pair }_${ CreateNameShort() }`;
  return ret;
}

function GetCodeLetterForGekkoName(config1){
  let ret = 'G', options = CreateOptionsFromConfig(config1 || config);
  options && options.type && (ret = options.type.charAt(0).toUpperCase());
  return ret;
}
const GetParentGekkoMessage = () => {
  return messagesHash[CreateNameHash({ })];
}
const GEKKO_STRATEGY_SETTINGS = () => {
  return tomlJs && tomlJs.dump && config && config.tradingAdvisor && {
    "mrkdwn_in": [ "text" ],
    "color": 'info',
    "fields": [
    {
      "title": "Strategy",
      "value": `${ config.tradingAdvisor.method }`,
      "short": false
    },
    {
      "title": "Candle Size",
      "value": `${ config.tradingAdvisor.candleSize }`,
      "short": true
    },
    {
      "title": "History Size",
      "value": `${ config.tradingAdvisor.historySize }`,
      "short": true
    },
    {
      "title": "Strategy Settings",
      "value": `${ tomlJs.dump(config[config.tradingAdvisor.method]) }`,
      "short": false
    },
  ],
  }
}
const DETAILS_OVERFLOW_TEMPLATE = (options, that) => {
  options = options || {};
  let messageId = '';
  const parentMessage = GetParentGekkoMessage();
  messageId = parentMessage && `p${ parentMessage.ts.replace('.','') }` || '';
  return {
    "type": "section",
    "block_id": "section 890",
    "text": {
      "type": "mrkdwn",
      "text": " "
    },
    "accessory": {
      "type": "overflow",
      "options": [
        {
          "text": {
            "type": "plain_text",
            "text": `SERVER/TYPE: ${ options.server } / ${ options.type }`
          },
          "value": "value-1"
        },
        {
          "text": {
            "type": "plain_text",
            "text": `EXCHANGE/PAIR: ${options.exchange} / ${ options.pair }`
          },
          "value": "value-1"
        },
        {
          "text": {
            "type": "plain_text",
            "text": options.strategy? `STRAT: ${options.strategy}`: `STRAT: N/A (Watcher)`
          },
          "value": "value-1"
        },
        {
          "text": {
            "type": "plain_text",
            "text": "[ View Gekko thread ]"
          },
          "url": `https://${ slackConfig.workspace }.slack.com/archives/${ slackConfig.channel }/${ messageId }`
        },
      ],
      "action_id": "overflow"
    }
  }
}

const BUY_INTERACTION_BUTTONS_TEMPLATE = (options, that) => {
  options = options || {};
  return {
    'username': that.createUserName(),
    'icon_url': that.createIconUrl(),
    'text': `Advised: BUY`,
    'attachments': [
      {
        'text': 'React to advice manually (or simply wait for bot):',
        'fallback': 'You are unable to choose a game',
        'callback_id': 'wopr_game',
        'color': options.color,
        'attachment_type': 'default',
        'actions': [
          {
            'name': 'sell_now',
            'text': 'SELL NOW',
            'type': 'button',
            'style': 'danger',
            'value': 'sell_now',
            'confirm': {
              'title': 'Are you sure?',
              'text': 'You can lose money',
              'ok_text': 'Yes',
              'dismiss_text': 'No',
            },
          },
          {
            'name': 'market_order',
            'text': 'SELL ORDER',
            'type': 'button',
            'value': 'market_order',
          },
        ],
      },
    ],
  };
};

function getRandomFromRange(min, max) {
  return Math.floor(Math.random() * (max - min) + min);
}
