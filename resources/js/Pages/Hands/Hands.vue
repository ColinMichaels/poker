<template>
	    <div class="hands flex flex-col">
              <div class="hand flex flex-col py-20 h-64"
                   v-for="hand in hands"
                   v-bind:name="hand.name"
                   v-bind:key="hand.rank"
              >
                  <h4 class="text-white text-3xl font-black">{{hand.name}}  <span class="px-3 rounded text-xs  text-gray-600 bg-gray-800 mx-1" v-for="hand in hand.hasHand">{{hand}}</span></h4>
                   <p class="text-sm text-white italic mt-4">{{hand.description}}</p>
                  <div class="flex mt-6">
                     <div class="poker-card" v-for="card in hand.cards"
                     v-bind:key="card">
                         <card :name="card" :is_flipped="true"></card>
                     </div>
                  </div>
              </div>
        </div>
</template>

<script>
    import Card from "@/components/Poker/Card";
    export default {
        name: "Hands",
        components: {
            Card
        },
        data(){
            return{
                hands:[
                    {
                        name : 'Royal Straight Flush',
                        description: 'Ace, King, Queen, Jack, Ten in order and all the same suit.',
                        isHand : 'royal',
                        rank : 1,
                        cards : ['AD', 'KD', 'QD','JD', '10D'],
                        hasHand : ['straight', 'flush', 'royal']
                    },
                    {
                        name : 'Straight Flush',
                        description: 'A straight and all the same suit.',
                        isHand: 'straight-flush',
                        rank : 2,
                        cards : ['9S','8S','7S','6S', '5S'],
                        hasHand: ['straight','flush']
                    },
                    {
                        name : 'Four of a kind',
                        description: 'Four cards of the same rank.',
                        isHand : 'four',
                        rank : 3,
                        cards : ['QD','QH','QS','QC','2H'],
                        hasHand: ['four']
                    },
                    {
                        name : 'Full House',
                        description: 'Three of a kind and a pair of the same rank.',
                        isHand: 'full',
                        rank : 4,
                        cards : ['JS','JD','JC','10H','10D'],
                        hasHand: ['three','two']
                    },
                    {
                        name : 'Flush',
                        description: 'Any five cards of the same suit, but not in order (straight).',
                        isHand : 'flush',
                        rank : 5,
                        cards : ['2S','8S','10S','JS','KS'],
                        hasHand : ['flush']
                    },
                    {
                        name : 'Straight',
                        description: 'Any five cards in a row, but not of the same suit.',
                        isHand : 'straight',
                        rank : 6,
                        cards : ['2H','3C','4D','5H','6D'],
                        hasHand : ['straight']
                    },
                    {
                        name : 'Three of a kind',
                        description: 'Three cards of the same rank.',
                        isHand : 'three',
                        rank : 7,
                        cards : ['5C','5D','5S','JC','10H'],
                        hasHand : ['three']
                    },
                    {
                        name : 'Two pair',
                        description: 'Two different pairs.',
                        isHand : 'two',
                        rank : 8,
                        cards : ['2H','2C','4D','4H','6D'],
                        hasHand : ['two', 'pair']
                    },
                    {
                        name : 'Pair',
                        description: 'Two cards of the same rank.',
                        isHand : 'pair',
                        rank : 9,
                        cards : ['AH','AC','4S','7H','6D'],
                        hasHand : ['pair']
                    },
                    {
                        name : 'High Card',
                        description: 'When there is no match to any of the above scenarios. You would call the card with the highest rank in your hand `The High Card`',
                        isHand : 'high',
                        rank : 10,
                        cards : ['JH','10C','5S','3H','7D'],
                        hasHand : ['high']
                    }
                ]
            }
        }
    }
</script>
