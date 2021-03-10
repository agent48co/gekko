<template lang='pug'>
  div
    div.contain
      router-link.btn--primary(to='/backtest/batch') Batch Backtest
    h2.contain Backtest

    h3.contain(v-if='configCurrent && configCurrent.options && configCurrent.options.name') {{ configCurrent.options.name }}
    p.contain(v-if='configCurrent && configCurrent.options && configCurrent.options.description')
      pre {{ configCurrent.options.description }}
    .hr
    config-builder(v-on:config='check' :configCurrent="configCurrent")

    result(v-if='backtestResult && backtestState === "fetched"', :result='backtestResult', v-bind:config={  })

    div.tradingviewContainer(v-bind:style="{ display: tradingviewDisplay }")
      tradingviewChart(:height='500', v-bind:config="config", v-bind:backtestResult="backtestResult" :configCurrent="configCurrent")
    div(v-if='backtestable')
      .txt--center
        a.button--save.w100--s.my1.btn--primary.btn--empty(href='#', v-if='backtestState !== "fetching"', v-on:click.prevent='saveConfig') Save
        a.button--backtest.w100--s.my1.btn--primary(href='#', v-if='backtestState !== "fetching"', v-on:click.prevent='run') Backtest
        router-link.button--backtest.w100--s.my1.btn--red(:to='`live-gekkos/new?configId=${ savedConfigId }`', v-if='backtestState !== "fetching" && savedConfigId', v-on:click.prevent='run') Start Gekko
        div(v-if='backtestState === "fetching"').scan-btn
          p Running backtest..
          spinner
</template>

<script>
import configBuilder from './backtestConfigBuilder.vue'
import result from './result/result.vue'
import { post } from '../../tools/ajax'
import spinner from '../global/blockSpinner.vue'
import tradingviewChart from '../tradingview/tradingviewChartContainer.vue'
import configGlobal from '../../../config.json';

export default {
  data: () => {
    return {
      backtestable: false,
      backtestState: 'idle',
      backtestResult: false,
      config: false,
      tradingviewDisplay: 'none',
      savedConfigId: null
    }
  },
  mounted: async function() {
    if(this.$route.query.configId) {
      this.savedConfigId = this.$route.query.configId;
      this.$store.dispatch({
        type: 'FETCH_CONFIG_CURRENT',
        payload: { configId: this.savedConfigId }
      }).then(response => {
        // TODO: stop the ajax spinner, loading is done at this point.
      }, error => {
        this.$toast({
          text: 'Config NOT fetched',
          fullText: error,
          icon: 'error'
        });
        console.error(error);
      });
    }
  },
  methods: {
    check: function(config) {
      this.config = config;

      if(!config.valid) {
        this.setVisibilityTradingview('none');
        return this.backtestable = false;
      } else {
        this.setVisibilityTradingview('block');
        this.backtestable = true;
      }

    },
    saveConfig: async function() {

      const { value: formValues } = await this.$swal({
        title: 'Config settings',
        html:
          '<input id="swal-input1" class="swal2-input" placeholder="name">' +
          '<textarea id="swal-input2" class="swal2-input" placeholder="description" style="height: 200px;"></textarea>' +
          '<span id="swal-error1" style="color: red" ></span>',
        showCancelButton: true,
        preConfirm: () => {
          const name = document.getElementById('swal-input1').value
            , description = document.getElementById('swal-input2').value;
          if(name === '') {
            document.getElementById('swal-error1').innerText = 'Name cannot be empty!';
            return false;
          }
          return [
            name,
            description
          ]
        }
      });
      if(formValues && formValues[0]) {
        this.config.options = {
          name: formValues[0],
          description: formValues.length > 1 ? formValues[1] : '',
          result: this.backtestResult ? {
            timespan: this.backtestResult.performanceReport.timespan,
            profit: this.backtestResult.performanceReport.profit,
            yearlyProfit: this.backtestResult.performanceReport.yearlyProfit,
          } : null
        };
        post('configs/new', this.config,  (error, response) => {
          if(error) {
            this.$toast({
              text: 'Config NOT saved',
              fullText: error,
              icon: 'error'
            });
          } else {
            this.savedConfigId = response.id;
            this.$swal({
              title: 'Config saved',
              icon: 'success',
              text: `${ configGlobal.url }/#backtest?configId=${ response.id }`,
              confirmButtonText: 'Ok',
              reverseButtons: true
            });
          }
        });
      }
    },
    run: function() {
      const that = this;
      this.backtestState = 'fetching';

      post('backtest', this.config, (error, response) => {
        this.backtestState = 'fetched';
        if (error || !response || response.error) {
          console.log('post->batchBacktest:: error: ', error);
          that.$toast({
            text: `Backtest error: ${ error || response && response.error || ''}`,
            fullText: '',
            icon: 'error',
          });
        } else {
          window.response = response; // very temp!!
          this.backtestResult = response;
        }
      });
    },
    setVisibilityTradingview: function(display){
      this.$set(this, 'tradingviewDisplay', display);
    }
  },
  computed: {
    configCurrent: function() {
      return this.$store.state.configCurrent || {};
    },
  },
  components: {
    configBuilder,
    result,
    spinner,
    tradingviewChart,
  }
}
</script>
