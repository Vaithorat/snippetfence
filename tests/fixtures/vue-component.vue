<template>
  <!-- @fence-begin "payment-form" -->
  <div class="payment-form">
    <input v-model="cardNumber" placeholder="Card Number" />
    <input v-model="expiry" placeholder="MM/YY" />
    <input v-model="cvv" placeholder="CVV" />
    <button @click="processPayment">Pay</button>
  </div>
  <!-- @fence-end -->
</template>

<script setup lang="ts">
const cardNumber = ref('');
const expiry = ref('');
const cvv = ref('');

async function processPayment() {
  // Normal code
  console.log('Processing...');
}
</script>
