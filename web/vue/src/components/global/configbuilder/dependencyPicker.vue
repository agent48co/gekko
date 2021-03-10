<template lang='pug'>
.grd
  div
    h3
      a(v-on:click='isHidden = false') Dependencies
    p(v-if='!isHidden')  Gekkos JSON (TODO):
    textarea(v-if='!isHidden').params(v-model='rawDependencies').control--dependencies-input
    p.bg--red.p1(v-if='rawDependenciesError') {{ rawDependenciesError.message }}
</template>

<script>

import _ from 'lodash'
import { get } from '../../../tools/ajax'

export default {
  data: () => {
    return {
      isHidden: true,
      rawDependencies: defTxt,
      rawDependenciesError: false,

      dependencies: []
    };
  },
  created: function () {
    this.emitConfig();
  },
  watch: {
    rawDependencies: function() { this.emitConfig() }
  },
  computed: {
    config: function() {
      return this.dependencies;
    }
  },
  methods: {
    emitConfig: function() {
      if(this.parseParams()){
        this.$emit('dependenciesConfig', this.config);
      }
    },
    parseParams: function() {
      let ret = false;
      try {
        if(this.rawDependencies !== ''){
          this.dependencies = JSON.parse(this.rawDependencies);
        } else {
          this.dependencies = [];
        }
        this.rawDependenciesError = false;
        ret = true;
      } catch(e) {
        this.rawDependenciesError = e;
        this.dependencies = {};
      }
      return ret;
    }
  }
}
const defTxt = ``;
/*const defTxt = `
[
   {
      "tradingAdvisor":{
         "enabled":true,
         "method":"$lon-turtles",
         "candleSize":1440,
         "historySize":39
      },
      "watch":{
         "exchange":"binance",
         "currency":"USDT",
         "asset":"BTC"
      },
      "$lon-turtles":{
         "atrPeriod":39,
         "atrStop":20,
         "enterFast":20,
         "enterSlow":55,
         "exitFast":10,
         "exitSlow":20,
         "hiekenAshi":false,
         "useAtrStop":true,
         "useTrailingAtrStop":true,
         "margin":{
            "isPersistent":false,
            "useShort":true
         }
      },
      "type":"paper trader"
   }
]
`*/
</script>
<style>
.align .custom-select select {
  padding: 0.4em 1.2em .3em .8em;
}

.label-like {
  display: block;
  font-size: 0.9em;
  color: #777;
}

.align {
  padding-left: 1em;
}
</style>
