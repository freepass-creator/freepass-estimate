<script setup>
import {watch} from 'vue';
import {quoteState} from '../store.js';
import {다시표시계산} from '../lib/quote/display-runtime.js';
import StepResult from './mobile/StepResult.vue';
const supported=quoteState.scenarios.map((scenario,index)=>({scenario,included:quoteState.send[index]!==false})).filter(({scenario})=>[36,48,60].includes(scenario.term));
if(supported.length!==quoteState.scenarios.length){
  quoteState.scenarios=supported.length?supported.map(row=>row.scenario):[{term:60,dep:quoteState.cond.dep,pre:quoteState.cond.pre}];
  quoteState.send=supported.length?supported.map(row=>row.included):[true];
}
watch(()=>JSON.stringify([quoteState.vehicle,quoteState.cond,quoteState.scenarios,quoteState.tint?.product,[...(quoteState.tint?.areas||[])],quoteState.extras]),다시표시계산,{immediate:true});
</script>
<template><div class="public-quote-result" style="grid-column:1/-1"><StepResult /></div></template>
